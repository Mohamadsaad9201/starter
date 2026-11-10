import { SEARCH_POLICY_VERSION } from "../_shared/search-knowledge.ts";
import {enqueue,check} from './operations.ts';
import { summarizeChecks } from '../_shared/reliability.ts';
export const providerPaused = (engine: string, geminiEnabled?: string) => engine === 'gemini' && geminiEnabled !== 'true';
const safeUrl=(value:any)=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}};
export async function visibilityTasks(siteId:string,run:any,checks:any[]) {
  const groups=new Map<string,any[]>();
  for(const c of checks.filter(c=>c.status==='done')){const key=String(c.prompt||'').trim();if(key)groups.set(key,[...(groups.get(key)||[]),c]);}
  const gaps=[...groups].map(([prompt,rows])=>({prompt,rows,missing:rows.filter(c=>!c.mentioned).length,uncited:rows.filter(c=>!c.cited).length})).filter(g=>g.missing||g.uncited).sort((a,b)=>b.missing-a.missing||b.uncited-a.uncited||a.prompt.localeCompare(b.prompt)).slice(0,8);
  return Promise.all(gaps.map(async g=>{
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(siteId+'\n'+g.prompt.toLowerCase()));
    const id='aeo-'+Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);
    const competitors=[...new Set(g.rows.flatMap(c=>Array.isArray(c.competitors)?c.competitors:[]))].slice(0,5);
    const citations=[...new Set(g.rows.flatMap(c=>(c.citations||[]).map((x:any)=>safeUrl(x.url)).filter(Boolean)))].slice(0,3);
    const before=`Question: ${g.prompt}\n${g.missing} of ${g.rows.length} successful answers did not name the business; ${g.uncited} did not cite its website.`;
    const after=g.missing ? `1. Identify whether the customer wants to buy, compare or learn. Find the most relevant existing service, product, category or guide page for that task; create a new page only if none fits.\n2. Compare the page with the recorded answers and cited sources. Identify useful details customers need that your page does not answer. Define what this change helps a customer do better and which first-party facts, demonstrations or photographs can support it. Do not invent evidence.\n3. Add a clear, direct answer near the top, supported by verified business facts. Include relevant prices, availability, delivery or credentials only where accurate.\n4. Link to this page from a relevant existing page. Review the website audit for indexing or accessibility issues.\n5. Record the page, baseline and hypothesis; publish after review, then repeat the same questions over several checks. Measure organic clicks and purchases separately where connected. Account for seasonality and other changes; a before/after comparison alone does not prove causation.` : `1. Review the page that best answers this question. The business was named, but its website was not consistently cited.\n2. Make the answer easy to find with a clear heading and concise explanation. Add verifiable first-party facts, appropriate source links and an accurate update date.\n3. Review the cited sources below to understand which information the answer used; do not copy their content or invent claims.\n4. Check the website audit for indexing/accessibility issues and link internally to the useful page.\n5. After publishing, repeat the same question and compare citations across several checks.`;
    const note=`Agency research lead. Samaritan prepares supported content for review; this is not a client task. Policy ${SEARCH_POLICY_VERSION}. First confirm a relevant page actually lacks useful information. Preserve existing search intent and successful content. No automatic changes from this task. Evidence from run ${run.id}, ${run.finished_at||run.started_at}. Providers: ${[...new Set(g.rows.map(c=>c.engine))].join(', ')}.${competitors.length?' Tracked competitors named: '+competitors.join(', ')+'.':''}${citations.length?'\nSources returned by these answers:\n'+citations.join('\n'):''}\nThis is a recommendation based on sampled AI answers, not proof your website lacks this content or a guarantee of improved rankings. Only published content and later measurements establish what was executed and observed.`;
    return {id,site_id:siteId,kind:'AI visibility',priority:'normal',target:g.prompt,before,after,note,status:'pending'};
  }));
}
export async function generateVisibilityPlan(db:any,siteId:string,active:string[]) {
  const {data:run,error}=await db.from('aeo_runs').select('*').eq('site_id',siteId).eq('status','done').order('started_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw new Error(error.message);if(!run)return {created:0,reason:'Run an AI visibility check first.'};
  const {data:checks,error:ce}=await db.from('aeo_checks').select('prompt,engine,status,mentioned,cited,competitors,citations').eq('site_id',siteId).eq('run_id',run.id).in('engine',active).limit(1000);
  if(ce)throw new Error(ce.message);
  if(!Number.isFinite(Date.parse(run.finished_at||run.started_at))||Date.now()-Date.parse(run.finished_at||run.started_at)>14*86400000)return {created:0,reason:'Refresh AI visibility evidence: the latest completed run is older than the 14-day review policy.'};
  const rows=await visibilityTasks(siteId,run,checks||[]);
  if(!rows.length)return {created:0,reason:'No missing mentions or citations in the successful answers checked.'};
  // Stable IDs and ignoreDuplicates preserve completed/dismissed tasks and their original evidence.
  const {data:inserted,error:ie}=await db.from('tasks').upsert(rows,{onConflict:'site_id,id',ignoreDuplicates:true}).select('id');
  if(ie)throw new Error(ie.message);
  const policy=check(await db.from('automation_policies').select('*').eq('site_id',siteId).maybeSingle());
  if(policy?.weekly_content&&!policy.paused)await enqueue(db,siteId,'content_plan','content','aeo-content:'+run.id,{draft_limit:policy.content_per_week});
  return {created:inserted?.length||0,run_id:run.id,preparation:policy?.weekly_content&&!policy.paused?'queued':'paused'};
}
export async function visibilityReport(db:any,siteId:string,active:string[]) {
  const {data:runs,error}=await db.from('aeo_runs').select('*').eq('site_id',siteId).order('started_at',{ascending:false}).limit(16);
  if(error)throw new Error(error.message);
  const reports=await Promise.all((runs||[]).map(async(run:any)=>{
    const {data,error}=await db.from('aeo_checks').select('*').eq('site_id',siteId).eq('run_id',run.id).in('engine',active).limit(1000);
    if(error)throw new Error(error.message);const checks=data||[];
    return {run:{...run,engines:active,summary:summarizeChecks(checks)},checks};
  }));
  const valid=reports.filter((r:any)=>r.checks.length);
  return {runs:valid.map((r:any)=>r.run),checks:valid[0]?.checks||[],providers:active};
}


