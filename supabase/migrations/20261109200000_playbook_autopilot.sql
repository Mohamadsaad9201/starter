-- Autopilot: the playbooks function prepares evidence-backed work every hour for every active business and
-- measures it 28 days later. Per business: up to 3 runs an hour, 10 a day by default (profile.autopilot.daily,
-- max 60; profile.autopilot.enabled = false turns it off), paused while 30 automatic drafts wait for review.
alter table public.playbook_runs
  add column if not exists auto boolean not null default false,
  add column if not exists measure jsonb,
  add column if not exists review_at timestamptz,
  add column if not exists measured_at timestamptz;
create index if not exists playbook_runs_site_created on public.playbook_runs (site_id, created_at desc);
create index if not exists playbook_runs_review on public.playbook_runs (review_at) where measured_at is null;

-- Hourly, 8am to 7pm Detroit (12:35 to 23:35 UTC).
select cron.unschedule(jobid) from cron.job where jobname = 'playbooks-autopilot';
select cron.schedule('playbooks-autopilot', '35 12-23 * * *', $job$
  select net.http_post(
    url := 'https://egtvvunkdkpqmfafhkjg.supabase.co/functions/v1/playbooks',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-engine-key', (select decrypted_secret from vault.decrypted_secrets where name = 'engine_cron_key')),
    body := '{"action":"autopilot"}'::jsonb,
    timeout_milliseconds := 120000);
$job$);
