// Self-serve sign-up for business owners (public sign-up page → app).
//
// Public (no account yet):
//   analyze {domain}           read the website now; research the business and its competitors in the background
//   status  {token}            poll the analysis
// Signed in (confirmed email):
//   claim   {token, edits}     create the business, make the caller its owner, start the first site check
//   sync_google {site_id}      import Search Console data right after connecting Google (owner)
//   search_summary {site_id}   latest search queries and daily clicks for the onboarding (any workspace role)
//   profile {site_id, patch}   save onboarding answers: attribution, seo_level, onboarded_at (owner)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { bare, publicUrl, readSite } from "./read.ts";
import { research } from "./research.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const URL_ = Deno.env.get("SUPABASE_URL")!, SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const AI_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const LIMITS = { perIpHour: 4, perIpDay: 12, globalDay: 300, ownedSites: 3, reuseDays: 7 };
const PLATFORMS = ["shopify", "wordpress", "woocommerce", "webflow", "framer", "wix", "squarespace", "bigcommerce", "godaddy", "netlify", "other"];
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (v: unknown, status = 200) => Response.json(v, { status, headers: cors });
class Problem extends Error { constructor(msg: string, public status = 400) { super(msg); } }

const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const token = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
const since = (ms: number) => new Date(Date.now() - ms).toISOString();
const text = (v: unknown, n = 2000) => (typeof v === "string" ? v.trim().slice(0, n) : "");

function nextMonday() { const d = new Date(); d.setUTCHours(13, 0, 0, 0); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); return d.toISOString(); }
async function engine(action: string, body: Record<string, unknown>) {
  const { data: key, error } = await db.rpc("get_engine_key");
  if (error || !key) throw new Error("Engine key unavailable.");
  const r = await fetch(`${URL_}/functions/v1/engine`, { method: "POST", headers: { "Content-Type": "application/json", "x-engine-key": key }, body: JSON.stringify({ action, ...body }), signal: AbortSignal.timeout(120_000) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || `Engine ${r.status}`);
  return out;
}
async function caller(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Problem("Sign in first.", 401);
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user?.email) throw new Problem("Sign in first.", 401);
  if (!data.user.email_confirmed_at) throw new Problem("Confirm your email address first.", 403);
  const asUser = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  return { user: data.user, asUser };
}
async function roleFor(asUser: any, siteId: string) {
  const { data, error } = await asUser.rpc("my_workspace_role", { p_site: String(siteId || "") });
  if (error) throw new Problem("Workspace access denied.", 403);
  return data as string | null;
}

// ---------- analyze ----------
async function analyze(req: Request, body: any) {
  let host: string;
  try { host = bare(publicUrl("https://" + String(body.domain || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "")).hostname); }
  catch { throw new Problem("Enter your website address, like example.com."); }
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const ipHash = await sha(ip + "|" + SERVICE.slice(-16));

  const { data: existing } = await db.from("sites").select("id").or(`domain.eq.${host},domain.eq.www.${host}`).limit(1);
  if (existing?.length) return { exists: true, message: "This website already has an Impackt Media workspace. Sign in, or ask its owner to invite you." };

  const [hour, day, all] = await Promise.all([
    db.from("signup_analyses").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since(3600_000)),
    db.from("signup_analyses").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since(86400_000)),
    db.from("signup_analyses").select("id", { count: "exact", head: true }).gte("created_at", since(86400_000)),
  ]);
  if ((hour.count || 0) >= LIMITS.perIpHour || (day.count || 0) >= LIMITS.perIpDay) throw new Problem("Too many analyses from this connection. Try again later.", 429);
  if ((all.count || 0) >= LIMITS.globalDay) throw new Problem("Sign-ups are busy right now. Try again in a little while.", 503);

  // Recent complete analysis of the same website: reuse it (no new AI research). One without competitors is redone.
  const { data: recentRows } = await db.from("signup_analyses").select("site,research").eq("domain", host).eq("status", "ready").gte("created_at", since(LIMITS.reuseDays * 86400_000)).order("created_at", { ascending: false }).limit(5);
  const recent = (recentRows || []).find((r: any) => r.research?.competitors?.length);
  const t = token();
  if (recent) {
    await db.from("signup_analyses").insert({ token: t, domain: host, ip_hash: ipHash, status: "ready", site: recent.site, research: recent.research });
    return { token: t, status: "ready", site: recent.site, research: recent.research };
  }
  const { error } = await db.from("signup_analyses").insert({ token: t, domain: host, ip_hash: ipHash, status: "reading" });
  if (error) throw new Error(error.message);
  const site = await readSite(host);
  await db.from("signup_analyses").update({ site, status: AI_KEY ? "researching" : "failed", error: AI_KEY ? null : "Research is unavailable.", updated_at: new Date().toISOString() }).eq("token", t);
  if (AI_KEY) {
    EdgeRuntime.waitUntil((async () => {
      try {
        const r = await research(site, AI_KEY);
        await db.from("signup_analyses").update({ research: r, status: "ready", updated_at: new Date().toISOString() }).eq("token", t);
      } catch (e) {
        console.error("signup research failed", host, (e as Error).message);
        await db.from("signup_analyses").update({ status: "failed", error: "We couldn't finish the research automatically.", updated_at: new Date().toISOString() }).eq("token", t);
      }
    })());
  }
  return { token: t, status: AI_KEY ? "researching" : "failed", site };
}

async function status(body: any) {
  if (!/^[a-f0-9]{48}$/.test(String(body.token || ""))) throw new Problem("Unknown analysis.", 404);
  const { data } = await db.from("signup_analyses").select("domain,status,site,research,error,claimed_site,created_at").eq("token", body.token).maybeSingle();
  if (!data || Date.parse(data.created_at) < Date.now() - 7 * 86400_000) throw new Problem("This analysis expired. Start again.", 404);
  return data;
}

// ---------- claim ----------
async function claim(req: Request, body: any) {
  const { user } = await caller(req);
  const row = await status(body);
  const { data: full } = await db.from("signup_analyses").select("claimed_by,claimed_site,status").eq("token", body.token).single();
  if (full?.claimed_site) {
    if (full.claimed_by === user.id) return { site_id: full.claimed_site, already: true };
    throw new Problem("This analysis was already used to create a workspace.", 409);
  }
  if (row.status === "reading") throw new Problem("The website is still being read. Try again in a moment.", 409);
  const email = user.email!.toLowerCase();
  const { count } = await db.from("workspace_access").select("id", { count: "exact", head: true }).eq("email", email).eq("role", "owner").is("revoked_at", null);
  if ((count || 0) >= LIMITS.ownedSites) throw new Problem("You already own the maximum number of workspaces. Contact Impackt Media to add more.", 403);
  const { data: taken } = await db.from("sites").select("id").or(`domain.eq.${row.domain},domain.eq.www.${row.domain}`).limit(1);
  if (taken?.length) throw new Problem("This website already has a workspace.", 409);

  const e = body.edits || {}, r = (row.research || {}) as any, s = (row.site || {}) as any;
  const name = text(e.name, 200) || r.name || s.name || row.domain;
  const platform = PLATFORMS.includes(e.platform) ? e.platform : PLATFORMS.includes(s.platform) ? s.platform : "other";
  const competitors = (Array.isArray(e.competitors) ? e.competitors : (r.competitors || []).map((c: any) => c.domain))
    .map((d: unknown) => { try { return bare(publicUrl("https://" + String(d).replace(/^https?:\/\//, "").replace(/\/.*$/, "")).hostname); } catch { return ""; } })
    .filter((d: string, i: number, a: string[]) => d && d !== row.domain && a.indexOf(d) === i).slice(0, 5);
  const pick = (k: string, fallback = "") => text(e[k]) || fallback;
  const profile = {
    industry: pick("industry", r.industry), customers: pick("customers", r.customers),
    market: { description: pick("description", r.description || s.description), model: pick("model", r.model), locations: pick("locations", r.locations || (s.places || []).join("\n")), service: pick("service", r.service_area || (s.areas || []).join(", ")), shipping: "", enrollment: "" },
    market_revision: crypto.randomUUID(), competitors, competitor_research: r.competitors || [], keyword: r.keyword || "",
    onboarding: "self_serve", owner_id: user.id,
  };
  let id = row.domain.split(".")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "site";
  const { data: clash } = await db.from("sites").select("id").like("id", id + "%");
  if (clash?.some((x: any) => x.id === id)) id = `${id}-${token().slice(0, 4)}`;
  const { data: last } = await db.from("sites").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { error: siteError } = await db.from("sites").insert({ id, name, domain: row.domain, platform, mode: "review", brand: { name }, profile, sort_order: (last?.[0]?.sort_order || 0) + 1, next_run_at: nextMonday() });
  if (siteError) throw new Error("Could not create the workspace: " + siteError.message);
  const { error: accessError } = await db.from("workspace_access").insert({ site_id: id, email, role: "owner", created_by: user.id });
  if (accessError) { await db.from("sites").delete().eq("id", id); throw new Error("Could not create the workspace: " + accessError.message); }
  await db.from("signup_analyses").update({ claimed_by: user.id, claimed_site: id, updated_at: new Date().toISOString() }).eq("token", body.token);
  EdgeRuntime.waitUntil(engine("checkup", { site_id: id }).catch((err) => console.error("signup checkup", id, err.message)));
  return { site_id: id };
}

// ---------- after sign-up ----------
async function syncGoogle(req: Request, body: any) {
  const { asUser } = await caller(req);
  if ((await roleFor(asUser, body.site_id)) !== "owner") throw new Problem("Owner access required.", 403);
  const out = await engine("gsc_sync", { site_id: body.site_id });
  const x = out.result?.[body.site_id];
  if (!x) throw new Problem("Google isn't connected to this business yet.", 409);
  if (x.error) throw new Problem(x.error, 409);
  return x;
}
async function searchSummary(req: Request, body: any) {
  const { asUser } = await caller(req);
  if (!(await roleFor(asUser, body.site_id))) throw new Problem("Workspace access denied.", 403);
  const [q, d] = await Promise.all([
    db.from("gsc_queries").select("period_end,query,clicks,impressions,ctr,position").eq("site_id", body.site_id).order("period_end", { ascending: false }).order("impressions", { ascending: false }).limit(250),
    db.from("gsc_daily").select("date,clicks,impressions,ctr,position").eq("site_id", body.site_id).gte("date", since(92 * 86400_000).slice(0, 10)).order("date"),
  ]);
  if (q.error || d.error) throw new Error((q.error || d.error)!.message);
  const latest = q.data?.[0]?.period_end;
  return { queries: (q.data || []).filter((r: any) => r.period_end === latest), daily: d.data || [] };
}
async function saveProfile(req: Request, body: any) {
  const { asUser } = await caller(req);
  if ((await roleFor(asUser, body.site_id)) !== "owner") throw new Problem("Owner access required.", 403);
  const p = body.patch || {}, patch: Record<string, unknown> = {};
  if (p.attribution) patch.attribution = { source: text(p.attribution.source, 60), detail: text(p.attribution.detail, 200), at: new Date().toISOString() };
  if (["new", "basics", "expert"].includes(p.seo_level)) patch.seo_level = p.seo_level;
  if (p.onboarded) patch.onboarded_at = new Date().toISOString();
  const { data, error } = await db.from("sites").select("profile").eq("id", body.site_id).single();
  if (error) throw new Error(error.message);
  const profile = { ...(data?.profile || {}), ...patch };
  const saved = await db.from("sites").update({ profile }).eq("id", body.site_id);
  if (saved.error) throw new Error(saved.error.message);
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Not found" }, 404);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  try {
    const handlers: Record<string, () => Promise<unknown>> = {
      analyze: () => analyze(req, body), status: () => status(body), claim: () => claim(req, body),
      sync_google: () => syncGoogle(req, body), search_summary: () => searchSummary(req, body), profile: () => saveProfile(req, body),
    };
    const run = handlers[body.action];
    if (!run) return json({ error: "Unknown action" }, 400);
    return json(await run());
  } catch (e) {
    const status = e instanceof Problem ? e.status : 500;
    if (status === 500) console.error("signup", body.action, (e as Error).message);
    return json({ error: status === 500 ? "Something went wrong. Please try again." : (e as Error).message }, status);
  }
});
