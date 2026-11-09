import {apiJson,META_VERSION} from '../_shared/paid-api.ts';
export async function paidCallback(provider:string,p:URLSearchParams,st:any,deps:any){
 if(p.get('error')||!p.get('code'))throw new Error('Advertising authorization was declined or incomplete.');
 const app=await deps.need(provider==='google_ads'?'google':'meta');let token,config;
 if(provider==='google_ads'){
  const tok=await apiJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:app.id,client_secret:app.secret,code:p.get('code')!,grant_type:'authorization_code',redirect_uri:deps.redirectUri(provider)})});
  if(!tok.refresh_token)throw new Error('Google did not return offline access. Reconnect and approve access.');
  if(!String(tok.scope||'').split(' ').includes('https://www.googleapis.com/auth/adwords'))throw new Error('Google Ads permission was not granted.');
  token=tok.refresh_token;config={auth:'oauth',scopes:String(tok.scope).split(' '),account_id:null,account_name:null,currency:null,time_zone:null,login_customer_id:null};
 }else{
  const short=await apiJson(`https://graph.facebook.com/${META_VERSION}/oauth/access_token?`+new URLSearchParams({client_id:app.id,client_secret:app.secret,redirect_uri:deps.redirectUri(provider),code:p.get('code')!}));
  if(!short.access_token)throw new Error('Meta did not return authorization.');
  const long=await apiJson(`https://graph.facebook.com/${META_VERSION}/oauth/access_token?`+new URLSearchParams({grant_type:'fb_exchange_token',client_id:app.id,client_secret:app.secret,fb_exchange_token:short.access_token}));
  if(!long.access_token)throw new Error('Meta did not return extended access.');
  token=long.access_token;config={auth:'oauth',account_id:null,account_name:null,currency:null,time_zone:null,expires_at:long.expires_in?new Date(Date.now()+Number(long.expires_in)*1000).toISOString():null,scope_review_required:true};
 }
 const id=await deps.upsertConnector(st.site_id,provider,provider==='google_ads'?'Google Ads':'Meta Ads',config,token);
 const r=await deps.db.from('connectors').update({status:'pending',last_error:null,last_checked_at:new Date().toISOString()}).eq('id',id);if(r.error)throw new Error(r.error.message);
 return 'Authorization saved. Select the advertising account in Integrations to start reporting.';
}

