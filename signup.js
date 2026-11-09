/* Impackt Media: public sign-up (/signup/). A visitor enters their website; Samaritan reads it, researches the
 * business and its competitors (the `signup` edge function), the visitor confirms, then signs up by email.
 * The magic link opens /app/, where app.js claims the analysis and continues with Google and the last questions.
 * Analysis state lives in sessionStorage (this tab); the claim hand-off lives in localStorage (survives the email link). */
(() => {
  const CFG = window.SEO_ENGINE;
  const FN = CFG.supabaseUrl + "/functions/v1/signup";
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true } });
  const root = document.getElementById("signup-root");
  const STATE_KEY = "impackt:signup-draft", CLAIM_KEY = "impackt:signup";
  const PLATFORM_NAMES = { shopify: "Shopify", wordpress: "WordPress", woocommerce: "WooCommerce", webflow: "Webflow", framer: "Framer", wix: "Wix", squarespace: "Squarespace", bigcommerce: "BigCommerce", godaddy: "GoDaddy", netlify: "Netlify", other: "Other / custom" };
  const PROGRESS = ["Searching for what your customers type into Google…", "Looking at who shows up for those searches…", "Checking each competitor's website…", "Comparing what they offer with what you offer…"];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bare = (d) => String(d || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let st = load(), busy = "", note = "", pollTimer = 0, tick = 0;
  function load() { try { const s = JSON.parse(sessionStorage.getItem(STATE_KEY) || "null"); if (s?.v === 1) return s; } catch { /* private mode */ } return { v: 1, step: "domain", domain: "", token: "", site: null, research: null, edits: {}, competitors: null, email: "" }; }
  function save() { try { sessionStorage.setItem(STATE_KEY, JSON.stringify(st)); } catch { /* private mode */ } }

  async function call(action, body = {}, auth) {
    const headers = { "Content-Type": "application/json", apikey: CFG.supabaseAnonKey };
    if (auth) headers.Authorization = "Bearer " + auth;
    const r = await fetch(FN, { method: "POST", headers, body: JSON.stringify({ action, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again.");
    return j;
  }

  // ---------- rendering ----------
  const avatar = `<span class="samaritan-mark" aria-hidden="true"><img src="/assets/samaritan/scanner.webp" width="28" height="28" alt=""></span>`;
  const bot = (html) => `<div class="ob-msg bot">${avatar}<div class="ob-bubble">${html}</div></div>`;
  const you = (t) => t ? `<div class="ob-msg you"><div class="ob-bubble">${esc(t)}</div></div>` : "";
  const card = (html) => `<div class="ob-card">${html}</div>`;
  const status = () => `<p class="ob-note" role="status">${note}</p>`;
  const ORDER = ["domain", "reading", "profile", "competitors", "account", "sent"];
  const at = (s) => ORDER.indexOf(st.step) >= ORDER.indexOf(s);

  function draw() {
    const i = ORDER.indexOf(st.step), shown = 5;
    root.innerHTML = `<div class="ob su">
      <header class="ob-top"><a class="wordmark" href="/" aria-label="Impackt Media home"><img src="/assets/wordmark.svg" alt="Impackt Media" width="887" height="232"></a>
        <div class="ob-progress" role="progressbar" aria-label="Sign-up progress" aria-valuemin="1" aria-valuemax="${shown}" aria-valuenow="${Math.min(i + 1, shown)}">${Array.from({ length: shown }, (_, n) => `<span class="${n < i ? "done" : n === i ? "now" : ""}"></span>`).join("")}</div>
        <a class="ob-exit" href="/app/">Sign in</a></header>
      <main class="ob-thread" aria-live="polite">${thread()}</main>
      <footer class="ob-foot">Free to start · No card needed · <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a></footer></div>`;
    const active = root.querySelector(".ob-step.active");
    active?.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" });
    active?.querySelector("input:not([type=radio]):not([type=checkbox]),textarea")?.focus({ preventScroll: true });
  }
  const step = (name, html) => `<section class="ob-step ${st.step === name ? "active" : "past"}">${html}</section>`;

  function thread() {
    let out = step("domain", bot(`<b>Let's set up your marketing workspace.</b> What's your website? I'll read it and find your competitors, so you don't have to fill in a long form.`)
      + (st.step === "domain" ? card(domainForm()) : you(st.domain)));
    if (!at("reading")) return out;
    out += step("reading", readingView());
    if (!at("profile")) return out;
    out += step("profile", bot(`Here's what I learned about <b>${esc(name())}</b>. Correct anything that's off. Every recommendation builds on this.`) + (st.step === "profile" ? card(profileForm()) : you(st.edits.changed ? "Updated the details" : "Looks right")));
    if (!at("competitors")) return out;
    out += step("competitors", competitorsIntro() + (st.step === "competitors" ? card(competitorsForm()) : you(st.competitors.length ? st.competitors.join(", ") : "No competitors for now")));
    if (!at("account")) return out;
    out += step("account", bot(`Your workspace is ready to create. Where should I send your sign-in link? You'll connect Google next, so I can show you the searches you could win.`) + (st.step === "account" ? card(accountForm()) : you(st.email)));
    if (st.step === "sent") out += step("sent", bot(`<b>Check your inbox at ${esc(st.email)}.</b> Open the link on this device to finish. It takes you straight into your workspace.<br><span class="ob-muted">No email after a minute? Check spam, or <button type="button" class="ob-link inline" data-su="resend">send it again</button>.</span>`));
    return out;
  }
  const name = () => st.edits.name || st.research?.name || st.site?.name || st.domain;

  function domainForm() {
    return `<form class="ob-form" data-su-form="domain"><label class="ob-label" for="su-domain">Website</label>
      <div class="ob-inline"><input id="su-domain" name="domain" inputmode="url" autocomplete="url" placeholder="yourbusiness.com" value="${esc(st.domainDraft || st.domain)}" required><button class="btn primary" ${busy ? "disabled" : ""}>${busy ? "Starting…" : "Analyze my site"}</button></div>
      ${status()}<p class="ob-muted">Free. Takes about a minute. Already have a workspace? <a href="/app/">Sign in</a>.</p></form>`;
  }

  function readingView() {
    const s = st.site, r = st.research;
    if (!s) return bot(`Reading <b>${esc(st.domain)}</b>…`) + card(scan("Reading your website", "Homepage, about and contact pages."));
    const pages = (s.sources || []).length, platform = s.platform && s.platform !== "other" ? PLATFORM_NAMES[s.platform] : "";
    let html = bot(s.readable ? `I read ${pages > 1 ? pages + " pages" : "your homepage"}${s.title ? `: <b>${esc(s.title)}</b>` : ""}.${platform ? ` Your site runs on <b>${esc(platform)}</b>.` : ""}` : `Your website blocked my direct read, so I'm working from public search results instead.`);
    if (st.step === "reading" && !r && st.status !== "failed") html += card(scan("Researching your market", PROGRESS[tick % PROGRESS.length]));
    if (st.status === "failed" && st.step === "reading") html += bot(`I couldn't finish the competitor research automatically. You can still continue and add them yourself.`) + card(`<div class="ob-actions"><button class="btn primary" data-su="continue">Continue</button><button class="btn ghost" data-su="retry">Try again</button></div>`);
    if (r && at("profile") === false && st.step === "reading") html += card(`<div class="ob-actions"><button class="btn primary" data-su="continue">See what I found</button></div>`);
    return html;
  }
  const scan = (title, sub) => `<div class="ob-scan" data-su-progress><span class="samaritan-mark" aria-hidden="true"><img src="/assets/samaritan/scanner.webp" width="44" height="44" alt=""></span><div><b>${esc(title)}</b><p class="ob-muted">${esc(sub)}</p></div><span class="su-spin" aria-hidden="true"></span></div>`;

  const FIELDS = [["name", "Business name"], ["description", "What you offer, and to whom", true], ["customers", "Your customers"], ["service", "Where you serve customers"], ["locations", "Locations (optional)", true]];
  function profileValue(k) {
    if (k in (st.edits.values || {})) return st.edits.values[k];
    const r = st.research || {}, s = st.site || {};
    return { name: r.name || s.name || "", description: r.description || s.description || "", customers: r.customers || "", service: r.service_area || "", locations: r.locations || "" }[k] || "";
  }
  function profileForm() {
    const platform = st.edits.platform || st.site?.platform || "other";
    return `<form class="ob-form" data-su-form="profile">${FIELDS.map(([k, label, long]) => `<label class="ob-label" for="su-${k}">${esc(label)}</label>${long ? `<textarea id="su-${k}" name="${k}" rows="${k === "description" ? 3 : 2}" maxlength="2000">${esc(profileValue(k))}</textarea>` : `<input id="su-${k}" name="${k}" maxlength="200" value="${esc(profileValue(k))}"${k === "name" ? " required" : ""}>`}`).join("")}
      <label class="ob-label" for="su-platform">Website platform</label><select id="su-platform" name="platform">${Object.entries(PLATFORM_NAMES).map(([k, v]) => `<option value="${k}" ${k === platform ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
      ${status()}<div class="ob-actions"><button class="btn primary">Looks right</button></div></form>`;
  }

  function competitorsIntro() {
    const found = (st.research?.competitors || []).length, kw = st.research?.keyword;
    if (found) return bot(`I found <b>${found} ${found === 1 ? "business" : "businesses"}</b> competing with you${kw ? ` for <b>“${esc(kw)}”</b>` : ""}. Remove any that aren't real competitors, or add one I missed. I'll track how you compare.`);
    return bot(`I couldn't confirm your competitors from public search results. Add up to five websites your customers compare you with, or skip this for now.`);
  }
  function competitorsForm() {
    const why = Object.fromEntries((st.research?.competitors || []).map((c) => [c.domain, c]));
    const left = 5 - st.competitors.length;
    return `<form class="ob-form" data-su-form="competitors">${st.competitors.length ? `<ol class="ob-rivals">${st.competitors.map((d, i) => `<li><span class="ob-rank">${i + 1}</span><div class="su-rival"><b>${esc(why[d]?.name || d)}</b><span class="ob-muted">${esc(d)}${why[d]?.reason ? " · " + esc(why[d].reason) : ""}</span></div><button type="button" class="ob-x" data-su="remove" data-i="${i}" aria-label="Remove ${esc(d)}">×</button></li>`).join("")}</ol>` : ""}
      ${left > 0 ? `<label class="ob-label" for="su-rival">Add a competitor's website</label><div class="ob-inline"><input id="su-rival" name="rival" inputmode="url" placeholder="competitor.com"><button type="submit" class="btn">Add</button></div>` : ""}
      ${status()}<div class="ob-actions"><button type="button" class="btn primary" data-su="competitors-done">${st.competitors.length ? "Continue" : "Skip for now"}</button></div></form>`;
  }

  function accountForm() {
    return `<form class="ob-form" data-su-form="account"><label class="ob-label" for="su-email">Work email</label>
      <div class="ob-inline"><input id="su-email" name="email" type="email" autocomplete="email" required value="${esc(st.email)}" placeholder="you@yourbusiness.com"><button class="btn primary" ${busy ? "disabled" : ""}>${busy ? "Sending…" : "Create my workspace"}</button></div>
      ${status()}<p class="ob-muted">We'll email you a sign-in link. No password needed.</p></form>`;
  }

  // ---------- actions ----------
  async function analyze(value) {
    const host = bare(value);
    if (!/^([a-z0-9-]+\.)+[a-z]{2,63}$/.test(host)) { note = "Enter your website address, like <b>yourbusiness.com</b>."; return draw(); }
    busy = "start"; note = ""; draw();
    try {
      const r = await call("analyze", { domain: host });
      busy = "";
      if (r.exists) { note = `${esc(r.message)} <a href="/app/">Sign in</a>.`; return draw(); }
      Object.assign(st, { domain: host, token: r.token, site: r.site, research: r.research || null, status: r.status, step: "reading", edits: {}, competitors: null });
      save(); draw(); poll();
    } catch (e) { busy = ""; note = esc(e.message); draw(); }
  }
  function poll() {
    clearTimeout(pollTimer);
    if (st.step !== "reading" || st.research || st.status === "failed") return;
    pollTimer = setTimeout(async () => {
      tick++;
      try {
        const r = await call("status", { token: st.token });
        st.site = r.site || st.site; st.status = r.status;
        if (r.status === "ready") { st.research = r.research; save(); return goProfile(); }
        if (r.status === "failed") { save(); return draw(); }
      } catch (e) { if (/expired|Unknown/.test(e.message)) { sessionStorage.removeItem(STATE_KEY); st = load(); note = esc(e.message); return draw(); } }
      poll(); // still researching: keep the page still, only the progress line changes
    }, 3000);
  }
  function goProfile() { st.step = "profile"; note = ""; save(); draw(); }
  function saveProfile(form) {
    const values = Object.fromEntries(FIELDS.map(([k]) => [k, form.elements[k].value.trim()]));
    if (!values.name) { note = "Add your business name."; return draw(); }
    const orig = Object.fromEntries(FIELDS.map(([k]) => [k, profileValue(k)]));
    st.edits = { ...st.edits, values, platform: form.elements.platform.value, changed: FIELDS.some(([k]) => (st.edits.values?.[k] ?? orig[k]) !== values[k]) || form.elements.platform.value !== (st.site?.platform || "other") };
    if (!st.competitors) st.competitors = (st.research?.competitors || []).map((c) => c.domain).slice(0, 5);
    st.step = "competitors"; note = ""; save(); draw();
  }
  function addRival(value) {
    const host = bare(value);
    if (!/^([a-z0-9-]+\.)+[a-z]{2,63}$/.test(host)) { note = "Enter a website address, like <b>competitor.com</b>."; return draw(); }
    if (host === st.domain) { note = "That's your own website."; return draw(); }
    if (st.competitors.includes(host)) { note = "Already on the list."; return draw(); }
    st.competitors = [...st.competitors, host].slice(0, 5); note = ""; save(); draw();
  }
  function edits() {
    const v = st.edits.values || {};
    return { name: v.name, description: v.description, customers: v.customers, service: v.service, locations: v.locations, platform: st.edits.platform, competitors: st.competitors || [] };
  }
  async function account(email) {
    st.email = email.trim(); busy = "send"; note = ""; draw();
    const handoff = { token: st.token, edits: edits(), domain: st.domain, at: Date.now() };
    try { localStorage.setItem(CLAIM_KEY, JSON.stringify(handoff)); } catch { /* private mode: claim below still works in this tab */ }
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user?.email && session.user.email.toLowerCase() === st.email.toLowerCase()) {
        const r = await call("claim", { token: st.token, edits: handoff.edits }, session.access_token);
        try { localStorage.removeItem(CLAIM_KEY); sessionStorage.removeItem(STATE_KEY); } catch { /* */ }
        location.href = "/app/#/onboarding/" + encodeURIComponent(r.site_id);
        return;
      }
      const { error } = await sb.auth.signInWithOtp({ email: st.email, options: { emailRedirectTo: location.origin + "/app/", shouldCreateUser: true } });
      if (error) throw error;
      busy = ""; st.step = "sent"; save(); draw();
    } catch (e) { busy = ""; note = esc(e.message || "We couldn't send the email. Try again."); draw(); }
  }

  root.addEventListener("submit", (e) => {
    const f = e.target.closest("[data-su-form]"); if (!f) return;
    e.preventDefault(); if (busy) return;
    const k = f.dataset.suForm;
    if (k === "domain") return analyze(f.elements.domain.value);
    if (k === "profile") return saveProfile(f);
    if (k === "competitors") { const v = f.elements.rival?.value || ""; if (v.trim()) addRival(v); return; }
    if (k === "account") return account(f.elements.email.value);
  });
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-su]"); if (!b) return;
    const a = b.dataset.su;
    if (a === "continue") return goProfile();
    if (a === "retry") { st.status = "researching"; st.research = null; return analyze(st.domain); }
    if (a === "remove") { st.competitors = st.competitors.filter((_, i) => i !== +b.dataset.i); save(); return draw(); }
    if (a === "competitors-done") { const v = root.querySelector("#su-rival")?.value?.trim(); if (v) { addRival(v); if (note) return; } st.step = "account"; note = ""; save(); return draw(); }
    if (a === "resend") { st.step = "account"; save(); return account(st.email); }
  });
  root.addEventListener("input", (e) => { if (e.target.id === "su-domain") st.domainDraft = e.target.value; });

  // Prefill from a link like /signup/?site=example.com (e.g. from the homepage form).
  const q = new URLSearchParams(location.search).get("site");
  if (q && st.step === "domain") st.domainDraft = q;
  draw();
  if (st.step === "reading") poll();
  // Rotate the progress line without re-rendering (no scroll jumps while the research runs).
  setInterval(() => {
    const line = root.querySelector("[data-su-progress] .ob-muted");
    if (line && st.step === "reading" && st.site && !st.research) { tick++; line.textContent = PROGRESS[tick % PROGRESS.length]; }
  }, 4000);
})();
