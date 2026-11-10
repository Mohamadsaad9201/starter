import { searchDecision, evidenceFingerprint, listingDefects, rankingCandidate, SEARCH_POLICY_VERSION } from "./search-strategy.ts";
import { decodeHtml, normalHost, normalizeText } from "../_shared/reliability.ts";
import { brandBrief, permittedCopy } from "../_shared/business.ts";

const MAX_URLS = 10000, MAX_SITEMAPS = 1000;
const clean = (s: any) => normalizeText(String(s || ""));
export function matchAuditLease(query: any, previous: any) {
  if (!previous) return query.is("checkup", null);
  for (const field of ["status", "updated_at", "leaseId"]) query = previous[field] ? query.eq(`checkup->>${field}`, previous[field]) : query.is(`checkup->>${field}`, null);
  return query;
}
const strip = (s: string) => clean(s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " "));
export async function digest(s: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(x => x.toString(16).padStart(2, "0")).join("");
}
export function auditUrl(value: string, origin: string, sitemap = false) {
  try {
    const u = new URL(decodeHtml(value), origin), host = normalHost(origin);
    if (!host.includes(".") || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) || /^[\d.]+$/.test(host) || host.includes(":")) return null;
    if (u.protocol !== "https:" || normalHost(u.href) !== host || u.username || u.password || u.port) return null;
    if (!sitemap && /\.(?:jpg|jpeg|png|gif|webp|avif|svg|pdf|xml|gz|zip|mp4|css|js|woff2?)(?:$)/i.test(u.pathname)) return null;
    if (!sitemap && /^\/(?:cart|checkout|account|search)(?:\/|$)/i.test(u.pathname)) return null;
    u.hash = ""; if (!sitemap) u.search = "";
    return u.href;
  } catch { return null; }
}
export async function fetchAuditText(url: string, origin: string) {
  let current = auditUrl(url, origin, true);
  for (let i = 0; current && i < 6; i++) {
    const r = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "ImpactfulBot/1.0 (+https://ots-seo-engine.netlify.app)" } });
    if ([301, 302, 303, 307, 308].includes(r.status)) { current = auditUrl(r.headers.get("location") || "", current, true); if (current && normalHost(current) !== normalHost(origin)) current = null; continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
    const reader = r.body?.getReader(); if (!reader) throw new Error("Empty response");
    const decoder = new TextDecoder(); let size = 0, text = "";
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4_000_000) throw new Error("Response exceeds the 4 MB audit limit"); text += decoder.decode(value, { stream: true }); } }
    finally { await reader.cancel().catch(() => {}); }
    return text + decoder.decode();
  }
  throw new Error("Redirect left the business domain or exceeded the redirect limit");
}

// A rejection/dismissal remains effective for the same observed issue. A deployed
// correction suppresses a duplicate, but a later regression can get a new proposal.
export function proposalDecision(rows: any[], item: any, policy: string, table: string) {
  const same = rows.filter(r => r.id === item.baseId || r.data?.audit?.baseId === item.baseId || r.id.startsWith(item.baseId + "::rev:"));
  if (same.some(r => ["approved", "rollback_requested"].includes(r.status))) return false;
  if (same.some(r => r.status === "deployed" && clean(r.after) === clean(item.before))) return false;
  if (same.some(r => r.status === "rolled_back" && clean(r.restore ?? r.before) === clean(item.before))) return false;
  if (same.some(r => ["rejected", "dismissed", "done"].includes(r.status) && clean(r.before) === clean(item.before))) return false;
  if (same.some(r => ["pending", "failed"].includes(r.status) && clean(r.before) === clean(item.before) &&
    (table === "tasks" || r.source !== "checkup" || (r.data?.audit?.policy === policy && (!item.type || (r.data?.search_strategy?.version===SEARCH_POLICY_VERSION && Date.now()-Date.parse(r.data.search_strategy.reviewed_at)<7*86400000)))))) return false;
  return true;
}
async function priorRows(db: any, table: string, siteId: string) {
  const rows: any[] = [];
  for (let n = 0;; n += 1000) {
    const { data, error } = await db.from(table).select(table === "fixes" ? "id,status,before,after,restore,source,data" : "id,status,before,after").eq("site_id", siteId).range(n, n + 999);
    if (error) throw new Error(error.message); rows.push(...(data || [])); if ((data || []).length < 1000) return rows;
  }
}
export async function planCandidates(db: any, site: any, cp: any, items: any[]) {
  const rows = await priorRows(db, cp.table, site.id);
  cp.found += items.length;
  const policy = await digest(brandBrief(site));
  for (const item of items.filter(rankingCandidate)) if (proposalDecision(rows, item, policy, cp.table)) {
    const key = await digest(`${cp.runId}\n${item.baseId}\n${item.before}\n${policy}`);
    if (!cp.pending.some((p: any) => p.id === `${item.baseId}::rev:${key.slice(0, 20)}`)) cp.pending.push({ ...item, id: `${item.baseId}::rev:${key.slice(0, 20)}`, policy });
  }
}
export async function saveCandidates(db: any, site: any, cp: any, writeSeo: any, evidenceFor?: any) {
  const batch = cp.pending.slice(0, 6);
  const rows = await priorRows(db, cp.table, site.id);
  const policy = await digest(brandBrief(site));
  for (const x of batch) if (x.policy !== policy) {
    x.policy = policy;
    x.id = `${x.baseId}::rev:${(await digest(`${cp.runId}\n${x.baseId}\n${x.before}\n${policy}`)).slice(0, 20)}`;
  }
  let eligible = batch.filter((x: any) => rankingCandidate(x) && !rows.some(r => r.id === x.id) && proposalDecision(rows, x, x.policy, cp.table));
  for (const x of eligible.filter((x:any)=>x.type)) {
    const baseline = evidenceFor ? await evidenceFor(site.id,x.url) : {status:'unavailable'};
    x.strategy = searchDecision(x,baseline);
    if(x.strategy.decision !== 'draft_for_review') {
      cp.strategyDecisions ||= {leave_unchanged:0,needs_evidence:0,draft_for_review:0};
      cp.strategyDecisions[x.strategy.decision]++;
      cp.warnings ||= [];
      const warning = 'Existing search listings are protected. Missing page evidence pauses drafting; length alone does not justify a rewrite.';
      if(!cp.warnings.includes(warning))cp.warnings.push(warning);
    }
  }
  eligible = eligible.filter((x:any)=>!x.type || x.strategy.decision==='draft_for_review');
  const written = eligible.length ? await writeSeo(site, eligible.filter((x: any) => x.type).map((x: any) => ({ key: x.id, type: x.type, name: x.name, current: x.before, context: x.ctx || "", strategy:x.strategy }))) : {};
  for (const x of batch) {
    // A prior interrupted attempt may already have saved this exact revision.
    if (rows.some(r => r.id === x.id)) { cp.queued++; continue; }
    if (!eligible.includes(x)) continue;
    const after = x.type ? written[x.id] : x.after;
    if (!after || !permittedCopy(after, site)) throw new Error("The writer did not produce usable copy for every item. Progress is saved; resume this audit after checking the AI provider and business rules.");
    if (clean(after) === clean(x.before)) continue;
    const row:any = cp.table === "fixes" ? {
      id: x.id, site_id: site.id, page_key: x.pk, url: x.url, platform: "shopify", ref: x.ref, kind: x.kind,
      page_name: x.name, field: x.field, target: x.target || null, before: x.before, restore: x.restore,
      after, reasons: x.reasons, status: "pending", priority: "normal", source: "checkup",
      data: { ...(x.strategy ? {search_strategy:{...x.strategy,reviewed_at:new Date().toISOString()}} : {}), audit: { baseId: x.baseId, policy: x.policy, runId: cp.runId } },
    } : { id: x.id, site_id: site.id, kind: x.kind, priority: x.priority || "normal", target: new URL(x.url).pathname, url: x.url, before: x.before, after, status: "pending", note: x.strategy ? `${x.strategy.reason} Baseline: ${x.strategy.baseline.status}. ${x.strategy.risk} Source: ${x.strategy.sources[0].url}` : "On-page check; review this suggestion against your business rules." };
    if(x.strategy && row.data) row.data.search_strategy.fingerprint = await evidenceFingerprint(row);
    const { error } = await db.from(cp.table).upsert(row, { onConflict: "site_id,id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    // Only retire older, still-unapproved suggestions for this exact issue. Approved
    // changes also get a platform preflight before writes, preventing stale overwrites.
    const old = rows.filter(r => r.status === "pending" && r.id !== x.id && (r.id === x.baseId || r.data?.audit?.baseId === x.baseId || r.id.startsWith(x.baseId + "::rev:")));
    for (const r of old) {
      const { error } = await db.from(cp.table).update({ status: cp.table === "fixes" ? "superseded" : "dismissed" }).eq("site_id", site.id).eq("id", r.id).eq("status", "pending").eq("before", r.before);
      if (error) throw new Error(error.message);
    }
    cp.queued++;
  }
  cp.pending.splice(0, batch.length);
}

export function newCheckpoint(shopify: boolean, origin: string) {
  return { version: 1, runId: crypto.randomUUID(), table: shopify ? "fixes" : "tasks", stage: shopify ? "products" : "sitemaps", cursor: null,
    pending: [], media: [], pages: 0, checks: 0, passed: 0, found: 0, queued: 0, failures: [], warnings: [],
    origin, sitemapQueue: shopify ? [] : [`${origin}/sitemap.xml`], sitemapSeen: [], urls: shopify ? [] : [`${origin}/`], pageIndex: 0 };
}
function addUrls(cp: any, urls: string[], sitemap = false) {
  const list = sitemap ? cp.sitemapQueue : cp.urls, limit = sitemap ? MAX_SITEMAPS : MAX_URLS;
  for (const raw of urls) {
    const url = auditUrl(raw, cp.origin, sitemap);
    if (!url || list.includes(url) || (sitemap && cp.sitemapSeen.includes(url))) continue;
    if (list.length + (sitemap ? cp.sitemapSeen.length : 0) >= limit) { const warning = `Coverage limit reached: ${limit} ${sitemap ? "sitemaps" : "URLs"}. This audit is partial.`; if (!cp.warnings.includes(warning)) cp.warnings.push(warning); break; }
    list.push(url);
  }
}
function imageItems(cp:any,n:any,media:any[],offset=0){return [];}
// Duplicate listings are counted across the run: the second and later pages with the same text are flagged.
function seenBefore(cp: any, field: string, value: string) {
  const k = value.toLowerCase(); if (!k) return 0;
  const m = (cp.seen ||= { title: {}, description: {} })[field]; const n = m[k] || 0; m[k] = n + 1; return n;
}
// One listing (title + description) for any Shopify resource: missing copy is drafted, objective defects get a reviewed rewrite.
function listingItems(cp: any, base: { pk: string; url: string; kind: string; name: string; ref: string; ctx: string }, title: string, titleTag: string, desc: string, descTag: string) {
  const items: any[] = [];
  cp.pages++; cp.checks += 1;
  const tDup = seenBefore(cp, "title", title), dDup = seenBefore(cp, "description", desc);
  const tDef = listingDefects("title", title, { duplicate: tDup, name: base.name }), dDef = listingDefects("description", desc, { duplicate: dDup, name: base.name });
  const titleBad = !title || tDef.length > 0, descBad = !desc || dDef.length > 0;
  if (!titleBad) cp.passed++;
  if (titleBad) items.push({ baseId: `${base.pk}::seo.title`, ...base, field: "seo.title", type: "title", before: title, restore: titleTag, duplicate: tDup, reasons: tDef.length ? tDef : ["title_missing"] });
  return items;
}
function shopItems(cp: any, n: any, kind: string) {
  const pk = `shopify:${n.id}`, url = n.onlineStoreUrl || `${cp.origin}/${kind === "product" ? "products" : "collections"}/${n.handle}`;
  const items = listingItems(cp, { pk, url, kind, name: n.title, ref: n.id, ctx: clean(n.description).slice(0, 12000) }, clean(n.seo?.title || n.title), n.seo?.title || "", clean(n.seo?.description), n.seo?.description || "");
  if (kind === "product") {
    items.push(...imageItems(cp, n, n.media?.nodes || []));
    if (n.media?.pageInfo?.hasNextPage) cp.media.push({ id: n.id, title: n.title, handle: n.handle, onlineStoreUrl: n.onlineStoreUrl, cursor: n.media.pageInfo.endCursor, offset: n.media.nodes.length });
  }
  return items;
}
// Online-store pages and blog articles keep their search listing in the global title_tag / description_tag metafields.
function contentItems(cp: any, n: any, kind: "page" | "article") {
  const url = kind === "page" ? `${cp.origin}/pages/${n.handle}` : `${cp.origin}/blogs/${n.blog?.handle}/${n.handle}`;
  const body = strip(n.body || ""), titleTag = n.titleTag?.value || "", descTag = n.descTag?.value || "";
  return listingItems(cp, { pk: `shopify:${n.id}`, url, kind, name: n.title, ref: n.id, ctx: body.slice(0, 12000) }, clean(titleTag || n.title), titleTag, clean(descTag), descTag);
}
function contentSnapshots(cp: any, nodes: any[], kind: string) {
  return nodes.map(n => { const url = kind === "page" ? `${cp.origin}/pages/${n.handle}` : `${cp.origin}/blogs/${n.blog?.handle}/${n.handle}`; return { key: `shopify:${n.id}`, url, kind, data: { name: n.title, title: n.title, seoTitle: n.titleTag?.value || n.title, metaDescription: n.descTag?.value || "", bodyText: strip(n.body || "").slice(0, 12000), excerptOnly: true, source: "Shopify API" } }; });
}
function advance(cp: any, page: any, next: string) {
  if (page.pageInfo?.hasNextPage) {
    if (!page.pageInfo.endCursor || page.pageInfo.endCursor === cp.cursor) throw new Error("The platform returned a repeated pagination cursor.");
    cp.cursor = page.pageInfo.endCursor;
  } else { cp.stage = next; cp.cursor = null; }
}
export async function savePageSnapshots(db:any,siteId:string,rows:any[]) {
  if(!rows.length)return;
  const {error}=await db.from('pages').upsert(rows.map((r:any)=>({...r,site_id:siteId,updated_at:new Date().toISOString()})),{onConflict:'site_id,key'});
  if(error)throw new Error('Could not save page evidence: '+error.message);
}
function shopSnapshots(cp:any,nodes:any[],kind:string) {
  return nodes.map(n=>({key:`shopify:${n.id}`,url:n.onlineStoreUrl||`${cp.origin}/${kind==='product'?'products':'collections'}/${n.handle}`,kind,data:{name:n.title,title:n.title,seoTitle:n.seo?.title||n.title,metaDescription:n.seo?.description||'',bodyText:clean(n.description).slice(0,12000),excerptOnly:true,source:'Shopify API'}}));
}
export async function auditStep(db: any, site: any, connector: any, cp: any, deps: any) {
  if (cp.pending.length) { await saveCandidates(db, site, cp, deps.writeSeo, deps.evidenceFor); return cp; }
  if (["products", "collections", "shop_pages", "articles", "media"].includes(cp.stage)) {
    if (!connector) throw new Error("The Shopify connection is no longer available.");
    const token = await deps.secretFor(connector.id); if (!token) throw new Error("Shopify credential unavailable.");
    const ask = (query: string, variables: any) => deps.shopify(connector.config.shop, token, query, variables);
    let items: any[] = [];
    if (cp.stage === "products") {
      const d = await ask(`query AuditProducts($after:String){products(first:40,after:$after,query:"status:active",sortKey:ID){nodes{id title handle onlineStoreUrl description seo{title description} media(first:10){nodes{...on MediaImage{id alt}} pageInfo{hasNextPage endCursor}}}pageInfo{hasNextPage endCursor}}}`, { after: cp.cursor });
      if(deps.recordPages)await deps.recordPages(site.id,shopSnapshots(cp,d.products.nodes,'product'));
      items = d.products.nodes.flatMap((n: any) => shopItems(cp, n, "product")); advance(cp, d.products, "collections");
    } else if (cp.stage === "collections") {
      const d = await ask(`query AuditCollections($after:String){collections(first:40,after:$after){nodes{id title handle description seo{title description}}pageInfo{hasNextPage endCursor}}}`, { after: cp.cursor });
      if(deps.recordPages)await deps.recordPages(site.id,shopSnapshots(cp,d.collections.nodes,'collection'));
      items = d.collections.nodes.flatMap((n: any) => shopItems(cp, n, "collection")); advance(cp, d.collections, "shop_pages");
    } else if (cp.stage === "shop_pages" || cp.stage === "articles") {
      // Needs read_content. Without it, the check continues and reports what it couldn't cover.
      const kind = cp.stage === "shop_pages" ? "page" : "article";
      const fields = `id title handle body isPublished titleTag:metafield(namespace:"global",key:"title_tag"){value} descTag:metafield(namespace:"global",key:"description_tag"){value}${kind === "article" ? " blog{handle}" : ""}`;
      try {
        const d = await ask(`query AuditContent($after:String){${kind === "page" ? "pages" : "articles"}(first:30,after:$after){nodes{${fields}}pageInfo{hasNextPage endCursor}}}`, { after: cp.cursor });
        const page = kind === "page" ? d.pages : d.articles, live = page.nodes.filter((n: any) => n.isPublished !== false);
        if (deps.recordPages) await deps.recordPages(site.id, contentSnapshots(cp, live, kind));
        items = live.flatMap((n: any) => contentItems(cp, n, kind)); advance(cp, page, kind === "page" ? "articles" : "media");
      } catch (e) {
        const warning = `${kind === "page" ? "Store pages" : "Blog articles"} weren't checked: ${(e as Error).message.slice(0, 160)}`;
        if (!cp.warnings.includes(warning)) cp.warnings.push(warning);
        cp.stage = kind === "page" ? "articles" : "media"; cp.cursor = null;
      }
    } else if (cp.media.length) {
      const n = cp.media[0];
      const d = await ask(`query AuditMedia($id:ID!,$after:String){product(id:$id){media(first:100,after:$after){nodes{...on MediaImage{id alt}}pageInfo{hasNextPage endCursor}}}}`, { id: n.id, after: n.cursor });
      if (!d.product) { cp.warnings.push(`Product removed during audit: ${n.id}`); cp.media.shift(); }
      else {
        const m = d.product.media; items = imageItems(cp, n, m.nodes, n.offset);
        if (m.pageInfo.hasNextPage) { if (!m.pageInfo.endCursor || m.pageInfo.endCursor === n.cursor) throw new Error("Repeated image cursor"); n.cursor = m.pageInfo.endCursor; n.offset += m.nodes.length; } else cp.media.shift();
      }
    } else cp.stage = "finish";
    await planCandidates(db, site, cp, items); return cp;
  }
  if (cp.stage === "sitemaps") {
    if (!cp.sitemapQueue.length) { cp.stage = "pages"; return cp; }
    const url = cp.sitemapQueue.shift(); cp.sitemapSeen.push(url);
    try {
      const xml = await (deps.fetchText || fetchAuditText)(url, cp.origin);
      const locs = [...xml.matchAll(/<(?:[\w.-]+:)?loc>\s*([^<]+)\s*<\/(?:[\w.-]+:)?loc>/gi)].map((m: any) => m[1].trim());
      if (/<(?:[\w.-]+:)?sitemapindex\b/i.test(xml)) addUrls(cp, locs, true);
      else if (/<(?:[\w.-]+:)?urlset\b/i.test(xml)) addUrls(cp, locs);
      else throw new Error("Response was not a sitemap");
    } catch (e) { cp.failures.push({ url, stage: "sitemap", error: (e as Error).message }); }
    return cp;
  }
  if (cp.stage === "pages") {
    const urls = cp.urls.slice(cp.pageIndex, cp.pageIndex + 5);
    if (!urls.length) { cp.stage = "finish"; return cp; }
    const items: any[] = [];
    const pages = await Promise.all(urls.map(async (url: string) => { try { return { url, html: await (deps.fetchText || fetchAuditText)(url, cp.origin) }; } catch (e) { return { url, error: (e as Error).message }; } }));
    for (const page of pages) {
      if (page.error || !page.html) { cp.failures.push({ url: page.url, stage: "page", error: page.error || "Empty page" }); continue; }
      const h = page.html;
      if (!/<html\b/i.test(h)) { cp.failures.push({ url: page.url, stage: "page", error: "Not an HTML document" }); continue; }
      const title = strip(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
      const desc = clean(h.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] || h.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1] || "");
      const h1 = (h.match(/<h1[\s>]/gi) || []).length, imgs = h.match(/<img\b[^>]*>/gi) || [], noAlt = imgs.filter((t: string) => !/\balt=["'][^"']+["']/i.test(t)).length;
      const path = new URL(page.url).pathname.replace(/\/$/, "") || "/", name = title || strip(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "") || path, ctx = strip(h.match(/<main[\s\S]*?<\/main>/i)?.[0] || h).slice(0, 12000);
      if(deps.recordPages)await deps.recordPages(site.id,[{key:`crawl:${page.url}`,url:page.url,kind:'page',data:{title,name,seoTitle:title,metaDescription:desc,bodyText:ctx,excerptOnly:true,source:'Public page crawl'}}]);
      cp.pages++; cp.checks += 1;
      const tDup = seenBefore(cp, "title", title), dDup = seenBefore(cp, "description", desc);
      const tDef = listingDefects("title", title, { duplicate: tDup, name }), dDef = listingDefects("description", desc, { duplicate: dDup, name });
      const tb = !title || tDef.length > 0, dbad = !desc || dDef.length > 0;
      if (!tb) cp.passed++;
      if (tb) items.push({ baseId: `${site.id}:crawl:title:${path}`, type: "title", name, url: page.url, before: title || "(none)", ctx, kind: "Page title", priority: "normal", duplicate: tDup });
      if (path === "/" && /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(h)) cp.warnings.push(`Agency investigation: ${page.url} contains noindex. Confirm intended indexability before preparing an executable change.`);
      addUrls(cp, [...h.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)].map((m: any) => { try { return new URL(m[1], page.url).href; } catch { return ""; } }));
    }
    cp.pageIndex += urls.length; await planCandidates(db, site, cp, items); return cp;
  }
  return cp;
}


