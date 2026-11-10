import {check,enqueue,safeJobError} from './operations.ts';
import {copyHash,articleHtml} from './workspace.ts';
import {permittedCopy} from '../_shared/business.ts';
import {textContent} from './content-cycle.ts';
import {PAGE_CONTENT_READ,PAGE_CONTENT_WRITE} from '../_shared/page-content-api.ts';
export {PAGE_CONTENT_READ,PAGE_CONTENT_WRITE};
export function appendSection(before:string,id:string,body:string){
 if(!/^[0-9a-f-]{36}$/.test(id))throw new Error('Invalid content identifier.');
 const marker=`samaritan-${id}`;
 if(before.includes(marker))throw new Error('This content section is already present. Review its publishing record.');
 return before+`\n<section id="${marker}">\n${articleHtml(body)}\n</section>`;
}
async function current(p:any,deps:any){
 const c=check(await deps.db.from('connectors').select('*').eq('id',p.connector_id).eq('site_id',p.site_id).eq('type','shopify').single());
 if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(c.config?.shop||''))throw new Error('Invalid Shopify store hostname.');
 const token=await deps.secretFor(c.id);if(!token)throw new Error('Reconnect Shopify.');
 const r=await deps.shopify(c.config.shop,token,PAGE_CONTENT_READ,{id:p.target_id});
 if(!r.node)throw new Error('The target page is no longer available.');
 const url=p.target_kind==='product'?r.node.onlineStoreUrl:new URL((p.target_kind==='page'?'/pages/':'/collections/')+encodeURIComponent(r.node.handle),r.shop.primaryDomain.url).href;
 if(!url||new URL(url).protocol!=='https:')throw new Error('The target needs a public HTTPS storefront URL.');
 return {c,token,html:p.target_kind==='page'?r.node.body||'':r.node.descriptionHtml||'',url};
}
async function allowed(p:any,deps:any){
 const site=check(await deps.db.from('sites').select('*').eq('id',p.site_id).single());
 if(!site.active||!permittedCopy(p.snapshot.title+'\n'+p.snapshot.body,site))throw new Error('The current business rules prevent publishing this copy.');
 const draft=check(await deps.db.from('drafts').select('*').eq('site_id',p.site_id).eq('id',p.draft_id).single());
 if(draft.ranking_hold)throw new Error('This draft is held pending ranking evidence.');
 if(draft.status==='rejected'||await copyHash(draft.title,draft.body)!==p.snapshot.hash)throw new Error('The draft changed or was rejected. Prepare and approve the current version.');
}
export async function pageContentAction(body:any,deps:any){
 const {db}=deps,siteId=String(body.site_id||''),draftId=String(body.draft_id||'');
 if(body.action==='page_content_prepare'){
  const draft=check(await db.from('drafts').select('*').eq('id',draftId).eq('site_id',siteId).single());
  if(draft.ranking_hold)throw new Error('This draft is held pending ranking evidence.');
  if(draft.kind!=='FAQ section'||draft.status==='rejected'||!draft.body?.trim())throw new Error('Choose a prepared FAQ section.');
  const topic=check(await db.from('content_topics').select('*').eq('site_id',siteId).eq('draft_id',draftId).single());
  const page=check(await db.from('pages').select('*').eq('site_id',siteId).eq('url',topic.target_url).order('updated_at',{ascending:false}).limit(1).single());
  if(!['product','collection','page'].includes(page.kind)||!/^shopify:gid:\/\/shopify\/(Product|Collection|Page)\/\d+$/.test(page.key))throw new Error('The agency needs a supported Shopify page destination before publication.');
  const c=check(await db.from('connectors').select('id').eq('site_id',siteId).eq('type','shopify').eq('status','connected').single());
  const snapshot={title:draft.title,body:draft.body,hash:await copyHash(draft.title,draft.body)};
  const proposed={draft_id:draftId,site_id:siteId,connector_id:c.id,target_id:page.key.slice(8),target_kind:page.kind,snapshot};
  await allowed(proposed,deps);const read=await current(proposed,deps);
  const after=appendSection(read.html,draftId,draft.body),approvalHash=await copyHash(snapshot.hash,read.html+'\n'+read.url);
  const existing=check(await db.from('page_content_publications').select('status,approval_hash').eq('draft_id',draftId).eq('site_id',siteId).maybeSingle());
  const data={...proposed,url:read.url,before_html:read.html,after_html:after,approval_hash:approvalHash,error:null,status:'prepared'};
  if(existing){
   if(!['prepared','blocked'].includes(existing.status))throw new Error('This section already has an execution record. Check its state first.');
   const changed=check(await db.from('page_content_publications').update(data).eq('draft_id',draftId).eq('status',existing.status).eq('approval_hash',existing.approval_hash).select('draft_id'));
   if(!changed.length)throw new Error('Another action changed this proposal. Refresh first.');
  }else check(await db.from('page_content_publications').insert(data));
  return {draft_id:draftId,url:read.url,approval_hash:approvalHash,existing_text:textContent(read.html),addition:draft.body};
 }
 const p=check(await db.from('page_content_publications').select('*').eq('draft_id',draftId).eq('site_id',siteId).single());
 if(body.action==='page_content_approve'){
  if(!deps.actorId||body.approved_hash!==p.approval_hash||body.reviewed!==true)throw new Error('Review and approve this exact destination and content.');
  await allowed(p,deps);
  const rows=check(await db.from('page_content_publications').update({status:'approved',approved_by:deps.actorId}).eq('draft_id',draftId).eq('site_id',siteId).eq('status','prepared').eq('approval_hash',body.approved_hash).select('draft_id'));
  if(!rows.length)throw new Error('This proposal changed or has already been approved.');
  await enqueue(db,siteId,'page_content_publish','content','page-publish:'+draftId+':'+p.approval_hash,{draft_id:draftId});
  check(await db.from('drafts').update({status:'approved',decided_at:new Date().toISOString()}).eq('site_id',siteId).eq('id',draftId).eq('title',p.snapshot.title).eq('body',p.snapshot.body).eq('status','needs_review'));return {queued:true};
 }
 if(body.action==='page_content_verify')return verifyPageContent({site_id:siteId,payload:{draft_id:draftId}},deps);
 if(body.action==='page_content_reverse'){
  if(!deps.actorId||body.reviewed!==true||body.approved_hash!==p.approval_hash||!['published','uncertain'].includes(p.status))throw new Error('Confirm removal of the exact published section.');
  const read=await current(p,deps);if(read.html!==p.after_html)throw new Error('The page changed after publication. Your agency must review it before a rollback.');
  await enqueue(db,siteId,'page_content_reverse','content','page-reverse:'+draftId+':'+p.approval_hash,{draft_id:draftId});return {queued:true};
 }
 throw new Error('Unsupported page-content action.');
}
export async function publishPageContent(job:any,deps:any,reverse=false){
 const {db}=deps,p=check(await db.from('page_content_publications').select('*').eq('draft_id',job.payload.draft_id).eq('site_id',job.site_id).single());
 const from=reverse?p.after_html:p.before_html,to=reverse?p.before_html:p.after_html;let attempted=false,owned=false;
 if(!reverse&&p.status!=='approved'||reverse&&!['published','uncertain'].includes(p.status))throw new Error('This publication is not authorized in its current state.');
 try {
  if(!reverse)await allowed(p,deps);
  const read=await current(p,deps);if(read.html!==from)throw new Error('The live platform content changed. No write was attempted; prepare a fresh review.');
  const claimed=check(await db.from('page_content_publications').update({status:'applying',execution_kind:reverse?'rollback':'publish',attempted_at:new Date().toISOString()}).eq('draft_id',p.draft_id).eq('site_id',p.site_id).eq('status',p.status).select('draft_id'));
  if(!claimed.length)throw new Error('Another worker owns this publication.');
  owned=true;
  const variables=p.target_kind==='page'?{id:p.target_id,p:{body:to}}:{p:{id:p.target_id,descriptionHtml:to}};
  attempted=true;
  const result=await deps.shopify(read.c.config.shop,read.token,PAGE_CONTENT_WRITE[p.target_kind],variables);
  const errors=Object.values(result).flatMap((v:any)=>v?.userErrors||[]);if(errors.length)throw new Error(errors.map((e:any)=>e.message).join('; '));
  const after=await current(p,deps);if(after.html!==to)throw new Error('Provider readback does not confirm the approved change.');
  const saved=check(await db.from('page_content_publications').update({status:reverse?'reverted':'published',published_at:reverse?p.published_at:new Date().toISOString(),error:null,verification:{state:'platform_verified',checked_at:new Date().toISOString(),url:after.url,operation:reverse?'rollback':'publish'}}).eq('draft_id',p.draft_id).eq('site_id',p.site_id).eq('status','applying').select('draft_id'));
  if(!saved.length)throw new Error('Publication receipt changed during execution. Reconcile the live page before another action.');
  if(!reverse)await enqueue(db,p.site_id,'page_content_verify','content','page-verify:'+p.draft_id+':'+p.approval_hash,{draft_id:p.draft_id},new Date(Date.now()+120000).toISOString());
  return {summary:reverse?'Previous page content restored and confirmed in Shopify.':'Approved answer section saved. Public-page verification is queued.'};
 }catch(e){check(await db.from('page_content_publications').update({status:attempted?'uncertain':'blocked',error:safeJobError(e)}).eq('draft_id',p.draft_id).eq('site_id',p.site_id).eq('status',owned?'applying':p.status));throw e;}
}
export async function verifyPageContent(job:any,deps:any){
 const {db}=deps,p=check(await db.from('page_content_publications').select('*').eq('draft_id',job.payload.draft_id).eq('site_id',job.site_id).single());
 if(!['published','uncertain'].includes(p.status))throw new Error('This section has not been published.');
 const read=await current(p,deps),rollback=p.execution_kind==='rollback',platform=read.html===(rollback?p.before_html:p.after_html);
 if(rollback){const verification={state:platform?'platform_verified':'mismatch',operation:'rollback',url:read.url,checked_at:new Date().toISOString()};check(await db.from('page_content_publications').update({verification,...(platform?{status:'reverted',error:null}:{})}).eq('draft_id',p.draft_id).eq('site_id',p.site_id).eq('status',p.status));return {verification,needs_review:!platform,summary:platform?'Previous page content confirmed in Shopify.':'Rollback requires agency review.'};}
 const response=await (deps.fetch||fetch)(read.url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Public page returned '+response.status);
 const html=await response.text();if(html.length>3000000)throw new Error('Public page exceeds verification limit.');
 const paragraphs=articleHtml(p.snapshot.body).match(/<(?:p|li|h[1-6])\b[^>]*>[\s\S]*?<\/(?:p|li|h[1-6])>/g)||[];
 const links=[...articleHtml(p.snapshot.body).matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
 const match=platform&&links.every(link=>html.includes(link))&&paragraphs.length>0&&paragraphs.every(text=>textContent(html).includes(textContent(text)));
 const verification={state:match?'verified':platform?'platform_verified':'mismatch',url:read.url,checked_at:new Date().toISOString()};
 check(await db.from('page_content_publications').update({verification,...(platform?{status:'published',error:null}:{})}).eq('draft_id',p.draft_id).eq('site_id',p.site_id).in('status',['published','uncertain']));
 return {verification,needs_review:!match,summary:match?'Approved answer section confirmed on the public page.':'Answer section needs publication review.'};
}


