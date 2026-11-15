import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { MOCK, requireSecret, type ClientConfig } from "../core/config.js";
import { fetchJson, safe } from "../core/http.js";
import { defineAction } from "../core/actions.js";
import { mockMeta } from "../mock/fixtures.js";

/**
 * Meta Marketing API (Graph). Use a Business Manager *system user* token that
 * has been assigned every client ad account, so one token serves all clients.
 */
const version = () => process.env.META_API_VERSION || "v24.0";
const GRAPH = () => `https://graph.facebook.com/${version()}`;

function adAccount(client: ClientConfig) {
  const id = client.ads.meta?.adAccountId;
  if (!id) throw new Error(`${client.name} has no Meta ad account in its config`);
  return id.startsWith("act_") ? id : `act_${id}`;
}

async function graphGet(pathAndQuery: string, params: Record<string, string>): Promise<any> {
  if (MOCK) return mockMeta(pathAndQuery, params);
  const qs = new URLSearchParams({ ...params, access_token: requireSecret("META_ACCESS_TOKEN") });
  const out: any[] = [];
  let url: string | undefined = `${GRAPH()}/${pathAndQuery}?${qs}`;
  // Follow paging (cursor URLs already carry the token).
  while (url && out.length < 2000) {
    const res: any = await fetchJson(url);
    if (!Array.isArray(res.data)) return res;
    out.push(...res.data);
    url = res.paging?.next;
  }
  return { data: out };
}

async function graphPost(objectId: string, body: Record<string, string>) {
  const qs = new URLSearchParams({ ...body, access_token: requireSecret("META_ACCESS_TOKEN") });
  return fetchJson(`${GRAPH()}/${objectId}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: qs.toString(),
  });
}

const DatePreset = z.enum(["last_7d", "last_14d", "last_30d", "this_month", "last_month"]).default("last_30d");

/** Collapse Meta's `actions` arrays into the handful of results agencies care about. */
const RESULT_TYPES = ["purchase", "offsite_conversion.fb_pixel_purchase", "lead", "offsite_conversion.fb_pixel_lead", "complete_registration", "onsite_web_lead"];
function results(row: any) {
  const pick = (arr: any[] | undefined) =>
    Object.fromEntries(
      (arr ?? []).filter((a) => RESULT_TYPES.includes(a.action_type)).map((a) => [a.action_type, Number(a.value)]),
    );
  const spend = Number(row.spend ?? 0);
  const conv = pick(row.actions);
  const value = pick(row.action_values);
  const purchases = conv["purchase"] ?? conv["offsite_conversion.fb_pixel_purchase"];
  const leads = conv["lead"] ?? conv["offsite_conversion.fb_pixel_lead"] ?? conv["onsite_web_lead"];
  const purchaseValue = value["purchase"] ?? value["offsite_conversion.fb_pixel_purchase"];
  return {
    spend,
    impressions: Number(row.impressions ?? 0),
    reach: row.reach !== undefined ? Number(row.reach) : undefined,
    frequency: row.frequency !== undefined ? Math.round(Number(row.frequency) * 100) / 100 : undefined,
    ctrPct: row.ctr !== undefined ? Math.round(Number(row.ctr) * 100) / 100 : undefined,
    cpm: row.cpm !== undefined ? Math.round(Number(row.cpm) * 100) / 100 : undefined,
    purchases,
    purchaseValue,
    roas: purchases && spend ? Math.round(((purchaseValue ?? 0) / spend) * 100) / 100 : undefined,
    leads,
    costPerLead: leads && spend ? Math.round((spend / leads) * 100) / 100 : undefined,
    costPerPurchase: purchases && spend ? Math.round((spend / purchases) * 100) / 100 : undefined,
  };
}

const INSIGHT_FIELDS = "spend,impressions,reach,frequency,ctr,cpm,actions,action_values";

export function metaAdsTools(client: ClientConfig) {
  if (!client.ads.meta) return [];
  return [
    betaZodTool({
      name: "meta_campaigns",
      description:
        "Meta (Facebook/Instagram) campaigns: status, objective, budget (in account currency) and performance for a date preset. Meta's default attribution is 7-day click / 1-day view - never add these conversions to Google's.",
      inputSchema: z.object({ datePreset: DatePreset }),
      run: ({ datePreset }) =>
        safe(async () => {
          const act = adAccount(client);
          const [campaigns, insights] = await Promise.all([
            graphGet(`${act}/campaigns`, {
              fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget",
              limit: "200",
            }),
            graphGet(`${act}/insights`, { level: "campaign", fields: `campaign_id,${INSIGHT_FIELDS}`, date_preset: datePreset, limit: "500" }),
          ]);
          const byId = new Map<string, any>((insights.data ?? []).map((r: any) => [r.campaign_id, r]));
          return {
            datePreset,
            campaigns: (campaigns.data ?? []).map((c: any) => ({
              id: c.id,
              name: c.name,
              status: c.effective_status ?? c.status,
              objective: c.objective,
              // Meta returns budgets in the currency's minor unit (cents).
              dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
              lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
              ...results(byId.get(c.id) ?? {}),
            })),
          };
        }),
    }),
    betaZodTool({
      name: "meta_ads",
      description:
        "Ad-level Meta performance (top 100 by spend) with frequency and CTR, for creative fatigue and kill/scale calls. Includes ad set ids and budgets for ad-set-budget (ABO) accounts.",
      inputSchema: z.object({ datePreset: DatePreset, campaignId: z.string().optional() }),
      run: ({ datePreset, campaignId }) =>
        safe(async () => {
          const act = adAccount(client);
          const params: Record<string, string> = {
            level: "ad",
            fields: `ad_id,ad_name,adset_id,adset_name,campaign_name,${INSIGHT_FIELDS}`,
            date_preset: datePreset,
            sort: "spend_descending",
            limit: "100",
          };
          if (campaignId) params.filtering = JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: campaignId }]);
          const insights = await graphGet(`${act}/insights`, params);
          return (insights.data ?? []).slice(0, 100).map((r: any) => ({
            adId: r.ad_id,
            ad: r.ad_name,
            adSetId: r.adset_id,
            adSet: r.adset_name,
            campaign: r.campaign_name,
            ...results(r),
          }));
        }),
    }),
    betaZodTool({
      name: "meta_daily_trend",
      description: "Account-level daily Meta spend and results for the last N days (up to 90), for the trailing baseline.",
      inputSchema: z.object({ days: z.number().int().min(7).max(90).default(56) }),
      run: ({ days }) =>
        safe(async () => {
          const until = new Date(Date.now() - 86_400_000);
          const since = new Date(until.getTime() - (days - 1) * 86_400_000);
          const d = (x: Date) => x.toISOString().slice(0, 10);
          const res = await graphGet(`${adAccount(client)}/insights`, {
            level: "account",
            fields: `date_start,${INSIGHT_FIELDS}`,
            time_range: JSON.stringify({ since: d(since), until: d(until) }),
            time_increment: "1",
            limit: "100",
          });
          return (res.data ?? []).map((r: any) => ({ date: r.date_start, ...results(r) }));
        }),
    }),
  ];
}

// ---------- write actions (only run after human approval) ----------

export const metaSetStatus = defineAction({
  name: "meta.set_status",
  description: "Pause or re-activate a Meta campaign, ad set or ad by id.",
  params: z.object({ objectId: z.string(), status: z.enum(["PAUSED", "ACTIVE"]) }),
  execute: async (_client, p) => {
    await graphPost(p.objectId, { status: p.status });
    return `Set ${p.objectId} to ${p.status}`;
  },
});

export const metaSetDailyBudget = defineAction({
  name: "meta.set_daily_budget",
  description: "Change the daily budget of a Meta campaign (CBO) or ad set (ABO). Amounts in account currency, not cents.",
  params: z.object({
    objectId: z.string(),
    currentDailyBudget: z.number().positive(),
    newDailyBudget: z.number().positive(),
  }),
  validate: (client, p) => {
    const pct = (Math.abs(p.newDailyBudget - p.currentDailyBudget) / p.currentDailyBudget) * 100;
    if (pct > client.guardrails.maxBudgetChangePct)
      return `change of ${pct.toFixed(0)}% exceeds the ${client.guardrails.maxBudgetChangePct}% limit; scale in smaller steps`;
  },
  execute: async (_client, p) => {
    await graphPost(p.objectId, { daily_budget: String(Math.round(p.newDailyBudget * 100)) });
    return `Daily budget for ${p.objectId}: ${p.currentDailyBudget} -> ${p.newDailyBudget}`;
  },
});

export const metaActions = [metaSetStatus, metaSetDailyBudget];
