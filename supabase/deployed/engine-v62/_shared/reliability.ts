// Pure helpers shared by the backend and regression tests. No credentials or network I/O.
export function modelForGemini(configured?: string) {
  const value = (configured || "").replace(/^models\//, "");
  return !value || value === "gemini-2.5-flash" ? "gemini-3.8-flash" : value;
}

export function terminalProviderError(message: string) {
  return /no credits remaining|insufficient_quota|billing|invalid api.?key|api.?key.*invalid|no longer available|model.*not found|model.*not supported|permission.denied/i.test(message);
}

export function summarizeChecks(checks: any[]) {
  const done = checks.filter(c => c.status === "done");
  const rate = (rows: any[], key: string) => rows.length ? Math.round(100 * rows.filter(r => r[key]).length / rows.length) : null;
  const byEngine: Record<string, any> = {};
  for (const engine of [...new Set(checks.map(c => c.engine))]) {
    const all = checks.filter(c => c.engine === engine), rows = all.filter(c => c.status === "done");
    byEngine[engine] = { visibility: rate(rows, "mentioned"), cited: rate(rows, "cited"), checks: rows.length, attempted: all.length, failed: all.filter(c => c.status === "failed").length, error: all.find(c => c.status === "failed")?.error || null };
  }
  const competitors: Record<string, number> = {};
  done.forEach(c => (c.competitors || []).forEach((name: string) => { competitors[name] = (competitors[name] || 0) + 1; }));
  const positions = done.filter(c => c.position).map(c => c.position);
  return {
    visibility: rate(done, "mentioned"), cited: rate(done, "cited"),
    avgPosition: positions.length ? +(positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1) : null,
    checks: checks.length, successful: done.length, failed: checks.filter(c => c.status === "failed").length,
    coverage: checks.length ? Math.round(100 * done.length / checks.length) : 0,
    partial: done.length < checks.length, byEngine,
    competitors: Object.entries(competitors).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, share: Math.round(100 * n / Math.max(1, done.length)) })),
  };
}

export function normalHost(value: string) {
  try { return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

export function selectGoogleProperty(properties: any[], domain: string, saved?: string) {
  const host = normalHost(domain);
  const allowed = properties.filter(p => p.permissionLevel && p.permissionLevel !== "siteUnverifiedUser");
  const belongs = (p: any) => p.siteUrl.startsWith("sc-domain:") ? p.siteUrl.slice(10).toLowerCase() === host : normalHost(p.siteUrl) === host;
  const matches = allowed.filter(belongs);
  return matches.find(p => p.siteUrl === `sc-domain:${host}`)?.siteUrl
    || matches.find(p => p.siteUrl === saved)?.siteUrl
    || matches.find(p => /^https:\/\//.test(p.siteUrl) && new URL(p.siteUrl).pathname === "/")?.siteUrl
    || null; // Never silently pick an unrelated domain or a restricted URL subdirectory.
}

export function decodeHtml(value: string) {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", trade: "™", reg: "®", copy: "©" };
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] !== "#") return named[code.toLowerCase()] ?? whole;
    const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  });
}
export const normalizeText = (value: string) => decodeHtml(value).replace(/\s+/g, " ").trim();
const strip = (s: string) => s.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
function attrs(tag: string) {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) out[m[1].toLowerCase()] = decodeHtml(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}
export function verifyPublicHtml(field: string, expected: string, html: string, imageUrl?: string, robotsHeader = "") {
  const source = strip(html), head = source.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1];
  if (head == null) return { matches: false, reason: "The response was not a complete HTML page." };
  const metas = (head.match(/<meta\b[^>]*>/gi) || []).map(attrs);
  if (field === "seo.title") {
    const titles = [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)].map(m => normalizeText(m[1]));
    return { matches: titles.length === 1 && titles[0] === normalizeText(expected), reason: "The public page title does not exactly match the approved title." };
  }
  if (field === "seo.description") {
    const values = metas.filter(m => m.name?.toLowerCase() === "description").map(m => normalizeText(m.content || ""));
    return { matches: values.length === 1 && values[0] === normalizeText(expected), reason: "The public meta description does not exactly match the approved description." };
  }
  if (field === "seo.hidden") {
    const robots = metas.filter(m => ["robots", "googlebot"].includes(m.name?.toLowerCase())).map(m => m.content || "").join(",") + "," + robotsHeader;
    const hidden = /\bnoindex\b/i.test(robots);
    return { matches: expected === "1" || expected === "noindex" ? hidden : !hidden, reason: "The public indexing directive does not match the saved setting." };
  }
  if (field === "description.replace") {
    const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] || "";
    const needle = normalizeText(expected.replace(/<[^>]*>/g, " "));
    return { matches: !!needle && normalizeText(body.replace(/<[^>]*>/g, " ")).includes(needle), reason: "The expected replacement text was not found in the public page body." };
  }
  if (field === "image.alt") {
    let filename = "";
    try { filename = new URL(imageUrl || "").pathname.split("/").pop() || ""; } catch { /* no identity */ }
    const images = (source.match(/<img\b[^>]*>/gi) || []).map(attrs).filter(a => {
      const urls = [a.src, a["data-src"], ...(a.srcset || "").split(",").map(x => x.trim().split(/\s+/)[0])].filter(Boolean);
      return filename && urls.some(u => { try { return new URL(u, "https://example.invalid").pathname.split("/").pop() === filename; } catch { return false; } });
    });
    return { matches: images.length > 0 && images.every(a => normalizeText(a.alt || "") === normalizeText(expected)), reason: "The target image and its approved alt text were not confirmed in the page HTML." };
  }
  return { matches: false, reason: "This change type needs a manual live-page check.", unsupported: true };
}


