import { MOCK } from "../../core/config.js";
import { mockPage } from "../../mock/fixtures.js";

/**
 * Host-agnostic page inspector. Works the same on Shopify, Framer, Netlify,
 * WordPress or anything else, because it reads the public HTML like a crawler.
 * No HTML parser dependency: regexes are enough for the head tags we audit.
 */
export interface PageSnapshot {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  redirected: boolean;
  responseMs: number;
  htmlKb: number;
  title?: string;
  metaDescription?: string;
  canonical?: string;
  robotsMeta?: string;
  xRobotsTag?: string;
  lang?: string;
  h1: string[];
  h2Count: number;
  wordCount: number;
  imagesMissingAlt: number;
  imageCount: number;
  internalLinks: number;
  externalLinks: number;
  openGraph: Record<string, string>;
  jsonLdTypes: string[];
  hreflang: string[];
  platformHints: string[];
  tracking: { gtm: boolean; ga4: boolean; googleAds: boolean; metaPixel: boolean; tiktokPixel: boolean };
}

const UA = "Mozilla/5.0 (compatible; AgencyAgentsBot/0.1; site audit)";

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? decode(m[2] ?? m[3] ?? "") : undefined;
}

function metaTags(html: string) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
}

export async function inspectPage(url: string): Promise<PageSnapshot> {
  if (MOCK) return mockPage(url);
  const started = Date.now();
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
  const html = await res.text();
  const responseMs = Date.now() - started;
  const host = new URL(res.url).host;

  const metas = metaTags(html);
  const metaBy = (key: string, val: string) => metas.find((t) => attr(t, key)?.toLowerCase() === val);
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const hrefs = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["']/gi)].map((m) => m[1]);

  const jsonLdTypes: string[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n: any) => {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n["@type"]) jsonLdTypes.push(...([] as string[]).concat(n["@type"]));
        if (n["@graph"]) walk(n["@graph"]);
      };
      walk(JSON.parse(m[1]));
    } catch {
      jsonLdTypes.push("(invalid JSON-LD)");
    }
  }

  const og: Record<string, string> = {};
  for (const t of metas) {
    const p = attr(t, "property");
    if (p?.startsWith("og:")) og[p] = attr(t, "content") ?? "";
  }

  const platformHints = [
    /cdn\.shopify\.com|Shopify\.theme/i.test(html) && "shopify",
    /framerusercontent\.com|data-framer/i.test(html) && "framer",
    /wp-content|wp-includes/i.test(html) && "wordpress",
    res.headers.get("server")?.toLowerCase().includes("netlify") && "netlify",
    /webflow/i.test(html) && "webflow",
  ].filter(Boolean) as string[];

  return {
    requestedUrl: url,
    finalUrl: res.url,
    status: res.status,
    redirected: res.redirected,
    responseMs,
    htmlKb: Math.round(html.length / 1024),
    title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1]) : undefined,
    metaDescription: attr(metaBy("name", "description") ?? "", "content"),
    canonical: attr(links.find((l) => attr(l, "rel")?.toLowerCase() === "canonical") ?? "", "href"),
    robotsMeta: attr(metaBy("name", "robots") ?? "", "content"),
    xRobotsTag: res.headers.get("x-robots-tag") ?? undefined,
    lang: html.match(/<html[^>]*\blang\s*=\s*["']([^"']+)/i)?.[1],
    h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "))),
    h2Count: (html.match(/<h2\b/gi) ?? []).length,
    wordCount: text ? text.split(" ").length : 0,
    imageCount: imgs.length,
    imagesMissingAlt: imgs.filter((i) => !/\balt\s*=\s*["'][^"']+/i.test(i)).length,
    internalLinks: hrefs.filter((h) => h.startsWith("/") || h.includes(host)).length,
    externalLinks: hrefs.filter((h) => /^https?:/i.test(h) && !h.includes(host)).length,
    openGraph: og,
    jsonLdTypes: [...new Set(jsonLdTypes)],
    hreflang: links.filter((l) => attr(l, "hreflang")).map((l) => attr(l, "hreflang")!),
    platformHints,
    tracking: {
      gtm: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/.test(html),
      ga4: /gtag\/js\?id=G-|['"]G-[A-Z0-9]{6,}['"]/.test(html),
      googleAds: /AW-\d{6,}/.test(html),
      metaPixel: /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(/.test(html),
      tiktokPixel: /analytics\.tiktok\.com/.test(html),
    },
  };
}

/** robots.txt + sitemap URLs (first sitemap, up to `limit` URLs; follows one level of sitemap index). */
export async function siteIndex(siteUrl: string, limit = 200) {
  const origin = new URL(siteUrl).origin;
  if (MOCK) return { robotsTxt: "User-agent: *\nAllow: /\nSitemap: " + origin + "/sitemap.xml", sitemap: origin + "/sitemap.xml", urls: [origin + "/", origin + "/services", origin + "/pricing", origin + "/blog/how-to-choose"] };
  const get = async (u: string) => {
    const r = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
    return r.ok ? r.text() : "";
  };
  const robotsTxt = await get(`${origin}/robots.txt`);
  const sitemap = robotsTxt.match(/^sitemap:\s*(\S+)/im)?.[1] ?? `${origin}/sitemap.xml`;
  let xml = await get(sitemap);
  const locs = (x: string) => [...x.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decode(m[1]));
  let urls = locs(xml);
  if (/<sitemapindex/i.test(xml)) {
    const children = urls.slice(0, 5);
    urls = [];
    for (const child of children) {
      xml = await get(child);
      urls.push(...locs(xml));
      if (urls.length >= limit) break;
    }
  }
  return { robotsTxt: robotsTxt.slice(0, 3000), sitemap, urls: urls.slice(0, limit) };
}
