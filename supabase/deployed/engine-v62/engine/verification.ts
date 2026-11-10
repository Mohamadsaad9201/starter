import { indexingValue } from "../_shared/business.ts";
import { normalHost, normalizeText, verifyPublicHtml } from "../_shared/reliability.ts";
import { redirectState } from "./redirects.ts";

export async function readShopifyValue(shopify: any, c: any, token: string, f: any) {
  if (["seo.title", "seo.description", "seo.hidden"].includes(f.field)) {
    const namespace = f.field === "seo.hidden" ? "seo" : "global";
    const key = f.field === "seo.title" ? "title_tag" : f.field === "seo.description" ? "description_tag" : "hidden";
    const d = await shopify(c.config.shop, token, `query VerifyMetafield($id:ID!,$namespace:String!,$key:String!){node(id:$id){...on HasMetafields{metafield(namespace:$namespace,key:$key){value}}}}`, { id: f.ref, namespace, key });
    if (!d.node) throw new Error("The source page no longer exists.");
    return { value: d.node.metafield?.value ?? "" };
  }
  if (f.field === "image.alt") {
    const d = await shopify(c.config.shop, token, `query VerifyImage($id:ID!){node(id:$id){...on MediaImage{alt image{url}}}}`, { id: f.target });
    if (!d.node || !("alt" in d.node)) throw new Error("The source image no longer exists or is not a MediaImage.");
    return { value: d.node.alt || "", imageUrl: d.node.image?.url };
  }
  if (f.field === "description.replace") {
    const d = await shopify(c.config.shop, token, `query VerifyDescription($id:ID!){product(id:$id){descriptionHtml}}`, { id: f.ref });
    if (!d.product) throw new Error("The source product no longer exists.");
    return { value: d.product.descriptionHtml || "" };
  }
  return { unsupported: true, value: "" };
}

async function publicPage(url: string, domain: string) {
  const host = normalHost(domain);
  let current = new URL(url);
  const redirects: { status: number; from: string; to: string }[] = [];
  // Page verification is limited to the business's public HTTPS domain, including www redirects.
  if (!host || host === "localhost" || !host.includes(".") || /^\d+(\.\d+){3}$/.test(host) || host.includes(":")) throw new Error("A public business domain is required for verification.");
  for (let n = 0; n < 5; n++) {
    if (current.protocol !== "https:" || normalHost(current.href) !== host || current.username || current.password || current.port) throw new Error("The page redirects outside the connected business domain.");
    const res = await fetch(current.href, { redirect: "manual", signal: AbortSignal.timeout(10000), headers: { "Cache-Control": "no-cache", "User-Agent": "Impactful-Verification/1.0" } });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Page redirect is missing its destination.");
      const next = new URL(location, current); redirects.push({ status: res.status, from: current.href, to: next.href });
      current = next; continue;
    }
    if (!res.ok) throw new Error(`The public page returned HTTP ${res.status}.`);
    const html = await res.text();
    if (html.length > 4_000_000) throw new Error("The public page was too large to verify safely.");
    return { html, url: current.href, robots: res.headers.get("x-robots-tag") || "", redirects };
  }
  throw new Error("The public page has too many redirects.");
}

export async function verifyFix(db: any, shopify: any, secretFor: any, c: any, site: any, f: any) {
  const rollback = f.status === "rolled_back";
  const expected = rollback ? (f.field === "description.replace" ? f.before : f.restore ?? "") : f.after;
  const attempt = (f.data?.verification?.attempts || 0) + 1;
  const v: any = { state: "unavailable", attempts: attempt, checkedAt: new Date().toISOString(), operation: rollback ? "rollback" : "publish", apiMatches: false, publicMatches: false };
  try {
    let actual: any;
    const token = await secretFor(c.id);
    if (!token) throw new Error("The connector credential is unavailable.");
    if (c.type === "shopify" && f.field === "status.draft_redirect") {
      const j = f.data?.redirectOperation;
      if (!j) actual = { unsupported: true };
      else {
        const state = await redirectState(shopify, c.config.shop, token, f.ref, j.path);
        v.apiMatches = rollback
          ? state.product.status === j.originalStatus && (j.originalRedirect ? state.redirect?.id === j.originalRedirect.id && state.redirect?.target === j.originalRedirect.target : !state.redirect)
          : state.product.status === "DRAFT" && state.redirect?.target === j.target && state.redirect?.id === (j.originalRedirect?.id || j.createdRedirectId);
        const page = await publicPage(f.url, site.domain); v.url = page.url;
        v.publicMatches = rollback
          ? j.originalStatus === "ACTIVE" && new URL(page.url).pathname === j.path
          : page.redirects.some(r => [301, 308].includes(r.status) && new URL(r.from).pathname === j.path && new URL(r.to).pathname === j.target) && new URL(page.url).pathname === j.target;
        v.state = v.apiMatches && v.publicMatches ? "verified" : "mismatch";
        v.reason = v.state === "verified" ? "Product state, redirect record and public response checked." : "The product state or public redirect does not match the recorded operation.";
        actual = { checkedRedirect: true };
      }
    } else if (c.type === "shopify") actual = await readShopifyValue(shopify, c, token, f);
    else if (c.type === "webflow" && ["seo.title", "seo.description"].includes(f.field)) {
      const res = await fetch(`https://api.webflow.com/v2/pages/${f.ref}`, { signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Webflow returned HTTP ${res.status}.`);
      const page = await res.json();
      actual = { value: f.field === "seo.title" ? page.seo?.title || "" : page.seo?.description || "" };
    } else actual = { unsupported: true };
    if (actual.unsupported) { v.state = "manual_check"; v.reason = "This change type requires a manual live-page check."; }
    else if (!actual.checkedRedirect) {
      const apiExpected = f.field === "seo.hidden" ? indexingValue(expected) : String(expected ?? "");
      v.apiMatches = f.field === "description.replace" ? !!apiExpected && actual.value.includes(apiExpected) : normalizeText(actual.value) === normalizeText(apiExpected);
      const page = await publicPage(f.url, site.domain);
      const result = verifyPublicHtml(f.field, apiExpected, page.html, actual.imageUrl, page.robots);
      v.publicMatches = result.matches; v.url = page.url;
      v.state = v.apiMatches && v.publicMatches ? "verified" : "mismatch";
      v.reason = v.state === "verified" ? "Platform value and public page both checked." : !v.apiMatches ? "The platform value does not match this change. A newer edit may have replaced it." : result.reason;
    }
  } catch (e) { v.reason = (e as Error).message.slice(0, 400); }
  // An older verification must not overwrite the result of a new publish or rollback.
  let q = db.from("fixes").update({ data: { ...(f.data || {}), verification: v } }).eq("id", f.id).eq("site_id", f.site_id).eq("status", f.status).eq("after", f.after);
  q = f.deployed_at ? q.eq("deployed_at", f.deployed_at) : q.is("deployed_at", null);
  const { error } = await q;
  if (error) throw new Error(error.message);
  return v;
}

export async function verifyBatch(db: any, shopify: any, secretFor: any, siteId?: string, ids?: string[]) {
  let q = db.from("fixes").select("*").in("status", ["deployed", "rolled_back"]).order("deployed_at", { ascending: false }).limit(1000);
  if (siteId) q = q.eq("site_id", siteId);
  if (ids?.length) q = q.in("id", ids.slice(0, 20));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const candidates = (data || []).filter((f: any) => ids?.length || !f.data?.verification || (f.data.verification.state !== "verified" && f.data.verification.state !== "manual_check" && (f.data.verification.attempts || 0) < 3)).slice(0, 6);
  const out = { checked: 0, verified: 0, needsAttention: 0 };
  for (let i = 0; i < candidates.length; i += 3) await Promise.all(candidates.slice(i, i + 3).map(async (f: any) => {
    const { data: site } = await db.from("sites").select("domain").eq("id", f.site_id).single();
    const { data: cs } = await db.from("connectors").select("*").eq("site_id", f.site_id).eq("status", "connected").in("type", ["shopify", "webflow"]);
    const c = (cs || []).find((c: any) => c.type === f.platform) || (cs || [])[0];
    if (!site || !c) return;
    const v = await verifyFix(db, shopify, secretFor, c, site, f);
    out.checked++; v.state === "verified" ? out.verified++ : out.needsAttention++;
  }));
  return out;
}


