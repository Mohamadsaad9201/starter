# Samaritan: current state and capability matrix

Audited 2026-11-10 against the live Supabase project (`egtvvunkdkpqmfafhkjg`) and this repository. Status words:
`working_verified` (exercised in this audit or proven by production records), `implemented_unverified` (code read,
not exercised), `partial`, `missing`, `blocked` (needs a credential or connection), `not_applicable`.

Evidence types: **live** = query or call against production; **records** = existing production rows;
**fixture** = automated test with stand-in data; **code** = source read only.

## What changed in this pass

| Area | Before | Now |
|---|---|---|
| Client approval queue | Every draft with status `needs_review` counted: 128 items, 127 of them not publishable | Only work the database gate passes. HWD: 2. Every other business: 0, each with a recorded reason |
| Briefs and plans | Sat in the approval queue; "Approve" changed a status and nothing else | Production pipeline: classified, given an exact blocker, or finished into an article automatically |
| Approving | Owner approval set a status. Reviewer approval recorded a note. Neither published | One `approve` call binds the exact version, queues publish, verify and 28-day measure jobs |
| Direct status edits | A browser session could mark any draft approved | Refused by a trigger; approval must go through the endpoint |
| Counts | Each view filtered drafts its own way | One server-computed `lane` per draft plus `work_status()`; all views read those |

## Capability matrix

| Capability | Where it lives | Status | Evidence | Decision |
|---|---|---|---|---|
| Identity, roles (agency, owner, reviewer, viewer) | `goodbeat_private.workspace_role`, RLS, `app_admins`, `workspace_access` | working_verified | live: privilege checks; non-member call to `work_status` denied | reuse |
| Business context, voice, excluded phrases | `sites.profile`, `sites.brand`, `business_corrections`, `confirm_intake_profile` (revision-checked) | partial | code; records | reuse. No per-fact source, confirmation state or expiry yet |
| Focus and goals | `business_priorities` (objective, location, target date, measure, status) | implemented_unverified | code; 0 rows in production | reuse. No automatic expiry of a past target date |
| Connections | `connectors`, `nango_connections`, `channel_syncs`; engine `healthCheck` separates access from data freshness | working_verified for Shopify (HWD, checked 2026-11-10) | records | reuse |
| Search Console, Google Ads, Meta Ads | `connect` function OAuth, engine `gsc_sync`, `ads_*` | blocked | live: no business has any of the three connected | connect accounts |
| Per-operation capability record | none as a table. The gate knows two adapters: `shopify_article`, `shopify_page_section` | partial | code | extend when a third adapter exists |
| Durable jobs (dedupe key, lease, heartbeat, bounded retry, cancel) | `operation_jobs`, `claim_operation_job`, `schedule_operations`, engine `runOperation` | working_verified | records: 226 jobs across all states; code. Not crash-tested in this pass | reuse |
| Readiness gate | `draft_pipeline`, `goodbeat_private.evaluate_draft` + triggers | working_verified | live: 15 contract checks run in a rolled-back transaction | new |
| Production pipeline (brief to finished article) | `playbooks` function `produce`, cron `playbooks-produce` | working_verified | live: one HWD plan became a finished article that passed the gate; fixture: 6 tests | new |
| Approval endpoint | `playbooks` function `approve` | implemented_unverified live; working in fixture | fixture: 5 tests + browser test. No live approval was made: that decision belongs to a signed-in person | new |
| Article publish, verify, measure | engine `publication_schedule`, `blog_publish`, `publication_verify`, `content_measure`; `content_publications` | working_verified | records: 10 HWD articles published, all 10 `verified` on the public page | reuse |
| Page section publish, readback, public check, rollback | engine `page_content_*`; `page_content_publications` | partial | records: 2 published (1 verified, 1 platform-verified), 3 `uncertain` with "Provider readback does not confirm the approved change" | repair: see limitations |
| Metadata fixes (title, description, alt) apply, verify, roll back | `fixes`, engine `publish`/`apply`/`verifyBatch`, `owner_decide_fix` | working_verified | records: 145 deployed fixes | reuse |
| Existing-page rewrites as measured experiments | `search_experiments`, engine `search_experiment_*` | implemented_unverified | code; 0 rows (needs Search Console) | reuse |
| Website field edits (Framer and others) | `website_changes`, engine `website_*` | implemented_unverified | code; 0 rows | reuse |
| Paid: account sync, pause/resume with approval hash and spend controls | `ad_reports`, `ad_changes`, `ad_controls`, engine `ads_*` | blocked | code; 0 rows, no ad account connected | reuse. Creating campaigns or ads is not implemented |
| AI visibility: observed answers per engine and prompt | `aeo_runs`, `aeo_checks`, `ai_claims` | working_verified | records: 22 runs, about 1,400 checks | reuse |
| Local SEO: profile reads and writes | none | missing | no Business Profile connector | not built |
| Scheduling | pg_cron (21 jobs) + `schedule_operations` dedupe keys per day or ISO week | working_verified | live: cron list; records | reuse |
| Outcome follow-up | `content_measure` (28 days after publish), `playbook_runs.measure` baseline and after-snapshot | implemented_unverified | records: 10 measure jobs queued, none due yet | reuse |
| Activity feed from real records | `buildEvents` in `app.js` | working_verified | fixture: browser test sees ready, published and verified events | extended |
| One count on every surface | `lane` per draft, `work_status()`, `client_workspace().work` | working_verified for content | live: agency query and RPC both return 2 for HWD; fixture: three roles agree | new. Website fixes still use the browser's `readyFix` rule next to the SQL rule in `owner_decide_fix` |
| Chat answers grounded in the same data | `ask`, `samaritan`, `team-chat` functions | not audited | source not read in this pass | audit next |
| Metric definitions (revenue, spend, ROAS) | `marketing_metrics` RPC, engine `marketing-metrics.ts` | not audited | | audit next |

## Blockers recorded per business

`draft_pipeline.blocker` holds the exact reason for every brief that cannot move. Totals on 2026-11-10:

| Reason | Count | What clears it |
|---|---|---|
| No connection that can publish articles (6 of 7 businesses) | 71 briefs | Connect a Shopify store with content permission. Two businesses have Framer, which here supports field edits only |
| No adapter for the kind (campaign briefs, offers, landing pages, homepage and about pages, product descriptions) | 24 | Needs a new adapter: creating campaigns or pages is not implemented |
| Brief recommends changes to existing pages or site settings | 5 | Carried out by the team; only new articles and added sections publish from here |
| Email, SMS, social | 2 | Out of scope; these playbooks no longer run automatically |
| Finished article or page section with nowhere to publish (shown as "needs attention") | 38 | Same connection as the first row. 11 of them also carry an internal working title and should be regenerated |

Also on that date: 3 accepted HWD plans queued for production, 1 delivered, 2 items awaiting approval (both HWD).

Query: `select blocker->>'code', count(*) from draft_pipeline where stage='blocked' group by 1;`

## Source reuse ledger

No code was copied from the eight source archives: none were available in this session. The behaviour was built on
existing components. `supabase/deployed/engine-v62/` is the project's own deployed engine, saved for audit.
`vendor/marketingskills` (MIT) and `vendor/seo-agents` were integrated earlier as playbook guidance.

## Known limitations

- **No live approval was performed.** Approval must come from a signed-in person. Everything up to the approval is
  live on HWD; the steps after it are proven by 10 earlier verified publications and by fixture tests.
- **Three HWD page sections are `uncertain`** (two collections and one product). Shopify did not read back the exact
  HTML that was sent, most likely because it normalises markup. They need a manual look; the engine will not retry.
- **Four HWD articles published on 2026-11-09 carry an internal working title** ("Article AI assistants will quote:
  ..."). They are live. The cause is fixed for new work; the live titles need editing in Shopify.
- The HWD reviewer has not confirmed an account, so the client role was tested with fixtures, not live.
- One finished article per brief. A plan that calls for six articles yields the first; the rest need a later pass.
- The engine's source is not deployable from this repository yet (see `supabase/deployed/engine-v62/README.md`).
