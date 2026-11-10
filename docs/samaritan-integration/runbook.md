# Runbook: production pipeline and approvals

## How work moves

1. **Brief or plan** is written (autopilot, a playbook, or a person). The gate files it under `production`.
2. **Production worker** (`playbooks` action `produce`, every 10 minutes) classifies it. Either it records a blocker,
   or it queues the brief and, one per tick, has the engine research and write a complete article from it.
3. **Gate** (`evaluate_draft`) checks the article: connection, destination blog, length and headings, no placeholder,
   no unresolved owner fact, real headline, no evidence hold, no earlier publishing record. Pass means `approval`.
4. **One approval** (`playbooks` action `approve`) by an agency member, owner or reviewer. The request must carry the
   payload hash of the version on screen.
5. **Engine jobs** publish, read back, fetch the public page, and 28 days later record search clicks.

Limits: 2 finished articles per business per day; production pauses while 5 items wait for approval; 2 attempts per
brief, 6 hours apart.

## Commands

Run the production worker once (optionally for one business):

```sql
select net.http_post(url := 'https://egtvvunkdkpqmfafhkjg.supabase.co/functions/v1/playbooks',
  headers := jsonb_build_object('Content-Type','application/json','x-engine-key',
    (select decrypted_secret from vault.decrypted_secrets where name = 'engine_cron_key')),
  body := '{"action":"produce","site_id":"hwd"}'::jsonb, timeout_milliseconds := 290000);
```

See what is waiting, in production or blocked:

```sql
select d.title, d.kind, p.lane, p.stage, p.blocker->>'detail' as blocker, p.reasons
from draft_pipeline p join drafts d on d.id = p.draft_id
where p.site_id = 'hwd' and p.lane <> 'closed' order by p.lane, d.created_at;
```

Retry a brief whose production failed twice:

```sql
update draft_pipeline set stage = 'queued', attempts = 0, blocker = null, run_after = null where draft_id = '<id>';
```

Follow one approved item from approval to verification:

```sql
select 'approval' step, created_at at, decision info from client_reviews where item_id = '<draft id>'
union all select 'job '||kind, coalesce(finished_at, run_after), status from operation_jobs where payload->>'draft_id' = '<draft id>'
union all select 'publication', published_at, status||' / '||coalesce(verification->>'state','not checked') from content_publications where draft_id = '<draft id>'
order by at;
```

Pause production: `select cron.unschedule('playbooks-produce');`. Pause all engine jobs for one business:
set `automation_policies.paused = true`.

## When something fails

- **Publication `uncertain` or `failed`**: the engine never retries a write it cannot confirm. Check the article or
  page in Shopify, then either delete the publishing record (nothing went live) or leave it (it did).
- **Connection lost**: ready work moves to `attention` on its own and returns when the connector is `connected` again.
- **Verification `mismatch`**: the platform holds different content from the approved version. Compare
  `page_content_publications.after_html` with the live page before any rollback.

## Rollback of this change

```sql
select cron.unschedule('playbooks-produce');
drop trigger if exists guard_draft_approval on drafts;
drop trigger if exists draft_pipeline_evaluate on drafts;
drop trigger if exists pipeline_topic_link on content_topics;
drop trigger if exists pipeline_opportunity_link on opportunities;
drop trigger if exists pipeline_connector_change on connectors;
drop trigger if exists pipeline_publication_change on content_publications;
drop trigger if exists pipeline_page_publication_change on page_content_publications;
-- draft_pipeline can stay; nothing else reads it once the frontend is reverted.
```

Then redeploy `playbooks` from commit `345e9b4` and the previous frontend. `client_workspace` only gained fields, so it
does not need reverting. No draft, publication or client data was changed or removed by this work.

## Tests

```bash
deno test supabase/functions/playbooks/pipeline_test.ts
```

```bash
node tests/e2e/pipeline-flow.js
```

The database gate checks are in `docs/samaritan-integration/gate-checks.sql`. They end by raising, so nothing persists.
