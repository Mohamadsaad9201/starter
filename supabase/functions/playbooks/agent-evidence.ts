// Evidence for the 12 SEO specialist playbooks (seo-agent-*): the site's own pages, open audit findings,
// business facts, AI-answer competitors and, once connected, Search Console pages and queries.
// Everything is read from the business's records; the writer may use only these facts.
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const words = (t: string) => (t ? t.split(" ").length : 0);
const focusTerms = (s: string) => new Set(clean(s).toLowerCase().match(/[a-z0-9]{3,}/g) || []);

export async function agentEvidence(db: any, site: any, slug: string, note: string) {
  const out: string[] = [], since = new Date(Date.now() - 28 * 86400000).toISOString();
  const b = site.brand || {}, p = site.profile || {};
  out.push(`BUSINESS: ${site.name} (${site.domain})${p.industry ? ` · ${clean(p.industry)}` : ""}${p.customers ? ` · customers: ${clean(p.customers)}` : ""}${p.goal ? ` · goal: ${clean(p.goal)}` : ""}`);
  if (b.facts) out.push(`VERIFIED FACTS: ${clean(Array.isArray(b.facts) ? b.facts.join("; ") : b.facts).slice(0, 900)}`);
  if (b.keywords?.length) out.push(`HEAD KEYWORDS THE BUSINESS TARGETS: ${b.keywords.join(", ")}`);

  // Page inventory (latest crawl), money pages first when sales data names them.
  const { data: rows } = await db.from("pages").select("url,kind,data,updated_at").eq("site_id", site.id).gte("updated_at", since).order("updated_at", { ascending: false }).limit(400);
  const seen = new Map<string, any>();
  for (const r of rows || []) if (!seen.has(r.url) && r.kind !== "article") seen.set(r.url, r);
  for (const r of rows || []) if (!seen.has(r.url)) seen.set(r.url, r);
  const pages = [...seen.values()];
  const f = focusTerms(note);
  const score = (r: any) => [...f].filter((t) => `${r.url} ${r.data?.name || r.data?.title || ""}`.toLowerCase().includes(t)).length;
  const ranked = pages.map((r) => ({ r, s: score(r) })).sort((a, b) => b.s - a.s);
  const line = (r: any) => `${r.url} | ${r.kind} | ${clean(r.data?.name || r.data?.title).slice(0, 70)} | ${words(clean(r.data?.bodyText))} words${r.data?.indexable === false ? " | NOINDEX" : ""}${r.data?.title ? ` | title: ${clean(r.data.title).slice(0, 70)}` : ""}`;
  const cap = ["seo-agent-internal-links", "seo-agent-indexing"].includes(slug) ? 70 : 35;
  out.push(`PAGE INVENTORY (${pages.length} pages crawled in the last 28 days; showing ${Math.min(cap, pages.length)}, focus matches first). Format: URL | type | name | body words | flags:\n${ranked.slice(0, cap).map((x) => line(x.r)).join("\n")}`);

  // The single page in focus, in full, for page-level specialists.
  if (["seo-agent-onpage", "seo-agent-schema", "seo-agent-writer"].includes(slug) && ranked[0]?.s) {
    const r = ranked[0].r;
    out.push(`PAGE IN FOCUS: ${r.url}\nName: ${clean(r.data?.name)}\nSearch title: ${clean(r.data?.title)}\nMeta description: ${clean(r.data?.metaDescription)}\nCurrent text: ${clean(r.data?.bodyText).slice(0, 2200)}`);
  }

  // Open findings from the daily site audit.
  const { data: tasks } = await db.from("tasks").select("kind,target,url,note").eq("site_id", site.id).eq("status", "pending").limit(25);
  if (tasks?.length) out.push(`OPEN SITE-AUDIT FINDINGS:\n${tasks.map((t: any) => `- ${t.kind}: ${clean(t.target || t.url)}${t.note ? ` (${clean(t.note).slice(0, 140)})` : ""}`).join("\n")}`);

  // Search Console, when connected.
  const { data: last } = await db.from("gsc_pages").select("period_end").eq("site_id", site.id).order("period_end", { ascending: false }).limit(1).maybeSingle();
  if (last) {
    const [{ data: gp }, { data: gq }] = await Promise.all([
      db.from("gsc_pages").select("page,clicks,impressions,ctr,position").eq("site_id", site.id).eq("period_end", last.period_end).order("impressions", { ascending: false }).limit(40),
      db.from("gsc_queries").select("query,clicks,impressions,ctr,position").eq("site_id", site.id).eq("period_end", last.period_end).order("impressions", { ascending: false }).limit(40),
    ]);
    const { data: prevP } = await db.from("gsc_pages").select("period_end").eq("site_id", site.id).lt("period_end", last.period_end).order("period_end", { ascending: false }).limit(1).maybeSingle();
    const prevMap = new Map<string, number>();
    if (prevP) { const { data: pp } = await db.from("gsc_pages").select("page,clicks").eq("site_id", site.id).eq("period_end", prevP.period_end).limit(400); for (const r of pp || []) prevMap.set(r.page, r.clicks); }
    const pct = (v: number) => `${(Number(v) * 100).toFixed(1)}%`;
    out.push(`SEARCH CONSOLE PAGES (period ending ${last.period_end}${prevP ? `; previous period ending ${prevP.period_end}` : ""}). URL | clicks | impressions | CTR | avg position${prevP ? " | clicks previous period" : ""}:\n${(gp || []).map((r: any) => `${r.page} | ${r.clicks} | ${r.impressions} | ${pct(r.ctr)} | ${Number(r.position).toFixed(1)}${prevP ? ` | ${prevMap.get(r.page) ?? "—"}` : ""}`).join("\n")}`);
    out.push(`SEARCH CONSOLE QUERIES (same period; site-level, not tied to one URL). query | clicks | impressions | CTR | avg position:\n${(gq || []).map((r: any) => `${r.query} | ${r.clicks} | ${r.impressions} | ${pct(r.ctr)} | ${Number(r.position).toFixed(1)}`).join("\n")}`);
  } else out.push("SEARCH CONSOLE: not connected yet. Do not assume rankings, clicks or search volumes.");

  // Customer questions and competitors from the latest AI-answer check.
  const { data: run } = await db.from("aeo_runs").select("id").eq("site_id", site.id).eq("status", "done").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (run) {
    const { data: checks } = await db.from("aeo_checks").select("prompt,mentioned,competitors,citations").eq("run_id", run.id).eq("status", "done").limit(400);
    const by = new Map<string, { n: number; named: number }>();
    for (const c of checks || []) { const v = by.get(c.prompt) || { n: 0, named: 0 }; v.n++; if (c.mentioned) v.named++; by.set(c.prompt, v); }
    const rivals = new Map<string, number>(); for (const c of checks || []) for (const r of c.competitors || []) rivals.set(r, (rivals.get(r) || 0) + 1);
    const domains = new Map<string, number>(); for (const c of checks || []) for (const x of c.citations || []) { try { const h = new URL(x.url).hostname.replace(/^www\./, ""); domains.set(h, (domains.get(h) || 0) + 1); } catch { /* skip */ } }
    out.push(`CUSTOMER QUESTIONS ASKED TO AI ASSISTANTS (named the business in X of Y answers):\n${[...by.entries()].slice(0, 25).map(([q, v]) => `- ${clean(q)} (${v.named}/${v.n})`).join("\n")}`);
    if (rivals.size) out.push(`COMPETITORS AI ASSISTANTS NAMED (times): ${[...rivals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} (${v})`).join(", ")}`);
    if (domains.size) out.push(`WEBSITES AI ASSISTANTS CITED (times): ${[...domains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k} (${v})`).join(", ")}`);
  }
  return out.join("\n\n");
}
