# Cohorts, LTV and the market wizard (GRW-P3-C and GRW-P3-G), wave 8 lane A2

How to see it (local, mock providers, a private API and database so the shared stack is not touched):

1. `e2e/scripts/w8a2-stack.sh up` clones the dev Kiorex database into `w8a2_kiorex_platform`, applies the lane migrations and starts the lane API on :4330. `down` removes the clone.
2. Create the market first: `E2E_KIOREX_URL=http://localhost:4330 E2E_DB_MAP=kiorex_platform=w8a2_kiorex_platform npx vitest run test/38-market-zy.e2e.ts` (8 tests; needs a fresh database per run).
3. Cohorts: seed or use real data, then `POST /api/v1/admin/growth/cohorts/rollup` as a super admin (the page has a Recompute button). Open `/growth/cohorts` in the ops console (Vite on :5332 with `KIOREX_API_URL=http://localhost:4330`, or `apps/ops` `npx playwright test -c playwright.w8a2.config.ts` with `PW_SESSION_JSON` from a real Passport login).
4. Wizard: `/growth/markets/wizard?cc=ZY` (or "Onboard a market" on the Markets page).

What to look for
- Cohorts: every cell under 10 people reads "fewer than 10" (also the money derived from it); the heatmap prints each rate with a bar; LTV rows say ESTIMATE with n, interval and horizon; payback says "not available" without approved spend.
- Wizard: eight steps, errors with their path, geography errors with their line number and nothing imported on an error, readiness separating "To do" from "Needs a person" (counsel texts, licence, launch gate), "Not live (human gate)" always until a person records the gate, no button that makes a market live.
- Arabic is RTL; the same layouts at 320, 768, 1440 and 2560 px, light and dark.

Screenshots (this folder): `cohorts-{en,ar}-{light,dark}-{320,768,1440,2560}.png` and `market-wizard-{en,ar}-{light,dark}-{320,768,1440,2560}.png` (the dark set only at 1440).

Evidence: Playwright 34 of 34 (`apps/ops/e2e/growth-cohorts-markets.spec.ts`, no horizontal overflow, axe serious and critical clean, keyboard walk, 44 px controls), vitest 16 (axe), e2e 38 8 of 8, integration `growth-cohorts` 6, `growth-market-zy` 9, `growth-w8a2-schema` 4.
