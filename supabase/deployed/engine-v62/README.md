# Engine: deployed snapshot (version 62)

Retrieved from the Supabase project on 2026-11-10 with the management API (`ezbr_sha256`
`2a525fed07c2ab39ec1d7ce1d078383297b8ff13ed8149f771730adf5690ffda`). This is a read-only reference so the engine can be
audited and diffed. It is not a deploy source yet:

- `_shared/paid-api.ts` and `_shared/reliability.ts` differ from the copies in `supabase/functions/_shared/` that the
  `connect` function deploys with. Reconcile those two files before deploying the engine from this repository.
- Nothing in this folder was changed. The production pipeline and approval endpoint live in
  `supabase/functions/playbooks/` and call the engine's existing actions.
