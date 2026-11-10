// Production pipeline and the one approval endpoint.
//
// produce(): briefs and plans are not client approvals. Each tick classifies them, records the exact blocker for
// anything that cannot become executable work, and turns one eligible brief into a complete article through the
// engine's research-backed writer. The database gate (goodbeat_private.evaluate_draft) then decides, on its own,
// whether the result is ready for the approval queue.
//
// approve(): one authenticated decision on the exact prepared version. It binds to the gate's payload hash, hands the
// work to the engine's existing durable publish -> verify -> measure jobs, and records who decided. No second step.
const DAY = 86400000;
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
const sha = async (text: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
export const payloadHash = (title: string, body: string) => sha(`${title ?? ""}\n${body ?? ""}`);
// Same definition as the engine's copyHash: the hash its publish actions bind an approval to.
export const copyHash = (title: string, body: string) => sha(JSON.stringify([title, body]));

export const LIMITS = { perSiteDaily: 2, maxAwaiting: 5, attempts: 2, staleMinutes: 20 };
const OUT_OF_SCOPE = new Set(["sms", "emails", "social"]);
// Plans whose recommendations are articles. Any other brief recommends changes to existing pages, site settings or
// work off the website, which no adapter can publish.
const ARTICLE_SOURCES = new Set(["ai-answer-plan", "content-plan", "answer-article", "seo-agent-strategy", "seo-agent-keywords", "seo-agent-competitors", "seo-agent-writer", "seo-agent-brand", "competitor-profiling"]);
const NO_ADAPTER: Record<string, string> = {
  "Campaign brief": "Paid campaigns cannot be created from here. The ads connection supports pausing and resuming existing campaigns only, and no ad account is connected.",
  "Offer ideas": "Offers have no publishing adapter. An offer needs a store discount or campaign set up by the team.",
  "Ad copy": "Ads cannot be created from here. The ads connection supports pausing and resuming existing campaigns only.",
  "Landing page copy": "New pages cannot be created from here. The Shopify adapter adds a section to an existing page; it does not create or replace pages.",
  "Homepage section": "Homepage sections live in the store theme, which has no publishing adapter.",
  "About page": "Replacing a whole page has no publishing adapter. The Shopify adapter only adds a section to an existing page.",
  "Product description": "Replacing a product description has no publishing adapter yet. The Shopify adapter only adds a section below the existing description.",
  "Collection page copy": "Replacing collection copy has no publishing adapter yet. The Shopify adapter only adds a section below the existing copy.",
};

async function destinations(db: any) {
  const [{ data: sites }, { data: conns }, { data: pubs }] = await Promise.all([
    db.from("sites").select("id,name,domain,profile,brand").eq("active", true),
    db.from("connectors").select("site_id,type,status"),
    db.from("content_publications").select("site_id,blog_id,created_at,snapshot").not("blog_id", "is", null).order("created_at", { ascending: false }).limit(400),
  ]);
  const out = new Map<string, any>();
  for (const s of sites || []) {
    const mine = (conns || []).filter((c: any) => c.site_id === s.id && c.status === "connected");
    const blog = s.profile?.publishing?.blog_id || (pubs || []).find((p: any) => p.site_id === s.id)?.blog_id || null;
    const shop = mine.some((c: any) => c.type === "shopify");
    out.set(s.id, { site: s, blog, publishable: shop && !!blog, connected: mine.map((c: any) => c.type), published: (pubs || []).filter((p: any) => p.site_id === s.id).map((p: any) => clean(p.snapshot?.title)).filter(Boolean) });
  }
  return out;
}
export const blockerFor = (kind: string, slug: string, dest: any) => {
  if (OUT_OF_SCOPE.has(slug)) return { code: "out_of_scope", detail: "Email, SMS and social publishing are outside this product's scope. Kept as a reference for the team." };
  if (kind !== "Content brief") return { code: "no_execution_adapter", detail: NO_ADAPTER[kind] || `${kind} has no publishing adapter.` };
  if (slug && !ARTICLE_SOURCES.has(slug)) return { code: "no_deliverable_path", detail: "This brief recommends changes to existing pages, site settings or work away from the website. Only new articles and added page sections can be published from here, so the team carries this one out." };
  if (!dest?.publishable) return { code: "no_publishing_connection", detail: `${dest?.site?.name || "This business"} has no connection that can publish articles. Connected: ${dest?.connected?.length ? dest.connected.join(", ") + " (no article publishing)" : "nothing"}. Connect a Shopify store with content permission${dest?.connected?.includes("shopify") ? " and publish one article to set the destination blog" : ""}.` };
  return null;
};

export async function produce(db: any, engine: (b: Record<string, unknown>) => Promise<any>, only?: string) {
  const report: any = { classified: 0, blocked: 0, queued: 0, requeued: 0, produced: [], failed: [], skipped: [] };
  const dest = await destinations(db), now = Date.now();
  // A worker that stopped mid-article: nothing external was written, so the brief can be picked up again.
  const { data: stale } = await db.from("draft_pipeline").select("draft_id,attempts").eq("stage", "producing").lt("updated_at", new Date(now - LIMITS.staleMinutes * 60000).toISOString());
  for (const r of stale || []) await db.from("draft_pipeline").update(r.attempts >= LIMITS.attempts ? { stage: "blocked", blocker: { code: "production_failed", detail: "The writer stopped before finishing, twice. Needs a person to look at the brief." } } : { stage: "queued" }).eq("draft_id", r.draft_id).eq("stage", "producing");

  const { data: rows } = await db.from("draft_pipeline").select("draft_id,site_id,lane,stage,blocker,attempts,run_after").in("lane", ["production", "closed"]).or("stage.is.null,stage.neq.delivered").limit(3000);
  const ids = (rows || []).map((r: any) => r.draft_id);
  const drafts = new Map<string, any>(), slugs = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    const [{ data: d }, { data: runs }] = await Promise.all([db.from("drafts").select("id,site_id,kind,title,body,status,created_at").in("id", part), db.from("playbook_runs").select("draft_id,slug").in("draft_id", part)]);
    for (const x of d || []) drafts.set(x.id, x);
    for (const x of runs || []) slugs.set(x.draft_id, x.slug);
  }
  for (const r of rows || []) {
    const d = drafts.get(r.draft_id); if (!d) continue;
    // In production: undecided briefs, and plans the client or agency accepted. Rejected work and decided deliverables are not.
    r.eligible = r.lane === "production" || (d.status === "approved" && d.kind === "Content brief");
    if (!r.eligible || r.stage === "producing") continue;
    const blocker = blockerFor(d.kind, slugs.get(r.draft_id) || "", dest.get(r.site_id));
    if (!r.stage) {
      await db.from("draft_pipeline").update(blocker ? { stage: "blocked", blocker } : { stage: "queued", blocker: null }).eq("draft_id", r.draft_id).is("stage", null);
      report.classified++; blocker ? report.blocked++ : report.queued++; r.stage = blocker ? "blocked" : "queued";
    } else if (r.stage === "queued" && blocker) {
      await db.from("draft_pipeline").update({ stage: "blocked", blocker }).eq("draft_id", r.draft_id).eq("stage", "queued");
      report.blocked++; r.stage = "blocked";
    } else if (r.stage === "blocked" && r.blocker?.code !== "production_failed" && !blocker) {
      await db.from("draft_pipeline").update({ stage: "queued", blocker: null }).eq("draft_id", r.draft_id).eq("stage", "blocked");
      report.requeued++; r.stage = "queued";
    }
  }

  // One article per tick: research and writing take most of a request's time budget.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Detroit" });
  for (const [siteId, info] of dest) {
    if (only && only !== siteId) continue;
    if (!info.publishable) continue;
    const queue = (rows || []).filter((r: any) => r.eligible && r.site_id === siteId && r.stage === "queued" && (!r.run_after || Date.parse(r.run_after) <= now)).sort((a: any, b: any) => Number(drafts.get(b.draft_id)?.status === "approved") - Number(drafts.get(a.draft_id)?.status === "approved") || String(drafts.get(a.draft_id)?.created_at).localeCompare(String(drafts.get(b.draft_id)?.created_at))); // accepted plans first
    if (!queue.length) continue;
    const { data: mine } = await db.from("draft_pipeline").select("draft_id,lane,source_draft_id").eq("site_id", siteId).or("lane.eq.approval,source_draft_id.not.is.null");
    const awaiting = (mine || []).filter((m: any) => m.lane === "approval").length;
    const madeIds = (mine || []).filter((m: any) => m.source_draft_id).map((m: any) => m.draft_id);
    const { data: made } = madeIds.length ? await db.from("drafts").select("id,title,created_at").in("id", madeIds) : { data: [] };
    const madeToday = (made || []).filter((m: any) => new Date(m.created_at).toLocaleDateString("en-CA", { timeZone: "America/Detroit" }) === today).length;
    if (awaiting >= LIMITS.maxAwaiting) { report.skipped.push({ site: siteId, why: `${awaiting} items already wait for approval` }); continue; }
    if (madeToday >= LIMITS.perSiteDaily) { report.skipped.push({ site: siteId, why: `daily production limit ${LIMITS.perSiteDaily} reached` }); continue; }
    const pick = queue[0], brief = drafts.get(pick.draft_id);
    const { data: claimed } = await db.from("draft_pipeline").update({ stage: "producing", attempts: (pick.attempts || 0) + 1, updated_at: new Date().toISOString() }).eq("draft_id", pick.draft_id).eq("stage", "queued").select("draft_id");
    if (!claimed?.length) continue;
    const existing = [...new Set([...info.published, ...(made || []).map((m: any) => clean(m.title))])].slice(0, 40);
    // The plan may quote wording the business has excluded; the writer must never see it as usable copy.
    const banned: string[] = (info.site.brand?.bannedWords || []).map((w: unknown) => String(w)).filter((w: string) => w.trim().length > 2);
    let plan = String(brief.body || "");
    for (const w of banned) plan = plan.split(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")).join("[excluded wording]");
    const task = `PRODUCTION TASK for ${info.site.name} (${info.site.domain}). Turn the plan below into ONE complete, publish-ready blog article.
Choose the single most valuable article the plan calls for that the existing articles do not already cover.
Write the finished article itself: a real headline as the first-level heading, then the complete body with clear subheadings and links to the business's own relevant pages named in the plan.
The article is published exactly as written once the client approves it, so it must contain no notes to an editor, no placeholders, no questions for the owner, no planning, measurement or "next steps" sections, and no mention of this plan.
Use only facts the plan states as verified. Where the plan marks something unknown, unverified or a hypothesis, leave that claim out of the article.
EXISTING ARTICLES (do not duplicate these topics): ${existing.join(" | ") || "none recorded"}
PLAN (${brief.title}):
${plan.slice(0, 6500)}`;
    try {
      let r: any;
      try { r = await engine({ action: "draft", site_id: siteId, workspace: "seo", kind: "Blog post", title: "", brief: task }); }
      catch (e) {
        if (!/business rules|excluded/i.test((e as Error).message)) throw e;
        r = await engine({ action: "draft", site_id: siteId, workspace: "seo", kind: "Blog post", title: "", brief: "RETRY: the previous attempt used an excluded phrase or broke a source-link rule. Leave out any claim that needs excluded wording, and link sources only in the required format.\n" + task });
      }
      await db.from("draft_pipeline").update({ source_draft_id: brief.id, prepared_by: "system", source_run: "production:" + brief.id }).eq("draft_id", r.id);
      await db.from("draft_pipeline").update({ stage: "delivered", deliverable_id: r.id, blocker: null, updated_at: new Date().toISOString() }).eq("draft_id", brief.id);
      const { data: gate } = await db.from("draft_pipeline").select("lane,ready,reasons").eq("draft_id", r.id).maybeSingle();
      report.produced.push({ site: siteId, brief: brief.id, deliverable: r.id, lane: gate?.lane, reasons: gate?.reasons });
    } catch (e) {
      const detail = String((e as Error).message || e).slice(0, 300), last = (pick.attempts || 0) + 1 >= LIMITS.attempts;
      await db.from("draft_pipeline").update(last ? { stage: "blocked", blocker: { code: "production_failed", detail } } : { stage: "queued", run_after: new Date(now + DAY / 4).toISOString(), blocker: { code: "retrying", detail } }).eq("draft_id", brief.id);
      report.failed.push({ site: siteId, brief: brief.id, detail, final: last });
      if (Date.now() - now < 100000) continue; // the blocker is recorded; move on to other eligible work while time allows
    }
    break;
  }
  return report;
}

// One valid approval: verify the actor, the gate and the exact version, then hand over to the engine's durable jobs.
export async function approve(db: any, body: any, actor: { id: string; role: string }, call: (b: Record<string, unknown>, asUser?: boolean) => Promise<any>) {
  if (!["agency", "owner", "reviewer"].includes(actor.role)) throw new Error("You don't have permission to approve work for this business.");
  const { data: d } = await db.from("drafts").select("id,site_id,kind,title,body,status,ranking_hold").eq("id", body.draft_id).eq("site_id", body.site_id).maybeSingle();
  if (!d) throw new Error("This item no longer exists.");
  if (d.status === "approved") return { ok: true, already: true };
  if (d.status !== "needs_review") throw new Error("This item was already decided.");
  await db.rpc("refresh_draft_gate", { p_id: d.id });
  const { data: gate } = await db.from("draft_pipeline").select("lane,ready,adapter,payload_hash,reasons").eq("draft_id", d.id).maybeSingle();
  if (!gate?.ready || gate.lane !== "approval") throw new Error("This item is not ready to publish: " + ((gate?.reasons || []).map((r: any) => r.detail).join(" ") || "it has not passed the readiness check."));
  const current = await payloadHash(d.title, d.body);
  if (!body.payload_hash || body.payload_hash !== current || current !== gate.payload_hash) throw new Error("This item changed after you opened it. Review the latest version, then approve.");
  let result: any;
  if (gate.adapter === "shopify_article") {
    const { data: site } = await db.from("sites").select("profile").eq("id", d.site_id).single();
    const { data: last } = await db.from("content_publications").select("blog_id").eq("site_id", d.site_id).not("blog_id", "is", null).order("created_at", { ascending: false }).limit(1);
    const blog = site?.profile?.publishing?.blog_id || last?.[0]?.blog_id;
    if (!blog) throw new Error("No destination blog is set for this business.");
    result = await call({ action: "publication_schedule", site_id: d.site_id, draft_id: d.id, approved_hash: await copyHash(d.title, d.body), blog_id: blog, ...(body.run_after ? { run_after: body.run_after } : {}) });
  } else if (gate.adapter === "shopify_page_section") {
    const prepared = await call({ action: "page_content_prepare", site_id: d.site_id, draft_id: d.id });
    result = await call({ action: "page_content_approve", site_id: d.site_id, draft_id: d.id, approved_hash: prepared.approval_hash, reviewed: true }, true);
  } else throw new Error("This item has no publishing path.");
  const { error } = await db.from("client_reviews").insert({ site_id: d.site_id, item_kind: "draft", item_id: String(d.id), decision: "approved", snapshot: { title: d.title, body: d.body, payload_hash: current, adapter: gate.adapter, role: actor.role }, user_id: actor.id });
  if (error) console.log("approval record not saved", d.id, error.message);
  return { ok: true, queued: true, adapter: gate.adapter, scheduled_for: body.run_after || null, result };
}
