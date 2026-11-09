# Supabase backend: self-serve sign-up

Project: `egtvvunkdkpqmfafhkjg` (ots-seo-engine). Everything in this folder is deployed.

| Piece | Deployed as | What it does |
|---|---|---|
| `migrations/20261109150000_self_serve_owners.sql` | migration `self_serve_owners` | `owner` role, `signup_analyses` table, `my_workspace_role`, `owner_decide_fix`, `owner_decide_draft`, owners in `client_review`, review fields in `client_workspace` |
| `functions/signup/` | edge function `signup` (v3, `verify_jwt: false`, own auth) | Public website analysis (site read + Claude web research for positioning and competitors), then claim, Google sync, search summary and onboarding answers for signed-in owners |
| `functions/connect/` + `functions/_shared/` | edge function `connect` (v17) | Unchanged except who may call it: admins as before; a business owner may get provider availability and start Google, Shopify, Webflow or WordPress for their own business |

## Sign-up flow

1. `/signup/` (public): website → `signup analyze` reads the site and returns a token; Claude researches the business and its competitors in the background (about 50 s); the page polls `signup status`.
2. The visitor edits the profile and competitor list, enters an email, and gets a magic link to `/app/`. The token and edits wait in `localStorage` (`impackt:signup`).
3. `/app/` after sign-in: `signup claim` creates the business, makes the user its `owner`, and starts the first site check. The app opens `#/onboarding/<site>` for Search Console, the first opportunity, attribution and SEO level.
4. Owners approve and publish website fixes (`owner_decide_fix` → engine `apply`), approve drafts, and roll back from Website work.

## Limits and costs

- Analyses: 4 per IP per hour, 12 per IP per day, 300 per day overall; a website analysed in the last 7 days (with competitors) is reused without new AI research.
- Owners: at most 3 workspaces per email.
- Each new analysis is one Claude Opus 5.5 call with up to 8 web searches, plus a second short call only if the first answer isn't valid JSON.
- Secret used: `ANTHROPIC_API_KEY` (already set for the engine).

## Not covered here

The `engine` function (publishing, checkups, Search Console sync) is unchanged; its source isn't in this repo.

## Playbooks autopilot

`playbooks` (deployed v8, `verify_jwt` off; it checks the engine key or workspace membership itself) prepares work
for every active business without anyone pressing a button:

- **Schedule:** pg_cron job `playbooks-autopilot`, hourly 8am–7pm Detroit (`35 12-23 * * *` UTC), set up in
  `migrations/20261109200000_playbook_autopilot.sql`.
- **Per business:** up to 3 runs per tick, 10 a day by default (`profile.autopilot.daily`, max 60), paused while 30
  automatic drafts wait for review. `profile.autopilot.enabled = false` turns it off.
- **What runs:** each playbook has its own cadence (the `PLAN` map in `index.ts`) and runs only when the business has
  the evidence it needs: crawled pages, Search Console, Shopify sales, AI-answer checks, ad accounts or locations.
  The page, question or location a person would type is filled in from that evidence.
- **Nothing publishes.** Every result is a draft in the review queue.
- **Measurement:** each run stores a baseline snapshot and the metric it should move (`measure`). 28 days later
  (`review_at`), approved drafts get an after-snapshot; rejected or never-decided work is recorded as such.
- **Library:** playbook content lives in `public.playbook_library`. Refresh it after `node tools/build-playbooks.mjs`
  and a push (steps in `migrations/20261109190000_playbook_library.sql`).

Trigger one tick by hand:

```sql
select net.http_post(url := 'https://egtvvunkdkpqmfafhkjg.supabase.co/functions/v1/playbooks',
  headers := jsonb_build_object('Content-Type','application/json','x-engine-key',
    (select decrypted_secret from vault.decrypted_secrets where name = 'engine_cron_key')),
  body := '{"action":"autopilot"}'::jsonb, timeout_milliseconds := 120000);
```
