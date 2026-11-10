// Task guidance adapted from Corey Haines' marketingskills, MIT.
const skills: Record<string,string> = {
  "seo-audit": "Preserve the page purpose and terms already serving it. A rewrite needs a specific defect supported by the supplied page evidence. If indexing is the actual obstacle, changing wording alone cannot resolve it.",
  "site-architecture": "Link from an identifiable source page to a verified destination when that destination is a useful next step for the reader. Use descriptive anchor text. Similar subjects alone do not justify a link or consolidation.",
  "ai-seo": "Answer the buyer's question directly, then give the page-specific facts that support the answer. Use a comparison or step sequence only when the question calls for it. Never forecast a citation.",
  "content-strategy": "Identify the buyer's decision and stage. Add information the closest existing page does not already provide. Preserve separate commercial and informational purposes when useful.",
  "copywriting": "Lead with the customer's task, the specific product or service, and its supported benefit. Use one clear next action. Keep unsupported promises out of customer copy.",
  "copy-editing": "Read the proposed copy for clarity, continuity and unnecessary words. Preserve verified qualifications, product identity, location and the meaning of the original.",
  "cro": "Address the highest-friction buyer question supported by the evidence. Make the next step clear and use only available trust signals. Avoid presenting a conversion lift as established.",
  "customer-research": "Use actual supplied customer language or observed questions. Do not fabricate quotations, recurring objections, survey results or customer segments.",
  "ad-creative": "Match each variant to a single angle, audience task, placement and landing destination. Use only supplied offer terms and creative facts. Never label an untested variant a winner.",
  "ads": "Connect the campaign objective to a conversion and landing page. Identify which assumptions need evidence. Treat budgets as proposals requiring separate human authorization.",
  "conversion-tracking": "Identify the event and source that would verify the intended outcome. Distinguish a configured event from one observed firing. Never invent tracking status.",
  "attribution": "Separate platform-attributed conversions from store totals. Check windows, scope and event definitions before comparing channels. Do not sum overlapping conversions.",
  "ab-testing": "Define one hypothesis, one primary business metric and a guardrail before interpreting a change. Treat simple before-and-after movement as observational.",
  "offers": "Explain the customer benefit and verified eligibility and price terms. Do not manufacture deadlines, inventory scarcity, free shipping, margin or guarantees.",
  "competitors": "Compare like-for-like use cases with sourced, dated facts. An omitted feature in a sample is unknown. Drop unsupported competitor comparisons."
};
const byKind: Record<string,string[]> = {
  "Search listing": [
    "seo-audit",
    "copy-editing"
  ],
  "Blog post": [
    "content-strategy",
    "ai-seo",
    "site-architecture"
  ],
  "FAQ section": [
    "ai-seo",
    "customer-research",
    "copy-editing"
  ],
  "Content brief": [
    "content-strategy",
    "seo-audit"
  ],
  "Collection page copy": [
    "seo-audit",
    "site-architecture",
    "copywriting"
  ],
  "Product description": [
    "customer-research",
    "cro",
    "copywriting"
  ],
  "Landing page copy": [
    "cro",
    "copywriting"
  ],
  "Homepage section": [
    "cro",
    "copywriting"
  ],
  "About page": [
    "customer-research",
    "copy-editing"
  ],
  "Ad copy": [
    "ad-creative",
    "ads",
    "copy-editing"
  ],
  "Campaign brief": [
    "ads",
    "conversion-tracking",
    "attribution"
  ],
  "Offer ideas": [
    "offers",
    "cro",
    "ab-testing"
  ]
};
const byPlaybook: Record<string,string[]> = {
  "Connect related pages": [
    "site-architecture",
    "content-strategy"
  ],
  "Improve a page already appearing in search": [
    "seo-audit",
    "copy-editing",
    "ab-testing"
  ],
  "Give similar pages distinct purposes": [
    "content-strategy",
    "site-architecture",
    "seo-audit"
  ],
  "Comparison page": [
    "competitors",
    "customer-research",
    "copywriting"
  ],
  "Local landing page": [
    "seo-audit",
    "customer-research",
    "copywriting"
  ]
};
export function marketingGuidance(kind:string, brief='') {
  const title = /^Playbook: ([^\n]+)\.\r?\nDeliverable:/.exec(brief)?.[1];
  const selected = (title && Object.hasOwn(byPlaybook,title) ? byPlaybook[title] : Object.hasOwn(byKind,kind) ? byKind[kind] : []);
  if (!selected.length) return '';
  return '\nEditorial checks for this deliverable. Apply only within client rules and supplied evidence. Keep these checks out of finished copy.\n'+selected.map(key=>skills[key]).join('\n');
}


