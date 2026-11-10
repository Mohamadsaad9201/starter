// Stub of window.supabase for local testing. Serves fixtures from window.__FIX.
(function(){
const F=()=>window.__FIX;
const persist=()=>{try{sessionStorage.setItem('__fixTables',JSON.stringify({sites:F().tables.sites,connectors:F().tables.connectors}));}catch{}};
try{const saved=JSON.parse(sessionStorage.getItem('__fixTables')||'null');if(saved)Object.assign(window.__FIX.tables,saved);}catch{}
// simulate the Google OAuth return creating a Search Console connector
if(/connected=google/.test(location.search)){const sid=decodeURIComponent((location.hash.match(/onboarding\/([^/]+)/)||[])[1]||'');if(sid&&!window.__FIX.tables.connectors.some(c=>c.site_id===sid&&c.type==='gsc'))window.__FIX.tables.connectors.push({id:'g-'+sid,site_id:sid,type:'gsc',label:'Google',config:{},status:'connected',created_at:new Date().toISOString()});persist();}
window.__calls=[];window.__writes=[];
function builder(table){
  const st={table,filters:[],single:false,op:'select'};
  const exec=()=>{
    window.__calls.push(st.op+':'+table);
    const T=(F().tables[table] ||= []);
    const match=r=>st.filters.every(([k,op,v])=>op==='eq'?String(r[k])===String(v):op==='neq'?String(r[k])!==String(v):op==='gte'?String(r[k])>=String(v):op==='in'?v.includes(r[k]):true);
    if(st.op==='insert'){const rows=[].concat(st.payload).map(r=>({created_at:new Date().toISOString(),...r}));T.push(...rows);window.__writes.push(['insert',table,rows]);persist();return {data:rows,error:null};}
    if(st.op==='update'){const hit=T.filter(match);hit.forEach(r=>Object.assign(r,st.payload));window.__writes.push(['update',table,st.payload,hit.length]);persist();return {data:hit,error:null};}
    if(st.op!=='select')return {data:[],error:null};
    let rows=T.filter(match);
    if(st.limit)rows=rows.slice(0,st.limit);
    return {data:st.single?(rows[0]||null):rows,error:null};
  };
  const b={
    select(){return b;},eq(k,v){st.filters.push([k,'eq',v]);return b;},neq(k,v){st.filters.push([k,'neq',v]);return b;},gte(k,v){st.filters.push([k,'gte',v]);return b;},
    in(k,v){st.filters.push([k,'in',v]);return b;},is(){return b;},not(){return b;},or(){return b;},lt(){return b;},lte(){return b;},gt(){return b;},ilike(){return b;},filter(){return b;},match(){return b;},range(){return b;},
    order(){return b;},limit(n){st.limit=n;return b;},single(){st.single=true;return b;},maybeSingle(){st.single=true;return b;},
    insert(p){st.op='insert';st.payload=p;return b;},update(p){st.op='update';st.payload=p;return b;},upsert(){st.op='upsert';return b;},delete(){st.op='delete';return b;},
    then(res,rej){return Promise.resolve(exec()).then(res,rej);}
  };
  return b;
}
const session={access_token:'fake',user:{id:'u1',email:'tester@impacktmedia.com'}};
window.supabase={createClient(){return {
  auth:{getSession:async()=>({data:{session}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},signOut:async()=>({}),signInWithOtp:async()=>({})},
  from:builder,
  rpc(name,args){window.__calls.push('rpc:'+name);const r=F().rpc[name];const v=typeof r==='function'?r(args):r;return Promise.resolve(v===undefined?{data:null,error:null}:{data:v,error:null});},
  channel(){const c={on(){return c;},subscribe(){return c;}};return c;},removeChannel(){},
  functions:{invoke:async(name,o)=>{window.__calls.push('fn:'+name);await new Promise(r=>setTimeout(r,300));return name==='business-intake'?{data:{name:'Zabiha Corner Market',description:'Online halal butcher delivering zabiha beef, lamb and chicken across Michigan.',industry:'Halal grocery',customers:'Muslim families in Michigan',model:'Online delivery',locations:'Dearborn, MI',sources:['https://www.zabihacorner.com/','https://www.zabihacorner.com/pages/about']},error:null}:{data:{},error:null};}},
};}};
})();
