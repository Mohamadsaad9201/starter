import {netlifySnapshot,withFramer,framerIdentity} from "./website-providers.ts";
import {websiteAction} from "./website-edits.ts";
import {analyticsAction,analyticsSync} from "./marketing-metrics.ts";
import {leadgenAction} from "./leadgen.ts";
import {pageContentAction,publishPageContent,verifyPageContent} from './page-content.ts';
import { syncCommerce } from "./reporting.ts";
import { assertServiceDraft } from "../_shared/service-scope.ts";
import { preparePriority } from "./priorities.ts";
import { experimentAction, assertExperimentWrite, publishExperiment, monitorExperiment } from "./search-experiments.ts";
import { pageSearchBaseline, assertSearchPublishable } from "./search-strategy.ts";
// SEO Engine backend: connector tests, Search Console sync, applying approved fixes.
// Auth: an admin's Supabase session token, or the internal cron key (x-engine-key).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { modelForGemini, terminalProviderError, summarizeChecks, selectGoogleProperty, normalizeText } from "../_shared/reliability.ts";
import { verifyBatch, readShopifyValue } from "./verification.ts";
import { brandBrief, permittedCopy, indexingValue, assertCurrentBusinessCopy } from "../_shared/business.ts";
import { savePageSnapshots, auditStep, newCheckpoint, matchAuditLease } from "./audits.ts";
import { applyRedirect } from "./redirects.ts";
import { claudeWriterRequest, claudeWriterText } from "../_shared/writer.ts";
import { providerPaused, generateVisibilityPlan, visibilityReport } from "./visibility.ts";
import { recordPilot, pilotAction } from "./pilot.ts";
import { paidAction, syncAds, accessibleAccounts, executeAdChange } from "./paid.ts";
import { contentPlan, schedulePublication, publishArticle, verifyArticle, measureArticle } from "./content-cycle.ts";
import { operationsAction, healthCheck, syncSearch } from "./operations.ts";
import { workspaceAction } from "./workspace.ts";
import { generateSeoCopy, generateContentDraft } from "./writing.ts";
import { prepareArticleResearch } from './article-research.ts';

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SHOPIFY_API = "2026-07";
const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-engine-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function authorized(req: Request): Promise<boolean> {
  const key = req.headers.get("x-engine-key");
  if (key) {
    const { data } = await db.rpc("get_engine_key");
    return !!data && data === key;
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const user = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data } = await user.rpc("is_admin");
  return data === true;
}

async function secretFor(connectorId: string): Promise<string | null> {
  const { data } = await db.rpc("get_connector_secret", { p_connector: connectorId });
  return (data as string) ?? null;
}

// ---------- Google service account (Search Console) ----------
type SA = { client_email: string; private_key: string; token_uri?: string };
function serviceAccount(): SA | null {
  const raw = Deno.env.get("GSC_SERVICE_ACCOUNT");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
let tokenCache: { token: string; exp: number } | null = null;
async function googleToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const sa = serviceAccount();
  if (!sa) throw new Error("Search Console is not set up yet: the GSC_SERVICE_ACCOUNT secret is missing.");
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claim}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claim}.${b64url(sig)}` }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error("Google sign-in failed: " + (body.error_description || body.error || res.status));
  tokenCache = { token: body.access_token, exp: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}
// Google access for one connector: a "Sign in with Google" connection (refresh token in Vault) or the shared service account.
const oauthCache: Record<string, { token: string; exp: number }> = {};
async function connectorToken(c?: any): Promise<string> {
  if (!c || c.config?.auth !== "oauth") return googleToken();
  const hit = oauthCache[c.id];
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const refresh = await secretFor(c.id);
  if (!refresh) throw new Error("Google isn't connected for this workspace. Click Connect Google again.");
  let cid = Deno.env.get("GOOGLE_CLIENT_ID") || "", csec = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
  if (!cid || !csec) { const { data } = await db.rpc("get_platform_app", { p_provider: "google" }); const row = Array.isArray(data) ? data[0] : data; cid = row?.client_id || ""; csec = row?.client_secret || ""; }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", signal:AbortSignal.timeout(20000), headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cid, client_secret: csec, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error === "invalid_grant" ? "Google access was revoked or expired. Click Reconnect Google." : "Google sign-in failed: " + (body.error_description || body.error));
  oauthCache[c.id] = { token: body.access_token, exp: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}
async function gsc(path: string, init?: RequestInit, c?: any) {
  const token = await connectorToken(c);
  const res = await fetch("https://www.googleapis.com/webmasters/v3" + path, {
    ...init, signal:AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Search Console error ${res.status}`);
  return body;
}

// ---------- Shopify ----------
async function shopify(shop: string, token: string, query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API}/graphql.json`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) throw new Error(JSON.stringify(body.errors || body).slice(0, 300) || `Shopify ${res.status}`);
  return body.data;
}
function userErrors(data: Record<string, any>) {
  const errs = Object.values(data).flatMap((v: any) => v?.userErrors ?? []);
  if (errs.length) throw new Error(errs.map((e: any) => e.message).join("; "));
}

// ---------- Actions ----------
async function testConnector(id: string) {
  const { data: c, error } = await db.from("connectors").select("*").eq("id", id).single();
  if (error || !c) throw new Error("Connector not found");
  let detail: Record<string, unknown> = {};
  try {
    if (c.type === "shopify") {
      const token = await secretFor(id);
      if (!token) throw new Error("Add the Admin API access token first.");
      const d = await shopify(c.config.shop, token, "{ shop { name primaryDomain { host } } }");
      detail = { shopName: d.shop.name, domain: d.shop.primaryDomain.host };
    } else if (c.type === "wordpress") {
      const pass = await secretFor(id);
      if (!pass) throw new Error("Add the application password first.");
      const base = String(c.config.url).replace(/\/$/, "");
      const res = await fetch(`${base}/wp-json/wp/v2/users/me?context=edit`, {
        headers: { Authorization: "Basic " + btoa(`${c.config.username}:${pass}`) },
      });
      if (!res.ok) throw new Error(`WordPress said ${res.status}. Check the username and application password.`);
      const me = await res.json();
      const root = await fetch(`${base}/wp-json/`).then((r) => r.json()).catch(() => ({}));
      const ns: string[] = root.namespaces || [];
      detail = { user: me.name, seoPlugin: ns.includes("yoast/v1") ? "Yoast" : ns.includes("rankmath/v1") ? "Rank Math" : "none found" };
    } else if (c.type === "webflow") {
      const token = await secretFor(id);
      if (!token) throw new Error("Connect Webflow again.");
      if (!c.config.siteId) throw new Error("No Webflow site was picked.");
      const r = await fetch(`https://api.webflow.com/v2/sites/${c.config.siteId}`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || `Webflow said ${r.status}`);
      detail = { siteName: j.displayName || j.shortName };
    } else if(c.type==="netlify" || c.type==="framer"&&c.config.writeEnabled) {
      const token=await secretFor(c.id);if(!token)throw Error("The provider API key is missing.");
      const {data:business}=await db.from('sites').select('domain').eq('id',c.site_id).single();if(!business)throw Error('Business not found.');
      if(c.type==='netlify'){const n=await netlifySnapshot(c,token,business.domain);detail={...c.config.detail,siteName:n.site.name,blocked:n.blocked,checkedAt:new Date().toISOString()};}
      else detail=await withFramer(c,token,async api=>{await framerIdentity(api,business.domain);const p=await api.getProjectInfo();return {...c.config.detail,siteName:p.name,checkedAt:new Date().toISOString()};});
    } else if (c.type === "gsc") {
      if (!c.config.property) {
        const listing = await gsc("/sites", undefined, c);
        const { data: business, error } = await db.from("sites").select("domain").eq("id", c.site_id).single();
        if (error) throw new Error(error.message);
        const property = selectGoogleProperty(listing.siteEntry || [], business.domain);
        if (!property) throw new Error("Google authorization is saved. Choose a Search Console property, or reconnect with an account that has access to this business.");
        c.config = { ...c.config, property, connectionStage: "awaiting_sync" };
      }
      const site = await gsc(`/sites/${encodeURIComponent(c.config.property)}`, undefined, c);
      if (!site.permissionLevel || site.permissionLevel === "siteUnverifiedUser")
        throw new Error(c.config.auth === "oauth" ? `${c.config.account || "This Google account"} has no access to this property.` : "The service account has no access to this property yet.");
      detail = { permission: site.permissionLevel, account: c.config.account };
    } else {
      const res = await fetch(String(c.config.url), { redirect: "follow" });
      if (!res.ok) throw new Error(`Site returned ${res.status}`);
      const html = await res.text();
      detail = { title: (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").trim().slice(0, 120) };
    }
    const { error: savedError } = await db.from("connectors").update({ status: "connected", last_checked_at: new Date().toISOString(), last_error: null, config: { ...c.config, detail } }).eq("id", id);
    if (savedError) throw new Error(savedError.message);
    return { ok: true, detail };
  } catch (e) {
    const msg = (e as Error).message;
    await db.from("connectors").update({ status: "error", last_checked_at: new Date().toISOString(), last_error: msg }).eq("id", id);
    return { ok: false, error: msg };
  }
}

async function gscSync(siteId?: string) {
  let q = db.from("connectors").select("*").eq("type", "gsc").in("status", ["connected", "error"]);
  if (siteId) q = q.eq("site_id", siteId);
  const { data: conns } = await q;
  const out: Record<string, unknown> = {};
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(Date.now() - 2 * 86400_000);
  const start90 = new Date(end.getTime() - 89 * 86400_000);
  const start28 = new Date(end.getTime() - 27 * 86400_000);
  for (const c of conns || []) {
    try {
      if (!c.config.property) throw new Error("Choose the Search Console property for this business first.");
      const prop = encodeURIComponent(c.config.property);
      const query = (body: unknown) => gsc(`/sites/${prop}/searchAnalytics/query`, { method: "POST", body: JSON.stringify(body) }, c);
      const daily = await query({ startDate: day(start90), endDate: day(end), dimensions: ["date"], rowLimit: 200, dataState: "final" });
      const rows = (daily.rows || []).map((r: any) => ({ site_id: c.site_id, date: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
      if (rows.length) { const { error } = await db.from("gsc_daily").upsert(rows); if (error) throw new Error(error.message); }
      const qs = await query({ startDate: day(start28), endDate: day(end), dimensions: ["query"], rowLimit: 250 });
      const qrows = (qs.rows || []).map((r: any) => ({ site_id: c.site_id, period_end: day(end), query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
      { const { error } = await db.from("gsc_queries").delete().eq("site_id", c.site_id).eq("period_end", day(end)); if (error) throw new Error(error.message); }
      if (qrows.length) { const { error } = await db.from("gsc_queries").insert(qrows); if (error) throw new Error(error.message); }
      const ps = await query({ startDate: day(start28), endDate: day(end), dimensions: ["page"], rowLimit: 250 });
      const prows = (ps.rows || []).map((r: any) => ({ site_id: c.site_id, period_end: day(end), page: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
      { const { error } = await db.from("gsc_pages").delete().eq("site_id", c.site_id).eq("period_end", day(end)); if (error) throw new Error(error.message); }
      if (prows.length) { const { error } = await db.from("gsc_pages").insert(prows); if (error) throw new Error(error.message); }
      const { error: savedError } = await db.from("connectors").update({ status: "connected", last_checked_at: new Date().toISOString(), last_error: null, config: { ...c.config, connectionStage: "synced", lastSync: new Date().toISOString(), days: rows.length } }).eq("id", c.id);
      if (savedError) throw new Error(savedError.message);
      let analytics;
      try{analytics=await analyticsSync(c.site_id,{db,connectorToken});}catch(e){analytics={error:(e as Error).message};}
      const geo=await query({startDate:day(start90),endDate:day(end),dimensions:['date','country'],rowLimit:25000,dataState:'final'}).catch(()=>null);
      if(geo&&!(geo.rows?.length>=25000))check(await db.from('marketing_reports').upsert({site_id:c.site_id,source:'gsc_geo',payload:{property_id:c.config.property,start_date:day(start90),end_date:day(end),rows:(geo.rows||[]).map((r:any)=>({date:r.keys[0],country:r.keys[1],clicks:r.clicks,impressions:r.impressions})),synced_at:new Date().toISOString()},synced_at:new Date().toISOString()}));
      out[c.site_id] = { days: rows.length, queries: qrows.length, pages: prows.length,analytics };
    } catch (e) {
      const msg = (e as Error).message;
      await db.from("connectors").update({ status: "error", last_error: msg, last_checked_at: new Date().toISOString() }).eq("id", c.id);
      out[c.site_id] = { error: msg };
    }
  }
  return out;
}

// Atomically claim the exact approved version; an interrupted write is never blindly repeated.
async function claimPublish(f: any) {
  const prior = f.data?.publishClaim;
  if (prior) {
    if (Date.now() - new Date(prior.startedAt).getTime() > 10 * 60_000) {
      await db.from("fixes").update({ status: "failed", error: "The previous publish was interrupted. Check the platform value before explicitly retrying.", data: { ...(f.data || {}), publishClaim: null, failedOperation: f.status === "rollback_requested" ? "rollback" : "publish" } }).eq("id", f.id).eq("site_id", f.site_id).eq("status", f.status).eq("data", JSON.stringify(f.data || {}));
    }
    return false;
  }
  const data = { ...(f.data || {}), publishClaim: { token: crypto.randomUUID(), startedAt: new Date().toISOString() } };
  const { data: row, error } = await db.from("fixes").update({ data }).eq("id", f.id).eq("site_id", f.site_id).eq("status", f.status).eq("after", f.after).eq("data", JSON.stringify(f.data || {})).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (row) f.data = data;
  return !!row;
}

// Apply approved fixes (and rollbacks) for Shopify sites that have a connected Shopify connector.
async function applyFixes(siteId?: string, limit = 8, onlyIds?: string[]) {
  limit = Math.min(limit, 8);
  let cq = db.from("connectors").select("*").eq("type", "shopify").eq("status", "connected");
  if (siteId) cq = cq.eq("site_id", siteId);
  const { data: conns } = await cq;
  const results: Record<string, { deployed: number; rolledBack: number; failed: number }> = {};
  for (const c of conns || []) {
    const token = await secretFor(c.id);
    if (!token) continue;
    const r = (results[c.site_id] = { deployed: 0, rolledBack: 0, failed: 0 });
    let fixQuery = db.from("fixes").select("*").eq("site_id", c.site_id).in("status", ["approved", "rollback_requested"]).limit(limit);
    if(onlyIds)fixQuery=fixQuery.in("id",onlyIds);
    const { data: fixes } = await fixQuery;
    for (const f of fixes || []) {
      if (!(await claimPublish(f))) continue;
      const rollback = f.status === "rollback_requested";
      const value: string = rollback ? (f.restore ?? "") : f.after;
      try {
        await assertCurrentBusinessCopy(db,f);
        if(!(await assertExperimentWrite(db,f)))await assertSearchPublishable(f);
        await applyOne(c.config.shop, token, f, value, rollback);
        const history = [...(f.history || []), { at: new Date().toISOString(), action: rollback ? "rolled_back" : "deployed", value }];
        const { error: saved } = await db.from("fixes").update({ status: rollback ? "rolled_back" : "deployed", deployed_at: new Date().toISOString(), error: null, history, data: { ...(f.data || {}), publishClaim: null, failedOperation: null, verification: { state: "pending", attempts: 0, operation: rollback ? "rollback" : "publish" } } }).eq("id", f.id).eq("site_id", f.site_id);
        if (saved) throw new Error("Platform write succeeded but its record could not be saved. Check the platform before retrying: " + saved.message);
        rollback ? r.rolledBack++ : r.deployed++;
      } catch (e) {
        const history = [...(f.history || []), { at: new Date().toISOString(), action: "failed", error: (e as Error).message }];
        await db.from("fixes").update({ status: "failed", error: (e as Error).message.slice(0, 500), history, data: { ...(f.data || {}), publishClaim: null, failedOperation: rollback ? "rollback" : "publish" } }).eq("id", f.id).eq("site_id", f.site_id);
        r.failed++;
      }
    }
  }
  // Webflow: SEO title and description through the Pages API. Saved in Webflow; visible after the next site publish.
  let wq = db.from("connectors").select("*").eq("type", "webflow").eq("status", "connected");
  if (siteId) wq = wq.eq("site_id", siteId);
  const { data: wconns } = await wq;
  for (const c of wconns || []) {
    const token = await secretFor(c.id);
    if (!token) continue;
    const r = (results[c.site_id] ||= { deployed: 0, rolledBack: 0, failed: 0 });
    let fixQuery = db.from("fixes").select("*").eq("site_id", c.site_id).in("status", ["approved", "rollback_requested"]).in("field", ["seo.title", "seo.description"]).limit(limit);
    if(onlyIds)fixQuery=fixQuery.in("id",onlyIds);
    const { data: fixes } = await fixQuery;
    for (const f of fixes || []) {
      if (!(await claimPublish(f))) continue;
      const rollback = f.status === "rollback_requested";
      const value: string = rollback ? (f.restore ?? "") : f.after;
      try {
        await assertCurrentBusinessCopy(db,f);
        if(!(await assertExperimentWrite(db,f)))await assertSearchPublishable(f);
        const seo = f.field === "seo.title" ? { title: value } : { description: value };
        const res = await fetch(`https://api.webflow.com/v2/pages/${f.ref}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ seo }) });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.message || `Webflow said ${res.status}`); }
        const history = [...(f.history || []), { at: new Date().toISOString(), action: rollback ? "rolled_back" : "deployed", value }];
        const { error: saved } = await db.from("fixes").update({ status: rollback ? "rolled_back" : "deployed", deployed_at: new Date().toISOString(), error: null, history, data: { ...(f.data || {}), publishClaim: null, failedOperation: null, verification: { state: "pending", attempts: 0, operation: rollback ? "rollback" : "publish" } } }).eq("id", f.id).eq("site_id", f.site_id);
        if (saved) throw new Error("Platform write succeeded but its record could not be saved. Check the platform before retrying: " + saved.message);
        rollback ? r.rolledBack++ : r.deployed++;
      } catch (e) {
        await db.from("fixes").update({ status: "failed", error: (e as Error).message.slice(0, 500), data: { ...(f.data || {}), publishClaim: null, failedOperation: rollback ? "rollback" : "publish" } }).eq("id", f.id).eq("site_id", f.site_id);
        r.failed++;
      }
    }
  }
  return results;
}

// Store sales for the Daily Pulse: last 7 days vs the 7 before, from Shopify orders.
async function sales(siteId: string) {
  const { data: conns } = await db.from("connectors").select("*").eq("site_id", siteId).eq("type", "shopify").eq("status", "connected").limit(1);
  const c = conns?.[0];
  if (!c) throw new Error("Shopify isn't connected for this business.");
  const token = await secretFor(c.id);
  if (!token) throw new Error("Shopify isn't connected for this business.");
  const now = Date.now(), cutoff = now - 7 * 86400_000, since = new Date(now - 14 * 86400_000).toISOString();
  let after: string | null = null, cur = 0, prev = 0, orders = 0, prevOrders = 0, currency = "USD";
  for (let i = 0; i < 20; i++) {
    const d = await shopify(c.config.shop, token, `query($q:String!,$a:String){ orders(first:250, after:$a, query:$q, sortKey:CREATED_AT){ nodes{ createdAt cancelledAt test currentTotalPriceSet{ shopMoney{ amount currencyCode } } } pageInfo{ hasNextPage endCursor } } }`, { q: `created_at:>='${since}'`, a: after });
    for (const o of d.orders.nodes) {
      if (o.cancelledAt || o.test) continue;
      const amt = +o.currentTotalPriceSet.shopMoney.amount || 0; currency = o.currentTotalPriceSet.shopMoney.currencyCode || currency;
      if (new Date(o.createdAt).getTime() >= cutoff) { cur += amt; orders++; } else { prev += amt; prevOrders++; }
    }
    if (!d.orders.pageInfo.hasNextPage) break;
    after = d.orders.pageInfo.endCursor;
  }
  return { cur: Math.round(cur * 100) / 100, prev: Math.round(prev * 100) / 100, orders, prevOrders, currency };
}

async function applyOne(shop: string, token: string, f: any, value: string, rollback: boolean) {
  const owner = f.ref as string;
  if (["seo.title", "seo.description", "seo.hidden", "image.alt"].includes(f.field)) {
    const actual = await readShopifyValue(shopify, { config: { shop } }, token, f);
    const canon = (v: any) => f.field === "seo.hidden" ? indexingValue(v) : normalizeText(String(v ?? ""));
    if (canon(actual.value) === canon(value)) return; // An earlier attempt already saved this value.
    const expected = rollback ? f.after : f.restore ?? f.before ?? "";
    if (canon(actual.value) !== canon(expected)) throw new Error("The platform value changed since this proposal. Run a new check before publishing or rolling back.");
  }
  const mf = async (namespace: string, key: string, type: string, v: string) => {
    if (v === "" || v == null) {
      const d = await shopify(shop, token, `mutation($m:[MetafieldIdentifierInput!]!){ metafieldsDelete(metafields:$m){ userErrors{ field message } } }`,
        { m: [{ ownerId: owner, namespace, key }] });
      userErrors(d); return;
    }
    const d = await shopify(shop, token, `mutation($m:[MetafieldsSetInput!]!){ metafieldsSet(metafields:$m){ userErrors{ field message } } }`,
      { m: [{ ownerId: owner, namespace, key, type, value: v }] });
    userErrors(d);
  };
  switch (f.field) {
    case "seo.title": return mf("global", "title_tag", "single_line_text_field", value);
    case "seo.description": return mf("global", "description_tag", "multi_line_text_field", value);
    case "seo.hidden": return mf("seo", "hidden", "number_integer", indexingValue(value));
    case "image.alt": {
      const d = await shopify(shop, token, `mutation($f:[FileUpdateInput!]!){ fileUpdate(files:$f){ userErrors{ field message } } }`, { f: [{ id: f.target, alt: value }] });
      return userErrors(d);
    }
    case "description.replace": {
      const g = await shopify(shop, token, `query($id:ID!){ product(id:$id){ descriptionHtml } }`, { id: owner });
      const html: string = g.product.descriptionHtml || "";
      const from = rollback ? f.after : f.before, to = rollback ? f.before : f.after;
      if (!html.includes(from)) throw new Error("The text to replace is no longer on the page.");
      const d = await shopify(shop, token, `mutation($p:ProductUpdateInput!){ productUpdate(product:$p){ userErrors{ field message } } }`,
        { p: { id: owner, descriptionHtml: html.replace(from, to) } });
      return userErrors(d);
    }
    case "status.draft_redirect": return applyRedirect(shopify, shop, token, f, rollback, async (data: any) => {
      const { data: saved, error } = await db.from("fixes").update({ data }).eq("site_id", f.site_id).eq("id", f.id).eq("status", f.status).eq("data->publishClaim->>token", f.data.publishClaim.token).select("id").maybeSingle();
      if (error || !saved) throw new Error(error?.message || "The publish operation changed. Stopping before further changes.");
      f.data = data;
    });
    default:
      throw new Error(`The engine cannot apply "${f.field}" automatically yet.`);
  }
}

// ---------- AEO: AI answer visibility ----------
type Answer = { text: string; citations: { url: string; title?: string; excerpt?: string }[]; model: string };
const ENGINES: Record<string, { key: string; label: string; ask: (q: string, signal: AbortSignal) => Promise<Answer> }> = {
  chatgpt: {
    key: "OPENAI_API_KEY", label: "ChatGPT",
    ask: async (q, signal) => {
      const model = Deno.env.get("AEO_OPENAI_MODEL") || "gpt-4.1-mini";
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", signal,
        headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, tools: [{ type: "web_search" }], input: q }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error?.message || `OpenAI ${res.status}`);
      let text = ""; const cites: Answer["citations"] = [];
      for (const o of b.output || []) for (const c of o.content || []) if (c.type === "output_text") {
        text += c.text;
        for (const a of c.annotations || []) if (a.type === "url_citation") cites.push({ url: a.url, title: a.title, excerpt: String(c.text||'').slice(Math.max(0,(a.start_index||0)-350),Math.min(String(c.text||'').length,(a.end_index||350)+100)) });
      }
      return { text: text || b.output_text || "", citations: cites, model };
    },
  },
  gemini: {
    key: "GEMINI_API_KEY", label: "Gemini",
    ask: async (q, signal) => {
      const model = modelForGemini(Deno.env.get("AEO_GEMINI_MODEL"));
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", signal,
        headers: { "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")!, "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: q }] }], tools: [{ google_search: {} }] }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error?.message || `Gemini ${res.status}`);
      const cand = b.candidates?.[0] || {};
      const text = (cand.content?.parts || []).map((p: any) => p.text || "").join("");
      const cites = (cand.groundingMetadata?.groundingChunks || []).map((g: any) => ({ url: g.web?.uri, title: g.web?.title })).filter((c: any) => c.url);
      return { text, citations: cites, model };
    },
  },
  claude: {
    key: "ANTHROPIC_API_KEY", label: "Claude",
    ask: async (q, signal) => {
      const model = Deno.env.get("AEO_CLAUDE_MODEL") || "claude-haiku-5-5";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal,
        headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 1200, messages: [{ role: "user", content: q }], tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }] }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error?.message || `Anthropic ${res.status}`);
      let text = ""; const cites: Answer["citations"] = [];
      for (const c of b.content || []) if (c.type === "text") {
        text += c.text;
        for (const ci of c.citations || []) if (ci.url) cites.push({ url: ci.url, title: ci.title, excerpt: ci.cited_text || '' });
      }
      return { text, citations: cites, model };
    },
  },
};
const enabledEngines = () => Object.keys(ENGINES).filter((k) => !providerPaused(k, Deno.env.get("AEO_GEMINI_ENABLED")) && !!Deno.env.get(ENGINES[k].key));
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

function analyze(site: any, a: Answer) {
  const aeo = site.aeo || {};
  const own = [site.name, ...(aeo.aliases || [])].filter(Boolean).map((s: string) => s.toLowerCase());
  const ownDomain = String(site.domain).replace(/^www\./, "").toLowerCase();
  const text = a.text.toLowerCase();
  const firstIdx = (names: string[]) => Math.min(...names.map((n) => { const i = text.indexOf(n.toLowerCase()); return i < 0 ? Infinity : i; }));
  const ownAt = Math.min(firstIdx([...own, ownDomain]));
  const citedHosts = a.citations.map((c) => hostOf(c.url) + " " + (c.title || "").toLowerCase());
  const cited = citedHosts.some((h) => h.includes(ownDomain));
  const comps: { name: string; at: number }[] = [];
  for (const c of aeo.competitors || []) {
    const names = [c.name, ...(c.match || [])];
    const at = firstIdx(names);
    const inCites = citedHosts.some((h) => (c.match || []).concat(c.domain ? [c.domain] : []).some((m: string) => h.includes(m.toLowerCase())));
    if (at < Infinity || inCites) comps.push({ name: c.name, at });
  }
  const mentioned = ownAt < Infinity || cited;
  const position = ownAt < Infinity ? 1 + comps.filter((c) => c.at < ownAt).length : null;
  return { mentioned, cited, position, competitors: comps.map((c) => c.name) };
}

async function aeoStart(siteId?: string) {
  const engines = enabledEngines();
  if (!engines.length) throw new Error("No AI engine keys are set yet. Add OPENAI_API_KEY or ANTHROPIC_API_KEY in Supabase.");
  let sq = db.from("sites").select("id").eq("active", true);
  if (siteId) sq = sq.eq("id", siteId);
  const { data: sites } = await sq;
  const out: Record<string, number> = {};
  for (const s of sites || []) {
    const { data: prompts } = await db.from("aeo_prompts").select("id,prompt").eq("site_id", s.id).eq("active", true);
    if (!prompts?.length) continue;
    const { data: running } = await db.from("aeo_runs").select("id").eq("site_id", s.id).eq("status", "running").limit(1);
    if (running?.length) { out[s.id] = -1; continue; }
    const { data: run } = await db.from("aeo_runs").insert({ site_id: s.id, engines }).select("id").single();
    const rows = prompts.flatMap((p: any) => engines.map((e) => ({ run_id: run!.id, site_id: s.id, prompt_id: p.id, prompt: p.prompt, engine: e })));
    await db.from("aeo_checks").insert(rows);
    out[s.id] = rows.length;
  }
  return out;
}

async function aeoWork(max = 8) {
  // pick pending (or stuck "working" > 10 min) checks
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: picks } = await db.from("aeo_checks").select("*")
    .or(`status.eq.pending,and(status.eq.working,checked_at.lt.${stale})`).in("engine", enabledEngines()).lt("attempts", 3).limit(max);
  if (!picks?.length) {
    // Idle: set up AI tracking for one business that doesn't have questions yet, then start its first check.
    const { data: sites } = await db.from("sites").select("*").eq("active", true);
    for (const s of sites || []) {
      const { count } = await db.from("aeo_prompts").select("id", { count: "exact", head: true }).eq("site_id", s.id);
      if (count) continue;
      const n = await aeoSetup(s).catch(() => 0);
      if (n) await aeoStart(s.id).catch(() => {});
      return { processed: 0, setup: s.id, questions: n };
    }
    return { processed: 0 };
  }
  // Compare-and-set claims prevent cron and a manual worker from purchasing the same answer twice.
  const claimed: any[] = [];
  for (const c of picks) {
    let claim = db.from("aeo_checks").update({ status: "working", checked_at: new Date().toISOString() }).eq("id", c.id).eq("status", c.status).eq("attempts", c.attempts);
    claim = c.checked_at ? claim.eq("checked_at", c.checked_at) : claim.is("checked_at", null);
    const { data: row, error } = await claim.select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (row) claimed.push(c);
  }
  const siteCache: Record<string, any> = {};
  const runIds = new Set<string>();
  await Promise.all(claimed.map(async (c: any) => {
    runIds.add(c.run_id);
    const eng = ENGINES[c.engine];
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 70_000);
    try {
      if (providerPaused(c.engine, Deno.env.get("AEO_GEMINI_ENABLED"))) throw new Error("Provider paused");
      if (!eng || !Deno.env.get(eng.key)) throw new Error("Engine key missing");
      siteCache[c.site_id] ??= (await db.from("sites").select("id,name,domain,aeo").eq("id", c.site_id).single()).data;
      const a = await eng.ask(c.prompt, ctl.signal);
      if (!a.text.trim()) throw new Error("The provider returned no answer. This check was not counted as a visibility result.");
      const r = analyze(siteCache[c.site_id], a);
      await db.from("aeo_checks").update({ status: "done", attempts: c.attempts + 1, ...r, citations: a.citations.slice(0, 20), answer: a.text.slice(0, 6000), model: a.model, error: null, checked_at: new Date().toISOString() }).eq("id", c.id);
    } catch (e) {
      const attempts = terminalProviderError(String((e as Error).message)) ? 3 : c.attempts + 1;
      await db.from("aeo_checks").update({ status: attempts >= 3 ? "failed" : "pending", attempts, error: String((e as Error).message).slice(0, 400), checked_at: new Date().toISOString() }).eq("id", c.id);
    } finally { clearTimeout(t); }
  }));
  for (const id of runIds) await aeoFinalize(id);
  return { processed: claimed.length };
}

async function aeoFinalize(runId: string) {
  const { data: checks } = await db.from("aeo_checks").select("engine,status,mentioned,cited,position,competitors,error").eq("run_id", runId);
  if (!checks || checks.some((c: any) => c.status === "pending" || c.status === "working")) return;
  const summary = summarizeChecks(checks);
  const done = checks.filter((c: any) => c.status === "done");
  await db.from("aeo_runs").update({ status: done.length ? "done" : "failed", finished_at: new Date().toISOString(), summary }).eq("id", runId);
  if (done.length) {
    const {data: run}=await db.from("aeo_runs").select("site_id").eq("id",runId).single();
    if(run) await generateVisibilityPlan(db,run.site_id,enabledEngines()).catch(e=>console.error("Visibility plan:",e.message));
  }
}


// ---------- Checkup: find what's holding the site back and queue fixes ----------
const clean = (t: string) => String(t || "").replace(/\s+/g, " ").trim();
const stripTags = (h: string) => clean(String(h || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"));
let aiError = "";
async function ai(system: string, user: string, maxTokens = 4000, schema?: any): Promise<string | null> {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 45_000);
  try {
    if (Deno.env.get("ANTHROPIC_API_KEY")) {
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ctl.signal, headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, body: JSON.stringify(claudeWriterRequest(Deno.env.get("WRITER_CLAUDE_MODEL") || "claude-sonnet-5-5", system, user, maxTokens, schema)) });
      const j = await r.json(); if (!r.ok) { aiError = `Anthropic ${r.status}: ${j?.error?.message || ""}`; console.error(aiError); if (!Deno.env.get("OPENAI_API_KEY")) return null; } else
      return claudeWriterText(j);
    }
    if (Deno.env.get("OPENAI_API_KEY")) {
      const r = await fetch("https://api.openai.com/v1/responses", { method: "POST", signal: ctl.signal, headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: Deno.env.get("WRITER_OPENAI_MODEL") || "gpt-4.1", instructions: system, input: user, max_output_tokens: maxTokens }) });
      const j = await r.json(); if (!r.ok) { aiError += ` | OpenAI ${r.status}: ${j?.error?.message || ""}`; console.error(aiError); return null; }
      return j.output_text || (j.output || []).flatMap((o: any) => o.content || []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("");
    }
  } catch (e) { aiError = "AI call failed: " + (e as Error).message; console.error(aiError); } finally { clearTimeout(timer); }
  return null;
}
const parseJson = (t: string | null) => {
  if (!t) return null;
  const s = t.replace(/```(?:json)?/gi, "");
  for (const [o, c] of [["{", "}"], ["[", "]"]]) {
    const a = s.indexOf(o), b = s.lastIndexOf(c);
    if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* try next */ } }
  }
  return null;
};
// Evidence-guided drafts; no character-count ranking claims.
let lastRaw = "";
async function writeSeo(site: any, items: any[]) {
  const result = await generateSeoCopy(site, items, ai);
  lastRaw = result.raw;
  aiError = result.error ? (aiError || result.error) : "";
  return result.written;
}
// Questions customers ask AI assistants, plus competitors to watch, written from the business profile.
async function aeoSetup(site: any) {
  const { count } = await db.from("aeo_prompts").select("id", { count: "exact", head: true }).eq("site_id", site.id);
  if (count) return 0;
  const j = parseJson(await ai(`You plan AI-search visibility tracking for a business.\n${brandBrief(site)}\nReturn only JSON: {"questions":[{"q":"...","category":"Discovery|Product|Comparison|Trust|Local|Seasonal|Education"}], "competitors":[{"name":"...","domain":"..."}]}. Write 15 questions real customers would type into ChatGPT or Gemini when looking for what this business sells (most should NOT name the business; 2 may). Competitors: up to 6 real, well-known alternatives customers compare it with.`, "Plan it.", 2500));
  const qs = (j?.questions || []).slice(0, 15).filter((x: any) => x?.q);
  if (!qs.length) return 0;
  await db.from("aeo_prompts").insert(qs.map((x: any, i: number) => ({ site_id: site.id, prompt: clean(x.q), category: x.category || "Discovery", sort_order: (i + 1) * 10 })));
  const comps = (j?.competitors || []).filter((c: any) => c?.name).slice(0, 6).map((c: any) => ({ name: c.name, domain: c.domain || null, match: [c.name, c.domain].filter(Boolean) }));
  const aeo = { ...(site.aeo || {}), aliases: site.aeo?.aliases?.length ? site.aeo.aliases : [site.name, String(site.domain).replace(/^www\./, "")], competitors: site.aeo?.competitors?.length ? site.aeo.competitors : comps };
  await db.from("sites").update({ aeo }).eq("id", site.id);
  return qs.length;
}
// Audit cursors and pending drafts are checkpointed after each bounded step. The
// existing site JSON is used here; the general multi-customer job system is phase 2.
async function checkup(siteId: string, start = true, followups = true) {
  const { data: site, error: foundError } = await db.from("sites").select("*").eq("id", siteId).single();
  if (foundError || !site) throw new Error(foundError?.message || "Business not found");
  const previous = site.checkup || null;
  const freshLease = previous?.leaseId && Date.now() - new Date(previous.leaseStartedAt).getTime() < 5 * 60_000;
  if (freshLease) return { running: true, pages: previous.pages || 0 };
  if (!start && !["running", "queued"].includes(previous?.status)) return { skipped: true };
  const { data: conns, error: connError } = await db.from("connectors").select("*").eq("site_id", siteId).eq("status", "connected");
  if (connError) throw new Error(connError.message);
  const shop = (conns || []).find((c: any) => c.type === "shopify");
  let cp: any = previous?.checkpoint && previous.status !== "done" ? structuredClone(previous.checkpoint) : newCheckpoint(!!shop, `https://${String(site.domain).replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`);
  if (cp.followups === undefined) cp.followups = followups;
  const leaseId = crypto.randomUUID(), started_at = previous?.checkpoint && previous.status !== "done" ? previous.started_at : new Date().toISOString();
  const status = (state: string) => ({ status: state, started_at, updated_at: new Date().toISOString(), leaseId, leaseStartedAt: new Date().toISOString(), pages: cp.pages, queued: cp.queued, found: cp.found, stage: cp.pending.length ? "writing" : cp.stage, discovered: cp.table === "tasks" ? cp.urls.length : null, checkpoint: cp });
  let claim = db.from("sites").update({ checkup: status("running") }).eq("id", siteId);
  // Compare small version fields, not the full checkpoint: cursors and pending
  // drafts can exceed HTTP URL limits when encoded as an equality filter.
  claim = matchAuditLease(claim, previous);
  const { data: claimed, error: claimError } = await claim.select("id").maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimed) return { running: true };
  const save = async (patch: any) => {
    const { data: saved, error } = await db.from("sites").update(patch).eq("id", siteId).eq("checkup->>leaseId", leaseId).select("id").maybeSingle();
    if (error || !saved) throw new Error(error?.message || "Audit lease changed; this worker stopped.");
  };
  aiError = "";
  try {
    const until = Date.now() + 35000;
    for (let step = 0; step < 12 && Date.now() < until; step++) {
      const baselineCache = new Map();
      const evidenceFor = (sid:string,url:string) => { const key=sid+'\n'+url; if(!baselineCache.has(key))baselineCache.set(key,pageSearchBaseline(db,gsc,sid,url));return baselineCache.get(key); };
      const next = await auditStep(db, site, shop, structuredClone(cp), { shopify, secretFor, writeSeo, evidenceFor, recordPages:(sid:string,rows:any[])=>savePageSnapshots(db,sid,rows) });
      cp = next;
      await save({ checkup: status("running") });
      if (cp.stage === "finish" && !cp.pending.length) {
        const score = cp.checks ? Math.round(100 * cp.passed / cp.checks) : null;
        const summary = { runId: cp.runId, pages: cp.pages, checks: cp.checks, passed: cp.passed, found: cp.found, queued: cp.queued, kind: cp.table, coverage: cp.failures.length || cp.warnings.length ? "partial" : "complete", failures: cp.failures, warnings: cp.warnings, scope: cp.table === "fixes" ? "Active products, collections, store pages, blog articles and product images" : "Sitemap and linked HTML pages", discovered: cp.table === "tasks" ? cp.urls.length : cp.pages };
        const { data: prior, error: priorError } = await db.from("audits").select("id").eq("site_id", siteId).eq("summary->>runId", cp.runId).limit(1);
        if (priorError) throw new Error(priorError.message);
        if (!prior?.length) {
          const { error } = await db.from("audits").insert({ site_id: siteId, score: score ?? 0, prev_score: site.score, page_count: cp.pages, run_type: "On-page check", summary, highlights: [`Checked ${cp.pages} pages (${summary.coverage} coverage)`, `${cp.queued} new suggestions ready for review`] });
          if (error) throw new Error(error.message);
        }
        await save({ score, prev_score: site.prev_score ?? site.score ?? score, last_run_at: new Date().toISOString(), next_run_at: new Date(Date.now() + 86400_000).toISOString(), checkup: { status: "done", started_at, finished_at: new Date().toISOString(), ...summary } });
        if (cp.followups) {
          if (conns?.some((c: any) => c.type === "gsc")) await gscSync(siteId).catch(e => console.error("Post-audit Google sync:", e.message));
          if (enabledEngines().length) await aeoStart(siteId).catch(e => console.error("Post-audit AEO check:", e.message));
        }
        return summary;
      }
    }
    await save({ checkup: { ...status("queued"), leaseId: null, leaseStartedAt: null } });
    return { running: true, pages: cp.pages, queued: cp.queued, stage: cp.stage };
  } catch (e) {
    // Keep the last completed checkpoint, including the pending proposal batch.
    await db.from("sites").update({ checkup: { ...status("failed"), leaseId: null, leaseStartedAt: null, error: (aiError || (e as Error).message).slice(0, 600) } }).eq("id", siteId).eq("checkup->>leaseId", leaseId);
    throw e;
  }
}
async function checkupWork() {
  const { data, error } = await db.from("sites").select("id,checkup").eq("active", true).in("checkup->>status", ["running", "queued"]).order("last_run_at", { ascending: true, nullsFirst: true }).limit(20);
  if (error) throw new Error(error.message);
  const site = (data || []).find((s: any) => !s.checkup.leaseId || Date.now() - new Date(s.checkup.leaseStartedAt).getTime() >= 5 * 60_000);
  return site ? checkup(site.id, false) : { ran: null };
}
async function checkupDue() {
  const { data, error } = await db.from("sites").select("id,checkup,next_run_at").eq("active", true).or(`next_run_at.is.null,next_run_at.lte.${new Date().toISOString()}`).order("next_run_at", { ascending: true, nullsFirst: true }).limit(20);
  if (error) throw new Error(error.message);
  const site = (data || []).find((s: any) => !["running", "queued", "failed"].includes(s.checkup?.status));
  return site ? checkup(site.id) : { ran: null };
}

// ---------- Drafting ----------
const writerName = () => Deno.env.get("ANTHROPIC_API_KEY") ? "Claude" : Deno.env.get("OPENAI_API_KEY") ? "ChatGPT" : null;
async function writeDraft(siteId: string, workspace: string, kind: string, title: string, brief: string) {
  assertServiceDraft(kind, workspace);
  if (!brief?.trim()) throw new Error("Describe what you need first.");
  const { data: s } = await db.from("sites").select("name,domain,brand,profile").eq("id", siteId).single();
  if (!s) throw new Error("Workspace not found");
  let research:any;
  if(kind==='Blog post') {
    try {
      const {data:pages,error:pageError}=await db.from('pages').select('url,kind,data').eq('site_id',siteId).limit(200);
      if(pageError)throw new Error('The website page inventory could not be read. Retry before generating this article.');
      const providers=['chatgpt','claude'].filter(k=>enabledEngines().includes(k));
      if(!providers.length)throw new Error('Configure Claude or OpenAI with web-search access to research article sources.');
      let researchError;
      for(const provider of providers){try{
        research=await prepareArticleResearch(s,(title||'')+'\n'+brief,pages||[],(q:string)=>ENGINES[provider].ask(q,AbortSignal.timeout(45000)));break;
      }catch(e){researchError=e;}}
      if(!research)throw researchError||new Error('Article source research failed; no draft was saved.');
    } catch(e) {(e as any).safeToRetry=true;throw e;}
  }
  const text = await generateContentDraft(s, kind || "Draft", brief, ai,research);
  const heading = text.match(/^#+\s*(.+)$/m)?.[1]?.trim();
  const { data, error } = await db.from("drafts").insert({
    site_id: siteId, workspace: ["seo", "ads", "website", "conversion"].includes(workspace) ? workspace : "seo",
    kind: kind || "Draft", title: (title?.trim() || heading || brief.trim()).slice(0, 140), body: text.trim(),
  }).select("id").single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!(await authorized(req))) return json({ error: "Not allowed" }, 401);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  try {
    if(String(body.action).startsWith('website_')) { const token=(req.headers.get('authorization')||'').replace(/^Bearer /,''); const actor=token?await db.auth.getUser(token):null; return json(await websiteAction(body,{db,secretFor,actorId:actor?.data?.user?.id})); }
    if(String(body.action).startsWith('analytics_'))return json(await analyticsAction(body,{db,connectorToken}));
    if(String(body.action).startsWith('leadgen_'))return json(await leadgenAction(body,{db,ai}));
    if(String(body.action).startsWith('pilot_'))return json(await pilotAction(body,{db}));
    const paidDeps:any={db,connectorToken,secretFor};
    if(String(body.action).startsWith('ads_')){const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');const actor=token?await db.auth.getUser(token):null;paidDeps.actorId=actor?.data?.user?.id;return json(await paidAction(body,paidDeps));}
    const contentDeps={db,ai,shopify,secretFor,writeDraft,sales,gsc,activeEngines:enabledEngines()};
    if(String(body.action).startsWith('page_content_')){const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');const actor=token?await db.auth.getUser(token):null;return json(await pageContentAction(body,{...contentDeps,actorId:actor?.data?.user?.id}));}
    if(body.action==='reporting_refresh')return json(await syncCommerce(String(body.site_id),contentDeps));
    if(body.action==='priority_plan')return json(await preparePriority(body,{db,ai}));
    const experimentDeps={db,gsc,shopify,secretFor,applyFixes,verifyBatch};
    if(String(body.action).startsWith('search_experiment_')) {
      const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
      const actor=token?await db.auth.getUser(token):null;
      return json(await experimentAction(body,{...experimentDeps,actorId:actor?.data?.user?.id}));
    }
    if(body.action==='publication_schedule')return json(await schedulePublication(body,contentDeps));
    if (String(body.action).startsWith("operation_")) return json(await operationsAction(body,{db,handlers:{
      search_publish:(j:any)=>publishExperiment(j,experimentDeps),search_measure:(j:any)=>monitorExperiment(j,experimentDeps),search_rollback:(j:any)=>publishExperiment(j,experimentDeps,true),
      channel_health:(j:any)=>healthCheck(j.site_id,{db,testConnector,adsHealth:async(c:any)=>{await accessibleAccounts(c,paidDeps);if(!c.config?.account_id)throw new Error('Select the advertising account.');return {ok:true};}}),gsc_sync:(j:any)=>syncSearch(j.site_id,{db,gscSync}),
      page_content_publish:(j:any)=>publishPageContent(j,contentDeps),page_content_verify:(j:any)=>verifyPageContent(j,contentDeps),page_content_reverse:(j:any)=>publishPageContent(j,contentDeps,true),
      commerce_sync:(j:any)=>syncCommerce(j.site_id,contentDeps),
      content_plan:(j:any)=>contentPlan(j,contentDeps),topic_draft:async(j:any)=>({...await workspaceAction({action:'topic_draft',site_id:j.site_id,topic_id:j.payload.topic_id},contentDeps),needs_review:true,summary:'Content drafted. Review the destination, facts and copy before publishing.'}),
      blog_publish:(j:any)=>publishArticle(j,contentDeps),publication_verify:(j:any)=>verifyArticle(j,contentDeps),content_measure:(j:any)=>measureArticle(j,contentDeps),ads_sync:(j:any)=>syncAds(j.site_id,paidDeps),ads_execute:(j:any)=>executeAdChange(j,paidDeps),pilot_snapshot:(j:any)=>recordPilot(j.site_id,{db})
    }}));
    if (["workspace_load","assistant","topics_refresh","topic_draft","blog_destinations","blog_publish"].includes(body.action)) {
      return json(await workspaceAction(body,{db,ai,gsc,shopify,secretFor,writeDraft,sales,activeEngines:enabledEngines()}));
    }
    switch (body.action) {
      case "test": return json(await testConnector(body.connector_id));
      case "gsc_sync": return json({ ok: true, result: await gscSync(body.site_id) });
      case "apply": {
        const result = await applyFixes(body.site_id);
        const verification = await verifyBatch(db, shopify, secretFor, body.site_id);
        return json({ ok: true, result, verification });
      }
      case "verify": return json({ ok: true, verification: await verifyBatch(db, shopify, secretFor, body.site_id, body.ids) });
      case "provider_probe": {
        const eng = ENGINES[body.engine];
        if (providerPaused(body.engine, Deno.env.get("AEO_GEMINI_ENABLED"))) throw new Error("This provider is paused");
        if (!eng || !Deno.env.get(eng.key)) throw new Error("Engine is not configured");
        try {
          const answer = await eng.ask("What is the official website of Google Search Console? Cite its official source.", AbortSignal.timeout(60000));
          return json({ ok: true, engine: body.engine, model: answer.model, answered: !!answer.text.trim(), citations: answer.citations.length });
        } catch (e) { return json({ ok: false, engine: body.engine, error: (e as Error).message }); }
      }
      case "aeo_retry_failed": {
        if (providerPaused(body.engine, Deno.env.get("AEO_GEMINI_ENABLED"))) throw new Error("This provider is paused");
        if (!ENGINES[body.engine]) throw new Error("Choose an engine to retry");
        let q = db.from("aeo_checks").select("id,run_id").eq("engine", body.engine).eq("status", "failed").limit(200);
        if (body.site_id) q = q.eq("site_id", body.site_id);
        const { data: rows, error } = await q;
        if (error) throw new Error(error.message);
        if (rows?.length) {
          const { error: updated } = await db.from("aeo_checks").update({ status: "pending", attempts: 0, error: null }).in("id", rows.map((r: any) => r.id)).eq("status", "failed");
          if (updated) throw new Error(updated.message);
          await db.from("aeo_runs").update({ status: "running", finished_at: null }).in("id", [...new Set(rows.map((r: any) => r.run_id))]);
        }
        return json({ ok: true, queued: rows?.length || 0 });
      }
      case "aeo_draft": {
        const {data: task,error}=await db.from('tasks').select('*').eq('site_id',body.site_id).eq('id',body.task_id).eq('kind','AI visibility').single();
        if(error||!task)throw new Error('Visibility task not found');
        throw new Error('An AI omission alone does not justify a new article. Open Content to review topics grounded in the current website inventory and business facts.');
      }
      case "aeo_report": return json(await visibilityReport(db, body.site_id, enabledEngines()));
      case "aeo_plan": return json(await generateVisibilityPlan(db, body.site_id, enabledEngines()));
      case "aeo_info": {
        const engines: Record<string, any> = {};
        for (const [k, e] of Object.entries(ENGINES)) {
          const { data } = await db.from("aeo_checks").select("status,error,checked_at,model").eq("engine", k).in("status", ["done", "failed"]).order("checked_at", { ascending: false }).limit(1);
          engines[k] = { label: e.label, configured: !providerPaused(k, Deno.env.get("AEO_GEMINI_ENABLED")) && !!Deno.env.get(e.key), paused: providerPaused(k, Deno.env.get("AEO_GEMINI_ENABLED")), secret: e.key, lastStatus: data?.[0]?.status || null, lastError: data?.[0]?.error || null, checkedAt: data?.[0]?.checked_at || null, model: k === "gemini" ? modelForGemini(Deno.env.get("AEO_GEMINI_MODEL")) : data?.[0]?.model || null };
        }
        return json({ writer: writerName(), engines });
      }
      case "draft": return json({ ok: true, ...(await writeDraft(body.site_id, body.workspace, body.kind, body.title, body.brief)) });
      case "aeo_start": return json({ ok: true, result: await aeoStart(body.site_id) });
      case "aeo_work": return json({ ok: true, result: await aeoWork() });
      case "sales": return json({ ok: true, sales: await sales(body.site_id) });
      case "checkup": {
        // Runs in the background; the app polls sites.checkup for progress.
        const job = checkup(body.site_id, true, body.followups !== false).catch(e => console.error("Audit failed:", e.message));
        // @ts-ignore EdgeRuntime exists on Supabase
        if (typeof EdgeRuntime !== "undefined") { EdgeRuntime.waitUntil(job); return json({ ok: true, started: true }); }
        return json({ ok: true, result: await job });
      }
      case "ai_test": {
        aiError = "";
        if (body.site_id) {
          const { data: site } = await db.from("sites").select("*").eq("id", body.site_id).single();
          if (!site) throw new Error("Business not found");
          const items = body.pending ? (site.checkup?.checkpoint?.pending || []).filter((x: any) => x.type).slice(0, 6).map((x: any) => ({ key: x.id, type: x.type, name: x.name, current: x.before, context: x.ctx || "" })) : [{ key: "a", type: "title", name: "Home", current: "", context: site.name || "" }, { key: "b", type: "description", name: "Home", current: "", context: site.name || "" }];
          const w = await writeSeo(site, items); return json({ written: w, raw: lastRaw, error: aiError });
        }
        const t = await ai("Reply with the word ok.", "ok?", 20); return json({ text: t, error: aiError });
      }
      case "checkup_due":
      case "checkup_work": {
        const job = (body.action === "checkup_work" ? checkupWork() : checkupDue()).catch(e => console.error("Audit worker:", e.message));
        // @ts-ignore Supabase background runtime
        if (typeof EdgeRuntime !== "undefined") { EdgeRuntime.waitUntil(job); return json({ ok: true, started: true }); }
        return json({ ok: true, result: await job });
      }
      case "publish": {
        const ids: string[] = (body.ids || []).slice(0, 500);
        if(ids.length) {
          const {data:requested,error:readError}=await db.from('fixes').select('*').eq('site_id',body.site_id).in('id',ids);
          if(readError)throw new Error(readError.message);
          for(const f of requested||[]){if(f.data?.experiment_id)throw new Error('Approve this pilot through SEO Experiments.');await assertSearchPublishable({...f,status:'pending'});}
        }
        if (ids.length) await db.from("fixes").update({ status: "approved", decided_at: new Date().toISOString() }).eq("site_id", body.site_id).in("id", ids).in("status", ["pending", "failed", "rejected"]);
        const { data: w } = await db.from("connectors").select("type").eq("site_id", body.site_id).eq("status", "connected").in("type", ["shopify", "webflow"]);
        if (!w?.length) return json({ ok: true, published: false, reason: "not_connected" });
        const r = await applyFixes(body.site_id, 8);
        const { count } = await db.from("fixes").select("id", { count: "exact", head: true }).eq("site_id", body.site_id).in("status", ["approved", "rollback_requested"]);
        const verificationJob = verifyBatch(db, shopify, secretFor, body.site_id).catch(e => console.error("Verification:", e.message));
        // @ts-ignore Supabase background runtime
        if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(verificationJob);
        else await verificationJob;
        return json({ ok: true, published: true, queued: count || 0, result: r[body.site_id] || { deployed: 0, rolledBack: 0, failed: 0 } });
      }
      case "gsc_info": {
        const sa = serviceAccount();
        return json({ configured: !!sa, email: sa?.client_email ?? null });
      }
      case "gsc_list": {
        let lc: any = undefined;
        if (body.connector_id) lc = (await db.from("connectors").select("*").eq("id", body.connector_id).single()).data;
        const list = await gsc("/sites", undefined, lc);
        return json({ sites: (list.siteEntry || []).map((s: any) => ({ property: s.siteUrl, permission: s.permissionLevel })) });
      }
      default: return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});


