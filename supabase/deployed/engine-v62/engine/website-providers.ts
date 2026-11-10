import {renderArticleHtml} from '../_shared/article-format.ts';
// Bounded website adapters. No credentials leave the server; no generated code is executed.
const encode=(x:string)=>encodeURIComponent(x);
export const host=(x:string)=>new URL(/^https:\/\//i.test(x)?x:'https://'+x).hostname.toLowerCase().replace(/^www\./,'');
export function boundDomain(domain:string,urls:string[]){if(!urls.some(u=>{try{return host(u)===host(domain)}catch{return false}}))throw Error('This provider project is not published on this business domain. Choose the matching project.');}
export function projectUrl(input:string){const u=new URL(input);if(u.protocol!=='https:'||u.hostname!=='framer.com'||!/^\/projects\/[^/]+\/?$/.test(u.pathname)||u.username||u.password)throw Error('Use the Framer editor project URL: https://framer.com/projects/…');return u.origin+u.pathname;}
export async function digest(s:string,algorithm='SHA-256'){return [...new Uint8Array(await crypto.subtle.digest(algorithm,new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function editHtml(html:string,field:string,value:string,id:string){
 if(!/<head(?:\s[^>]*)?>/i.test(html)||!/<\/head\s*>/i.test(html))throw Error('This file is not a complete static HTML page.');
 if(field==='seo.title'){
  const tags=html.match(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi)||[];if(tags.length>1)throw Error('Multiple title elements need a source-code review.');
  return tags.length?html.replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/i,()=>'<title>'+esc(value)+'</title>'):html.replace(/<\/head\s*>/i,()=>'<title>'+esc(value)+'</title>\n</head>');
 }
 if(field==='seo.description'){
  let count=0;const out=html.replace(/<meta\b[^>]*>/gi,tag=>{if(!/\bname\s*=\s*(["'])description\1/i.test(tag))return tag;count++;return '<meta name="description" content="'+esc(value)+'">';});
  if(count>1)throw Error('Multiple description tags need a source-code review.');return count?out:out.replace(/<\/head\s*>/i,()=>'<meta name="description" content="'+esc(value)+'">\n</head>');
 }
 if(field==='answer.section'){
  if(!/<\/main\s*>/i.test(html))throw Error('An answer section needs an existing main element.');
  const section='\n<section data-samaritan-section="'+esc(id)+'">'+renderArticleHtml(value)+'</section>\n';
  return html.replace(/<\/main\s*>/i,()=>section+'</main>');
 }
 throw Error('Unsupported website field.');
}
export function staticOnly(site:any,deploy:any,files:any[],functions:any[]){
 if(site.build_settings?.repo_url||site.build_settings?.repo_path||site.build_settings?.provider)throw Error('This Netlify site deploys from Git. Edits must go through its source repository so a later build cannot overwrite them.');
 if(!Array.isArray(functions)||functions.length||deploy.framework||deploy.functions?.length||Object.keys(deploy.edge_functions||{}).length||deploy.server||deploy.build_id||deploy.function_schedules?.length||files.some(f=>/^\/?(\.netlify|_worker|server|functions)\//.test(f.path)))throw Error('This deployment uses a runtime or functions. Connect its source repository before editing; a static redeploy could remove runtime behavior.');
 if(!files.length||files.length>10000||files.some(f=>!/^\/?[^\u0000]+$/.test(f.path)||!/^([a-f0-9]{40})$/i.test(f.sha)))throw Error('A complete, valid file manifest is required before deployment.');
}
export async function netlify(token:string,path:string,options:any={},raw=false,request=fetch){
 const res=await request('https://api.netlify.com/api/v1'+path,{...options,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{}),...(raw?{Accept:'application/vnd.bitballoon.v1.raw','Content-Type':'application/vnd.bitballoon.v1.raw'}:{}),...options.headers}});
 if(!res.ok)throw Error('Netlify returned HTTP '+res.status+'. Check the project ID and token permissions.');return raw?res.text():res.json();
}
export async function netlifySnapshot(c:any,token:string,domain:string,request=fetch){
 const id=String(c.config.siteId||'');if(!/^[a-zA-Z0-9-]{8,80}$/.test(id))throw Error('A valid Netlify project ID is required.');
 const site=await netlify(token,'/sites/'+encode(id),{},false,request);boundDomain(domain,[site.ssl_url,site.url,site.custom_domain,...(site.domain_aliases||[])].filter(Boolean));
 const deployment=site.published_deploy;if(!deployment?.id)throw Error('Publish this site in Netlify before connecting it.');
 const deploy=await netlify(token,'/deploys/'+encode(deployment.id),{},false,request);
 const files=await netlify(token,'/sites/'+encode(id)+'/files',{},false,request);
 const functions=await netlify(token,'/sites/'+encode(id)+'/functions',{},false,request);
 const current=await netlify(token,'/sites/'+encode(id),{},false,request);if(current.published_deploy?.id!==deployment.id)throw Error('The site changed while its files were being read. Please retry.');
 let blocked='';try{staticOnly(site,deploy,files,functions)}catch(e){blocked=(e as Error).message}
 return {site,deploy,files,blocked};
}
export async function withFramer(c:any,token:string,fn:(api:any)=>Promise<any>){
 const {connect}=await import('npm:framer-api@5.1.0');const api=await connect(projectUrl(c.config.projectUrl),token);
 try{return await fn(api)}finally{await api.disconnect()}
}
export async function cleanFramer(api:any){const changes=await api.getChangedPaths();if(Object.values(changes).some(v=>Array.isArray(v)&&v.length))throw Error('Framer has unpublished changes. Publish or resolve those changes first so this approval cannot publish unrelated work.');}
export async function framerIdentity(api:any,domain:string){const info=await api.getPublishInfo();const prod=info.production;const urls=[prod?.url,prod?.host,...(prod?.hostnames||[]).map((x:any)=>typeof x==='string'?x:x.hostname)].filter(Boolean);boundDomain(domain,urls);return info;}
export async function framerTarget(api:any,target:any){
 if(target.kind==='text'){
  const page=await api.getNode(target.pageId);if(!page||page.draft||page.collectionId||typeof page.getNodesWithType!=='function'||!(await page.getNodesWithType('TextNode')).some((n:any)=>n.id===target.id))throw Error('Choose an editable text node on a published static page.');
  const node=await api.getNode(target.id);if(!node||typeof node.getText!=='function')throw Error('This text node is no longer editable.');
  // Shared components and CMS-bound text require edits through their authoritative source.
  if(node.componentId||node.text?.type==='variable')throw Error('Use the source component or CMS field for this text.');
  return {before:await node.getText()||'',write:async(value:string)=>node.setText(value)};
 }
 if(target.kind==='cms'){
  const collection=await api.getCollection(target.collectionId);if(!collection)throw Error('CMS collection not found.');
  const fields=await collection.getFields(),field=fields.find((f:any)=>f.id===target.fieldId);if(!field||!['string','formattedText'].includes(field.type))throw Error('Choose a text CMS field.');
  const item=(await collection.getItems()).find((i:any)=>i.id===target.itemId);if(!item||item.draft)throw Error('Choose an existing published CMS item.');
  const entry=item.fieldData[field.id];if(entry?.valueByLocale&&Object.keys(entry.valueByLocale).length)throw Error('Localized fields need a locale-specific review before editing.');
  return {type:field.type,before:entry?.value||'',write:async(value:string)=>item.setAttributes({fieldData:{[field.id]:{type:field.type,value,...(field.type==='formattedText'?{contentType:'html'}:{})}}})};
 }
 throw Error('Unsupported Framer target.');
}
