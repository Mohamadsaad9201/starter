/* Impackt dashboard: purpose-built analytics for the work Samaritan does.
   Every number comes from a connected source or a saved work record. Nothing is estimated.
   Pages: overview · traffic · visibility · citations · benchmarks · leadgen · work */
(function (root) {
  "use strict";
  const DAY = 86400000;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fin = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const shift = (d, n) => iso(Date.parse(d + "T12:00:00Z") + n * DAY);
  const num = (v, dp = 0) => (fin(v) ? Number(v).toLocaleString("en-US", { maximumFractionDigits: dp }) : "—");
  const pct = (v, dp = 1) => (fin(v) ? (Number(v) * 100).toFixed(dp).replace(/\.0$/, "") + "%" : "—");
  const money = (v, cur = "USD") => (fin(v) ? new Intl.NumberFormat("en-US", { style: "currency", currency: /^[A-Z]{3}$/.test(cur) ? cur : "USD", maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 }).format(v) : "—");
  const ratio = (a, b) => (fin(a) && fin(b) && Number(b) > 0 ? Number(a) / Number(b) : null);
  const ago = (t) => { if (!t) return "—"; const m = Math.round((Date.now() - Date.parse(t)) / 60000); if (!Number.isFinite(m)) return "—"; if (m < 60) return `${Math.max(1, m)} min ago`; const h = Math.round(m / 60); if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`; const d = Math.round(h / 24); return `${d} day${d === 1 ? "" : "s"} ago`; };
  const short = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
  const norm = (v) => String(v || "").toLowerCase().replace(/^(shop|store|www)\./, "").replace(/\.(com|net|org|co|io|us|ca|uk|shop|store)(\.[a-z]{2})?$/, "").replace(/[^a-z0-9]/g, "");

  // ---------- state ----------
  const store = { get(k, d) { try { const v = localStorage.getItem("impackt:dash:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem("impackt:dash:" + k, JSON.stringify(v)); } catch { /* private mode */ } } };
  const state = { days: store.get("days", 28), gran: store.get("gran", "daily"), compare: store.get("compare", true), engine: store.get("engine", "all") };
  if (![7, 28, 90].includes(state.days)) state.days = 28;

  // ---------- icons ----------
  const I = {
    overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    traffic: '<path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    visibility: '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    citations: '<circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 005 0V12a9 9 0 10-3.5 7.1"/>',
    benchmarks: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    leadgen: '<path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z"/><path d="M15 9a4 4 0 010 6M18 6a8 8 0 010 12"/>',
    review: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9"/>',
    content: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    work: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>',
    team: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0114 0"/><path d="M16 4.5a3.5 3.5 0 010 7M22 20a7 7 0 00-4-6.3"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0zM12 17v5"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 016.5 2H20v18H6.5A2.5 2.5 0 004 22.5z"/><path d="M4 4.5v18"/>',
    seo: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
    ads: '<path d="M4 4h16v12H4z"/><path d="M8 20h8M12 16v4"/>',
    sentiment: '<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/>',
    factcheck: '<path d="M12 2l2.4 2.1 3.2-.4.9 3.1 2.8 1.6-1.1 3 1.1 3-2.8 1.6-.9 3.1-3.2-.4L12 22l-2.4-2.1-3.2.4-.9-3.1-2.8-1.6 1.1-3-1.1-3 2.8-1.6.9-3.1 3.2.4z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    chev: '<path d="M9 18l6-6-6-6"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>', down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    link: '<path d="M7 17L17 7M8 7h9v9"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  };
  const ic = (k, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k] || ""}</svg>`;

  // ---------- periods ----------
  function periods(end, days) {
    return { start: shift(end, 1 - days), end, prevStart: shift(end, 1 - 2 * days), prevEnd: shift(end, -days), days };
  }
  const inP = (d, a, b) => d >= a && d <= b;
  const today = () => iso(Date.now());

  // Bucket daily values into daily or weekly points for a chart.
  function bucket(rows, start, days, key, agg = "sum") {
    const n = state.gran === "weekly" ? Math.ceil(days / 7) : days, step = state.gran === "weekly" ? 7 : 1;
    const map = new Map(rows.map((r) => [r.date, r]));
    return Array.from({ length: n }, (_, i) => {
      const from = shift(start, i * step), vals = [];
      for (let k = 0; k < step; k++) { const r = map.get(shift(from, k)); if (r && fin(r[key])) vals.push(Number(r[key])); }
      const y = vals.length ? (agg === "sum" ? vals.reduce((a, b) => a + b, 0) : vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      return { x: from, y };
    });
  }

  // ---------- data shaping ----------
  const ENGINE = { chatgpt: "ChatGPT", openai: "ChatGPT", claude: "Claude", gemini: "Gemini", perplexity: "Perplexity", copilot: "Copilot" };
  const ENGINE_SHORT = { chatgpt: "GPT", openai: "GPT", claude: "Cl", gemini: "Ge", perplexity: "Px", copilot: "Co" };
  const engineName = (e) => ENGINE[String(e).toLowerCase()] || String(e || "Unknown");
  function aiRows(snap) { return (snap?.ai || []).filter((c) => c.status === "done" && c.checked_at && (state.engine === "all" || c.engine === state.engine)); }
  let engineList = [];
  function aiPeriod(rows, a, b) { return rows.filter((c) => inP(String(c.checked_at).slice(0, 10), a, b)); }
  function aiDaily(rows, key) {
    const m = new Map();
    for (const c of rows) { const d = String(c.checked_at).slice(0, 10), v = m.get(d) || { date: d, n: 0, hit: 0 }; v.n++; if (c[key]) v.hit++; m.set(d, v); }
    return [...m.values()].map((v) => ({ date: v.date, n: v.n, hit: v.hit }));
  }
  // Weighted rate per bucket so weekly points are true rates, not averages of averages.
  function rateSeries(daily, start, days) {
    const n = state.gran === "weekly" ? Math.ceil(days / 7) : days, step = state.gran === "weekly" ? 7 : 1, map = new Map(daily.map((r) => [r.date, r]));
    return Array.from({ length: n }, (_, i) => { const from = shift(start, i * step); let N = 0, H = 0; for (let k = 0; k < step; k++) { const r = map.get(shift(from, k)); if (r) { N += r.n; H += r.hit; } } return { x: from, y: N ? H / N : null }; });
  }
  function brandShare(rows, siteName) {
    const total = rows.length, m = new Map();
    for (const c of rows) for (const n of new Set(c.competitors || [])) { const k = String(n).trim(); if (k) m.set(k, (m.get(k) || 0) + 1); }
    const list = [...m.entries()].map(([name, n]) => ({ name, n, share: total ? n / total : null, own: false }));
    list.push({ name: siteName, n: rows.filter((c) => c.mentioned).length, share: total ? rows.filter((c) => c.mentioned).length / total : null, own: true });
    return list.sort((a, b) => b.n - a.n);
  }
  const SOCIAL = /(^|\.)(youtube|reddit|facebook|instagram|tiktok|x|twitter|linkedin|pinterest|quora|threads)\.com$/;
  const MARKET = /(^|\.)(amazon|walmart|ebay|etsy|instacart|target|costco|doordash|ubereats|grubhub|weee|thrivemarket)\.(com|org)$/;
  const DIRECTORY = /(^|\.)(google|maps\.google|yelp|tripadvisor|bbb|trustpilot|apple|mapquest|yellowpages|angi|nextdoor|healthgrades|zocdoc|niche|greatschools)\.(com|org)$/;
  function categorize(domain, ownDomain, rivals) {
    if (!domain) return "Other";
    if (domain === ownDomain || domain.endsWith("." + ownDomain)) return "Owned";
    const d = norm(domain);
    if (rivals.some((r) => r && (d.includes(r) || r.includes(d)))) return "Competition";
    if (SOCIAL.test(domain)) return "Social";
    if (MARKET.test(domain)) return "Marketplace";
    if (DIRECTORY.test(domain)) return "Directory";
    return "Earned";
  }
  const CAT = { Owned: "owned", Competition: "comp", Social: "social", Marketplace: "market", Directory: "dir", Earned: "earned", Other: "other" };
  function citationStats(rows, ownDomain, rivalNames) {
    const rivals = rivalNames.map(norm).filter((x) => x.length > 2), m = new Map(); let total = 0;
    for (const c of rows) for (const u of new Set((c.citations || []).map((x) => host(x.url)).filter(Boolean))) { total++; m.set(u, (m.get(u) || 0) + 1); }
    const list = [...m.entries()].map(([domain, n]) => ({ domain, n, share: total ? n / total : 0, cat: categorize(domain, ownDomain, rivals) })).sort((a, b) => b.n - a.n);
    const cats = {}; for (const x of list) cats[x.cat] = (cats[x.cat] || 0) + x.n;
    return { total, list, cats };
  }
  function reportOf(snap, source) { return (snap?.reports || []).find((r) => r.source === source)?.payload || null; }
  // Store sales come from the daily order import (matches Shopify's Total sales); the older order-value report is a fallback.
  // The period ends on the last complete day, never today's partial one.
  function storeOf(ctx, days) {
    const daily = ctx.shopDaily || [], rep = reportOf(ctx.snap, "shopify");
    const rows = daily.length ? daily.map((r) => ({ date: r.day, revenue: Number(r.sales), orders: Number(r.orders) })) : rep?.rows || [];
    if (!rows.length) return null;
    const y = new Date(Date.now() - DAY), yest = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
    const last = rows.map((r) => r.date).sort().at(-1), end = last < yest ? last : yest;
    // Headline totals come from marketing_metrics (the shared definition Samaritan also uses); rows remain for charts.
    const m = (ctx.metrics?.store || []).find((w) => w.days === days) || null;
    if (m) return { rows, m, end: m.end, P: { start: m.start, end: m.end, prevStart: m.prev_start, prevEnd: m.prev_end, days } };
    return { rows, P: periods(end, days), end };
  }
  function storeNums(shop) {
    if (!shop) return { r: null, rp: null, o: null, op: null };
    if (shop.m) return { r: Number(shop.m.sales), rp: shop.m.comparable ? Number(shop.m.prev_sales) : null, o: Number(shop.m.orders), op: shop.m.comparable ? Number(shop.m.prev_orders) : null };
    const Q = shop.P;
    return { r: sumKey(shop.rows, Q.start, Q.end, "revenue"), rp: sumKey(shop.rows, Q.prevStart, Q.prevEnd, "revenue"), o: sumKey(shop.rows, Q.start, Q.end, "orders"), op: sumKey(shop.rows, Q.prevStart, Q.prevEnd, "orders") };
  }
  function sumKey(rows, a, b, key) { const v = (rows || []).filter((r) => r.date && inP(r.date, a, b) && fin(r[key])).map((r) => Number(r[key])); return v.length ? v.reduce((x, y) => x + y, 0) : null; }
  function daysWith(rows, a, b) { return new Set((rows || []).filter((r) => r.date && inP(r.date, a, b)).map((r) => r.date)).size; }

  // ---------- components ----------
  function delta(cur, prev, { pp = false, invert = false, money: m = false } = {}) {
    if (!state.compare) return "";
    if (!fin(cur) || !fin(prev)) return `<span class="dx-delta none" title="No comparable previous period">—</span>`;
    const diff = pp ? cur - prev : prev === 0 ? null : (cur - prev) / prev;
    if (diff === null) return `<span class="dx-delta none" title="Previous period was zero">new</span>`;
    if (Math.abs(diff) < 0.0005) return `<span class="dx-delta flat">0${pp ? " pts" : "%"}</span>`;
    const good = invert ? diff < 0 : diff > 0;
    const label = pp ? `${(Math.abs(diff) * 100).toFixed(1).replace(/\.0$/, "")} pts` : `${(Math.abs(diff) * 100).toFixed(Math.abs(diff) < 0.1 ? 1 : 0)}%`;
    return `<span class="dx-delta ${good ? "up" : "down"}">${ic(diff > 0 ? "up" : "down", 13)}${label}</span>`;
  }
  function kpi({ label, desc, value, d = "", source = "", connect = null }) {
    if (connect) return `<article class="dx-kpi muted"><h3>${esc(label)}</h3><p>${esc(desc)}</p><div class="dx-kpi-connect"><span>${esc(connect.text)}</span><a href="${esc(connect.href)}">${esc(connect.cta)} ${ic("chev", 14)}</a></div></article>`;
    return `<article class="dx-kpi"><h3>${esc(label)}</h3><p>${esc(desc)}</p><div class="dx-kpi-v"><strong>${value}</strong>${d}</div>${source ? `<small>${esc(source)}</small>` : ""}</article>`;
  }
  function panel(title, sub, body, { right = "", cls = "" } = {}) {
    return `<section class="dx-sec ${cls}"><div class="dx-sec-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</div>${right}</div><div class="dx-card">${body}</div></section>`;
  }
  function empty(title, text, cta) {
    return `<div class="dx-empty"><div class="dx-empty-ic">${ic("plug", 20)}</div><b>${esc(title)}</b><p>${esc(text)}</p>${cta ? `<a class="dx-btn" href="${esc(cta.href)}">${esc(cta.label)}</a>` : ""}</div>`;
  }
  const PALETTE = ["var(--dx-c1)", "var(--dx-c2)", "var(--dx-c3)", "var(--dx-c4)", "var(--dx-c5)", "var(--dx-c6)"];
  // Line chart: series [{name, color, dashed, points:[{x,y}]}]. Gaps stay gaps; nothing is interpolated.
  function chart(series, { fmt = (v) => num(v), yMax = null, height = 260, labels = null } = {}) {
    const all = series.flatMap((s) => s.points.map((p) => p.y)).filter(fin);
    if (!all.length) return `<div class="dx-chart-empty">No observations in this period.</div>`;
    const W = 720, H = height, L = 44, R = 12, T = 14, B = 28, n = Math.max(...series.map((s) => s.points.length));
    let max = yMax ?? Math.max(...all); if (!yMax) { const mag = Math.pow(10, Math.floor(Math.log10(max || 1))); max = Math.ceil((max || 1) / mag) * mag; if (max === 0) max = 1; }
    const x = (i) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1)), y = (v) => T + (1 - v / max) * (H - T - B);
    const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${y(max * f)}" y2="${y(max * f)}" class="dx-grid"/><text x="${L - 8}" y="${y(max * f) + 4}" class="dx-axis" text-anchor="end">${esc(fmt(max * f))}</text>`).join("");
    const xs = labels || series[0].points.map((p) => p.x), every = Math.max(1, Math.ceil(n / 6));
    const xl = xs.map((d, i) => (i === n - 1 || (i % every === 0 && n - 1 - i >= every * 0.6)) ? `<text x="${x(i)}" y="${H - 6}" class="dx-axis" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${esc(short(d))}</text>` : "").join("");
    const paths = series.map((s, si) => {
      let d = "", pen = false; s.points.forEach((p, i) => { if (!fin(p.y)) { if (!s.connect) pen = false; return; } d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(p.y).toFixed(1)}`; pen = true; });
      const dots = s.points.map((p, i) => (fin(p.y) && (s.connect || s.points.filter((q) => fin(q.y)).length < 3 || i === s.points.length - 1) ? `<circle cx="${x(i)}" cy="${y(p.y)}" r="3" fill="${s.color || PALETTE[si]}"/>` : "")).join("");
      return `<path d="${d}" fill="none" stroke="${s.color || PALETTE[si]}" stroke-width="${s.dashed ? 1.6 : 2.2}" ${s.dashed ? 'stroke-dasharray="4 5" opacity=".55"' : ""} stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
    }).join("");
    const data = esc(JSON.stringify({ n, L, R, W, xs, series: series.map((s, si) => ({ name: s.name, color: s.color || PALETTE[si], v: s.points.map((p) => p.y), f: s.points.map((p) => (fin(p.y) ? fmt(p.y) : "—")) })) }));
    const legend = series.length > 1 ? `<div class="dx-legend">${series.map((s, si) => `<span><i style="background:${s.color || PALETTE[si]};${s.dashed ? "opacity:.55" : ""}"></i>${esc(s.name)}</span>`).join("")}</div>` : "";
    return `<div class="dx-chart" data-chart="${data}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(series.map((s) => s.name).join(", "))} chart">${grid}${xl}${paths}<line class="dx-cross" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/></svg><div class="dx-tip" hidden></div></div>${legend}`;
  }
  function bar(v, max, cls = "") { return `<span class="dx-bar ${cls}"><i style="width:${max ? Math.max(2, (100 * v) / max) : 0}%"></i></span>`; }
  const avatar = (name) => { const s = String(name || "?"), h = [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 6; return `<span class="dx-av c${h}">${esc(s.replace(/^www\./, "")[0]?.toUpperCase() || "?")}</span>`; };
  const tag = (cat) => `<span class="dx-tag ${CAT[cat] || "other"}">${esc(cat)}</span>`;

  // ---------- head ----------
  function modelFilter(ctx) {
    const engines = [...new Set((ctx.snap?.ai || []).map((c) => c.engine).filter(Boolean))];
    if (engines.length < 2) return "";
    return `<label class="dx-chip dx-select">${ic("visibility", 14)}<select data-dx-engine aria-label="AI model">${[["all", "All models"], ...engines.map((e) => [e, engineName(e)])].map(([v, l]) => `<option value="${esc(v)}" ${state.engine === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  }
  function head(ctx, title, sub, { range = true, extra = "" } = {}) {
    const r = range ? `<div class="dx-range" role="group" aria-label="Date range">${[[7, "Last 7 days"], [28, "Last 28 days"], [90, "Last 90 days"]].map(([d, l]) => `<button type="button" data-dx-days="${d}" aria-pressed="${state.days === d}">${l}</button>`).join("")}</div><div class="dx-controls"><button type="button" class="dx-chip" data-dx-gran aria-label="Granularity">${state.gran === "weekly" ? "Weekly" : "Daily"}</button><button type="button" class="dx-chip ${state.compare ? "on" : ""}" data-dx-compare aria-pressed="${state.compare}">vs. previous period</button>${ctx.ai ? modelFilter(ctx) : ""}${extra}</div>` : extra ? `<div class="dx-controls">${extra}</div>` : "";
    return `<header class="dx-head"><nav class="dx-crumb" aria-label="Breadcrumb"><span>${esc(ctx.s.name)}</span>${ic("chev", 13)}<span>${esc(ctx.group || "Analytics")}</span></nav><h1>${esc(title)}</h1>${sub ? `<p class="dx-sub">${esc(sub)}</p>` : ""}${r ? `<div class="dx-toolbar">${r}</div>` : ""}</header>`;
  }

  // ---------- pages ----------
  // Overview answers three questions for a business owner, in this order:
  // what do you need from me, how is marketing doing, and what is my team doing (connected sources only).
  const STAGE = { drafting: ["Preparing", "work"], ready: ["Waiting for your approval", "ask"], approved: ["Publishing", "work"], live: ["Live · measuring results", "ok"], measured: ["Measured", "ok"], blocked: ["With your team", "hold"] };
  function overview(ctx) {
    const { s, snap } = ctx, P = periods(today(), state.days), ai = aiRows(snap), cur = aiPeriod(ai, P.start, P.end), prev = aiPeriod(ai, P.prevStart, P.prevEnd);
    const opps = (ctx.opps || []).filter((o) => o.stage !== "dismissed");
    const work = (snap?.work || []).filter((w) => w.status === "deployed" && w.verification?.state === "verified");
    const pubs = [...(snap?.publications || []), ...(snap?.page_publications || [])].filter((p) => p.status === "published" && p.verification?.state === "verified");
    const shipped = (a, b) => work.filter((w) => inP(String(w.deployed_at).slice(0, 10), a, b)).length + pubs.filter((p) => inP(String(p.published_at).slice(0, 10), a, b)).length;
    const shop = storeOf(ctx, state.days), ga = reportOf(snap, "ga4"), gads = reportOf(snap, "google_ads"), search = snap?.search || [];
    const ea = (ctx.tools?.audits || []).find((x) => x.tool === "klaviyo" && x.finished_at && x.status !== "error");
    const n = ctx.reviewCount || 0;

    // 1. What do you need from me?
    const ask = n
      ? `<a class="dx-ask" href="${ctx.href("inbox")}"><span class="dx-pulse"></span><div><b>${n} ${n === 1 ? "change is" : "changes are"} ready for your approval</b><small>Prepared work is grouped by channel. Review the changes or discuss them with your team.</small></div><span class="dx-btn">Review ${ic("chev", 14)}</span></a>`
      : `<div class="dx-ask calm"><span class="dx-ok">${ic("check", 14)}</span><div><b>Nothing needs you right now</b><small>We'll ask here when a change is ready for your approval.</small></div></div>`;

    // 2. What is my team doing? Real activity only: prepared fixes, checks that ran, work confirmed live.
    const feed = [];
    for (const o of opps.slice(0, 12)) { const st = STAGE[o.stage] || ["In progress", "work"], ev = o.evidence || {};
      const why = o.kind === "ai_answer_gap" && fin(ev.total) ? `${(ev.engines || []).map(engineName).join(" and ") || "AI assistants"} named you in ${ev.named} of ${ev.total} answers${(ev.competitors || []).length ? `; they named ${ev.competitors.slice(0, 2).join(" and ")}` : ""}.` : o.why ? String(o.why).split(/(?<=\.)\s/)[0].replace(/\b(chatgpt|claude|gemini|perplexity)\b/gi, (m) => engineName(m)) : "";
      feed.push({ at: o.updated_at || o.created_at, kind: st[1], label: st[0], title: o.title, why, href: o.stage === "ready" ? ctx.href("inbox") : ctx.href("work") }); }
    const lastAi = ai.map((c) => c.checked_at).sort().at(-1);
    if (lastAi) { const day = ai.filter((c) => String(c.checked_at).slice(0, 10) === String(lastAi).slice(0, 10)), qs = new Set(day.map((c) => c.prompt)).size, named = day.filter((c) => c.mentioned).length; feed.push({ at: lastAi, kind: "check", label: "AI answers checked", title: `Asked ${enginesSaid(day)} ${num(qs)} questions your customers ask`, why: `You were named in ${num(named)} of ${num(day.length)} sampled answers.`, href: ctx.href("visibility") }); }
    if (ctx.ready?.checked_at) feed.push({ at: ctx.ready.checked_at, kind: "check", label: "Website checked", title: `Checked how AI assistants read ${s.domain.replace(/^www\./, "")}`, why: fin(ctx.ready.score) ? `Readiness score ${num(ctx.ready.score)}/100.` : "", href: ctx.href("visibility") });
    if (ea) feed.push({ at: ea.finished_at, kind: "check", label: "Email reviewed", title: "Reviewed your email flows and campaigns", why: `Email health ${num(ea.score)}/100 · ${money(ea.metrics?.email_revenue_90d)} from email in 90 days.`, href: ctx.href("email") });
    const doing = feed.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 7);
    const active = opps.filter((o) => ["drafting", "approved"].includes(o.stage)).length, liveN = opps.filter((o) => ["live", "measured"].includes(o.stage)).length;
    const doingBody = doing.length ? `<ul class="dx-now">${doing.map((x) => `<li><span class="dx-now-dot ${x.kind}"></span><div><span class="dx-now-tag ${x.kind}">${esc(x.label)}</span><b>${esc(String(x.title).slice(0, 120))}</b>${x.why ? `<small>${esc(x.why.slice(0, 180))}</small>` : ""}</div><span class="dx-now-at">${esc(ago(x.at))}</span>${x.href ? `<a class="dx-now-go" href="${x.href}" aria-label="Open">${ic("chev", 14)}</a>` : ""}</li>`).join("")}</ul>` : `<p class="dx-muted-t dx-pad">No work has been recorded yet. Your team can confirm setup and the next steps.</p>`;
    const team = `<div class="dx-team-sum"><span><b>${num(active)}</b> in progress</span><span><b>${num(n)}</b> prepared for review</span><span><b>${num(liveN)}</b> live and being measured</span><span><b>${num(shipped(P.start, P.end))}</b> confirmed live in this period</span></div>`;

    // 3. How is my marketing doing? Only sources that are connected; each number says what it means.
    const tiles = [];
    if (shop) { const { r, rp, o } = storeNums(shop); tiles.push(kpi({ label: "Store sales", desc: "Total sales in this period, from your store", value: money(r), d: delta(r, rp), source: `${num(o)} orders · Shopify · through ${short(shop.end)}` })); }
    if (search.length) { const sEnd = search.map((r) => r.date).sort().at(-1), SP = periods(sEnd, state.days), c = sumKey(search, SP.start, SP.end, "clicks"), cp = sumKey(search, SP.prevStart, SP.prevEnd, "clicks"); tiles.push(kpi({ label: "Visits from Google", desc: "People who clicked your site in Google search", value: num(c), d: delta(c, cp), source: `Search Console · through ${short(sEnd)}` })); }
    if (cur.length) { const v = ratio(cur.filter((c) => c.mentioned).length, cur.length), vp = ratio(prev.filter((c) => c.mentioned).length, prev.length); tiles.push(kpi({ label: "Named in AI answers", desc: "When customers ask ChatGPT, Claude or Gemini about what you sell, how often you're named", value: pct(v), d: delta(v, vp, { pp: true }), source: `${num(cur.filter((c) => c.mentioned).length)} of ${num(cur.length)} answers we checked` })); }
    if (ea) tiles.push(kpi({ label: "Sales from email", desc: "Orders credited to your emails, last 90 days", value: money(ea.metrics?.email_revenue_90d), source: `${pct(ea.metrics?.email_share, 0)} of store sales · Klaviyo` }));
    if (gads) { const sp = sumKey(gads.rows, P.start, P.end, "cost"), cv = sumKey(gads.rows, P.start, P.end, "conversions"); tiles.push(kpi({ label: "Google Ads", desc: "Spend and results in this period", value: money(sp), source: fin(cv) ? `${num(cv)} conversions` : "Google Ads" })); }
    if (!tiles.length) tiles.push(kpi({ label: "Changes confirmed live", desc: "Work we published and verified on your public site", value: num(shipped(P.start, P.end)), d: delta(shipped(P.start, P.end), shipped(P.prevStart, P.prevEnd)), source: "Checked on the live page" }));

    // What changed, in plain sentences.
    const said = [];
    if (shop) { const { r, rp } = storeNums(shop); if (fin(r) && fin(rp) && rp > 0) said.push(`Store sales are ${r >= rp ? "up" : "down"} ${Math.abs(Math.round(100 * (r - rp) / rp))}% versus the previous ${state.days} days.`); }
    const mv = questionsMoved(ai); if (mv.won.length) said.push(`AI assistants started naming you for ${mv.won.length === 1 ? `“${mv.won[0]}”` : `${mv.won.length} customer questions`} this week.`); if (mv.lost.length) said.push(`You dropped out of AI answers for ${mv.lost.length === 1 ? `“${mv.lost[0]}”` : `${mv.lost.length} questions`}; open the AI visibility report to review the change.`);
    const top = brandShare(cur, s.name).find((b) => !b.own && b.n); if (top) said.push(`${top.name} is the business AI names most often in your market (${pct(top.share, 0)} of answers).`);
    if (shipped(P.start, P.end)) said.push(`${shipped(P.start, P.end)} ${shipped(P.start, P.end) === 1 ? "change was" : "changes were"} published and confirmed on your site. Results are measured from here; publishing alone doesn't prove growth.`);
    const changed = said.length ? `<ul class="dx-changed">${said.slice(0, 4).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";

    const pending = [["Google Search Console", search.length], ["Google Analytics", ga], ["Google Ads", gads]].filter(([, on]) => !on).map(([k]) => k);
    const coming = pending.length ? `<p class="dx-coming">${ic("plug", 14)}<span>${esc(pending.join(", ").replace(/, ([^,]*)$/, " and $1"))} ${pending.length === 1 ? "has" : "have"} no reporting data available here. Your team can check the connection and reporting setup.</span>${ctx.isAdmin ? `<a href="${ctx.href("connections")}">Connections ${ic("chev", 13)}</a>` : ""}</p>` : "";

    const reports = [["visibility", "AI visibility report", cur.length], ["traffic", "Google search", search.length || ga], ["email", "Email", ea], ["leadgen", "Leads & ads", gads || (ctx.d?.leads || []).length], ["growth", "Full results report", true]].filter(([, , on]) => on);
    const rep = `<details class="collective-reports"><summary>Explore your reports</summary><nav class="dx-reports" aria-label="Reports"><span>Connected reports</span>${reports.map(([p, l]) => `<a href="${ctx.href(p)}">${esc(l)} ${ic("chev", 13)}</a>`).join("")}<a href="${ctx.href("ask")}">${ic("visibility", 14)} Ask Samaritan for a report</a></nav></details>`;

    return head(ctx, "Overview", "Your results, your priorities, and the work behind them.") + ask +
      `<section class="dx-sec"><div class="dx-sec-head"><div><h2>How your marketing is doing</h2><p>${esc(rangeText(P))} · only from tools that are connected</p></div></div>${changed ? `<div class="dx-card dx-pad">${changed}</div>` : ""}<div class="dx-kpis${tiles.length === 3 ? " three" : ""}">${tiles.join("")}</div>${coming}</section>` +
      panel("What your team is doing", "Recent work and checks on your business", team + doingBody, { right: `<a class="dx-link" href="${ctx.href("work")}">Work history ${ic("chev", 14)}</a>` }) +
      panel("Confirmed live this period", "Changes and content published and checked on your public site", receipts(work, pubs, P, 6), { right: `<a class="dx-link" href="${ctx.href("work")}">Everything ${ic("chev", 14)}</a>` }) + savedPanel(ctx) + rep;
  }
  // Answers saved from Samaritan: findable here instead of in old chat history.
  function savedPanel(ctx) {
    const rows = ctx.saved || [];
    if (!rows.length) return "";
    const plain = (t) => String(t || "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^#+\s*/gm, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    const item = (x) => `<li class="dx-saved-i"><details><summary><b>${esc(x.title)}</b><time>${esc(new Date(x.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }))}</time></summary><div class="dx-saved-body">${plain(x.body).split(/\n+/).filter(Boolean).map((l) => /^\s*[-*]\s+/.test(l) ? `<p class="li">${esc(l.replace(/^\s*[-*]\s+/, ""))}</p>` : `<p>${esc(l)}</p>`).join("")}<div class="dx-saved-acts"><a href="${ctx.href("ask")}">Ask a follow-up ${ic("chev", 13)}</a><button type="button" data-saved-del="${esc(x.id)}">Remove</button></div></div></details></li>`;
    return panel("Saved from Samaritan", "Answers you saved, so you don't have to dig through old conversations", `<ul class="dx-saved">${rows.slice(0, 6).map(item).join("")}</ul>`, { right: `<a class="dx-link" href="${ctx.href("ask")}">Ask Samaritan ${ic("chev", 14)}</a>` });
  }
  const enginesSaid = (rows) => { const e = [...new Set(rows.map((c) => engineName(c.engine)))]; return e.length > 2 ? e.slice(0, -1).join(", ") + " and " + e.at(-1) : e.join(" and "); };
  function leadsKpi(ctx, P) {
    const ads = ["google_ads", "meta_ads"].map((k) => reportOf(ctx.snap, k)).filter(Boolean);
    const recorded = (ctx.d.leads || []).filter((l) => l.created_at);
    if (!ads.length && !recorded.length) return kpi({ label: "Leads", desc: "Enquiries from your campaigns", connect: { text: "No ad account or lead source connected", cta: "Connect", href: ctx.href("connections") } });
    const v = (a, b) => ads.reduce((n, p) => n + (sumKey(p.rows, a, b, "leads") || 0), 0) + recorded.filter((l) => inP(String(l.created_at).slice(0, 10), a, b)).length;
    return kpi({ label: "Leads", desc: "Enquiries from your campaigns", value: num(v(P.start, P.end)), d: delta(v(P.start, P.end), v(P.prevStart, P.prevEnd)), source: "Ad platforms + recorded leads" });
  }
  const rangeText = (P) => `${short(P.start)} – ${short(P.end)}`;
  function rankList(rank, prev) {
    if (!rank.length || !rank.some((b) => b.n)) return `<p class="dx-muted-t">No brands were named in this period.</p>`;
    return `<ol class="dx-rank">${rank.map((b, i) => `<li class="${b.own ? "own" : ""}"><span class="n">${i + 1}</span>${avatar(b.name)}<span class="nm">${esc(b.name)}${b.own ? ' <em>You</em>' : ""}</span><span class="v">${pct(b.share, 0)}</span>${delta(b.share, prev.get(b.name), { pp: true })}</li>`).join("")}</ol>`;
  }
  function engineTable(cur, prev) {
    const engines = [...new Set([...cur, ...prev].map((c) => c.engine))];
    if (!engines.length) return empty("No AI answers sampled yet", "Your agents ask AI assistants the questions your customers ask. Results appear after the first check.", null);
    const rows = engines.map((e) => { const a = cur.filter((c) => c.engine === e), b = prev.filter((c) => c.engine === e); return { e, n: a.length, named: ratio(a.filter((c) => c.mentioned).length, a.length), namedPrev: ratio(b.filter((c) => c.mentioned).length, b.length), cited: ratio(a.filter((c) => c.cited).length, a.length), last: a.map((c) => c.checked_at).sort().at(-1) || b.map((c) => c.checked_at).sort().at(-1) }; }).sort((x, y) => y.n - x.n);
    const max = Math.max(1, ...rows.map((r) => r.n));
    return `<div class="dx-table-wrap"><table class="dx-table"><thead><tr><th>Engine</th><th>Answers</th><th>Named you</th><th>Change</th><th>Linked your site</th><th class="r">Last checked</th></tr></thead><tbody>${rows.map((r) => `<tr><td><span class="dx-engine">${avatar(engineName(r.e))}${esc(engineName(r.e))}</span></td><td><span class="dx-num-bar">${num(r.n)}${bar(r.n, max)}</span></td><td>${pct(r.named)}</td><td>${delta(r.named, r.namedPrev, { pp: true })}</td><td>${pct(r.cited)}</td><td class="r dx-muted-t">${esc(ago(r.last))}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function trafficSources(ctx, P) {
    const ga = reportOf(ctx.snap, "ga4");
    if (!ga) return empty("Connect Google Analytics", "See visits by channel (organic, AI assistants, direct, referral) and by city or country.", { href: ctx.href("connections"), label: "Connect Analytics" });
    const map = new Map();
    for (const r of ga.sources || []) { if (!r.date || !inP(r.date, P.prevStart, P.end) || !fin(r.sessions)) continue; const k = r.sessionDefaultChannelGroup || r.sessionSourceMedium || "Unassigned", v = map.get(k) || { k, cur: 0, prev: 0 }; if (r.date >= P.start) v.cur += Number(r.sessions); else v.prev += Number(r.sessions); map.set(k, v); }
    const rows = [...map.values()].sort((a, b) => b.cur - a.cur).slice(0, 8), max = Math.max(1, ...rows.map((r) => r.cur)), total = rows.reduce((n, r) => n + r.cur, 0);
    if (!rows.length) return `<p class="dx-muted-t">Google Analytics returned no sessions in this period.</p>`;
    return `<div class="dx-table-wrap"><table class="dx-table compact"><thead><tr><th>Channel</th><th>Sessions</th><th>Share</th><th class="r">Change</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.k)}</td><td><span class="dx-num-bar">${num(r.cur)}${bar(r.cur, max)}</span></td><td>${pct(ratio(r.cur, total), 0)}</td><td class="r">${delta(r.cur, r.prev)}</td></tr>`).join("")}</tbody></table></div><p class="dx-foot">Google Analytics · ${esc(ga.property_name || "")} · sessions are visits, not unique people.</p>`;
  }
  function receipts(work, pubs, P, limit = 50) {
    const rows = [...work.filter((w) => inP(String(w.deployed_at).slice(0, 10), P.start, P.end)).map((w) => ({ at: w.deployed_at, kind: { "seo.title": "Search title", "seo.description": "Search description", "image.alt": "Image description" }[w.field] || "Website change", title: w.page_name || w.url, url: w.verification?.url || w.url })),
      ...pubs.filter((p) => inP(String(p.published_at).slice(0, 10), P.start, P.end)).map((p) => ({ at: p.published_at, kind: p.draft_id && p.url ? "Answer section" : "Article", title: p.title, url: p.verification?.url || p.url }))].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    if (!rows.length) return `<p class="dx-muted-t dx-pad">Nothing was confirmed live in this period.</p>`;
    return `<ul class="dx-receipts">${rows.slice(0, limit).map((r) => `<li><span class="dx-ok">${ic("check", 14)}</span><div><b>${esc(String(r.title || "").slice(0, 110))}</b><small>${esc(r.kind)} · confirmed live · ${esc(short(String(r.at).slice(0, 10)))}</small></div>${r.url && /^https?:/.test(r.url) ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="Open live page">${ic("link", 15)}</a>` : ""}</li>`).join("")}</ul>${rows.length > limit ? `<p class="dx-foot">${rows.length - limit} more in the work log.</p>` : ""}`;
  }

  function traffic(ctx) {
    const { snap } = ctx, search = snap?.search || [], conn = ctx.href("connections");
    const sEnd = search.length ? search.map((r) => r.date).sort().at(-1) : null, P = periods(sEnd || today(), state.days);
    const ga = reportOf(snap, "ga4");
    let body = "";
    if (!sEnd) body += `<section class="dx-sec">${`<div class="dx-card">${empty("Connect Google Search Console", "Organic traffic, impressions, click-through rate and average position, plus the queries and pages that earn them, appear once Search Console is connected. Your agents also use it to protect the words each page already ranks for.", { href: conn, label: "Connect Search Console" })}</div>`}</section>`;
    else {
      const k = (key) => sumKey(search, P.start, P.end, key), kp = (key) => sumKey(search, P.prevStart, P.prevEnd, key);
      const ctr = ratio(k("clicks"), k("impressions")), ctrP = ratio(kp("clicks"), kp("impressions"));
      const pos = (a, b) => { const r = search.filter((x) => inP(x.date, a, b) && fin(x.position) && fin(x.impressions)); const w = r.reduce((n, x) => n + Number(x.impressions), 0); return w ? r.reduce((n, x) => n + Number(x.position) * Number(x.impressions), 0) / w : null; };
      const cov = daysWith(search, P.start, P.end);
      body += `<section class="dx-sec"><div class="dx-sec-head"><div><h2>Summary</h2><p>${esc(rangeText(P))} · Search Console reports with a 2–3 day delay · ${cov}/${state.days} days reported</p></div></div><div class="dx-kpis">${kpi({ label: "Organic clicks", desc: "Visits from Google search", value: num(k("clicks")), d: delta(k("clicks"), kp("clicks")) })}${kpi({ label: "Impressions", desc: "Times you appeared in results", value: num(k("impressions")), d: delta(k("impressions"), kp("impressions")) })}${kpi({ label: "Click-through rate", desc: "Clicks ÷ impressions", value: pct(ctr), d: delta(ctr, ctrP, { pp: true }) })}${kpi({ label: "Average position", desc: "Lower is better", value: num(pos(P.start, P.end), 1), d: delta(pos(P.start, P.end), pos(P.prevStart, P.prevEnd), { invert: true }) })}</div></section>`;
      body += panel("Organic traffic over time", "Clicks from Google search, compared with the previous period", chart([{ name: "Clicks", points: bucket(search, P.start, state.days, "clicks") }, ...(state.compare ? [{ name: "Previous period", dashed: true, color: "var(--dx-muted)", points: bucket(search, P.prevStart, state.days, "clicks") }] : [])]));
      const top = (rows, key, label) => { const r = (rows || []).slice(0, 12), max = Math.max(1, ...r.map((x) => Number(x.clicks) || 0)); return r.length ? `<div class="dx-table-wrap"><table class="dx-table"><thead><tr><th>${label}</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th class="r">Position</th></tr></thead><tbody>${r.map((x) => `<tr><td class="dx-wrap">${esc(key === "page" ? String(x.page).replace(/^https?:\/\/[^/]+/, "") || "/" : x.query)}</td><td><span class="dx-num-bar">${num(x.clicks)}${bar(Number(x.clicks) || 0, max)}</span></td><td>${num(x.impressions)}</td><td>${pct(x.ctr)}</td><td class="r">${num(x.position, 1)}</td></tr>`).join("")}</tbody></table></div><p class="dx-foot">Last 28 days reported by Google. Anonymised queries are not listed.</p>` : `<p class="dx-muted-t dx-pad">No rows reported.</p>`; };
      body += `<div class="dx-two">${panel("Top queries", "What people searched before clicking", top(snap.queries, "query", "Query"))}${panel("Top pages", "Where those clicks landed", top(snap.pages, "page", "Page"))}</div>`;
    }
    body += panel("Traffic by source", "All website visits by channel, including AI assistants", trafficSources(ctx, periods(today(), state.days)));
    return head(ctx, "Search traffic", "Organic search performance from Google, and where all your visits come from.") + body;
  }

  function visibility(ctx) {
    ctx.ai = true;
    const { s, snap, ev } = ctx, end = today(), P = periods(end, state.days), ai = aiRows(snap), cur = aiPeriod(ai, P.start, P.end), prev = aiPeriod(ai, P.prevStart, P.prevEnd);
    const vis = ratio(cur.filter((c) => c.mentioned).length, cur.length), visPrev = ratio(prev.filter((c) => c.mentioned).length, prev.length);
    const cite = ratio(cur.filter((c) => c.cited).length, cur.length), citePrev = ratio(prev.filter((c) => c.cited).length, prev.length);
    const posRows = cur.filter((c) => fin(c.position)), posPrev = prev.filter((c) => fin(c.position));
    const avgPos = posRows.length ? posRows.reduce((n, c) => n + Number(c.position), 0) / posRows.length : null, avgPosP = posPrev.length ? posPrev.reduce((n, c) => n + Number(c.position), 0) / posPrev.length : null;
    const prompts = new Set(cur.map((c) => c.prompt)).size;
    const kpis = `<div class="dx-kpis">${kpi({ label: "Visibility score", desc: "Answers that name your business", value: pct(vis), d: delta(vis, visPrev, { pp: true }) })}${kpi({ label: "Citation rate", desc: "Answers that link to your site", value: pct(cite), d: delta(cite, citePrev, { pp: true }) })}${kpi({ label: "Average position", desc: "Where you appear when named (1 = first)", value: num(avgPos, 1), d: delta(avgPos, avgPosP, { invert: true }) })}${kpi({ label: "Questions tracked", desc: "Customer questions asked each check", value: num(prompts), source: `${num(cur.length)} answers in this period` })}</div>`;
    const series = [{ name: "Named you", connect: true, points: rateSeries(aiDaily(cur, "mentioned"), P.start, state.days) }, { name: "Linked your site", connect: true, color: "var(--dx-c2)", points: rateSeries(aiDaily(cur, "cited"), P.start, state.days) }];
    if (state.compare) series.push({ name: "Named you · previous period", connect: true, dashed: true, color: "var(--dx-muted)", points: rateSeries(aiDaily(prev, "mentioned"), P.prevStart, state.days) });
    // Prompt table: latest answer per prompt/engine in the period.
    const latest = new Map(); for (const c of cur.slice().sort((a, b) => String(a.checked_at).localeCompare(String(b.checked_at)))) latest.set(c.prompt + "\n" + c.engine, c);
    const byPrompt = new Map(); for (const c of latest.values()) { const v = byPrompt.get(c.prompt) || { prompt: c.prompt, rows: [] }; v.rows.push(c); byPrompt.set(c.prompt, v); }
    const evMap = new Map((ev?.prompts || []).map((p) => [p.prompt, p]));
    const list = [...byPrompt.values()].map((p) => ({ ...p, named: p.rows.filter((c) => c.mentioned).length, cited: p.rows.filter((c) => c.cited).length, rivals: [...new Set(p.rows.flatMap((c) => c.competitors || []))], ev: evMap.get(p.prompt) })).sort((a, b) => a.named - b.named || b.rivals.length - a.rivals.length);
    const promptTable = list.length ? `<div class="dx-table-wrap"><table class="dx-table"><thead><tr><th>Customer question</th><th>Engines</th><th>Named you</th><th>Linked you</th><th>Named instead</th><th class="r">Your page</th></tr></thead><tbody>${list.slice(0, 40).map((p) => `<tr><td class="dx-wrap"><b class="dx-q">${esc(p.prompt)}</b>${p.ev?.category ? `<small class="dx-muted-t">${esc(p.ev.category)}</small>` : ""}</td><td>${p.rows.map((c) => `<span class="dx-eng ${c.mentioned ? "hit" : ""}" title="${esc(engineName(c.engine))}: ${c.mentioned ? "named you" : "did not name you"}">${esc(ENGINE_SHORT[String(c.engine).toLowerCase()] || engineName(c.engine).slice(0, 2))}</span>`).join("")}</td><td>${p.named}/${p.rows.length}</td><td>${p.cited}/${p.rows.length}</td><td class="dx-wrap dx-muted-t">${esc(p.rivals.slice(0, 3).join(", ") || "—")}</td><td class="r">${p.ev?.yours?.url ? `<a class="dx-link" href="${esc(p.ev.yours.url)}" target="_blank" rel="noopener">${esc(p.ev.yours.stage || "Page")} ${ic("link", 13)}</a>` : `<span class="dx-muted-t">—</span>`}</td></tr>`).join("")}</tbody></table></div>${list.length > 40 ? `<p class="dx-foot">Showing 40 of ${list.length} questions, weakest first.</p>` : ""}` : empty("No answers in this period", "Choose a longer range, or wait for the next AI check.", null);
    return head(ctx, "AI visibility", "How ChatGPT, Claude and other assistants answer your customers' questions, and whether they recommend you.") +
      `<section class="dx-sec"><div class="dx-sec-head"><div><h2>Visibility score</h2><p>${esc(rangeText(P))} · sampled answers, not every AI conversation</p></div></div>${kpis}</section>` +
      panel("Visibility over time", "Share of answers that named you or linked your website", chart(series, { fmt: (v) => pct(v, 0), yMax: 1 })) +
      panel("Citations & mentions by engine", "", engineTable(cur, prev)) +
      panel("Customer questions", "Weakest first: where you're missing, and who is named instead", promptTable);
  }

  function citations(ctx) {
    ctx.ai = true;
    const { s, snap } = ctx, end = today(), P = periods(end, state.days), ai = aiRows(snap), cur = aiPeriod(ai, P.start, P.end), prev = aiPeriod(ai, P.prevStart, P.prevEnd);
    const rivals = [...new Set(ai.flatMap((c) => c.competitors || []))], own = host("https://" + String(s.domain).replace(/^https?:\/\//, ""));
    const A = citationStats(cur, own, rivals), B = citationStats(prev, own, rivals), prevShare = new Map(B.list.map((x) => [x.domain, x.share]));
    if (!A.total) return head(ctx, "Citations", "The websites AI assistants cite when they answer your customers.") + `<section class="dx-sec"><div class="dx-card">${empty("No citations in this period", "AI answers with sources appear here after the next check. Try a longer date range.", null)}</div></section>`;
    const order = ["Owned", "Competition", "Earned", "Directory", "Social", "Marketplace", "Other"].filter((k) => A.cats[k]);
    const seg = `<div class="dx-cats">${order.map((k) => `<div class="dx-cat ${CAT[k]}" style="flex:${Math.max(A.cats[k] / A.total, 0.045)}"><b>${pct(A.cats[k] / A.total)}</b><span>${esc(k)}</span></div>`).join("")}</div><p class="dx-foot">${num(A.total)} cited sources across ${num(cur.length)} answers. <b>Owned</b> is your site, <b>Competition</b> is a brand AI named instead of you, <b>Earned</b> is independent editorial coverage, <b>Directory</b> is listings like Google and Yelp.</p>`;
    const max = A.list[0]?.n || 1;
    const top = `<div class="dx-table-wrap"><table class="dx-table"><thead><tr><th>Rank</th><th>Domain</th><th>Category</th><th>Citations</th><th>Share</th><th class="r">Change</th></tr></thead><tbody>${A.list.slice(0, 25).map((x, i) => `<tr class="${x.cat === "Owned" ? "own" : ""}"><td class="dx-muted-t">${i + 1}</td><td><span class="dx-engine">${avatar(x.domain)}${esc(x.domain)}</span></td><td>${tag(x.cat)}</td><td><span class="dx-num-bar">${num(x.n)}${bar(x.n, max)}</span></td><td>${pct(x.share)}</td><td class="r">${delta(x.share, prevShare.get(x.domain) ?? (B.total ? 0 : null), { pp: true })}</td></tr>`).join("")}</tbody></table></div>`;
    const ownRow = A.list.find((x) => x.cat === "Owned");
    return head(ctx, "Citations", "The websites AI assistants cite when they answer your customers. Earn a place on these sources, and make your own pages the one they cite.") +
      `<section class="dx-sec"><div class="dx-sec-head"><div><h2>Citation categories</h2><p>${esc(rangeText(P))} · breakdown of every cited source</p></div></div><div class="dx-card dx-pad">${seg}</div></section>` +
      `<section class="dx-sec"><div class="dx-kpis three">${kpi({ label: "Your site's share", desc: "Citations pointing to your own pages", value: pct(ownRow?.share || 0), d: delta(ownRow?.share || 0, B.total ? (B.list.find((x) => x.cat === "Owned")?.share || 0) : null, { pp: true }) })}${kpi({ label: "Cited sources", desc: "Unique websites AI relied on", value: num(A.list.length) })}${kpi({ label: "Competitor citations", desc: "Share pointing to rival brands", value: pct((A.cats.Competition || 0) / A.total), d: delta((A.cats.Competition || 0) / A.total, B.total ? (B.cats.Competition || 0) / B.total : null, { pp: true, invert: true }) })}</div></section>` +
      panel("Top citation domains", "The websites cited most often in AI answers about your market", top);
  }

  function benchmarks(ctx) {
    ctx.ai = true;
    const { s, snap } = ctx, end = today(), P = periods(end, state.days), ai = aiRows(snap), cur = aiPeriod(ai, P.start, P.end), prev = aiPeriod(ai, P.prevStart, P.prevEnd);
    const rank = brandShare(cur, s.name), prevMap = new Map(brandShare(prev, s.name).map((b) => [b.name, b.share]));
    const top = rank.filter((b) => b.n).slice(0, 8), max = Math.max(...top.map((b) => b.share || 0), 0.01);
    const sov = top.length ? `<div class="dx-sov">${top.map((b, i) => `<div class="dx-sov-row ${b.own ? "own" : ""}"><span class="n">${i + 1}</span><span class="nm">${avatar(b.name)}${esc(b.name)}${b.own ? " <em>You</em>" : ""}</span><span class="dx-sov-bar"><i style="width:${(100 * (b.share || 0)) / max}%"></i></span><span class="v">${pct(b.share, 0)}</span>${delta(b.share, prevMap.get(b.name), { pp: true })}</div>`).join("")}</div>` : empty("No brands named yet", "Benchmarks appear after AI answers are sampled.", null);
    const engines = [...new Set(cur.map((c) => c.engine))];
    const matrix = top.length && engines.length ? `<div class="dx-table-wrap"><table class="dx-table"><thead><tr><th>Brand</th>${engines.map((e) => `<th>${esc(engineName(e))}</th>`).join("")}</tr></thead><tbody>${top.slice(0, 6).map((b) => `<tr class="${b.own ? "own" : ""}"><td><span class="dx-engine">${avatar(b.name)}${esc(b.name)}</span></td>${engines.map((e) => { const rows = cur.filter((c) => c.engine === e), n = rows.filter((c) => (b.own ? c.mentioned : (c.competitors || []).includes(b.name))).length, v = ratio(n, rows.length); return `<td><span class="dx-heat" style="--h:${v || 0}">${pct(v, 0)}</span></td>`; }).join("")}</tr>`).join("")}</tbody></table></div>` : "";
    const geo = reportOf(snap, "gsc_geo");
    let geoBlock;
    if (!geo) geoBlock = empty("Connect Google Search Console", "Search performance by country and the markets you're winning or losing appear after Search Console syncs.", { href: ctx.href("connections"), label: "Connect Search Console" });
    else {
      const gEnd = (geo.rows || []).map((r) => r.date).filter(Boolean).sort().at(-1) || geo.end_date, GP = periods(gEnd, Math.min(state.days, 28)), m = new Map();
      for (const r of geo.rows || []) { if (!r.date || !fin(r.clicks)) continue; const k = r.country || "Unknown", v = m.get(k) || { k, cur: 0, prev: 0, imp: 0 }; if (inP(r.date, GP.start, GP.end)) { v.cur += Number(r.clicks); v.imp += Number(r.impressions) || 0; } else if (inP(r.date, GP.prevStart, GP.prevEnd)) v.prev += Number(r.clicks); m.set(k, v); }
      const rows = [...m.values()].sort((a, b) => b.cur - a.cur).slice(0, 12), gm = Math.max(1, ...rows.map((r) => r.cur));
      geoBlock = rows.length ? `<div class="dx-table-wrap"><table class="dx-table"><thead><tr><th>Country</th><th>Clicks</th><th>Impressions</th><th class="r">Change</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(countryName(r.k))}</td><td><span class="dx-num-bar">${num(r.cur)}${bar(r.cur, gm)}</span></td><td>${num(r.imp)}</td><td class="r">${delta(r.cur, r.prev)}</td></tr>`).join("")}</tbody></table></div><p class="dx-foot">Search Console · ${esc(short(GP.start))} – ${esc(short(GP.end))}. Country totals can differ slightly from the overall report.</p>` : `<p class="dx-muted-t dx-pad">No country rows reported.</p>`;
    }
    return head(ctx, "Benchmarks", "How you compare with the brands customers weigh you against, and where your search demand comes from.") +
      panel("Share of voice in AI answers", "Share of sampled answers that name each brand", sov) +
      (matrix ? panel("By engine", "Each brand's visibility on each AI assistant", matrix) : "") +
      panel("Performance by geography", "Organic search clicks by country", geoBlock);
  }
  const countryName = (c) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(String(c).toUpperCase().slice(0, 2)) || c; } catch { return c; } };

  function leadgen(ctx) {
    const { snap } = ctx, conn = ctx.href("connections");
    const ads = [["google_ads", "Google Ads"], ["meta_ads", "Meta Ads"]].map(([k, l]) => ({ k, l, p: reportOf(snap, k) })).filter((x) => x.p);
    const end = ads.map((x) => (x.p.rows || []).map((r) => r.date).sort().at(-1)).filter(Boolean).sort().at(-1) || today(), P = periods(end, state.days);
    const tot = (key, a, b) => { const v = ads.map((x) => sumKey(x.p.rows, a, b, key)).filter(fin); return v.length ? v.reduce((m, n) => m + n, 0) : null; };
    const cur = (k) => tot(k, P.start, P.end), prv = (k) => tot(k, P.prevStart, P.prevEnd), currency = ads[0]?.p.currency || "USD";
    let summary;
    if (!ads.length) summary = `<div class="dx-card">${empty("Connect Google Ads", "Leads, clicks, impressions, click-through rate and cost per lead appear here once an ad account is connected. Your marketers review every budget change.", { href: conn, label: "Connect an ad account" })}</div>`;
    else {
      const leads = cur("leads"), spend = cur("spend"), cpl = ratio(spend, leads), cplP = ratio(prv("spend"), prv("leads")), ctr = ratio(cur("clicks"), cur("impressions")), ctrP = ratio(prv("clicks"), prv("impressions"));
      const bookings = cur("bookings"), cpb = ratio(spend, bookings), cpbP = ratio(prv("spend"), prv("bookings"));
      summary = `<div class="dx-kpis">${kpi({ label: "Leads", desc: ads.map((x) => x.p.lead_label).filter(Boolean)[0] || "Tracked lead conversions", value: num(leads), d: delta(leads, prv("leads")) })}${kpi({ label: "Cost per lead", desc: "Spend ÷ leads", value: money(cpl, currency), d: delta(cpl, cplP, { invert: true }) })}${kpi({ label: "Clicks", desc: "Ad clicks", value: num(cur("clicks")), d: delta(cur("clicks"), prv("clicks")) })}${kpi({ label: "Click-through rate", desc: "Clicks ÷ impressions", value: pct(ctr, 2), d: delta(ctr, ctrP, { pp: true }) })}</div><div class="dx-kpis" style="margin-top:12px">${kpi({ label: "Impressions", desc: "Times your ads were shown", value: num(cur("impressions")), d: delta(cur("impressions"), prv("impressions")) })}${kpi({ label: "Cost per booking", desc: "Spend ÷ bookings", value: bookings ? money(cpb, currency) : "—", d: bookings ? delta(cpb, cpbP, { invert: true }) : "", source: bookings ? "" : "Choose a booking action in account settings" })}${kpi({ label: "Ad spend", desc: "Provider-reported", value: money(spend, currency), d: delta(spend, prv("spend")) })}${kpi({ label: "Bookings", desc: "Tracked booking conversions", value: num(bookings) })}</div>`;
    }
    const cmp = (k) => (state.compare ? [{ name: "Previous period", dashed: true, color: "var(--dx-muted)", points: bucketMerged(ads, P.prevStart, k) }] : []);
    const daily = ads.length ? `<div class="dx-two">${panel("Leads over time", rangeText(P), chart([{ name: "Leads", points: bucketMerged(ads, P.start, "leads") }, ...cmp("leads")], { height: 200 }))}${panel("Clicks over time", rangeText(P), chart([{ name: "Clicks", color: "var(--dx-c2)", points: bucketMerged(ads, P.start, "clicks") }, ...cmp("clicks")], { height: 200 }))}</div>` : "";
    const bench = ads.some((x) => fin(x.p.impression_share)) ? "" : `<p class="dx-muted-t dx-pad">Competitor benchmarks (impression share and who outranks you in the auction) appear after a Google Ads sync with auction insights. Until then, compare your organic and AI visibility in <a class="dx-link" href="${ctx.href("benchmarks")}">Benchmarks</a>.</p>`;
    return head(ctx, "Lead generation", "Campaign structure, keywords and the leads they bring in. Budgets and launches stay with your marketers.") +
      `<section class="dx-sec"><div class="dx-sec-head"><div><h2>Summary</h2><p>${ads.length ? esc(rangeText(P)) + " · " + ads.map((x) => x.l).join(" + ") : "No ad account connected"}</p></div></div>${summary}</section>` + daily +
      panel("Competition", "How your ads compare in the auction", bench || "") +
      `<section class="dx-sec"><div class="dx-sec-head"><div><h2>Campaign plan</h2><p>2–3 ad groups, 7–8 keywords each and negative keywords. Edit anything before approval.</p></div></div><div class="dx-legacy">${ctx.leadgenHTML || ""}</div></section>`;
  }
  function bucketMerged(ads, start, key) { const m = new Map(); for (const x of ads) for (const r of x.p.rows || []) if (r.date && fin(r[key])) m.set(r.date, (m.get(r.date) || 0) + Number(r[key])); return bucket([...m.entries()].map(([date, v]) => ({ date, [key]: v })), start, state.days, key); }

  function work(ctx) {
    const { snap } = ctx, P = periods(today(), state.days);
    const work = (snap?.work || []).filter((w) => w.status === "deployed" && w.verification?.state === "verified");
    const pubs = [...(snap?.publications || []), ...(snap?.page_publications || [])].filter((p) => p.status === "published" && p.verification?.state === "verified");
    const n = (a, b, list, key) => list.filter((x) => inP(String(x[key]).slice(0, 10), a, b)).length;
    const opps = (ctx.opps || []).filter((o) => o.stage !== "dismissed");
    const row = (o) => { const st = STAGE[o.stage] || ["In progress", "work"], r = o.result?.ai, ev = o.evidence || {};
      const res = r ? `Measured: named in ${r.named} of ${r.total} answers after publishing${fin(ev.total) ? ` (was ${ev.named} of ${ev.total})` : ""}.` : o.stage === "live" ? "Live. Results are measured at the next check; publishing alone doesn't prove growth." : "";
      return `<li><span class="dx-now-dot ${st[1]}"></span><div><span class="dx-now-tag ${st[1]}">${esc(st[0])}</span><b>${esc(String(o.title).slice(0, 140))}</b>${o.why ? `<small>${esc(String(o.why).split(/(?<=\.)\s/)[0].slice(0, 200))}</small>` : ""}${res ? `<small class="dx-res">${esc(res)}</small>` : ""}</div><span class="dx-now-at">${esc(ago(o.updated_at || o.created_at))}</span>${o.stage === "ready" ? `<a class="dx-now-go" href="${ctx.href("inbox")}" aria-label="Review">${ic("chev", 14)}</a>` : "<span></span>"}</li>`; };
    const open = opps.filter((o) => ["drafting", "ready", "approved", "blocked"].includes(o.stage)), done = opps.filter((o) => ["live", "measured"].includes(o.stage));
    const kp = `<div class="dx-kpis three">${kpi({ label: "In progress", desc: "Being prepared or waiting for approval", value: num(open.length) })}${kpi({ label: "Changes confirmed live", desc: "Published and read back from your public site", value: num(n(P.start, P.end, work, "deployed_at") + n(P.start, P.end, pubs, "published_at")), d: delta(n(P.start, P.end, work, "deployed_at") + n(P.start, P.end, pubs, "published_at"), n(P.prevStart, P.prevEnd, work, "deployed_at") + n(P.prevStart, P.prevEnd, pubs, "published_at")) })}${kpi({ label: "Being measured", desc: "Live work we're tracking results for", value: num(done.length) })}</div>`;
    return head(ctx, "Work history", "Everything your team prepared, what you approved, and what went live on your site.", { extra: "" }) +
      `<section class="dx-sec"><div class="dx-sec-head"><div><h2>At a glance</h2><p>${esc(rangeText(P))}</p></div></div>${kp}</section>` +
      panel("In progress", "Work being prepared, waiting for you, or with your team", open.length ? `<ul class="dx-now">${open.map(row).join("")}</ul>` : `<p class="dx-muted-t dx-pad">Nothing in progress right now. New work appears here as soon as your team starts it.</p>`) +
      (done.length ? panel("Live and measured", "What happened after it went live", `<ul class="dx-now">${done.map(row).join("")}</ul>`) : "") +
      panel("Confirmed on your site", "Newest first. Each change was read back from your public website.", receipts(work, pubs, P, 15).replace(/<p class="dx-foot">\d+ more in the work log\.<\/p>/, "") + (n(P.start, P.end, work, "deployed_at") + n(P.start, P.end, pubs, "published_at") > 15 ? `<details class="dx-more"><summary>Show all</summary>${receipts(work, pubs, P, 500)}</details>` : ""));
  }


  // ---------- Sentiment & FactCheck (claims extracted from AI answers about the business) ----------
  function claimRows(ctx, a, b) { return (ctx.claims || []).filter((c) => (state.engine === "all" || c.engine === state.engine) && inP(String(c.at).slice(0, 10), a, b)); }
  function claimsEmpty(ctx, title) {
    if (ctx.claims === undefined) return `<div class="dx-card">${empty("Loading", "Reading what AI assistants say about you.", null)}</div>`;
    return `<div class="dx-card">${empty(title, "Samaritan reads every AI answer that mentions you and records each claim, its tone and whether it matches your business facts. Results appear after the next daily analysis.", null)}</div>`;
  }
  function themes(rows) {
    const m = new Map(); for (const c of rows) { const v = m.get(c.theme) || { theme: c.theme, n: 0, pos: 0, neg: 0, neu: 0, bad: 0, claims: [] }; v.n++; v[c.sentiment === "positive" ? "pos" : c.sentiment === "negative" ? "neg" : "neu"]++; if (c.verdict === "inaccurate") v.bad++; v.claims.push(c); m.set(c.theme, v); }
    return [...m.values()].sort((x, y) => y.n - x.n);
  }
  function sentiment(ctx) {
    const P = periods(today(), state.days), cur = claimRows(ctx, P.start, P.end), prev = claimRows(ctx, P.prevStart, P.prevEnd);
    ctx.ai = true;
    const h = head(ctx, "Sentiment", "Key themes AI assistants raise when they mention your business, and the tone behind them.");
    if (!cur.length) return h + claimsEmpty(ctx, "No claims recorded in this period");
    const pos = ratio(cur.filter((c) => c.sentiment === "positive").length, cur.length), posP = ratio(prev.filter((c) => c.sentiment === "positive").length, prev.length);
    const neg = ratio(cur.filter((c) => c.sentiment === "negative").length, cur.length), negP = ratio(prev.filter((c) => c.sentiment === "negative").length, prev.length);
    const T = themes(cur), TP = new Map(themes(prev).map((t) => [t.theme, t]));
    const kp = `<div class="dx-kpis three">${kpi({ label: "Positive sentiment", desc: "Claims that reflect well on you", value: pct(pos), d: delta(pos, posP, { pp: true }) })}${kpi({ label: "Negative sentiment", desc: "Claims that reflect badly on you", value: pct(neg), d: delta(neg, negP, { pp: true, invert: true }) })}${kpi({ label: "Claims recorded", desc: "Statements AI made about you", value: num(cur.length), d: delta(cur.length, prev.length) })}</div>`;
    const rows = T.map((t) => { const occ = t.n / cur.length, p = TP.get(t.theme), occP = p && prev.length ? p.n / prev.length : null, ps = t.pos / t.n, psP = p ? p.pos / p.n : null;
      return `<details class="dx-row"><summary><span class="dx-row-t"><b>${esc(t.theme)}</b><small>${t.n} claim${t.n === 1 ? "" : "s"}</small></span><span class="dx-row-c">${pct(occ)} ${delta(occ, occP, { pp: true })}</span><span class="dx-row-c">${pct(ps)} ${delta(ps, psP, { pp: true })}</span><span class="dx-senti"><i class="p" style="flex:${t.pos}"></i><i class="u" style="flex:${t.neu}"></i><i class="n" style="flex:${t.neg}"></i></span></summary><ul class="dx-claims">${t.claims.slice(0, 12).map((c) => `<li><span class="dx-tag ${c.sentiment === "positive" ? "owned" : c.sentiment === "negative" ? "comp" : "other"}">${esc(c.sentiment)}</span><span>${esc(c.claim)}</span><small>${esc(engineName(c.engine))} · “${esc(String(c.prompt || "").slice(0, 70))}”</small></li>`).join("")}</ul></details>`; }).join("");
    return h + `<section class="dx-sec"><div class="dx-sec-head"><div><h2>Summary</h2><p>${esc(rangeText(P))}</p></div></div>${kp}</section>` +
      panel("All themes", "Key concepts surfaced by AI when mentioning your brand and the sentiment behind them", `<div class="dx-rows"><div class="dx-row-head"><span>Theme</span><span>Occurrence</span><span>Positive sentiment</span><span></span></div>${rows}</div>`);
  }
  function factcheck(ctx) {
    const P = periods(today(), state.days), cur = claimRows(ctx, P.start, P.end), prev = claimRows(ctx, P.prevStart, P.prevEnd);
    ctx.ai = true;
    const h = head(ctx, "FactCheck", "False claims AI assistants make about you, checked against your verified business facts.");
    if (!cur.length) return h + claimsEmpty(ctx, "No claims to check in this period");
    const checked = cur.filter((c) => c.verdict !== "unverified"), acc = ratio(cur.filter((c) => c.verdict === "accurate").length, checked.length);
    const checkedP = prev.filter((c) => c.verdict !== "unverified"), accP = ratio(prev.filter((c) => c.verdict === "accurate").length, checkedP.length);
    const bad = cur.filter((c) => c.verdict === "inaccurate"), badP = prev.filter((c) => c.verdict === "inaccurate");
    const kp = `<div class="dx-kpis three">${kpi({ label: "Accuracy", desc: "Checkable claims that match your facts", value: pct(acc), d: delta(acc, accP, { pp: true }) })}${kpi({ label: "Inaccurate claims", desc: "Statements your facts contradict", value: num(bad.length), d: delta(bad.length, badP.length, { invert: true }) })}${kpi({ label: "Unverified", desc: "Claims your saved facts don't cover", value: num(cur.length - checked.length), source: "Add facts in Business details to check more" })}</div>`;
    const T = themes(bad), TP = new Map(themes(badP).map((t) => [t.theme, t]));
    const groups = T.length ? T.map((t, i) => { const occ = t.n / cur.length, p = TP.get(t.theme), occP = p && prev.length ? p.n / prev.length : null;
      const by = new Map(); for (const c of t.claims) { const k = c.claim.toLowerCase(), v = by.get(k) || { c, n: 0 }; v.n++; by.set(k, v); }
      return `<details class="dx-row" ${i === 0 ? "open" : ""}><summary><span class="dx-row-t"><b>${esc(t.theme)}</b><small>${by.size} claim${by.size === 1 ? "" : "s"}</small></span><span></span><span></span><span class="dx-row-c r">${pct(occ)} ${delta(occ, occP, { pp: true, invert: true })}</span></summary><div class="dx-table-wrap dx-inner"><table class="dx-table"><thead><tr><th>Inaccurate claim</th><th>Ground truth</th><th class="r">Times seen</th></tr></thead><tbody>${[...by.values()].map((v) => `<tr><td class="dx-wrap">${esc(v.c.claim)}<small class="dx-muted-t" style="display:block">${esc(engineName(v.c.engine))}</small></td><td class="dx-wrap">${esc(v.c.ground_truth || "")}</td><td class="r">${v.n}</td></tr>`).join("")}</tbody></table></div></details>`; }).join("")
      : `<p class="dx-muted-t dx-pad">No inaccurate claims in this period. ${checked.length ? "Every checkable claim matched your facts." : ""}</p>`;
    return h + `<section class="dx-sec"><div class="dx-sec-head"><div><h2>Summary</h2><p>${esc(rangeText(P))}</p></div></div>${kp}</section>` +
      panel("Inaccurate claims", "False claims surfaced in AI responses, grouped by theme. Each one is a correction your agents can address with on-site content.", `<div class="dx-rows">${groups}</div>`);
  }



  const AI_TOOLS = {
    klaviyo: { name: "Klaviyo", claude: "In Claude, open Settings → Connectors → Browse connectors, search “Klaviyo” and click Connect.", chatgpt: "In ChatGPT, open Settings → Apps, find the Klaviyo app and connect it.", where: "flows and campaigns" },
    mailchimp: { name: "Mailchimp", claude: null, chatgpt: null, where: "automations and campaigns" },
  };
  function emailPrompt(ctx, tool, a, only) {
    const T = AI_TOOLS[tool] || AI_TOOLS.klaviyo, m = a.metrics || {}, todo = (a.findings || []).filter((f) => f.level !== "good"), list = only ? [only] : todo;
    const linked = T.claude ? `My ${T.name} account is connected to you, so look things up there before answering.` : `You can't see my ${T.name} account directly, so ask me for anything you need to check.`;
    const lines = [
      `You're helping me improve the email marketing for ${ctx.s.name} (${ctx.s.domain.replace(/^www\./, "")}). ${linked} Don't send, publish or change anything in ${T.name} without asking me first.`,
      "",
      "Here's what our daily email audit found (last 90 days):",
      `- Email revenue: ${money(m.email_revenue_90d)}${fin(m.email_share) ? ` (${pct(m.email_share, 0)} of store sales)` : ""}; automations ${money(m.flow_revenue_90d)}, campaigns ${money(m.campaign_revenue_90d)}`,
      `- ${num(m.flows_live)} automations live, ${num(m.campaigns_30d)} campaigns in the last 30 days`,
      `- Email health score: ${num(a.score)}/100`,
      "",
      only ? "Help me with this one:" : "Things to fix, most important first:",
      ...list.map((f, i) => `${only ? "-" : i + 1 + "."} ${f.title}. ${f.detail} Suggested next step: ${f.action}`),
      "",
      only ? `Look at the ${T.where} involved in ${T.name}, tell me exactly what's causing this, and draft the change for me to approve.` : `Start with item 1: look at the ${T.where} involved in ${T.name}, tell me exactly what's causing it, and draft the change for me to approve. Then we'll move to the next item.`,
    ];
    return lines.join("\n");
  }
  function aiHelp(ctx, tool, a) {
    const T = AI_TOOLS[tool] || AI_TOOLS.klaviyo, id = "dx-prompt-all", text = emailPrompt(ctx, tool, a);
    const steps = T.claude ? `<li><b>Connect ${T.name} to your AI app.</b> ${esc(T.claude)} ${esc(T.chatgpt)} You only do this once.</li>` : `<li><b>${T.name} doesn't have an official Claude or ChatGPT connection yet.</b> That's fine: the prompt already includes your numbers.</li>`;
    return `<section class="dx-sec"><div class="dx-ai-help"><div class="dx-ai-head">${ic("visibility", 18)}<div><h2>Work on this with Claude or ChatGPT</h2><p>Hand the list to your AI assistant and it walks you through each fix, step by step.</p></div></div><ol class="dx-ai-steps">${steps}<li><b>Copy the prompt and paste it into a new chat.</b> It includes this audit, so the assistant knows where to start.</li></ol><div class="dx-ai-actions"><button type="button" class="dx-btn" data-dx-copy="${id}">${ic("link", 14)} Copy prompt</button><details><summary>Preview the prompt</summary><pre>${esc(text)}</pre></details></div><textarea id="${id}" hidden readonly>${esc(text)}</textarea></div></section>`;
  }
  // ---------- connected-tool audits ----------
  // Shows only once a business connects the tool. Each finding: what we saw, why it matters, one thing to do.
  function email(ctx) {
    const t = ctx.tools || {}, conn = (t.connections || []).find((c) => c.tool === "klaviyo"), a = (t.audits || []).find((x) => x.tool === "klaviyo");
    const h = head(ctx, "Email", "An audit of your Klaviyo account: what's earning, what's broken, and the next thing to do.", { range: false });
    if (!conn) return h + `<section class="dx-sec"><div class="dx-card">${empty("Klaviyo isn't connected", "Connect Klaviyo in Integrations to get a free email audit.", { href: ctx.href("connections"), label: "Open Integrations" })}</div></section>`;
    if (!a || a.status === "running" && !a.finished_at) return h + `<section class="dx-sec"><div class="dx-card dx-pad dx-run"><span class="dx-spin" aria-hidden="true"></span><div><b>Auditing your Klaviyo account</b><p>Reading flows, campaigns and the last 90 days of results. This usually takes a minute or two.</p></div></div></section>`;
    if (a.status === "error") return h + `<section class="dx-sec"><div class="dx-card">${empty("The email audit couldn't finish", a.error || "Try reconnecting Klaviyo.", { href: ctx.href("connections"), label: "Check the connection" })}</div></section>`;
    const m = a.metrics || {}, F = a.findings || [], todo = F.filter((f) => f.level !== "good"), good = F.filter((f) => f.level === "good");
    const grade = a.score >= 85 ? ["Strong", "up"] : a.score >= 65 ? ["Good, with gaps", "warn"] : ["Needs work", "down"];
    const kpis = `<div class="dx-kpis">${kpi({ label: "Email revenue", desc: "Orders credited to email, last 90 days", value: money(m.email_revenue_90d), source: "Klaviyo attribution" })}${kpi({ label: "Share of store sales", desc: "Email revenue ÷ all orders", value: pct(m.email_share, 0), source: fin(m.store_revenue_90d) ? money(m.store_revenue_90d) + " total store sales" : "" })}${kpi({ label: "Automations running", desc: "Live flows that send on their own", value: num(m.flows_live), source: m.flows_total ? `${num(m.flows_total)} flows in the account` : "" })}${kpi({ label: "Campaigns, last 30 days", desc: "One-off sends to your list", value: num(m.campaigns_30d), source: fin(m.last_campaign_days) ? `Last sent ${m.last_campaign_days === 0 ? "today" : m.last_campaign_days === 1 ? "yesterday" : m.last_campaign_days + " days ago"}` : "" })}</div>`;
    const card = (f, i) => `<article class="dx-find ${f.level}"><div class="dx-find-n">${f.level === "good" ? ic("check", 15) : i + 1}</div><div><div class="dx-find-top"><b>${esc(f.title)}</b><span class="dx-find-area">${esc(f.area)}</span></div><p>${esc(f.detail)}</p><div class="dx-find-do"><span>${f.level === "good" ? "Keep doing" : "Do this"}</span>${esc(f.action)}${f.where ? `<small>${/^your /i.test(f.where) ? "Where" : "In Klaviyo"}: ${esc(f.where)}</small>` : ""}</div>${f.level !== "good" ? `<button type="button" class="dx-copy-one" data-dx-copy="dx-prompt-${i}">${ic("link", 13)} Copy a prompt for just this</button><textarea id="dx-prompt-${i}" hidden readonly>${esc(emailPrompt(ctx, "klaviyo", a, f))}</textarea>` : ""}</div></article>`;
    const flows = (m.top_flows || []).length ? `<div class="dx-table-wrap"><table class="dx-table"><thead><tr><th>Automation</th><th class="r">Emails sent</th><th class="r">Revenue</th></tr></thead><tbody>${m.top_flows.map((f) => `<tr><td class="dx-wrap">${esc(f.name)}</td><td class="r">${num(f.sends)}</td><td class="r">${money(f.revenue)}</td></tr>`).join("")}</tbody></table></div>` : "";
    const camps = (m.top_campaigns || []).length ? `<div class="dx-table-wrap"><table class="dx-table"><thead><tr><th>Campaign</th><th class="r">Recipients</th><th class="r">Revenue</th><th class="r">Per recipient</th></tr></thead><tbody>${m.top_campaigns.map((c) => `<tr><td class="dx-wrap">${esc(c.name)}</td><td class="r">${num(c.recipients)}</td><td class="r">${money(c.revenue)}</td><td class="r">${money(c.per_recipient)}</td></tr>`).join("")}</tbody></table></div>` : "";
    return h +
      `<section class="dx-sec"><div class="dx-score-card"><div class="dx-score ${grade[1]}"><b>${num(a.score)}</b><span>/100</span></div><div><h2>Email health: ${grade[0]}</h2><p>${todo.length ? `${todo.length} thing${todo.length === 1 ? "" : "s"} to fix or improve, listed by impact. ` : "Nothing urgent. "}${good.length} thing${good.length === 1 ? "" : "s"} working well. Audited ${esc(ago(a.finished_at))} · refreshed daily · read-only, nothing is changed in Klaviyo.</p></div></div>${kpis}</section>` +
      (todo.length ? panel("What to do next", "Start at the top. Each item is one step you or your team can do in Klaviyo.", `<div class="dx-finds">${todo.map(card).join("")}</div>`) : "") +
      (todo.length ? aiHelp(ctx, "klaviyo", a) : "") +
      (good.length ? panel("What's working", "Keep these going.", `<ul class="dx-goods">${good.map((f) => `<li>${ic("check", 15)}<div><b>${esc(f.title)}</b><span>${esc(f.detail)}</span></div></li>`).join("")}</ul>`) : "") +
      (flows ? panel("Automations by revenue", "Last 90 days", flows) : "") +
      (camps ? panel("Best campaigns", "Last 90 days, ranked by revenue per recipient", camps) : "") +
      `<p class="dx-foot">Revenue is what Klaviyo credits to email (its attribution, not a separate measurement). Open rates are inflated by Apple Mail privacy, so this audit uses clicks and orders instead.</p>`;
  }


  // ---------- scorecard ----------
  // Every number a business owner asks for, in one place. Live where the data exists; a clear "connect" spot where it doesn't.
  function marketingRevenue(ctx) {
    const ea = (ctx.tools?.audits || []).find((x) => x.tool === "klaviyo" && x.finished_at && x.status !== "error"), gads = reportOf(ctx.snap, "google_ads");
    const end = today(), a = shift(end, -89), parts = [];
    if (ea && fin(ea.metrics?.email_revenue_90d)) parts.push(["Email", ea.metrics.email_revenue_90d]);
    const paid = gads ? sumKey(gads.rows, a, end, "conversion_value") : null; if (fin(paid)) parts.push(["Paid ads", paid]);
    return { total: parts.length ? parts.reduce((n, [, v]) => n + v, 0) : null, parts };
  }
  function sourcesLive(ctx) { const ea = (ctx.tools?.audits || []).some((x) => x.finished_at && x.status !== "error"); return [true, !!reportOf(ctx.snap, "shopify") || ea, ea, !!(ctx.snap?.search || []).length, !!reportOf(ctx.snap, "ga4"), !!reportOf(ctx.snap, "google_ads")].filter(Boolean).length; }
  function questionsMoved(ai) {
    const end = today(), w0 = shift(end, -6), w1 = shift(end, -13), w1e = shift(end, -7), by = new Map();
    for (const c of ai) { const d = String(c.checked_at).slice(0, 10), q = c.prompt; if (!q) continue; const v = by.get(q) || { now: 0, nowN: 0, before: 0, beforeN: 0 }; if (inP(d, w0, end)) { v.nowN++; if (c.mentioned) v.now++; } else if (inP(d, w1, w1e)) { v.beforeN++; if (c.mentioned) v.before++; } by.set(q, v); }
    const won = [], lost = []; for (const [q, v] of by) { if (!v.nowN || !v.beforeN) continue; if (v.now && !v.before) won.push(q); if (!v.now && v.before) lost.push(q); }
    return { won, lost };
  }
  function scorecard(ctx) {
    const { s, snap } = ctx, end = today(), P = periods(end, state.days), ai = aiRows(snap), cur = aiPeriod(ai, P.start, P.end), prev = aiPeriod(ai, P.prevStart, P.prevEnd), conn = ctx.href("connections");
    const ea = (ctx.tools?.audits || []).find((x) => x.tool === "klaviyo" && x.finished_at && x.status !== "error"), em = ea?.metrics, emailOn = (ctx.tools?.connections || []).some((c) => ["klaviyo", "mailchimp"].includes(c.tool) && c.status === "connected");
    const shop = storeOf(ctx, state.days), gads = reportOf(snap, "google_ads"), ga = reportOf(snap, "ga4"), search = snap?.search || [], hasGsc = search.length > 0;
    const lock = (label, desc, note = "Shows here once connected") => `<article class="dx-kpi dx-ghost"><h3>${esc(label)}</h3><p>${esc(desc)}</p><div class="dx-ghost-v" aria-hidden="true"><i></i><i></i></div><span class="dx-ghost-note">${ic("plug", 13)} ${esc(note)}</span></article>`;
    const group = (n, title, sub, live, tiles, cta = "") => `<section class="dx-sec dx-sc"><div class="dx-sec-head"><div><h2><span class="dx-sc-n">${n}</span>${esc(title)} <span class="dx-src ${live ? "on" : ""}">${live === true ? "Live" : live === "part" ? "Partly live" : "Not connected"}</span></h2><p>${esc(sub)}</p></div>${cta}</div><div class="dx-kpis">${tiles.join("")}</div></section>`;
    const btn = (label) => `<a class="dx-btn" href="${conn}">${ic("plug", 14)} Connect ${esc(label)}</a>`;

    // 1. Business results
    const mr = marketingRevenue(ctx);
    const SN = storeNums(shop), sRev = SN.r, sRevP = SN.rp, sOrd = SN.o, sOrdP = SN.op;
    const aov = fin(sRev) && sOrd ? sRev / sOrd : null, aovP = fin(sRevP) && sOrdP ? sRevP / sOrdP : null;
    const biz = [
      fin(mr.total) ? kpi({ label: "Revenue from marketing", desc: "Sales credited to your marketing, last 90 days", value: money(mr.total), source: mr.parts.map(([k, v]) => `${k} ${money(v)}`).join(" · ") + (ga ? "" : " · add Google Analytics for organic") }) : lock("Revenue from marketing", "Sales credited to email, search and ads, added up", "Connect email, ads or Google Analytics"),
      shop ? kpi({ label: "Store revenue", desc: "All orders in this period", value: money(sRev), d: delta(sRev, sRevP), source: `${num(sOrd)} orders · Shopify` }) : lock("Store revenue", "All orders in this period", "Connect your store"),
      shop ? kpi({ label: "Average order value", desc: "Revenue ÷ orders", value: money(aov), d: delta(aov, aovP), source: "Shopify" }) : lock("Average order value", "Revenue ÷ orders", "Connect your store"),
      lock("Repeat-customer rate", "Share of orders from returning customers", shop ? "Coming soon: needs customer history from Shopify" : "Connect your store"),
    ];

    // 2. AI visibility
    const share = (rows) => { const b = brandShare(rows, s.name), tot = b.reduce((n, x) => n + x.n, 0), own = b.find((x) => x.own); return tot ? own.n / tot : null; };
    const sov = share(cur), sovP = share(prev), mv = questionsMoved(ai), top = brandShare(cur, s.name).find((b) => !b.own && b.n);
    const claims = (a, b) => (ctx.claims || []).filter((c) => inP(String(c.at).slice(0, 10), a, b));
    const acc = (rows) => { const ck = rows.filter((c) => c.verdict !== "unverified"); return ck.length ? ck.filter((c) => c.verdict === "accurate").length / ck.length : null; };
    const pos = (rows) => rows.length ? rows.filter((c) => c.sentiment === "positive").length / rows.length : null;
    const cNow = claims(P.start, P.end), cPrev = claims(P.prevStart, P.prevEnd);
    const aiT = [
      kpi({ label: "Share of voice", desc: "Your mentions ÷ all brand mentions in AI answers", value: pct(sov), d: delta(sov, sovP, { pp: true }), source: `${num(cur.length)} answers sampled` }),
      kpi({ label: "Questions won this week", desc: "Customer questions where AI started naming you", value: `${num(mv.won.length)} won · ${num(mv.lost.length)} lost`, source: mv.won[0] ? `Won: “${mv.won[0].slice(0, 60)}”` : mv.lost[0] ? `Lost: “${mv.lost[0].slice(0, 60)}”` : "Compared with the week before" }),
      kpi({ label: "Top competitor in AI", desc: "Named most often in your customers' questions", value: top ? esc(top.name) : "—", source: top ? `Named in ${pct(top.share, 0)} of answers` : "No competitors named in this period" }),
      kpi({ label: "AI accuracy", desc: "Checkable claims about you that are correct", value: pct(acc(cNow), 0), d: delta(acc(cNow), acc(cPrev), { pp: true }), source: `${num(cNow.length)} claims checked` }),
      kpi({ label: "Positive mentions", desc: "Claims that reflect well on you", value: pct(pos(cNow), 0), d: delta(pos(cNow), pos(cPrev), { pp: true }), source: "Sentiment of AI answers" }),
    ];

    // 3. Proof of work
    const work = (snap?.work || []).filter((w) => w.status === "deployed" && w.verification?.state === "verified");
    const pubs = [...(snap?.publications || []), ...(snap?.page_publications || [])].filter((p) => p.status === "published" && p.verification?.state === "verified");
    const inRange = (rows, k, a, b) => rows.filter((r) => inP(String(r[k]).slice(0, 10), a, b));
    const wN = inRange(work, "deployed_at", P.start, P.end).length, wNP = inRange(work, "deployed_at", P.prevStart, P.prevEnd).length;
    const art = inRange(snap?.publications || [], "published_at", P.start, P.end).filter((p) => p.status === "published").length, sec = inRange(snap?.page_publications || [], "published_at", P.start, P.end).filter((p) => p.status === "published").length;
    const hours = wN * 0.25 + art * 3 + sec * 0.75, hoursP = wNP * 0.25;
    const proof = [
      kpi({ label: "Changes confirmed live", desc: "Website fixes checked on your public site", value: num(wN), d: delta(wN, wNP), source: "Work log receipts" }),
      kpi({ label: "Content published", desc: "Articles and answer sections now live", value: num(art + sec), source: `${num(art)} articles · ${num(sec)} answer sections` }),
      kpi({ label: "Hours saved", desc: "Estimated time a person would have spent", value: num(Math.round(hours)), source: "Estimate: 15 min per fix, 3 h per article, 45 min per answer section" }),
    ];

    // 4. Email
    const g = em?.list_growth?.filter((x) => fin(x.joined)) || [], lastM = g.at(-2) || g.at(-1);
    const flowShare = em && (em.flow_revenue_90d + em.campaign_revenue_90d) ? em.flow_revenue_90d / (em.flow_revenue_90d + em.campaign_revenue_90d) : null;
    const emailT = em ? [
      kpi({ label: "Revenue per email", desc: "Email revenue ÷ emails delivered, last 90 days", value: money(em.revenue_per_email), source: `${num(em.recipients_90d)} emails sent` }),
      kpi({ label: "List growth", desc: "New subscribers minus unsubscribes", value: lastM ? `${lastM.joined - (lastM.left || 0) >= 0 ? "+" : ""}${num(lastM.joined - (lastM.left || 0))}` : "—", source: lastM ? `${num(lastM.joined)} joined · ${num(lastM.left || 0)} left in ${new Date(lastM.month + "-15").toLocaleDateString("en-US", { month: "long" })}` : "Shows after the next daily audit" }),
      kpi({ label: "Automations vs campaigns", desc: "Share of email revenue from automations", value: pct(flowShare, 0), source: `${money(em.flow_revenue_90d)} automations · ${money(em.campaign_revenue_90d)} campaigns` }),
    ] : [lock("Revenue per email", "Email revenue ÷ emails delivered"), lock("List growth", "New subscribers minus unsubscribes"), lock("Automations vs campaigns", "Share of email revenue from automations")];

    // 5. Google Search Console
    const q = snap?.queries || [], brand = s.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const clicks = hasGsc ? sumKey(search, P.start, P.end, "clicks") : null, impr = hasGsc ? sumKey(search, P.start, P.end, "impressions") : null;
    const page1 = q.filter((r) => fin(r.position) && r.position <= 10).length;
    const branded = q.reduce((n, r) => n + (brand.some((w) => String(r.query || "").toLowerCase().includes(w)) ? r.clicks || 0 : 0), 0), qClicks = q.reduce((n, r) => n + (r.clicks || 0), 0);
    const gsc = hasGsc ? [
      kpi({ label: "Google clicks", desc: "Visits from Google search results", value: num(clicks), d: delta(clicks, sumKey(search, P.prevStart, P.prevEnd, "clicks")), source: `${num(impr)} times shown` }),
      q.length ? kpi({ label: "Keywords on page 1", desc: "Searches where you rank in the top 10", value: num(page1), source: `of ${num(q.length)} tracked searches` }) : lock("Keywords on page 1", "Searches where you rank in the top 10", "Fills in after the next search sync"),
      lock("Before and after", "Clicks on pages Samaritan changed, 28 days before vs after", "Calculated 28 days after each change"),
      q.length && qClicks ? kpi({ label: "Branded vs non-branded", desc: "Clicks from people searching your name", value: pct(branded / qClicks, 0), source: "The rest found you for what you sell" }) : lock("Branded vs non-branded", "People searching your name vs what you sell", "Fills in after the next search sync"),
    ] : [lock("Google clicks & impressions", "Visits from Google and how often you're shown"), lock("Keywords on page 1", "Searches where you rank in the top 10"), lock("Before and after", "Clicks on pages Samaritan changed, before vs after"), lock("Branded vs non-branded", "People searching your name vs what you sell")];

    // 6. Google Analytics
    const aiVisits = ga ? (ga.sources || []).filter((r) => inP(r.date, P.start, P.end) && /ai assistant|chatgpt|perplexity|gemini|claude|copilot/i.test(r.sessionDefaultChannelGroup || r.sessionSourceMedium || "")).reduce((n, r) => n + (r.sessions || 0), 0) : null;
    const gaT = ga ? [
      kpi({ label: "Visits from AI assistants", desc: "People who clicked through from ChatGPT, Perplexity, Gemini and others", value: num(aiVisits), source: "Google Analytics" }),
      lock("Revenue by channel", "Organic, AI, email, paid and direct side by side", "Needs conversion tracking in Google Analytics"),
      lock("Top landing pages", "Pages that bring in the most revenue or leads", "Needs conversion tracking in Google Analytics"),
    ] : [lock("Visits from AI assistants", "People who clicked through from ChatGPT, Perplexity, Gemini"), lock("Revenue by channel", "Organic, AI, email, paid and direct side by side"), lock("Top landing pages", "Pages that bring in the most revenue or leads")];

    // 7. Leads
    const lv = (k, a, b) => gads ? sumKey(gads.rows, a, b, k) : null, leads = lv("leads", P.start, P.end), spend = lv("spend", P.start, P.end), booked = lv("bookings", P.start, P.end);
    const leadT = gads ? [
      kpi({ label: "Leads", desc: "Enquiries from Google Ads", value: num(leads), d: delta(leads, lv("leads", P.prevStart, P.prevEnd)), source: gads.lead_label || "Google Ads" }),
      kpi({ label: "Cost per lead", desc: "Ad spend ÷ leads", value: leads ? money(spend / leads) : "—", source: `${money(spend)} spent` }),
      fin(booked) ? kpi({ label: "Cost per booked job", desc: "Ad spend ÷ bookings", value: booked ? money(spend / booked) : "—", source: `${num(booked)} bookings` }) : lock("Cost per booked job", "Ad spend ÷ bookings", "Mark leads as booked to see this"),
      fin(booked) && leads ? kpi({ label: "Lead-to-booking rate", desc: "Leads that became paying jobs", value: pct(booked / leads, 0), source: "Google Ads conversions" }) : lock("Lead-to-booking rate", "Leads that became paying jobs", "Mark leads as booked to see this"),
      lock("Calls answered vs missed", "Phone leads you picked up", "Connect call tracking (e.g. CallRail)"),
    ] : [lock("Leads by source", "Enquiries from ads, forms and calls"), lock("Cost per lead", "Ad spend ÷ leads"), lock("Cost per booked job", "Ad spend ÷ bookings"), lock("Lead-to-booking rate", "Leads that became paying jobs"), lock("Calls answered vs missed", "Phone leads you picked up", "Connect call tracking (e.g. CallRail)")];

    // 8. Local
    const local = [lock("Calls & directions from Maps", "Actions people took on your Google listing"), lock("Reviews", "Total reviews, average rating and new reviews this month")];

    // Lead-gen businesses measure results in leads, not store orders.
    const bizTiles = ctx.ecommerce ? biz : [biz[0], ...leadT.slice(0, 3)];
    const bizLive = ctx.ecommerce ? (fin(mr.total) || shop ? (fin(mr.total) && shop ? true : "part") : false) : (gads ? (fin(mr.total) ? true : "part") : false);
    const liveCount = sourcesLive(ctx);
    return head(ctx, "Scorecard", "Every number that shows how your marketing is doing, in one place. Grey spots fill in as you connect each tool.") +
      `<div class="dx-sc-progress"><div><b>${liveCount} of 6 data sources live</b><span>Each connection unlocks more of your scorecard.</span></div><div class="dx-sc-bar"><i style="width:${Math.round(liveCount / 6 * 100)}%"></i></div><a class="dx-btn" href="${conn}">Open Integrations</a></div>` +
      group(1, "Business results", ctx.ecommerce ? "What your marketing earns." : "The leads and revenue your marketing brings in.", bizLive, bizTiles, !ctx.ecommerce && !gads ? btn("Google Ads") : "") +
      group(2, "AI visibility", "How AI assistants talk about you. Live from your daily checks.", true, aiT, `<a class="dx-link" href="${ctx.href("visibility")}">Details ${ic("chev", 14)}</a>`) +
      group(3, "Proof of work", "What your agents shipped in this period.", true, proof, `<a class="dx-link" href="${ctx.href("work")}">Work log ${ic("chev", 14)}</a>`) +
      group(4, "Email", "From Klaviyo or Mailchimp.", !!em, emailT, em ? `<a class="dx-link" href="${ctx.href("email")}">Email audit ${ic("chev", 14)}</a>` : emailOn ? "" : btn("Klaviyo")) +
      group(5, "Google search", "From Google Search Console.", hasGsc, gsc, hasGsc ? "" : btn("Search Console")) +
      group(6, "Website visits", "From Google Analytics.", !!ga, gaT, ga ? "" : btn("Google Analytics")) +
      (ctx.ecommerce ? group(7, "Leads & ads", "From Google Ads and call tracking.", gads ? "part" : false, leadT, gads ? "" : btn("Google Ads")) : group(7, "Calls & bookings", "From call tracking and your booked jobs.", false, leadT.slice(3), "")) +
      group(8, "Local search", "From your Google Business Profile.", false, local, btn("Business Profile"));
  }
  // ---------- definitions ----------
  const GLOSSARY = [
    ["Visibility score", "Of the AI answers we checked for your customers' questions, the share that mention your business by name. 40% means you were named in 4 out of every 10 answers."],
    ["Citation rate", "The share of answers that link to your website as a source. A citation can send visitors and tells the assistant your site is trustworthy."],
    ["Average position", "When an answer lists several businesses, where you appear. 1 means you were listed first."],
    ["Customer questions", "The questions we ask ChatGPT, Claude, Gemini and Perplexity every day, written the way your customers ask them."],
    ["Named instead", "Competitors the assistant recommended in answers where you weren't mentioned."],
    ["Citations", "The websites an assistant quoted. Owned is your site, Competition is a rival brand, Earned is independent articles and reviews, Directory is listings like Google and Yelp."],
    ["Sentiment", "Whether what assistants say about you reflects well (positive), neutrally, or badly (negative) on the business."],
    ["FactCheck", "We compare what assistants claim about you with your saved business facts. Accuracy is the share of checkable claims that match."],
    ["Competitors", "Your visibility score next to your competitors' on the same questions, so you can see who AI recommends most."],
    ["Sampled", "These numbers come from a daily sample of questions, not from every conversation people have with AI. Trends matter more than any single day."],
  ];
  const glossary = (open = false) => `<details class="dx-gloss" ${open ? "open" : ""}><summary>${ic("visibility", 15)}<span>What these numbers mean</span></summary><dl>${GLOSSARY.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></details>`;
  const PAGES = { scorecard: ["Scorecard", scorecard, "Results"], email: ["Email", email, "Results"], sentiment: ["Sentiment", sentiment, "Results"], factcheck: ["FactCheck", factcheck, "Results"], today: ["Overview", overview, "Home"], traffic: ["Search traffic", traffic, "Results"], visibility: ["AI visibility", visibility, "Results"], citations: ["Citations", citations, "Results"], benchmarks: ["Benchmarks", benchmarks, "Results"], leadgen: ["Lead generation", leadgen, "Results"], work: ["Work history", work, "Work"] };
  function view(page, ctx) {
    const p = PAGES[page]; if (!p) return "";
    ctx.group = p[2];
    if (!ctx.snap) return head(ctx, p[0], "", { range: false }) + `<div class="dx-card">${empty("Loading your reports", "Your workspace is gathering its data.", null)}</div>`;
    if (ctx.snap.error) return head(ctx, p[0], "", { range: false }) + `<div class="dx-card">${empty("Reports couldn't be loaded", String(ctx.snap.error), null)}</div>`;
    let html = p[1](ctx);
    if (["visibility", "citations", "sentiment", "factcheck", "benchmarks"].includes(page)) html = html.replace("</header>", "</header>" + glossary(false));
    return `<div class="dx-page">${html}</div>`;
  }

  // ---------- theme ----------
  const theme = {
    get() { return document.documentElement.dataset.theme === "light" ? "light" : "dark"; },
    set(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem("impackt:theme", t); } catch { /* ignore */ } const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === "light" ? "#F5F3EF" : "#0B1220"; },
    toggle() { this.set(this.get() === "light" ? "dark" : "light"); },
  };

  // ---------- interaction ----------
  let rerender = null;
  document.addEventListener("click", (e) => {
    const d = e.target.closest("[data-dx-days]"); if (d) { state.days = +d.dataset.dxDays; store.set("days", state.days); rerender?.(); return; }
    if (e.target.closest("[data-dx-gran]")) { state.gran = state.gran === "weekly" ? "daily" : "weekly"; store.set("gran", state.gran); rerender?.(); return; }
    if (e.target.closest("[data-dx-compare]")) { state.compare = !state.compare; store.set("compare", state.compare); rerender?.(); return; }
    if (e.target.closest("[data-dx-menu]")) { document.querySelector(".dx-shell")?.classList.toggle("nav-open"); return; }
    if (e.target.closest(".dx-side .dx-nav a")) document.querySelector(".dx-shell")?.classList.remove("nav-open");
    if (e.target.closest("[data-dx-theme]")) { theme.toggle(); const b = e.target.closest("[data-dx-theme]"); b.innerHTML = themeButton(); }
    const cp = e.target.closest("[data-dx-copy]");
    if (cp) { const t = document.getElementById(cp.dataset.dxCopy)?.value || ""; const done = () => { const was = cp.dataset.label || cp.innerHTML; cp.dataset.label = was; cp.innerHTML = `${ic("check", 14)} Copied: paste it into Claude or ChatGPT`; cp.classList.add("copied"); setTimeout(() => { cp.innerHTML = was; cp.classList.remove("copied"); }, 2600); };
      (navigator.clipboard?.writeText(t) || Promise.reject()).then(done, () => { const ta = document.getElementById(cp.dataset.dxCopy); ta.hidden = false; ta.select(); try { document.execCommand("copy"); done(); } catch { /* user can copy manually */ } }); }
  });
  document.addEventListener("change", (e) => { const sel = e.target.closest?.("[data-dx-engine]"); if (sel) { state.engine = sel.value; store.set("engine", state.engine); rerender?.(); } });
  document.addEventListener("pointermove", (e) => {
    const box = e.target.closest?.(".dx-chart"); if (!box) return;
    const svg = box.querySelector("svg"), tip = box.querySelector(".dx-tip"), cross = box.querySelector(".dx-cross"), r = svg.getBoundingClientRect();
    let c; try { c = JSON.parse(box.dataset.chart); } catch { return; }
    const vx = ((e.clientX - r.left) / r.width) * c.W, i = Math.round(((vx - c.L) / (c.W - c.L - c.R)) * (c.n - 1));
    if (i < 0 || i >= c.n) { tip.hidden = true; cross.style.display = "none"; return; }
    const px = c.L + (c.n <= 1 ? 0 : (i * (c.W - c.L - c.R)) / (c.n - 1));
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.style.display = "";
    tip.hidden = false; tip.innerHTML = `<b>${esc(short(c.xs[i]))}${state.gran === "weekly" ? " week" : ""}</b>${c.series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}<em>${esc(s.f[i])}</em></span>`).join("")}`;
    const left = (px / c.W) * r.width; tip.style.left = Math.min(Math.max(8, left + 12), r.width - tip.offsetWidth - 8) + "px";
  });
  document.addEventListener("pointerleave", (e) => { const box = e.target?.closest?.(".dx-chart"); if (box) { box.querySelector(".dx-tip").hidden = true; box.querySelector(".dx-cross").style.display = "none"; } }, true);
  const themeButton = () => theme.get() === "light" ? `${ic("moon", 16)}<span>Night mode</span>` : `${ic("sun", 16)}<span>Day mode</span>`;

  root.ImpacktDash = { view, pages: PAGES, icon: ic, theme, themeButton, onRerender(fn) { rerender = fn; } };
})(window);
