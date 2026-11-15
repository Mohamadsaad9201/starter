import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { MOCK, requireSecret, secret, type ClientConfig } from "../core/config.js";
import { fetchJson, safe } from "../core/http.js";
import { defineAction } from "../core/actions.js";
import { mockGoogleAds } from "../mock/fixtures.js";

/**
 * Google Ads REST API. One agency manager (MCC) login reaches every client
 * account; each client config holds its own customerId.
 */
const version = () => process.env.GOOGLE_ADS_API_VERSION || "v26";
const digits = (id: string) => id.replace(/\D/g, "");

let cachedToken: { token: string; expires: number } | undefined;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;
  const res = await fetchJson<{ access_token: string; expires_in: number }>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireSecret("GOOGLE_ADS_CLIENT_ID"),
      client_secret: requireSecret("GOOGLE_ADS_CLIENT_SECRET"),
      refresh_token: requireSecret("GOOGLE_ADS_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }).toString(),
  });
  cachedToken = { token: res.access_token, expires: Date.now() + res.expires_in * 1000 };
  return res.access_token;
}

function account(client: ClientConfig) {
  const g = client.ads.googleAds;
  if (!g) throw new Error(`${client.name} has no Google Ads account in its config`);
  return { customerId: digits(g.customerId), login: digits(g.loginCustomerId ?? secret("GOOGLE_ADS_LOGIN_CUSTOMER_ID") ?? "") };
}

async function headers(client: ClientConfig) {
  const { login } = account(client);
  return {
    authorization: `Bearer ${await accessToken()}`,
    "developer-token": requireSecret("GOOGLE_ADS_DEVELOPER_TOKEN"),
    ...(login ? { "login-customer-id": login } : {}),
  };
}

export async function gaql(client: ClientConfig, query: string): Promise<any[]> {
  if (MOCK) return mockGoogleAds(query);
  const { customerId } = account(client);
  const rows: any[] = [];
  let pageToken: string | undefined;
  do {
    const res = await fetchJson<{ results?: any[]; nextPageToken?: string }>(
      `https://googleads.googleapis.com/${version()}/customers/${customerId}/googleAds:search`,
      { method: "POST", headers: await headers(client), body: JSON.stringify({ query, pageToken }) },
    );
    rows.push(...(res.results ?? []));
    pageToken = res.nextPageToken;
  } while (pageToken && rows.length < 5000);
  return rows;
}

async function mutate(client: ClientConfig, resource: string, operations: unknown[]) {
  const { customerId } = account(client);
  return fetchJson(`https://googleads.googleapis.com/${version()}/customers/${customerId}/${resource}:mutate`, {
    method: "POST",
    headers: await headers(client),
    body: JSON.stringify({ operations }),
  });
}

// ---------- shaping helpers (micros -> currency, compute ratios) ----------

const money = (micros: unknown) => Math.round(Number(micros ?? 0) / 10_000) / 100;
const ratio = (a: number, b: number) => (b ? Math.round((a / b) * 100) / 100 : null);

function shapeMetrics(m: any = {}) {
  const cost = money(m.costMicros);
  const conv = Number(m.conversions ?? 0);
  const value = Number(m.conversionsValue ?? 0);
  const clicks = Number(m.clicks ?? 0);
  const impr = Number(m.impressions ?? 0);
  return {
    cost,
    impressions: impr,
    clicks,
    ctrPct: impr ? Math.round((clicks / impr) * 10000) / 100 : null,
    cpc: ratio(cost, clicks),
    conversions: Math.round(conv * 100) / 100,
    allConversions: m.allConversions !== undefined ? Math.round(Number(m.allConversions) * 100) / 100 : undefined,
    convValue: Math.round(value * 100) / 100,
    cpa: ratio(cost, conv),
    roas: ratio(value, cost),
  };
}

const DateRange = z
  .enum(["LAST_7_DAYS", "LAST_14_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"])
  .default("LAST_30_DAYS");

// ---------- read tools ----------

export function googleAdsTools(client: ClientConfig) {
  if (!client.ads.googleAds) return [];
  return [
    betaZodTool({
      name: "google_ads_campaigns",
      description:
        "Google Ads campaign performance for a date range: status, channel, bidding, daily budget, cost, clicks, conversions, CPA, ROAS. Money is in account currency.",
      inputSchema: z.object({ dateRange: DateRange }),
      run: ({ dateRange }) =>
        safe(async () => {
          const rows = await gaql(
            client,
            `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
                    campaign.bidding_strategy_type, campaign_budget.amount_micros, campaign_budget.resource_name,
                    metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions,
                    metrics.conversions_value, metrics.all_conversions
             FROM campaign
             WHERE segments.date DURING ${dateRange} AND campaign.status != 'REMOVED'
             ORDER BY metrics.cost_micros DESC`,
          );
          return {
            dateRange,
            campaigns: rows.map((r) => ({
              id: r.campaign?.id,
              name: r.campaign?.name,
              status: r.campaign?.status,
              channel: r.campaign?.advertisingChannelType,
              bidding: r.campaign?.biddingStrategyType,
              dailyBudget: money(r.campaignBudget?.amountMicros),
              budgetResourceName: r.campaignBudget?.resourceName,
              ...shapeMetrics(r.metrics),
            })),
          };
        }),
    }),
    betaZodTool({
      name: "google_ads_search_terms",
      description:
        "Search terms report (top 200 by cost). Note: Google withholds low-volume terms, so this is a sample - compare its clicks to campaign clicks before calling spend wasted.",
      inputSchema: z.object({ dateRange: DateRange, campaignId: z.string().optional() }),
      run: ({ dateRange, campaignId }) =>
        safe(async () => {
          const rows = await gaql(
            client,
            `SELECT search_term_view.search_term, search_term_view.status, campaign.id, campaign.name, ad_group.name,
                    metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
             FROM search_term_view
             WHERE segments.date DURING ${dateRange}${campaignId ? ` AND campaign.id = ${digits(campaignId)}` : ""}
             ORDER BY metrics.cost_micros DESC LIMIT 200`,
          );
          return rows.map((r) => ({
            term: r.searchTermView?.searchTerm,
            status: r.searchTermView?.status,
            campaignId: r.campaign?.id,
            campaign: r.campaign?.name,
            adGroup: r.adGroup?.name,
            ...shapeMetrics(r.metrics),
          }));
        }),
    }),
    betaZodTool({
      name: "google_ads_daily_trend",
      description:
        "Account-level daily cost / clicks / conversions for the last N days (up to 90), to set the trailing 6-8 week baseline and spot when a change started.",
      inputSchema: z.object({ days: z.number().int().min(7).max(90).default(56) }),
      run: ({ days }) =>
        safe(async () => {
          const end = new Date(Date.now() - 86_400_000);
          const start = new Date(end.getTime() - (days - 1) * 86_400_000);
          const d = (x: Date) => x.toISOString().slice(0, 10);
          const rows = await gaql(
            client,
            `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
             FROM customer WHERE segments.date BETWEEN '${d(start)}' AND '${d(end)}' ORDER BY segments.date`,
          );
          return rows.map((r) => ({ date: r.segments?.date, ...shapeMetrics(r.metrics) }));
        }),
    }),
    betaZodTool({
      name: "google_ads_query",
      description:
        "Run any read-only GAQL query (SELECT ... FROM ...) for data the other tools don't cover, e.g. keyword_view, ad_group_ad, change_event (needs a date filter within 30 days and a LIMIT). Money fields are in micros.",
      inputSchema: z.object({ query: z.string() }),
      run: ({ query }) =>
        safe(async () => {
          if (!/^\s*select\s/i.test(query)) throw new Error("Only SELECT queries are allowed");
          const rows = await gaql(client, query);
          return { rowCount: rows.length, rows: rows.slice(0, 300) };
        }),
    }),
  ];
}

// ---------- write actions (only run after human approval) ----------

export const pauseCampaign = defineAction({
  name: "google_ads.pause_campaign",
  description: "Pause a Google Ads campaign.",
  params: z.object({ campaignId: z.string() }),
  execute: async (client, { campaignId }) => {
    const { customerId } = account(client);
    await mutate(client, "campaigns", [
      { update: { resourceName: `customers/${customerId}/campaigns/${digits(campaignId)}`, status: "PAUSED" }, updateMask: "status" },
    ]);
    return `Paused campaign ${campaignId}`;
  },
});

export const setCampaignBudget = defineAction({
  name: "google_ads.set_campaign_budget",
  description: "Change a campaign's daily budget (account currency, not micros). Use the budgetResourceName from google_ads_campaigns.",
  params: z.object({
    campaignId: z.string(),
    budgetResourceName: z.string(),
    currentDailyBudget: z.number().positive(),
    newDailyBudget: z.number().positive(),
  }),
  validate: (client, p) => {
    const pct = (Math.abs(p.newDailyBudget - p.currentDailyBudget) / p.currentDailyBudget) * 100;
    if (pct > client.guardrails.maxBudgetChangePct)
      return `change of ${pct.toFixed(0)}% exceeds the ${client.guardrails.maxBudgetChangePct}% limit; split it into smaller steps`;
  },
  execute: async (client, p) => {
    await mutate(client, "campaignBudgets", [
      {
        update: { resourceName: p.budgetResourceName, amountMicros: String(Math.round(p.newDailyBudget * 1_000_000)) },
        updateMask: "amount_micros",
      },
    ]);
    return `Budget for campaign ${p.campaignId}: ${p.currentDailyBudget} -> ${p.newDailyBudget}/day`;
  },
});

export const addNegativeKeyword = defineAction({
  name: "google_ads.add_negative_keyword",
  description: "Add a campaign-level negative keyword. Only for terms seen in the search terms report.",
  params: z.object({
    campaignId: z.string(),
    text: z.string().min(1),
    matchType: z.enum(["EXACT", "PHRASE", "BROAD"]),
  }),
  execute: async (client, p) => {
    const { customerId } = account(client);
    await mutate(client, "campaignCriteria", [
      {
        create: {
          campaign: `customers/${customerId}/campaigns/${digits(p.campaignId)}`,
          negative: true,
          keyword: { text: p.text, matchType: p.matchType },
        },
      },
    ]);
    return `Added negative [${p.matchType}] "${p.text}" to campaign ${p.campaignId}`;
  },
});

export const googleAdsActions = [pauseCampaign, setCampaignBudget, addNegativeKeyword];
