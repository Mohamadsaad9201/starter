import {check,enqueue} from './operations.ts';
import {auditUrl} from './audits.ts';
import {readShopifyValue,verifyFix} from './verification.ts';
import {copyEvidenceError} from './search-strategy.ts';
import {SEARCH_SOURCES} from '../_shared/search-knowledge.ts';
import {permittedCopy} from '../_shared/business.ts';
const DAY=86400000;
export const EXPERIMENT_VERSION='2026-10-30.1';
const text=(x:any)=>String(x||'').trim();
const date=(v:number)=>new Date(v).toISOString().slice(0,10);
const pacificDay=(now:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const shift=(d:string,n:number)=>date(Date.parse(d+'T00:00:00Z')+n*DAY);
export async function experimentHash(snapshot:any) {
 const canonical=(x:any):any=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(snapshot)))))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function experimentWindows(startedAt:string) {
 const d=pacificDay(Date.parse(startedAt));
 return {startDate:shift(d,8),endDate:shift(d,35),readyDate:shift(d,38),settling_days:7,observation_days:28};
}
export function dailySummary(rows:any[],window:any) {
 const expected=Array.from({length:28},(_,i)=>shift(window.startDate,i));
 const unique=new Map();let valid=true;
 for(const r of rows||[]) {
  const day=r.keys?.[0];
  if(!expected.includes(day)||unique.has(day)||![r.clicks,r.impressions,r.position].every(x=>Number.isFinite(x)&&x>=0)||r.clicks>r.impressions){valid=false;continue;}
  unique.set(day,r);
 }
 const all=[...unique.values()],clicks=all.reduce((n,r)=>n+r.clicks,0),impressions=all.reduce((n,r)=>n+r.impressions,0);
 return {complete:valid&&unique.size===28,returned_days:unique.size,missing_days:expected.filter(d=>!unique.has(d)),clicks:all.length?clicks:null,impressions:all.length?impressions:null,ctr:impressions?clicks/impressions:null,position:impressions?all.reduce((n,r)=>n+r.position*r.impressions,0)/impressions:null};
}
function ratio(a:number,b:number){return Number.isFinite(a)&&Number.isFinite(b)&&a>=0&&b>0?a/b:null;}
export function experimentReadout(snapshot:any,post:any,integrity=true) {
 const before=snapshot.baseline,flags:string[]=[];
 const four=[before.treatment.summary,before.control.summary,post.treatment.summary,post.control.summary];
 if(!integrity)flags.push('Page copy or comparison-page integrity changed.');
 if(four.some(s=>!s.complete))flags.push('Incomplete daily reporting; missing dates are unknown, not zero.');
 if(four.some(s=>(s.clicks??0)<30||(s.impressions??0)<300))flags.push('Low reporting volume: below the pilot policy floor (30 clicks and 300 impressions per page/window). This is not a statistical power calculation.');
 if(snapshot.confounders)flags.push('Reviewer recorded a confounder: '+snapshot.confounders);
 const t=ratio(post.treatment.summary.clicks,before.treatment.summary.clicks),c=ratio(post.control.summary.clicks,before.control.summary.clicks);
 const contrast=t!==null&&c!==null?ratio(t,c):null;
 const priorT=ratio(before.treatment.summary.clicks,before.treatment.previous_summary?.clicks),priorC=ratio(before.control.summary.clicks,before.control.previous_summary?.clicks);
 if(!before.treatment.previous_summary?.complete||!before.control.previous_summary?.complete||priorT===null||priorC===null||Math.abs(priorT/priorC-1)>.2)flags.push('Treatment and comparison baseline trends are not sufficiently aligned under the 20% review policy.');
 for(const key of ['treatment','control']) {
  const a=before[key],b=post[key];
  if(!a.segments?.device?.length||!b.segments?.device?.length||!a.segments?.country?.length||!b.segments?.country?.length)flags.push(key+': segment evidence unavailable.');
  for(const dimension of ['device','country']) {
   const share=(rows:any[])=>{const total=(rows||[]).reduce((n,r)=>n+r.impressions,0);return new Map((rows||[]).map(r=>[r.keys[0],total?r.impressions/total:0]));};
   const x=share(a.segments?.[dimension]),y=share(b.segments?.[dimension]);
   if([...new Set([...x.keys(),...y.keys()])].some(k=>Math.abs(Number(x.get(k)||0)-Number(y.get(k)||0))>.2))flags.push(key+': '+dimension+' mix changed by more than 20 percentage points.');
  }
  const qa=new Set((a.segments?.query||[]).map((r:any)=>r.keys[0])),qb=new Set((b.segments?.query||[]).map((r:any)=>r.keys[0]));
  const overlap=[...qa].filter(q=>qb.has(q)).length,union=new Set([...qa,...qb]).size;
  if(!union||overlap/union<.5)flags.push(key+': returned-query coverage changed or is unavailable.');
 }
 const direction=flags.length||contrast===null?'inconclusive':contrast>1.2&&t!==null&&t>1?'observed_increase':contrast<.8&&t!==null&&t<1?'observed_decrease':'no_clear_change';
 return {status:direction,flags,primary_metric:'Organic clicks',treatment_change:t===null?null:t-1,comparison_change:c===null?null:c-1,comparison_adjusted_change:contrast===null?null:contrast-1,causal:false,confidence_interval:null,conversion_impact:null,profit_impact:null,
  method:'Single-page, non-randomized comparison pilot. Ratio of click changes, not a causal uplift estimate or significance test. Policy thresholds are review triggers, not scientific confidence levels.',
  recommendation:direction==='observed_decrease'?'Review relevance, confounders and rollback. No automatic rollback or expansion.':'Review the complete evidence before retaining or rolling back. No automatic expansion.',before,after:post};
}
async function searchEvidence(db:any,gsc:any,siteId:string,url:string,window:any,previous=false) {
 const c=check(await db.from('connectors').select('*').eq('site_id',siteId).eq('type','gsc').eq('status','connected').maybeSingle());
 if(!c?.config?.property)throw Error('Connect Search Console and choose a property before preparing a pilot.');
 const query=async(w:any,dimension:string)=>{const r=await gsc(`/sites/${encodeURIComponent(c.config.property)}/searchAnalytics/query`,{method:'POST',body:JSON.stringify({...w,dimensions:[dimension],dataState:'final',rowLimit:dimension==='date'?100:250,dimensionFilterGroups:[{filters:[{dimension:'page',operator:'equals',expression:url}]}]})},c);return r.rows||[];};
 const [daily,device,country,queries,prior]=await Promise.all([query(window,'date'),query(window,'device'),query(window,'country'),query(window,'query'),previous?query({startDate:shift(window.startDate,-28),endDate:shift(window.endDate,-28)},'date'):Promise.resolve(null)]);
 return {url,property:c.config.property,connector_id:c.id,window,summary:dailySummary(daily,window),daily,segments:{device,country,query:queries},...(prior?{previous_summary:dailySummary(prior,{startDate:shift(window.startDate,-28),endDate:shift(window.endDate,-28)})}:{}),segment_limit:'Up to 250 rows per dimension; query omissions and anonymization prevent complete coverage.'};
}
async function capture(db:any,gsc:any,sid:string,url:string,control:string,window:any,previous=false){return {treatment:await searchEvidence(db,gsc,sid,url,window,previous),control:await searchEvidence(db,gsc,sid,control,window,previous)};}
async function shopConnection(db:any,secretFor:any,sid:string) {
 const c=check(await db.from('connectors').select('*').eq('site_id',sid).eq('type','shopify').eq('status','connected').maybeSingle());
 if(!c)throw Error('This pilot supports verified Shopify product and collection metadata.');
 const token=await secretFor(c.id);if(!token)throw Error('Reconnect Shopify.');return {c,token};
}
export function validateExperimentInput(body:any,before:string,site:any,page:any) {
 const after=text(body.after),terms=Array.isArray(body.protected_terms)?body.protected_terms.map(text).filter(Boolean):[];
 if(!['seo.title','seo.description'].includes(body.field)||!before||!after||before===after)throw Error('Choose an existing title or description and a different proposed version.');
 if(text(body.hypothesis).length<25||text(body.rationale).length<25||text(body.control_rationale).length<25)throw Error('Explain the hypothesis, page evidence and why the comparison page is suitable (at least 25 characters each).');
 if(!terms.length||terms.length>20||terms.some((t:string)=>t.length>150||!before.toLowerCase().includes(t.toLowerCase())||!after.toLowerCase().includes(t.toLowerCase())))throw Error('Protect at least one existing product, service, location or intent phrase in both versions.');
 const numericBefore=before.match(/\d+(?:[.,]\d+)*/g)||[];
 if(numericBefore.some(n=>!(after.match(/\d+(?:[.,]\d+)*/g)||[]).includes(n)))throw Error('Preserve existing numerical product details. Correct factual errors outside this experiment.');
 if(!permittedCopy(after,site)||copyEvidenceError(after,{name:page.data?.name,current:before,context:page.data?.bodyText},site))throw Error('Proposed copy violates the business or factual-evidence rules.');
 return {after,terms};
}
export async function experimentAction(body:any,deps:any) {
 const {db,gsc,shopify,secretFor}=deps,sid=text(body.site_id);
 const site=check(await db.from('sites').select('*').eq('id',sid).single());if(!site?.active)throw Error('Business is inactive.');
 if(body.action==='search_experiment_list')return {experiments:check(await db.from('search_experiments').select('*').eq('site_id',sid).order('created_at',{ascending:false}).limit(50))};
 if(!deps.actorId)throw Error('A signed-in agency reviewer is required.');
 if(body.action==='search_experiment_create') {
  const url=auditUrl(text(body.url),'https://'+site.domain.replace(/^https?:\/\//,'').replace(/\/.*$/,''));
  const control=auditUrl(text(body.control_url),'https://'+site.domain.replace(/^https?:\/\//,'').replace(/\/.*$/,''));
  if(!url||!control||url===control)throw Error('Choose two different pages on this business domain.');
  const pages=check(await db.from('pages').select('*').eq('site_id',sid).in('url',[url,control]).order('updated_at',{ascending:false}).limit(20));
  const page=pages.find((p:any)=>p.url===url&&/^shopify:gid:\/\/shopify\/(Product|Collection)\//.test(p.key)),comparison=pages.find((p:any)=>p.url===control);
  if(!page||!comparison||[page,comparison].some(p=>!p.updated_at||Date.now()-Date.parse(p.updated_at)>14*DAY)||!page.data?.bodyText)throw Error('Run a fresh website audit for both pages before preparing a pilot.');
  if(!/^shopify:gid:\/\/shopify\/(Product|Collection)\//.test(comparison.key))throw Error('Choose a Shopify product or collection as the comparison page.');
  const {c,token}=await shopConnection(db,secretFor,sid);
  const ref=page.key.slice(8),controlRef=comparison.key.slice(8);
  const before=(await readShopifyValue(shopify,c,token,{ref,field:body.field})).value;
  const {after,terms}=validateExperimentInput(body,before,site,page);
  const controlBefore=(await readShopifyValue(shopify,c,token,{ref:controlRef,field:body.field})).value;
  const today=pacificDay(Date.now()),window={startDate:shift(today,-30),endDate:shift(today,-3)};
  const baseline=await capture(db,gsc,sid,url,control,window,true);
  if([baseline.treatment.summary,baseline.control.summary,baseline.treatment.previous_summary,baseline.control.previous_summary].some(x=>!x.complete||(x.clicks??0)<30||(x.impressions??0)<300))throw Error('Insufficient baseline for a pilot: both pages need 28 returned days, 30 clicks and 300 impressions in each of two baseline windows. Missing data is not zero.');
  const priorTrend=(baseline.treatment.summary.clicks!/baseline.treatment.previous_summary!.clicks!)/(baseline.control.summary.clicks!/baseline.control.previous_summary!.clicks!);
  if(Math.abs(priorTrend-1)>.2)throw Error('Baseline trends differ by more than the 20% review threshold. Choose a more comparable page.');
  const id=crypto.randomUUID(),fix={id:'experiment-'+id,site_id:sid,page_key:page.key,url,platform:'shopify',ref,kind:page.kind,page_name:page.data.name||page.data.title,field:body.field,before,restore:before,after,reasons:['reviewed_search_experiment'],source:'search_experiment',priority:'normal',status:'pending',data:{experiment_id:id}};
  const snapshot={version:EXPERIMENT_VERSION,fix,control_url:control,control_ref:controlRef,control_before:controlBefore,connector_id:c.id,hypothesis:text(body.hypothesis).slice(0,2000),rationale:text(body.rationale).slice(0,2000),control_rationale:text(body.control_rationale).slice(0,2000),protected_terms:terms,confounders:text(body.confounders).slice(0,2000),baseline,prepared_at:new Date().toISOString(),sources:SEARCH_SOURCES,method:'One treatment page and one reviewer-selected comparison. Not randomized. Seven settling days, 28 observation days, three reporting-lag days. No automatic expansion.'};
  const approval_hash=await experimentHash(snapshot);
  const saved=check(await db.from('search_experiments').insert({id,site_id:sid,snapshot,approval_hash,created_by:deps.actorId}).select('*').single());return {experiment:saved};
 }
 const experiment=check(await db.from('search_experiments').select('*').eq('site_id',sid).eq('id',body.id).single());
 if(!experiment)throw Error('Pilot not found.');
 if(body.action==='search_experiment_approve') {
  if(body.approved_hash!==experiment.approval_hash||body.reviewed!==true)throw Error('Review and approve this exact pilot snapshot.');
  if(!['draft','queued'].includes(experiment.status))throw Error('This pilot has already started or is closed.');
  if(Date.now()-Date.parse(experiment.snapshot.prepared_at)>DAY)throw Error('Baseline is older than 24 hours. Prepare a fresh pilot.');
  const policy=check(await db.from('automation_policies').select('paused').eq('site_id',sid).maybeSingle());
  if(!policy||policy.paused)throw Error('Agency work is paused. Resume it in SEO Controls before approving a scheduled pilot.');
  const {c,token}=await shopConnection(db,secretFor,sid);
  if(c.id!==experiment.snapshot.connector_id)throw Error('The Shopify connection changed. Prepare a fresh pilot.');
  const actual=await readShopifyValue(shopify,c,token,experiment.snapshot.fix),control=await readShopifyValue(shopify,c,token,{ref:experiment.snapshot.control_ref,field:experiment.snapshot.fix.field});
  if(actual.value!==experiment.snapshot.fix.before||control.value!==experiment.snapshot.control_before)throw Error('One of the pages changed. Prepare a fresh pilot before approval.');
  // The unique active-site index serializes concurrent approvals. Only server-owned
  // ledger approvals can authorize an existing-copy edit at the publish boundary.
  if(experiment.status==='draft') {
   const claimed=check(await db.from('search_experiments').update({status:'queued',approved_by:deps.actorId,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',experiment.id).eq('site_id',sid).eq('status','draft').select('id'));
   if(!claimed.length)throw Error('Pilot state changed; refresh before retrying.');
  }
  check(await db.from('fixes').upsert({...experiment.snapshot.fix,status:'approved',decided_at:new Date().toISOString()},{onConflict:'site_id,id',ignoreDuplicates:true}));
  await enqueue(db,sid,'search_publish','seo','search-publish:'+experiment.id,{experiment_id:experiment.id});
  return {queued:true};
 }
 if(body.action==='search_experiment_note') {
  if(!['queued','running','review'].includes(experiment.status)||text(body.note).length<10)throw Error('Record a specific confounder for an active pilot.');
  check(await db.from('search_experiments').update({review_notes:(experiment.review_notes+'\n'+text(body.note)).trim().slice(-6000),...(experiment.status==='review'?{result:{...experiment.result,status:'inconclusive',flags:[...(experiment.result?.flags||[]),'Reviewer added a confounder: '+text(body.note).slice(0,1000)]}}:{}),updated_at:new Date().toISOString()}).eq('id',experiment.id).eq('site_id',sid).eq('status',experiment.status));return {saved:true};
 }
 if(body.action==='search_experiment_stop') {
  if(experiment.status!=='running')throw Error('Only a running pilot can be stopped for review.');
  check(await db.from('search_experiments').update({status:'review',result:{status:'inconclusive',flags:['Reviewer stopped the pilot before completion.'],causal:false},updated_at:new Date().toISOString()}).eq('id',experiment.id).eq('site_id',sid).eq('status','running'));return {needs_review:true};
 }
 if(body.action==='search_experiment_measure')return await monitorExperiment({site_id:sid,payload:{experiment_id:experiment.id}},deps);
 if(body.action==='search_experiment_close') {
  if(!['draft','review'].includes(experiment.status)||!['retain','cancel','rollback'].includes(body.decision))throw Error('Review the completed readout before retaining or rolling back.');
  if(experiment.status==='draft'&&body.decision!=='cancel')throw Error('Unpublished pilots can only be cancelled.');
  if(body.decision==='rollback') {
   const f=check(await db.from('fixes').select('*').eq('site_id',sid).eq('id',experiment.snapshot.fix.id).single());
   if(f.status!=='deployed')throw Error('The pilot is not currently deployed. Review its change history.');
   check(await db.from('fixes').update({status:'rollback_requested'}).eq('site_id',sid).eq('id',f.id).eq('status','deployed'));
   await enqueue(db,sid,'search_rollback','seo','search-rollback:'+experiment.id,{experiment_id:experiment.id});
   return {rollback_queued:true};
  }
  const done=check(await db.from('search_experiments').update({status:experiment.status==='draft'?'cancelled':'closed',decision:body.decision,updated_at:new Date().toISOString()}).eq('site_id',sid).eq('id',experiment.id).eq('status',experiment.status).select('id'));
  if(!done.length)throw Error('Pilot changed; refresh.');return {closed:true};
 }
 throw Error('Unknown search experiment action.');
}
export async function assertExperimentWrite(db:any,f:any) {
 if(f.status==='rollback_requested')return false;
 const rows=check(await db.from('search_experiments').select('*').eq('site_id',f.site_id).in('status',['queued','running','review']));
 const own=rows.find((e:any)=>e.id===f.data?.experiment_id);
 if(own) {
  const policy=check(await db.from('automation_policies').select('paused').eq('site_id',f.site_id).maybeSingle());
  if(!policy||policy.paused)throw Error('Agency work is paused; the pilot cannot publish.');
  if(own.status!=='queued'||!own.approved_by||Date.now()-Date.parse(own.snapshot.prepared_at)>DAY||own.approval_hash!==await experimentHash(own.snapshot))throw Error('Pilot approval is stale or not executable.');
  const expected=own.snapshot.fix;
  if(['id','site_id','ref','url','field','before','after','restore','platform'].some(k=>f[k]!==expected[k]))throw Error('The pilot copy or destination changed after approval.');
  return true;
 }
 if(f.source==='search_experiment'||f.data?.experiment_id)throw Error('No active server-owned pilot approval.');
 if(rows.some((e:any)=>[e.snapshot.fix.url,e.snapshot.control_url].includes(f.url)||[e.snapshot.fix.ref,e.snapshot.control_ref].includes(f.ref)))throw Error('This page is protected by an active search pilot. Finish or close that pilot first.');
 return false;
}
export async function publishExperiment(job:any,deps:any,rollback=false) {
 const {db}=deps,e=check(await db.from('search_experiments').select('*').eq('site_id',job.site_id).eq('id',job.payload.experiment_id).single());
 if(rollback) {
  const f=check(await db.from('fixes').select('*').eq('site_id',e.site_id).eq('id',e.snapshot.fix.id).single());
  if(f.status==='rollback_requested')await deps.applyFixes(e.site_id,1,[f.id]);
  const updated=check(await db.from('fixes').select('*').eq('site_id',e.site_id).eq('id',f.id).single());
  if(updated.status!=='rolled_back')throw Error('Rollback needs reconciliation in the change history.');
  const verified=await deps.verifyBatch(db,deps.shopify,deps.secretFor,e.site_id,[f.id]);
  if(verified.verified!==1) {check(await db.from('search_experiments').update({status:'review',result:{status:'inconclusive',flags:['Original metadata was saved, but live rollback verification needs review.'],causal:false},decision:'rollback_saved',updated_at:new Date().toISOString()}).eq('site_id',e.site_id).eq('id',e.id));return {needs_review:true,summary:'Rollback saved; public verification needs review.'};}
  check(await db.from('search_experiments').update({status:'closed',decision:'rolled_back',updated_at:new Date().toISOString()}).eq('site_id',e.site_id).eq('id',e.id));return {summary:'Original metadata restored; review live verification in change history.'};
 }
 if(e.status!=='queued')return {summary:'Pilot is no longer queued.'};
 await deps.applyFixes(e.site_id,1,[e.snapshot.fix.id]);
 return await monitorExperiment(job,deps);
}
export async function monitorExperiment(job:any,deps:any) {
 const {db,gsc,shopify,secretFor}=deps;
 const e=check(await db.from('search_experiments').select('*').eq('site_id',job.site_id).eq('id',job.payload.experiment_id).single());
 if(!['queued','running'].includes(e.status))return {summary:'Pilot is not awaiting measurement.',needs_review:e.status==='review'};
 const s=e.snapshot,f=check(await db.from('fixes').select('*').eq('site_id',e.site_id).eq('id',s.fix.id).single());
 const save=async(patch:any)=>{const rows=check(await db.from('search_experiments').update({...patch,updated_at:new Date().toISOString()}).eq('site_id',e.site_id).eq('id',e.id).eq('status',e.status).select('id'));if(!rows.length)throw Error('Pilot state changed. Refresh before continuing.');};
 if(f.status==='approved'&&e.status==='queued')return {summary:'Pilot is queued for publishing; measurement has not started.'};
 if(f.status!=='deployed') {await save({status:'review',result:{status:'inconclusive',flags:['Pilot change is not confirmed deployed; inspect change history.'],causal:false}});return {needs_review:true,summary:'Pilot publication needs review.'};}
 const site=check(await db.from('sites').select('*').eq('id',e.site_id).single()),{c,token}=await shopConnection(db,secretFor,e.site_id);
 const v=await verifyFix(db,shopify,secretFor,c,site,f),control=await readShopifyValue(shopify,c,token,{ref:s.control_ref,field:s.fix.field});
 if(v.state!=='verified'||control.value!==s.control_before||c.id!==s.connector_id) {
  await save({status:'review',result:{status:'inconclusive',flags:['Live treatment or comparison metadata does not match the frozen pilot.'],causal:false}});return {needs_review:true,summary:'Page integrity changed; pilot needs review.'};
 }
 if(!e.started_at) {
  const started=new Date().toISOString(),window=experimentWindows(started),due=new Date(Date.now()+38*DAY).toISOString();
  await save({status:'running',started_at:started,due_at:due,result:{status:'collecting',window,causal:false}});
  await enqueue(db,e.site_id,'search_measure','seo','search-measure:'+e.id,{experiment_id:e.id},due);
  await enqueue(db,e.site_id,'search_measure','seo','search-integrity:'+e.id,{experiment_id:e.id},new Date(Date.now()+7*DAY).toISOString());
  return {summary:'Pilot verified live. Seven settling days, then 28 measured days; final readout waits for reporting lag.'};
 }
 const window=experimentWindows(e.started_at);
 // Reconcile a lost schedule after a crash without repeating the external write.
 await enqueue(db,e.site_id,'search_measure','seo','search-measure:'+e.id,{experiment_id:e.id},e.due_at);
 if(pacificDay(Date.now())<window.readyDate)return {summary:'Live copy verified; the complete measurement window is not ready.',collecting:true};
 const post=await capture(db,gsc,e.site_id,s.fix.url,s.control_url,{startDate:window.startDate,endDate:window.endDate});
 const propertiesMatch=post.treatment.property===s.baseline.treatment.property&&post.control.property===s.baseline.control.property&&post.treatment.connector_id===s.baseline.treatment.connector_id;
 const result=experimentReadout({...s,confounders:[s.confounders,e.review_notes].filter(Boolean).join('; ')},post,propertiesMatch);
 await save({status:'review',result});return {needs_review:true,summary:'Search pilot readout ready: '+result.status.replaceAll('_',' ')+'. No automatic expansion.',result};
}


