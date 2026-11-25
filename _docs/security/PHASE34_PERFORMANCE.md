# Phase 3 and 4 performance checks (GRW-P3-H, wave 9 lane A2, 25 Nov 2026)

Local lab numbers on one Mac that was shared with three other agents (load average 25 to 50 during the runs), real PostgreSQL 18, the integration harness of `kiorex-platform` (the whole Nest application in process, no mocks of the database). **These are regression budgets, not capacity planning**: they catch a sequential scan or an N+1, not a 20 percent drift, and nothing here replaces a load test against the AWS stack.

Run: `cd kiorex-platform/apps/api && PERF_OUT=/tmp/perf.txt NODE_OPTIONS=--experimental-vm-modules npx jest --selectProjects integration --runInBand --testPathPatterns growth-performance` (about 3 minutes, own throw-away database, dropped by the harness).

Data set (SQL `generate_series`, one transaction): 500,000 `GrowthTouchpoint` (60,000 visitor keys, 90 days), 500,000 visitor-stream `GrowthEvent`, 100,000 `BookingIntent` (200 providers, 40,000 patients) with 300,000 booking events, 100,000 `GrowthAttributionDecision`, 50,000 `GrowthRevenueFact`.

| Hot path | Measure | Result | Budget | Verdict |
|---|---|---|---|---|
| Attribution decide (`decideForBooking`, 200 bookings, 500k touches in the table) | p50 / p95 / max | 24 / 38 / 142 ms | p95 150 ms | pass |
| Daily rollup, 30 days, 500k + 300k events, 100k bookings (`GrowthRollupService.rollup`) | first / second run, rows | 6.9 s / 5.2 s, 3,718 rows (identical on rerun) | 60 s | pass |
| Cohort rollup, 24 months, every basis, 100k bookings, LTV bootstrap (`CohortService.rollup`) | wall time | **51 s** (58 s on an earlier, less loaded-by-others run) | 120 s | pass, **the slowest job; see gap 1** |
| Lifecycle send gate (`SendGateService.evaluate`, consent, preference, caps, quiet hours, holdout) | p50 / p95 / max | 4 / 11 / 56 ms | p95 150 ms | pass |
| Public SSR doctor page, cold cache (purged before each request) | p50 / p95 / max | 18 / 101 / 130 ms | p95 800 ms | pass |
| Public SSR doctor page, warm cache | p50 / p95 / max | 3.6 / 5.1 / 12 ms | p95 150 ms | pass |
| `POST /growth/v1/touch` (under the Postgres limiter, 60 requests from rotating addresses) | p50 / p95 / max | 2.4 / 5.7 / 17 ms | p95 120 ms | pass |
| `GET /growth/v1/campaign/resolve` | p50 / p95 / max | 5.0 / 19 / 40 ms | p95 80 ms | pass |
| WhatsApp assistant turn, mock model, inbound message to rendered reply | p50 / p95 / max | 46 / 101 / 166 ms | p95 400 ms | pass |
| Ops growth reads with the full data set (overview, channels, breakdown, cohorts) | p95 | 3 to 12 ms (masked, from rollup tables) | 1.5 s | pass |

Lighthouse 13.6 on the public SSR pages (production-mode Kiorex instance on a private port, 5 templates x ar/en x mobile/desktop, simulated slow 4G, 1 run each): **all 20 combinations 99 or 100 in performance, 100 in accessibility, best practices and SEO; LCP 651 to 692 ms mobile and 174 to 182 ms desktop; CLS at most 0.026; TBT at most 146 ms**. All budgets of `lighthouserc.json` met (`node apps/web/scripts/lighthouse-audit.mjs --base <url>`). Same caveat as the closure round: lab data, not field data.

## Honest gaps

1. The cohort and LTV rollup is the one job whose time grows with bookings (51 s at 100k bookings in a loaded laptop). It runs once a day, off the request path, but at 1M bookings it will need batching by cohort month or a Postgres-side aggregation. Not changed in this wave.
2. The work package names "ops list pages with 10,000 rows". The ops growth list routes that read big tables (touchpoints, decisions, audit) are paginated aggregates on this build and did not exist under the guessed names (they answered 404 and were skipped by the spec); only the four analytics and cohort reads are budgeted. Nothing renders 10,000 rows in a browser table; no browser rendering budget was measured.
3. Public endpoints were measured under the real limiter but not under concurrency (one request at a time). The widget iframe and `session` route were not budgeted (only the SSR pages, touch and resolve).
4. No load test, no autoscaling or connection-pool test (instructed out of scope in the pentest rules, and a laptop is not the target).
