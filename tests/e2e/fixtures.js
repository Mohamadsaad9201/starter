// HWD-shaped fixtures. ROLE is set via window.__ROLE ('admin' | 'reviewer' | 'viewer').
(function(){
const role=window.__ROLE||'admin', now=new Date(), iso=now.toISOString();
const today=now.toLocaleDateString('en-CA',{timeZone:'America/Detroit'});
const daysAgo=n=>new Date(Date.now()-n*864e5).toISOString();
const ss=(over={})=>({version:'2026-11-05.2',decision:'draft_for_review',rewrite:true,defects:['Pipe-separated keyword list instead of a readable title'],ranking_mechanism:'Clearer title matches the query intent shoppers use.',reviewed_at:daysAgo(1),...over});
const fix=(i,o)=>({id:'shopify:gid://shopify/Product/'+i+'::seo.title::rev:'+i,site_id:'hwd',url:'https://www.halalworlddepot.com/products/p'+i,ref:'p'+i,kind:'product',page_name:'Halal Beef Pastrami '+i+' | 1lb |',field:'seo.title',target:'title',before:'Halal Beef Pastrami | Approx. 1lb | Freshly Sliced |',after:'Halal Beef Pastrami, Approx. 1lb Pack, Freshly Sliced',restore:null,reasons:['pipes'],status:'pending',error:null,priority:'high',note:null,decided_at:null,deployed_at:null,created_at:daysAgo(1),source:'checkup',data:{released_on:today,search_strategy:ss()},...o});
const fixes=[
 fix(1,{}),fix(2,{after:'Zabiha Halal Lamb Chops, Fresh Cut'}),
 fix(3,{data:{released_on:today,search_strategy:ss({version:'2026-11-04.1'})}}), // held: old evidence
 fix(4,{field:'image.alt',before:'',after:'Sliced halal beef pastrami on a board',data:{released_on:today}}),
 fix(5,{status:'deployed',deployed_at:daysAgo(3),data:{verification:{state:'verified',checkedAt:daysAgo(2)}}}),
 fix(6,{field:'seo.description',status:'deployed',deployed_at:daysAgo(4),data:{verification:{state:'verified'}}}),
];
const drafts=[
 {id:'0a2c5268-e7a5-4885-a274-f1e4f68fb451',site_id:'hwd',workspace:'ads',kind:'Offer ideas',title:'Offers that lift order size',body:'# Offer Ideas\n\n## What the numbers say\n\nIn the last 30 days Halal World Depot took 371 orders. The average order was $197, $3 under free delivery.',status:'needs_review',ranking_hold:null,created_at:daysAgo(6),revisions:[]},
 {id:'11111111-1111-4111-8111-111111111111',site_id:'hwd',workspace:'seo',kind:'Blog post',title:'How to buy zabiha halal lamb for Eid',body:'# Buying zabiha lamb\n\nChoose a trusted [certifier](https://www.halalworlddepot.com/pages/certification).\n\n## Cuts\n\nShoulder, leg and chops.',status:'needs_review',ranking_hold:null,created_at:iso,revisions:[]},
 {id:'22222222-2222-4222-8222-222222222222',site_id:'hwd',workspace:'seo',kind:'FAQ section',title:'Is your beef zabiha?',body:'## Is your beef zabiha?\n\nYes, every cut is certified.',status:'needs_review',ranking_hold:null,created_at:daysAgo(2),revisions:[]},
 {id:'33333333-3333-4333-8333-333333333333',site_id:'hwd',workspace:'seo',kind:'Blog post',title:'Old approved post',body:'Body',status:'approved',ranking_hold:null,created_at:daysAgo(9),revisions:[]},
];
const site={id:'hwd',name:'Halal World Depot',domain:'www.halalworlddepot.com',platform:'shopify',active:true,sort_order:1,role:role==='admin'?'agency':role,created_at:'2026-10-21T16:16:52Z'};
const daily=Array.from({length:60},(_,i)=>({site_id:'hwd',date:new Date(Date.now()-(60-i)*864e5).toISOString().slice(0,10),clicks:20+i%7,impressions:900+i*3,ctr:.02,position:14.2}));
const conns=[{id:'c1',site_id:'hwd',type:'shopify',label:'Shopify',config:{shop:'halalworlddepot.myshopify.com',scopes:'read_products,write_products'},status:'connected',last_checked_at:daysAgo(0),last_error:null,created_at:daysAgo(19),secret_id:'s'}];
const adminReviews=[{site_id:'hwd',item_kind:'fix',item_id:fixes[0].id,decision:'approved',snapshot:{before:fixes[0].before,after:fixes[0].after,field:fixes[0].field},created_at:daysAgo(0)},{site_id:'hwd',item_kind:'draft',item_id:'22222222-2222-4222-8222-222222222222',decision:'changes_requested',snapshot:{title:'Is your beef zabiha?',body:'## Is your beef zabiha?\n\nYes, every cut is certified.'},created_at:daysAgo(1)}];
const reviews=role==='admin'?adminReviews:[{item_kind:'draft',item_id:'22222222-2222-4222-8222-222222222222',decision:'changes_requested',snapshot:{title:drafts[2].title,body:drafts[2].body},created_at:daysAgo(1)}];
const jobs=[{id:'j1',kind:'content_plan',status:'needs_review',channel:'content',error:'Needs a person',attempts:1,draft_id:null,run_after:daysAgo(2),created_at:daysAgo(2),finished_at:daysAgo(2),result:{}},{id:'j2',kind:'blog_publish',status:'succeeded',channel:'content',attempts:1,draft_id:drafts[3].id,run_after:daysAgo(5),created_at:daysAgo(5),finished_at:daysAgo(5),result:{}}];
const health=[{channel:'search',state:'healthy',site_id:'hwd',data_through:daysAgo(1),last_attempt_at:daysAgo(0),last_success_at:daysAgo(0),error:null,detail:null}];
window.__FIX={
 tables:{
  sites:[site],fixes,drafts,tasks:[{id:'t1',site_id:'hwd',kind:'manual',priority:'normal',target:'Homepage',url:'https://www.halalworlddepot.com/',before:'',after:'Add store hours',note:'',status:'pending',created_at:daysAgo(3)}],
  audits:[{id:'a1',site_id:'hwd',score:80,prev_score:81,run_type:'Weekly run',page_count:148,highlights:[],applied:0,created_at:daysAgo(0),summary:{titlesBad:100}}],
  connectors:conns,gsc_daily:daily.concat(Array.from({length:90},(_,i)=>({site_id:'zabihacorner',date:new Date(Date.now()-(90-i)*864e5).toISOString().slice(0,10),clicks:8+Math.round(6*Math.sin(i/6))+Math.floor(i/10),impressions:400+i*4,ctr:.02,position:16-i/30}))),gsc_queries:[{site_id:'zabihacorner',period_end:today,query:'zabiha meat delivery michigan',clicks:14,impressions:2100,ctr:.0067,position:13.4},{site_id:'zabihacorner',period_end:today,query:'halal butcher dearborn',clicks:120,impressions:1800,ctr:.066,position:3.1},{site_id:'zabihacorner',period_end:today,query:'halal lamb online',clicks:9,impressions:900,ctr:.01,position:7.2},{site_id:'hwd',period_end:today,query:'halal meat online',clicks:12,impressions:1400,ctr:.0086,position:9.1}],gsc_pages:[{site_id:'hwd',period_end:today,page:'https://www.halalworlddepot.com/',clicks:40,impressions:2000,ctr:.02,position:7}],
  aeo_runs:[],aeo_prompts:[],leads:[],opportunities:[{id:'o1',site_id:'hwd',kind:'ai_answer_gap',stage:'ready',title:'Answer “is halal world depot zabiha”',why:'chatgpt named others',draft_id:drafts[2].id,publishable:true,target_kind:'page',target_url:'https://www.halalworlddepot.com/pages/faq',evidence:{prompt:'is halal world depot zabiha'},baseline:{ai:{named:1,total:6}},created_at:daysAgo(2)}],
  search_experiments:[],chat_threads:[],client_reviews:reviews,workspace_access:[],playbook_runs:[],saved_insights:[],shop_daily:[],site_checks:[],site_check_history:[],analytics_sync:[],
 },
 rpc:{
  is_admin:role==='admin',client_sites:[site],
  client_workspace:{role,fixes:fixes.filter(f=>f.status!=='superseded').map(({id,field,page_name,url,before,after,status,priority,deployed_at,data})=>({id,field,page_name,url,before,after,status,priority,deployed_at,verification:data?.verification||null,...(window.__MIGRATED?{data:{released_on:data?.released_on,search_strategy:data?.search_strategy,verification:data?.verification}}:{})})),drafts:drafts.map(({id,title,kind,body,status,ranking_hold,created_at,workspace})=>({id,title,kind,body,status,ranking_hold,created_at,...(window.__MIGRATED?{workspace}:{})})),tasks:[],daily:daily.slice(-56).reverse(),connectors:conns.map(c=>({type:c.type,status:c.status,last_checked_at:c.last_checked_at})),reviews},
  operations_snapshot:{jobs,health,policy:{}},paid_snapshot:{changes:[],reports:[],controls:[]},pilot_snapshot:{program:{},snapshots:[]},
  marketing_results:{ai:[],work:fixes.filter(f=>f.status==='deployed'),pages:[],health,limits:{},search:[],topics:[],queries:[],reports:[],generated_at:iso,publications:[],page_publications:[]},
  business_knowledge:{rules:[],priorities:[],corrections:[],excluded_phrases:['hand slaughtered']},
  ai_answer_evidence:{run:{engines:['chatgpt'],finished_at:daysAgo(1)},prompts:[{prompt:'is halal world depot zabiha',named:1,cited:0,answers:6,rivals:[{name:'Rival Meats',n:3}],rival_count:3,source:{domain:'rival.com',url:'https://rival.com/faq',n:2},yours:null}]},
  owner_decide_fix:(a)=>(a.p_ids||[]).length,owner_decide_draft:true,my_workspace_role:role,
  tool_audits_data:{audits:[],connections:[]},ai_claims_data:[],system_health:{checked_at:iso,jobs_needing_review:[],jobs_running:0,jobs_queued_due:0},support_inbox:[],marketing_metrics:[],support_snapshot:{},admin_platform_apps:[],read_intake_profile:null,
 },
 engine:{workspace_load:{topics:[],publications:[],messages:[]},aeo_report:{runs:[],checks:[]},aeo_info:{},gsc_info:{},sales:{},blog_destinations:{canPublish:true,blogs:[{id:'b1',title:'News'}]}},
};
})();
