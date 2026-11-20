# Local E2E stack (updated 2026-11-20)

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
npm test                                       # 10 files, 48 tests, ~3 min, files in name order (global teardown cancels the slots it booked)
```

Notes
- Kiorly pins `APP_WEB_URL=http://localhost:5174` in up.sh/svc.sh (NOT in `apps/api/.env`: its ON-06 test reads that env).
- Passport OTP limit is 5/phone/h: the harness truncates only the OTP counters (kiorex_account), never sessions.
- Kiorly/Kiorex DB timestamp columns are `timestamp without time zone` holding UTC: use `(now() at time zone 'utc')` in raw SQL; node-pg is configured to parse them as UTC (this was the "4 h off" in 03, a harness issue, not Kiorly).
- The dev DB has no Kiorex commission rate and no deposit amount (NEEDS_HUMAN, KX-12): 06/07 insert throw-away test values and remove them.
