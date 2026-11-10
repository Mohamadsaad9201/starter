import {renderArticleHtml} from '../_shared/article-format.ts';
import {boundDomain,projectUrl,digest,editHtml,netlify,netlifySnapshot,withFramer,cleanFramer,framerIdentity,framerTarget} from './website-providers.ts';
import {permittedCopy} from '../_shared/business.ts';
const checked=(r:any)=>{if(r.error)throw Error(r.error.message);return r.data};
const visibleBefore=(r:any)=>{if(r.target?.kind!=='html')return r.before_value;if(r.field==='seo.title')return r.before_value.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'(No title)';if(r.field==='seo.description'){const tag=(r.before_value.match(/<meta\b[^>]*>/gi)||[]).find((x:string)=>/\bname\s*=\s*(["'])description\1/i.test(x));return tag?.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i)?.[2]||'(No description)';}return r.before_value.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,3000)||'Existing page content is preserved.';};
const pick=(r:any)=>({id:r.id,connector_id:r.connector_id,site_id:r.site_id,status:r.status,target:r.target,field:r.field,before:visibleBefore(r),after:r.target?.kind==='html'?r.snapshot.input:r.after_value,reason:r.reason,approval_hash:r.approval_hash,provider_deploy_id:r.provider_deploy_id,error:r.error,created_at:r.created_at});
const limited=(x:any,n:number)=>String(x||'').trim().slice(0,n);
const safeHtml=renderArticleHtml;
export async function websiteAction(b:any,deps:any){
 const {db,secretFor}=deps,sid=limited(b.site_id,100);
 const site=checked(await db.from('sites').select('*').eq('id',sid).single());if(!site)throw Error('Business not found.');
 if(b.action==='website_connect'){
  const type=b.provider;if(!['netlify','framer'].includes(type))throw Error('Unsupported website provider.');
  const token=limited(b.secret,8000);if(!token)throw Error('Add a provider API key.');
  let config:any={url:'https://'+site.domain.replace(/^https?:\/\//,'').replace(/\/$/,''),writeEnabled:true};
  let detail:any;
  if(type==='netlify'){
   config.siteId=limited(b.project_id,80);const snapshot=await netlifySnapshot({config},token,site.domain);
   detail={siteName:snapshot.site.name,domain:site.domain,editing:snapshot.blocked?'source_required':'static_html',blocked:snapshot.blocked,checkedAt:new Date().toISOString()};
  }else{
   config.projectUrl=projectUrl(String(b.project_url||''));
   detail=await withFramer({config},token,async api=>{const publishing=await framerIdentity(api,site.domain);const info=await api.getProjectInfo();
    const canText=await api.isAllowedTo('TextNode.setText'),canCMS=await api.isAllowedTo('CollectionItem.setAttributes'),canPublish=await api.isAllowedTo('publish'),canDeploy=await api.isAllowedTo('deploy');
    if(!canPublish||!canDeploy||!canText&&!canCMS)throw Error('This key needs content editing, publishing and deployment permissions.');
    return {siteName:info.name,domain:site.domain,editing:'cms_and_page_text',canText,canCMS,staging:!!publishing.staging,checkedAt:new Date().toISOString()};});
  }
  const existing=checked(await db.from('connectors').select('id').eq('site_id',sid).eq('type',type).maybeSingle());
  const row=existing||checked(await db.from('connectors').insert({site_id:sid,type,label:type==='framer'?'Framer':'Netlify',config:{},status:'pending'}).select('id').single());
  const key=await db.rpc('service_set_connector_secret',{p_connector:row.id,p_secret:token});if(key.error)throw Error('Could not securely store this key. The connection is not ready.');
  checked(await db.from('connectors').update({config:{...config,detail},status:'connected',last_error:null}).eq('id',row.id).eq('site_id',sid));
  return {ok:true,connector_id:row.id,detail};
 }
 const c=checked(await db.from('connectors').select('*').eq('site_id',sid).eq('id',String(b.connector_id||'')).single());
 if(!c||!['framer','netlify'].includes(c.type))throw Error('Choose a website connection for this business.');
 const token=await secretFor(c.id);if(!token||!c.config.writeEnabled)throw Error('Upgrade this connection with the provider project and API key to enable edits.');
 if(b.action==='website_history')return {changes:(checked(await db.from('website_changes').select('*').eq('site_id',sid).eq('connector_id',c.id).order('created_at',{ascending:false}).limit(30))||[]).map(pick)};
 if(b.action==='website_inventory'){
  if(c.type==='netlify'){
   const n=await netlifySnapshot(c,token,site.domain);return {blocked:n.blocked,targets:n.files.filter((f:any)=>/\.html$/i.test(f.path)&&f.size<=1_000_000).slice(0,300).map((f:any)=>({label:f.path,target:{kind:'html',path:f.path},fields:['seo.title','seo.description','answer.section']}))};
  }
  return await withFramer(c,token,async api=>{
   await framerIdentity(api,site.domain);const targets:any[]=[];
   const pages=(await api.getNodesWithType('WebPageNode')).filter((p:any)=>!p.draft&&!p.collectionId).slice(0,30);
   for(const page of pages){for(const node of (await page.getNodesWithType('TextNode')).slice(0,40)){const before=await node.getText();if(before?.trim())targets.push({label:(page.path||'/')+' · '+before.slice(0,70),target:{kind:'text',id:node.id,pageId:page.id},fields:['text']});}}
   for(const col of (await api.getCollections()).slice(0,15)){
    if(typeof col.getItems!=='function')continue;const fields=(await col.getFields()).filter((f:any)=>['string','formattedText'].includes(f.type));
    for(const item of (await col.getItems()).filter((i:any)=>!i.draft).slice(0,60)){for(const f of fields){if(Object.keys(item.fieldData[f.id]?.valueByLocale||{}).length)continue;targets.push({label:col.name+' / '+item.slug+' · '+f.name,target:{kind:'cms',collectionId:col.id,itemId:item.id,fieldId:f.id,fieldType:f.type},fields:[f.type]});}}
   }
   return {targets:targets.slice(0,400),limited:targets.length>400,blocked:''};
  });
 }
 if(b.action==='website_prepare'){
  if(!deps.actorId)throw Error('Sign in to prepare a website change.');
  const input=limited(b.value,30000),reason=limited(b.reason,3000);if(!input||reason.length<20)throw Error('Add the proposed content and a specific search relevance reason.');
  if(!permittedCopy(input,site))throw Error('This content conflicts with saved business rules.');
  const target=b.target,field=String(b.field||'');let before='',after=input,snapshot:any={};
  if(c.type==='netlify'){
   if(!target||target.kind!=='html'||!['seo.title','seo.description','answer.section'].includes(field))throw Error('Choose a supported HTML destination.');
   const n=await netlifySnapshot(c,token,site.domain);if(n.blocked)throw Error(n.blocked);
   const file=n.files.find((f:any)=>f.path===target.path&&/\.html$/i.test(f.path));if(!file||file.size>1_000_000)throw Error('This HTML file is unavailable or too large.');
   before=await netlify(token,'/sites/'+encodeURIComponent(c.config.siteId)+'/files/'+target.path.replace(/^\//,'').split('/').map(encodeURIComponent).join('/'),{},true);
   if(await digest(before,'SHA-1')!==file.sha)throw Error('The source file does not match the deployed manifest.');
   after=editHtml(before,field,input,crypto.randomUUID());snapshot={deploy_id:n.deploy.id,files:n.files.map((f:any)=>({path:f.path,sha:f.sha})),input};
  }else{
   const read=await withFramer(c,token,async api=>{await framerIdentity(api,site.domain);await cleanFramer(api);const found=await framerTarget(api,target);return {before:found.before,type:found.type}});before=read.before;
   after=target.kind==='cms'&&read.type==='formattedText'?safeHtml(input):input;snapshot={input};
  }
  snapshot.provider={type:c.type,siteId:c.config.siteId||null,projectUrl:c.config.projectUrl||null};
  if(before===after)throw Error('The proposed value matches the current content.');
  const id=crypto.randomUUID(),hash=await digest(JSON.stringify({id,site_id:sid,connector_id:c.id,target,field,before,after,snapshot,reason}));
  const row=checked(await db.from('website_changes').insert({id,site_id:sid,connector_id:c.id,target,field,before_value:before,after_value:after,snapshot,reason,approval_hash:hash,status:'prepared',created_by:deps.actorId}).select('*').single());return pick(row);
 }
 const change=checked(await db.from('website_changes').select('*').eq('site_id',sid).eq('connector_id',c.id).eq('id',String(b.change_id||'')).single());
 if(!change)throw Error('Website change not found.');
 if(b.action==='website_publish'){
  if(!deps.actorId||b.reviewed!==true||b.approved_hash!==change.approval_hash||change.status!=='prepared')throw Error('Review and approve the exact current change before publishing.');
  if(JSON.stringify(change.snapshot.provider)!==JSON.stringify({type:c.type,siteId:c.config.siteId||null,projectUrl:c.config.projectUrl||null}))throw Error('The website connection changed after review. Prepare a new change.');
  if(Date.now()-Date.parse(change.created_at)>86400000)throw Error('This review expired. Prepare a fresh change from the current website.');
  if(!permittedCopy(change.snapshot.input,site))throw Error('Business rules have changed. Prepare a fresh review.');
  const locked=checked(await db.from('website_changes').update({status:'applying',approved_by:deps.actorId,approved_at:new Date().toISOString()}).eq('id',change.id).eq('site_id',sid).eq('status','prepared').eq('approval_hash',b.approved_hash).select('id'));
  if(!locked.length)throw Error('Another request already owns this change.');
  let attempted=false;
  try{
   if(c.type==='netlify'){
    const n=await netlifySnapshot(c,token,site.domain);if(n.blocked)throw Error(n.blocked);if(n.deploy.id!==change.snapshot.deploy_id)throw Error('The deployment changed after review. No write was attempted. Prepare a fresh change.');
    const sha=await digest(change.after_value,'SHA-1');const files=Object.fromEntries(change.snapshot.files.map((f:any)=>[f.path.startsWith('/')?f.path:'/'+f.path,f.path===change.target.path?sha:f.sha]));
    attempted=true;let deploy=await netlify(token,'/sites/'+encodeURIComponent(c.config.siteId)+'/deploys',{method:'POST',body:JSON.stringify({files,draft:false,title:'Samaritan approved change '+change.id})});
    checked(await db.from('website_changes').update({provider_deploy_id:deploy.id}).eq('id',change.id));
    if((deploy.required||[]).some((x:string)=>x!==sha))throw Error('Netlify requested an unrelated file. Deployment was not completed.');
    if(deploy.required?.includes(sha))await netlify(token,'/deploys/'+encodeURIComponent(deploy.id)+'/files/'+change.target.path.replace(/^\//,'').split('/').map(encodeURIComponent).join('/'),{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:change.after_value});
    checked(await db.from('website_changes').update({status:'publishing'}).eq('id',change.id));
    return {id:change.id,status:'publishing',message:'Netlify is processing the complete deployment. Check status to confirm publication.'};
   }
   return await withFramer(c,token,async api=>{
    await framerIdentity(api,site.domain);await cleanFramer(api);const current=await framerTarget(api,change.target);if(current.before!==change.before_value)throw Error('The content changed after review. No write was attempted.');
    attempted=true;await current.write(change.after_value);
    const readback=await framerTarget(api,change.target);if(readback.before!==change.after_value)throw Error('Framer did not confirm the exact approved content.');
    const published=await api.publish();const live=published.hostnames?.some((h:any)=>h.isPublished&&h.deploymentId===published.deployment.id&&h.hostname.replace(/^www\./,'')===site.domain.replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,''));checked(await db.from('website_changes').update({provider_deploy_id:published.deployment.id,status:'publishing',provider_result:{production:!!live,hostnames:published.hostnames||[]}}).eq('id',change.id));
    // Current Framer versions follow project staging settings; never label a direct production publish as a preview.
    return {id:change.id,status:'publishing',message:live?'Framer accepted the approved production publish. Check status to confirm processing has finished.':'Framer is preparing a preview. Check status, review it and promote it when ready.'};
   });
  }catch(e){checked(await db.from('website_changes').update({status:attempted?'uncertain':'blocked',error:(e as Error).message.slice(0,700)}).eq('id',change.id));throw e;}
 }
 if(b.action==='website_status'){
  if(!change.provider_deploy_id)return pick(change);
  if(c.type==='netlify'){
   const deploy=await netlify(token,'/deploys/'+encodeURIComponent(change.provider_deploy_id));
   const siteNow=await netlify(token,'/sites/'+encodeURIComponent(c.config.siteId));
   const status=deploy.state==='error'?'blocked':deploy.state==='ready'&&siteNow.published_deploy?.id===deploy.id?'published':change.status;
   checked(await db.from('website_changes').update({status,error:deploy.error_message||null}).eq('id',change.id));return {...pick(change),status,preview_url:deploy.deploy_ssl_url};
  }
  return await withFramer(c,token,async api=>{const d=await api.getDeployment(change.provider_deploy_id);if(d.status==='failed'){checked(await db.from('website_changes').update({status:'blocked',error:'Framer deployment failed.'}).eq('id',change.id));return {...pick(change),status:'blocked'};}if(d.status==='ready'&&change.provider_result?.production){checked(await db.from('website_changes').update({status:'published',published_at:new Date().toISOString()}).eq('id',change.id));return {...pick(change),status:'published'};}return {...pick(change),preview_ready:d.status==='ready',preview_url:d.versionUrl||null};});
 }
 if(b.action==='website_promote'){
  if(c.type!=='framer'||change.status!=='publishing'||!change.provider_deploy_id||!deps.actorId||b.reviewed!==true||b.approved_hash!==change.approval_hash)throw Error('Review the current Framer preview before promoting it.');
  return await withFramer(c,token,async api=>{
   await framerIdentity(api,site.domain);await cleanFramer(api);
   const d=await api.getDeployment(change.provider_deploy_id);if(d.status!=='ready')throw Error('Framer is still preparing the preview.');
   const current=await framerTarget(api,change.target);if(current.before!==change.after_value)throw Error('The project changed after the preview. Review it again.');
   const claim=checked(await db.from('website_changes').update({status:'applying'}).eq('id',change.id).eq('site_id',sid).eq('status','publishing').select('id'));if(!claim.length)throw Error('Another request already owns this promotion.');
   await api.deploy(change.provider_deploy_id);checked(await db.from('website_changes').update({status:'published',published_at:new Date().toISOString(),error:null}).eq('id',change.id));return {id:change.id,status:'published'};
  });
 }
 throw Error('Unsupported website action.');
}
