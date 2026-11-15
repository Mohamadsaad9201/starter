// Copied verbatim from engine/paid-scope.ts (PAID_ACTIONS) and engine/paid-cycle.ts
// (validatePaidCandidate) so the agent is held to exactly the same rules as the
// current specialist. When the agent is wired into the engine, import the
// originals instead of this copy.
export const PAID_ACTIONS=['search_campaign','campaign_status','daily_budget','reallocate_budget','ad_group_bid','bidding_target','add_keywords','negative_keywords','keyword_status','search_ad','ad_group_status','ad_status','ad_schedule','device_bid','placement_exclusion','audience_exclusion','audience_observation','broad_match_test'];

export function validatePaidCandidate(candidate:any,observation:any,configuration:any){
 const p=candidate.plan,goal=configuration?.goal,known=observation.campaigns.find((c:any)=>c.id===p?.campaign_id);
 if(!p||!PAID_ACTIONS.includes(p.kind)||typeof candidate.rationale!=='string'||candidate.rationale.length<20)throw Error('A specific supported plan and reason are required.');
 if(p.kind!=='search_campaign'&&!known)throw Error('The agent referenced a campaign outside the observed account.');
 if(known&&known.channel!=='SEARCH'&&p.kind!=='campaign_status'&&!(p.kind==='placement_exclusion'&&known.channel==='DISPLAY'))throw Error('This campaign type needs a different adapter.');
 if(['daily_budget','ad_group_bid','bidding_target','reallocate_budget','broad_match_test'].includes(p.kind)){
  if(!goal||!observation.tracking.usable||known.current.conversions<goal.minimum_conversions||known.previous.conversions<goal.minimum_conversions)throw Error('Mature primary-conversion evidence is insufficient for this performance change.');
 }
 if(p.kind==='negative_keywords'){
  const terms=observation.search_terms.filter((r:any)=>String(r.campaign.id)===p.campaign_id).map((r:any)=>r.searchTermView.searchTerm.toLowerCase());
  if(!Array.isArray(p.keywords)||p.keywords.some((k:any)=>k.match!=='EXACT'||!terms.includes(String(k.text).toLowerCase())||/\[redacted\]/i.test(k.text)))throw Error('Background negatives must be exact observed, non-redacted search terms. No invented or broad exclusions.');
 }
 if(p.ad_group_id&&!observation.groups.some((r:any)=>String(r.adGroup.id)===p.ad_group_id&&String(r.adGroup.campaign).endsWith('/'+p.campaign_id)))throw Error('The agent referenced an unobserved ad group.');
 if(p.kind==='broad_match_test'&&!observation.experiment_goal_aligned)throw Error('Google experiment reporting goals must match the selected business conversion before preparing this test.');
 if(p.kind==='search_campaign'){
  if(!goal||!configuration?.scope?.allow_new_campaigns||!goal.location_ids?.length||!goal.language_ids?.length)throw Error('A new campaign needs a saved business goal, geographic targets and authorized campaign-test allowance.');
  if(JSON.stringify([...p.location_ids].sort())!==JSON.stringify([...goal.location_ids].sort())||JSON.stringify([...p.language_ids].sort())!==JSON.stringify([...goal.language_ids].sort()))throw Error('A background campaign cannot invent or expand saved geography or language targets.');
 }
 return candidate;
}

// Same literal-exclusion check as _shared/business.ts permittedCopy.
export function normalizedClaim(value: string) {
 return String(value||'').normalize('NFKC').replace(/<[^>]*>/g,' ').toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]+/gu,' ').trim();
}
export function permittedCopy(text: string, site: any) {
 const value=normalizedClaim(text);
 return !(site.brand?.bannedWords||[]).some((word:string)=>normalizedClaim(word)&&value.includes(normalizedClaim(word)));
}
