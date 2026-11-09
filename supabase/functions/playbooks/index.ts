import {seoEvidence} from "./seo-evidence.ts";
import {agentEvidence} from "./agent-evidence.ts";
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
${pb.guidance}
MEASUREMENT: end with a short MEASUREMENT section: the one metric this work should move, its baseline from the data above (or "no baseline yet" and how to get one), and when to check it (28 days after it goes live).`;
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

// ---------- Autopilot: prepare evidence-backed work every day, measure what gets approved ----------
// Each playbook runs on its own cadence when the business has the evidence it needs. Inputs a person would type
// (the page, question or location) are filled from that evidence. Nothing publishes: every result is a draft in the
// review queue. Situational playbooks (apps, paywalls, outbound, partnerships…) stay on demand.
type Plan = { every: number; needs?: string[]; note?: "question" | "page" | "location" };
const PLAN: Record<string, Plan> = {
  "seo-agent-strategy": { every: 30, needs: ["pages"] }, "seo-agent-keywords": { every: 21, needs: ["pages"] },
  "seo-agent-performance": { every: 7, needs: ["gsc"] }, "seo-agent-competitors": { every: 30, needs: ["aeo"] },
  "seo-agent-writer": { every: 7, needs: ["aeo"], note: "question" }, "seo-agent-onpage": { every: 7, needs: ["pages"], note: "page" },
  "seo-agent-internal-links": { every: 21, needs: ["pages"] }, "seo-agent-backlinks": { every: 30, needs: ["pages"] },
  "seo-agent-indexing": { every: 21, needs: ["pages"] }, "seo-agent-schema": { every: 14, needs: ["pages"], note: "page" },
  "seo-agent-brand": { every: 30 }, "seo-agent-local": { every: 30, needs: ["local"], note: "location" },
  "seo-internal-links": { every: 7, needs: ["pages"], note: "page" }, "seo-search-opportunity": { every: 7, needs: ["gsc", "pages"] },
  "seo-content-overlap": { every: 14, needs: ["pages"] },
  "product-page-cro": { every: 14, needs: ["shop"] }, "copy-polish": { every: 14, needs: ["shop"] }, "offer-free-delivery": { every: 30, needs: ["shop"] },
  "collection-copy": { every: 21, needs: ["shop", "pages"] }, "ai-answer-plan": { every: 14, needs: ["aeo"] },
  "answer-article": { every: 7, needs: ["aeo"], note: "question" }, "snippet-answers": { every: 14, needs: ["aeo"] },
  "local-page": { every: 30, needs: ["local"], note: "location" }, "seasonal-campaign": { every: 21 },
  "content-plan": { every: 30, needs: ["aeo"] }, "campaign-plan": { every: 30 }, "ad-copy-set": { every: 30, needs: ["ads"] },
  "landing-page": { every: 45 }, "homepage-refresh": { every: 60 }, "about-page": { every: 90 }, "comparison-page": { every: 45, needs: ["aeo"] },
  "seo-audit": { every: 14, needs: ["pages"] }, "schema": { every: 30, needs: ["pages"] }, "site-architecture": { every: 60, needs: ["pages"] },
  "link-building": { every: 30 }, "directory-submissions": { every: 60 }, "popups": { every: 45 }, "lead-magnets": { every: 45 },
  "pricing": { every: 60, needs: ["shop"] }, "emails": { every: 30 }, "sms": { every: 45, needs: ["shop"] }, "churn-prevention": { every: 45, needs: ["shop"] },
  "social": { every: 7 }, "referrals": { every: 60 }, "product-marketing": { every: 90 }, "competitor-profiling": { every: 30, needs: ["aeo"] },
  "marketing-loops": { every: 90 }, "analytics": { every: 90 }, "conversion-tracking": { every: 60, needs: ["ads"] }, "attribution": { every: 60, needs: ["ads"] },
};
// tickBudget: Supabase rate-limits how many function calls one request may fan out (~15), so each tick dispatches at
// most 12 runs, businesses with the fewest runs today first. 12 hourly ticks still allow ~140 runs a day.
const AUTO = { dailyDefault: 10, perTick: 3, pendingLimit: 30, tickBudget: 12 };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Detroit" });

async function evidence(site: any) {
  const since28 = new Date(Date.now() - 28 * DAY).toISOString(), p = site.profile || {};
  const [pages, gsc, shop, aeo, ads] = await Promise.all([
    db.from("pages").select("url,kind,data", { count: "exact" }).eq("site_id", site.id).gte("updated_at", since28).order("updated_at", { ascending: false }).limit(60),
    db.from("gsc_pages").select("period_end").eq("site_id", site.id).gte("period_end", new Date(Date.now() - 35 * DAY).toISOString().slice(0, 10)).limit(1),
    db.from("shop_daily").select("products").eq("site_id", site.id).gte("day", since28.slice(0, 10)),
    db.from("aeo_runs").select("id").eq("site_id", site.id).eq("status", "done").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("connectors").select("type").eq("site_id", site.id).in("type", ["google_ads", "meta_ads"]).eq("status", "connected").limit(1),
  ]);
  const sales: Record<string, { t: string; s: number }> = {};
  for (const r of shop.data || []) for (const [h, v] of Object.entries<any>(r.products || {})) (sales[h] ||= { t: v.t, s: 0 }).s += Number(v.s) || 0;
  const best = Object.entries(sales).sort((a, b) => b[1].s - a[1].s).map(([h, v]) => ({ h, t: v.t }));
  let misses: string[] = [];
  if (aeo.data) { const { data } = await db.from("aeo_checks").select("prompt,mentioned").eq("run_id", aeo.data.id).eq("status", "done").limit(400); misses = [...new Set((data || []).filter((c: any) => !c.mentioned).map((c: any) => clean(c.prompt)))]; }
  const locations = clean(p.market?.locations || p.market?.service || "").split(/\n|;/).map(clean).filter(Boolean);
  const pagesList = (pages.data || []).filter((r: any) => r.kind !== "article" && clean(r.data?.name || r.data?.title));
  return { has: { pages: (pages.count || 0) >= 5, gsc: !!gsc.data?.length, shop: best.length > 0, aeo: !!aeo.data, ads: !!ads.data?.length, local: locations.length > 0 }, best, misses, locations, pagesList };
}
function pickNote(kind: Plan["note"], ev: any, used: Set<string>) {
  const fresh = (xs: string[]) => xs.find((x) => x && !used.has(x.toLowerCase()));
  if (kind === "question") return fresh(ev.misses);
  if (kind === "location") return fresh(ev.locations);
  if (kind === "page") return fresh([...ev.best.map((b: any) => b.t), ...ev.pagesList.map((r: any) => clean(r.data?.name || r.data?.title))]);
  return "";
}
async function autopilot() {
  const report: any[] = [];
  const { data: sites } = await db.from("sites").select("id,name,domain,profile,brand").eq("active", true);
  const lib = await library().catch(() => ({ playbooks: [] }));
  const books = [...seoBooks, ...(lib.playbooks || [])];
  const key = await engineKey(), day = today();
  const onDay = (ts: string) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "America/Detroit" }) === day;
  const runsBySite = new Map<string, any[]>();
  for (const site of sites || []) {
    const { data: runs } = await db.from("playbook_runs").select("slug,status,note,auto,draft_id,created_at").eq("site_id", site.id).gte("created_at", new Date(Date.now() - 95 * DAY).toISOString()).order("created_at", { ascending: false }).limit(1000);
    runsBySite.set(site.id, runs || []);
  }
  const autoCount = (id: string) => (runsBySite.get(id) || []).filter((r: any) => r.auto && onDay(r.created_at) && r.status !== "failed").length;
  const ordered = [...(sites || [])].sort((a: any, b: any) => autoCount(a.id) - autoCount(b.id));
  let budget = AUTO.tickBudget, limited = false;
  for (const site of ordered) {
    if (budget <= 0 || limited) { report.push({ site: site.id, skipped: limited ? "rate limited; next tick" : "tick budget used; next tick" }); continue; }
    const cfg = site.profile?.autopilot || {};
    if (cfg.enabled === false) { report.push({ site: site.id, skipped: "autopilot off" }); continue; }
    const cap = Number(cfg.daily) > 0 ? Math.min(60, Number(cfg.daily)) : AUTO.dailyDefault;
    const runs = runsBySite.get(site.id) || [];
    const autoToday = autoCount(site.id);
    const draftIds = (runs || []).filter((r: any) => r.auto && r.draft_id).map((r: any) => r.draft_id);
    const { data: waiting } = draftIds.length ? await db.from("drafts").select("id").in("id", draftIds.slice(0, 500)).eq("status", "needs_review") : { data: [] };
    const pendingIds = new Set((waiting || []).map((d: any) => String(d.id)));
    if (autoToday >= cap) { report.push({ site: site.id, skipped: `daily cap ${cap} reached` }); continue; }
    if (pendingIds.size >= AUTO.pendingLimit) { report.push({ site: site.id, skipped: `${pendingIds.size} drafts waiting for review` }); continue; }
    const ev = await evidence(site);
    const candidates = Object.entries(PLAN).map(([slug, plan]) => {
      const pb = books.find((b: any) => b.slug === slug); if (!pb) return null;
      if ((plan.needs || []).some((n) => !(ev.has as any)[n])) return null;
      const mine = (runs || []).filter((r: any) => r.slug === slug);
      if (mine.some((r: any) => r.status === "writing" && Date.now() - Date.parse(r.created_at) < 20 * 60000)) return null;
      if (mine.some((r: any) => r.draft_id && pendingIds.has(String(r.draft_id)))) return null; // its last result is still waiting
      const last = mine.find((r: any) => r.status !== "failed"), lastFail = mine.find((r: any) => r.status === "failed");
      if (last && Date.now() - Date.parse(last.created_at) < plan.every * DAY) return null;
      if (lastFail && Date.now() - Date.parse(lastFail.created_at) < 3 * DAY && (!last || lastFail.created_at > last.created_at)) return null;
      const note = plan.note ? pickNote(plan.note, ev, new Set(mine.map((r: any) => clean(r.note).toLowerCase()))) : "";
      if (plan.note && !note) return null;
      const overdue = last ? (Date.now() - Date.parse(last.created_at)) / (plan.every * DAY) : 99; // never run first
      const evidenceWeight = (plan.needs || []).filter((n) => ["gsc", "shop", "aeo"].includes(n)).length;
      return { slug, note, score: overdue + evidenceWeight * 0.5 };
    }).filter(Boolean).sort((a: any, b: any) => b.score - a.score);
    const take = candidates.slice(0, Math.min(AUTO.perTick, cap - autoToday, budget));
    const started: string[] = [], errors: string[] = [];
    for (const c of take as any[]) {
      let why = "";
      budget--;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt) await new Promise((res) => setTimeout(res, 3000));
        const r = await fetch(`${URL_}/functions/v1/playbooks`, { method: "POST", headers: { "Content-Type": "application/json", "x-engine-key": key }, body: JSON.stringify({ action: "run", site_id: site.id, slug: c.slug, note: c.note, auto: true }), signal: AbortSignal.timeout(30000) })
          .then(async (x) => x.ok ? "" : `${x.status} ${(await x.text().catch(() => "")).slice(0, 160)}`)
          .catch((e) => String(e?.message || e).slice(0, 160));
        why = r; if (!why || /rate limit/i.test(why)) break;
      }
      if (/rate limit/i.test(why)) { limited = true; errors.push(`${c.slug}: ${why}`); break; }
      if (!why) started.push(c.slug + (c.note ? ` (${c.note.slice(0, 40)})` : ""));
      else errors.push(`${c.slug}: ${why}`);
      await new Promise((res) => setTimeout(res, 400));
    }
    if (errors.length) console.log("autopilot dispatch failed", site.id, JSON.stringify(errors));
    report.push({ site: site.id, started, eligible: candidates.length, today: autoToday + started.length, cap, waiting: pendingIds.size, ...(errors.length ? { errors } : {}) });
  }
  report.push({ measured: await measurePass() });
  return { ok: true, day, report };
}

// ---------- Measurement ----------
function metricFor(pb: any) {
  const s = String(pb.slug), g = String(pb.goal || "");
  if (/answer|snippet|ai-|content-plan|comparison|competitor/.test(s)) return "ai_named_share";
  if (/offer|product-page|copy-polish|collection|pricing|sms|churn|emails|referrals|seasonal|ad-copy|campaign/.test(s) || /Sell more|Convert/.test(g)) return "orders";
  return "search_clicks";
}
async function snapshot(siteId: string) {
  const since = new Date(Date.now() - 28 * DAY).toISOString().slice(0, 10), out: Record<string, unknown> = { window_days: 28, since };
  const [gsc, shop, aeo, audit] = await Promise.all([
    db.from("gsc_daily").select("clicks,impressions").eq("site_id", siteId).gte("date", since),
    db.from("shop_daily").select("orders,sales").eq("site_id", siteId).gte("day", since),
    db.from("aeo_runs").select("id,finished_at").eq("site_id", siteId).eq("status", "done").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("audits").select("score,created_at").eq("site_id", siteId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (gsc.data?.length) { out.search_clicks = gsc.data.reduce((n: number, r: any) => n + (r.clicks || 0), 0); out.search_impressions = gsc.data.reduce((n: number, r: any) => n + (r.impressions || 0), 0); }
  if (shop.data?.length) { out.orders = shop.data.reduce((n: number, r: any) => n + (r.orders || 0), 0); out.sales = Math.round(shop.data.reduce((n: number, r: any) => n + Number(r.sales || 0), 0)); }
  if (aeo.data) { const { data } = await db.from("aeo_checks").select("mentioned").eq("run_id", aeo.data.id).eq("status", "done").limit(1000); if (data?.length) { out.ai_named_share = Math.round(100 * data.filter((c: any) => c.mentioned).length / data.length); out.ai_checked_at = aeo.data.finished_at; } }
  if (audit.data) out.audit_score = audit.data.score;
  return out;
}
// 28 days after a run: approved work gets an after-snapshot; undecided work waits (up to 90 days); rejected is recorded.
async function measurePass() {
  const { data: due } = await db.from("playbook_runs").select("id,site_id,draft_id,measure,created_at").eq("status", "ready").is("measured_at", null).lte("review_at", new Date().toISOString()).limit(40);
  let n = 0;
  for (const r of due || []) {
    const { data: d } = await db.from("drafts").select("status,decided_at").eq("id", r.draft_id).maybeSingle();
    const m = { ...(r.measure || {}) };
    if (d?.status === "approved") { m.after = await snapshot(r.site_id); m.outcome = "measured"; m.decided_at = d.decided_at; }
    else if (d?.status === "rejected" || !d) m.outcome = d ? "rejected" : "draft_removed";
    else if (Date.now() - Date.parse(r.created_at) > 90 * DAY) m.outcome = "never_decided";
    else { await db.from("playbook_runs").update({ review_at: new Date(Date.now() + 7 * DAY).toISOString() }).eq("id", r.id); continue; }
    await db.from("playbook_runs").update({ measure: m, measured_at: new Date().toISOString() }).eq("id", r.id); n++;
  }
  return n;
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
    if (body.action === "autopilot") {
      if (uid !== null) return json({ error: "Engine key required" }, 401);
      return json(await autopilot());
    }
    if (body.action === "run") {
      const pb = seoBooks.find(p=>p.slug===body.slug) || ((await library()).playbooks || []).find((p: any) => p.slug === body.slug); // the library includes the 12 SEO specialists
      if (!pb) return json({ error: "Unknown playbook" }, 400);
      const { data: busy } = await db.from("playbook_runs").select("id").eq("site_id", body.site_id).eq("slug", pb.slug).eq("status", "writing").gte("created_at", new Date(Date.now() - 5 * 60000).toISOString()).limit(1);
      if (busy?.length) return json({ ok: true, id: busy[0].id, status: "writing" });
      const { data: site } = await db.from("sites").select("id,name,domain,profile,brand").eq("id", body.site_id).single();
      const auto = uid === null && body.auto === true;
      const measure = { metric: metricFor(pb), baseline: await snapshot(body.site_id), at: new Date().toISOString() };
      const { data: run, error } = await db.from("playbook_runs").insert({ site_id: body.site_id, slug: pb.slug, note: clean(body.note).slice(0, 300) || null, created_by: uid, auto, measure, review_at: new Date(Date.now() + 28 * DAY).toISOString() }).select("id").single();
      if (error) throw new Error(error.message);
      // @ts-ignore EdgeRuntime is provided by Supabase
      EdgeRuntime.waitUntil(runPlaybook(run.id, site, pb, clean(body.note)));
      return json({ ok: true, id: run.id, status: "writing" });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});
