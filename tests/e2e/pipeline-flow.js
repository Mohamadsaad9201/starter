// Run: node tests/e2e/pipeline-flow.js   (needs Playwright with Chromium; prints a JSON report and exits non-zero on a mismatch)
// Cross-surface check: the same work, loaded as agency, owner and reviewer, shows the same approval count and status
// before and after one approval. Fixture data only; the "server" state lives in this process.
const { chromium } = require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),H=__dirname,OUT=path.join(process.env.E2E_OUT||require('os').tmpdir(),'samaritan-pipeline-e2e');fs.mkdirSync(OUT,{recursive:true});
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(0);
const now=new Date().toISOString(),body='# Fixture headline\n\n'+'A finished paragraph. '.repeat(80);
const state={drafts:[
 {id:'a1',site_id:'hwd',workspace:'seo',kind:'Blog post',title:'Fixture article ready to publish',body,status:'needs_review',created_at:now},
 {id:'b1',site_id:'hwd',workspace:'seo',kind:'Content brief',title:'Fixture accepted plan',body:'plan',status:'approved',created_at:now,decided_at:now},
 {id:'b2',site_id:'hwd',workspace:'seo',kind:'Content brief',title:'Fixture page-revision brief',body:'brief',status:'needs_review',created_at:now},
 {id:'b3',site_id:'hwd',workspace:'ads',kind:'Campaign brief',title:'Fixture campaign brief',body:'brief',status:'needs_review',created_at:now},
 {id:'b4',site_id:'hwd',workspace:'seo',kind:'Blog post',title:'Article AI assistants will quote: Topic: fixture',body,status:'needs_review',created_at:now}],
 pipeline:[
 {draft_id:'a1',site_id:'hwd',lane:'approval',ready:true,adapter:'shopify_article',payload_hash:'h1',reasons:[],prepared_by:'system',checked_at:now,source_draft_id:'b1',updated_at:now},
 {draft_id:'b1',site_id:'hwd',lane:'closed',ready:false,reasons:[],stage:'delivered',deliverable_id:'a1',checked_at:now,updated_at:now},
 {draft_id:'b2',site_id:'hwd',lane:'production',ready:false,reasons:[{code:'no_execution_adapter',detail:'x'}],stage:'blocked',blocker:{code:'no_deliverable_path',detail:'This brief recommends changes to existing pages.'},checked_at:now,updated_at:now},
 {draft_id:'b3',site_id:'hwd',lane:'production',ready:false,reasons:[{code:'no_execution_adapter',detail:'x'}],stage:'blocked',blocker:{code:'no_execution_adapter',detail:'Paid campaigns cannot be created from here.'},checked_at:now,updated_at:now},
 {draft_id:'b4',site_id:'hwd',lane:'production',ready:false,adapter:'shopify_article',reasons:[{code:'working_title',detail:'The title is an internal working label, not the article headline.'}],checked_at:now,updated_at:now}],
 publications:[],approvals:[]};
const work=()=>({as_of:new Date().toISOString(),awaiting_approval:state.pipeline.filter(p=>p.lane==='approval').length,blocked:state.pipeline.filter(p=>p.stage==='blocked'||p.lane==='attention').length,delivered:state.pipeline.filter(p=>p.stage==='delivered').length,verified:state.publications.filter(p=>p.verification?.state==='verified').length});
// Injected between the shared fixtures and the Supabase stub: replaces HWD's content records with this test's state.
const inject=()=>`(()=>{const st=${JSON.stringify({...state,work:work()})},F=window.__FIX,G=${JSON.stringify(['lane','ready','adapter','payload_hash','reasons','stage','blocker','prepared_by','checked_at','source_draft_id','deliverable_id'])};
 F.tables.drafts=st.drafts;F.tables.draft_pipeline=st.pipeline;F.tables.fixes=[];F.tables.client_reviews=[];
 const merged=st.drafts.map(d=>{const g=st.pipeline.find(p=>p.draft_id===d.id)||{};return {...d,...Object.fromEntries(G.map(k=>[k,g[k]]))};});
 const base=F.rpc.client_workspace;F.rpc.client_workspace=a=>({...(typeof base==='function'?base(a):base),fixes:[],drafts:merged,publications:st.publications.map(p=>({draft_id:p.draft_id,kind:'article',status:p.status,published_at:p.published_at,verification:p.verification?.state})),work:st.work,reviews:[]});
 F.rpc.work_status=()=>st.work;})();`;
const surfaces=async(p,role)=>{
 const out={role},go=async h=>{await p.evaluate(x=>location.hash=x,h);await p.waitForTimeout(700);};
 await go('#/w/hwd/inbox');
 out.queueHeading=(await p.locator('.q-head h1').first().innerText().catch(()=>'')).trim();
 out.queueRows=await p.locator('.q-row').count();out.queueApprove=(await p.locator('[data-q-approve]').first().innerText().catch(()=>'')).trim();
 out.queueTitles=(await p.locator('.q-row').allInnerTexts()).map(t=>t.split('\n').find(l=>/Fixture|Article AI/.test(l))||t.slice(0,40));
 out.production=(await p.locator('.production-panel summary').first().innerText().catch(()=>'')).replace(/\s+/g,' ').trim();
 await go('#/w/hwd/content');
 out.approveButtons=await p.locator('[data-approve-work],[data-owner-draft="approved"]').count()+(role==='admin'?0:0);
 out.briefHasApprove=await p.locator('#draft-b2 [data-approve-work], #draft-b2 [data-draft="approved"]').count();
 await go('#/w/hwd/today');
 out.overview=(await p.locator('.review-ledger header span, .decision-count, .cmd-hero b').first().innerText().catch(()=>'')).trim();
 if(!out.overview){await go('#/w/hwd/ask');out.overview=(await p.locator('.review-ledger header span, .decision-count, .cmd-hero b').first().innerText().catch(()=>'')).trim();}
 if(role==='admin'){await go('#/agency');out.agencyRow=await p.evaluate(()=>{const row=[...document.querySelectorAll('tr,li,article,a')].find(e=>/Halal World Depot/.test(e.textContent)&&e.textContent.length<400);return row?row.textContent.replace(/\s+/g,' ').trim().slice(0,200):'';});await go('#/w/hwd/activity');const t=await p.locator('main').innerText().catch(()=>'');out.activity=['Ready for approval: Fixture article','Samaritan finished an article from a plan','cannot be published yet','Published to Shopify: Fixture article','Checked on the live page: Fixture article'].filter(x=>t.includes(x));}
 return out;};
(async()=>{
 const base=`http://localhost:${srv.address().port}/app/`,b=await chromium.launch(),errs=[],approveCalls=[];
 const open=async role=>{
  const ctx=await b.newContext({timezoneId:'America/Detroit',viewport:{width:1280,height:900}});
  await ctx.addInitScript(`window.__ROLE=${JSON.stringify(role)};window.__MIGRATED=true;`);
  await ctx.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(H+'/fixtures.js','utf8')+'\n'+inject()+'\n'+fs.readFileSync(H+'/fake-supabase.js','utf8')}));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.fulfill({body:''}));
  await ctx.route('https://egtvvunkdkpqmfafhkjg.supabase.co/**',async r=>{const u=r.request().url();let body={};try{body=JSON.parse(r.request().postData()||'{}');}catch{}
   const fn=(u.match(/functions\/v1\/([a-z-]+)/)||[])[1];let out={},status=200;
   if(fn==='playbooks'&&body.action==='approve'){
    approveCalls.push({role,draft:body.draft_id,hash:body.payload_hash});await new Promise(z=>setTimeout(z,250));
    const d=state.drafts.find(x=>x.id===body.draft_id),g=state.pipeline.find(x=>x.draft_id===body.draft_id);
    if(d.status==='approved')out={ok:true,already:true};
    else if(!g?.ready||g.lane!=='approval'){status=500;out={error:'This item is not ready to publish: '+(g?.reasons||[]).map(x=>x.detail).join(' ')};}
    else if(body.payload_hash!==g.payload_hash){status=500;out={error:'This item changed after you opened it. Review the latest version, then approve.'};}
    else{d.status='approved';d.decided_at=new Date().toISOString();g.lane='closed';g.ready=false;state.approvals.push({role,draft:d.id});
     // stands in for the engine's publish job and its independent live-page check
     state.publications.push({draft_id:d.id,site_id:'hwd',status:'published',published_at:new Date().toISOString(),snapshot:{title:d.title},verification:{state:'verified',checked_at:new Date().toISOString(),url:'https://fixture.test/blogs/news/a1'}});out={ok:true,queued:true};}
   }
   else if(fn==='engine')out={workspace_load:{topics:[],publications:state.publications,messages:[]},aeo_report:{runs:[],checks:[]}}[body.action]||{};
   else if(fn==='team-chat')out={threads:[],messages:[]};
   else if(fn==='connect')out={providers:{}};
   r.fulfill({status,contentType:'application/json',body:JSON.stringify(out)});});
  const p=await ctx.newPage();p.setDefaultTimeout(2500);p.on('pageerror',e=>errs.push(role+': '+e.message));await p.goto(base+'#/w/hwd/inbox');await p.waitForTimeout(1500);return {ctx,p};};
 const result={before:[],after:[]};
 for(const role of ['admin','owner','reviewer']){const {ctx,p}=await open(role);result.before.push(await surfaces(p,role));await p.evaluate(()=>location.hash='#/w/hwd/inbox');await p.waitForTimeout(700);await p.screenshot({path:`${OUT}/before-${role}.png`});await ctx.close();}
 // A brief cannot be approved even by calling the endpoint directly.
 {const {ctx,p}=await open('admin');result.directBriefApprove=await p.evaluate(async()=>{const r=await fetch('https://egtvvunkdkpqmfafhkjg.supabase.co/functions/v1/playbooks',{method:'POST',body:JSON.stringify({action:'approve',site_id:'hwd',draft_id:'b2',payload_hash:'x'})});return (await r.json()).error;});await ctx.close();}
 // One approval, as the reviewer (a client role), double-clicked.
 {const {ctx,p}=await open('reviewer');await p.evaluate(()=>location.hash='#/w/hwd/content');await p.waitForTimeout(900);
  const btn=p.locator('[data-approve-work="a1"]').first();result.approveLabel=(await btn.innerText()).trim();
  await btn.dblclick({force:true}).catch(()=>{});await p.waitForTimeout(1600);await p.screenshot({path:`${OUT}/after-approve-reviewer.png`});await ctx.close();}
 result.approveCalls=approveCalls.filter(c=>c.draft==='a1');result.approvalsRecorded=state.approvals;
 for(const role of ['admin','owner','reviewer']){const {ctx,p}=await open(role);result.after.push(await surfaces(p,role));if(role==='admin'){await p.evaluate(()=>location.hash='#/w/hwd/activity');await p.waitForTimeout(700);await p.screenshot({path:`${OUT}/after-activity-admin.png`});}await ctx.close();}
 result.pageErrors=errs;
 const problems=[];const same=(k,list)=>{if(new Set(list.map(x=>x[k])).size!==1)problems.push(k+' differs: '+JSON.stringify(list.map(x=>[x.role,x[k]])));};
 same('queueRows',result.before);same('queueRows',result.after);same('queueHeading',result.before);same('queueHeading',result.after);same('production',result.before);
 if(result.before[0].queueRows!==1)problems.push('expected exactly the one finished article in the queue');
 if(result.after[0].queueRows!==0)problems.push('approved work still in a queue');
 if(result.before.some(x=>x.briefHasApprove))problems.push('a brief offers an approve button');
 if(result.approveCalls.length!==1)problems.push('expected one approve call, saw '+result.approveCalls.length);
 if(!/not ready to publish/.test(result.directBriefApprove||''))problems.push('a brief was approvable through the endpoint');
 if(!(result.after[0].activity||[]).includes('Checked on the live page: Fixture article'))problems.push('activity feed is missing the verification event');
 if(errs.length)problems.push('page errors');
 result.problems=problems;console.log(JSON.stringify(result,null,1));await b.close();srv.close();if(problems.length)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
