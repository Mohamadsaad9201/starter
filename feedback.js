// Samaritan feedback layer: what the user sees while work happens.
// 1. Every action shows a short "applying" state, so an instant result still reads as work done, not a glitch.
// 2. Longer jobs get a progress bar and elapsed time; page loads get a thin top bar.
// 3. Finished work gets a clear check, and progress through the review queue is counted.
// Loaded before supabase-js so the network wrapper sees every request. It touches app state only at runtime.
(() => {
  const MIN = 650, MIN_BIG = 1200, BIG_AFTER = 1100, READ_BAR_AFTER = 300;
  const BIG = /^(approving|publishing|checking|starting|syncing|connecting|restoring|writing|running)/i;
  const VERBS = [
    [/^approve/i, "Approving"], [/^publish|^go live|^push/i, "Publishing"], [/^save|^update|^edit/i, "Saving"],
    [/^connect|^reconnect|^authori/i, "Connecting"], [/^(run|check|find|scan|audit|verify)/i, "Checking"],
    [/^(send|request|ask|reply|submit|share)/i, "Sending"], [/^(delete|remove|revoke|disconnect)/i, "Removing"],
    [/^(start|write|draft|generate|create|prepare)/i, "Starting"], [/^sync|^pull|^import/i, "Syncing"],
    [/^refresh|^reload/i, "Refreshing"], [/^(restore|undo|roll|revert)/i, "Restoring"], [/^(invite|add)/i, "Adding"],
    [/^(mark|skip|dismiss|snooze|move|assign|schedule|reject|decline|pause|resume)/i, "Updating"],
  ];
  const $ = (h) => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstChild; };
  const now = () => performance.now();
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- what the user just clicked ----------
  let click = null, lastNav = -1e9;
  addEventListener("hashchange", () => { lastNav = now(); });
  addEventListener("click", (e) => {
    lastNav = now();
    const el = e.target.closest?.("button, [role=button], a.btn, input[type=submit]");
    if (!el || el.closest("#sc-root, .menu-pop, [data-fb-skip]") || el.disabled) { click = null; return; }
    const label = (el.getAttribute("aria-label") || el.textContent || el.value || "").replace(/\s+/g, " ").trim();
    const v = VERBS.find(([re]) => re.test(label));
    click = { t: now(), el, verb: v ? v[1] : "Applying", label };
  }, true);
  addEventListener("submit", (e) => { if (!e.target.closest("#sc-root")) click = { t: now(), el: e.submitter, verb: "Saving", label: "" }; }, true);

  // ---------- network: reads drive the top bar, writes after a click become an action ----------
  let reads = 0, readTimer = 0, action = null;
  const bar = () => document.getElementById("fb-bar") || document.body.appendChild($('<div id="fb-bar" aria-hidden="true"><i></i></div>'));
  function readStart() { if (reads++ === 0 && now() - lastNav < 2500) { /* background refreshes stay silent */ clearTimeout(readTimer); readTimer = setTimeout(() => { const b = bar(); b.className = "on"; }, READ_BAR_AFTER); } }
  function readEnd() { if (--reads > 0) return; reads = 0; clearTimeout(readTimer); const b = document.getElementById("fb-bar"); if (b?.classList.contains("on")) { b.className = "on done"; setTimeout(() => { if (!reads) b.className = ""; }, 380); } }

  function track(promise, write) {
    if (write && click && now() - click.t < 1500) return actionTrack(promise);
    readStart();
    const end = () => readEnd();
    promise.then(end, end);
    return promise;
  }
  const ignored = (url) => /\/auth\/v1\/|\/realtime\/|\/functions\/v1\/(ask|team-chat)\b|fonts\.g|\.css|\.js(\?|$)|playbooks\.json/.test(url);
  const realFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = String(input?.url || input), method = String(init?.method || input?.method || "GET").toUpperCase();
    const p = realFetch.apply(this, arguments);
    if (ignored(url)) return p;
    return track(p, method !== "GET" || /\/rpc\/|\/functions\/v1\//.test(url));
  };
  // The test harness has no real network; its fake client reports through this hook instead.
  window.fbNet = { track };

  // ---------- the action pill ----------
  const pill = () => document.getElementById("fb-pill") || document.getElementById("feedback-stack").appendChild($('<div id="fb-pill" role="status" aria-live="polite"></div>'));
  function actionTrack(promise) {
    if (!action) {
      action = { verb: click.verb, label: click.label, el: click.el, t0: now(), pending: 0, toasts: [], big: BIG.test(click.verb), timer: 0 };
      action.el?.setAttribute("aria-busy", "true"); action.el?.classList.add("fb-busy");
      showWorking(action);
      action.timer = setInterval(() => tick(action), 250);
    }
    const a = action; a.pending++;
    const end = () => { if (--a.pending === 0) setTimeout(() => { if (a.pending === 0) finish(a); }, 30); };
    promise.then(end, end);
    return promise;
  }
  function showWorking(a) {
    const p = pill();
    p.className = "on";
    p.innerHTML = `<span class="fb-spin" aria-hidden="true"></span><span class="fb-txt"><b>${a.verb}…</b><small></small></span><span class="fb-track" aria-hidden="true"><i></i></span>`;
  }
  function tick(a) {
    if (action !== a) return;
    const ms = now() - a.t0, p = pill();
    if (ms > BIG_AFTER) {
      p.classList.add("long");
      const pct = Math.min(92, 100 * (1 - Math.exp(-ms / 9000))); // honest: it eases toward done, it never claims done
      p.querySelector(".fb-track i").style.width = pct + "%";
      const sec = Math.round(ms / 1000);
      p.querySelector("small").textContent = sec >= 9 ? `${sec}s · larger jobs can take up to a minute. You can keep working.` : `${sec}s`;
    }
  }
  function finish(a) {
    const min = a.big ? MIN_BIG : MIN, wait = Math.max(0, min - (now() - a.t0));
    setTimeout(() => {
      if (action !== a || a.pending > 0) return; // a follow-up request joined; it finishes the action when it ends
      clearInterval(a.timer);
      a.el?.removeAttribute("aria-busy"); a.el?.classList.remove("fb-busy");
      if (action === a) action = null;
      const p = pill(); p.classList.remove("long");
      const fill = p.querySelector(".fb-track i"); if (fill) fill.style.width = "100%";
      if (a.toasts.length) { p.className = ""; a.toasts.forEach((m) => showToast(m)); }
      else if (document.querySelector(".toast")) { p.className = ""; }
      else { p.innerHTML = `<span class="fb-ok" aria-hidden="true">${CHECK}</span><span class="fb-txt"><b>Done</b></span>`; p.className = "on ok"; setTimeout(() => { if (!action) p.className = ""; }, 1100); }
    }, wait);
  }

  // ---------- toasts: hold them until the action has visibly finished, then mark the outcome ----------
  const CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const FAIL = /could ?n[o']t|didn'?t|failed|error|not confirmed|not set up|isn'?t|can'?t|unable|first\.|declined|out of credits/i;
  const WIN = /approved|published|saved|recorded|queued|connected|added|updated|restored|sent|marked done|ready|live|verified|copied|started|scheduled|writing it|synced|applied|undone|invited/i;
  const showToast = (msg) => window.SamaritanApp?.toast(msg);
  window.fbHoldToast = (msg) => { if (!action) return false; action.toasts.push(msg); return true; };
  window.fbToastShown = (msg) => {
    document.querySelector("#fb-pill.ok")?.classList.remove("on", "ok");
    decorate(msg);
  };
  function decorate(msg) {
    const el = document.querySelector(".toast"); if (!el) return;
    const bad = FAIL.test(msg), good = !bad && WIN.test(msg);
    el.classList.toggle("fb-bad", bad); el.classList.toggle("fb-good", good);
    if (!good) return;
    el.insertAdjacentHTML("afterbegin", `<span class="fb-ok" aria-hidden="true">${CHECK}</span>`);
    countWin();
    setTimeout(() => momentum(el), 700); // after the page has re-read the queue
  }
  const day = () => new Date().toISOString().slice(0, 10);
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem("pulse:fb:" + k)) ?? d; } catch { return d; } };
  const put = (k, v) => { try { localStorage.setItem("pulse:fb:" + k, JSON.stringify(v)); } catch { /* private mode */ } };
  function countWin() { const k = "wins:" + day(); put(k, get(k, 0) + 1); }
  // The review queue for the open business, as the page itself counts it.
  const remaining = () => window.SamaritanApp?.queueLeft() ?? null;
  function baseline() {
    const r = remaining(); if (r == null) return null;
    const k = `base:${window.SamaritanApp.siteId()}:${day()}`, b = Math.max(get(k, 0), r); put(k, b); return { left: r, base: b };
  }
  function momentum(el) {
    if (!el.isConnected || el.querySelector(".fb-mom")) return;
    const q = baseline(), wins = get("wins:" + day(), 0);
    let html = "";
    if (q && q.base > 0 && q.left < q.base) {
      const done = q.base - q.left;
      if (q.left === 0) { html = `<span class="fb-mom fb-clear"><b>All caught up.</b> Every decision for today is made.</span>`; el.classList.add("fb-celebrate"); burst(el); }
      else html = `<span class="fb-mom"><span class="fb-meter"><i style="width:${Math.round(100 * done / q.base)}%"></i></span>${done} of ${q.base} reviewed today</span>`;
    } else if (wins > 1) html = `<span class="fb-mom">${wins} things done today</span>`;
    if (html) el.insertAdjacentHTML("beforeend", html);
  }
  function burst(el) {
    if (reduce()) return;
    const box = $('<span class="fb-burst" aria-hidden="true"></span>');
    for (let i = 0; i < 14; i++) { const s = document.createElement("i"); const a = (i / 14) * Math.PI * 2; s.style.setProperty("--x", Math.cos(a) * (40 + (i % 3) * 14) + "px"); s.style.setProperty("--y", Math.sin(a) * (26 + (i % 4) * 8) + "px"); s.style.animationDelay = (i % 4) * 25 + "ms"; box.appendChild(s); }
    el.appendChild(box); setTimeout(() => box.remove(), 1200);
  }
  // Keep the baseline current as the user moves around, so progress counts from the first look of the day.
  // Count from the queue as first seen today; renders during an action already include its result, so they're skipped.
  window.fbSeen = () => queueMicrotask(() => { if (!action) baseline(); });

  // ---------- page loads with real progress ----------
  // loadSite reports each data source as it arrives; the skeleton shows "n of total".
  window.fbLoad = (total) => {
    let done = 0;
    const paint = () => {
      const el = document.querySelector(".sk [data-sk-prog]"); if (!el) return;
      el.querySelector("i").style.width = Math.max(6, Math.round(100 * done / total)) + "%";
      const t = el.parentElement.querySelector(".sk-step"); if (t) t.textContent = done >= total ? "Almost there…" : `Gathering your data · ${done} of ${total} sources`;
    };
    queueMicrotask(paint);
    // Resolve once and hand back the promise: query builders run again on every .then().
    return (p) => { const q = Promise.resolve(p), step = () => { done++; paint(); }; q.then(step, step); return q; };
  };

})();
