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
