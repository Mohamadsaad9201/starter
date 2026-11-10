import {check,enqueue} from './operations.ts';
export async function recordPilot(siteId:string,deps:any){
 const {db}=deps,program=check(await db.from('pilot_programs').select('*').eq('site_id',siteId).single());
 if(program.status!=='active')throw new Error('Pilot is not active.');
 const now=new Date(),day=now.toISOString().slice(0,10),since=new Date(now.getTime()-86400000).toISOString();
 const count=async(table:string,filter:any)=>{const r=await filter(db.from(table).select('id',{count:'exact',head:true}).eq('site_id',siteId));check(r);return r.count||0;};
 const [jobs,health,daily,publications,threads]=await Promise.all([
 db.from('operation_jobs').select('kind,status,created_at,finished_at').eq('site_id',siteId).gte('created_at',since),
 db.from('channel_syncs').select('channel,state,last_success_at,data_through').eq('site_id',siteId),
 db.from('gsc_daily').select('date,clicks,impressions').eq('site_id',siteId).order('date',{ascending:false}).limit(28),
 db.from('content_publications').select('status,verification').eq('site_id',siteId),db.from('support_threads').select('status,assigned_to').eq('site_id',siteId)]);
 const work=check(jobs),search=check(daily),pubs=check(publications),support=check(threads);
 const metrics={jobs_last_24h:{total:work.length,succeeded:work.filter((x:any)=>x.status==='succeeded').length,needs_review:work.filter((x:any)=>x.status==='needs_review').length,blocked_or_uncertain:work.filter((x:any)=>['blocked','uncertain','failed'].includes(x.status)).length},
 health:check(health),drafts_awaiting_review:await count('drafts',(q:any)=>q.eq('status','needs_review')),
 verified_website_changes:await count('fixes',(q:any)=>q.eq('status','deployed').eq('data->verification->>state','verified')),
 publications:{accepted:pubs.filter((p:any)=>p.status==='published').length,verified:pubs.filter((p:any)=>p.verification?.state==='verified').length},
 search:{source:'Google Search Console',returned_days:search.length,from:search.at(-1)?.date||null,to:search[0]?.date||null,clicks:search.length?search.reduce((n:number,r:any)=>n+r.clicks,0):null,impressions:search.length?search.reduce((n:number,r:any)=>n+r.impressions,0):null,window:'Latest 28 returned daily rows; compare only matching complete reporting windows'},
 support:{open:support.filter((t:any)=>t.status==='open').length,assigned:support.filter((t:any)=>t.assigned_to).length},
 interpretation:'Operational evidence and source-reported performance. No claim of causal revenue or profit uplift.',review_due:Date.parse(program.ends_at)<=now.getTime()};
 check(await db.from('pilot_snapshots').upsert({site_id:siteId,snapshot_date:day,recorded_at:now.toISOString(),metrics}));
 return {summary:'Pilot evidence recorded from work logs, connections, publishing and search data.',snapshot_date:day,review_due:metrics.review_due};
}
export async function pilotAction(body:any,deps:any){
 const siteId=String(body.site_id||''),{db}=deps;
 if(body.action==='pilot_start'){
  const existing=check(await db.from('pilot_programs').select('site_id').eq('site_id',siteId).maybeSingle());
  if(existing)throw new Error('This business already has a pilot record.');
  check(await db.from('pilot_programs').insert({site_id:siteId}));
  await enqueue(db,siteId,'pilot_snapshot','strategy',`pilot:${siteId}:baseline`);
  return {started:true};
 }
 if(body.action==='pilot_status'){
  if(!['paused','active','completed'].includes(body.status))throw new Error('Choose a valid pilot state.');
  check(await db.from('pilot_programs').update({status:body.status}).eq('site_id',siteId));return {ok:true};
 }
 throw new Error('Unknown pilot action.');
}


