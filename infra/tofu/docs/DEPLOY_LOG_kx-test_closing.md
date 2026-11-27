# kx-test release: closing test run (27 Nov 2026, evening)

No secret values here. The AWS Clinic stack (E1DE0H2K3M17YL, its RDS and App Runner) and every Clinic-related tofu module were not touched; no tofu was applied (deploy script and images only). Redeploying the services whose code changed was part of the founder's task.

## What changed and what was redeployed

| Service | Change | Image |
|---|---|---|
| platform | `@kiorex/contracts` 1.13.2 vendored; the flag catalogue gains `clinic.pay_collections` (launch-locked, same text as the contract; the Clinic already enforced the key and, being launch-locked, already evaluated it OFF without gate evidence, so no behaviour change) | `kx-test/platform:0495e900` (merged head of 27 Nov: includes the other agents' leads, market launch and OpenAPI commits) |
| pharmacy-api | contracts 1.13.2; table `DemoMarker` (migration `20270311090000_demo_marker`, applied by the entrypoint's `prisma migrate deploy`); the demo seeds tag their rows; `demo-data:remove` in the runtime image | `kx-test/pharmacy-api:f90df3db`, then `c05e9cbb` (`demo-data:remove` moved to `src/seed`, so the runtime image carries it: `docker exec kx-test-pharmacy-api-1 node dist/seed/demo-data-remove.js --dry-run` prints "no marked demo organisation") |
| lab-api | same as the Pharmacy; `docker exec kx-test-lab-api-1 node dist/seed/demo-data-remove.js --dry-run` prints "no marked demo organisation" (kx-test has no demo laboratories) | `kx-test/lab-api:fab6d47f` |
| compose bundle | new one-shot service `otp-guard` (`deploy/compose/kx-guard-otp.sh`): Passport depends on it; on `test` it only prints a notice (mock codes in the Passport log are how the live suite signs in), in `pilot` and `prod` it refuses a Passport in mock messaging mode or with the dev bypass or dev inbox on | no image (runs inside the caddy image already on the host) |
| passport | code unchanged, container NOT recreated (`04ca9f7f`) | none |

Releases (all by `infra/tofu/deploy/scripts/deploy.sh test --tag ...` through SSM): `20261127T142124Z-682d4e60` (pharmacy, lab, otp-guard; platform tag held at the other agent's `d347faa8`), `20261127T142450Z-51c95cf0` (platform `0495e900`), `20261127T143314Z-794d1fdb` (pharmacy-api `c05e9cbb`).

## Incidents while releasing (both recovered, no outage beyond a pull failure before any container was touched)

1. A first release was uploaded with `KX_REGISTRY=kx-test` (the display value I had read from a `sed`-shortened listing); the host's `docker compose pull` failed ("pull access denied for kx-test/lab-api") BEFORE `up`, so every container kept running; the same command with the full registry URL (`<account>.dkr.ecr.eu-central-1.amazonaws.com/kx-test`) was applied one minute later. `deploy.sh` should refuse a `KX_REGISTRY` without a dot or a slash (follow-up, not changed here).
2. Another agent deployed platform `d347faa8` (built from the `origin/main` line that did not contain my commits) 30 seconds before my first platform release; a release built from my own line would have regressed their market-launch change. The release was redone from the merged head (`0495e900`) after reading `/opt/kx/releases/current/release.env` over SSM. Lesson in the handoff: read the live `release.env` first and build from the merged head.

## Verification

- Hosts after the releases: platform, Passport, Pharmacy, Lab health 200; containers healthy; `otp-guard` exited 0 with the notice.
- Live suite `npx playwright test -c e2e/kx-test` (saved sessions reused): **119 passed, 2 skipped (the two `test.fixme` that need a human market gate and a throwaway Clinic organisation), 4 failed, 11 did not run** (the serial specs behind the failures). The four failures are not in the scope of this release and none touches what changed: `08-mfa-policy` (after `Add a rule` the form shows two rule groups and `getByLabel('Applies to')` matches both: a strict-mode locator in the spec; the test stops before it submits anything), `10-site-leads` (a text locator matches both the e-mail and the company cell), and two in `11-kiorly-markets` (`GET /marketplace/v1/markets` answers 404 on the live Clinic: the Clinic side of ADR-060 is not deployed; the Clinic is outside this task). Specs 01 to 07 and 09 are all green.

- After the last release the specs of this release's scope were run again: `01-edge`, `04-pharmacy`, `04-lab`, `05-partner`, `06-privileged-mfa`: 71 of 71 pass.
