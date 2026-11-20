import { q, closeAll } from '../src/db.js';
import { staffLogin, kiorly } from '../src/clients.js';

/**
 * Teardown: each run books ~20 real slots on the three KX-DEV doctors. Cancel the still-open ones through the clinic API (so Kiorex hears
 * CANCELLED_BY_CLINIC like in production) otherwise repeated runs would exhaust the 12-day slot window.
 */
export async function teardown() {
  if (process.env.E2E_NURSE_STACK) return closeAll(); // isolated stack (11-nurse-lab only): nothing of 03..10 was booked
  try {
    const rows = await q('kiorly', `select a.id, u.email from "Appointment" a join "User" u on u.id = a."clinicianId"
      where a."externalReference" like 'kx_bk_%' and a.status in ('SCHEDULED','CONFIRMED') and a."startsAt" > (now() at time zone 'utc')`);
    const tokens = new Map<string, string>();
    for (const r of rows) {
      if (!r.email.startsWith('kxdev.')) continue;
      if (!tokens.has(r.email)) tokens.set(r.email, await staffLogin(r.email));
      await kiorly(tokens.get(r.email), 'PATCH', `/appointments/${r.id}/status`, { status: 'CANCELLED', cancellationReason: 'e2e cleanup' }).catch(() => undefined);
    }
  } finally { await closeAll(); }
}
