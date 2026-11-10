// Deterministic safeguards. These are product risk policies, not ranking factors.
import { SEARCH_POLICY_VERSION, SEARCH_SOURCES } from "../_shared/search-knowledge.ts";
export { SEARCH_POLICY_VERSION, SEARCH_SOURCES };
const clean=(v:any)=>String(v||'').replace(/\s+/g,' ').trim();
export const missingCopy=(v:any)=>!clean(v)||clean(v)==='(none)';
// A candidate must change search relevance, not satisfy a formatting score.
const placeholderTitle=(v:any)=>/^(?:(?:copy of|untitled|default title|new product)(?:\s*[-:|]\s*.*)?|home|page|product)$/i.test(clean(v));
export function rankingCandidate(item:any){return item.type==='title'&&(missingCopy(item.current??item.before)||placeholderTitle(item.current??item.before));}
export function listingDefects(type:string,current:any,item:any={}) {
 if(type!=='title'||missingCopy(current))return [];
 return placeholderTitle(current)?['Missing descriptive page identity (placeholder title)']:[];
}
export function searchDecision(item:any,baseline:any={status:'unavailable'}) {
 const current=item.current??item.before,context=clean(item.context??item.ctx);
 const common={version:SEARCH_POLICY_VERSION,baseline,sources:SEARCH_SOURCES,expected_uplift:null,
 measurement:{primary:'Query-level average position with impressions and organic clicks',secondary:'Qualified leads or purchases where attributable',window:'Compare 28 complete days before and after publication; extend for low volume.',confounders:['Seasonality','Query/device/country mix','Other edits and campaigns'],interpretation:'An improvement hypothesis, not a promised ranking gain. Before/after observations do not establish causality.'}};
 if(item.type!=='title')return {...common,decision:'leave_unchanged',reason:'Meta description housekeeping is not a ranking-improvement decision.'};
 if(!rankingCandidate(item))return {...common,decision:'leave_unchanged',reason:'Preserve the descriptive existing title. Length, capitalization, separators and duplicates alone do not establish a ranking opportunity. A query-backed rewrite requires a reviewed search experiment.',protected_terms:clean(current)};
 if(!context||!clean(item.name)||placeholderTitle(item.name))return {...common,decision:'needs_evidence',reason:'A missing or placeholder title requires verified page content and a descriptive page identity before it can be repaired.'};
 return {...common,decision:'draft_for_review',rewrite:!missingCopy(current),defects:missingCopy(current)?['Missing page title']:listingDefects('title',current),ranking_mechanism:'Restore a descriptive, content-supported page identity for search engines and searchers.',reason:'The page lacks a descriptive title. Prepare an accurate title from verified page content; do not rewrite functioning listings.',hypothesis:'A descriptive title can clarify the page subject and relevance. Measure actual query position, impressions and clicks after the change.',risk:'This is a search foundation repair. It does not prove that the page will rank higher.',protected_terms:clean(item.name)};
}
function totals(rows:any[]) {
  if(!rows.length)return null;
  const clicks=rows.reduce((n,r)=>n+Number(r.clicks||0),0),impressions=rows.reduce((n,r)=>n+Number(r.impressions||0),0);
  return {clicks,impressions,ctr:impressions?clicks/impressions:null,position:impressions?rows.reduce((n,r)=>n+Number(r.position||0)*Number(r.impressions||0),0)/impressions:null};
}
// Queries are scoped to the exact page and the tenant's connected property. Query
// rows can be privacy-filtered/truncated and must never substitute for page totals.
export async function pageSearchBaseline(db:any,gsc:any,siteId:string,url:string,now=Date.now()) {
  const fetched_at=new Date(now).toISOString();
  try {
    const {data:c,error}=await db.from('connectors').select('*').eq('site_id',siteId).eq('type','gsc').eq('status','connected').maybeSingle();
    if(error)throw Error(error.message);
    if(!c?.config?.property)return {status:'not_connected',fetched_at};
    const day=(offset:number)=>new Date(now-offset*86400000).toISOString().slice(0,10);
    const currentWindow={startDate:day(30),endDate:day(3)},previousWindow={startDate:day(58),endDate:day(31)};
    const query=(window:any,dimensions:string[]=[])=>gsc(`/sites/${encodeURIComponent(c.config.property)}/searchAnalytics/query`,{method:'POST',body:JSON.stringify({...window,dimensions,dataState:'final',dimensionFilterGroups:[{filters:[{dimension:'page',operator:'equals',expression:url}]}],rowLimit:dimensions.length?100:1})},c);
    const [current,previous,queries]=await Promise.all([query(currentWindow),query(previousWindow),query(currentWindow,['query'])]);
    return {status:'available',fetched_at,url,current_window:currentWindow,previous_window:previousWindow,current:totals(current.rows||[]),previous:totals(previous.rows||[]),queries:(queries.rows||[]).map((r:any)=>({query:r.keys[0],clicks:r.clicks,impressions:r.impressions,position:r.position})),query_coverage:'Up to 100 returned queries; anonymized and omitted rows are not included.',business_outcomes:'Page-level conversions and profit unavailable in this evidence set.',causal:false};
  } catch {return {status:'read_failed',fetched_at,reason:'Search Console baseline could not be read. Do not interpret as zero traffic.'};}
}
// Reject unsupported numbers rather than shortening generated copy destructively.
export function copyEvidenceError(value:string,item:any,site:any) {
  if(value.length>500)return 'Copy is too verbose; rewrite without cutting words mechanically.';
  const evidence=clean([item.name,item.current,item.context,site.brand?.facts].join(' ')).toLowerCase();
  const numbers=new Set(evidence.match(/\d+(?:[.,]\d+)*/g)||[]);
  for(const number of value.match(/\d+(?:[.,]\d+)*/g)||[])if(!numbers.has(number))return 'A numerical claim is not present in the supplied evidence.';
  if(/https?:|<[^>]+>/.test(value))return 'Search listing must be plain text.';
  return '';
}
export async function evidenceFingerprint(f:any) {
  const bytes=new TextEncoder().encode(JSON.stringify([f.site_id,f.url,f.field,f.before,f.after,SEARCH_POLICY_VERSION]));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function assertSearchPublishable(f:any,now=Date.now()) {
  if(!['seo.title','seo.description'].includes(f.field)||f.status==='rollback_requested')return;
  const s=f.data?.search_strategy;
  if(f.field==='seo.description')throw Error('Meta descriptions are not eligible for the ranking-improvement decision queue.');
  if(!rankingCandidate({type:'title',before:f.before})||!s?.ranking_mechanism)throw Error('This title rewrite has no verified ranking defect. Use a query-backed reviewed experiment.');
  // Existing listings may change only through a reviewed rewrite with recorded, objective defects.
  if(s?.version!==SEARCH_POLICY_VERSION||s.decision!=='draft_for_review'||(!missingCopy(f.before)&&!(s.rewrite&&s.defects?.length))||s.fingerprint!==await evidenceFingerprint(f))throw Error('This SEO suggestion needs a new evidence review. Run a fresh website check.');
  if(!Number.isFinite(Date.parse(s.reviewed_at))||now-Date.parse(s.reviewed_at)>7*86400000||Date.parse(s.reviewed_at)>now+60000)throw Error('This SEO evidence is stale. Run a fresh website check before publishing.');
}


