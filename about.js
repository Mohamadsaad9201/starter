/* User-initiated film playback. Keep native controls, captions and fullscreen. */
(() => {
 const video=document.querySelector('.ab-film video'),play=document.querySelector('.ab-play');if(!video||!play)return;
 const frame=video.closest('.ab-film');
 play.addEventListener('click',async()=>{try{await video.play();frame.dataset.started='true';video.focus();}catch{frame.removeAttribute('data-started');video.controls=true;}});
 video.addEventListener('play',()=>{frame.dataset.started='true';});
 video.addEventListener('ended',()=>{frame.removeAttribute('data-started');});
 video.addEventListener('error',()=>{if(frame.nextElementSibling?.classList.contains('ab-film-error'))return;const note=document.createElement('p');note.className='ab-film-error';note.append('The film could not load. ');const link=document.createElement('a');link.href='/assets/about/impackt-story.mp4';link.textContent='Open the film directly';note.append(link);frame.after(note);});
 if('IntersectionObserver' in window){const io=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)return;if(!video.paused)video.pause();},{threshold:.08});io.observe(video);}
})();
