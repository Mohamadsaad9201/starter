-- Playbook library for the `playbooks` edge function (same content as the site's playbooks.json).
-- Stored in the database so new playbooks don't wait for a website deploy. Service role only.
create table if not exists public.playbook_library (
  id int primary key default 1 check (id = 1),
  version text not null,
  library jsonb not null,
  source text,
  updated_at timestamptz not null default now()
);
alter table public.playbook_library enable row level security;
revoke all on public.playbook_library from anon, authenticated;

-- Refresh after `node tools/build-playbooks.mjs` and a push (use the pushed commit SHA):
--   select net.http_get('https://raw.githubusercontent.com/Mohamadsaad9201/starter/<sha>/playbooks.json') as req;
--   insert into public.playbook_library (id, version, library, source)
--   select 1, content::jsonb->>'version', content::jsonb, '<sha>' from net._http_response where id = <req> and status_code = 200
--   on conflict (id) do update set version = excluded.version, library = excluded.library, source = excluded.source, updated_at = now();
