import type { AgentDefinition } from "../core/agent.js";
import { paidAdsAgent } from "./paid-ads/index.js";

/** Every agent the product sells. Each is standalone: own prompt, tools, playbooks and schedule. */
export const agents: Record<string, AgentDefinition> = {
  [paidAdsAgent.id]: paidAdsAgent,
};

/** On the roadmap; listed so the CLI/dashboard can show them. */
export const plannedAgents = [
  { id: "seo", name: "SEO Agent", skills: ["seo-audit", "schema", "site-architecture", "content-strategy", "programmatic-seo"] },
  { id: "local-seo", name: "Local SEO Agent", skills: ["seo-audit (local-seo references)", "schema"] },
  { id: "ai-visibility", name: "AI Visibility Agent", skills: ["ai-seo", "schema"] },
];
