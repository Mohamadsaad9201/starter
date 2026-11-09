/* Impackt Media: guided client onboarding (#/onboarding).
 * A single conversation with Samaritan: website → welcome → site read → positioning → competitors
 * → Search Console → first opportunity → attribution → SEO level → done.
 * app.js owns data access and passes it in through mount(root, ctx); this file only renders the journey.
 * Progress is kept per user in sessionStorage so a reload or the Google sign-in redirect resumes in place. */
(() => {
  const STEPS = ["domain", "welcome", "site", "positioning", "competition", "gsc", "opportunity", "attribution", "level", "done"];
  const SHOWN = STEPS.filter((s) => s !== "welcome"); // steps counted in the progress bar
  const PLATFORM_ORDER = ["shopify", "wordpress", "woocommerce", "webflow", "wix", "squarespace", "bigcommerce", "framer", "godaddy", "netlify", "other"];
  const TLD_TYPOS = { con: "com", cmo: "com", ocm: "com", vom: "com", xom: "com", comm: "com", cpm: "com", nett: "net", ogr: "org", orgg: "org" };
  const ATTRIBUTION = ["Referral", "Google search", "AI assistant", "Social media", "Event", "Other"];
  const LEVELS = [
    ["new", "New to SEO", "Plain language, no jargon. Explain why each change matters.", "in plain language, without jargon"],
    ["basics", "Knows the basics", "Short explanations; focus on decisions and results.", "briefly, focused on decisions and results"],
    ["expert", "Hands-on with SEO", "Technical detail welcome: queries, positions, markup.", "with full technical detail"],
  ];

  let ctx = null, root = null, st = null, busy = "", note = "";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => Math.round(n || 0).toLocaleString();
  const bare = (d) => String(d || "").replace(/^www\./, "");
  const key = () => "impackt:onboarding:" + (ctx.userId() || "anon");

  // ---------- state ----------
  function load(siteFromHash) {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(key()) || "null"); } catch { /* private mode */ }
    if (saved?.v === 1 && (!siteFromHash || saved.sid === siteFromHash)) return saved;
    if (siteFromHash) { // resuming a business created earlier (e.g. after the Google redirect in another tab)
      const s = ctx.sites().find((x) => x.id === siteFromHash);
      if (s) return { v: 1, step: "gsc", resumed: true, domain: s.domain, sid: s.id, name: s.name, platform: s.platform, competitors: s.profile?.competitors || [], answers: {} };
    }
    return { v: 1, step: "domain", domain: "", sid: null, name: "", platform: "other", intake: null, competitors: [], answers: {} };
  }
  function save() { try { sessionStorage.setItem(key(), JSON.stringify(st)); } catch { /* private mode */ } }
  function clear() { try { sessionStorage.removeItem(key()); } catch { /* private mode */ } }
  function goStep(step) {
    st.step = step; busy = ""; note = ""; save(); draw();
    if (step === "welcome") setTimeout(() => st.step === "welcome" && goStep("site"), 650);
    if (step === "site" && !st.intake && !st.sid) readSite();
    if (step === "gsc") loadGsc();
    if (step === "opportunity" && st.answers.gsc && st.answers.gsc !== "Later") findOpportunity();
  }

  // ---------- rendering ----------
  // Only the newest message animates (one scanner key each); earlier avatars are the still frame.
  const still = `<span class="samaritan-mark" aria-hidden="true"><img src="/assets/samaritan/scanner.webp" width="28" height="28" alt=""></span>`;
  let botN = 0, liveBot = -1;
  const bot = (html) => { const n = botN++; return `<div class="ob-msg bot">${n === liveBot ? ctx.scanner("onboarding-live") : still}<div class="ob-bubble">${html}</div></div>`; };
  const you = (text) => text ? `<div class="ob-msg you"><div class="ob-bubble">${esc(text)}</div></div>` : "";
  const card = (html, cls = "") => `<div class="ob-card ${cls}">${html}</div>`;
  const status = () => note ? `<p class="ob-note" role="status">${note}</p>` : `<p class="ob-note" role="status"></p>`;

  function progress() {
    const i = Math.max(0, SHOWN.indexOf(st.step === "welcome" ? "site" : st.step));
    return `<div class="ob-progress" role="progressbar" aria-label="Onboarding progress" aria-valuemin="1" aria-valuemax="${SHOWN.length}" aria-valuenow="${i + 1}">${SHOWN.map((s, n) => `<span class="${n < i ? "done" : n === i ? "now" : ""}"></span>`).join("")}</div>`;
  }

  function draw() {
    if (!root || !root.isConnected) return;
    // A resumed journey (after sign-up) starts at Search Console: earlier steps were done on the sign-up page.
    const steps = STEPS.slice(0, STEPS.indexOf(st.step) + 1).filter((x) => !st.resumed || STEPS.indexOf(x) >= STEPS.indexOf("gsc"));
    const intro = () => st.resumed ? bot(`<b>Welcome to Impackt Media${st.name ? ", " + esc(st.name) : ""}.</b> Your workspace for <b>${esc(bare(st.domain))}</b> is ready, and I've started checking every page of your site. A few quick steps left.`) : "";
    botN = 0; liveBot = -1; intro(); steps.forEach(view); liveBot = botN - 1; // count first, then animate the last one
    botN = 0;
    const thread = intro() + steps.map(view).join("");
    root.innerHTML = `<div class="ob">
      <header class="ob-top">${ctx.wordmark()}${progress()}<a class="ob-exit" href="${esc(ctx.exitHref ? ctx.exitHref(st.sid) : "#/agency")}">${st.sid ? "Save & exit" : "Exit"}</a></header>
      <main class="ob-thread" aria-live="polite">${thread}</main>
      ${ctx.owner ? "" : `<footer class="ob-foot">Need the full form instead? <a href="#/add-site">Add a client manually</a></footer>`}
    </div>`;
    const active = root.querySelector(".ob-step.active");
    active?.scrollIntoView({ block: "end", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    active?.querySelector("input:not([type=hidden]):not([type=checkbox]),textarea")?.focus({ preventScroll: true });
  }

  function view(step) {
    const now = st.step === step, a = st.answers || {};
    const wrap = (inner) => `<section class="ob-step ${now ? "active" : "past"}" data-step="${step}">${inner}</section>`;
    switch (step) {
      case "domain":
        return wrap(bot(`<b>Let's set up a new client.</b> Which website should Samaritan work on?`) + (now ? card(domainForm()) : you(bare(st.domain))));
      case "welcome":
        return wrap(bot(`Nice. I'll read <b>${esc(bare(st.domain))}</b>, learn what the business offers and who it competes with, then connect Search Console so we start from real data. It takes about three minutes.`));
      case "site":
        return wrap(siteView(now));
      case "positioning":
        return wrap(bot(`Here's how I understand <b>${esc(st.name)}</b>. Correct anything that's off. Every agent uses this.`) + (now ? card(positioningForm()) : you(a.positioning || "Looks right")));
      case "competition":
        return wrap(bot(`Who do customers compare ${esc(st.name)} with? Add up to three competitor websites. I'll track how you stack up against them.`) + (now ? card(competitionForm()) : you(st.competitors.length ? st.competitors.join(", ") : "Skipped for now")));
      case "gsc":
        return wrap(bot(`Now the important part: <b>Google Search Console</b>. It shows the searches that already bring people to the site, so we start from evidence instead of guesses.`) + (now ? card(gscView()) : you(a.gsc || "Later")));
      case "opportunity":
        return wrap(opportunityView(now));
      case "attribution":
        return wrap(bot(ctx.owner ? `Quick one for us: how did you find Impackt Media?` : `Quick one for us: how did ${esc(st.name)} find Impackt Media?`) + (now ? card(attributionForm()) : you(a.attribution || "Skipped")));
      case "level":
        return wrap(bot(ctx.owner ? `Last question. How comfortable are you with SEO? I'll adjust how I explain my work.` : `Last question. How comfortable is the client with SEO? Samaritan adjusts how it explains its work.`) + (now ? card(levelForm()) : you(LEVELS.find((l) => l[0] === a.level)?.[1] || "")));
      case "done":
        return wrap(doneView());
    }
    return "";
  }

  // ---------- step: domain ----------
  function domainForm() {
    const sug = st.suggestion ? `<button type="button" class="ob-chip" data-ob="use-suggestion">Did you mean <b>${esc(st.suggestion)}</b>?</button>` : "";
    return `<form class="ob-form" data-ob-form="domain"><label class="ob-label" for="ob-domain">Website</label>
      <div class="ob-inline"><input id="ob-domain" name="domain" inputmode="url" autocomplete="url" placeholder="clientwebsite.com" value="${esc(st.domainDraft || "")}" required><button class="btn primary" ${busy ? "disabled" : ""}>Continue</button></div>
      ${sug}${status()}<button type="button" class="ob-link" data-ob="no-site">The business doesn't have a website</button></form>`;
  }
  function typoFix(host) {
    const parts = host.split("."), tld = parts.pop();
    return TLD_TYPOS[tld] ? [...parts, TLD_TYPOS[tld]].join(".") : null;
  }
  function submitDomain(value) {
    st.domainDraft = value; st.suggestion = null;
    let host;
    try { host = ctx.marketDomain(value.trim()); } catch { note = "That doesn't look like a website address. Try something like <b>example.com</b>."; return draw(); }
    const fix = typoFix(host);
    if (fix && !st.typoAccepted) { st.suggestion = fix; note = "Check the ending of the address."; return draw(); }
    const existing = ctx.sites().find((s) => bare(s.domain) === bare(host));
    if (existing) { note = `${esc(existing.name)} already has a workspace. <a href="#/w/${encodeURIComponent(existing.id)}/today">Open it</a> instead.`; return draw(); }
    st.domain = host; st.typoAccepted = false; goStep("welcome");
  }

  // ---------- step: site ----------
  function siteView(now) {
    const intro = bot(`Reading <b>${esc(bare(st.domain))}</b>: the homepage and the pages that describe the business.`);
    if (st.sid) return intro + bot(siteSummary()) + you(`Create the workspace for ${st.name}`);
    if (!now) return intro;
    if (busy === "reading") return intro + card(`<div class="ob-scan">${ctx.scanner("onboarding-scan")}<div><b>Reading the website…</b><p class="ob-muted">Homepage, about and contact pages. This usually takes 10–20 seconds.</p></div></div>`, "scanning");
    const failed = st.intakeError ? `<p class="ob-warn">I couldn't read the website: ${esc(st.intakeError)} You can still continue and fill in the details yourself.</p><button type="button" class="btn ghost sm" data-ob="retry-read">Try reading again</button>` : "";
    return intro + (st.intake ? bot(siteSummary()) : "") + card(`<form class="ob-form" data-ob-form="site">${failed}
      <label class="ob-label" for="ob-name">Business name</label><input id="ob-name" name="name" required autocomplete="organization" value="${esc(st.name)}">
      <span class="ob-label">Website platform</span><div class="ob-chips" role="radiogroup" aria-label="Website platform">${PLATFORM_ORDER.map((k) => `<label class="ob-chip ${st.platform === k ? "on" : ""}"><input type="radio" name="platform" value="${k}" ${st.platform === k ? "checked" : ""}>${esc(ctx.platforms[k]?.name || k)}</label>`).join("")}</div>
      <p class="ob-muted">${esc(ctx.platforms[st.platform]?.line || "")}</p>
      ${status()}<div class="ob-actions"><button class="btn primary" ${busy ? "disabled" : ""}>${busy === "creating" ? "Creating workspace…" : "Create workspace & start the site check"}</button></div></form>`);
  }
  function siteSummary() {
    const src = st.intake?.sources || [];
    const pages = src.map((u) => { try { const x = new URL(u); return x.pathname === "/" ? "Homepage" : x.pathname.replace(/\/$/, ""); } catch { return u; } });
    const facts = [st.intake?.industry, st.intake?.customers].filter(Boolean);
    return `${src.length ? `I read ${src.length === 1 ? "1 page" : src.length + " pages"}: <span class="ob-pages">${pages.map((p) => `<code>${esc(p)}</code>`).join(" ")}</span>` : "I couldn't read the website automatically."}${facts.length ? `<br>It looks like <b>${esc(facts.join(" · "))}</b>.` : ""}${st.sid ? `<br><span class="ob-ok">Workspace created.</span> Samaritan is now checking every page in the background. Fixes appear in Approvals when they're ready.` : ""}`;
  }
  async function readSite() {
    busy = "reading"; st.intakeError = ""; draw();
    try {
      const r = await ctx.intake(st.domain);
      st.intake = r; st.intakeOriginal = { ...r }; st.name = st.name || r.name || "";
    } catch (e) { st.intake = null; st.intakeError = e.message || "The website didn't respond."; }
    busy = ""; save(); if (st.step === "site") draw();
  }
  async function createSite(form) {
    st.name = form.elements.name.value.trim(); st.platform = form.elements.platform.value || "other";
    if (!st.name) return;
    busy = "creating"; note = ""; draw();
    try {
      st.sid = await ctx.createSite({ domain: st.domain, name: st.name, platform: st.platform, market: st.intake || {} });
      save(); goStep("positioning");
    } catch (e) { busy = ""; note = esc(e.message); draw(); }
  }

  // ---------- step: positioning ----------
  const POS_FIELDS = [["description", "What the business offers, and to whom", true], ["industry", "Industry"], ["customers", "Customers"], ["model", "How it operates", false, "Online delivery, storefronts, service calls…"], ["locations", "Physical locations", true, "One per line, with city and state"], ["service", "Areas served"]];
  function positioningForm() {
    const v = st.intake || {};
    return `<form class="ob-form" data-ob-form="positioning">${POS_FIELDS.map(([k, label, long, ph]) => `<label class="ob-label" for="ob-${k}">${esc(label)}</label>${long ? `<textarea id="ob-${k}" name="${k}" rows="${k === "description" ? 3 : 2}" maxlength="2000" placeholder="${esc(ph || "")}">${esc(v[k] || "")}</textarea>` : `<input id="ob-${k}" name="${k}" maxlength="550" placeholder="${esc(ph || "")}" value="${esc(v[k] || "")}">`}`).join("")}
      ${status()}<div class="ob-actions"><button class="btn primary" ${busy ? "disabled" : ""}>${busy ? "Saving…" : "Looks right"}</button><button type="button" class="btn ghost" data-ob="skip-positioning">Skip for now</button></div></form>`;
  }
  async function savePositioning(form) {
    const value = Object.fromEntries(POS_FIELDS.map(([k]) => [k, form.elements[k].value.trim()]));
    busy = "saving"; draw();
    try {
      const { industry, customers, ...market } = value;
      await ctx.saveProfile(st.sid, (p) => ({ ...p, industry, customers, market: { ...(p.market || {}), ...market }, market_revision: crypto.randomUUID() }));
      st.intake = { ...(st.intake || {}), ...value };
      const changed = POS_FIELDS.some(([k]) => (st.intakeOriginal?.[k] || "") !== value[k]);
      st.answers.positioning = value.description ? (changed ? "Updated the business profile" : "Looks right") : "Saved";
      goStep("competition");
    } catch (e) { busy = ""; note = "Couldn't save: " + esc(e.message); draw(); }
  }

  // ---------- step: competition ----------
  function competitionForm() {
    const left = Math.max(3 - st.competitors.length, 0);
    return `<form class="ob-form" data-ob-form="competition">
      ${st.competitors.length ? `<ol class="ob-rivals">${st.competitors.map((c, i) => `<li><span class="ob-rank">${i + 1}</span><b>${esc(c)}</b><button type="button" class="ob-x" data-ob="remove-rival" data-i="${i}" aria-label="Remove ${esc(c)}">×</button></li>`).join("")}</ol>` : ""}
      ${left ? `<label class="ob-label" for="ob-rival">Competitor website${st.competitors.length ? ` · ${left} more` : ""}</label><div class="ob-inline"><input id="ob-rival" name="rival" inputmode="url" placeholder="competitor.com"><button type="submit" class="btn" name="add" value="1">Add</button></div>` : ""}
      ${status()}<div class="ob-actions"><button type="button" class="btn primary" data-ob="save-rivals" ${busy ? "disabled" : ""}>${st.competitors.length ? "Continue" : "Skip for now"}</button></div></form>`;
  }
  function addRival(value) {
    let host; try { host = bare(ctx.marketDomain(value.trim())); } catch { note = "Enter a website address, like <b>competitor.com</b>."; return draw(); }
    if (host === bare(st.domain)) { note = "That's this business's own website."; return draw(); }
    if (st.competitors.includes(host)) { note = "Already on the list."; return draw(); }
    st.competitors = [...st.competitors, host].slice(0, 3); note = ""; save(); draw();
  }
  async function saveRivals() {
    busy = "saving"; draw();
    try { await ctx.saveProfile(st.sid, (p) => ({ ...p, competitors: st.competitors })); goStep("gsc"); }
    catch (e) { busy = ""; note = "Couldn't save: " + esc(e.message); draw(); }
  }

  // ---------- step: Search Console ----------
  function gscView() {
    const g = st.gsc || {};
    if (busy === "gsc-load") return `<p class="ob-muted">Checking the Google connection…</p>`;
    if (g.unavailable) return `<p>Google sign-in isn't set up for Impackt Media yet. Register it once in <a href="#/w/${encodeURIComponent(st.sid)}/apps">Impackt Media apps</a>, then come back.</p>${status()}<div class="ob-actions"><button class="btn ghost" data-ob="gsc-later">Continue without it</button></div>`;
    if (g.connector && !g.connector.config?.property && ctx.owner) {
      return `<p>Google is connected${g.connector.config?.account ? ` as <b>${esc(g.connector.config.account)}</b>` : ""}, but none of its Search Console properties is <b>${esc(bare(st.domain))}</b>.</p><p class="ob-muted">Connect the Google account that manages your website in Search Console. If your site isn't in Search Console yet, you can add it later from Connections.</p>${status()}<div class="ob-actions"><button class="btn primary" data-ob="gsc-connect">Use another Google account</button><button class="btn ghost" data-ob="gsc-later">Later</button></div>`;
    }
    if (g.connector && !g.connector.config?.property) {
      if (!g.props) return `<p class="ob-muted">Loading the Search Console properties for this Google account…</p>`;
      if (!g.props.length) return `<p>This Google account can't see ${esc(bare(st.domain))} in Search Console.</p><p class="ob-muted">Reconnect with the Google account that owns the property, or add the client's site to Search Console first.</p>${status()}<div class="ob-actions"><button class="btn primary" data-ob="gsc-connect">Use another Google account</button><button class="btn ghost" data-ob="gsc-later">Later</button></div>`;
      const best = bestProperty(g.props);
      return `<form class="ob-form" data-ob-form="property"><label class="ob-label" for="ob-prop">Which property is ${esc(bare(st.domain))}?</label><select id="ob-prop" name="property">${g.props.map((p) => `<option value="${esc(p.property)}" ${p.property === best ? "selected" : ""}>${esc(p.property)}</option>`).join("")}</select>${status()}<div class="ob-actions"><button class="btn primary" ${busy ? "disabled" : ""}>${busy === "syncing" ? "Pulling 90 days of search data…" : "Use this property"}</button><button type="button" class="btn ghost" data-ob="gsc-later">Later</button></div></form>`;
    }
    if (g.connector?.status === "error") return `<p class="ob-warn">${esc(g.connector.last_error || "The Google connection needs attention.")}</p>${status()}<div class="ob-actions"><button class="btn primary" data-ob="gsc-connect">Reconnect Google</button><button class="btn ghost" data-ob="gsc-later">Later</button></div>`;
    if (busy === "syncing") return `<div class="ob-scan">${ctx.scanner("onboarding-sync")}<div><b>Pulling 90 days of search data…</b><p class="ob-muted">Clicks, impressions and the searches behind them.</p></div></div>`;
    return `<ul class="ob-benefits"><li>The searches that already bring customers in</li><li>Pages close to page one of Google</li><li>Proof of what changed after each fix</li></ul><p class="ob-muted">Read-only access. Impackt Media never changes Search Console settings.</p>${status()}
      <div class="ob-actions"><button class="btn primary" data-ob="gsc-connect" ${busy ? "disabled" : ""}>${busy === "redirect" ? "Opening Google…" : "Connect with Google"}</button><button class="btn ghost" data-ob="gsc-later">Later</button></div>`;
  }
  function bestProperty(props) {
    const d = bare(st.domain), list = props.map((p) => p.property);
    return list.find((p) => p === "sc-domain:" + d) || list.find((p) => bare(p.replace(/^https?:\/\//, "").replace(/\/$/, "")) === d) || list[0];
  }
  async function loadGsc() {
    busy = "gsc-load"; st.gsc = {}; draw();
    try {
      const c = await ctx.gscConnector(st.sid);
      st.gsc = { connector: c };
      if (!c) { const info = await ctx.connectInfo(); if (!info?.providers?.google) st.gsc.unavailable = true; }
      else if (c.status === "connected" && c.config?.property) { busy = ""; return syncAndContinue(); }
      else if (!c.config?.property && !ctx.owner) { busy = ""; draw(); st.gsc.props = await ctx.gscProperties(c.id); }
    } catch (e) { note = esc(e.message); }
    busy = ""; if (st.step === "gsc") draw();
  }
  async function connectGoogle() {
    busy = "redirect"; draw(); save();
    try { location.href = await ctx.googleAuthUrl(st.sid, `#/onboarding/${encodeURIComponent(st.sid)}`); }
    catch (e) { busy = ""; note = esc(e.message); draw(); }
  }
  async function useProperty(property) {
    busy = "syncing"; note = ""; draw();
    try { await ctx.setProperty(st.gsc.connector.id, property); st.gsc.connector = { ...st.gsc.connector, config: { ...st.gsc.connector.config, property } }; }
    catch (e) { busy = ""; note = "Couldn't use that property: " + esc(e.message); return draw(); }
    return syncAndContinue();
  }
  async function syncAndContinue() {
    busy = "syncing"; draw();
    try { const x = await ctx.syncGoogle(st.sid); st.answers.gsc = x.days ? `Connected · ${num(x.days)} days of search data` : "Connected · no search data yet"; }
    catch (e) { st.answers.gsc = "Connected · first sync pending"; st.syncError = e.message; }
    goStep("opportunity");
  }

  // ---------- step: opportunity ----------
  function opportunityView(now) {
    const o = st.opp;
    if (!st.answers.gsc || st.answers.gsc === "Later") return bot(`Once Search Console is connected, I'll show the clearest search opportunity here. You can connect it any time from Integrations.`) + (now ? card(`<div class="ob-actions"><button class="btn primary" data-ob="opp-continue">Continue</button></div>`) : "");
    if (now && busy === "opp") return bot(`Looking through the searches that already show ${esc(st.name)}…`);
    if (!o) return bot(st.syncError ? `The first sync hasn't finished (${esc(st.syncError)}). I'll keep checking, and opportunities will appear in Overview.` : `Search Console is connected. Not enough search data yet to point at one opportunity. I'll surface it in Overview as data comes in.`) + (now ? card(`<div class="ob-actions"><button class="btn primary" data-ob="opp-continue">Continue</button></div>`) : "");
    const chart = sparkline(o.daily);
    const t = o.totals;
    const why = { page2: `It ranks <b>#${o.q.position.toFixed(1)}</b>, just off page one, and was seen <b>${num(o.q.impressions)}</b> times. Moving it onto page one is the clearest win.`, ctr: `It already ranks <b>#${o.q.position.toFixed(1)}</b> on page one, but only ${(o.q.ctr * 100).toFixed(1)}% of people click. A clearer title and description can win those clicks.`, deep: `It ranks <b>#${o.q.position.toFixed(1)}</b>. Searchers want this, and the site is already relevant enough to appear.` }[o.kind];
    return bot(`Here's ${esc(st.name)} in Google over the last ${o.daily.length} days.`) + card(`<div class="ob-stats"><div><b>${num(t.clicks)}</b><span>Clicks</span></div><div><b>${num(t.impressions)}</b><span>Impressions</span></div><div><b>${t.position ? t.position.toFixed(1) : "–"}</b><span>Avg. position</span></div></div>${chart}`, "ob-chart-card")
      + bot(`And the first opportunity: <b>“${esc(o.q.query)}”</b>. ${why}`)
      + (now ? card(`<table class="ob-table"><thead><tr><th>Search</th><th>Position</th><th>Impressions</th><th>Clicks</th></tr></thead><tbody>${o.rows.map((r) => `<tr class="${r.query === o.q.query ? "on" : ""}"><td>${esc(r.query)}</td><td>${r.position.toFixed(1)}</td><td>${num(r.impressions)}</td><td>${num(r.clicks)}</td></tr>`).join("")}</tbody></table><div class="ob-actions"><button class="btn primary" data-ob="opp-continue">Continue</button></div>`) : you("Got it"));
  }
  function sparkline(rows) {
    if (!rows.length) return "";
    const w = 560, h = 120, max = Math.max(1, ...rows.map((r) => r.clicks)), step = w / Math.max(1, rows.length - 1);
    const pts = rows.map((r, i) => `${(i * step).toFixed(1)},${(h - (r.clicks / max) * (h - 8) - 4).toFixed(1)}`).join(" ");
    return `<svg class="ob-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Daily clicks, peak ${num(max)}"><polyline points="0,${h} ${pts} ${w},${h}" class="area"/><polyline points="${pts}" class="line"/></svg>`;
  }
  async function findOpportunity() {
    busy = "opp"; draw();
    try {
      const { queries, daily } = await ctx.searchData(st.sid);
      const pick = (f) => queries.filter(f).sort((a, b) => b.impressions - a.impressions)[0];
      let q = pick((r) => r.position > 10 && r.position <= 20), kind = "page2";
      if (!q) { q = pick((r) => r.position >= 4 && r.position <= 10 && r.ctr < 0.024 && r.impressions >= 50); kind = "ctr"; }
      if (!q) { q = pick((r) => r.position > 20 && r.position <= 50); kind = "deep"; }
      const d = daily.slice(-90), sum = (k) => d.reduce((n, r) => n + (r[k] || 0), 0), imp = sum("impressions");
      const top = queries.slice().sort((a, b) => b.impressions - a.impressions).slice(0, 5);
      const rows = q && !top.includes(q) ? [q, ...top.slice(0, 4)] : top;
      const position = imp ? d.reduce((n, r) => n + (r.position || 0) * (r.impressions || 0), 0) / imp : 0;
      st.opp = q ? { q, kind, daily: d, rows, totals: { clicks: sum("clicks"), impressions: imp, position } } : null;
    } catch { st.opp = null; }
    busy = ""; save(); if (st.step === "opportunity") draw();
  }

  // ---------- steps: attribution, level ----------
  function attributionForm() {
    const a = st.answers.attributionPick || "";
    return `<form class="ob-form" data-ob-form="attribution"><div class="ob-chips" role="radiogroup" aria-label="How they found Impackt Media">${ATTRIBUTION.map((x) => `<label class="ob-chip ${a === x ? "on" : ""}"><input type="radio" name="source" value="${esc(x)}" ${a === x ? "checked" : ""}>${esc(x)}</label>`).join("")}</div>
      <label class="ob-label" for="ob-attr">Details (optional)</label><input id="ob-attr" name="detail" maxlength="200" placeholder="Who referred them, which event…">
      ${status()}<div class="ob-actions"><button class="btn primary" ${busy ? "disabled" : ""}>Send</button><button type="button" class="btn ghost" data-ob="skip-attribution">Skip</button></div></form>`;
  }
  async function saveAttribution(form) {
    const source = form.elements.source.value, detail = form.elements.detail.value.trim();
    if (!source && !detail) { note = "Pick an option, or skip."; return draw(); }
    busy = "saving"; draw();
    try { await ctx.saveAnswers(st.sid, { attribution: { source, detail } }); st.answers.attribution = [source, detail].filter(Boolean).join(" · "); goStep("level"); }
    catch (e) { busy = ""; note = "Couldn't save: " + esc(e.message); draw(); }
  }
  function levelForm() {
    return `<div class="ob-levels">${LEVELS.map(([k, label, hint]) => `<button type="button" class="ob-level" data-ob="level" data-level="${k}" ${busy ? "disabled" : ""}><b>${esc(label)}</b><span>${esc(hint)}</span></button>`).join("")}</div>${status()}`;
  }
  async function saveLevel(level) {
    busy = "saving"; draw();
    try { await ctx.saveAnswers(st.sid, { seo_level: level, onboarded: true }); st.answers.level = level; goStep("done"); }
    catch (e) { busy = ""; note = "Couldn't save: " + esc(e.message); draw(); }
  }

  // ---------- step: done ----------
  function tracks() {
    const t = [];
    if (st.opp?.q) t.push(["climb", "Win a search", `“${st.opp.q.query}”`, `How do we move “${st.opp.q.query}” from position ${st.opp.q.position.toFixed(1)} onto page one of Google? Be specific about the page and the changes.`]);
    t.push(["audit", "Site check", "The most important fixes first", `What are the most important problems on ${bare(st.domain)} right now, and which should we fix first?`]);
    if (st.competitors.length) t.push(["rivals", "Compare with rivals", st.competitors.join(" · "), `How does ${st.name} compare with ${st.competitors.join(", ")} in Google and in AI answers? Where are we behind?`]);
    else t.push(["findRivals", "Find competitors", "Who wins the searches we want", `Which competitors show up for the searches ${st.name}'s customers make, and why do they win?`]);
    t.push(["write", "Plan content", "The next article worth writing", `What should we write next for ${st.name}? Base it on real searches and what competitors cover.`]);
    return t;
  }
  function doneView() {
    const lvl = LEVELS.find((l) => l[0] === st.answers.level)?.[3];
    return bot(`<b>${ctx.owner ? "You're all set." : esc(st.name) + " is set up."}</b> The site check is running, ${st.answers.gsc && st.answers.gsc !== "Later" ? "Search Console is connected" : "Search Console can be connected any time"}${lvl ? `, and Samaritan will explain its work ${esc(lvl)}` : ""}. Where do you want to start?`)
      + card(`<div class="ob-tracks">${tracks().map(([k, label, sub, prompt]) => `<button type="button" class="ob-track" data-ob="track" data-prompt="${esc(prompt)}" data-track="${k}"><span class="ob-track-label">${esc(label)}</span><b>${esc(sub)}</b><span class="ob-track-go" aria-hidden="true">Ask Samaritan ↗</span></button>`).join("")}</div><div class="ob-actions"><button type="button" class="btn ghost" data-ob="finish">Go to Overview</button></div>`);
  }

  // ---------- events ----------
  function onSubmit(e) {
    const form = e.target.closest("[data-ob-form]"); if (!form || !root.contains(form)) return;
    e.preventDefault(); if (busy) return;
    const kind = form.dataset.obForm;
    if (kind === "domain") return submitDomain(form.elements.domain.value);
    if (kind === "site") return createSite(form);
    if (kind === "positioning") return savePositioning(form);
    if (kind === "competition") { const v = form.elements.rival?.value || ""; if (v.trim()) return addRival(v); return; }
    if (kind === "property") return useProperty(form.elements.property.value);
    if (kind === "attribution") return saveAttribution(form);
  }
  function onClick(e) {
    const b = e.target.closest("[data-ob]"); if (!b || !root.contains(b)) return;
    const a = b.dataset.ob;
    if (a === "use-suggestion") { st.domainDraft = st.suggestion; st.typoAccepted = true; return submitDomain(st.suggestion); }
    if (a === "no-site") { note = "Samaritan's search and AI work starts from a public website. Add the business with the <a href=\"#/add-site\">manual form</a> instead, and connect a site when they have one."; return draw(); }
    if (a === "retry-read") return readSite();
    if (a === "skip-positioning") { st.answers.positioning = "Skipped for now"; return goStep("competition"); }
    if (a === "remove-rival") { st.competitors = st.competitors.filter((_, i) => i !== +b.dataset.i); save(); return draw(); }
    if (a === "save-rivals") { const v = root.querySelector("#ob-rival")?.value?.trim(); if (v) { addRival(v); if (note) return; } return saveRivals(); }
    if (a === "gsc-connect") return connectGoogle();
    if (a === "gsc-later") { st.answers.gsc = "Later"; return goStep("opportunity"); }
    if (a === "opp-continue") return goStep("attribution");
    if (a === "skip-attribution") { st.answers.attribution = ""; return goStep("level"); }
    if (a === "level") return saveLevel(b.dataset.level);
    if (a === "track" || a === "finish") { const sid = st.sid; clear(); st = null; return ctx.finish(sid, a === "track" ? b.dataset.prompt : null); } // next onboarding starts fresh
  }
  function onChange(e) {
    const r = e.target; if (!root.contains(r) || r.type !== "radio") return;
    if (r.name === "platform") { st.platform = r.value; const n = root.querySelector("#ob-name")?.value; if (n != null) st.name = n; save(); draw(); }
    if (r.name === "source") { st.answers.attributionPick = r.value; r.closest(".ob-chips").querySelectorAll(".ob-chip").forEach((c) => c.classList.toggle("on", c.contains(r))); }
  }
  function onInput(e) { if (e.target.id === "ob-domain") { st.domainDraft = e.target.value; st.suggestion = null; } if (e.target.id === "ob-name") st.name = e.target.value; }

  window.ImpacktOnboarding = {
    mount(el, c, siteFromHash) {
      ctx = c;
      const first = root !== el;
      root = el;
      if (first) { root.addEventListener("submit", onSubmit); root.addEventListener("click", onClick); root.addEventListener("change", onChange); root.addEventListener("input", onInput); }
      if (!st || (siteFromHash && st.sid !== siteFromHash)) st = load(siteFromHash);
      if (!st.intakeOriginal && st.intake) st.intakeOriginal = { ...st.intake };
      busy = ""; draw();
      if (st.step === "welcome") goStep("site");
      else if (st.step === "site" && !st.intake && !st.sid && !st.intakeError) readSite();
      else if (st.step === "gsc") loadGsc();
      else if (st.step === "opportunity" && !st.opp && st.answers.gsc && st.answers.gsc !== "Later") findOpportunity();
    },
    reset() { if (ctx) clear(); st = null; },
  };
})();
