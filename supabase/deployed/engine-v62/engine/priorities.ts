import {brandBrief,permittedCopy} from '../_shared/business.ts';
import {check} from './operations.ts';
export function priorityPlan(value:any,site:any) {
 if(!Array.isArray(value?.tasks)||!value.tasks.length||value.tasks.length>6)throw Error('A focused plan needs one to six reviewable tasks.');
 const tasks=value.tasks.map((t:any)=>{
  if(!['seo','geo','content','paid','strategy'].includes(t.channel)||['title','why','evidence_needed','measure'].some(k=>typeof t[k]!=='string'||t[k].trim().length<8||t[k].length>1000))throw Error('The plan needs specific tasks, evidence requirements and measures.');
  if(!permittedCopy(t.title+' '+t.why,site))throw Error('The plan repeats an excluded business claim.');
  return {channel:t.channel,title:t.title.trim(),why:t.why.trim(),evidence_needed:t.evidence_needed.trim(),measure:t.measure.trim(),state:'planned'};
 });
 return {tasks,prepared_at:new Date().toISOString(),notice:'Planning guidance. Activation guides future agent work; it does not launch campaigns, publish pages or guarantee a ranking.'};
}
export async function preparePriority(body:any,deps:any) {
 const {db,ai}=deps,sid=String(body.site_id||'');
 const site=check(await db.from('sites').select('*').eq('id',sid).single());
 const p=check(await db.from('business_priorities').select('*').eq('id',body.priority_id).eq('site_id',sid).single());
 if(!site?.active||!p||!['requested','planned'].includes(p.status))throw Error('Choose a requested priority. Active plans cannot be silently regenerated.');
 const raw=await ai(`You plan work for an expert-backed marketing agency. ${brandBrief(site)}\nLimit work to SEO, GEO/AEO and paid advertising. No email, SMS, organic social or sales follow-up tasks. Turn the client's priority into up to six concrete tasks in a sensible sequence. Return JSON {"tasks":[{"channel":"seo|geo|content|paid|strategy","title":"specific action","why":"why this serves the objective","evidence_needed":"facts, access or data to verify first","measure":"observable outcome and its source"}]}. Do not invent completed work, keyword volumes, dates, access, baseline numbers or competitor findings. A number-one ranking is an ambition, not a guarantee. For local search define location, query set, map/organic distinction and a repeatable baseline. For seasonal campaigns verify launch dates, product availability, inventory and delivery cutoffs; do not assume holiday dates. Paid work requires human budget decisions and applicable platform-policy review. Flag missing prerequisites explicitly. All tasks are planning proposals; existing execution approval rules remain in force.`,JSON.stringify({objective:p.objective,context:p.context,location:p.location,target_date:p.target_date,success_measure:p.success_measure}),3000);
 let parsed;try{const text=String(raw).replace(/```(?:json)?/g,'');parsed=JSON.parse(text.slice(text.indexOf('{'),text.lastIndexOf('}')+1));}catch{throw Error('A usable plan was not returned. Your brief is saved; try again.');}
 const plan=priorityPlan(parsed,site);
 // A correction can arrive while the model is writing; recheck current exclusions.
 const current=check(await db.from('sites').select('brand').eq('id',sid).single());priorityPlan(plan,current);
 const saved=check(await db.from('business_priorities').update({plan,status:'planned',updated_at:new Date().toISOString()}).eq('id',p.id).eq('site_id',sid).eq('status',p.status).select('id'));
 if(!saved.length)throw Error('This priority changed while the plan was prepared. Refresh.');return {plan};
}


