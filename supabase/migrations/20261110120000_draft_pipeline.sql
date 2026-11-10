-- Production pipeline and approval-readiness gate.
--
-- One row per draft. `lane` decides which surface a draft belongs to and is computed only here, in the database:
--   approval    complete, validated and executable through a connected adapter; waiting for one decision
--   production  not executable as it stands (a brief or plan, or content that needs more work)
--   attention   an executable kind that an outside dependency blocks (connection, destination, evidence hold)
--   closed      already decided
-- Nothing in the app or in an agent can set a lane: the table has no write policy, and evaluate_draft() recomputes
-- it whenever the draft, its destination, its publishing record or the business's connections change.
create table if not exists public.draft_pipeline (
  draft_id uuid primary key references public.drafts(id) on delete cascade,
  site_id text not null,
  lane text not null check (lane in ('approval', 'production', 'attention', 'closed')),
  ready boolean not null default false,
  adapter text,
  reasons jsonb not null default '[]'::jsonb,
  payload_hash text,
  checked_at timestamptz not null default now(),
  prepared_by text not null default 'agency',
  source_run text,
  source_draft_id uuid,
  deliverable_id uuid,
  stage text check (stage in ('queued', 'producing', 'delivered', 'blocked')),
  blocker jsonb,
  attempts integer not null default 0,
  run_after timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists draft_pipeline_site_lane on public.draft_pipeline (site_id, lane);
alter table public.draft_pipeline enable row level security;
revoke all on public.draft_pipeline from anon, authenticated;
grant select on public.draft_pipeline to authenticated;
drop policy if exists draft_pipeline_read on public.draft_pipeline;
create policy draft_pipeline_read on public.draft_pipeline for select to authenticated
  using (public.my_workspace_role(site_id) in ('agency', 'owner', 'reviewer', 'viewer'));

create or replace function goodbeat_private.payload_hash(p_title text, p_body text) returns text
language sql immutable set search_path to '' as $$
  select encode(sha256(convert_to(coalesce(p_title, '') || E'\n' || coalesce(p_body, ''), 'UTF8')), 'hex');
$$;

create or replace function goodbeat_private.evaluate_draft(p_id uuid) returns void
language plpgsql security definer set search_path to '' as $$
declare
  d public.drafts; why jsonb := '[]'::jsonb; v_adapter text; v_lane text; v_ready boolean := false;
  shop boolean; blog text; external boolean := false; prepared text := 'agency'; run_ref text;
begin
  select * into d from public.drafts where id = p_id;
  if not found then return; end if;

  select 'system', 'playbook:' || r.id::text into prepared, run_ref from public.playbook_runs r
   where r.draft_id = d.id::text and r.auto order by r.created_at desc limit 1;
  if prepared is null then
    select 'system', 'topic:' || t.id::text into prepared, run_ref from public.content_topics t where t.draft_id = d.id limit 1;
  end if;
  prepared := coalesce(prepared, 'agency');

  if d.status <> 'needs_review' then
    v_lane := 'closed';
  else
    shop := exists (select 1 from public.connectors c where c.site_id = d.site_id and c.type = 'shopify' and c.status = 'connected');
    if d.kind = 'Blog post' then
      v_adapter := 'shopify_article';
      select coalesce(s.profile #>> '{publishing,blog_id}',
               (select p.blog_id from public.content_publications p where p.site_id = d.site_id and p.blog_id is not null order by p.created_at desc limit 1))
        into blog from public.sites s where s.id = d.site_id;
      if not shop then external := true; why := why || jsonb_build_object('code', 'no_publishing_connection', 'detail', 'No connected Shopify store with article publishing for this business.'); end if;
      if shop and blog is null then external := true; why := why || jsonb_build_object('code', 'no_destination', 'detail', 'No destination blog is set for this business.'); end if;
      if exists (select 1 from public.content_publications p where p.draft_id = d.id) then
        external := true; why := why || jsonb_build_object('code', 'has_publishing_record', 'detail', 'This article already has a publishing record. Check its status.');
      end if;
      if length(coalesce(d.body, '')) < 1200 or d.body !~ '(^|\n)#{1,3} ' then
        why := why || jsonb_build_object('code', 'incomplete', 'detail', 'The article is too short or has no headings.');
      end if;
      if d.title ~* '^(seo article: built to rank|article ai assistants will quote|playbook:)' or d.title ~* ':\s*(topic|target question):' then
        why := why || jsonb_build_object('code', 'working_title', 'detail', 'The title is an internal working label, not the article headline.');
      end if;
    elsif d.kind = 'FAQ section' then
      v_adapter := 'shopify_page_section';
      if not shop then external := true; why := why || jsonb_build_object('code', 'no_publishing_connection', 'detail', 'No connected Shopify store for this business.'); end if;
      if not exists (
           select 1 from public.content_topics t join public.pages p on p.site_id = t.site_id and p.url = t.target_url
            where t.draft_id = d.id and p.kind in ('product', 'collection', 'page') and p.key ~ '^shopify:gid://shopify/(Product|Collection|Page)/[0-9]+$')
         and not exists (select 1 from public.opportunities o where o.draft_id = d.id and o.publishable) then
        external := true; why := why || jsonb_build_object('code', 'no_destination', 'detail', 'No supported destination page is linked to this section.');
      end if;
      if exists (select 1 from public.page_content_publications p where p.draft_id = d.id and p.status not in ('prepared', 'blocked')) then
        external := true; why := why || jsonb_build_object('code', 'has_publishing_record', 'detail', 'This section already has a publishing record. Check its status.');
      end if;
      if length(coalesce(d.body, '')) < 200 then why := why || jsonb_build_object('code', 'incomplete', 'detail', 'The section is too short.'); end if;
    else
      why := why || jsonb_build_object('code', 'no_execution_adapter', 'detail', d.kind || ' has no publishing adapter. It stays in production until it becomes a deliverable that can be published.');
    end if;

    if v_adapter is not null then
      if d.ranking_hold is not null then external := true; why := why || jsonb_build_object('code', 'evidence_hold', 'detail', 'Held pending ranking evidence.'); end if;
      if d.body ~* '(\[(insert|todo|tbd|placeholder|link here|citation needed)|\{\{|lorem ipsum|\mTK\M|X{3,})' then
        why := why || jsonb_build_object('code', 'placeholder', 'detail', 'The copy still contains a placeholder.');
      end if;
      if d.body ~* '(owner to confirm|needs (owner |client )?confirmation|to be confirmed|\[confirm|open questions? for (the )?(owner|client|business))' then
        why := why || jsonb_build_object('code', 'unresolved_fact', 'detail', 'A fact in the copy still needs the owner''s confirmation.');
      end if;
    end if;

    v_ready := v_adapter is not null and jsonb_array_length(why) = 0;
    v_lane := case when v_ready then 'approval' when v_adapter is not null and external then 'attention' else 'production' end;
  end if;

  insert into public.draft_pipeline as p (draft_id, site_id, lane, ready, adapter, reasons, payload_hash, checked_at, prepared_by, source_run, updated_at)
  values (d.id, d.site_id, v_lane, v_ready, v_adapter, why, goodbeat_private.payload_hash(d.title, d.body), now(), prepared, run_ref, now())
  on conflict (draft_id) do update set lane = excluded.lane, ready = excluded.ready, adapter = excluded.adapter, reasons = excluded.reasons,
    payload_hash = excluded.payload_hash, checked_at = excluded.checked_at, prepared_by = excluded.prepared_by,
    source_run = coalesce(excluded.source_run, p.source_run), updated_at = now();
end $$;
revoke all on function goodbeat_private.evaluate_draft(uuid) from public, anon, authenticated;

create or replace function goodbeat_private.pipeline_draft_changed() returns trigger
language plpgsql security definer set search_path to '' as $$
begin perform goodbeat_private.evaluate_draft(new.id); return null; end $$;
drop trigger if exists draft_pipeline_evaluate on public.drafts;
create trigger draft_pipeline_evaluate after insert or update of title, body, kind, status, ranking_hold on public.drafts
  for each row execute function goodbeat_private.pipeline_draft_changed();

create or replace function goodbeat_private.pipeline_link_changed() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if tg_table_name = 'connectors' then
    perform goodbeat_private.evaluate_draft(d.id) from public.drafts d
      where d.site_id = (case when tg_op = 'DELETE' then old.site_id else new.site_id end) and d.status = 'needs_review';
  elsif tg_table_name in ('content_publications', 'page_content_publications') then
    perform goodbeat_private.evaluate_draft(new.draft_id);
  elsif new.draft_id is not null then
    perform goodbeat_private.evaluate_draft(new.draft_id);
  end if;
  return null;
end $$;
drop trigger if exists pipeline_topic_link on public.content_topics;
create trigger pipeline_topic_link after insert or update of draft_id, target_url on public.content_topics
  for each row execute function goodbeat_private.pipeline_link_changed();
drop trigger if exists pipeline_opportunity_link on public.opportunities;
create trigger pipeline_opportunity_link after insert or update of draft_id, publishable on public.opportunities
  for each row execute function goodbeat_private.pipeline_link_changed();
drop trigger if exists pipeline_connector_change on public.connectors;
create trigger pipeline_connector_change after insert or delete or update of status on public.connectors
  for each row execute function goodbeat_private.pipeline_link_changed();
drop trigger if exists pipeline_publication_change on public.content_publications;
create trigger pipeline_publication_change after insert or update of status on public.content_publications
  for each row execute function goodbeat_private.pipeline_link_changed();
drop trigger if exists pipeline_page_publication_change on public.page_content_publications;
create trigger pipeline_page_publication_change after insert or update of status on public.page_content_publications
  for each row execute function goodbeat_private.pipeline_link_changed();

-- One count for every surface. Derived from the same rows, never incremented by hand.
create or replace function public.work_status(p_site text) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
begin
  if auth.uid() is null or goodbeat_private.workspace_role(p_site) is null then
    raise exception 'Workspace access denied' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'as_of', now(),
    'awaiting_approval', (select count(*) from public.draft_pipeline where site_id = p_site and lane = 'approval'),
    'in_production', (select count(*) from public.draft_pipeline where site_id = p_site and lane = 'production' and coalesce(stage, 'queued') in ('queued', 'producing')),
    'blocked', (select count(*) from public.draft_pipeline where site_id = p_site and (lane = 'attention' or stage = 'blocked')),
    'delivered', (select count(*) from public.draft_pipeline where site_id = p_site and stage = 'delivered'),
    'publishing', (select count(*) from public.operation_jobs where site_id = p_site and kind in ('blog_publish', 'page_content_publish') and status in ('queued', 'running')),
    'verifying', (select count(*) from public.content_publications where site_id = p_site and status = 'published' and coalesce(verification->>'state', '') = ''),
    'verified', (select count(*) from public.content_publications where site_id = p_site and verification->>'state' = 'verified')
            + (select count(*) from public.page_content_publications where site_id = p_site and verification->>'state' = 'verified'),
    'needs_reconciliation', (select count(*) from public.content_publications where site_id = p_site and status in ('uncertain', 'failed'))
            + (select count(*) from public.page_content_publications where site_id = p_site and status in ('uncertain', 'blocked')));
end $$;
revoke all on function public.work_status(text) from public, anon;
grant execute on function public.work_status(text) to authenticated;

-- Backfill every existing draft.
select goodbeat_private.evaluate_draft(id) from public.drafts;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'draft_pipeline') then
    alter publication supabase_realtime add table public.draft_pipeline;
  end if;
end $$;
