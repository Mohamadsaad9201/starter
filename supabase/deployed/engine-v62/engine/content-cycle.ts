import {safeArticleUrl} from '../_shared/article-format.ts';
import {check,enqueue} from './operations.ts';
import {workspaceAction,copyHash,articleHtml} from './workspace.ts';
export function textContent(html:string) {
 return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#(?:39|x27);/gi,"'").replace(/\s+/g,' ').trim();
}
export function verificationResult(article:any,snapshot:any,publicHtml:string|null) {
 const expected=articleHtml(snapshot.body);const links=(html:string)=>[...String(html).matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1].replaceAll('&amp;','&')).sort();const wanted=links(expected);const same=JSON.stringify(links(article?.body||''))===JSON.stringify(wanted)&&article?.title===snapshot.title&&textContent(article?.body||'')===textContent(expected)&&article?.isPublished===true;
 const paragraphs=expected.match(/<(?:p|li|h[1-6])\b[^>]*>[\s\S]*?<\/(?:p|li|h[1-6])>/g)||[];
 const publicText=publicHtml===null?'':textContent(publicHtml);
 const publicMatch=same&&!!publicHtml&&paragraphs.length>0&&paragraphs.every(p=>publicText.includes(textContent(p)))&&publicText.includes(snapshot.title)&&wanted.every(href=>links(publicHtml||'').includes(href));
 return {platform_match:same,public_match:publicMatch,state:publicMatch?'verified':same?'platform_verified':'mismatch'};
}
export function pendingContentDrafts(drafts:any[],reviews:any[],publications:any[]){return drafts.filter(x=>!publications.some(p=>p.draft_id===x.id&&['approved','publishing','applying','published','uncertain','reverted'].includes(p.status))&&!reviews.some(r=>r.item_kind==='draft'&&r.item_id===String(x.id)&&r.decision==='approved'&&r.snapshot?.title===x.title&&r.snapshot?.body===x.body));}
export async function contentPlan(job:any,deps:any) {
 const {db}=deps;
 const policy=check(await db.from('automation_policies').select('*').eq('site_id',job.site_id).single());
 if(job.payload?.discovery_only){if(policy.paused||!policy.daily_topics)return {summary:'Daily topic discovery is paused.'};const result=await workspaceAction({action:'topics_refresh',site_id:job.site_id,target:policy.topics_per_day},deps);return {...result,topics:result.topics?.length||0,summary:result.reason||`${result.created_count||0} fresh topic briefs prepared.`,needs_review:result.needs_attention===true};}
 if(policy.paused||!policy.weekly_content)return {summary:'Content preparation is paused.'};
 const since=new Date(Date.now()-7*86400000).toISOString();
 const recent=check(await db.from('drafts').select('id').eq('site_id',job.site_id).in('kind',['Blog post','FAQ section']).gte('created_at',since));
 const [pendingRows,reviewRows,articleRows,pageRows]=await Promise.all([
 db.from('drafts').select('id,title,body').eq('site_id',job.site_id).in('kind',['Blog post','FAQ section']).eq('status','needs_review'),
 db.from('client_reviews').select('item_kind,item_id,decision,snapshot').eq('site_id',job.site_id).eq('item_kind','draft').eq('decision','approved'),
 db.from('content_publications').select('draft_id,status').eq('site_id',job.site_id),
 db.from('page_content_publications').select('draft_id,status').eq('site_id',job.site_id)]);
 const waiting=pendingContentDrafts(check(pendingRows),check(reviewRows),[...check(articleRows),...check(pageRows)]);
 const slots=Math.max(0,Math.min(policy.content_per_week-recent.length,2-waiting.length));
 if(!slots)return {summary:'The content allowance or review queue is full. Existing drafts are ready for a decision.'};
 const result=await workspaceAction({action:'topics_refresh',site_id:job.site_id,request_id:job.payload?.request_id,request_version:job.payload?.request_version},deps);
 const limit=Math.min(slots,Math.max(0,Math.min(3,Number(job.payload?.draft_limit)||policy.content_per_week)));
 const chosen=result.topics.filter((x:any)=>x.status==='suggested'&&x.ranking_evidence?.version==='ranking-v1'&&(!job.payload?.request_id||x.source_request_id===job.payload.request_id)).sort((a:any,b:any)=>Number(!!b.source_task_id)-Number(!!a.source_task_id)).slice(0,limit);
 for(const topic of chosen)await enqueue(deps.db,job.site_id,'topic_draft','content',`draft:${topic.id}`,{topic_id:topic.id});
 return {topics:result.topics.length,drafts_queued:chosen.length,summary:chosen.length?`${chosen.length} content draft queued for review.`:result.reason||'No additional draft was warranted by current evidence.'};
}
export async function schedulePublication(body:any,deps:any) {
 const {db}=deps;
 const draft=check(await db.from('drafts').select('*').eq('site_id',body.site_id).eq('id',body.draft_id).single());
 if(draft.ranking_hold)throw Error('This article is held pending ranking evidence.');
 if(draft.kind!=='Blog post'||body.approved_hash!==await copyHash(draft.title,draft.body))throw new Error('The article changed. Review and approve the latest version.');
 const destinations=await workspaceAction({action:'blog_destinations',site_id:body.site_id},deps);
 if(!destinations.canPublish||!destinations.blogs.some((b:any)=>b.id===body.blog_id))throw new Error('Select an authorized Shopify blog.');
 const at=body.run_after?Date.parse(body.run_after):Date.now();
 if(!Number.isFinite(at)||at<Date.now()-60000||at>Date.now()+90*86400000)throw new Error('Choose a publication time within the next 90 days.');
 const jobs=await queuePublication(db,body.site_id,draft.id,body.blog_id,body.approved_hash,new Date(at).toISOString());
 check(await db.from('drafts').update({status:'approved',decided_at:new Date().toISOString()}).eq('site_id',body.site_id).eq('id',draft.id).eq('title',draft.title).eq('body',draft.body).eq('status','needs_review'));
 return {queued:true,jobs};
}
export async function queuePublication(db:any,siteId:string,draftId:string,blogId:string,approvedHash:string,runAfter:string) {
 const key=`publish:${draftId}:${approvedHash}`,payload={draft_id:draftId,blog_id:blogId,approved_hash:approvedHash};
 const existing=check(await db.from('operation_jobs').select('id,status').eq('site_id',siteId).eq('dedupe_key',key).maybeSingle());
 if(existing) {
  if(!['queued','cancelled'].includes(existing.status))throw new Error('This publication has already started. Review its saved status before another attempt.');
  // Only work which has never started can be rescheduled by a fresh exact-copy approval.
  const jobs=check(await db.from('operation_jobs').update({status:'queued',payload,run_after:runAfter,finished_at:null,error:null}).eq('id',existing.id).eq('site_id',siteId).eq('status',existing.status).select('id'));
  if(!jobs.length)throw new Error('The publication started while you were scheduling it. Refresh its status.');
  return jobs;
 }
 const jobs=await enqueue(db,siteId,'blog_publish','content',key,payload,runAfter);
 if(!jobs.length)throw new Error('Another publication request was saved. Refresh its status before changing the schedule.');
 return jobs;
}
export async function publishArticle(job:any,deps:any) {
 const result=await workspaceAction({action:'blog_publish',site_id:job.site_id,...job.payload},deps);
 await enqueue(deps.db,job.site_id,'publication_verify','content',`verify:${job.payload.draft_id}`,{draft_id:job.payload.draft_id},new Date(Date.now()+120000).toISOString());
 return {...result,summary:'Shopify accepted the approved article. Verification is queued.'};
}
export async function verifyArticle(job:any,deps:any) {
 const {db,shopify,secretFor}=deps;
 const p=check(await db.from('content_publications').select('*').eq('site_id',job.site_id).eq('draft_id',job.payload.draft_id).single());
 if(!p.external_id)throw new Error('No confirmed Shopify article ID. Reconcile publication before verification.');
 const c=check(await db.from('connectors').select('*').eq('site_id',job.site_id).eq('id',p.connector_id).single());
 const token=await secretFor(c.id);if(!token)throw new Error('Reconnect Shopify.');
 const read=await shopify(c.config.shop,token,'query($id: ID!){article(id:$id){id title body isPublished handle blog{handle}} shop{primaryDomain{url}}}',{id:p.external_id});
 if(!read.article)throw new Error('Shopify article no longer exists.');
 const base=new URL(read.shop.primaryDomain.url);
 if(!safeArticleUrl(base.href)||base.protocol!=='https:'||base.username||base.password)throw new Error('Invalid storefront origin.');
 const url=new URL(`/blogs/${encodeURIComponent(read.article.blog.handle)}/${encodeURIComponent(read.article.handle)}`,base).href;
 let html=null,publicError=null;
 try{const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`Storefront returned ${response.status}`);html=await response.text();if(html.length>3000000)throw new Error('Storefront response exceeds verification limit.');}catch(e){publicError=(e as Error).message;html=null;}
 const verification={...verificationResult(read.article,p.snapshot,html),url,checked_at:new Date().toISOString(),public_error:publicError};
 check(await db.from('content_publications').update({verification}).eq('draft_id',p.draft_id).eq('site_id',job.site_id));
 if(verification.platform_match)await enqueue(db,job.site_id,'content_measure','content',`measure:${p.draft_id}:28`,{draft_id:p.draft_id},new Date(Date.parse(p.published_at)+30*86400000).toISOString());
 return {verification,needs_review:verification.state!=='verified',summary:verification.state==='verified'?'Approved article confirmed in Shopify and on the public page.':'Publication needs review. See platform and public-page checks.'};
}
export async function measureArticle(job:any,deps:any) {
 const {db,gsc}=deps;
 const p=check(await db.from('content_publications').select('*').eq('site_id',job.site_id).eq('draft_id',job.payload.draft_id).single());
 const c=check(await db.from('connectors').select('*').eq('site_id',job.site_id).eq('type','gsc').maybeSingle());
 if(!c?.config?.property||!p.verification?.url)throw new Error('Article measurement needs Search Console and a verified publication URL.');
 const startDate=new Date(Date.parse(p.published_at)+86400000).toISOString().slice(0,10),endDate=new Date(Date.parse(p.published_at)+28*86400000).toISOString().slice(0,10);
 if(Date.parse(endDate)>Date.now()-2*86400000)throw new Error('The complete 28-day measurement window is not available yet.');
 const result=await gsc(`/sites/${encodeURIComponent(c.config.property)}/searchAnalytics/query`,{method:'POST',body:JSON.stringify({startDate,endDate,dimensions:['date'],dimensionFilterGroups:[{filters:[{dimension:'page',operator:'equals',expression:p.verification.url}]}],dataState:'final',rowLimit:100})},c);
 const rows=result.rows||[],measurement={source:'Google Search Console',start_date:startDate,end_date:endDate,url:p.verification.url,clicks:rows.reduce((n:number,r:any)=>n+r.clicks,0),impressions:rows.reduce((n:number,r:any)=>n+r.impressions,0),returned_days:rows.length,measured_at:new Date().toISOString(),interpretation:'Reported search performance after publication; not proof of incremental impact. Missing dates have no returned rows.'};
 check(await db.from('content_publications').update({measurement}).eq('draft_id',p.draft_id).eq('site_id',job.site_id));
 return {measurement,summary:'First 28 days of reported article search performance recorded.'};
}


