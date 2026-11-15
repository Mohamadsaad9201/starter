# Agency Agents

Four standalone marketing agents on one shared core: **Paid Ads**, **SEO**, **Local SEO** and **AI Visibility**.
They run your agency's client accounts today, and the code is laid out so it can become a product you sell later.

| Agent | Status | What it does |
|---|---|---|
| Paid Ads | **Built** | Weekly operating check on Google Ads and Meta: wasted spend, search-term waste, creative fatigue, budget-capped winners, broken landing pages or tracking. Queues fixes for approval. |
| SEO | Next | Audits sites on Shopify, WordPress, Framer and Netlify (site connectors already built). |
| Local SEO | Planned | Google Business Profile, reviews, citations, local pages. |
| AI Visibility | Planned | Whether ChatGPT, Claude, Perplexity and Gemini mention and cite the brand. |

## How it works

```
src/
  core/            shared by every agent
    agent.ts         Claude tool loop, prompt caching, reports saved to data/reports/
    actions.ts       "propose_change" tool + approve/apply/reject
    approvals.ts     approval queue (data/approvals/*.json)
    playbooks.ts     expert playbooks, loaded on demand
    config.ts        client configs + secrets
  integrations/
    google-ads.ts    reads (GAQL) + actions: pause, budget, negative keyword
    meta-ads.ts      reads (insights) + actions: pause/activate, budget
    sites/           crawler (any host) + Shopify / WordPress / Netlify APIs, Framer via crawler
  agents/
    paid-ads/        the agent's role, workflow, tools and allowed actions
    registry.ts
knowledge/         playbooks from coreyhaines31/marketingskills (MIT)
clients/           one JSON file per client
```

**Agents can't change anything live.** They only *propose* changes. Each proposal records the current state, the change, the expected effect, how to roll it back, and the evidence. A person approves it, and only then does it run. Two more guardrails apply per client:
- `maxBudgetChangePct`: budget moves above this percentage are blocked. The default is 20%.
- `allowLiveWrites`: off by default. When it's off, approved changes are recorded but never pushed to the live account.

**Expertise comes from playbooks.** Each agent's main playbook is built into its instructions, for example `ads/SKILL.md`. Before an operational decision, the agent loads the deeper references it needs: kill and scale thresholds, the operating check, audit guardrails, and so on.

## Setup

```bash
npm install
```

```bash
cp .env.example .env
```

Fill in `.env`. You need `ANTHROPIC_API_KEY` plus the platforms you use:

| Platform | What you need | Notes |
|---|---|---|
| Google Ads | Developer token, OAuth client ID and secret, a refresh token for a user on your **manager (MCC)** account, and the MCC ID | One login covers every client account |
| Meta | A **Business Manager system-user** token with `ads_read` and `ads_management`, assigned to every client ad account | One token covers every client |
| Shopify | A custom-app Admin API token per store, stored as `SHOPIFY_TOKEN_<CLIENT_SLUG>` | Can update SEO titles and descriptions |
| WordPress | An application password per site, stored as `WORDPRESS_APP_PASSWORD_<CLIENT_SLUG>` | Can update titles and excerpts |
| Netlify | A personal access token | Read-only. Site changes go through the git repo |
| Framer | Nothing | Read through the public site. Changes become manual tasks |

Then add one file per client in `clients/`. Copy `clients/example-client.json` to start.

## Use it

```bash
npm run agent -- run paid-ads --client example-client
```

```bash
npm run agent -- run paid-ads --all
```

```bash
npm run agent -- approvals
```

```bash
npm run agent -- show <id>
```

```bash
npm run agent -- approve <id> --by "Mohamad"
```

```bash
npm run agent -- reject <id> --reason "client is mid-promo"
```

To try it without any ad credentials, use the built-in sample data (you still need `ANTHROPIC_API_KEY`):

```bash
MOCK_DATA=1 npm run agent -- run paid-ads --client example-client
```

## Roadmap to a sellable product

1. Build the SEO, Local SEO and AI Visibility agents on the same core.
2. Run agents on a schedule, for example Paid Ads daily and SEO weekly. Post summaries to Slack or email.
3. Build a web dashboard: approval queue, reports, client list.
4. Make it multi-tenant. Swap the JSON and file storage for a database, let customers connect accounts with OAuth ("Connect Google Ads", "Connect Shopify"), and add billing per agent.

## Credits

The playbooks in `knowledge/` come from [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) at commit `1f83744` (MIT License, see `knowledge/LICENSE-marketingskills`).
