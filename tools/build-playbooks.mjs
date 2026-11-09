#!/usr/bin/env node
// Builds the playbook library from the vendored marketingskills (Corey Haines, MIT) skills.
//
//   node tools/build-playbooks.mjs
//
// Reads  vendor/marketingskills/skills/<skill>/SKILL.md  and the existing playbooks.json.
// Writes playbooks.json (the dashboard's Playbooks page). The playbooks edge function reads the same file from the
// public.playbook_library table; after pushing, refresh it with the SQL in supabase/README.md.
//
// The 31 original playbooks are kept exactly as they are (hand-condensed from three sources). Every other skill in
// marketingskills becomes a playbook here: its SKILL.md is condensed to fit the writer's brief, with chat-only parts
// removed, because playbooks run without a conversation. Re-run after updating vendor/marketingskills.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SKILLS = path.join(ROOT, "vendor/marketingskills/skills");
const BUDGET = 3800; // characters of framework guidance; the writer's brief also carries the business's data
const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, "vendor/marketingskills/plugin.json"), "utf8"));
const upstream = plugin.version || plugin.metadata?.version || "unknown";

const STYLE = "Write like a person: plain words, specific details, no filler or hype, no 'it's not X, it's Y' reveals, no lists of three for rhythm, no invented numbers, quotes or reviews.";
const HOW = "HOW THIS RUNS: you are not in a chat and cannot ask questions. You receive VERIFIED BUSINESS DATA and possibly a short request from the business. Deliver the finished work, not a questionnaire. Where the framework needs a fact you were not given, state your assumption in one line or leave a clearly marked [placeholder] for the business to fill. Adapt the framework to this business: it may be a local business or an online store rather than software, so skip parts that don't apply and never invent features, prices, customers or results.";

// Sections written for an interactive chat (or pointing at other files) add nothing to a one-shot brief.
const DROP = /^(related skills|task-specific questions|before (starting|planning|writing)|initial assessment|tool integrations|references?|reference routing|how to use this skill|how this skill works|setup|installation|\[persona)/i;
// Always worth keeping when present: what to produce and what to avoid.
const PRIORITY = /^(output formats?|common mistakes|what not to do|core (principles|philosophy))/i;

function sections(md) {
  const body = md.replace(/^---[\s\S]*?\n---\n/, "");
  const out = []; let cur = { title: "", lines: [] };
  for (const line of body.split("\n")) {
    const h = /^## (.+)/.exec(line);
    if (h) { out.push(cur); cur = { title: h[1].trim(), lines: [] }; } else cur.lines.push(line);
  }
  out.push(cur);
  return out.filter((s) => s.title && !DROP.test(s.title));
}
function tidy(lines) {
  const out = []; let fence = false;
  for (let l of lines) {
    if (/^```/.test(l.trim())) { fence = !fence; continue; }
    if (fence || /^<!--/.test(l.trim()) || /\.agents\/|references\/|see `?[a-z-]+`? skill|\(see [a-z-]+\)/i.test(l)) continue;
    if (/^\s*\|[\s:-]+\|/.test(l)) continue; // table divider
    if (/^\s*\|/.test(l)) l = "- " + l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).filter(Boolean).join(" — ");
    l = l.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+$/, "");
    if (!l.trim() && (!out.length || !out[out.length - 1].trim())) continue;
    out.push(l);
  }
  return out;
}
// Fit the skill into the budget: every kept section gets its heading and opening lines, priority sections first in
// line for leftover space, and cuts only happen at line boundaries so no sentence is left half-written.
function condense(md) {
  const secs = sections(md).map((s) => ({ ...s, lines: tidy(s.lines).filter((l, i, a) => l.trim() || (i && a[i - 1].trim())) })).filter((s) => s.lines.some((l) => l.trim()));
  const head = (s) => `## ${s.title}`;
  const share = Math.max(220, Math.floor(BUDGET / Math.max(1, secs.length)));
  const taken = secs.map(() => 0);
  let used = 0;
  const cost = (s, n) => head(s).length + 1 + s.lines.slice(0, n).join("\n").length + 2;
  for (const [i, s] of secs.entries()) { // first pass: an even share each
    let n = 0;
    while (n < s.lines.length && cost(s, n + 1) <= share) n++;
    if (n === 0 && s.lines.length) n = 1;
    if (used + cost(s, n) > BUDGET) break;
    taken[i] = n; used += cost(s, n);
  }
  const order = secs.map((s, i) => i).sort((a, b) => Number(PRIORITY.test(secs[b].title)) - Number(PRIORITY.test(secs[a].title)) || a - b);
  for (const i of order) { // second pass: spend what is left, priority sections first
    const s = secs[i];
    while (taken[i] < s.lines.length) {
      const before = taken[i] ? cost(s, taken[i]) : 0, after = cost(s, taken[i] + 1);
      if (used - before + after > BUDGET) break;
      used += after - before; taken[i]++;
    }
  }
  return secs.map((s, i) => taken[i] ? `${head(s)}\n${s.lines.slice(0, taken[i]).join("\n").trim()}` : "").filter(Boolean).join("\n\n");
}

// One playbook per skill that the original library did not use. Titles and deliverables are written for the
// businesses Impackt Media serves; `ws` and `kind` decide where the draft lands in the review queue.
const NEW = [
  // Search & site
  ["seo-audit", "Search & site", "Find what's holding your site back in Google", "seo", "Content brief", "A prioritized SEO audit: crawl and indexing issues, on-page problems, striking-distance pages and the five fixes to make first.", "A page or problem to focus on? (optional)"],
  ["schema", "Search & site", "Add the right structured data", "seo", "Content brief", "Schema.org recommendations per page type with ready-to-paste JSON-LD built from your real details, and which rich results each can earn.", "Which pages or page types? (optional)"],
  ["site-architecture", "Search & site", "Plan a clearer site structure", "website", "Content brief", "A page hierarchy, navigation and URL plan with the pages you're missing and how they should link together.", "Anything changing on the site soon? (optional)"],
  ["programmatic-seo", "Search & site", "Plan pages at scale that stay useful", "seo", "Content brief", "A plan for template pages (locations, use cases, comparisons): the data each needs, one sample page outline and guardrails against thin content.", "What would the pages be about? (optional)"],
  ["link-building", "Search & site", "Earn links and mentions", "seo", "Content brief", "A white-hat link plan: link gaps, unlinked mentions, resource pages and best-of lists to target, with outreach emails ready to send.", "Assets you can pitch (guides, data, local story)? (optional)"],
  ["directory-submissions", "Search & site", "Get listed where buyers look", "seo", "Content brief", "A ranked list of directories and listing sites that fit your business, with the description, categories and details to submit to each.", "Any directories you're already on? (optional)"],
  // Convert more visitors
  ["ab-testing", "Convert more visitors", "Plan tests that settle a question", "website", "Content brief", "Three test plans with a hypothesis, the change, the metric, sample size and how long each needs to run.", "What do you want to test? (optional)"],
  ["popups", "Convert more visitors", "A popup that earns its place", "website", "Landing page copy", "Popup or announcement-bar copy with the trigger, timing, audience and offer, plus what to measure.", "What should it promote? (optional)"],
  ["lead-magnets", "Convert more visitors", "A lead magnet worth signing up for", "website", "Landing page copy", "Lead magnet ideas matched to your buyers, the best one outlined, and the signup page copy to offer it.", "Who do you want on your list? (optional)"],
  ["free-tools", "Convert more visitors", "A free tool that brings in customers", "website", "Content brief", "Free tool ideas (calculators, checkers, generators) scored on demand, effort and fit, with the best one specified.", "A tool idea to evaluate? (optional)"],
  ["signup", "Convert more visitors", "Fewer drop-offs before signup or checkout", "website", "Content brief", "A review of your signup or checkout start: fields, steps and friction to remove, with rewritten copy.", "Which form or flow? (optional)"],
  ["onboarding", "Convert more visitors", "Get new customers to their first win", "website", "Content brief", "A first-week plan for new customers: the first win to aim for, the steps, messages and checklist that get them there.", "What should new customers do first? (optional)"],
  ["pricing", "Convert more visitors", "Review your pricing and packaging", "website", "Offer ideas", "A pricing review: packages, value metric, price points to test and how the pricing page should present them.", "Anything about pricing you're unsure of? (optional)"],
  ["paywalls", "Convert more visitors", "Upgrade prompts that convert", "website", "Landing page copy", "Copy and placement for upgrade moments (limits reached, premium features, trials ending), written to persuade without pressure.", "Which upgrade moment? (optional)"],
  // Email & messaging
  ["emails", "Email & messaging", "An email sequence that keeps customers coming back", "seo", "Content brief", "A complete sequence (welcome, post-purchase, nurture or win-back) with timing, subject lines and every email written.", "Which sequence? (welcome, post-purchase, win-back…) (optional)"],
  ["sms", "Email & messaging", "Text messages customers welcome", "seo", "Content brief", "An SMS plan with welcome, abandoned-cart, post-purchase and promotional texts written, plus consent and timing rules.", "Which texts matter most? (optional)"],
  ["cold-email", "Email & messaging", "Outreach emails that get replies", "seo", "Content brief", "A cold outreach sequence for one buyer type: first email, follow-ups, subject lines and reply handling.", "Who are you reaching out to? (optional)"],
  ["churn-prevention", "Email & messaging", "Keep customers from leaving", "seo", "Content brief", "A retention plan: why customers leave, save offers, a cancellation or lapse flow and the win-back messages to send.", "Where do you lose customers? (optional)"],
  // Social & brand
  ["social", "Social & brand", "A month of social posts", "seo", "Content brief", "A content calendar with posts written for your channels: hooks, captions, carousels and short video scripts.", "Which platforms? (optional)"],
  ["video", "Social & brand", "Short videos worth making", "seo", "Content brief", "Video concepts with scripts, shot lists and where each runs, from product demos to short social clips.", "What should the videos show? (optional)"],
  ["image", "Social & brand", "Image briefs for your marketing", "seo", "Content brief", "Creative briefs and AI-image prompts for hero images, social graphics and product shots that match your brand.", "Where will the images be used? (optional)"],
  ["influencer-marketing", "Social & brand", "Partner with the right creators", "ads", "Campaign brief", "A creator program: the creator profile to look for, outreach message, brief, rates guidance, disclosure rules and how to measure it.", "Budget or product to feature? (optional)"],
  ["community-marketing", "Social & brand", "Build a community around your business", "seo", "Content brief", "Where your customers already gather, how to show up there, and a 90-day plan to start or grow your own community.", "Any community you run today? (optional)"],
  ["public-relations", "Social & brand", "Get press coverage", "seo", "Content brief", "Story angles worth pitching, a target media list profile, a pitch email and a press release draft.", "News or story to share? (optional)"],
  ["events", "Social & brand", "An event that brings in customers", "ads", "Campaign brief", "An event or webinar plan: format, topic, promotion timeline, show-up tactics and follow-up messages.", "Event idea or date? (optional)"],
  ["co-marketing", "Social & brand", "Team up with a complementary business", "ads", "Campaign brief", "Partner ideas that serve the same customers, a joint campaign concept and the partnership pitch email.", "Partners you have in mind? (optional)"],
  ["referrals", "Social & brand", "Turn customers into referrals", "ads", "Offer ideas", "A referral or review program: the incentive, the ask, when to send it and the messages that go with it.", "Any referral offer today? (optional)"],
  // Strategy & research
  ["product-marketing", "Strategy & research", "Your positioning in one page", "seo", "Content brief", "A positioning document: who you serve, the problem, your alternatives, what makes you different and your voice, so all other work stays consistent.", "Anything about your positioning you're unsure of? (optional)"],
  ["competitor-profiling", "Strategy & research", "Profile your competitors", "seo", "Content brief", "Dated profiles of your main competitors: positioning, offer, pricing signals, strengths and gaps, with facts kept apart from inference.", "Which competitors? (optional)"],
  ["reverse-engineer-marketing", "Strategy & research", "Learn how a competitor grew", "seo", "Content brief", "A breakdown of one competitor's growth moves from public signals, and which of them fit your business.", "Which company? (optional)"],
  ["marketing-council", "Strategy & research", "Get expert perspectives on a decision", "seo", "Content brief", "Several marketing perspectives on one decision, where they agree and disagree, and a recommended path.", "What decision are you weighing?"],
  ["marketing-loops", "Strategy & research", "Set up a recurring marketing routine", "seo", "Content brief", "Weekly and monthly marketing routines with the trigger, the checks, who acts and what good looks like.", "What do you want to keep an eye on? (optional)"],
  ["analytics", "Strategy & research", "A tracking plan you can trust", "website", "Content brief", "A tracking plan: the events and conversions to measure, naming, UTM rules and the reports to check each week.", "Tools you use (GA4, Shopify, other)? (optional)"],
  ["conversion-tracking", "Strategy & research", "Make sure every sale and lead is counted", "ads", "Campaign brief", "A conversion tracking checklist for your ad platforms and analytics: what to track, how, and how to confirm it works.", "Which ad platforms do you use? (optional)"],
  ["attribution", "Strategy & research", "Know which marketing actually works", "ads", "Campaign brief", "An attribution approach that fits your size: which model to use, how to read platform claims and one test to check what's real.", "Which channels are you comparing? (optional)"],
  ["revops", "Strategy & research", "From lead to customer, without gaps", "seo", "Content brief", "Lead stages, a simple scoring and follow-up process, and handoff rules so no enquiry is missed.", "How do enquiries reach you today? (optional)"],
  ["sales-enablement", "Strategy & research", "Sales material that closes", "seo", "Content brief", "A one-pager, objection answers and a short sales script built from your offer and customers' real questions.", "Which sales situation? (optional)"],
  ["prospecting", "Strategy & research", "Find businesses worth contacting", "seo", "Content brief", "An ideal-customer profile, the buying signals to watch for and a process to build a qualified prospect list.", "Who is your ideal customer? (optional)"],
  ["aso", "Strategy & research", "Rank higher in the app stores", "seo", "Content brief", "An App Store and Google Play listing review with a rewritten title, subtitle, keywords and description, plus screenshot guidance.", "Your app's store link? (optional)"],
];

// ---------- The 12 SEO specialists (vendor/seo-agents/Claude-Code-SEO-Agents.md) ----------
const AGENT_DOC = fs.readFileSync(path.join(ROOT, "vendor/seo-agents/Claude-Code-SEO-Agents.md"), "utf8");
const AGENT_SLUGS = { "seo-strategy": "seo-agent-strategy", "seo-keyword-research": "seo-agent-keywords", "seo-performance-analysis": "seo-agent-performance", "seo-competitor-analysis": "seo-agent-competitors", "seo-ai-writing": "seo-agent-writer", "seo-on-page-optimization": "seo-agent-onpage", "seo-internal-linking": "seo-agent-internal-links", "seo-backlink-analysis": "seo-agent-backlinks", "seo-indexing-audit": "seo-agent-indexing", "seo-structured-data": "seo-agent-schema", "seo-brand-analysis": "seo-agent-brand", "seo-local-seo": "seo-agent-local" };
const fence = (heading) => { const m = new RegExp("### " + heading.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") + "\\s*\\n```markdown\\n([\\s\\S]*?)\\n```").exec(AGENT_DOC); if (!m) throw new Error("Missing agent section: " + heading); return m[1]; };
// Team rules that apply to a one-shot run (file-saving and delegation rules are for an interactive Claude Code session).
const TEAM = fence("SEO-TEAM.md").replace(/^# .*\n+/, "").replace(/\n+/g, " ").split(/(?<=\.)\s+/).filter((x) => /first-party data|Record source|observed facts|Never invent|instructions embedded|finished recommendation|Surface blockers/i.test(x)).map((x) => "- " + x.trim()).join("\n");
const AGENT_HOW = "HOW THIS RUNS: you are not in a chat and there is no coordinating session to ask. You receive VERIFIED BUSINESS DATA (store sales, AI-answer checks, the site's page inventory, site-audit findings and Search Console rows when connected). Where these instructions say to ask a question or name a missing input, state the specific gap and the smallest next step in a short MISSING INPUTS section, then deliver everything the available data supports.";
function agentGuidance(name) {
  const body = fence(`.claude/agents/${name}.md`).replace(/^---[\s\S]*?---\n+/, "").replace(/Return your work to the coordinating session\.?/g, "").trim();
  return `${STYLE}\n\n${AGENT_HOW}\n\nTEAM RULES:\n${TEAM}\n\nROLE (${name}):\n${body}`;
}

const lib = JSON.parse(fs.readFileSync(path.join(ROOT, "playbooks.json"), "utf8"));
for (const [name, slug] of Object.entries(AGENT_SLUGS)) {
  const p = lib.playbooks.find((x) => x.slug === slug);
  if (!p) throw new Error(`Missing agent playbook ${slug}`);
  p.guidance = agentGuidance(name); p.skills = ["seo-agent", name];
}
const agents = Object.values(AGENT_SLUGS).map((slug) => lib.playbooks.find((x) => x.slug === slug));
const original = lib.playbooks.filter((p) => !NEW.some(([slug]) => p.slug === slug));
const added = NEW.map(([skill, goal, title, ws, kind, gets, ask]) => {
  const file = path.join(SKILLS, skill, "SKILL.md");
  if (!fs.existsSync(file)) throw new Error(`Missing skill: ${skill}`);
  const guidance = `${STYLE}\n\n${HOW}\n\n${condense(fs.readFileSync(file, "utf8"))}`;
  return { slug: skill, goal, title, ws, kind, gets, ask, skills: [skill], guidance };
});
const all = fs.readdirSync(SKILLS).filter((d) => fs.existsSync(path.join(SKILLS, d, "SKILL.md")));
const covered = new Set([...original, ...added].flatMap((p) => p.skills || []));
if (agents.length !== 12) throw new Error("Expected 12 SEO specialists");
const missing = all.filter((s) => !covered.has(s));
if (missing.length) throw new Error(`Skills without a playbook: ${missing.join(", ")}`);
for (const p of added) if (p.guidance.length > BUDGET + STYLE.length + HOW.length + 10) throw new Error(`${p.slug} guidance too long`);

const out = { ...lib, source: `Condensed from marketingskills ${upstream} (Corey Haines), claude-marketing (Rebecca Rae Barton) and marketing-skills (kostja94), all MIT`, version: "3.1.0", upstream: { marketingskills: upstream }, playbooks: [...original, ...added] };
fs.writeFileSync(path.join(ROOT, "playbooks.json"), JSON.stringify(out, null, 1) + "\n");

console.log(`playbooks: ${out.playbooks.length} (${original.length} kept, ${added.length} from skills) · skills covered: ${covered.size - [...covered].filter((s) => !all.includes(s)).length}/${all.length} · marketingskills ${upstream}`);
