import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

export const ROOT = process.cwd();
export const CLIENTS_DIR = path.join(ROOT, "clients");
export const DATA_DIR = path.join(ROOT, "data");

const SitePlatform = z.enum(["shopify", "wordpress", "framer", "netlify", "other"]);

const SiteSchema = z.object({
  url: z.string().url(),
  platform: SitePlatform,
  shopify: z.object({ shopDomain: z.string() }).optional(),
  wordpress: z.object({ baseUrl: z.string().url(), username: z.string() }).optional(),
  netlify: z.object({ siteId: z.string(), repo: z.string().optional() }).optional(),
});

const LocationSchema = z.object({
  name: z.string(),
  address: z.string(),
  phone: z.string().optional(),
  city: z.string().optional(),
  primaryCategory: z.string().optional(),
});

export const ClientSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  industry: z.string().optional(),
  businessType: z.enum(["ecommerce", "lead-gen", "local-service", "saas", "other"]).default("other"),
  currency: z.string().default("USD"),
  goals: z
    .object({
      targetCpa: z.number().optional(),
      targetRoas: z.number().optional(),
      monthlyAdBudget: z.number().optional(),
      primaryConversion: z.string().optional(),
    })
    .default({}),
  brandTerms: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]),
  notes: z.string().default(""),
  ads: z
    .object({
      googleAds: z.object({ customerId: z.string(), loginCustomerId: z.string().optional() }).optional(),
      meta: z.object({ adAccountId: z.string() }).optional(),
    })
    .default({}),
  sites: z.array(SiteSchema).default([]),
  locations: z.array(LocationSchema).default([]),
  guardrails: z
    .object({
      /** Largest single budget change an agent may propose, in percent. */
      maxBudgetChangePct: z.number().default(20),
      /** If false, approved changes are recorded but never pushed to live accounts. */
      allowLiveWrites: z.boolean().default(false),
    })
    .default({ maxBudgetChangePct: 20, allowLiveWrites: false }),
});

export type ClientConfig = z.infer<typeof ClientSchema>;
export type SiteConfig = z.infer<typeof SiteSchema>;

export function listClients(): ClientConfig[] {
  if (!existsSync(CLIENTS_DIR)) return [];
  return readdirSync(CLIENTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadClientFile(path.join(CLIENTS_DIR, f)));
}

export function loadClient(slug: string): ClientConfig {
  const file = path.join(CLIENTS_DIR, `${slug}.json`);
  if (!existsSync(file)) {
    const known = listClients().map((c) => c.slug).join(", ") || "(none)";
    throw new Error(`No client "${slug}". Known clients: ${known}`);
  }
  return loadClientFile(file);
}

function loadClientFile(file: string): ClientConfig {
  const parsed = ClientSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    throw new Error(`Invalid client config ${path.basename(file)}:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/**
 * Secrets live in env vars, never in client JSON. A per-client value
 * (NAME_<SLUG>) wins over the agency-wide one (NAME).
 */
export function secret(name: string, slug?: string): string | undefined {
  if (slug) {
    const scoped = process.env[`${name}_${slug.toUpperCase().replace(/-/g, "_")}`];
    if (scoped) return scoped;
  }
  return process.env[name] || undefined;
}

export function requireSecret(name: string, slug?: string): string {
  const v = secret(name, slug);
  if (!v) {
    const scoped = slug ? ` (or ${name}_${slug.toUpperCase().replace(/-/g, "_")})` : "";
    throw new Error(`Missing env var ${name}${scoped}. See .env.example.`);
  }
  return v;
}

export const MOCK = process.env.MOCK_DATA === "1";
