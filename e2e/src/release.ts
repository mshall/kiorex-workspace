import { q } from './db.js';
import { staffLogin, kiorly } from './clients.js';

/**
 * Cancels the still-open appointments the e2e suites booked on the three KX-DEV doctors (`externalReference like 'kx_bk_%'`, future, SCHEDULED or CONFIRMED) through the
 * Clinic API, so Kiorex hears CANCELLED_BY_CLINIC like in production. The 12-day slot window of one doctor holds about 50 slots and a full run books more than that
 * (growth, edge, money and the Phase 2 suites): without a release in between, the booking-heavy edge suites (41, 42) found "no free slots". Used by the global teardown at the
 * end of the run and, with `settle`, in the `beforeAll` of the suites that need the capacity.
 */
export async function releaseE2eBookings(opts: { settle?: boolean } = {}): Promise<number> {
  if (process.env.E2E_NURSE_STACK) return 0; // isolated stack: nothing of the shared stack was booked
  const rows = await q('kiorly', `select a.id, u.email from "Appointment" a join "User" u on u.id = a."clinicianId"
    where a."externalReference" like 'kx_bk_%' and a.status in ('SCHEDULED','CONFIRMED') and a."startsAt" > (now() at time zone 'utc')`);
  const tokens = new Map<string, string>(); let n = 0;
  for (const r of rows) {
    if (!r.email.startsWith('kxdev.')) continue;
    if (!tokens.has(r.email)) tokens.set(r.email, await staffLogin(r.email));
    const res = await kiorly(tokens.get(r.email), 'PATCH', `/appointments/${r.id}/status`, { status: 'CANCELLED', cancellationReason: 'e2e cleanup' }).catch(() => undefined);
    if (res && res.status < 300) n++;
  }
  if (opts.settle && n) {
    // the cancellations leave the Clinic through its outbox and reach Kiorex (slot cache, waitlist autofill, analytics) a moment later: wait until the outbox is drained so the
    // next suite starts from a quiet system and does not see these events arrive in the middle of one of its tests
    const end = Date.now() + 30_000;
    while (Date.now() < end) {
      const pending = await q('kiorly', `select count(*)::int c from "OutboxEvent" where status = 'PENDING' and target <> 'INTERNAL' and "createdAt" > (now() at time zone 'utc') - interval '5 minutes'`);
      if (!pending[0].c) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return n;
}
