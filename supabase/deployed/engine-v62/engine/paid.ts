import {check,enqueue,safeJobError} from './operations.ts';
import {daysEnding} from './reporting.ts';
import {copyHash} from './workspace.ts';
import {numericId,googleRequest,googleSearch,metaRequest,metaList,reportingWindow} from '../_shared/paid-api.ts';
const GOOGLE_CAMPAIGN='SELECT campaign.id,campaign.name,campaign.status,campaign.resource_name,campaign.campaign_budget,campaign_budget.amount_micros,campaign_budget.period,campaign_budget.explicitly_shared,campaign_budget.reference_count FROM campaign';
const META_FIELDS='id,account_id,name,status,configured_status,effective_status,daily_budget,lifetime_budget,updated_time,is_budget_schedule_enabled,is_adset_budget_sharing_enabled';
export async function credentials(c:any,deps:any){
 if(c.type==='google_ads')return {token:await deps.connectorToken(c),secret:''};
 if(c.type!=='meta_ads')throw new Error('Choose an advertising connector.');
 if(c.config?.expires_at&&Date.parse(c.config.expires_at)<Date.now()+60000)throw new Error('Meta access expires soon. Reconnect Meta Ads.');
 const token=await deps.secretFor(c.id);if(!token)throw new Error('Reconnect Meta Ads.');
 const app=check(await deps.db.rpc('get_platform_app',{p_provider:'meta'})),row=Array.isArray(app)?app[0]:app;
 const secret=Deno.env.get('META_CLIENT_SECRET')||row?.client_secret;
 if(!secret)throw new Error('Configure the Meta app in owner settings.');return {token,secret};
}
export async function accessibleAccounts(c:any,deps:any,manager?:string){
 const {token,secret}=await credentials(c,deps);
 if(c.type==='meta_ads')return (await metaList(token,secret,'me/adaccounts',{fields:'id,account_id,name,currency,timezone_name,account_status'})).map((a:any)=>({id:a.account_id,name:a.name,currency:a.currency,time_zone:a.timezone_name,manager:false}));
 const list=await googleRequest(token,'customers:listAccessibleCustomers');
 const accounts=[];
 if(manager){
  const m=numericId(manager);if(!(list.resourceNames||[]).includes('customers/'+m))throw new Error('Choose a directly authorized manager account.');
  const rows=await googleSearch(token,m,'SELECT customer_client.id,customer_client.descriptive_name,customer_client.currency_code,customer_client.time_zone,customer_client.manager FROM customer_client WHERE customer_client.level <= 1',m);
  return rows.map((r:any)=>({id:String(r.customerClient.id),name:r.customerClient.descriptiveName,currency:r.customerClient.currencyCode,time_zone:r.customerClient.timeZone,manager:r.customerClient.manager,login_customer_id:m}));
 }
 for(const name of (list.resourceNames||[]).slice(0,50)){
  const id=numericId(name.split('/')[1]);try{const rows=await googleSearch(token,id,'SELECT customer.id,customer.descriptive_name,customer.currency_code,customer.time_zone,customer.manager FROM customer');const a=rows[0]?.customer;if(a)accounts.push({id,name:a.descriptiveName||id,currency:a.currencyCode,time_zone:a.timeZone,manager:a.manager});}catch{accounts.push({id,name:id,manager:true,requires_selection:true});}
 }
 return accounts;
}
export function campaignSnapshot(provider:string,row:any){
 if(provider==='google_ads'){const c=row.campaign,b=row.campaignBudget||{};return {id:String(c.id),account_id:String(c.resourceName).split('/')[1],name:c.name,status:c.status,budget_resource:c.campaignBudget,daily_budget:b.period==='DAILY'?Number(b.amountMicros)/1e6:null,shared:!!b.explicitlyShared||Number(b.referenceCount)>1};}
 return {id:String(row.id),account_id:String(row.account_id),name:row.name,status:row.configured_status||row.status,effective_status:row.effective_status,daily_budget_raw:row.daily_budget||null,lifetime_budget_raw:row.lifetime_budget||null,updated_at:row.updated_time||null,shared:!!row.is_adset_budget_sharing_enabled||!!row.is_budget_schedule_enabled};
}
export async function readCampaign(c:any,id:string,deps:any){
 const {token,secret}=await credentials(c,deps),account=numericId(c.config.account_id),campaign=numericId(id);
 const raw=c.type==='google_ads'?(await googleSearch(token,account,GOOGLE_CAMPAIGN+` WHERE campaign.id=${campaign}`,c.config.login_customer_id))[0]:await metaRequest(token,secret,campaign,{fields:META_FIELDS});
 if(!raw)throw new Error('Campaign not found.');const snapshot=campaignSnapshot(c.type,raw);
 if(snapshot.account_id!==account)throw new Error('Campaign belongs to another account.');return snapshot;
}
export function validateChange(c:any,before:any,target:string,policy:any){
 const enabled=c.type==='google_ads'?'ENABLED':'ACTIVE';
 if(!['PAUSED',enabled].includes(target)||!['PAUSED',enabled].includes(before.status))throw new Error('Only existing paused or active campaigns can change status.');
 if(target===before.status)throw new Error('Campaign is already in that state.');
 if(!policy?.enabled)throw new Error('Campaign changes are disabled for this account.');
 if(target!== 'PAUSED'){
  if(!policy.allow_resume)throw new Error('Resuming spend is disabled for this account.');
  // Meta daily-budget units vary by currency. Resume is supported only for USD campaign-owned budgets.
  const budget=c.type==='google_ads'?before.daily_budget:c.config.currency==='USD'&&before.daily_budget_raw?Number(before.daily_budget_raw)/100:null;
  if(before.shared||budget===null||!Number.isFinite(budget)||budget<=0||budget>Number(policy.max_daily_budget))throw new Error('Campaign budget is shared, unsupported or exceeds the approved daily budget limit.');
 }
}
// Meta purchase action aliases overlap. Pick one canonical website-purchase metric; never add aliases.
export function metaPurchase(values:any[]) {
 for(const type of ['offsite_conversion.fb_pixel_purchase','omni_purchase','purchase']) {
  const item=(values||[]).find((a:any)=>a.action_type===type);
  if(item)return {value:Number(item.value),type};
 }
 return {value:0,type:null};
}
export async function dailyAdReport(c:any,token:string,secret:string,account:string,end:string) {
 const days=daysEnding(end,56),base=()=>({spend:0,clicks:0,impressions:0,conversions:0,conversion_value:0,leads:c.config.lead_action?0:null,bookings:c.config.booking_action?0:null});
 let actionRows:any[]=[],actionOptions:any[]=[];
 const mapped=new Map(days.map(date=>[date,{date,...base()}]));let reportRows:any[];
 if(c.type==='google_ads') {
  reportRows=(await googleSearch(token,account,`SELECT segments.date,metrics.impressions,metrics.clicks,metrics.cost_micros,metrics.conversions,metrics.conversions_value FROM customer WHERE segments.date BETWEEN '${days[0]}' AND '${end}'`,c.config.login_customer_id)).map((r:any)=>({date:r.segments.date,spend:Number(r.metrics.costMicros||0)/1e6,clicks:Number(r.metrics.clicks||0),impressions:Number(r.metrics.impressions||0),conversions:Number(r.metrics.conversions||0),conversion_value:Number(r.metrics.conversionsValue||0)}));
  actionOptions=(await googleSearch(token,account,"SELECT conversion_action.resource_name,conversion_action.name,conversion_action.category FROM conversion_action WHERE conversion_action.status = 'ENABLED'",c.config.login_customer_id)).map((r:any)=>({id:r.conversionAction.resourceName,name:r.conversionAction.name,category:r.conversionAction.category}));
  if(c.config.lead_action||c.config.booking_action)actionRows=(await googleSearch(token,account,`SELECT segments.date,segments.conversion_action,metrics.conversions FROM customer WHERE segments.date BETWEEN '${days[0]}' AND '${end}'`,c.config.login_customer_id)).map((r:any)=>({date:r.segments.date,action:r.segments.conversionAction,value:Number(r.metrics.conversions||0)}));
 } else {
  reportRows=(await metaList(token,secret,`act_${account}/insights`,{level:'account',fields:'date_start,date_stop,spend,clicks,impressions,actions,action_values',time_increment:'1',use_unified_attribution_setting:'true',action_report_time:'impression',time_range:JSON.stringify({since:days[0],until:end})})).map((r:any)=>{for(const a of r.actions||[]){if(!actionOptions.some(x=>x.id===a.action_type))actionOptions.push({id:a.action_type,name:a.action_type});actionRows.push({date:r.date_start,action:a.action_type,value:Number(a.value||0)});}return {date:r.date_start,spend:Number(r.spend||0),clicks:Number(r.clicks||0),impressions:Number(r.impressions||0),conversions:metaPurchase(r.actions).value,conversion_value:metaPurchase(r.action_values).value};});
 }
 for(const row of reportRows){if(!mapped.has(row.date)||Object.values(row).some(v=>typeof v==='number'&&!Number.isFinite(v)))throw new Error('Invalid daily advertising metrics.');mapped.set(row.date,{...mapped.get(row.date),...row});}
 for(const row of actionRows){if(!mapped.has(row.date)||!Number.isFinite(row.value))throw Error('Invalid conversion action report.');const day=mapped.get(row.date) as any;if(c.config.lead_action===row.action)day.leads+=row.value;if(c.config.booking_action===row.action)day.bookings+=row.value;}
 for(const field of ['lead_action','booking_action'])if(c.config[field]&&!actionOptions.some(a=>a.id===c.config[field]))throw Error('A selected conversion action is unavailable. Review the measurement settings.');
 return {action_options:actionOptions,lead_action:c.config.lead_action||null,booking_action:c.config.booking_action||null,lead_label:actionOptions.find(a=>a.id===c.config.lead_action)?.name||null,booking_label:actionOptions.find(a=>a.id===c.config.booking_action)?.name||null,source:c.type==='google_ads'?'Google Ads':'Meta Ads',currency:c.config.currency,time_zone:c.config.time_zone,account_id:account,start_date:days[0],end_date:end,rows:[...mapped.values()],note:c.type==='google_ads'?'Google Ads primary conversion actions and their assigned values, reported by interaction date. Values may include leads; value/spend is not purchase ROAS.':'Meta-reported purchases and purchase values, by impression date, using ad-set attribution settings. Clicks include all clicks. Purchase aliases are not added together.',attribution:'Provider-reported. Attribution windows can overlap with other channels; do not add channel conversion values to store sales.',synced_at:new Date().toISOString()};
}
export async function syncAds(siteId:string,deps:any){
 const {db}=deps,conns=check(await db.from('connectors').select('*').eq('site_id',siteId).in('type',['google_ads','meta_ads']));
 if(!conns.length)throw new Error('Connect Google Ads or Meta Ads first.');const results=[];
 for(const c of conns){const now=new Date().toISOString();try{
  if(!c.config?.account_id)throw new Error('Select the advertising account.');
  const {token,secret}=await credentials(c,deps),account=numericId(c.config.account_id),period=reportingWindow(c.config.time_zone),batch=crypto.randomUUID();let campaigns,metrics;
  if(c.type==='google_ads'){
   campaigns=(await googleSearch(token,account,GOOGLE_CAMPAIGN+" WHERE campaign.status != 'REMOVED'",c.config.login_customer_id)).map((r:any)=>campaignSnapshot(c.type,r));
   metrics=(await googleSearch(token,account,`SELECT campaign.id,metrics.impressions,metrics.clicks,metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${period.start}' AND '${period.end}'`,c.config.login_customer_id)).map((r:any)=>({id:String(r.campaign.id),spend:Number(r.metrics.costMicros||0)/1e6,clicks:Number(r.metrics.clicks||0),impressions:Number(r.metrics.impressions||0)}));
  }else{
   campaigns=(await metaList(token,secret,`act_${account}/campaigns`,{fields:META_FIELDS})).map((r:any)=>campaignSnapshot(c.type,r));
   metrics=(await metaList(token,secret,`act_${account}/insights`,{level:'campaign',fields:'campaign_id,impressions,clicks,spend,account_currency,date_start,date_stop',time_range:JSON.stringify({since:period.start,until:period.end})})).map((r:any)=>({id:String(r.campaign_id),spend:Number(r.spend||0),clicks:Number(r.clicks||0),impressions:Number(r.impressions||0)}));
  }
  const rows=campaigns.map((r:any)=>{const m=metrics.find((x:any)=>x.id===r.id)||{spend:0,clicks:0,impressions:0};return {connector_id:c.id,site_id:siteId,provider:c.type,account_id:account,campaign_id:r.id,name:r.name,status:r.status,currency:c.config.currency,time_zone:c.config.time_zone,period_start:period.start,period_end:period.end,spend:m.spend,clicks:m.clicks,impressions:m.impressions,snapshot:r,observed_at:now,batch_id:batch};});
  const daily=await dailyAdReport(c,token,secret,account,period.end);
  const latest=check(await db.from('connectors').select('config').eq('id',c.id).eq('site_id',siteId).single());if(latest.config?.account_id!==c.config.account_id)throw new Error('The selected advertising account changed during reporting. A fresh sync is required.');
  check(await db.from('marketing_reports').upsert({site_id:siteId,source:c.type,payload:daily,synced_at:now}));
  if(rows.length)check(await db.from('ad_reports').upsert(rows));
  check(await db.from('channel_syncs').upsert({site_id:siteId,channel:c.type,state:'synced',last_attempt_at:now,last_success_at:now,data_through:period.end,error:null,detail:{batch_id:batch,account_id:account,currency:c.config.currency,time_zone:c.config.time_zone,campaigns:rows.length}}));
  check(await db.from('connectors').update({status:'connected',last_checked_at:now,last_error:null}).eq('id',c.id));results.push({provider:c.type,campaigns:rows.length});
 }catch(e){check(await db.from('channel_syncs').upsert({site_id:siteId,channel:c.type,state:'needs_attention',last_attempt_at:now,error:safeJobError(e)}));results.push({provider:c.type,error:safeJobError(e)});}}
 return {results,needs_review:results.some(r=>r.error),summary:results.some(r=>r.error)?'Some ad reports need connection attention.':'Ad campaign reporting refreshed.'};
}
export async function executeAdChange(job:any,deps:any){
 const {db}=deps,id=job.payload.change_id;
 const changed=check(await db.from('ad_changes').update({status:'applying'}).eq('id',id).eq('site_id',job.site_id).eq('status','approved').select('*'));
 if(!changed.length)throw new Error('This campaign change has already been claimed or withdrawn.');const p=changed[0];let attempted=false;
 try{
  if(Date.parse(p.expires_at)<Date.now())throw new Error('Approval expired. Prepare a new proposal.');
  const c=check(await db.from('connectors').select('*').eq('id',p.connector_id).eq('site_id',p.site_id).single());
  if(c.config.account_id!==p.account_id)throw new Error('The selected ad account changed.');
  const before=await readCampaign(c,p.campaign_id,deps),policy=check(await db.from('ad_controls').select('*').eq('connector_id',c.id).single());
  validateChange(c,before,p.after_status,policy);
  if(JSON.stringify(before)!==JSON.stringify(p.before))throw new Error('Campaign changed outside Impackt Media. Review a fresh proposal.');
  const counts=await db.from('ad_changes').select('id',{count:'exact',head:true}).eq('connector_id',c.id).in('status',['applying','verified','uncertain']).gte('approved_at',new Date(Date.now()-86400000).toISOString());check(counts);
  if(counts.count>policy.max_changes_per_day)throw new Error('Daily campaign-change limit reached.');
  const {token,secret}=await credentials(c,deps);
  if(c.type==='google_ads'){
   const mutation={operations:[{update:{resourceName:`customers/${numericId(p.account_id)}/campaigns/${numericId(p.campaign_id)}`,status:p.after_status},updateMask:'status'}],partialFailure:false};
   await googleRequest(token,`customers/${numericId(p.account_id)}/campaigns:mutate`,{...mutation,validateOnly:true},c.config.login_customer_id);
   attempted=true;await googleRequest(token,`customers/${numericId(p.account_id)}/campaigns:mutate`,mutation,c.config.login_customer_id);
  }else{attempted=true;await metaRequest(token,secret,numericId(p.campaign_id),{status:p.after_status},'POST');}
  const after=await readCampaign(c,p.campaign_id,deps);
  if(after.status!==p.after_status)throw new Error('Provider readback does not confirm the requested status.');
  check(await db.from('ad_changes').update({status:'verified',result:{observed:after,verification:'Current provider state matches approved status'},finished_at:new Date().toISOString()}).eq('id',id).eq('status','applying'));
  return {change_id:id,summary:'Approved campaign status confirmed by provider readback.'};
 }catch(e){check(await db.from('ad_changes').update({status:attempted?'uncertain':'blocked',error:safeJobError(e),finished_at:new Date().toISOString()}).eq('id',id).eq('status','applying'));throw e;}
}
export async function paidAction(body:any,deps:any){
 const {db}=deps,siteId=String(body.site_id||'');
 const c=check(await db.from('connectors').select('*').eq('id',body.connector_id).eq('site_id',siteId).single());
 if(!['google_ads','meta_ads'].includes(c.type))throw new Error('Choose an advertising connector.');
 if(body.action==='ads_accounts')return {accounts:await accessibleAccounts(c,deps,body.manager_id)};
 if(body.action==='ads_select'){
  const list=await accessibleAccounts(c,deps,body.manager_id),a=list.find((a:any)=>a.id===numericId(body.account_id));
  if(!a||a.manager||!a.currency||!a.time_zone)throw new Error('Select an accessible advertiser account, not a manager.');
  check(await db.from('connectors').update({config:{...c.config,account_id:a.id,account_name:a.name,currency:a.currency,time_zone:a.time_zone,login_customer_id:a.login_customer_id||null,...(c.config?.account_id!==a.id?{lead_action:null,booking_action:null}:{})},status:'connected'}).eq('id',c.id));
  check(await db.from('ad_controls').upsert({connector_id:c.id,site_id:siteId,enabled:false,allow_resume:false}));
  if(c.config?.account_id!==a.id){check(await db.from('marketing_reports').delete().eq('site_id',siteId).eq('source',c.type));check(await db.from('ad_reports').delete().eq('connector_id',c.id));}
  await enqueue(db,siteId,'ads_sync','paid',`account-sync:${c.id}:${a.id}:${Date.now()}`);return {selected:a};
 }
 if(body.action==='ads_measurement'){
  const report=check(await db.from('marketing_reports').select('payload').eq('site_id',siteId).eq('source',c.type).single());if(report.payload.account_id!==c.config.account_id)throw Error('Sync the selected account first.');
  const options=report.payload.action_options||[],lead=String(body.lead_action||''),booking=String(body.booking_action||'');
  if((lead&&!options.some((a:any)=>a.id===lead))||(booking&&!options.some((a:any)=>a.id===booking))||(lead&&lead===booking))throw Error('Choose separate reported lead and booking actions.');
  check(await db.from('connectors').update({config:{...c.config,lead_action:lead||null,booking_action:booking||null}}).eq('id',c.id));
  await enqueue(db,siteId,'ads_sync','paid',`measurement:${c.id}:${Date.now()}`);return {queued:true};
 }
 if(body.action==='ads_controls'){
  const max=Number(body.max_daily_budget||0),changes=Number(body.max_changes_per_day||3);if(!Number.isFinite(max)||max<0||!Number.isInteger(changes)||changes<1||changes>10)throw new Error('Invalid campaign control limits.');
  check(await db.from('ad_controls').upsert({site_id:siteId,connector_id:c.id,enabled:body.enabled===true,allow_resume:body.allow_resume===true,max_daily_budget:max,max_changes_per_day:changes,updated_at:new Date().toISOString()}));return {ok:true};
 }
 if(body.action==='ads_propose'){
  const before=await readCampaign(c,body.campaign_id,deps),policy=check(await db.from('ad_controls').select('*').eq('connector_id',c.id).maybeSingle());
  validateChange(c,before,body.target_status,policy);
  const hash=await copyHash(JSON.stringify(before),body.target_status);
  return {proposal:check(await db.from('ad_changes').insert({site_id:siteId,connector_id:c.id,campaign_id:before.id,account_id:c.config.account_id,provider:c.type,before,after_status:body.target_status,approval_hash:hash}).select('*').single())};
 }
 const p=check(await db.from('ad_changes').select('*').eq('id',body.change_id).eq('site_id',siteId).eq('connector_id',c.id).single());
 if(body.action==='ads_approve'){
  if(!deps.actorId||p.approval_hash!==body.approval_hash||Date.parse(p.expires_at)<Date.now())throw new Error('Review the current proposal before approving.');
  const approved=check(await db.from('ad_changes').update({status:'approved',approved_by:deps.actorId,approved_at:new Date().toISOString()}).eq('id',p.id).eq('status','proposed').select('id'));
  if(!approved.length)throw new Error('Proposal is no longer awaiting approval.');
  await enqueue(db,siteId,'ads_execute','paid',`ad-change:${p.id}`,{change_id:p.id});return {queued:true};
 }
 if(body.action==='ads_reject'){check(await db.from('ad_changes').update({status:'rejected'}).eq('id',p.id).in('status',['proposed','approved','blocked']));return {ok:true};}
 if(body.action==='ads_reconcile'){
  if(!['uncertain','applying'].includes(p.status))throw new Error('This change does not need reconciliation.');
  if(p.status==='applying'&&Date.parse(p.approved_at)>Date.now()-600000)throw new Error('The worker may still be active. Try after ten minutes.');
  const observed=await readCampaign(c,p.campaign_id,deps),matches=observed.status===p.after_status;
  check(await db.from('ad_changes').update({status:matches?'verified':'blocked',result:{observed,verification:'Manual reconciliation of current provider state; no retry performed'},finished_at:new Date().toISOString()}).eq('id',p.id).eq('status',p.status));return {matches,observed};
 }
 if(body.action==='ads_reverse'){
  if(p.status!=='verified')throw new Error('Only a verified change can prepare a reversal.');
  const current=await readCampaign(c,p.campaign_id,deps);
  if(JSON.stringify(current)!==JSON.stringify(p.result.observed))throw new Error('Campaign changed again. Review a fresh proposal.');
  return paidAction({...body,action:'ads_propose',campaign_id:p.campaign_id,target_status:p.before.status},deps);
 }
 throw new Error('Unknown paid-channel action.');
}


