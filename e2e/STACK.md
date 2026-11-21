# Local E2E stack (updated 2026-11-20, after the Node 26 / Nest 12 / Prisma 7 upgrade)

Toolchain: **Node 26 LTS must be first on `PATH`** (this Mac has no system Node 26; `~/.local/node-26/node-v26.13.1-darwin-arm64/bin`, SHA-256 checked against nodejs.org). Web dev servers: `npx vite --port <p> --strictPort` in each `apps/web` (5174 Kiorly, 5180 patient, 5181 ops, 5192 pharmacy, 5193 lab); start them yourself, `up.sh` only starts the APIs and Passport.

Running now (health = `/api/v1/health/ready`; Passport = `/.well-known/openid-configuration`):

| Service | Port | PID | Started by |
|---|---|---|---|
| Passport dev IdP | 4400 | 39829 | `scripts/up.sh` |
| Kiorly Clinic API (branch kiorex) | 3010 | 56548 | `scripts/svc.sh kiorly start` (after the resilience scenario) |
| Kiorex API | 4000 | 42018 | a `nest start --watch` owned by another agent (re-builds on `dist` change) |
| Kiorly Pharmacy / Lab | 3100 / 3200 | 39804 / 39808 | `scripts/up.sh` |
| Kiorex web / ops | 5180 / 5181 | 2753 / 99961 | UI agents |

PIDs change on restart; `.e2e/pids/*.pid` holds the last recorded ones. Logs: `../.e2e/logs/*.log`. Postgres :5433. :3000 / :5173 = founder's other checkout, never touched.

```bash
scripts/up.sh [--build] [--seed] [--restart]   # whole stack (--build rebuilds the four Nest APIs; needed after API source changes)
scripts/svc.sh kiorly stop|start               # Kiorly Clinic only
scripts/down.sh                                # stop by port (never :3000)
npm test                                       # 15 files (11 skipped here), 62 tests + 5 skipped, ~3 min, files in name order (global teardown cancels the slots it booked)
npm run test:nurse                             # 11-nurse-lab on an isolated stack (:3012/:4002/:3202, own DBs), 5 tests
```

Notes
- Kiorly pins `APP_WEB_URL=http://localhost:5174` in up.sh/svc.sh (NOT in `apps/api/.env`: its ON-06 test reads that env).
- Passport OTP limit is 5/phone/h: the harness truncates only the OTP counters (kiorex_account), never sessions.
- Kiorly/Kiorex DB timestamp columns are `timestamp without time zone` holding UTC: use `(now() at time zone 'utc')` in raw SQL; node-pg is configured to parse them as UTC (this was the "4 h off" in 03, a harness issue, not Kiorly).
- The dev DB has no Kiorex commission rate and no deposit amount (NEEDS_HUMAN, KX-12): 06/07 insert throw-away test values and remove them.

- Every service pools at most 10 connections by default (`DB_POOL_MAX`, or `connection_limit=N` in `DATABASE_URL`): five APIs + Passport + the isolated nurse stack stay well under `max_connections=100`. Seeds use `connection_limit=3`.
- Stop stale dev servers of this workspace before a run (`nest start --watch`, `start:swc` pharmacy on :3101 ...): a second API on the same DB runs its own outbox worker (in `KIOREX_MODE=mock` it marks events SENT without delivering them: this caused a false 04-pharmacy timeout).
- `13-home-visit` leaves CHECKED_IN visits on Mona's calendar for days +2..+9; `14-care-plan` therefore starts at +10 days. 10-resilience books slots directly on Kiorly, so 12-waitlist reads slots with `freeSlots(..., {fresh:true})` (bypasses Kiorex's 60 s slot cache).
