-- Client reviewers could not see any work in the review queue.
--
-- The app decides whether a fix is ready for review from fixes.data:
--   released_on      (set by goodbeat_private.release_daily_suggestions)
--   search_strategy  (evidence review checked by searchReviewHold)
--   experiment_id / failedOperation
-- and decides which drafts are in scope from drafts.workspace.
-- client_workspace returned neither, so for viewer/reviewer roles every fix failed
-- readyFix() and every draft failed inScopeDraft(): the queue always said "all caught up".
--
-- This returns only those review fields (not the internal audit/publishClaim data)
-- and adds drafts.workspace. Access checks are unchanged.

create or replace function goodbeat_private.client_workspace(p_site text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
 if auth.uid() is null or goodbeat_private.workspace_role(p_site) is null then raise exception 'Workspace access denied' using errcode='42501'; end if;
 return jsonb_build_object(
 'role',goodbeat_private.workspace_role(p_site),
 'fixes',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from (
   select id,field,page_name,url,before,after,status,priority,deployed_at,
          data->'verification' as verification,
          jsonb_strip_nulls(jsonb_build_object(
            'released_on', data->'released_on',
            'search_strategy', data->'search_strategy',
            'experiment_id', data->'experiment_id',
            'failedOperation', data->'failedOperation',
            'verification', data->'verification')) as data
   from public.fixes where site_id=p_site and status<>'superseded' order by created_at desc limit 500) f),
 'drafts',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from (select id,workspace,title,kind,body,status,ranking_hold,created_at from public.drafts where site_id=p_site order by created_at desc limit 100) d),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select id,kind,priority,target,before,after,note,status from public.tasks where site_id=p_site limit 100) t),
 'daily',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from (select date,clicks,impressions,ctr,position from public.gsc_daily where site_id=p_site order by date desc limit 56) g),
 'connectors',(select coalesce(jsonb_agg(jsonb_build_object('type',type,'status',status,'last_checked_at',last_checked_at)),'[]') from public.connectors where site_id=p_site),
 'reviews',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select item_kind,item_id,decision,snapshot,created_at from public.client_reviews where site_id=p_site order by created_at desc limit 200) r)
 );
end;$function$;
