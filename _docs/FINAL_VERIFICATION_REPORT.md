# Kiorex v2 — Final Verification Report (20 Nov 2026)

Verifier: final verification agent. Nothing pushed, deployed or `tofu apply`d. Only regressions/test-isolation issues were fixed.

## 1. Stack health
| Service | Port | Result |
|---|---|---|
| Kiorly Clinic API | 3010 | up, /health/ready 200 |
| Kiorex API | 4000 | up, ready 200 |
| Passport dev IdP | 4400 | up (OIDC discovery 200) |
| Kiorly Pharmacy API | 3100 | up, ready 200 |
| Kiorly Lab API | 3200 | up, ready 200 |
| Webs 5174 / 5180 / 5181 / 5190 / 5191 | | all 200 (5180 was restarted by me after the verticals suite, see 5) |
| Expo | 8081 | 200 |
| Postgres | 5433 | up (~90 connections at the end) |

No restart of the stack was needed (`up.sh --restart` not run). Background jobs on the Kiorex API are active in `.e2e/logs/kiorex.log`: outbox worker (sends and DEAD handling), reminder jobs (`reminder_24h` / `reminder_2h` push + WhatsApp mock SENT every 15 min through 11:00), provider sync, nurse-lab relay. Kiorly API log also shows outbox activity.

## 2. Demo seed
`scripts/seed-all.sh --reset` exit 0 (all 6 steps). Verified in DB: Passport 88 accounts / 5 orgs; Kiorly 508 patients, 2417 appointments, 36 home visits; Kiorex 19 providers synced, 28 demo bookings (+ e2e history, 647 booking intents); pharmacy 439 drugs / 186 sales / 72 rx / 155 Kiorex orders; lab nurse-handoff orders RELEASED / AWAITING_VALIDATION / IN_TRANSIT / REFUSED. The pharmacy step prints two logged Prisma `Unique constraint (orgId, orderRef)` errors from the idempotent settlement insert; they are caught (seed OK).

## 3. Cross-product E2E
| Run | Result |
|---|---|
| `e2e npm test` | 13 files passed, 1 skipped (11-nurse-lab by design); 57 tests passed, 5 skipped |
| `e2e npm run test:nurse` (isolated stack) | initially FAILED, now 5/5 passed (see fix A) |

## 4. Per-repo suites (one repo at a time, `*_test` databases)
| Repo | Suite | Result |
|---|---|---|
| clinics-management (branch kiorex) | typecheck (field-visit, api, web) | pass |
| | web unit / api unit (incl. no-tax-authority) / field-visit / infra unit | 43 / 774 / 48 / 5 pass, 0 fail |
| | api integration (DATABASE_URL=kiorly_test) | 358/358 pass |
| kiorex-platform | api typecheck + lint (boundaries) | pass |
| | api unit / integration (kiorex_platform_test) | 73 / 241 pass (9 + 25 suites) |
| | web (vitest) / ops (vitest) | 112 / 32 pass; tsc pass |
| | mobile jest + tsc | 115 pass; tsc pass |
| kiorex-account | tsc -b, unit, full vitest | 22 unit, 195 total pass (24 files) |
| | Playwright passport-ui (RTL/a11y/axe) | 19/19 pass |
| kiorex-contracts | tsc + vitest | 116 pass (5 files) |
| kiorly-pharmacy | typecheck, lint, api unit + e2e (kiorly_pharmacy_test), web | 45 / 85 / 6 pass |
| kiorly-lab | typecheck, lint, api unit + e2e (kiorly_lab_test), web | 67 / 91 / 6 pass |

## 5. Playwright UI suites on isolated stacks
| Suite | Result |
|---|---|
| kiorex-platform apps/web `playwright.home.config.ts` (stack :4001, DB kiorex_e2e_home) | 10/10 pass |
| kiorex-platform apps/web `playwright.verticals.config.ts` | initially FAILED (fix B), now 5/5 pass |
| clinics-management nurse-open + nurse-gated (own DB `kiorly_nurse_ui`, API 3011/3012, web 5185/5186, fresh build to .e2e-dist) | first run 6/7 (fix C), now 7/7 pass |

All throw-away stacks, databases (kiorly_nurse_ui, kiorex_e2e_home, kiorex_e2e_verticals, *_e2e11) and `.e2e-dist` folders were stopped / dropped afterwards. The standard 5180 web dev server was stopped for the verticals run and restarted with `npx vite` (log `.e2e/logs/kiorex-web.log`).

## 6. Failures found, root cause, fix
- **A. nurse-lab E2E stack (11-nurse-lab): `lab dev-login tech 403 LOGIN_FAILED`.** Root cause: the new demo-seed guard (`DEMO_SEED_ALLOWED=true` + `KIORLY_ENV=local`) refuses the Lab `src/seed/seed.ts`; `nurse-lab-stack.sh` swallowed the error (`|| true`) so the demo-lab tenant was never created. Fix: pass both env vars to the lab seed step in `e2e/scripts/nurse-lab-stack.sh`. **Not committed: `kiorex-v2/` and `e2e/` are not a git repo** (see section 9).
- **B. verticals stack: `ON CONFLICT ("flagKey")` has no matching constraint.** Root cause: `FlagGateEvidence` primary key became `(flagKey, gateId)`. Fix: conflict target updated in `kiorex-platform/apps/web/e2e/verticals/stack.mjs`; commit `6f7f059`.
- **C. nurse-safety Playwright flake (3 min timeout).** Root cause: 2 Playwright workers ran `nurse-solo` and `nurse-safety` in parallel against the same solo-nurse tenant, and `clearToday()` removed the other test's visit. Fix: `workers: 1` when `PLAYWRIGHT_NO_SERVER` is set (nurse stacks) in `clinics-management/apps/web/playwright.config.ts`; commit `c5cbf1e`. Passes alone and in the full run.
- **D. Hygiene: legacy CDK deploy ran on push to main.** `clinics-management/.github/workflows/deploy-aws.yml` had `push: branches: [main]`. Changed to `workflow_dispatch` only; commit `9f80162`.

## 7. OpenTofu
`~/.local/bin/tofu` (1.13.9). For clinics-management (bootstrap, live/prod kiorly-clinic, live/prod/global/dns, live/staging kiorly-clinic), kiorex-platform, kiorex-account, kiorly-pharmacy, kiorly-lab (prod + staging each): `fmt -check -recursive` pass; `init -backend=false` + `validate` pass for all 14 live stacks. `tofu test` (modules/product-stack, demo_seed_guard.tftest.hcl) 4/4 pass in all 5 repos. Untracked `.terraform.lock.hcl` files created by `tofu test` were deleted again. No `apply` run.

## 8. Hygiene gates
- Secrets: no `AKIA[0-9A-Z]{16}` or `BEGIN ... PRIVATE KEY` in tracked files of any of the 6 repos.
- No `.env` or `*.tfstate` tracked. Tracked `terraform.tfvars` files exist (bootstrap + live stacks): contain account id / region / admin ARNs only, no secrets (reviewed bootstrap). `.terraform.lock.hcl` in live stacks is intentionally tracked.
- `git status` clean in all 6 repos (after my 3 commits).
- Workflows: no deploy/apply on push in any repo after fix D. Push triggers remaining are CI only (`ci.yml` in platform/account/contracts/pharmacy/lab). `deploy*.yml`, `release.yml`, `drift.yml`, `publish.yml`, `deploy-aws-kiorex.yml`, `deploy-aws.yml` are `workflow_dispatch`-only; `infra-plan.yml` is pull_request-only (plan).
- Standing note: `clinics-management/infra/cdk.out` is untracked/ignored (0 tracked files).

## 9. Remaining known issues
1. **Workspace root `kiorex-v2/` (and `e2e/`, `scripts/`, `_docs/`) is not a git repository.** The fix to `e2e/scripts/nurse-lab-stack.sh` and this report exist only on disk; they are not in any repo and will not be pushed by the scheduled job. Decide where e2e/ should live (new repo or a tracked repo).
2. **Dead Kiorex outbox events (`kiorly.record_share_consent`)**: 751 DEAD-log lines in `.e2e/logs/kiorex.log`; in the DB 509 DEAD with `Kiorly 404`, 34 `timeout`, 24 `circuit open`, 85 SENT. The timeout/circuit-open ones come from the 10-resilience scenario (Kiorly deliberately stopped); the 404s are record-share consents for Kiorly patients that do not exist (likely demo vault consents seeded without a Kiorly patient link). Not a regression test failure, but worth a look before demos (`prisma/demo/seed-demo.ts` in kiorex-platform).
3. The default `up.sh` stack's `/` returns 404 on all APIs (use `/api/v1/health/ready`); Passport readiness is the OIDC discovery URL (health/ready returns 401).
4. `nurse-lab-stack.sh` still swallows lab seed failures (`|| true`); a future seed-guard change would again surface only as a login 403.
5. Playwright default `chromium` project in clinics-management targets :5173 (founder's other checkout) and was deliberately not run; only the nurse projects were.
6. NEEDS_HUMAN items (launch gates, provider go-live, counsel sign-offs) unchanged and not touched.
