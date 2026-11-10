import { check, safeJobError } from './operations.ts';
export const SHOP_REPORT_META = 'query { shop { ianaTimezone currencyCode } currentAppInstallation { accessScopes { handle } } }';
export const SHOP_REPORT_QUERY = 'query($q:String!){shopifyqlQuery(query:$q){tableData{columns{name dataType} rows} parseErrors}}';
export const SHOP_ORDER_QUERY = 'query($q:String!,$a:String){orders(first:250,after:$a,query:$q,sortKey:CREATED_AT){nodes{id createdAt cancelledAt test currentTotalPriceSet{shopMoney{amount currencyCode}}} pageInfo{hasNextPage endCursor}}}';
export function localDate(date:Date,timeZone:string) {
 const p=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 return ['year','month','day'].map(k=>p.find(x=>x.type===k)?.value).join('-');
}
export function daysEnding(end:string,n:number){return Array.from({length:n},(_,i)=>new Date(Date.parse(end+'T12:00:00Z')-(n-1-i)*86400000).toISOString().slice(0,10));}
export function tableRows(result:any) {
 if(result?.parseErrors?.length)throw new Error('Shopify report could not be parsed: '+result.parseErrors.join('; '));
 if(!result?.tableData||!Array.isArray(result.tableData.rows))throw new Error('Shopify returned no reporting table.');
 const cols=result.tableData.columns.map((c:any)=>c.name);
 return result.tableData.rows.map((r:any)=>Array.isArray(r)?Object.fromEntries(cols.map((c:string,i:number)=>[c,r[i]])):r);
}
export function orderDays(orders:any[],days:string[],timeZone:string,currency:string) {
 const rows=new Map(days.map(date=>[date,{date,revenue:0,orders:0}]));const seen=new Set();
 for(const o of orders){if(o.test||o.cancelledAt||seen.has(o.id))continue;seen.add(o.id);
  const row=rows.get(localDate(new Date(o.createdAt),timeZone));if(!row)continue;
  if(o.currentTotalPriceSet?.shopMoney?.currencyCode!==currency)throw new Error('Store reporting currency changed. Refresh the report.');
  const value=Number(o.currentTotalPriceSet.shopMoney.amount);if(!Number.isFinite(value))throw new Error('Invalid order amount from Shopify.');
  row.revenue+=value;row.orders++;
 }
 return [...rows.values()].map(r=>({...r,revenue:Math.round(r.revenue*100)/100}));
}
export async function syncCommerce(siteId:string,deps:any) {
 const {db,shopify,secretFor}=deps,now=new Date().toISOString();
 const c=check(await db.from('connectors').select('*').eq('site_id',siteId).eq('type','shopify').eq('status','connected').maybeSingle());
 if(!c)throw new Error('Connect Shopify to load commerce results.');
 try {
  const token=await secretFor(c.id);if(!token)throw new Error('Reconnect Shopify.');
  const meta=await shopify(c.config.shop,token,SHOP_REPORT_META);const timeZone=meta.shop.ianaTimezone,currency=meta.shop.currencyCode;
  const today=localDate(new Date(),timeZone),end=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10),days=daysEnding(end,56),scopes=meta.currentAppInstallation.accessScopes.map((s:any)=>s.handle);
  let rows:any[],mode='order_value',sessions:any[]=[],note='Current order totals by order date, including tax and shipping. Excludes test and cancelled orders. Refund adjustments are reflected on the original order date. This is not Shopify’s Total sales report.';
  if(scopes.includes('read_reports')) {
   const query=`FROM sales SHOW total_sales, orders TIMESERIES day SINCE ${days[0]} UNTIL ${end} ORDER BY day ASC`;
   const r=await shopify(c.config.shop,token,SHOP_REPORT_QUERY,{q:query});rows=tableRows(r.shopifyqlQuery).map((x:any)=>({date:x.day,revenue:Number(x.total_sales),orders:Number(x.orders)}));
   if(rows.some(x=>!days.includes(x.date)||!Number.isFinite(x.revenue)||!Number.isFinite(x.orders)))throw new Error('Shopify returned invalid daily sales data.');
   mode='total_sales';note='Shopify Total sales by reporting date, including sale adjustments. All sales channels; not attributed to Samaritan.';
   try {const r=await shopify(c.config.shop,token,SHOP_REPORT_QUERY,{q:`FROM sessions SHOW sessions, sessions_that_completed_checkout TIMESERIES day SINCE ${days[0]} UNTIL ${end} ORDER BY day ASC`});sessions=tableRows(r.shopifyqlQuery).map((x:any)=>({date:x.day,sessions:Number(x.sessions),converted_sessions:Number(x.sessions_that_completed_checkout)})).filter((x:any)=>days.includes(x.date)&&Number.isFinite(x.sessions)&&Number.isFinite(x.converted_sessions));}catch{note+=' Online-store session reporting is unavailable.';}
  } else {
   if(!scopes.includes('read_orders')&&!scopes.includes('write_orders'))throw new Error('Shopify needs read_orders or read_reports permission for analytics.');
   const orders=[];let after=null,complete=false;
   for(let page=0;page<20;page++) {
    // Expand UTC boundaries, then assign each order to its actual store-local date.
    const start=new Date(Date.parse(days[0]+'T00:00:00Z')-86400000).toISOString();
    const r=await shopify(c.config.shop,token,SHOP_ORDER_QUERY,{q:`created_at:>='${start}' created_at:<'${new Date().toISOString()}'`,a:after});
    orders.push(...r.orders.nodes);if(!r.orders.pageInfo.hasNextPage){complete=true;break;}after=r.orders.pageInfo.endCursor;
   }
   if(!complete)throw new Error('Order volume exceeds this reporting batch. The previous complete report is retained; enable read_reports for aggregated analytics.');
   rows=orderDays(orders,days,timeZone,currency);
  }
  const latest=check(await db.from('connectors').select('config').eq('id',c.id).eq('site_id',siteId).single());if(latest.config?.shop!==c.config.shop)throw new Error('The Shopify store changed during reporting. Refresh the selected store.');
  const payload={source:'Shopify',shop_domain:c.config.shop,mode,currency,time_zone:timeZone,start_date:days[0],end_date:end,rows,sessions,note,synced_at:now};
  check(await db.from('marketing_reports').upsert({site_id:siteId,source:'shopify',payload,synced_at:now}));
  check(await db.from('channel_syncs').upsert({site_id:siteId,channel:'commerce',state:'synced',last_attempt_at:now,last_success_at:now,data_through:end,error:null,detail:{mode,currency,time_zone:timeZone}}));
  return {summary:'Store performance refreshed from Shopify.',days:rows.length};
 }catch(e){check(await db.from('channel_syncs').upsert({site_id:siteId,channel:'commerce',state:'needs_attention',last_attempt_at:now,error:safeJobError(e)}));throw e;}
}


