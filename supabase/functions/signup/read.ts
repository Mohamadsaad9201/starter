// Public website reading for self-serve sign-up. Same safety rules as business-intake: https only, public
// unicast IPs only (no internal addresses), size and time limits, three redirects at most.
import https from "node:https";
import { Buffer } from "node:buffer";
import ipaddr from "npm:ipaddr.js@2.2.0";
import { load } from "npm:cheerio@1.0.0/slim";

export function publicUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.port || u.username || u.password || !/^([a-z0-9-]+\.)+[a-z]{2,63}$/i.test(u.hostname)) throw Error("Enter a public website address.");
  return u;
}
export const bare = (host: string) => host.toLowerCase().replace(/^www\./, "");

async function page(raw: string, hops = 0): Promise<{ url: string; html: string }> {
  const u = publicUrl(raw);
  const dns = await fetch("https://dns.google/resolve?type=A&name=" + encodeURIComponent(u.hostname), { signal: AbortSignal.timeout(4000) }).then((r) => r.json());
  const ip = dns.Answer?.find((x: any) => x.type === 1 && ipaddr.isValid(x.data) && ipaddr.parse(x.data).range() === "unicast")?.data;
  if (!ip) throw Error("The website address doesn't resolve.");
  const result = await new Promise<{ redirect?: string; html?: string }>((resolve, reject) => {
    const req = https.get({ hostname: ip, servername: u.hostname, headers: { Host: u.hostname, Accept: "text/html", "Accept-Encoding": "identity", "User-Agent": "ImpacktMedia/1.0 (public website audit)" }, path: u.pathname + u.search, agent: false, signal: AbortSignal.timeout(6500) }, (res) => {
      if (res.statusCode! >= 300 && res.statusCode! < 400 && res.headers.location) { res.destroy(); return resolve({ redirect: res.headers.location }); }
      if (res.statusCode !== 200 || !String(res.headers["content-type"]).includes("html")) { res.destroy(); return reject(Error("Website unavailable.")); }
      let size = 0; const parts: Buffer[] = [];
      res.on("error", reject);
      res.on("data", (b: Buffer) => { size += b.length; parts.push(b); if (size >= 1_600_000) { resolve({ html: Buffer.concat(parts).subarray(0, 1_600_000).toString("utf8") }); res.destroy(); } });
      res.on("end", () => resolve({ html: Buffer.concat(parts).toString("utf8") }));
    });
    req.on("error", reject);
  });
  if (result.redirect && hops < 3) return page(new URL(result.redirect, u).href, hops + 1);
  if (!result.html) throw Error("Website unavailable.");
  return { url: u.href, html: result.html };
}

// Website platform from the page's own markup. Order matters: WooCommerce runs on WordPress.
const PLATFORMS: [string, RegExp][] = [
  ["shopify", /cdn\.shopify\.com|Shopify\.theme|shopify-section/i],
  ["woocommerce", /woocommerce/i],
  ["wordpress", /wp-content\/|wp-includes\/|<meta[^>]+generator[^>]+WordPress/i],
  ["webflow", /data-wf-site|webflow\.js|website-files\.com|assets\.website-files/i],
  ["wix", /static\.wixstatic\.com|_wixCssImports|wix-bolt|X-Wix/i],
  ["squarespace", /static1\.squarespace\.com|squarespace-cdn|Squarespace\.Constants/i],
  ["bigcommerce", /cdn\d*\.bigcommerce\.com|BigCommerce/i],
  ["framer", /framerusercontent\.com|data-framer-|framer\.com\/m\//i],
  ["godaddy", /img\d*\.wsimg\.com|godaddy website builder/i],
];
export const detectPlatform = (html: string) => PLATFORMS.find(([, r]) => r.test(html))?.[0] || "other";

const clean = (v: unknown, n = 700) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
function details(p: { url: string; html: string }) {
  const $ = load(p.html), orgs: any[] = [];
  function visit(v: any, depth = 0) {
    if (!v || depth > 8 || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach((x) => visit(x, depth + 1)); return; }
    const type = [v["@type"]].flat().join(" ");
    if (/Organization|Business|School|Store|Service|Restaurant|Corporation|Shop/i.test(type) && !/(?:Review|Offer|Product)/i.test(type)) orgs.push(v);
    for (const k of ["@graph", "department", "subOrganization", "location", "mainEntity"]) visit(v[k], depth + 1);
  }
  $('script[type="application/ld+json"]').each((_, e) => { try { visit(JSON.parse($(e).text())); } catch { /* invalid JSON-LD */ } });
  const title = clean($("title").text(), 300);
  const description = clean($('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || orgs[0]?.description);
  const name = clean($('meta[property="og:site_name"]').attr("content") || orgs[0]?.name || title.split(/ [|–—-] /)[0], 200);
  const places = orgs.flatMap((o) => [o.address || []].flat()).map((a: any) => typeof a === "string" ? clean(a) : [a?.streetAddress, a?.addressLocality, a?.addressRegion, a?.postalCode].map((x) => clean(x)).filter(Boolean).join(", ")).filter(Boolean);
  const areas = orgs.flatMap((o) => [o.areaServed || []].flat()).map((a: any) => clean(typeof a === "string" ? a : a?.name)).filter(Boolean);
  $("script,style,noscript,svg").remove();
  const headings = $("h1,h2").toArray().map((e) => clean($(e).text(), 140)).filter(Boolean).slice(0, 12);
  const text = clean($("body").text(), 4000);
  const links = $("a[href]").toArray().map((e) => { try { return new URL($(e).attr("href")!, p.url); } catch { return null; } })
    .filter((u): u is URL => !!u && u.origin === new URL(p.url).origin && /\/(about|about-us|our-story|locations?|stores?|contact|services?)(\/|$)/i.test(u.pathname))
    .map((u) => u.origin + u.pathname);
  return { name, title, description, places, areas, headings, text, links };
}

// Reads the homepage and up to three pages that describe the business. A blocked or unreachable site still
// returns what is known (the domain), so research can continue from public search results.
export async function readSite(domain: string) {
  const origin = publicUrl("https://" + domain).origin;
  let main: { url: string; html: string } | null = null, error = "";
  try { main = await page(origin); } catch (e) { error = (e as Error).message; }
  if (!main) {
    try { // Rendered fallback for sites that block direct reads.
      const r = await fetch("https://r.jina.ai/" + origin, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
      if (r.ok) {
        const d = (await r.json())?.data || {};
        const title = String(d.title || "").trim();
        if (title && !/just a moment|access denied|verify you are human|attention required|403 forbidden/i.test(title)) {
          return { domain, readable: true, platform: detectPlatform(String(d.content || "")), name: title.split(/ [|–—-] /)[0].slice(0, 200), title, description: String(d.description || "").slice(0, 700), places: [], areas: [], headings: [], text: String(d.content || "").replace(/\s+/g, " ").slice(0, 4000), sources: [origin] };
        }
      }
    } catch { /* fall through */ }
    return { domain, readable: false, error: error || "The website couldn't be read.", platform: "other", name: "", title: "", description: "", places: [], areas: [], headings: [], text: "", sources: [] };
  }
  const home = details(main), sources = [main.url];
  const extra = await Promise.allSettled([...new Set(home.links)].filter((l) => l !== main!.url).slice(0, 3).map((l) => page(l)));
  const more = extra.filter((r): r is PromiseFulfilledResult<{ url: string; html: string }> => r.status === "fulfilled" && new URL(r.value.url).origin === new URL(main!.url).origin).map((r) => { sources.push(r.value.url); return details(r.value); });
  const uniq = (xs: string[]) => [...new Set(xs)].slice(0, 20);
  return {
    domain, readable: true, platform: detectPlatform(main.html),
    name: home.name, title: home.title, description: home.description,
    places: uniq([home, ...more].flatMap((d) => d.places)), areas: uniq([home, ...more].flatMap((d) => d.areas)),
    headings: home.headings, text: [home.text, ...more.map((d) => d.text)].join(" ").slice(0, 6000), sources,
  };
}
export type SiteRead = Awaited<ReturnType<typeof readSite>>;
