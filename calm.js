// Impackt calm site: nav state, hero parallax, scroll reveals, small story animations.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = document.getElementById("nav");
  const hero = document.querySelector(".c-hero,.o-hero");
  const bg = document.getElementById("heroBg");

  // Nav: transparent over the hero, frosted once you scroll past it.
  const setNav = () => {
    const limit = hero ? 32 : 10;
    nav?.classList.toggle("solid", scrollY > limit || !hero);
  };
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      setNav();
      if (bg && !reduce && scrollY < innerHeight * 1.2) bg.style.transform = `translateY(${scrollY * 0.18}px)`;
      ticking = false;
    });
  }, { passive: true });
  setNav();

  // Close open menus on outside click.
  document.addEventListener("click", (e) => document.querySelectorAll(".c-drop[open],.c-burger[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; }));

  // Email capture: open the booking page with the email filled in.
  document.getElementById("startForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = (document.getElementById("startEmail").value || "").trim();
    const url = new URL("https://calendly.com/mohamad-impacktmedia/30min");
    if (email) url.searchParams.set("email", email);
    window.open(url.href, "_blank", "noopener");
  });

  // Statement: words light up as you read down the page.
  const st = document.getElementById("statement");
  if (st) {
    st.innerHTML = st.textContent.trim().split(/\s+/).map((w) => `<span>${w}</span>`).join(" ");
    const words = [...st.children];
    const light = () => {
      const r = st.getBoundingClientRect(), vh = innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const n = reduce ? words.length : Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("lit", i < n));
    };
    addEventListener("scroll", () => requestAnimationFrame(light), { passive: true }); light();
  }

  // Count-up for numbers.
  const countUp = (el) => {
    const end = +el.dataset.count, suf = el.dataset.suffix || "", t0 = performance.now(), dur = 1400;
    const fmt = (v) => Math.round(v).toLocaleString("en-US") + suf;
    if (reduce) { el.textContent = fmt(end); return; }
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(end * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };

  // Receipt steps light up in order.
  const steps = document.getElementById("steps");
  const runSteps = () => { [...steps.children].forEach((s, i) => setTimeout(() => { s.classList.add("on"); steps.style.setProperty("--p", `${Math.round(100 * i / 3)}%`); }, reduce ? 0 : 450 * i)); };

  // AI answer types in.
  const ans = document.getElementById("aiAnswer");
  const runAnswer = () => setTimeout(() => {
    if(ans.dataset.interactiveExample)return;
    ans.innerHTML = 'Here are some well-reviewed options:<ol><li><span class="you">Your business</span>, same-day emergency visits, open Saturdays</li><li>Competitor A</li><li>Competitor B</li></ol>';
  }, reduce ? 0 : 1400);

  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target; io.unobserve(el);
    if (el.classList.contains("rv")) el.classList.add("in");
    if (el.dataset.count) countUp(el);
    if (el === steps) runSteps();
    if (el === ans) runAnswer();
    el.querySelectorAll?.("[data-count]").forEach(countUp);
  }), { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".rv").forEach((el) => io.observe(el));
  document.querySelectorAll(".c-stat [data-count]").forEach((el) => io.observe(el));
  if (steps) io.observe(steps);
  if (ans) io.observe(ans);
})();

// Depth and sequence cues stay local to the illustrative hero and flow diagram.
(() => {
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),stage=document.querySelector('.o-stage'),flow=document.querySelector('.o-flow');
 let queued=false,visible=false,timer=null,index=0;
 const steps=flow?[...flow.querySelectorAll('.o-step')]:[];
 const paint=()=>{queued=false;if(reduce.matches||!stage)return;const rect=stage.getBoundingClientRect(),p=Math.max(-1,Math.min(1,(innerHeight*.55-rect.top)/innerHeight));stage.style.setProperty('--stage-y',`${p*-5}px`);stage.closest('.o-hero')?.style.setProperty('--canopy-y',`${p*10}px`);};
 const scroll=()=>{if(!queued&&!document.hidden){queued=true;requestAnimationFrame(paint);}};
 const stop=()=>{clearInterval(timer);timer=null;};
 const run=()=>{stop();if(!visible||reduce.matches||document.hidden)return;timer=setInterval(()=>{steps.forEach((s,i)=>s.toggleAttribute('data-active',i===index));index=(index+1)%steps.length;},1900);};
 if(stage){addEventListener('scroll',scroll,{passive:true});addEventListener('resize',scroll,{passive:true});paint();}
 if(flow&&steps.length){const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;run();},{threshold:.3});observer.observe(flow);}
 document.addEventListener('visibilitychange',run);reduce.addEventListener('change',()=>{if(reduce.matches){stage?.style.removeProperty('--stage-y');stage?.closest('.o-hero')?.style.removeProperty('--canopy-y');steps.forEach(s=>s.removeAttribute('data-active'));}run();});
 addEventListener('pagehide',stop,{once:true});
})();
