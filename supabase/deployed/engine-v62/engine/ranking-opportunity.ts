// Evidence floors are product triage rules, not Google ranking factors.
export const RANKING_OPPORTUNITY_VERSION='ranking-v1';
export function eligibleSearchQuery(q:any){return typeof q?.query==='string'&&q.query.trim().length>0&&Number(q.impressions)>=20&&Number.isFinite(Number(q.position))&&Number(q.position)>3&&Number(q.position)<=30;}
export function verifiedRankingOpportunity(t:any,baseline:any,now=Date.now()){
 if(baseline?.status!=='available'||baseline.url!==t.existing_page_url)return null;
 const query=(baseline.queries||[]).find((q:any)=>q.query.trim().toLowerCase()===String(t.query||'').trim().toLowerCase()&&eligibleSearchQuery(q));
 if(!query)return null;
 return {version:RANKING_OPPORTUNITY_VERSION,verified_at:new Date(now).toISOString(),target_url:t.existing_page_url,query:query.query,impressions:Number(query.impressions),position:Number(query.position),clicks:Number(query.clicks||0),customer_task:t.customer_task,mechanism:t.added_value,measurement:'Query-level average position, impressions and organic clicks; review after 28 complete days. No guaranteed uplift.'};
}
export function validRankingOpportunity(e:any,url:string,now=Date.now()){return e?.version===RANKING_OPPORTUNITY_VERSION&&e.target_url===url&&eligibleSearchQuery(e)&&typeof e.mechanism==='string'&&e.mechanism.length>=8&&Number.isFinite(Date.parse(e.verified_at))&&now-Date.parse(e.verified_at)<=7*86400000&&Date.parse(e.verified_at)<=now+60000;}
