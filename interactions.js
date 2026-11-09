/* Impackt presentation interactions. Progressive enhancement; no analytics, model calls or dependencies. */
(() => {
 'use strict';
 if (document.querySelector('#root') || !document.querySelector('main')) return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
 const button=(label,fn)=>{const e=node('button','im-choice',label);e.type='button';e.addEventListener('click',fn);return e;};
 const animate=(el)=>{if(!reduced.matches)el.animate([{opacity:.35,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});};
 // A thin reading cue, updated once per frame; no perpetual animation loop.
 const progress=node('div','im-progress');progress.setAttribute('aria-hidden','true');document.body.append(progress);
 let scheduled=false;
 const paint=()=>{scheduled=false;const max=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${max>0?Math.min(1,Math.max(0,scrollY/max)):0})`;};
 addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(paint);}},{passive:true});addEventListener('resize',paint);paint();
 // Inspect the actual illustration at a useful size, with native dialog focus/Escape behavior.
 const preview=$('.o-window');
 if(preview){
  const open=button('Expand workspace ↗',()=>{dialog.showModal();document.body.classList.add('im-modal-open');});open.className='im-expand';preview.append(open);
  const dialog=node('dialog','im-lightbox');dialog.setAttribute('aria-label','Workspace illustration');
  const bar=node('div','im-lightbox-bar');bar.append(node('span','','Illustrative workspace · sample data'));
  const zoom=button('Zoom in',()=>{const on=frame.classList.toggle('is-zoomed');zoom.textContent=on?'Fit to screen':'Zoom in';zoom.setAttribute('aria-pressed',String(on));});zoom.setAttribute('aria-pressed','false');
  const close=button('Close ×',()=>dialog.close());bar.append(zoom,close);
  const frame=node('div','im-lightbox-image'),img=$('img',preview).cloneNode();frame.append(img);dialog.append(bar,frame);document.body.append(dialog);
  dialog.addEventListener('close',()=>{document.body.classList.remove('im-modal-open');open.focus({preventScroll:true});});
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 }
 // Compare the existing receipt's exact before/after copy; the original four steps remain.
 const steps=$('#steps'),serps=steps?$$('.c-serp',steps):[];
 if(steps&&serps.length===2){
  const compare=node('div','im-compare');compare.innerHTML='<div class="im-compare-head"><div><span class="im-kicker">Explore the change</span><h3>From a blank snippet to a useful answer.</h3></div><span class="im-sample">Illustration</span></div><div class="im-compare-labels"><span>Before</span><span>Proposed copy</span></div>';
  const canvas=node('div','im-compare-canvas');const before=serps[0].cloneNode(true),after=serps[1].cloneNode(true);before.classList.add('im-before');after.classList.add('im-after');before.setAttribute('aria-hidden','true');after.setAttribute('aria-hidden','true');canvas.append(before,after,node('i','im-compare-line'));compare.append(canvas);
  const label=node('label','im-range-label','Drag to compare the search descriptions');const range=node('input','im-range');range.type='range';range.min='0';range.max='100';range.value='55';range.id='im-description-compare';label.htmlFor=range.id;
  const output=node('output','im-range-output');output.htmlFor=range.id;const update=()=>{canvas.style.setProperty('--split',range.value+'%');output.textContent=range.value+'% proposed copy';range.setAttribute('aria-valuetext',output.textContent);};range.addEventListener('input',update);update();compare.append(label,range,output);
  const accessible=node('details','im-text-compare');accessible.append(node('summary','','Read both descriptions'));accessible.append(node('p','','Before: '+$('.d',serps[0]).textContent),node('p','','Proposed: '+$('.d',serps[1]).textContent));compare.append(accessible);steps.after(compare);
 }
 // Switch illustrative customer questions; no live ranking or provider calls are implied.
 const chat=$('.c-chat'),answer=$('#aiAnswer');
 if(chat&&answer){
  answer.dataset.interactiveExample='true';chat.removeAttribute('role');chat.setAttribute('aria-label','Illustrative AI-search examples');
  const choices=node('div','im-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','Example business type');
  const examples=[
   ['Local service',"Who's the best emergency dentist open Saturday in Austin?",'A useful answer can identify a practice, its location and relevant services.','Your business · same-day emergency visits, open Saturdays'],
   ['Online store','Where can I order halal meat online?','A useful answer can explain the options and point to relevant product and delivery information.','Your business · product details and delivery information'],
   ['Multiple locations','Which location is closest to me?','A useful answer can distinguish locations and link to the relevant branch page.','Your business · the right location, hours and directions']
  ];
  const buttons=examples.map((example,i)=>{const b=button(example[0],()=>select(i));choices.append(b);return b;});
  const select=i=>{buttons.forEach((b,n)=>b.setAttribute('aria-pressed',String(i===n)));$('.q',chat).textContent=examples[i][1];answer.replaceChildren(node('p','',examples[i][2]),node('div','im-answer-business',examples[i][3]));const meta=$('.meta',chat);meta.replaceChildren(node('span','','Illustration · sample answer'),node('b','','Real results vary by question'));animate(answer);};
  chat.prepend(choices);select(0);
  // calm.js's older one-shot illustration must not overwrite the selected example.
  answer.removeAttribute('id');
 }
 // Plan exploration highlights scope without inventing prices or changing the sales flow.
 const plans=$('.gx-plans,.c-plans');
 if(plans){
  const cards=$$('.gx-plan,.c-plan',plans),control=node('div','im-plan-explore');control.append(node('span','im-kicker','Explore a starting point'));
  const choices=node('div','im-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','Plan focus');const status=node('p','im-plan-status');status.setAttribute('aria-live','polite');
  const labels=['Search visibility','Search + leads','Multiple brands or locations'];
  const buttons=cards.map((card,i)=>{const b=button(labels[i],()=>{buttons.forEach((x,n)=>x.setAttribute('aria-pressed',String(i===n)));cards.forEach((c,n)=>c.classList.toggle('im-selected',n===i));status.textContent=$('h3',card).textContent+' · '+$('p',card).textContent;animate(card);});choices.append(b);return b;});
  control.append(choices,status);plans.before(control);status.textContent='Choose a focus to explore the scope. Your team confirms the right plan on your call.';
 }
 // Search and filter real items already on the page. The content stays in the HTML.
 function directory(grid,items,categories,label){
  if(!grid||!items.length)return;
  const controls=node('div','im-directory'),searchLabel=node('label','im-search-label',label),search=node('input','im-search');search.type='search';search.placeholder=label;searchLabel.append(search);controls.append(searchLabel);
  const tabs=node('div','im-choices');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Filter categories');controls.append(tabs);
  const status=node('p','im-directory-status');status.setAttribute('role','status');controls.append(status);grid.before(controls);
  const empty=node('p','im-directory-empty','No matches. Try another search or category.');empty.hidden=true;grid.after(empty);
  let active='All';const buttons=[];
  const apply=()=>{const q=search.value.trim().toLowerCase();let count=0;items.forEach((item,i)=>{const show=(!q||item.textContent.toLowerCase().includes(q))&&(active==='All'||categories[i]===active);item.hidden=!show;if(show)count++;});buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===active)));status.textContent=`${count} of ${items.length} ${items.length===6?'connections':'stories'}`;empty.hidden=count>0;requestAnimationFrame(paint);};
  ['All',...new Set(categories)].forEach(category=>{const b=button(category,()=>{active=category;apply();});buttons.push(b);tabs.append(b);});search.addEventListener('input',apply);apply();
 }
 const stories=$('.story-grid');if(stories)directory(stories,$$('.story-card',stories),$$('.story-card .eyebrow',stories).map(e=>e.textContent.trim()),'Search client stories');
 if(location.pathname.replace(/\/$/,'')==='/integrations'){
  const grid=$('.capability-grid'),items=grid?$$('article',grid):[];directory(grid,items,items.map(e=>/Search Console/.test(e.textContent)?'Search':/Ads/.test(e.textContent)?'Paid media':'Websites'),'Search integrations');
 }
 // Smooth, keyboard-native FAQ accordions. One answer per group keeps the page calm.
 $$('.c-faq details,.gx-faq details,.faq details').forEach(detail=>{
  const summary=$('summary',detail);if(!summary)return;let motion=null,desired=detail.open;
  const setOpen=open=>{const start=detail.getBoundingClientRect().height;desired=open;motion?.cancel();if(reduced.matches){detail.open=open;detail.style.height='';detail.style.overflow='';return;}detail.open=true;const end=open?detail.scrollHeight:summary.getBoundingClientRect().height;detail.style.overflow='hidden';motion=detail.animate([{height:start+'px'},{height:end+'px'}],{duration:240,easing:'cubic-bezier(.2,.7,.3,1)'});motion.onfinish=()=>{detail.open=open;detail.style.height='';detail.style.overflow='';motion=null;};};
  detail.imClose=()=>setOpen(false);summary.addEventListener('click',e=>{e.preventDefault();const open=!desired;if(open)$$('details[open]',detail.parentElement).filter(x=>x!==detail).forEach(x=>x.imClose?.());setOpen(open);});
 });
 // In-view entrances for previously static subpage cards; never conceal essential text.
 if(!reduced.matches&&'IntersectionObserver' in window){const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;entry.target.animate([{opacity:.55,transform:'translateY(16px)'},{opacity:1,transform:'translateY(0)'}],{duration:480,easing:'cubic-bezier(.2,.7,.3,1)'});io.unobserve(entry.target);}),{threshold:.12});$$('.story-card,.capability-grid article,.gx-plan,.product-steps li').forEach(e=>io.observe(e));}
})();
