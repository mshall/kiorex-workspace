# Cross-product journeys (GRW-P4-A): how to see it work (25 Nov 2026)

Measurement and gentle in-app prompts only. Flag `growth.cross_product` is launch-locked: nothing below works on a stack where no human recorded its gate evidence. On a test database use the DEV-ONLY gate helper (`recordDevGate`), never a real approval.

1. Start the private stack: `e2e/scripts/cross-product-stack.sh up` (Kiorex :4103 from the lane worktree, real Pharmacy :3103 and Lab :3203, own databases).
2. Run the real-stack suite: `E2E_KIOREX_URL=http://localhost:4103 E2E_PHARMACY_URL=http://localhost:3103 E2E_LAB_URL=http://localhost:3203 E2E_DB_MAP="kiorex_platform=kiorex_e2e_a3,kiorly_pharmacy=kiorly_pharmacy_e2e_a3,kiorly_lab=kiorly_lab_e2e_a3" E2E_NURSE_STACK=1 npx vitest run test/39-growth-cross-product.e2e.ts` (4 tests). `cross-product-stack.sh down` or `drop` afterwards.
3. By hand (patient web): sign in, the home page shows "Continue your care" only when a card exists. Open "Send your prescription to a pharmacy": the pharmacy page opens with your prescription chosen; the "Keep my visit and this order connected" switch is off by default and saved only if you turn it on.
4. In the ops console open Growth, "Cross-product journeys": Overview (status, visits, no rewards, inert commission link, rules) and Funnel (prompts offered, dismissed, continued, not continued, by source of the first booking and by time to continue). Cells under 10 read `<10`.

Evidence screenshots (real browser, real Passport session, AR and EN, light and dark, 320 to 1440 px, axe clean): `continuity-*.png` (web cards) and `cross-product-*.png` (ops overview and funnel) in this folder.

Not covered here: the real Kiorly Clinic and the real care-plan flow (integration suite on the fake Clinic only), the mobile app in a simulator, a native-speaker review of the Arabic strings. See `GROWTH_PHASE2_4_WORK_PACKAGES.md` (W8 A3 as-built) and launch guide 11.42 to 11.42g.
