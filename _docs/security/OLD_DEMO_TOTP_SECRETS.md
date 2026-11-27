# Old demo TOTP secrets: where they were published (27 Nov 2026)

Status: the secrets are REMOVED from the working trees of every repository (this change) and are not valid on kx-test. They remain in the git HISTORY of the public repositories below. No history was rewritten and nothing was force-pushed; this list lets the founder decide whether to rewrite history.

What they were: three fixed demo seeds (and one e2e fixture seed) for the synthetic ops accounts of the Passport demo data (`+201000000099` super admin, `+201000009001` ops admin, `+201000009002` finance) plus a second-admin fixture (`+201000009777`, e2e only). They were committed in `config/seed-users.json`, in test and demo documents and in e2e helpers. They protected only SYNTHETIC LOCAL DEV accounts; they never existed on a real environment except as follows: the kx-test demo seed once enrolled the ops accounts with them and they were replaced by generated secrets kept only in AWS Secrets Manager `/kx/test/e2e` (27 Nov 2026, afternoon, see `infra/tofu/docs/DEPLOY_LOG_kx-test.md`).

How to regenerate this list (the old values themselves are NOT printed here; the pattern is the substring `TOTPSEED` that all four seeds contained):

```bash
for r in . kiorex-account kiorex-platform kiorly kiorly-lab kiorly-pharmacy kiorex-contracts kiorex-pay-contract clinics-management; do
  echo "== $r"; git -C $r log --all --format='C %h %ad' --date=short -G'TOTPSEED' --name-only
done
```

## Commits and paths that contain (or removed) an old secret

Format: commit, date (UTC+4 author date), path. The LAST commit of each repository in the lists below is the one that removed them from the tree.

### . (workspace, mshall/kiorex-workspace)

| Commit | Date | Path |
|---|---|---|
| `f3de055` | 2026-11-20 | `TEST_DATA.md` |
| `f3de055` | 2026-11-20 | `e2e/src/passport.ts` |
| `f3de055` | 2026-11-20 | `scripts/ops-sync.mjs` |
| `17a4e00` | 2026-11-21 | `DEMO_DATA.md` |
| `882185b` | 2026-11-21 | `DEMO_DATA.md` |
| `8604ba6` | 2026-11-23 | `TEST_GUIDE.md` |
| `97e7602` | 2026-11-23 | `e2e/test/19-org-onboarding.e2e.ts` |
| `d300de9` | 2026-11-23 | `_docs/test-flow/index.html` |
| `15389ab` | 2026-11-24 | `e2e/test/23-multi-partner-routing.e2e.ts` |
| `4aa83af` | 2026-11-24 | `e2e/walk/ops.mjs` |
| `7d47b5f` | 2026-11-24 | `TEST_GUIDE.md` |
| `7d47b5f` | 2026-11-24 | `e2e/src/growth.ts` |
| `dbfc697` | 2026-11-24 | `e2e/test/22-standalone-connect.e2e.ts` |
| `3ae5d83` | 2026-11-25 | `TEST_GUIDE.md` |
| `3ae5d83` | 2026-11-25 | `_docs/test-flow/index.html` |
| `911a3dc` | 2026-11-25 | `TEST_GUIDE.md` |
| `911a3dc` | 2026-11-25 | `_docs/test-flow/index.html` |
| `f9aae3a` | 2026-11-25 | `TEST_GUIDE.md` |
| `f9aae3a` | 2026-11-25 | `_docs/test-flow/index.html` |
| `33c6b7d` | 2026-11-27 | `DEMO_DATA.md` |
| `33c6b7d` | 2026-11-27 | `TEST_DATA.md` |
| `33c6b7d` | 2026-11-27 | `TEST_GUIDE.md` |
| `33c6b7d` | 2026-11-27 | `_docs/test-flow/index.html` |
| `33c6b7d` | 2026-11-27 | `e2e/src/growth.ts` |
| `33c6b7d` | 2026-11-27 | `e2e/src/passport.ts` |
| `33c6b7d` | 2026-11-27 | `e2e/test/19-org-onboarding.e2e.ts` |
| `33c6b7d` | 2026-11-27 | `e2e/test/22-standalone-connect.e2e.ts` |
| `33c6b7d` | 2026-11-27 | `e2e/test/23-multi-partner-routing.e2e.ts` |
| `33c6b7d` | 2026-11-27 | `e2e/walk/ops.mjs` |
| `33c6b7d` | 2026-11-27 | `scripts/ops-sync.mjs` |

### kiorex-account

| Commit | Date | Path |
|---|---|---|
| `32708d4` | 2026-11-20 | `config/seed-users.json` |
| `d941c10` | 2026-11-20 | `Docs/TEST_DATA.md` |
| `d941c10` | 2026-11-20 | `config/seed-users.json` |
| `f13d872` | 2026-11-21 | `DEMO_DATA.md` |
| `fe2325a` | 2026-11-23 | `Docs/TEST_GUIDE.md` |
| `04ca9f7` | 2026-11-27 | `DEMO_DATA.md` |
| `04ca9f7` | 2026-11-27 | `Docs/TEST_DATA.md` |
| `04ca9f7` | 2026-11-27 | `Docs/TEST_GUIDE.md` |
| `04ca9f7` | 2026-11-27 | `config/seed-users.json` |
| `04ca9f7` | 2026-11-27 | `test/no-published-totp-secrets.test.ts` |

### kiorex-platform

| Commit | Date | Path |
|---|---|---|
| `5173d94` | 2026-11-20 | `Docs/TEST_DATA.md` |
| `edf703a` | 2026-11-20 | `apps/ops/e2e/totp.ts` |
| `edf703a` | 2026-11-20 | `apps/web/e2e/totp.ts` |
| `8a563ba` | 2026-11-21 | `DEMO_DATA.md` |
| `9c889d3` | 2026-11-23 | `apps/ops/e2e/onboarding.spec.ts` |
| `e42e45f` | 2026-11-23 | `Docs/TEST_GUIDE.md` |
| `450f768` | 2026-11-24 | `apps/ops/e2e/growth-helpers.ts` |
| `d0f6765` | 2026-11-27 | `DEMO_DATA.md` |
| `d0f6765` | 2026-11-27 | `Docs/TEST_DATA.md` |
| `d0f6765` | 2026-11-27 | `Docs/TEST_GUIDE.md` |
| `d0f6765` | 2026-11-27 | `apps/ops/e2e/growth-helpers.ts` |
| `d0f6765` | 2026-11-27 | `apps/ops/e2e/onboarding.spec.ts` |
| `d0f6765` | 2026-11-27 | `apps/ops/e2e/totp.ts` |
| `d0f6765` | 2026-11-27 | `apps/web/e2e/totp.ts` |

### Other repositories

`kiorly`, `kiorly-lab`, `kiorly-pharmacy`, `kiorex-contracts`, `kiorex-pay-contract`: no commit on any branch contains these values. `clinics-management` (read only, not edited): no commit on any branch contains these values (`git log --all -G TOTPSEED` is empty; also no other fixed TOTP/otpauth seed literal was found in tracked files).

### Outside git

- `_private/` of the workspace (git-ignored, never pushed, the founder's private demo register: `DEMO_ACCOUNTS.md`, `sections/passport.md`, `sections/platform.md`) still lists the old values. They are dead everywhere except possibly a local dev database that was seeded before this change: running `npm run db:seed:demo` in `kiorex-account` replaces them with the new local random secrets. Update that private file by hand (`npm run dev:totp-secrets` prints the new ones).
- Older container images in ECR `kx-test/passport` (tags before `04ca9f7f`) contain the old `config/seed-users.json`. A hosted Passport never wrote them (public mode inserts no TOTP; see kiorex-account `accounts.ts`); the images can be deleted if you want them gone.
- GitHub keeps pull-request refs and forks; a history rewrite on a public repository does not remove copies already fetched. Because the secrets only ever protected synthetic local accounts and are dead on kx-test, treat a rewrite as optional hygiene, not as an incident response.

## Verification that they are not valid on kx-test (27 Nov 2026)

- `e2e/kx-test/tests/09-old-demo-totp.spec.ts` signs the three ops accounts in through the real Passport pages with the phone code and the code computed from the OLD secret read from the git history at run time: Passport answers "Incorrect code" and no session is issued.
- The same spec asks the kx-test Passport database (read only, over SSM) whether any `totp_credentials` row holds an old secret: the count is 0.

## What replaced them

`config/seed-users.json` carries `"totp": true` only. The first local start (or `npm run dev:totp-secrets` in `kiorex-account`) generates random per-machine secrets into the git-ignored `.local/totp-secrets.json`; local tests, e2e and the other repositories read that file (or `OPS_TOTP_SEED` / `KX_LOCAL_TOTP_FILE`). A hosted deployment loads and writes no TOTP from the seed at all. Test `kiorex-account/test/no-published-totp-secrets.test.ts` fails if a fixed seed is committed again.
