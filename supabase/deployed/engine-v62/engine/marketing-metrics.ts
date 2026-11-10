import {check} from './operations.ts';
import {localDate,daysEnding} from './reporting.ts';
const scopesError='Google Analytics access is unavailable. Reconnect Google with Analytics permission, then choose a property.';
async function request(url:string,token:string,body?:any){
 const r=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(r.status===403?scopesError:'Google Analytics request failed. Check the selected property and account access.');return j;
}
function propertyId(value:any){const v=String(value||'').replace(/^properties\//,'');if(!/^\d{1,20}$/.test(v))throw Error('Choose a Google Analytics property.');return v;}
export async function analyticsSync(siteId:string,deps:any){
 const {db,connectorToken}=deps;
 const c=check(await db.from('connectors').select('*').eq('site_id',siteId).eq('type','gsc').maybeSingle());
 if(!c?.config?.ga4_property)return {skipped:true};
 const id=propertyId(c.config.ga4_property),token=await connectorToken(c);
 const prop=await request(`https://analyticsadmin.googleapis.com/v1beta/properties/${id}`,token),tz=prop.timeZone;
 if(!tz)throw Error('Analytics property did not return a reporting time zone.');
 const today=localDate(new Date(),tz),end=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10),days=daysEnding(end,56);
 const report=async(dimensions:string[])=>{
  const j=await request(`https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`,token,{dateRanges:[{startDate:days[0],endDate:end}],dimensions:dimensions.map(name=>({name})),metrics:[{name:'sessions'}],limit:100000,keepEmptyRows:true});
  if(j.rowCount>100000)throw Error('Analytics report exceeds the current batch size. The previous complete report is retained.');
  return {rows:(j.rows||[]).map((r:any)=>{const date=r.dimensionValues[0].value.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),sessions=Number(r.metricValues[0].value);if(!days.includes(date)||!Number.isFinite(sessions)||sessions<0)throw Error('Analytics returned an invalid reporting row.');return {date,sessions,...Object.fromEntries(dimensions.slice(1).map((key,i)=>[key,String(r.dimensionValues[i+1].value)]))};}),thresholded:!!j.metadata?.subjectToThresholding};
 };
 const [sources,countries,daily]=await Promise.all([report(['date','sessionDefaultChannelGroup','sessionSourceMedium']),report(['date','country','region','city']),report(['date'])]);
 const current=check(await db.from('connectors').select('config').eq('id',c.id).single());if(current.config.ga4_property!==id)throw Error('The Analytics property changed during sync. Refresh the selected property.');
 const payload={source:'Google Analytics 4',property_id:id,property_name:prop.displayName,time_zone:tz,start_date:days[0],end_date:end,rows:daily.rows,sources:sources.rows,countries:countries.rows,thresholded:sources.thresholded||countries.thresholded||daily.thresholded,synced_at:new Date().toISOString()};
 check(await db.from('marketing_reports').upsert({site_id:siteId,source:'ga4',payload,synced_at:payload.synced_at}));return {days:56,property:prop.displayName};
}
export async function analyticsAction(body:any,deps:any){
 const {db,connectorToken}=deps,c=check(await db.from('connectors').select('*').eq('site_id',body.site_id).eq('type','gsc').maybeSingle());
 if(!c||c.config.auth!=='oauth')throw Error('Connect Google with an account that has access to this business’s Analytics property.');
 if(body.action==='analytics_properties'){
  const token=await connectorToken(c),all=[];let page='',pages=0;
  do{const j=await request('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200'+(page?'&pageToken='+encodeURIComponent(page):''),token);all.push(...(j.accountSummaries||[]).flatMap((a:any)=>(a.propertySummaries||[]).map((p:any)=>({id:propertyId(p.property),name:p.displayName,account:a.displayName}))));page=j.nextPageToken||'';if(++pages>20||all.length>2000)throw Error('Too many Analytics properties. Choose an account with fewer properties.');}while(page);
  return {properties:all};
 }
 if(body.action==='analytics_select'){
  const id=propertyId(body.property_id),prop=await request(`https://analyticsadmin.googleapis.com/v1beta/properties/${id}`,await connectorToken(c));
  check(await db.from('connectors').update({config:{...c.config,ga4_property:id,ga4_name:prop.displayName}}).eq('id',c.id));
  return analyticsSync(String(body.site_id),deps);
 }
 if(body.action==='analytics_sync')return analyticsSync(String(body.site_id),deps);
 throw Error('Unsupported analytics action.');
}

