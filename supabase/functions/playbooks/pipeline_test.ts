// Contract tests for the production pipeline and the approval endpoint. The database and the engine are fixtures:
// nothing here touches a live account. Run: deno test supabase/functions/playbooks/pipeline_test.ts
import { approve, blockerFor, copyHash, LIMITS, payloadHash, produce } from "./pipeline.ts";

const eq = (a: unknown, b: unknown, msg = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const ok = (v: unknown, msg: string) => { if (!v) throw new Error(msg); };
const fails = async (fn: () => Promise<unknown>, re: RegExp) => { try { await fn(); } catch (e) { if (re.test((e as Error).message)) return; throw new Error("wrong error: " + (e as Error).message); } throw new Error("expected failure " + re); };

// Minimal in-memory stand-in for the query builder calls the pipeline makes.
function fakeDb(t: Record<string, any[]>) {
  const cond = (expr: string) => { const [k, op, ...rest] = expr.split("."), v = rest.join("."); return (r: any) => op === "eq" ? r[k] === v : op === "neq" ? (r[k] ?? null) !== v : op === "is" ? (r[k] ?? null) === null : op === "not" ? (r[k] ?? null) !== null : false; };
  const from = (name: string) => {
    const rows = (t[name] ||= []), f: ((r: any) => boolean)[] = []; let op = "select", patch: any, one = false, lim = Infinity;
    const api: any = {
      select: () => api, insert: (v: any) => { op = "insert"; patch = v; return api; }, update: (v: any) => { op = "update"; patch = v; return api; },
      eq: (k: string, v: any) => { f.push((r) => r[k] === v); return api; }, in: (k: string, vs: any[]) => { f.push((r) => vs.includes(r[k])); return api; },
      is: (k: string, v: any) => { f.push((r) => (r[k] ?? null) === v); return api; }, lt: (k: string, v: any) => { f.push((r) => r[k] < v); return api; },
      not: (k: string) => { f.push((r) => (r[k] ?? null) !== null); return api; }, or: (e: string) => { const cs = e.split(",").map(cond); f.push((r) => cs.some((c) => c(r))); return api; },
      order: () => api, limit: (n: number) => { lim = n; return api; }, maybeSingle: () => { one = true; return api; }, single: () => { one = true; return api; },
      then: (res: any) => {
        if (op === "insert") { rows.push({ ...patch }); return res({ data: patch, error: null }); }
        const hit = rows.filter((r) => f.every((c) => c(r))).slice(0, lim);
        if (op === "update") hit.forEach((r) => Object.assign(r, patch));
        const out = hit.map((r) => ({ ...r })); // snapshots, as a real query returns
        return res({ data: one ? out[0] ?? null : out, error: null });
      },
    };
    return api;
  };
  return { from, rpc: async () => ({ data: null, error: null }) };
}
const now = new Date().toISOString();
const world = (): any => ({
  sites: [{ id: "shop", name: "Fixture Shop", domain: "shop.test", active: true, profile: {}, brand: { bannedWords: ["free shipping"] } }, { id: "noshop", name: "Fixture Local", domain: "local.test", active: true, profile: {}, brand: {} }],
  connectors: [{ site_id: "shop", type: "shopify", status: "connected" }, { site_id: "noshop", type: "framer", status: "connected" }],
  content_publications: [{ site_id: "shop", blog_id: "gid://shopify/Blog/1", created_at: now, snapshot: { title: "Existing article" } }],
  drafts: [
    { id: "b1", site_id: "shop", kind: "Content brief", title: "AI answer plan", body: "Write about cold packing. We offer free shipping.", status: "needs_review", created_at: "2026-11-01" },
    { id: "b2", site_id: "shop", kind: "Campaign brief", title: "Paid plan", body: "x", status: "needs_review", created_at: "2026-11-02" },
    { id: "b3", site_id: "shop", kind: "Content brief", title: "Internal links", body: "x", status: "needs_review", created_at: "2026-11-03" },
    { id: "b4", site_id: "noshop", kind: "Content brief", title: "Content plan", body: "x", status: "needs_review", created_at: "2026-11-01" },
    { id: "b5", site_id: "shop", kind: "Content brief", title: "Texts", body: "x", status: "needs_review", created_at: "2026-11-01" },
    { id: "b6", site_id: "shop", kind: "Content brief", title: "Accepted plan", body: "y", status: "approved", created_at: "2026-11-05" },
    { id: "b7", site_id: "shop", kind: "Content brief", title: "Rejected plan", body: "y", status: "rejected", created_at: "2026-11-05" },
  ],
  playbook_runs: [{ draft_id: "b1", slug: "ai-answer-plan" }, { draft_id: "b2", slug: "campaign-plan" }, { draft_id: "b3", slug: "seo-internal-links" }, { draft_id: "b4", slug: "content-plan" }, { draft_id: "b5", slug: "sms" }, { draft_id: "b6", slug: "content-plan" }, { draft_id: "b7", slug: "content-plan" }],
  draft_pipeline: ["b1", "b2", "b3", "b5"].map((id) => ({ draft_id: id, site_id: "shop", lane: "production", attempts: 0 }))
    .concat([{ draft_id: "b4", site_id: "noshop", lane: "production", attempts: 0 }, { draft_id: "b6", site_id: "shop", lane: "closed", attempts: 0 }, { draft_id: "b7", site_id: "shop", lane: "closed", attempts: 0 }]) as any[],
  client_reviews: [] as any[],
});
// Stands in for the engine writer plus the database gate that files a finished article in the approval lane.
const writer = (t: any, calls: any[], fail = 0) => async (b: any) => {
  calls.push(b);
  if (calls.length <= fail) throw new Error("The writer could not produce copy that follows your business rules");
  const id = "art" + calls.length;
  t.drafts.push({ id, site_id: b.site_id, kind: b.kind, title: "Finished headline", body: "# Finished headline\n" + "x".repeat(1300), status: "needs_review", created_at: new Date().toISOString() });
  t.draft_pipeline.push({ draft_id: id, site_id: b.site_id, lane: "approval", ready: true, adapter: "shopify_article", payload_hash: await payloadHash("Finished headline", "# Finished headline\n" + "x".repeat(1300)), reasons: [] });
  return { id };
};
const stage = (t: any, id: string) => t.draft_pipeline.find((r: any) => r.draft_id === id);

Deno.test("each brief gets an exact blocker or a place in production", async () => {
  const t = world(), calls: any[] = [];
  const r = await produce(fakeDb(t), writer(t, calls));
  eq(stage(t, "b2").blocker.code, "no_execution_adapter"); eq(stage(t, "b3").blocker.code, "no_deliverable_path");
  eq(stage(t, "b4").blocker.code, "no_publishing_connection"); ok(/framer/.test(stage(t, "b4").blocker.detail), "names what is connected");
  eq(stage(t, "b5").blocker.code, "out_of_scope");
  eq(stage(t, "b7").stage ?? null, null, "rejected plans are left alone");
  eq(r.produced.length, 1); eq(calls.length, 1, "one article per tick");
});
Deno.test("an accepted plan is produced first, into a linked deliverable waiting for approval", async () => {
  const t = world(), calls: any[] = [];
  const r = await produce(fakeDb(t), writer(t, calls));
  eq(r.produced[0].brief, "b6"); eq(r.produced[0].lane, "approval");
  eq(stage(t, "b6").stage, "delivered"); eq(stage(t, "b6").deliverable_id, "art1");
  eq(stage(t, "art1").source_draft_id, "b6"); eq(stage(t, "art1").prepared_by, "system");
  eq(calls[0].kind, "Blog post"); eq(calls[0].title, "", "the headline comes from the article, not a working label");
  ok(calls[0].brief.includes("Existing article"), "existing topics are passed to avoid duplicates");
  eq(stage(t, "b1").stage, "queued", "the next brief waits for the next tick");
});
Deno.test("excluded wording in a plan never reaches the writer as usable copy", async () => {
  const t = world(), calls: any[] = []; t.drafts.find((d: any) => d.id === "b6").status = "rejected";
  await produce(fakeDb(t), writer(t, calls));
  ok(!/free shipping/i.test(calls[0].brief) && calls[0].brief.includes("[excluded wording]"), "banned phrase removed from the plan");
});
Deno.test("a failed article records its reason, retries later, then blocks; other work continues", async () => {
  const t = world(), calls: any[] = [];
  const r = await produce(fakeDb(t), writer(t, calls, 2)); // first brief fails its attempt and its rule-retry
  eq(r.failed.length, 1); eq(r.failed[0].final, false); eq(stage(t, "b6").stage, "queued"); eq(stage(t, "b6").blocker.code, "retrying");
  ok(Date.parse(stage(t, "b6").run_after) > Date.now(), "retry is delayed, not immediate");
  stage(t, "b6").run_after = null;
  const calls2: any[] = [], r2 = await produce(fakeDb(t), writer(t, calls2, 2));
  eq(r2.failed[0].final, true); eq(stage(t, "b6").stage, "blocked"); eq(stage(t, "b6").blocker.code, "production_failed");
  const calls3: any[] = [], r3 = await produce(fakeDb(t), writer(t, calls3));
  eq(r3.produced[0].brief, "b1", "the blocked brief does not hold up the next one");
});
Deno.test("production stops when the approval queue is full or the daily limit is reached", async () => {
  const t = world(), calls: any[] = [];
  for (let i = 0; i < LIMITS.maxAwaiting; i++) t.draft_pipeline.push({ draft_id: "w" + i, site_id: "shop", lane: "approval" });
  const r = await produce(fakeDb(t), writer(t, calls));
  eq(calls.length, 0); ok(/wait for approval/.test(r.skipped[0].why), "says why it paused");
  const t2 = world(), c2: any[] = [];
  t2.drafts.push({ id: "b8", site_id: "shop", kind: "Content brief", title: "Third plan", body: "z", status: "needs_review", created_at: "2026-11-06" });
  t2.playbook_runs.push({ draft_id: "b8", slug: "content-plan" }); t2.draft_pipeline.push({ draft_id: "b8", site_id: "shop", lane: "production", attempts: 0 });
  for (let i = 0; i < LIMITS.perSiteDaily; i++) await produce(fakeDb(t2), writer(t2, c2));
  t2.draft_pipeline.filter((r: any) => r.lane === "approval").forEach((r: any) => r.lane = "closed");
  const before = c2.length, r2 = await produce(fakeDb(t2), writer(t2, c2));
  eq(c2.length, before); ok(/daily production limit/.test(r2.skipped[0].why), "daily limit");
});
Deno.test("a worker that died mid-article is recovered without writing twice", async () => {
  const t = world(), calls: any[] = [];
  Object.assign(stage(t, "b6"), { stage: "producing", attempts: 1, updated_at: new Date(Date.now() - 30 * 60000).toISOString() });
  const r = await produce(fakeDb(t), writer(t, calls));
  eq(r.produced.length, 1); eq(calls.length, 1);
});

const ready = async () => { const t = world(), calls: any[] = []; await produce(fakeDb(t), writer(t, calls)); return t; };
const engineFixture = (t: any, calls: any[]) => async (b: any, asUser?: boolean) => {
  calls.push({ ...b, asUser: !!asUser });
  if (b.action === "publication_schedule") { t.drafts.find((d: any) => d.id === b.draft_id).status = "approved"; return { queued: true }; }
  if (b.action === "page_content_prepare") return { approval_hash: "live-page-hash" };
  if (b.action === "page_content_approve") { t.drafts.find((d: any) => d.id === b.draft_id).status = "approved"; return { queued: true }; }
  throw new Error("unexpected engine action");
};
Deno.test("one approval of the exact version queues publication once", async () => {
  const t = await ready(), calls: any[] = [], d = t.drafts.find((x: any) => x.id === "art1"), hash = await payloadHash(d.title, d.body);
  const r = await approve(fakeDb(t), { site_id: "shop", draft_id: "art1", payload_hash: hash }, { id: "u1", role: "owner" }, engineFixture(t, calls));
  eq(r.queued, true); eq(calls.length, 1); eq(calls[0].action, "publication_schedule");
  eq(calls[0].approved_hash, await copyHash(d.title, d.body)); eq(calls[0].blog_id, "gid://shopify/Blog/1");
  eq(t.client_reviews.length, 1); eq(t.client_reviews[0].user_id, "u1");
  const again = await approve(fakeDb(t), { site_id: "shop", draft_id: "art1", payload_hash: hash }, { id: "u1", role: "owner" }, engineFixture(t, calls));
  eq(again.already, true); eq(calls.length, 1, "a double click does not publish twice"); eq(t.client_reviews.length, 1);
});
Deno.test("an edited version cannot reuse an approval", async () => {
  const t = await ready(), calls: any[] = [], d = t.drafts.find((x: any) => x.id === "art1"), hash = await payloadHash(d.title, d.body);
  d.body += "\nA new claim.";
  await fails(() => approve(fakeDb(t), { site_id: "shop", draft_id: "art1", payload_hash: hash }, { id: "u1", role: "agency" }, engineFixture(t, calls)), /changed after you opened it/);
  eq(calls.length, 0);
});
Deno.test("work that is not ready, or a viewer, cannot approve", async () => {
  const t = await ready(), calls: any[] = [], h = await payloadHash("AI answer plan", t.drafts[0].body);
  await fails(() => approve(fakeDb(t), { site_id: "shop", draft_id: "b1", payload_hash: h }, { id: "u1", role: "owner" }, engineFixture(t, calls)), /not ready to publish/);
  const d = t.drafts.find((x: any) => x.id === "art1");
  const dh = await payloadHash(d.title, d.body);
  await fails(() => approve(fakeDb(t), { site_id: "shop", draft_id: "art1", payload_hash: dh }, { id: "u2", role: "viewer" }, engineFixture(t, calls)), /permission/);
  await fails(() => approve(fakeDb(t), { site_id: "noshop", draft_id: "art1", payload_hash: "x" }, { id: "u1", role: "owner" }, engineFixture(t, calls)), /no longer exists/);
  eq(calls.length, 0);
});
Deno.test("a page section is prepared against the live page and approved as the signed-in person", async () => {
  const t = await ready(), calls: any[] = [];
  t.drafts.push({ id: "faq1", site_id: "shop", kind: "FAQ section", title: "Questions", body: "Q and A", status: "needs_review" });
  t.draft_pipeline.push({ draft_id: "faq1", site_id: "shop", lane: "approval", ready: true, adapter: "shopify_page_section", payload_hash: await payloadHash("Questions", "Q and A"), reasons: [] });
  await approve(fakeDb(t), { site_id: "shop", draft_id: "faq1", payload_hash: await payloadHash("Questions", "Q and A") }, { id: "u1", role: "reviewer" }, engineFixture(t, calls));
  eq(calls.map((c) => c.action), ["page_content_prepare", "page_content_approve"]); eq(calls[1].approved_hash, "live-page-hash"); eq(calls[1].asUser, true);
});
Deno.test("hashes match the database gate and the engine", async () => {
  // Same bytes as goodbeat_private.payload_hash('Tïtle "q"', E'Body\nline — é'), checked against the live database.
  eq(await payloadHash('Tïtle "q"', "Body\nline — é"), "e27f20dc599ad9aabb8e56d580f301a3df72a68d0a54c9248d738d819fed8be2");
  eq(blockerFor("Content brief", "", { publishable: true }), null, "a hand-written brief is eligible");
});
