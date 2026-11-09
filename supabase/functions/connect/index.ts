// Impactful one-click connections: Google Search Console, Shopify, Webflow, WordPress.
// POST {action:"info"|"start", ...} with the admin's session token, or a business owner's for their own business.
// GET  /connect/callback/<provider>  is where each platform sends the person back after they approve.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { paidCallback } from "./paid.ts";
import { completeGoogleConnection } from "./google.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const APP = (Deno.env.get("PULSE_APP_URL") || "https://ots-seo-engine.netlify.app").replace(/\/$/, "");
const ALLOWED_ORIGINS = [APP, "http://localhost:8080", "http://127.0.0.1:8080"];
const WP_APP_ID = "6f0c2f7e-5d8a-4b7e-9a51-7c3e2a1d9b44"; // fixed id so WordPress groups Impactful passwords together

const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/analytics.readonly"];
const SHOPIFY_SCOPES = "read_products,write_products,read_content,write_content,read_files,write_files,read_online_store_navigation,write_online_store_navigation,read_orders";
const WEBFLOW_SCOPES = "sites:read pages:read pages:write cms:read";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Callbacks go through Impactful's own domain (Netlify proxies /connect/* to this function), so people see Impactful, not Supabase.
const redirectUri = (p: string) => `${APP}/connect/callback/${p}`;
// Impactful's own app credentials for each platform: saved once by the owner in Impactful (Vault), or as env secrets.
const PROVIDERS = ["google", "shopify", "webflow", "wordpress", "google_ads", "meta_ads"];
// Business owners (self-serve sign-up) may connect these for their own business. Paid-media accounts stay with the agency.
const OWNER_PROVIDERS = ["google", "shopify", "webflow", "wordpress"];
async function creds(p: string): Promise<{ id: string; secret: string } | null> {
  const envId = Deno.env.get(`${p.toUpperCase()}_CLIENT_ID`), envSec = Deno.env.get(`${p.toUpperCase()}_CLIENT_SECRET`);
  if (envId && envSec) return { id: envId, secret: envSec };
  const { data } = await db.rpc("get_platform_app", { p_provider: p });
  const row = Array.isArray(data) ? data[0] : data;
  return row?.client_id && row?.client_secret ? { id: row.client_id, secret: row.client_secret } : null;
}
async function need(p: string) {
  const c = await creds(p);
  if (!c) throw new Error("This connection isn't available yet.");
  return c;
}
const ready = async (p: string) => p === "wordpress" || !!(await creds(p==='google_ads'?'google':p==='meta_ads'?'meta':p));

// Who is calling: an agency admin (everything), or the owner of the business named in the request (own business only).
async function callerFor(req: Request, body: any): Promise<{ userId: string; admin: boolean } | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const user = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data } = await user.auth.getUser(auth.slice(7));
  const userId = data.user?.id;
  if (!userId) return null;
  const { data: ok } = await user.rpc("is_admin");
  if (ok === true) return { userId, admin: true };
  if (body.action === "info") return { userId, admin: false };
  if (body.action !== "start" || !OWNER_PROVIDERS.includes(body.provider) || typeof body.site_id !== "string") return null;
  const { data: role } = await user.rpc("my_workspace_role", { p_site: body.site_id });
  return role === "owner" ? { userId, admin: false } : null;
}

function safeReturn(r: string | undefined, siteId: string) {
  const fallback = `${APP}/app/#/w/${encodeURIComponent(siteId)}/connections`;
  if (!r) return fallback;
  try { const u = new URL(r); return ALLOWED_ORIGINS.includes(u.origin) ? r : fallback; } catch { return fallback; }
}
// Put the result in the query string (before the hash) so the app can show it, then clean the URL.
function back(returnTo: string, provider: string, ok: boolean, msg = "") {
  const u = new URL(returnTo);
  u.searchParams.set("connected", provider);
  u.searchParams.set("ok", ok ? "1" : "0");
  if (msg) u.searchParams.set("msg", msg.slice(0, 200));
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}
const normShop = (s: string) => {
  const v = String(s || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const shop = v.includes(".") ? v : `${v}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) ? shop : null;
};

async function upsertConnector(siteId: string, type: string, label: string, config: Record<string, unknown>, secret: string) {
  const { data: existing, error: foundError } = await db.from("connectors").select("id,config").eq("site_id", siteId).eq("type", type).limit(1);
  if (foundError) throw new Error(foundError.message);
  let id = existing?.[0]?.id as string | undefined;
  const merged = { ...(existing?.[0]?.config || {}), ...config };
  if (id) { const { error } = await db.from("connectors").update({ config: merged, label }).eq("id", id); if (error) throw new Error(error.message); }
  else {
    const { data, error } = await db.from("connectors").insert({ site_id: siteId, type, label, config: merged, status: "pending" }).select("id").single();
    if (error) throw new Error(error.message);
    id = data.id;
  }
  const { error } = await db.rpc("service_set_connector_secret", { p_connector: id, p_secret: secret });
  if (error) throw new Error(error.message);
  return id!;
}
async function markConnected(id: string, detail: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const { data, error: foundError } = await db.from("connectors").select("config").eq("id", id).single();
  if (foundError) throw new Error(foundError.message);
  const { error } = await db.from("connectors").update({ status: "connected", last_error: null, last_checked_at: new Date().toISOString(), config: { ...(data?.config || {}), ...extra, detail } }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- start ----------
async function start(body: any, userId: string) {
  const { provider, site_id: siteId } = body;
  const { data: site } = await db.from("sites").select("id,domain").eq("id", siteId).single();
  if (!site) throw new Error("Workspace not found");
  if (!PROVIDERS.includes(provider)) throw new Error("Unknown connection");
  if (!(await ready(provider))) throw new Error("This connection isn't available yet.");
  const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const returnTo = safeReturn(body.return_to, siteId);
  let shop: string | null = null;
  let url: string;
  if (provider === 'google_ads') {
    url='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:(await need('google')).id,redirect_uri:redirectUri(provider),response_type:'code',scope:'https://www.googleapis.com/auth/adwords',access_type:'offline',prompt:'consent',include_granted_scopes:'true',state});
  } else if(provider==='meta_ads') {
    url='https://www.facebook.com/v26.0/dialog/oauth?'+new URLSearchParams({client_id:(await need('meta')).id,redirect_uri:redirectUri(provider),response_type:'code',scope:'ads_read,ads_management',return_scopes:'true',state});
  } else if (provider === "google") {
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: (await need("google")).id, redirect_uri: redirectUri("google"), response_type: "code",
      scope: GOOGLE_SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
    });
  } else if (provider === "shopify") {
    shop = normShop(body.shop);
    if (!shop) throw new Error("Enter the store's .myshopify.com address, for example your-store.myshopify.com");
    url = `https://${shop}/admin/oauth/authorize?` + new URLSearchParams({
      client_id: (await need("shopify")).id, scope: SHOPIFY_SCOPES, redirect_uri: redirectUri("shopify"), state,
    });
  } else if (provider === "webflow") {
    url = "https://webflow.com/oauth/authorize?" + new URLSearchParams({
      response_type: "code", client_id: (await need("webflow")).id, redirect_uri: redirectUri("webflow"), scope: WEBFLOW_SCOPES, state,
    });
  } else {
    let base: URL;
    try { base = new URL(/^https?:\/\//.test(body.url || "") ? body.url : `https://${body.url || site.domain}`); } catch { throw new Error("Enter the WordPress site address"); }
    if (base.protocol !== "https:") throw new Error("WordPress connections need an https:// site address.");
    shop = base.origin;
    const reject = new URL(returnTo); reject.searchParams.set("connected", "wordpress"); reject.searchParams.set("ok", "0"); reject.searchParams.set("msg", "Connection was declined in WordPress.");
    url = `${base.origin}/wp-admin/authorize-application.php?` + new URLSearchParams({
      app_name: "Impackt Media", app_id: WP_APP_ID, success_url: `${redirectUri("wordpress")}?state=${state}`, reject_url: reject.toString(),
    });
  }
  await db.from("oauth_states").delete().lt("created_at", new Date(Date.now() - 3600_000).toISOString());
  const { error } = await db.from("oauth_states").insert({ state, provider, site_id: siteId, user_id: userId, shop, return_to: returnTo });
  if (error) throw new Error(error.message);
  return { url };
}

async function takeState(state: string | null, provider: string) {
  if (!state) return null;
  const { data, error } = await db.from("oauth_states").delete().eq("state", state).eq("provider", provider)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString()).select("*").maybeSingle();
  if (error) throw new Error("The connection state could not be checked. Please start again.");
  return data;
}

// ---------- callbacks ----------
async function googleCallback(p: URLSearchParams, st: any) {
  return completeGoogleConnection(p, st, { db, credentials: () => need("google"), redirectUri: redirectUri("google"), upsertConnector, markConnected });
}

async function webflowCallback(p: URLSearchParams, st: any) {
  if (p.get("error")) throw new Error(p.get("error") === "access_denied" ? "Webflow access was declined." : `Webflow said: ${p.get("error_description") || p.get("error")}`);
  const wc = await need("webflow");
  const res = await fetch("https://api.webflow.com/oauth/access_token", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: wc.id, client_secret: wc.secret, code: p.get("code"), grant_type: "authorization_code", redirect_uri: redirectUri("webflow") }),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.access_token) throw new Error(tok.error_description || tok.message || `Webflow returned ${res.status}`);
  const sites = await fetch("https://api.webflow.com/v2/sites", { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json()).catch(() => ({}));
  const list: any[] = sites.sites || [];
  const { data: site } = await db.from("sites").select("domain").eq("id", st.site_id).single();
  const host = String(site?.domain || "").replace(/^www\./, "").toLowerCase();
  const match = list.find((w) => (w.customDomains || []).some((d: any) => String(d.url || "").replace(/^www\./, "").toLowerCase() === host)) || (list.length === 1 ? list[0] : null);
  const id = await upsertConnector(st.site_id, "webflow", "Webflow", { auth: "oauth", siteId: match?.id || null, siteName: match?.displayName || null, domain: host }, tok.access_token);
  if (match) { await markConnected(id, { siteName: match.displayName || match.shortName }); return ""; }
  await db.from("connectors").update({ status: "error", last_error: list.length ? `Authorized ${list.length} Webflow sites but none uses ${host}. Reconnect and pick only that site.` : "No Webflow site was authorized." }).eq("id", id);
  return "Connected, but Impackt Media couldn't tell which Webflow site is yours.";
}

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function shopifyCallback(p: URLSearchParams, st: any) {
  const sc = await need("shopify"); const secret = sc.secret;
  const hmac = p.get("hmac") || "";
  const msg = [...p.entries()].filter(([k]) => k !== "hmac" && k !== "signature").sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
  if ((await hmacHex(secret, msg)) !== hmac) throw new Error("Shopify's reply couldn't be verified. Try connecting again.");
  const shop = normShop(p.get("shop") || "");
  if (!shop || shop !== st.shop) throw new Error("That reply came from a different store.");
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: sc.id, client_secret: secret, code: p.get("code") }),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.access_token) throw new Error(tok.error_description || tok.error || `Shopify returned ${res.status}`);
  const id = await upsertConnector(st.site_id, "shopify", "Shopify", { shop, auth: "oauth", scopes: String(tok.scope || "").split(",") }, tok.access_token);
  const info = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": tok.access_token },
    body: JSON.stringify({ query: "{ shop { name primaryDomain { host } } }" }),
  }).then((r) => r.json()).catch(() => ({}));
  await markConnected(id, { shopName: info?.data?.shop?.name, domain: info?.data?.shop?.primaryDomain?.host });
  return "";
}

async function wordpressCallback(p: URLSearchParams, st: any) {
  const siteUrl = (p.get("site_url") || st.shop || "").replace(/\/$/, "");
  const user = p.get("user_login"), pass = p.get("password");
  if (!user || !pass) throw new Error("WordPress didn't send back a password. Try again.");
  if (new URL(siteUrl).origin !== new URL(st.shop).origin) throw new Error("That reply came from a different site.");
  const id = await upsertConnector(st.site_id, "wordpress", "WordPress", { url: siteUrl, username: user, auth: "app_password" }, pass);
  const res = await fetch(`${siteUrl}/wp-json/wp/v2/users/me?context=edit`, { headers: { Authorization: "Basic " + btoa(`${user}:${pass}`) } });
  if (!res.ok) {
    await db.from("connectors").update({ status: "error", last_error: `WordPress said ${res.status}. A security plugin may be blocking the REST API.`, last_checked_at: new Date().toISOString() }).eq("id", id);
    return "Connected, but WordPress blocked the first check.";
  }
  const me = await res.json();
  const root = await fetch(`${siteUrl}/wp-json/`).then((r) => r.json()).catch(() => ({}));
  const ns: string[] = root.namespaces || [];
  await markConnected(id, { user: me.name, seoPlugin: ns.includes("yoast/v1") ? "Yoast" : ns.includes("rankmath/v1") ? "Rank Math" : "none found" });
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const cb = url.pathname.match(/\/callback\/(google|shopify|wordpress|webflow|google_ads|meta_ads)\/?$/);
  if (req.method === "GET" && cb) {
    const provider = cb[1];
    let st: any;
    try { st = await takeState(url.searchParams.get("state"), provider); } catch (e) { return back(`${APP}/app/`, provider, false, (e as Error).message); }
    if (!st) return back(`${APP}/app/`, provider, false, "This connection link expired. Start again from Connections.");
    try {
      const msg = ['google_ads','meta_ads'].includes(provider) ? await paidCallback(provider,url.searchParams,st,{db,need,redirectUri,upsertConnector}) : provider === "google" ? await googleCallback(url.searchParams, st)
        : provider === "shopify" ? await shopifyCallback(url.searchParams, st)
        : provider === "webflow" ? await webflowCallback(url.searchParams, st)
        : await wordpressCallback(url.searchParams, st);
      await db.from("engine_events").insert({ site_id: st.site_id, data: { type: "connection.authorized", provider, message: msg || "Authorization saved." } });
      return back(st.return_to, provider, true, msg);
    } catch (e) {
      await db.from("engine_events").insert({ site_id: st.site_id, data: { type: "connection.failed", provider, message: (e as Error).message.slice(0, 500) } });
      return back(st.return_to, provider, false, (e as Error).message);
    }
  }
  if (req.method !== "POST") return json({ error: "Not found" }, 404);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const who = await callerFor(req, body);
  if (!who) return json({ error: "Not allowed" }, 401);
  try {
    if (body.action === "info") {
      const providers = Object.fromEntries(await Promise.all(PROVIDERS.map(async (k) => [k, await ready(k)])));
      if (!who.admin) return json({ providers: Object.fromEntries(OWNER_PROVIDERS.map((k) => [k, providers[k]])) });
      const { data: pending } = await db.from("oauth_states").select("site_id,provider,created_at").eq("provider", "google").order("created_at", { ascending: false }).limit(20);
      return json({
      pending: pending || [],
      providers,
      redirects: { google_ads:redirectUri("google_ads"),meta_ads:redirectUri("meta_ads"),google: redirectUri("google"), shopify: redirectUri("shopify"), webflow: redirectUri("webflow") },
      appUrl: `${APP}/app/`, wpAppId: WP_APP_ID,
    }); }
    if (body.action === "start") return json(await start(body, who.userId));
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});


