-- Dry-run results of the Paid Ads Agent. Service-role only (RLS on, no policies).
create table if not exists public.paid_agent_runs (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites(id) on delete cascade,
  connector_id uuid references public.connectors(id) on delete set null,
  observation_id uuid,
  mode text not null default 'dry_run' check (mode in ('dry_run', 'live')),
  status text not null default 'running' check (status in ('running', 'completed', 'incomplete', 'failed')),
  model text,
  result jsonb,
  trace jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists paid_agent_runs_site_idx on public.paid_agent_runs (site_id, created_at desc);
alter table public.paid_agent_runs enable row level security;
