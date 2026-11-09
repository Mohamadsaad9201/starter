/* Progressive disclosure. No form submission or external tracking of selections. */
(() => {
 const form=document.getElementById('growth-brief'); if(!form)return;
 let step=1;
 const goal=()=>form.querySelector('[name="goal"]:checked')?.value;
 const channels=()=>Array.from(form.querySelectorAll('[name="channel"]:checked'),input=>input.value);
 function show(next){
   step=next;form.querySelectorAll('[data-step]').forEach(panel=>panel.hidden=Number(panel.dataset.step)!==step);
   document.getElementById('brief-step-label').textContent='STEP '+step+' OF 3';
   const progress=form.querySelector('[role="progressbar"]');progress.setAttribute('aria-valuenow',String(step));progress.firstElementChild.style.width=(step/3*100)+'%';
   document.getElementById('brief-error').textContent='';
   if(step===3){
     document.getElementById('brief-goal').textContent=goal();document.getElementById('brief-channels').textContent=channels().join(' · ');
     const body='Hi Impackt Media,\n\nI would like to discuss a growth plan.\n\nPrimary goal: '+goal()+'\nChannels: '+channels().join(', ')+'\n\nBusiness name / website:\n';
     document.getElementById('brief-email').href='mailto:media@impacktmedia.com?subject='+encodeURIComponent('My growth brief')+'&body='+encodeURIComponent(body);
   }
   const heading=form.querySelector('[data-step="'+step+'"] legend');heading.tabIndex=-1;heading.focus({preventScroll:true});
 }
 function next(){
   if(step===1&&!goal()){document.getElementById('brief-error').textContent='Choose one goal to continue.';form.querySelector('[name="goal"]').focus();return;}
   if(step===2&&!channels().length){document.getElementById('brief-error').textContent='Choose at least one channel to continue.';form.querySelector('[name="channel"]').focus();return;}
   if(step<3)show(step+1);
 }
 form.addEventListener('submit',event=>{event.preventDefault();next();});
 form.addEventListener('click',event=>{if(event.target.closest('[data-brief-next]'))next();if(event.target.closest('[data-brief-back]'))show(Math.max(1,step-1));});
})();
