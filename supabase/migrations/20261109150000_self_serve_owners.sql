-- Self-serve sign-up: business owners create their own workspace from the public sign-up page.
--
-- * workspace_access gains the 'owner' role (in addition to viewer / reviewer).
-- * signup_analyses holds a visitor's pre-account analysis (site read + AI research) under a random token.
--   Only the service role (the `signup` edge function) touches it: RLS on, no policies.
-- * my_workspace_role(): lets edge functions check the caller's role for a business.
-- * owner_decide_fix / owner_decide_draft: owners approve, skip or roll back their own work. Approved fixes
--   go through the same engine `apply` path the agency uses; the evidence hold the app shows is enforced here too.
-- * client_review accepts owners; client_workspace returns the fields the review queue needs
--   (supersedes 20261109120000_client_workspace_review_fields.sql, which is folded in here).

-- 1. Owner role
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.workspace_access'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%viewer%reviewer%';
  if c is not null then execute format('alter table public.workspace_access drop constraint %I', c); end if;
end $$;
alter table public.workspace_access add constraint workspace_access_role_check check (role in ('viewer', 'reviewer', 'owner'));

-- 2. Pre-account analyses
create table if not exists public.signup_analyses (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  domain text not null,
  ip_hash text not null,
  status text not null default 'reading' check (status in ('reading', 'researching', 'ready', 'failed')),
  site jsonb,
  research jsonb,
  error text,
  claimed_by uuid references auth.users(id),
  claimed_site text references public.sites(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists signup_analyses_ip_created on public.signup_analyses (ip_hash, created_at desc);
create index if not exists signup_analyses_domain_created on public.signup_analyses (domain, created_at desc);
alter table public.signup_analyses enable row level security;
revoke all on public.signup_analyses from anon, authenticated;

-- 3. Role lookup for edge functions (runs as the caller)
create or replace function public.my_workspace_role(p_site text)
 returns text language sql stable security definer set search_path to ''
as $$ select goodbeat_private.workspace_role(p_site) $$;
revoke all on function public.my_workspace_role(text) from public, anon;
grant execute on function public.my_workspace_role(text) to authenticated;

-- 4. Owner decisions on website fixes
create or replace function public.owner_decide_fix(p_site text, p_ids text[], p_decision text)
 returns integer language plpgsql security definer set search_path to ''
as $$
declare n integer := 0; key text;
begin
  if auth.uid() is null or goodbeat_private.workspace_role(p_site) is distinct from 'owner' then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected', 'rollback_requested') then raise exception 'Invalid decision'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 100 then raise exception 'Choose between 1 and 100 changes'; end if;

  if p_decision = 'rollback_requested' then
    update public.fixes f set status = 'rollback_requested', decided_at = now(),
           data = coalesce(f.data, '{}'::jsonb) || jsonb_build_object('rollback_requested_by', auth.uid())
     where f.site_id = p_site and f.id = any(p_ids) and f.status = 'deployed';
  elsif p_decision = 'rejected' then
    update public.fixes f set status = 'rejected', decided_at = now(),
           data = coalesce(f.data, '{}'::jsonb) || jsonb_build_object('decided_by', auth.uid())
     where f.site_id = p_site and f.id = any(p_ids) and f.status = 'pending';
  else
    -- Same gate as the app's readyFix()/searchReviewHold(): released today or earlier, not part of an experiment,
    -- and search titles only with a current evidence review. Meta descriptions stay out of ranking decisions.
    update public.fixes f set status = 'approved', decided_at = now(),
           data = coalesce(f.data, '{}'::jsonb) || jsonb_build_object('approved_by', auth.uid(), 'approved_via', 'owner')
     where f.site_id = p_site and f.id = any(p_ids) and f.status = 'pending'
       and coalesce(f.data->>'released_on', '') <> ''
       and f.data->>'experiment_id' is null
       and f.field <> 'seo.description'
       and (f.field <> 'seo.title' or (
             f.data->'search_strategy'->>'version' = '2026-11-05.2'
         and f.data->'search_strategy'->>'decision' = 'draft_for_review'
         and coalesce(f.data->'search_strategy'->>'ranking_mechanism', '') <> ''
         and case when f.data->'search_strategy'->>'reviewed_at' ~ '^\d{4}-\d{2}-\d{2}T'
                  then (f.data->'search_strategy'->>'reviewed_at')::timestamptz > now() - interval '7 days' else false end
         and (coalesce(trim(f.before), '') = '' or (f.data->'search_strategy'->>'rewrite' = 'true'
              and case when jsonb_typeof(f.data->'search_strategy'->'defects') = 'array'
                       then jsonb_array_length(f.data->'search_strategy'->'defects') > 0 else false end))));
  end if;
  get diagnostics n = row_count;

  if n > 0 and p_decision <> 'rejected' then
    -- Apply now through the agency's publish path instead of waiting for the 10-minute job.
    select decrypted_secret into key from vault.decrypted_secrets where name = 'engine_cron_key';
    perform net.http_post(
      url := 'https://egtvvunkdkpqmfafhkjg.supabase.co/functions/v1/engine',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-engine-key', key),
      body := jsonb_build_object('action', 'apply', 'site_id', p_site),
      timeout_milliseconds := 120000);
  end if;
  return n;
end $$;
revoke all on function public.owner_decide_fix(text, text[], text) from public, anon;
grant execute on function public.owner_decide_fix(text, text[], text) to authenticated;

-- 5. Owner decisions on drafts
create or replace function public.owner_decide_draft(p_site text, p_id uuid, p_decision text)
 returns boolean language plpgsql security definer set search_path to ''
as $$
begin
  if auth.uid() is null or goodbeat_private.workspace_role(p_site) is distinct from 'owner' then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected', 'needs_review') then raise exception 'Invalid decision'; end if;
  update public.drafts set status = p_decision, decided_at = case when p_decision = 'needs_review' then null else now() end
   where id = p_id and site_id = p_site and status in ('needs_review', 'approved', 'rejected');
  return found;
end $$;
revoke all on function public.owner_decide_draft(text, uuid, text) from public, anon;
grant execute on function public.owner_decide_draft(text, uuid, text) to authenticated;

-- 6. Client reviews: owners may record decisions too
create or replace function goodbeat_private.client_review(p_site text, p_kind text, p_id text, p_decision text, p_snapshot jsonb)
 returns uuid language plpgsql security definer set search_path to ''
as $function$
declare current_copy jsonb; result uuid;
begin
 if auth.uid() is null or coalesce(goodbeat_private.workspace_role(p_site),'') not in ('agency','reviewer','owner') then raise exception 'Reviewer access required' using errcode='42501'; end if;
 if p_decision not in ('approved','changes_requested') then raise exception 'Invalid decision'; end if;
 if p_kind='fix' then
  select jsonb_build_object('before',f.before,'after',f.after,'field',f.field) into current_copy from public.fixes f where f.id::text=p_id and f.site_id=p_site and f.status='pending' for update;
 elsif p_kind='draft' then
  select jsonb_build_object('title',d.title,'body',d.body) into current_copy from public.drafts d where d.id::text=p_id and d.site_id=p_site and d.status='needs_review' for update;
 else raise exception 'Invalid item kind'; end if;
 if current_copy is null or current_copy is distinct from p_snapshot then raise exception 'This item changed. Reload and review the latest version.'; end if;
 insert into public.client_reviews(site_id,item_kind,item_id,decision,snapshot,user_id) values(p_site,p_kind,p_id,p_decision,current_copy,auth.uid()) returning id into result;
 -- Deliberately does not change publishing status: execution remains separate.
 return result;
end;$function$;

-- 7. Client workspace: review fields for fixes, workspace for drafts, the business profile for owners
create or replace function goodbeat_private.client_workspace(p_site text)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
 if auth.uid() is null or goodbeat_private.workspace_role(p_site) is null then raise exception 'Workspace access denied' using errcode='42501'; end if;
 return jsonb_build_object(
 'role',goodbeat_private.workspace_role(p_site),
 'profile',(select case when goodbeat_private.workspace_role(p_site) = 'owner' then s.profile end from public.sites s where s.id = p_site),
 'fixes',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from (
   select id,field,page_name,url,before,after,status,priority,deployed_at,decided_at,
          data->'verification' as verification,
          jsonb_strip_nulls(jsonb_build_object(
            'released_on', data->'released_on', 'search_strategy', data->'search_strategy',
            'experiment_id', data->'experiment_id', 'failedOperation', data->'failedOperation',
            'verification', data->'verification')) as data
   from public.fixes where site_id=p_site and status<>'superseded' order by created_at desc limit 500) f),
 'drafts',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from (select id,workspace,title,kind,body,status,ranking_hold,created_at,decided_at from public.drafts where site_id=p_site order by created_at desc limit 100) d),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select id,kind,priority,target,before,after,note,status from public.tasks where site_id=p_site limit 100) t),
 'daily',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from (select date,clicks,impressions,ctr,position from public.gsc_daily where site_id=p_site order by date desc limit 56) g),
 'connectors',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'type',type,'status',status,'last_checked_at',last_checked_at,'last_error',last_error,
     'config',case when goodbeat_private.workspace_role(p_site) = 'owner' then jsonb_strip_nulls(jsonb_build_object('property',config->'property','account',config->'account','shop',config->'shop','connectionStage',config->'connectionStage')) end)),'[]') from public.connectors where site_id=p_site),
 'reviews',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select item_kind,item_id,decision,snapshot,created_at from public.client_reviews where site_id=p_site order by created_at desc limit 200) r)
 );
end;$function$;
