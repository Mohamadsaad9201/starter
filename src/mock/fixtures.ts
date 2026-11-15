/**
 * Sample data so the agents can be demoed and tested with MOCK_DATA=1 and no
 * ad-platform credentials. Shapes match the real API responses. The numbers
 * are invented and deliberately contain problems for the agent to find:
 * a wasteful search term, a fatigued Meta ad, a budget-capped winner, and a
 * landing page missing its Meta Pixel.
 */
import type { PageSnapshot } from "../integrations/sites/crawler.js";

const micros = (n: number) => String(Math.round(n * 1_000_000));

export function mockGoogleAds(query: string): any[] {
  const from = query.match(/\bFROM\s+(\w+)/i)?.[1]?.toLowerCase();
  if (from === "campaign") {
    const c = (id: string, name: string, channel: string, budget: number, cost: number, clicks: number, impr: number, conv: number, value: number) => ({
      campaign: { id, name, status: "ENABLED", advertisingChannelType: channel, biddingStrategyType: "MAXIMIZE_CONVERSIONS" },
      campaignBudget: { amountMicros: micros(budget), resourceName: `customers/1234567890/campaignBudgets/${id}9` },
      metrics: { costMicros: micros(cost), clicks: String(clicks), impressions: String(impr), conversions: conv, conversionsValue: value, allConversions: conv * 1.4 },
    });
    return [
      c("111", "GOOG_Search_NonBrand_Services", "SEARCH", 150, 4380, 1620, 41200, 58, 0),
      c("222", "GOOG_Search_Brand", "SEARCH", 30, 610, 940, 3100, 71, 0),
      c("333", "GOOG_PMax_AllServices", "PERFORMANCE_MAX", 80, 2390, 2210, 188000, 21, 0),
    ];
  }
  if (from === "search_term_view") {
    const t = (term: string, campaignId: string, cost: number, clicks: number, conv: number) => ({
      searchTermView: { searchTerm: term, status: "NONE" },
      campaign: { id: campaignId, name: campaignId === "111" ? "GOOG_Search_NonBrand_Services" : "GOOG_Search_Brand" },
      adGroup: { name: "Core" },
      metrics: { costMicros: micros(cost), clicks: String(clicks), impressions: String(clicks * 22), conversions: conv, conversionsValue: 0 },
    });
    return [
      t("emergency plumber near me", "111", 912, 301, 19),
      t("plumbing jobs hiring", "111", 418, 166, 0),
      t("how to fix leaking tap diy", "111", 233, 121, 0),
      t("water heater replacement cost", "111", 520, 140, 9),
      t("plumber salary", "111", 141, 58, 0),
      t("acme plumbing", "222", 300, 520, 44),
    ];
  }
  if (from === "customer") {
    const rows = [];
    const today = new Date();
    for (let i = 56; i >= 1; i--) {
      const d = new Date(today.getTime() - i * 86_400_000);
      const recent = i <= 7;
      const cost = 245 + (i % 7) * 6 + (recent ? 20 : 0);
      rows.push({
        segments: { date: d.toISOString().slice(0, 10) },
        metrics: { costMicros: micros(cost), clicks: String(150 + (i % 5) * 4), impressions: String(7800), conversions: recent ? 4.1 : 5.3, conversionsValue: 0 },
      });
    }
    return rows;
  }
  return [];
}

export function mockMeta(pathAndQuery: string, params: Record<string, string>): any {
  if (pathAndQuery.endsWith("/campaigns")) {
    return {
      data: [
        { id: "6001", name: "META_Leads_Broad_FreeQuote", status: "ACTIVE", effective_status: "ACTIVE", objective: "OUTCOME_LEADS", daily_budget: "12000" },
        { id: "6002", name: "META_Retargeting_Visitors30d", status: "ACTIVE", effective_status: "ACTIVE", objective: "OUTCOME_LEADS", daily_budget: "3000" },
      ],
    };
  }
  const lead = (n: number) => [{ action_type: "lead", value: String(n) }];
  if (params.level === "campaign") {
    return {
      data: [
        { campaign_id: "6001", spend: "3540.20", impressions: "402000", reach: "151000", frequency: "2.66", ctr: "1.12", cpm: "8.81", actions: lead(97) },
        { campaign_id: "6002", spend: "905.10", impressions: "61000", reach: "9100", frequency: "6.70", ctr: "0.61", cpm: "14.84", actions: lead(11) },
      ],
    };
  }
  if (params.level === "ad") {
    return {
      data: [
        { ad_id: "7001", ad_name: "UGC_Testimonial_Sarah", adset_id: "6501", adset_name: "Broad_US", campaign_name: "META_Leads_Broad_FreeQuote", spend: "1910.00", impressions: "210000", frequency: "2.10", ctr: "1.41", cpm: "9.10", actions: lead(68) },
        { ad_id: "7002", ad_name: "Static_BeforeAfter_v1", adset_id: "6501", adset_name: "Broad_US", campaign_name: "META_Leads_Broad_FreeQuote", spend: "1630.20", impressions: "192000", frequency: "3.90", ctr: "0.71", cpm: "8.49", actions: lead(29) },
        { ad_id: "7003", ad_name: "Retarg_Same_Offer", adset_id: "6502", adset_name: "Visitors_30d", campaign_name: "META_Retargeting_Visitors30d", spend: "905.10", impressions: "61000", frequency: "6.70", ctr: "0.61", cpm: "14.84", actions: lead(11) },
      ],
    };
  }
  if (params.level === "account") {
    const data = [];
    for (let i = 56; i >= 1; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      data.push({ date_start: d, spend: String(140 + (i % 4) * 5), impressions: "15000", frequency: String(2 + (56 - i) * 0.03), ctr: String(1.2 - (56 - i) * 0.006), actions: lead(i <= 7 ? 3 : 4) });
    }
    return { data };
  }
  return { data: [] };
}

export function mockPage(url: string): PageSnapshot {
  const u = new URL(url);
  return {
    requestedUrl: url,
    finalUrl: url,
    status: 200,
    redirected: false,
    responseMs: u.pathname.includes("quote") ? 3900 : 820,
    htmlKb: 312,
    title: "Acme Plumbing | 24/7 Emergency Plumbers",
    metaDescription: u.pathname === "/" ? undefined : "Licensed plumbers available 24/7. Free quotes.",
    canonical: url,
    lang: "en",
    h1: ["Fast, Licensed Plumbers"],
    h2Count: 5,
    wordCount: 640,
    imageCount: 14,
    imagesMissingAlt: 6,
    internalLinks: 38,
    externalLinks: 3,
    openGraph: { "og:title": "Acme Plumbing" },
    jsonLdTypes: ["Organization"],
    hreflang: [],
    platformHints: ["framer"],
    tracking: { gtm: true, ga4: true, googleAds: true, metaPixel: false, tiktokPixel: false },
  };
}
