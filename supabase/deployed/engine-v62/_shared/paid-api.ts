export const GOOGLE_ADS_VERSION='v26', META_VERSION='v26.0';
export function numericId(value:any) {const id=String(value||'').replaceAll('-','');if(!/^\d{1,24}$/.test(id))throw new Error('Invalid advertising account or campaign ID.');return id;}
export async function appProof(secret:string,token:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function apiJson(url:string,init:any={},fetcher=fetch) {
 const response=await fetcher(url,{...init,redirect:'error',signal:AbortSignal.timeout(20000)});
 const body=await response.json().catch(()=>({}));
 if(!response.ok||body.error)throw new Error(`Advertising API ${response.status}: ${String(body.error?.message||'Request failed. Check account permissions.').slice(0,350)}`);
 return body;
}
export async function googleRequest(token:string,path:string,payload?:any,manager?:string,fetcher=fetch) {
 return apiJson(`https://googleads.googleapis.com/${GOOGLE_ADS_VERSION}/${path}`,{method:payload?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(manager?{'login-customer-id':numericId(manager)}:{})},...(payload?{body:JSON.stringify(payload)}:{})},fetcher);
}
export async function googleSearch(token:string,account:string,query:string,manager?:string,fetcher=fetch) {
 const rows=[];let next='';
 for(let n=0;n<10;n++){const r=await googleRequest(token,`customers/${numericId(account)}/googleAds:search`,{query,...(next?{pageToken:next}:{})},manager,fetcher);rows.push(...(r.results||[]));next=r.nextPageToken;if(!next)return rows;}
 throw new Error('Account exceeds the current reporting limit; no partial report was saved.');
}
export async function metaRequest(token:string,secret:string,path:string,params:any={},method='GET',fetcher=fetch){
 if(!/^(?:me|act_\d+|\d+)(?:\/(?:adaccounts|campaigns|insights))?$/.test(path))throw new Error('Unsupported Meta endpoint.');
 const form=new URLSearchParams({...params,appsecret_proof:await appProof(secret,token)});
 return apiJson(`https://graph.facebook.com/${META_VERSION}/${path}${method==='GET'?'?'+form:''}`,{method,headers:{Authorization:`Bearer ${token}`,...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(method==='POST'?{body:form}:{})},fetcher);
}
export async function metaList(token:string,secret:string,path:string,params:any={},fetcher=fetch){
 const rows=[];let after='';for(let n=0;n<30;n++){const r=await metaRequest(token,secret,path,{...params,limit:'200',...(after?{after}:{})},'GET',fetcher);rows.push(...(r.data||[]));if(!r.paging?.next)return rows;after=r.paging?.cursors?.after;if(!after)throw new Error('Incomplete Meta pagination.');}throw new Error('Account exceeds reporting limit; no partial report saved.');
}
export function reportingWindow(timeZone:string,now=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const end=new Date(today+'T12:00:00Z');end.setUTCDate(end.getUTCDate()-1);const start=new Date(end);start.setUTCDate(start.getUTCDate()-27);
 return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}


