import { q, closeAll, purgeE2eConsentPushes } from '../src/db.js';
import { releaseE2eBookings } from '../src/release.js';

/**
 * Teardown: each run books ~20 real slots on the three KX-DEV doctors. Cancel the still-open ones through the clinic API (so Kiorex hears
 * CANCELLED_BY_CLINIC like in production) otherwise repeated runs would exhaust the 12-day slot window.
 */
export async function teardown() {
  if (process.env.E2E_NURSE_STACK) return closeAll(); // isolated stack (11-nurse-lab only): nothing of 03..10 was booked
  try {
    await purgeE2eConsentPushes();
    await releaseE2eBookings();
  } finally { await closeAll(); }
}
