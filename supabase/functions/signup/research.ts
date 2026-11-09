// AI research for self-serve sign-up: what the business offers, where, and who it really competes with.
// Claude searches the web for the searches customers make and reports the businesses that win them.
import Anthropic from "npm:@anthropic-ai/sdk@1.6.0";
import type { SiteRead } from "./read.ts";
import { bare } from "./read.ts";

const MODEL = "claude-opus-5-5";
// Directories, marketplaces and social networks are where competitors appear, not competitors themselves.
const NOT_COMPETITORS = /(^|\.)(amazon|ebay|walmart|target|etsy|alibaba|aliexpress|yelp|tripadvisor|yellowpages|bbb|facebook|instagram|tiktok|youtube|linkedin|pinterest|reddit|quora|twitter|x|wikipedia|google|apple|doordash|ubereats|grubhub|instacart|thumbtack|angi|homeadvisor|nextdoor|indeed|glassdoor|mapquest|foursquare)\.[a-z.]+$/i;

export type Competitor = { name: string; domain: string; reason: string };
export type Research = {
  name: string; description: string; industry: string; customers: string; model: string;
  locations: string; service_area: string; keyword: string; competitors: Competitor[];
};

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["name", "description", "industry", "customers", "model", "locations", "service_area", "keyword", "competitors"],
  properties: {
    name: { type: "string" }, description: { type: "string" }, industry: { type: "string" }, customers: { type: "string" },
    model: { type: "string" }, locations: { type: "string" }, service_area: { type: "string" }, keyword: { type: "string" },
    competitors: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "domain", "reason"], properties: { name: { type: "string" }, domain: { type: "string" }, reason: { type: "string" } } } },
  },
};

const SYSTEM = `You research small and mid-sized businesses for Impackt Media, a marketing agency, while the owner signs up. Your findings pre-fill their workspace, so they must be accurate: the owner will see them on screen in a minute.

Work from the website facts provided, and use web search to confirm the market and find competitors:
- Describe what the business sells or does, for whom, and where, in plain words the owner would recognise. Do not repeat marketing slogans or invent claims (certifications, awards, years in business) that the sources don't state.
- keyword: the 2–5 word search customers would type to find this kind of business (add the city or region when the business is local).
- competitors: up to 5 businesses that win that search or are clearly compared with this one by customers. Search for the keyword and one or two close variations. When the results are mostly directories, marketplaces or "best of" lists, take the businesses those pages name and search for their own websites. Each competitor must be a real business with its own website; list that website's domain, never the directory's. Exclude this business and its own domains. Prefer competitors in the same market and area. Fewer, correct competitors are better than five guesses; only return an empty list if you genuinely cannot find any.
- reason: one short sentence on why it competes (what it sells to the same customers, or that it ranks for the keyword).
- Leave a field as an empty string when the sources don't support it.

Finish with one JSON object in a \`\`\`json code block, with exactly these keys: name, description, industry, customers, model (how it operates, e.g. "Online delivery", "Storefront", "Service area"), locations (physical addresses, one per line), service_area, keyword, competitors (array of {name, domain, reason}; domain without https:// or www).`;

function facts(site: SiteRead) {
  return [
    `Website: ${site.domain}`,
    site.readable ? "" : `(The website couldn't be read directly: ${site.error}. Use web search to learn about it.)`,
    site.name && `Name on the site: ${site.name}`,
    site.title && `Page title: ${site.title}`,
    site.description && `Meta description: ${site.description}`,
    site.headings.length ? `Headings: ${site.headings.join(" | ")}` : "",
    site.places.length ? `Addresses on the site: ${site.places.join(" | ")}` : "",
    site.areas.length ? `Areas served (structured data): ${site.areas.join(" | ")}` : "",
    site.platform !== "other" ? `Website platform: ${site.platform}` : "",
    site.text && `Page text (excerpt): ${site.text.slice(0, 5000)}`,
  ].filter(Boolean).join("\n");
}

function lastJson(text: string): unknown {
  const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (const b of blocks.reverse()) { try { return JSON.parse(b); } catch { /* try the next one */ } }
  return null;
}

const str = (v: unknown, n = 700) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
function normalize(raw: any, ownDomain: string): Research | null {
  if (!raw || typeof raw !== "object") return null;
  console.log("signup research candidates", ownDomain, JSON.stringify((Array.isArray(raw.competitors) ? raw.competitors : []).map((c: any) => c?.domain)));
  const own = bare(ownDomain), seen = new Set<string>();
  const competitors: Competitor[] = [];
  for (const c of Array.isArray(raw.competitors) ? raw.competitors : []) {
    let host = "";
    try { host = bare(new URL(/^https?:\/\//.test(String(c?.domain)) ? String(c.domain) : "https://" + String(c?.domain || "")).hostname); } catch { continue; }
    if (!/^([a-z0-9-]+\.)+[a-z]{2,63}$/.test(host) || host === own || host.endsWith("." + own) || own.endsWith("." + host) || NOT_COMPETITORS.test(host) || seen.has(host)) continue;
    seen.add(host);
    competitors.push({ name: str(c?.name, 120) || host, domain: host, reason: str(c?.reason, 240) });
    if (competitors.length === 5) break;
  }
  return {
    name: str(raw.name, 200), description: str(raw.description, 1200), industry: str(raw.industry, 200), customers: str(raw.customers, 300),
    model: str(raw.model, 200), locations: typeof raw.locations === "string" ? raw.locations.trim().slice(0, 1500) : "", service_area: str(raw.service_area, 400),
    keyword: str(raw.keyword, 120), competitors,
  };
}

export async function research(site: SiteRead, apiKey: string): Promise<Research> {
  const client = new Anthropic({ apiKey, timeout: 150_000, maxRetries: 1 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: facts(site) + "\n\nResearch this business and its competitors." }];
  let response: Anthropic.Beta.BetaMessage | null = null;
  for (let turn = 0; turn < 4; turn++) {
    response = await client.beta.messages.create({
      model: MODEL, max_tokens: 16000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "medium" }, system: SYSTEM, messages,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
    });
    if (response.stop_reason !== "pause_turn") break; // long server-tool turn: send it back to continue
    messages.push({ role: "assistant", content: response.content });
  }
  if (!response) throw Error("No research response.");
  if (response.stop_reason === "refusal") throw Error("The research request was declined.");
  // Web search errors arrive as result blocks inside a 200 response (e.g. search disabled for the organization).
  const searchErrors = (response.content as any[]).filter((b) => b.type === "web_search_tool_result" && b.content && !Array.isArray(b.content)).map((b) => b.content.error_code);
  console.log("signup research usage", site.domain, JSON.stringify({ searches: (response.usage as any)?.server_tool_use?.web_search_requests ?? 0, searchErrors, stop: response.stop_reason }));
  const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n");
  let out = normalize(lastJson(text), site.domain);
  if (!out && text.trim()) {
    // The findings came back without parsable JSON: convert them with a schema-constrained call (no tools, no citations).
    const fix = await client.beta.messages.create({
      model: MODEL, max_tokens: 4000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: `Convert these research notes about ${site.domain} into the JSON object. Use only what the notes say.\n\n${text.slice(0, 20000)}` }],
    });
    if (fix.stop_reason !== "refusal") {
      const json = fix.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
      try { out = normalize(JSON.parse(json), site.domain); } catch { /* handled below */ }
    }
  }
  if (!out) throw Error("The research didn't return usable results.");
  return out;
}
