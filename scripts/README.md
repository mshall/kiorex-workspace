# scripts

Workspace helper scripts. Back to the [workspace README](../README.md).

| Script | What | Notes |
|---|---|---|
| `seed-all.sh [--reset]` | Seeds the synthetic Egyptian demo dataset into the **running** local stack in dependency order: Passport, Kiorly Clinic (incl. Nurse edition), Pharmacy, Lab, provider sync, Kiorex | Idempotent; `--reset` removes demo records only; refuses to run unless the environment is non-production and `DEMO_SEED_ALLOWED=true` |
| `seed-staging.sh --dry-run` | Prints the plan for seeding AWS **staging** (invokes demo-seed Lambdas) | Non-production only; run `--yes` only after a human deployed staging; refuses any other AWS account |
| `ops-sync.mjs` | Helper for `seed-all.sh`: signs in as the seeded ops admin and triggers a full provider sync on the local Kiorex API | Dev only |
| `push-all.sh` | Pushes already-committed work of each repo | Founder-authorised pushes only; never force-pushes, never touches `clinics-management` `main`; skips a repo if a secret pattern is found. Agents do not run it |
| `seed-staging.dry-run.test.mjs` | Test for the staging dry-run plan | `node --test` |

```bash
e2e/scripts/up.sh            # start the stack first
scripts/seed-all.sh          # demo data
scripts/seed-all.sh --reset  # re-anchor relative dates (home visits are relative to the seed instant)
```

Seed personas and logins: [TEST_DATA.md](../TEST_DATA.md).
