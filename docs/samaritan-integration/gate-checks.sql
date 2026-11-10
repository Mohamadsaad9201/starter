-- Contract checks for the readiness gate, run against the live database. The block ends by raising an exception that
-- carries the results, so every row it creates is rolled back. Last run 2026-11-10: 15 of 15 passed.
do $$
declare a uuid; b uuid; c uuid; r record; v_body text := E'# A real headline\n\n' || repeat('A finished, verified paragraph about cold-packed delivery. ', 40); n int;
begin
  create temp table t_out(test text, pass boolean, detail text) on commit drop;
  insert into public.drafts(site_id,workspace,kind,title,body) values('hwd','seo','Content brief','T brief','A plan') returning id into a;
  select * into r from public.draft_pipeline where draft_id=a;
  insert into t_out values('brief stays out of approval', r.lane='production' and not r.ready, r.lane);
  insert into public.drafts(site_id,workspace,kind,title,body) values('hwd','seo','Blog post','A real headline',v_body) returning id into b;
  select * into r from public.draft_pipeline where draft_id=b;
  insert into t_out values('complete article is ready', r.lane='approval' and r.ready and r.adapter='shopify_article', r.lane||' '||r.reasons::text);
  update public.drafts d set body = d.body || E'\nA new claim.' where id=b;
  insert into t_out select 'editing changes the approved version', p.payload_hash <> r.payload_hash and p.payload_hash = goodbeat_private.payload_hash(d.title,d.body), left(p.payload_hash,10) from public.draft_pipeline p join public.drafts d on d.id=p.draft_id where p.draft_id=b;
  update public.drafts d set body = d.body || E'\n[INSERT price here]' where id=b;
  insert into t_out select 'placeholder blocks readiness', lane<>'approval' and reasons @> '[{"code":"placeholder"}]', lane from public.draft_pipeline where draft_id=b;
  update public.drafts set body = E'# A real headline\n\n' || repeat('Fine copy. ',150) || 'Owner to confirm the certification body.' where id=b;
  insert into t_out select 'unresolved owner fact blocks readiness', lane<>'approval' and reasons @> '[{"code":"unresolved_fact"}]', lane from public.draft_pipeline where draft_id=b;
  update public.drafts set body = E'# A real headline\n\n' || repeat('Fine copy. ',150), title='Article AI assistants will quote: Topic: x' where id=b;
  insert into t_out select 'working title blocks readiness', lane<>'approval' and reasons @> '[{"code":"working_title"}]', lane from public.draft_pipeline where draft_id=b;
  update public.drafts set title='A real headline' where id=b;
  insert into t_out select 'fixed article returns to approval', lane='approval' and ready, lane from public.draft_pipeline where draft_id=b;
  insert into public.drafts(site_id,workspace,kind,title,body) values('nar','seo','Blog post','A real headline',v_body) returning id into c;
  insert into t_out select 'no connection means no approval', lane='attention' and reasons @> '[{"code":"no_publishing_connection"}]', lane from public.draft_pipeline where draft_id=c;
  update public.connectors set status='error' where site_id='hwd' and type='shopify';
  insert into t_out select 'lost connection withdraws ready work', lane='attention', lane from public.draft_pipeline where draft_id=b;
  update public.connectors set status='connected' where site_id='hwd' and type='shopify';
  insert into t_out select 'restored connection returns it', lane='approval', lane from public.draft_pipeline where draft_id=b;
  insert into t_out select 'app user has no write access to lanes', not has_table_privilege('authenticated','public.draft_pipeline','UPDATE') and not has_table_privilege('authenticated','public.draft_pipeline','INSERT') and not has_table_privilege('anon','public.draft_pipeline','SELECT'), '';
  insert into t_out select 'app user cannot run the gate or its refresh', not has_function_privilege('authenticated','goodbeat_private.evaluate_draft(uuid)','EXECUTE') and not has_function_privilege('authenticated','public.refresh_draft_gate(uuid)','EXECUTE'), '';
  begin
    perform set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}', true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    update public.drafts set status='approved' where id=b;
    insert into t_out values('direct approval from a browser session is refused', false, 'update succeeded');
  exception when others then insert into t_out values('direct approval from a browser session is refused', sqlerrm like 'Approve from the review queue%', sqlerrm);
  end;
  perform set_config('request.jwt.claims', '', true); perform set_config('request.jwt.claim.role', '', true);
  update public.drafts set status='approved' where id=b;
  insert into t_out select 'decided work leaves the queue', lane='closed', lane from public.draft_pipeline where draft_id=b;
  select count(*) into n from public.draft_pipeline where site_id='hwd' and lane='approval';
  insert into t_out select 'count equals the rows shown', n = (select count(*) from public.drafts d join public.draft_pipeline p on p.draft_id=d.id where d.site_id='hwd' and d.status='needs_review' and p.ready), n::text;
  raise exception 'RESULTS %', (select jsonb_agg(jsonb_build_object('t',test,'pass',pass,'d',detail)) from t_out);
end $$;
