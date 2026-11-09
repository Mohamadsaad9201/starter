import {seoEvidence} from "./seo-evidence.ts";
import {agentEvidence} from "./agent-evidence.ts";
import {seoAgents} from "./agents.ts";
const seoBooks = [{"slug":"seo-internal-links","title":"Connect related pages","gets":"A paragraph with relevant internal links, written for a specific page in your inventory.","ask":"Which page or product should we focus on?","skills":["advertools / crawl inventory"],"guidance":"Use the selected source and related destination URLs. Draft a short addition with natural, descriptive Markdown links. Check intent and existing copy. Never assert a link is missing from an excerpt. Do not propose backlinks on external websites.","ws":"seo","kind":"Content brief","goal":"Improve existing search pages"},{"slug":"seo-search-opportunity","title":"Improve a page already appearing in search","gets":"A revised introduction for an existing page with recorded Search Console impressions.","ask":"Which product or theme matters most?","skills":["Google API Python Client / Search Analytics"],"guidance":"Use the matched page and its exact reporting period. Draft an introduction that serves the existing page intent. Site-level queries are context only. Do not attribute a query to this URL, predict uplift or request a title change on length alone.","ws":"seo","kind":"Content brief","goal":"Improve existing search pages"},{"slug":"seo-content-overlap","title":"Give similar pages distinct purposes","gets":"A proposed revision for one of two pages that cover similar ground.","ask":"Which topic or page should we compare?","skills":["Sentence Transformers / semantic retrieval"],"guidance":"Inspect the two excerpts and their customer tasks. Similarity is a retrieval signal. Different locations, product variants and buying versus learning intent can justify separate pages. Draft differentiated copy only for a defensible distinction. Keep both URLs intact.","ws":"seo","kind":"Content brief","goal":"Improve existing search pages"}];
// Playbooks: proven marketing frameworks (adapted from marketingskills by Corey Haines, MIT) filled in with the
// business's own verified data, written by the engine's writer (business rules, excluded phrases, scope) and
// delivered as a draft in the review queue. Nothing publishes without approval.
// seo-agent-* playbooks are the 12 SEO specialists (strategy, keywords, performance, competitors, writer, on-page,
// internal links, backlinks, indexing, schema, brand search, local); they receive the site's page inventory, audit
// findings, AI-answer evidence and Search Console data instead of asking the user to paste them.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL_ = Deno.env.get("SUPABASE_URL")!, SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const APP = (Deno.env.get("PULSE_APP_URL") || "https://ots-seo-engine.netlify.app").replace(/\/$/, "");
const DAY = 86400000;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

let LIB: any = null, LIB_AT = 0;
// The library lives in public.playbook_library (loaded from the repository's playbooks.json), so playbooks don't
// depend on a website deploy. A newer copy published on the site (higher version) takes over.
async function library(origin?: string) {
  if (LIB && Date.now() - LIB_AT < 10 * 60000) return LIB;
  const { data: row } = await db.from("playbook_library").select("library").eq("id", 1).maybeSingle();
  if (row?.library?.playbooks?.length) { LIB = row.library; LIB_AT = Date.now(); }
  for (const base of [APP]) {
    try { const r = await fetch(`${base}/playbooks.json`, { signal: AbortSignal.timeout(8000) }); if (r.ok) { const remote = await r.json(); if (remote?.playbooks?.length && (!LIB || newer(remote.version, LIB.version))) { LIB = remote; LIB_AT = Date.now(); } if (LIB) return LIB; } } catch { /* stored copy */ }
  }
  if (LIB) return LIB;
  throw new Error("The playbook library isn't available. Refresh public.playbook_library, then try again.");
}
const newer = (a: unknown, b: unknown) => { const x = String(a || "0").split(".").map(Number), y = String(b || "0").split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
async function engineKey() { const { data } = await db.rpc("get_engine_key"); return String(data || ""); }
async function engine(body: Record<string, unknown>) {
  const r = await fetch(`${URL_}/functions/v1/engine`, { method: "POST", headers: { "Content-Type": "application/json", "x-engine-key": await engineKey() }, body: JSON.stringify(body), signal: AbortSignal.timeout(170000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Engine returned ${r.status}`);
  return j;
}
async function member(req: Request, siteId: string) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const user = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: role } = await user.rpc("my_workspace_role", { p_site: siteId });
  if (!["agency", "owner", "reviewer", "editor"].includes(String(role))) return null;
  const { data } = await user.auth.getUser(auth.slice(7));
  return data.user?.id ?? null;
}

// The business's own numbers, phrased as facts the writer may use. Nothing here is estimated.
async function context(site: any) {
  const lines: string[] = [];
  const p = site.profile || {};
  if (p.goal) lines.push(`Business goal: ${clean(p.goal)}`);
  if (p.customers) lines.push(`Customers: ${clean(p.customers)}`);
  if (p.industry) lines.push(`Industry: ${clean(p.industry)}`);
  const since = new Date(Date.now() - 28 * DAY).toISOString().slice(0, 10);
  const { data: rows } = await db.from("shop_daily").select("orders,sales,returning_orders,sub_orders,channels,products,states").eq("site_id", site.id).gte("day", since);
  const topProducts: any[] = [];
  if (rows?.length) {
    const t = { o: 0, s: 0, r: 0, sub: 0 }, prods: any = {}, ch: any = {}, st = new Set<string>();
    for (const r of rows) { t.o += r.orders; t.s += Number(r.sales); t.r += r.returning_orders; t.sub += r.sub_orders; for (const [k, v] of Object.entries<any>(r.products || {})) { const x = prods[k] || (prods[k] = { t: v.t, u: 0, s: 0, ru: 0, h: k }); x.u += v.u; x.s += v.s; x.ru += v.ru; } for (const [k, v] of Object.entries<any>(r.channels || {})) ch[k] = (ch[k] || 0) + v.o; for (const k of Object.keys(r.states || {})) if (k.length === 2) st.add(k); }
    const top = Object.values<any>(prods).sort((a, b) => b.s - a.s).slice(0, 8); topProducts.push(...top);
    const again = Object.values<any>(prods).filter((x) => x.u >= 10).sort((a, b) => b.ru / b.u - a.ru / a.u).slice(0, 5);
    lines.push(`Last 28 days (Shopify): ${t.o} orders, ${usd(t.s)} in sales, average order ${usd(t.s / Math.max(1, t.o))}, ${Math.round(t.r / Math.max(1, t.o) * 100)}% of orders from returning customers, ${t.sub} subscription orders, shipped to ${st.size} states.`);
    lines.push(`Best sellers by sales: ${top.map((x) => `${x.t} (${usd(x.s)})`).join("; ")}`);
    if (again.length) lines.push(`Most re-bought by returning customers: ${again.map((x) => `${x.t} (${Math.round(x.ru / x.u * 100)}% of units)`).join("; ")}`);
    lines.push(`Where orders started: ${Object.entries<number>(ch).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  }
  const { data: run } = await db.from("aeo_runs").select("id").eq("site_id", site.id).eq("status", "done").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (run) {
    const { data: checks } = await db.from("aeo_checks").select("prompt,mentioned,competitors").eq("run_id", run.id).eq("status", "done").limit(300);
    const miss = [...new Set((checks || []).filter((c: any) => !c.mentioned).map((c: any) => clean(c.prompt)))].slice(0, 6);
    const rivals = [...new Set((checks || []).flatMap((c: any) => c.competitors || []))].slice(0, 6);
    if (miss.length) lines.push(`Buyer questions where AI assistants did not name the business: ${miss.map((m) => `"${m}"`).join("; ")}`);
    if (rivals.length) lines.push(`Businesses AI assistants named instead: ${rivals.join(", ")}`);
  }
  const m = new Date().getMonth(), d = new Date().getDate();
  const season = m === 10 ? (d < 28 ? "Thanksgiving and Black Friday are coming up" : "the holiday season is starting") : m === 11 ? "the holidays and New Year are here" : m === 1 ? "Valentine's Day and Ramadan timing may matter" : m === 2 || m === 3 ? "spring, Ramadan and Eid timing may matter" : m >= 4 && m <= 7 ? "summer grilling season" : "back-to-school and fall";
  lines.push(`Today is ${new Date().toISOString().slice(0, 10)}; ${season}.`);
  return { text: lines.join("\n"), topProducts };
}

async function topProductPage(siteId: string, handles: string[]) {
  for (const h of handles) { const { data } = await db.from("pages").select("url,data").eq("site_id", siteId).ilike("url", `%/products/${h}`).limit(1).maybeSingle(); if (data) return data; }
  return null;
}

async function runPlaybook(runId: string, site: any, pb: any, note: string) {
  try {
    const specialized = seoBooks.some(p=>p.slug===pb.slug), agent = String(pb.slug).startsWith("seo-agent-");
    const ctx = specialized ? {text:JSON.stringify(await seoEvidence(db,site,pb.slug,note)),topProducts:[]} : agent ? await (async()=>{const c=await context(site);return {text:c.text+"\n\n"+await agentEvidence(db,site,pb.slug,note),topProducts:c.topProducts};})() : await context(site);
    let target = "";
    if (["product-page-cro", "copy-polish"].includes(pb.slug) && !note) {
      const pg = await topProductPage(site.id, ctx.topProducts.map((x) => x.h));
      if (pg) target = `\nTarget page: ${pg.data?.name || pg.url} (${pg.url}). Current page text (do not repeat it): ${clean(pg.data?.bodyText).slice(0, 1200)}`;
    }
    const brief = `Playbook: ${pb.title}.\nDeliverable: ${pb.gets}${note ? `\nRequest from the business: ${clean(note).slice(0, 300)}` : ""}${target}
VERIFIED BUSINESS DATA (from the business's own accounts; use only these numbers, never invent others):
${ctx.text}
When mentioning delivery costs, phrase it as "delivery is free on orders over $X" if that is a verified fact; never use an excluded phrase.
PLAYBOOK GUIDANCE (apply the frameworks that fit this business; skip anything that does not apply):
${pb.guidance}`;
    const limit = agent ? 12000 : 9000; // skill guidance is condensed to ~4.5k; the rest is the business's own data
    const title = `${pb.title}${note ? ": " + clean(note).slice(0, 80) : ""}`;
    let r: any;
    try { r = await engine({ action: "draft", site_id: site.id, workspace: pb.ws, kind: pb.kind, title: title.slice(0, 140), brief: brief.slice(0, limit) }); }
    catch (e) {
      if (!/business rules|excluded/i.test((e as Error).message)) throw e;
      r = await engine({ action: "draft", site_id: site.id, workspace: pb.ws, kind: pb.kind, title: title.slice(0, 140), brief: ("RETRY: the previous attempt broke a business rule or used an excluded phrase. Follow every rule exactly and rephrase around excluded phrases.\n" + brief).slice(0, limit) });
    }
    await db.from("playbook_runs").update({ status: "ready", draft_id: String(r.id), finished_at: new Date().toISOString() }).eq("id", runId);
  } catch (e) {
    await db.from("playbook_runs").update({ status: "failed", error: (e as Error).message.slice(0, 300), finished_at: new Date().toISOString() }).eq("id", runId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const body = await req.json().catch(() => ({}));
  try {
    // Engine key (agency automation / testing) or a workspace member.
    const { data: key } = await db.rpc("get_engine_key");
    const uid = key && req.headers.get("x-engine-key") === String(key) ? null : await member(req, body.site_id);
    if (!uid && !(key && req.headers.get("x-engine-key") === String(key))) return json({ error: "Not allowed" }, 401);
    if (body.action === "run") {
      const pb = seoBooks.find(p=>p.slug===body.slug) || seoAgents.find((p:any)=>p.slug===body.slug) || ((await library()).playbooks || []).find((p: any) => p.slug === body.slug);
      if (!pb) return json({ error: "Unknown playbook" }, 400);
      const { data: busy } = await db.from("playbook_runs").select("id").eq("site_id", body.site_id).eq("slug", pb.slug).eq("status", "writing").gte("created_at", new Date(Date.now() - 5 * 60000).toISOString()).limit(1);
      if (busy?.length) return json({ ok: true, id: busy[0].id, status: "writing" });
      const { data: site } = await db.from("sites").select("id,name,domain,profile,brand").eq("id", body.site_id).single();
      const { data: run, error } = await db.from("playbook_runs").insert({ site_id: body.site_id, slug: pb.slug, note: clean(body.note).slice(0, 300) || null, created_by: uid }).select("id").single();
      if (error) throw new Error(error.message);
      // @ts-ignore EdgeRuntime is provided by Supabase
      EdgeRuntime.waitUntil(runPlaybook(run.id, site, pb, clean(body.note)));
      return json({ ok: true, id: run.id, status: "writing" });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});
