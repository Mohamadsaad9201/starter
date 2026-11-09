/* A continuous, pausable illustrative growth animation. Values are illustrative, never account telemetry. */
(() => {
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const value=document.getElementById('growth-value'),clip=document.getElementById('growth-clip'),tip=document.getElementById('growth-tip');
 const points=[[20,214],[210,192],[400,160],[590,124],[780,86],[980,30]];
 const segments=points.slice(1).map((p,i)=>{const start=points[i],mid=(start[0]+p[0])/2;return [start,[mid,start[1]],[mid,p[1]],p];});
 const path='M'+points[0].join(' ')+segments.map(s=>'C'+s.slice(1).map(p=>p.join(' ')).join(' ')).join('');
 document.getElementById('growth-path').setAttribute('d',path);
 document.getElementById('growth-area').setAttribute('d',path+'L980 230L20 230Z');
 let frame=null,visible=false,last=null,elapsed=0;
 function draw(progress){
  const n=Math.min(segments.length-1,Math.floor(progress*segments.length)),t=progress===1?1:progress*segments.length-n,s=segments[n],u=1-t;
  const xy=[0,1].map(k=>u*u*u*s[0][k]+3*u*u*t*s[1][k]+3*u*t*t*s[2][k]+t*t*t*s[3][k]);
  clip.setAttribute('width',xy[0]+2);tip.setAttribute('cx',xy[0]);tip.setAttribute('cy',xy[1]);
  value.textContent='$'+((95000+(214-xy[1])/184*442200)/1000).toFixed(2)+'K';
 }
 function render(){
  draw(Math.min(1,elapsed/18000));
  if(elapsed>18000){
   const extra=(elapsed-18000)/1000;
   value.textContent='$'+((537200+extra*350)/1000).toFixed(2)+'K';
   // A slowly advancing trend stays within the plot while the illustrative total grows.
   const wave=extra/16;
   const rolling=points.map(([x,y],i)=>[x,y+Math.sin(wave+i*.8)*3]);
   const d='M'+rolling[0].join(' ')+rolling.slice(1).map((p,i)=>{const a=rolling[i],m=(a[0]+p[0])/2;return `C${m} ${a[1]} ${m} ${p[1]} ${p[0]} ${p[1]}`;}).join('');
   document.getElementById('growth-path').setAttribute('d',d);
   document.getElementById('growth-area').setAttribute('d',d+'L980 230L20 230Z');
   tip.setAttribute('cy',rolling[rolling.length-1][1]);
  }
 }
 function allowed(){return visible&&!reduced.matches&&!document.hidden&&!document.body?.classList.contains('motion-paused');}
 function sync(){
  if(!allowed()){cancelAnimationFrame(frame);frame=null;last=null;if(reduced.matches)draw(1);return;}
  if(frame===null)frame=requestAnimationFrame(step);
 }
 function step(now){frame=null;if(!allowed()){sync();return;}if(last!==null)elapsed+=Math.max(0,now-last);last=now;render();frame=requestAnimationFrame(step);}
 draw(reduced.matches?1:0);
 const observer=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);sync();},{threshold:.15});
 observer.observe(document.querySelector('.growth-visual'));
 document.addEventListener('visibilitychange',sync);
 reduced.addEventListener('change',sync);
 if(typeof MutationObserver!=='undefined'&&document.body)new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
 const agents={
 seo:{label:'SEO workflow',title:'Turn search opportunities into useful changes.',description:'Bring Search Console queries and website findings into one priority list. Review proposed improvements, then verify supported changes on the live page.',jobs:[['Find','Queries and pages that deserve attention'],['Prepare','Business-specific page improvements'],['Verify','What changed after approved execution']],output:'A reviewable proposal with its evidence.'},
 geo:{label:'GEO / AEO workflow',title:'Go beyond counting AI mentions.',description:'Inspect recorded AI answers, citations and missing mentions. Turn question-level gaps into specific work on the pages your customers need.',jobs:[['Inspect','Answers to your business’s customer questions'],['Prioritize','Missing mentions and citation gaps'],['Recheck','The same questions after useful changes']],output:'A question-specific improvement plan.'},
 content:{label:'Content workflow',title:'From “we should write that” to ready for review.',description:'Start with recommended topics grounded in your business. Prepare useful drafts, check the facts and approve supported website publishing.',jobs:[['Choose','A topic with a clear customer purpose'],['Draft','An article shaped by your products and voice'],['Review','The exact version before publication']],output:'A complete draft, ready for a decision.'},
 paid:{label:'Paid media workflow',title:'Put evidence behind the next campaign decision.',description:'Connect Google Ads and Meta Ads reporting with your business context. Prepare creative, review an exact campaign status change and verify the provider response.',jobs:[['Inspect','Account reporting, spend and reporting windows'],['Review','A specific pause or resume proposal'],['Verify','The campaign status after approved execution']],output:'An account-specific decision with an execution record.',note:'Reporting and approved pause/resume are supported. Launching ads and changing budgets are not enabled in this workspace.'}
 };
 const routes={seo:'/seo/',geo:'/ai-visibility/',content:'/content/',paid:'/paid-media/'};
 document.querySelectorAll('[data-agent]').forEach(b=>b.addEventListener('click',()=>{const a=agents[b.dataset.agent];document.querySelectorAll('[data-agent]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.getElementById('agent-detail').innerHTML=`<div class="channel-heading"><span class="samaritan-mark" data-scanner-key="role" aria-hidden="true"><img src="/assets/samaritan/scanner.webp" width="64" height="64" alt=""></span><span class="demo-badge">${a.label}</span></div><h3>${a.title}</h3><p>${a.description}</p><ol class="agent-jobs">${a.jobs.map(([verb,task])=>`<li><span>${verb}</span>${task}</li>`).join('')}</ol><div class="channel-output"><small>THE DELIVERABLE</small><b>${a.output}</b></div><a class="agent-deep-link" href="${routes[b.dataset.agent]}">Explore the full workflow ↗</a>${a.note?`<p class="channel-note">${a.note}</p>`:''}`;}));
})();
