# Platform integration: Paid Ads Agent

Code that runs inside the agency platform's Supabase project (`ots-seo-engine`).

- `supabase/functions/paid-agent/` - the Paid Ads Agent as a separate edge function.
  - `agent.ts` - Claude tool loop (claude-opus-5-5). Tools: saved account observation, read-only GAQL,
    landing-page check (client's own domain only), expert playbooks (marketingskills, pinned commit),
    `check_action` (the engine's own `validatePaidCandidate` rules) and `submit`.
  - `google.ts` - read-only Google Ads access using the connector's OAuth refresh token. No mutate path.
  - `validate.ts` - verbatim copy of the engine's validation rules.
  - `index.ts` - dry-run harness: runs the agent for one `site_id`, stores the result in `paid_agent_runs`.
    It never creates proposals or writes to Google Ads. Auth: `x-engine-key`.
- `supabase/migrations/` - the `paid_agent_runs` table (service-role only).

Trigger a dry run from SQL:

    select net.http_post(
      url := 'https://<project>.supabase.co/functions/v1/paid-agent',
      headers := jsonb_build_object('Content-Type','application/json','x-engine-key',public.get_engine_key()),
      body := jsonb_build_object('site_id','<site id>'));

Then read `select * from paid_agent_runs order by created_at desc limit 1;`.

Next step once dry runs look right: in `engine/paid-cycle.ts`, replace the single `deps.ai(...)` specialist call
with `runPaidAgent(...)` and feed `approved_candidates` into the existing `googleWorkAction` prepare path, behind a
per-site flag. Everything after that (Google validation, approval hash, scope checks, Approvals UI) stays as is.
