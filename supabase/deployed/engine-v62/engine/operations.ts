// Durable, one-business-at-a-time work. External writes are never retried automatically.
export const READ_JOBS = new Set(['page_content_verify','content_measure','commerce_sync','channel_health','gsc_sync','ads_sync','pilot_snapshot','publication_verify','search_measure']);
export const check = (r:any) => { if(r.error) throw new Error(r.error.message); return r.data; };
export function safeJobError(error:any) {
  return String(error?.message||'Work could not be confirmed.').replace(/(?:Bearer\s+|access_token[=:]\s*|refresh_token[=:]\s*)[^\s&,]+/gi,'[credential removed]').slice(0,500);
}
export function jobSignal(job:any,now=Date.now()) {
  if(job.status!=='running')return job.status;
  return Date.parse(job.lease_expires_at)>now && Date.parse(job.heartbeat_at)<=now && Date.parse(job.heartbeat_at)>now-120000 ? 'running':'check_status';
}
export async function enqueue(db:any,siteId:string,kind:string,channel:string,key:string,payload:any={},runAfter?:string) {
  return check(await db.from('operation_jobs').upsert({site_id:siteId,kind,channel,dedupe_key:key,payload,...(runAfter?{run_after:runAfter}:{})},{onConflict:'site_id,dedupe_key',ignoreDuplicates:true}).select('id'));
}
export async function healthCheck(siteId:string,deps:any) {
  const {db,testConnector}=deps;
  const conns=check(await db.from('connectors').select('*').eq('site_id',siteId));
  const health=[];
  for(const channel of ['shopify','gsc','google_ads','meta_ads']) {
    const c=conns.find((x:any)=>x.type===channel),now=new Date().toISOString();
    const prior=check(await db.from('channel_syncs').select('detail').eq('site_id',siteId).eq('channel',channel).maybeSingle());
    if(!c){check(await db.from('channel_syncs').upsert({site_id:siteId,channel,state:'not_connected',last_attempt_at:now,error:null}));health.push({channel,state:'not_connected'});continue;}
    let result;
    try {result=['google_ads','meta_ads'].includes(channel) ? await deps.adsHealth(c) : await testConnector(c.id);}
    catch(e){result={ok:false,error:safeJobError(e)};}
    const state=result.ok?'connected':'needs_attention';
    // Authentication success does not imply reporting data is current.
    check(await db.from('channel_syncs').upsert({site_id:siteId,channel,state,last_attempt_at:now,error:result.ok?null:safeJobError({message:result.error}),detail:{...(prior?.detail||{}),connection_check:result.ok?'Access confirmed':'Needs attention'}}));
    health.push({channel,state});
  }
  return {health,needs_review:health.some((h:any)=>h.state==='needs_attention'),summary:'Connection access checked. Reporting freshness is tracked separately.'};
}
export async function syncSearch(siteId:string,deps:any) {
  const now=new Date().toISOString();
  try {
    const result=(await deps.gscSync(siteId))[siteId];
    if(!result||result.error)throw new Error(result?.error||'Connect Search Console and select a property.');
    const latest=check(await deps.db.from('gsc_daily').select('date').eq('site_id',siteId).order('date',{ascending:false}).limit(1));
    check(await deps.db.from('channel_syncs').upsert({site_id:siteId,channel:'gsc',state:'synced',last_attempt_at:now,last_success_at:now,data_through:latest[0]?.date||null,error:null,detail:result}));
    return {...result,summary:result.days?'Search Console reporting refreshed.':'Sync completed; Google returned no daily data.'};
  }catch(e){check(await deps.db.from('channel_syncs').upsert({site_id:siteId,channel:'gsc',state:'needs_attention',last_attempt_at:now,error:safeJobError(e)}));throw e;}
}
export async function runOperation(deps:any) {
  const {db,handlers}=deps;
  check(await db.rpc('schedule_operations'));
  const job=check(await db.rpc('claim_operation_job'));
  if(!job)return {idle:true};
  const lease=()=>db.from('operation_jobs').update({heartbeat_at:new Date().toISOString(),lease_expires_at:new Date(Date.now()+360000).toISOString()}).eq('id',job.id).eq('lease_token',job.lease_token).eq('status','running');
  const timer=setInterval(()=>{Promise.resolve(lease()).catch(()=>{});},30000);
  try {
    const handler=handlers[job.kind];if(!handler)throw new Error('This work type requires an updated worker.');
    const result=await handler(job);
    const status=result?.needs_review?'needs_review':'succeeded';
    const saved=check(await db.from('operation_jobs').update({status,result,finished_at:new Date().toISOString(),lease_token:null,lease_expires_at:null}).eq('id',job.id).eq('lease_token',job.lease_token).eq('status','running').select('id'));
    if(!saved.length)throw new Error('Worker ownership changed; review the saved result.');
    return {id:job.id,status};
  }catch(e){
    // Provider failures are explicit, not loops that spend more or duplicate articles.
    const retryable=READ_JOBS.has(job.kind)||e?.safeToRetry===true;const status=retryable?'blocked':'uncertain';
    check(await db.from('operation_jobs').update({status,result:{retryable},error:safeJobError(e),finished_at:new Date().toISOString(),lease_token:null,lease_expires_at:null}).eq('id',job.id).eq('lease_token',job.lease_token).eq('status','running'));
    return {id:job.id,status,error:safeJobError(e)};
  }finally{clearInterval(timer);}
}
export async function operationsAction(body:any,deps:any) {
  const {db}=deps,siteId=String(body.site_id||'');
  if(body.action==='operation_tick')return await runOperation(deps);
  const site=check(await db.from('sites').select('id,active').eq('id',siteId).single());
  if(!site.active)throw new Error('Business is inactive.');
  if(body.action==='operation_policy') {
    if(typeof body.paused!=='boolean')throw new Error('Choose pause or resume.');
    const current=check(await db.from('automation_policies').select('*').eq('site_id',siteId).maybeSingle());
    const updates={site_id:siteId,paused:body.paused,updated_at:new Date().toISOString(),...(typeof body.weekly_content==='boolean'?{weekly_content:body.weekly_content}:{})};
    check(await db.from('automation_policies').upsert({...current,...updates}));return {ok:true};
  }
  if(body.action==='operation_enqueue') {
    if(!['commerce_sync','channel_health','gsc_sync','ads_sync','content_plan','pilot_snapshot'].includes(body.kind))throw new Error('Unsupported work type.');
    // One manual request per type per minute; repeated clicks share a record.
    return {jobs:await enqueue(db,siteId,body.kind,body.kind==='content_plan'?'content':'connections',`manual:${body.kind}:${Math.floor(Date.now()/60000)}`)};
  }
  if(body.action==='operation_retry'){
    const job=check(await db.from('operation_jobs').select('*').eq('id',body.job_id).eq('site_id',siteId).single());
    if(job.status!=='blocked'||!(READ_JOBS.has(job.kind)||job.result?.retryable))throw new Error('This job requires reconciliation before any retry.');
    check(await db.from('operation_jobs').update({status:'queued',error:null,run_after:new Date().toISOString(),finished_at:null}).eq('id',job.id).eq('status','blocked'));return {ok:true};
  }
  if(body.action==='operation_cancel') {
    check(await db.from('operation_jobs').update({status:'cancelled',finished_at:new Date().toISOString()}).eq('id',body.job_id).eq('site_id',siteId).eq('status','queued'));return {ok:true};
  }
  throw new Error('Unknown operation');
}


