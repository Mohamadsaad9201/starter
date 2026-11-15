import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { MOCK, requireSecret, type ClientConfig, type SiteConfig } from "../../core/config.js";
import { fetchJson, safe } from "../../core/http.js";
import { defineAction } from "../../core/actions.js";
import { inspectPage, siteIndex } from "./crawler.js";

/**
 * One interface over every host the agency uses:
 *  - Reading: the crawler works on all of them; Shopify/WordPress/Netlify APIs add CMS detail.
 *  - Writing: Shopify (Admin API) and WordPress (REST) can be changed directly after approval.
 *    Framer has no public content-write API for this, and Netlify sites change via their git
 *    repo, so those become a "manual change" ticket with exact instructions.
 */

const SHOPIFY_VERSION = () => process.env.SHOPIFY_API_VERSION || "2026-10";

function siteFor(client: ClientConfig, url: string): SiteConfig {
  const host = new URL(url).host.replace(/^www\./, "");
  const site = client.sites.find((s) => new URL(s.url).host.replace(/^www\./, "") === host);
  if (!site) throw new Error(`${url} is not one of ${client.name}'s configured sites`);
  return site;
}

async function shopifyGql(client: ClientConfig, site: SiteConfig, query: string, variables: object = {}) {
  const shop = site.shopify?.shopDomain;
  if (!shop) throw new Error(`Site ${site.url} has no shopify.shopDomain configured`);
  const res = await fetchJson<{ data?: any; errors?: unknown }>(`https://${shop}/admin/api/${SHOPIFY_VERSION()}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": requireSecret("SHOPIFY_TOKEN", client.slug) },
    body: JSON.stringify({ query, variables }),
  });
  if (res.errors) throw new Error(`Shopify: ${JSON.stringify(res.errors).slice(0, 500)}`);
  return res.data;
}

function wpAuth(client: ClientConfig, site: SiteConfig) {
  const wp = site.wordpress;
  if (!wp) throw new Error(`Site ${site.url} has no wordpress config`);
  const pass = requireSecret("WORDPRESS_APP_PASSWORD", client.slug);
  return { base: wp.baseUrl.replace(/\/$/, ""), header: `Basic ${Buffer.from(`${wp.username}:${pass}`).toString("base64")}` };
}

/** CMS-level listing of pages with their stored SEO fields. */
async function listCmsPages(client: ClientConfig, site: SiteConfig) {
  if (MOCK) return { note: "sample data", pages: [] };
  switch (site.platform) {
    case "shopify": {
      const data = await shopifyGql(
        client,
        site,
        `{ products(first: 100, sortKey: UPDATED_AT, reverse: true) { nodes { id title handle onlineStoreUrl seo { title description } } }
           collections(first: 50) { nodes { id title handle seo { title description } } }
           pages(first: 50) { nodes { id title handle } } }`,
      );
      return { products: data.products.nodes, collections: data.collections.nodes, pages: data.pages.nodes };
    }
    case "wordpress": {
      const { base, header } = wpAuth(client, site);
      const get = (type: string) =>
        fetchJson<any[]>(`${base}/wp-json/wp/v2/${type}?per_page=100&_fields=id,link,title,modified,status,yoast_head_json`, {
          headers: { authorization: header },
        });
      const [pages, posts] = await Promise.all([get("pages"), get("posts")]);
      const shape = (p: any) => ({
        id: p.id,
        url: p.link,
        title: p.title?.rendered,
        modified: p.modified,
        seoTitle: p.yoast_head_json?.title,
        seoDescription: p.yoast_head_json?.description,
      });
      return { pages: pages.map(shape), posts: posts.map(shape) };
    }
    case "netlify": {
      const id = site.netlify?.siteId;
      if (!id) throw new Error("netlify.siteId missing");
      const token = requireSecret("NETLIFY_TOKEN", client.slug);
      const auth = { authorization: `Bearer ${token}` };
      const [info, deploys] = await Promise.all([
        fetchJson<any>(`https://api.netlify.com/api/v1/sites/${id}`, { headers: auth }),
        fetchJson<any[]>(`https://api.netlify.com/api/v1/sites/${id}/deploys?per_page=5`, { headers: auth }),
      ]);
      return {
        note: "Netlify hosts built files; content lives in the git repo. Use site_index + site_inspect_page for pages.",
        url: info.ssl_url ?? info.url,
        repo: info.build_settings?.repo_url,
        branch: info.build_settings?.repo_branch,
        recentDeploys: deploys.map((d) => ({ state: d.state, created: d.created_at, title: d.title, error: d.error_message })),
      };
    }
    case "framer":
    case "other":
      return { note: `No CMS API for ${site.platform}; use site_index + site_inspect_page (reads the live site).` };
  }
}

export function siteTools(client: ClientConfig) {
  return [
    betaZodTool({
      name: "site_inspect_page",
      description:
        "Fetch a live page and extract SEO/conversion basics: status, redirects, response time, title, meta description, canonical, robots, H1s, word count, images missing alt, JSON-LD types, hreflang, Open Graph, and which tracking tags (GTM, GA4, Google Ads, Meta, TikTok) appear in the HTML. Works on any host.",
      inputSchema: z.object({ url: z.string().url() }),
      run: ({ url }) => safe(() => inspectPage(url)),
    }),
    betaZodTool({
      name: "site_index",
      description: "Read a site's robots.txt and sitemap and list up to 200 URLs.",
      inputSchema: z.object({ siteUrl: z.string().url() }),
      run: ({ siteUrl }) => safe(() => siteIndex(siteUrl)),
    }),
    betaZodTool({
      name: "cms_list_pages",
      description:
        "List pages/products/posts with their stored SEO fields straight from the CMS (Shopify Admin API, WordPress REST) or deploy info (Netlify). For Framer, says to use the crawler.",
      inputSchema: z.object({ siteUrl: z.string().url() }),
      run: ({ siteUrl }) => safe(() => listCmsPages(client, siteFor(client, siteUrl))),
    }),
  ];
}

// ---------- write actions (only after approval) ----------

export const shopifyUpdateSeo = defineAction({
  name: "shopify.update_seo",
  description: "Set the SEO title and meta description of a Shopify product or collection (gid from cms_list_pages).",
  params: z.object({
    siteUrl: z.string().url(),
    resourceGid: z.string().regex(/^gid:\/\/shopify\/(Product|Collection)\/\d+$/),
    seoTitle: z.string().max(70),
    seoDescription: z.string().max(160),
  }),
  execute: async (client, p) => {
    const site = siteFor(client, p.siteUrl);
    const isProduct = p.resourceGid.includes("/Product/");
    const mutation = isProduct
      ? `mutation($input: ProductUpdateInput!) { productUpdate(product: $input) { userErrors { field message } } }`
      : `mutation($input: CollectionInput!) { collectionUpdate(input: $input) { userErrors { field message } } }`;
    const data = await shopifyGql(client, site, mutation, {
      input: { id: p.resourceGid, seo: { title: p.seoTitle, description: p.seoDescription } },
    });
    const errors = (data.productUpdate ?? data.collectionUpdate)?.userErrors ?? [];
    if (errors.length) throw new Error(JSON.stringify(errors));
    return `Updated SEO for ${p.resourceGid}`;
  },
});

export const wordpressUpdatePost = defineAction({
  name: "wordpress.update_post",
  description: "Update the title and/or excerpt of an existing WordPress page or post by id. (SEO-plugin fields like the Yoast meta description are not writable over core REST; use site.manual_change for those.)",
  params: z.object({
    siteUrl: z.string().url(),
    type: z.enum(["pages", "posts"]),
    id: z.number().int(),
    title: z.string().optional(),
    excerpt: z.string().optional(),
  }),
  execute: async (client, p) => {
    const { base, header } = wpAuth(client, siteFor(client, p.siteUrl));
    const body: Record<string, string> = {};
    if (p.title) body.title = p.title;
    if (p.excerpt) body.excerpt = p.excerpt;
    await fetchJson(`${base}/wp-json/wp/v2/${p.type}/${p.id}`, { method: "POST", headers: { authorization: header }, body: JSON.stringify(body) });
    return `Updated WordPress ${p.type}/${p.id}`;
  },
});

export const manualChange = defineAction({
  name: "site.manual_change",
  description:
    "A website change a person must make by hand (Framer editor, a Netlify site's git repo, an SEO plugin field, theme code). Give exact location, current value and new value. Approving it records it as done-by-hand.",
  params: z.object({
    siteUrl: z.string().url(),
    where: z.string().describe("Exact place to edit, e.g. 'Framer > Pages > /pricing > SEO settings'"),
    currentValue: z.string(),
    newValue: z.string(),
  }),
  execute: async (_client, p) => `Manual task for ${p.siteUrl}: at ${p.where}, change "${p.currentValue}" -> "${p.newValue}". Mark done once edited.`,
});

export const siteActions = [shopifyUpdateSeo, wordpressUpdatePost, manualChange];

