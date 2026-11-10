-- Approval means execution. A browser session can no longer mark a draft approved directly: approval goes through the
-- playbooks function's `approve` action, which checks the readiness gate and queues the publish + verify jobs.
create or replace function public.refresh_draft_gate(p_id uuid) returns void
language sql security definer set search_path to '' as $$ select goodbeat_private.evaluate_draft(p_id); $$;
revoke all on function public.refresh_draft_gate(uuid) from public, anon, authenticated;
grant execute on function public.refresh_draft_gate(uuid) to service_role;

create or replace function goodbeat_private.guard_draft_approval() returns trigger
language plpgsql set search_path to '' as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' and coalesce(auth.role(), '') = 'authenticated' then
    raise exception 'Approve from the review queue so this work is published and verified.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_draft_approval on public.drafts;
create trigger guard_draft_approval before update of status on public.drafts
  for each row execute function goodbeat_private.guard_draft_approval();

-- Owners still reject and restore here; approving is the approve action's job.
create or replace function public.owner_decide_draft(p_site text, p_id uuid, p_decision text) returns boolean
language plpgsql security definer set search_path to '' as $$
begin
  if auth.uid() is null or goodbeat_private.workspace_role(p_site) is distinct from 'owner' then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_decision = 'approved' then raise exception 'Approve from the review queue so this work is published and verified.'; end if;
  if p_decision not in ('rejected', 'needs_review') then raise exception 'Invalid decision'; end if;
  update public.drafts set status = p_decision, decided_at = case when p_decision = 'needs_review' then null else now() end
   where id = p_id and site_id = p_site and status = case when p_decision = 'rejected' then 'needs_review' else 'rejected' end;
  return found;
end $$;

-- The client workspace carries the gate's verdict, publishing state and the shared counts, so every surface reads
-- the same records.
create or replace function goodbeat_private.client_workspace(p_site text) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
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
 'drafts',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from (
   select d.id,d.workspace,d.title,d.kind,d.body,d.status,d.ranking_hold,d.created_at,d.decided_at,
          p.lane,p.ready,p.adapter,p.payload_hash,p.reasons,p.stage,p.blocker,p.prepared_by,p.checked_at,p.source_draft_id,p.deliverable_id
   from public.drafts d left join public.draft_pipeline p on p.draft_id=d.id
   where d.site_id=p_site order by (p.lane='approval') desc nulls last, d.created_at desc limit 100) d),
 'publications',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
   select draft_id,'article' as kind,status,published_at,verification->>'state' as verification,verification->>'url' as url,error from public.content_publications where site_id=p_site
   union all
   select draft_id,'section',status,published_at,verification->>'state',url,error from public.page_content_publications where site_id=p_site) x),
 'jobs',(select coalesce(jsonb_agg(to_jsonb(j)),'[]') from (
   select payload->>'draft_id' as draft_id,kind,status,run_after,finished_at from public.operation_jobs
   where site_id=p_site and kind in ('blog_publish','page_content_publish','publication_verify','page_content_verify') order by created_at desc limit 200) j),
 'work',public.work_status(p_site),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select id,kind,priority,target,before,after,note,status from public.tasks where site_id=p_site limit 100) t),
 'daily',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from (select date,clicks,impressions,ctr,position from public.gsc_daily where site_id=p_site order by date desc limit 56) g),
 'connectors',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'type',type,'status',status,'last_checked_at',last_checked_at,'last_error',last_error,
     'config',case when goodbeat_private.workspace_role(p_site) = 'owner' then jsonb_strip_nulls(jsonb_build_object('property',config->'property','account',config->'account','shop',config->'shop','connectionStage',config->'connectionStage')) end)),'[]') from public.connectors where site_id=p_site),
 'reviews',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select item_kind,item_id,decision,snapshot,created_at from public.client_reviews where site_id=p_site order by created_at desc limit 200) r)
 );
end;$$;

-- Production worker: every 10 minutes, classify briefs and finish one eligible brief into a deliverable.
select cron.unschedule(jobid) from cron.job where jobname = 'playbooks-produce';
select cron.schedule('playbooks-produce', '*/10 * * * *', $job$
  select net.http_post(
    url := 'https://egtvvunkdkpqmfafhkjg.supabase.co/functions/v1/playbooks',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-engine-key', (select decrypted_secret from vault.decrypted_secrets where name = 'engine_cron_key')),
    body := '{"action":"produce"}'::jsonb,
    timeout_milliseconds := 300000);
$job$);
