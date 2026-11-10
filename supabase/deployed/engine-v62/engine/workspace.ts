import {validRankingOpportunity} from './ranking-opportunity.ts';
import {pageSearchBaseline} from './search-strategy.ts';
import {discoverTopics} from './topics-daily.ts';
import {PAGE_CONTENT_READ} from '../_shared/page-content-api.ts';
import { validTopic } from "../_shared/seo-policy.ts";
import { businessContext, groundedReply } from './context.ts';
import { brandBrief, permittedCopy } from '../_shared/business.ts';
import { renderArticleHtml, articleLinks } from '../_shared/article-format.ts';
export const BLOGS_QUERY = `query { currentAppInstallation { accessScopes { handle } } blogs(first: 50) { nodes { id title handle } } }`;
export const ARTICLE_CREATE = `mutation($article: ArticleCreateInput!) { articleCreate(article: $article) { article { id handle } userErrors { field message } } }`;
export function articleHtml(text: string): string {
  return renderArticleHtml(text);
}
export async function copyHash(title: string, body: string) {
  const bytes = new TextEncoder().encode(JSON.stringify([title,body]));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function allowedActions(items: any) {
  const allowed=['visibility','content','fixes','analytics','connections','audit'];
  return Array.isArray(items) ? [...new Set(items.filter(x=>allowed.includes(x)))].slice(0,3) : [];
}
function parse(text: string|null) { try { return JSON.parse((text||'').replace(/^```(?:json)?\s*|\s*```$/g,'')); } catch { throw new Error('The assistant could not finish a reliable response. Please try again.'); } }
export async function workspaceAction(body:any, deps:any) {
  const {db,ai,shopify,secretFor,writeDraft}=deps;
  const siteId=String(body.site_id||'');
  const {data:site,error:siteError}=await db.from('sites').select('*').eq('id',siteId).single();
  if(siteError||!site) throw new Error('Business not found');
  const check=(r:any)=>{if(r.error)throw new Error(r.error.message);return r.data;};
  const topics=()=>db.from('content_topics').select('*').eq('site_id',siteId).order('created_at',{ascending:false}).limit(120);
  const connector=async()=>{
    const r=await db.from('connectors').select('*').eq('site_id',siteId).eq('type','shopify').eq('status','connected').limit(1).maybeSingle();
    const c=check(r);if(!c)throw new Error('A supported publishing connection is required. Your agency will resolve the destination before publication.');
    if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(c.config?.shop||''))throw new Error('Invalid Shopify store hostname');
    const token=await secretFor(c.id);if(!token)throw new Error('Reconnect Shopify');return {c,token};
  };
  if(body.action==='workspace_load') {
    const [t,p,m,b]=await Promise.all([topics(),db.from('content_publications').select('draft_id,status,external_id,external_handle,error,published_at,verification,measurement').eq('site_id',siteId),db.from('assistant_turns').select('id,question,answer,actions,created_at').eq('site_id',siteId).not('answer','is',null).order('created_at',{ascending:false}).limit(8),db.from('content_discovery_batches').select('day,status,target,created_count,reason,started_at,finished_at').eq('site_id',siteId).order('day',{ascending:false}).limit(1)]);
    return {topics:check(t),publications:check(p),messages:check(m).reverse(),discovery:check(b)[0]||null};
  }
  if(body.action==='assistant') {
    const question=String(body.question||'').trim();if(!question||question.length>2000)throw new Error('Ask a question using 2,000 characters or fewer.');
    const {count,error}=await db.from('assistant_turns').select('id',{count:'exact',head:true}).eq('site_id',siteId).gte('created_at',new Date(Date.now()-86400000).toISOString());
    if(error)throw new Error(error.message);if((count||0)>=60)throw new Error('Daily assistant limit reached. Try again tomorrow.');
    const turn=check(await db.from('assistant_turns').insert({site_id:siteId,question}).select('id').single());
    const context=await businessContext(db,site,question,deps.activeEngines||['chatgpt','claude'],deps.sales);
    const recent=check(await db.from('assistant_turns').select('question,answer').eq('site_id',siteId).not('answer','is',null).order('created_at',{ascending:false}).limit(4));
    const reply=await groundedReply(site,question,context,recent.reverse(),ai);
    const answer=reply.answer,actions=allowedActions(reply.actions);
    check(await db.from('assistant_turns').update({answer,actions}).eq('id',turn.id));return {answer,actions};
  }
  if(body.action==='topics_refresh')return discoverTopics(body,{...deps,site});
  if(body.action==='topic_draft') {
    const t=check(await db.from('content_topics').select('*').eq('id',body.topic_id).eq('site_id',siteId).single());
    if(t.draft_id)return {id:t.draft_id};
    if(!validRankingOpportunity(t.ranking_evidence,t.target_url))throw Error('This topic has no current page-level ranking evidence. It is held out of drafting.');
    const fresh=await pageSearchBaseline(db,deps.gsc,siteId,t.target_url);
    if(fresh.status!=='available'||!fresh.queries?.some((q:any)=>q.query===t.ranking_evidence.query&&Number(q.impressions)>=20&&Number(q.position)>3&&Number(q.position)<=30))throw Error('The search opportunity changed. Refresh the evidence before drafting.');
    if(t.source_request_id){const request=check(await db.from('agency_requests').select('status,version').eq('site_id',siteId).eq('id',t.source_request_id).single());if(!request||['cancelled','completed'].includes(request.status)||request.version!==t.request_version)throw new Error('The source request changed. Review the brief before drafting.');}
    // A timed-out write is held for agency review, never silently duplicated.
    const claimed=check(await db.from('content_topics').update({status:'writing',started_at:new Date().toISOString(),error:null}).eq('id',t.id).eq('status','suggested').select('id'));
    if(!claimed.length)throw new Error('This topic is already being written or needs agency review.');
    try {
      let pageEvidence='';
      if(t.draft_kind==='FAQ section') {
       const page=check(await db.from('pages').select('*').eq('site_id',siteId).eq('url',t.target_url).order('updated_at',{ascending:false}).limit(1).single());
       if(!/^shopify:gid:\/\/shopify\/(Product|Collection|Page)\/\d+$/.test(page.key))throw new Error('This answer section needs a supported Shopify page. Agency review is required.');
       const {c,token}=await connector(),r=await shopify(c.config.shop,token,PAGE_CONTENT_READ,{id:page.key.slice(8)});
       if(!r.node)throw new Error('The target page was not found.');
       const html=r.node.body??r.node.descriptionHtml??'';
       if(html.length>30000)throw new Error('The target content exceeds the focused review limit. Agency review is required.');
       pageEvidence='\nCURRENT TARGET PAGE (preserve this; do not repeat existing answers): '+html+'\nPrepare only additional useful questions and answers. No editorial notes or instructions in the deliverable.';
      }
      const result=await writeDraft(siteId,'seo',t.draft_kind||'Blog post',t.title,`${t.brief}${pageEvidence}\nWrite the requested deliverable, using only facts grounded in the brief and business context. For an FAQ section, supply only the additional questions and answers for the existing target page, with no invented facts, offers or repeated existing content. Otherwise write a useful article at the length needed to answer the customer task; do not pad to a word count. Do not invent factual claims, products, prices or customer testimonials. Use clear headings. The client will review before publishing.`);
      check(await db.from('content_topics').update({status:'drafted',draft_id:result.id}).eq('id',t.id));return result;
    } catch(e) {await db.from('content_topics').update((e as any).safeToRetry?{status:'suggested',error:(e as Error).message}:{error:'Writing was interrupted. Ask the agency to review before retrying.'}).eq('id',t.id);throw e;}
  }
  if(body.action==='blog_destinations') {
    const {c,token}=await connector();const j=await shopify(c.config.shop,token,BLOGS_QUERY);return {blogs:j.blogs.nodes,canPublish:j.currentAppInstallation?.accessScopes?.some((s:any)=>s.handle==='write_content')===true};
  }
  if(body.action==='blog_publish') {
    const draft=check(await db.from('drafts').select('*').eq('id',body.draft_id).eq('site_id',siteId).single());
    if(draft.ranking_hold)throw new Error('This article is held pending ranking evidence and cannot be published.');
    if(draft.kind!=='Blog post'||!draft.body?.trim())throw new Error('Only a completed blog post can be published.');
    if(body.approved_hash!==await copyHash(draft.title,draft.body))throw new Error('This draft changed. Review the latest version before approving.');
    if(!permittedCopy(draft.title+'\n'+draft.body,site))throw new Error('The draft contains a phrase excluded by your business rules.');
    if(articleLinks(draft.body).some((link:any)=>!link.url))throw new Error('This article has an unsupported or unsafe link. Edit its destination and review the updated draft before publishing.');
    const {c,token}=await connector();const destinations=await shopify(c.config.shop,token,BLOGS_QUERY);
    if(!destinations.currentAppInstallation?.accessScopes?.some((s:any)=>s.handle==='write_content'))throw new Error('The Shopify connection needs write_content permission to publish articles. Update the app permissions and reconnect.');
    if(!destinations.blogs.nodes.some((x:any)=>x.id===body.blog_id))throw new Error('Choose a blog on this store.');
    const snapshot={title:draft.title,body:draft.body,hash:body.approved_hash};
    const inserted=await db.from('content_publications').insert({draft_id:draft.id,site_id:siteId,status:'publishing',snapshot,blog_id:body.blog_id,connector_id:c.id});
    if(inserted.error)throw new Error('This draft already has a publishing record. Review its status; do not publish it again.');
    let created:any;
    try {
      const result=await shopify(c.config.shop,token,ARTICLE_CREATE,{article:{blogId:body.blog_id,title:draft.title,body:articleHtml(draft.body),author:{name:site.name},handle:`impactful-${draft.id}`,isPublished:true}});
      if(result.articleCreate.userErrors?.length) {
        check(await db.from('content_publications').update({status:'failed',error:result.articleCreate.userErrors.map((e:any)=>e.message).join('; ').slice(0,500)}).eq('draft_id',draft.id));
        throw new Error('Shopify rejected the article. See the publishing status for details.');
      }
      created=result.articleCreate.article;if(!created?.id)throw new Error('No confirmed article returned');
      check(await db.from('content_publications').update({status:'published',external_id:created.id,external_handle:created.handle,published_at:new Date().toISOString()}).eq('draft_id',draft.id));
      check(await db.from('drafts').update({status:'approved',decided_at:new Date().toISOString()}).eq('id',draft.id));
      return {published:true,id:created.id};
    } catch(e) {
      // Unknown transport/database outcomes must never trigger a second create.
      await db.from('content_publications').update({status:'uncertain',error:'Publishing could not be confirmed. The agency must check Shopify before any retry.',...(created?.id?{external_id:created.id}:{})}).eq('draft_id',draft.id).eq('status','publishing');
      throw e;
    }
  }
  throw new Error('Unknown workspace action');
}


