import { kiorex, patientLogin, opsLogin, syncProviders, waitFor, sleep, q } from './clients.js';
import { PATIENT_1, PATIENT_2 } from './env.js';

export interface Provider { id: string; nameEn: string; specialty: string; defaultTypeId: string; clinicId?: string; nextSlots: { startsAt: string; endsAt: string }[] }

export async function tokens() {
  const [p1, p2, ops] = await Promise.all([patientLogin(PATIENT_1), patientLogin(PATIENT_2), opsLogin()]);
  // booking needs a profile with a name (PROFILE_NOT_FOUND otherwise); Hassan has none until first use
  for (const [l, name] of [[p1, 'Amira Hassan'], [p2, 'Hassan Ali']] as const) {
    if ((await kiorex(l.accessToken, 'GET', '/me/profile')).status === 404 || !(await kiorex(l.accessToken, 'GET', '/me/profile')).body?.nameEn) {
      await kiorex(l.accessToken, 'PUT', '/me/profile', { nameEn: name, preferredLocale: 'en' });
    }
  }
  return { p1: p1.accessToken, p2: p2.accessToken, ops: ops.accessToken, p1Login: p1, p2Login: p2 };
}

/** The three KX-DEV doctors (kiorex-dev.seed.ts) that the scenarios book against; the QA demo dataset adds more LIVE doctors that must not interfere. */
export const KXDEV_DOCTORS = ['Dr Hesham Nabil', 'Dr Karim Adel', 'Dr Mona Fahmy'];
export async function providers(token: string): Promise<Provider[]> {
  // The API caps pageSize at 30 (a page of 50 comes back as 30, which used to end this loop after page 1) and its default sort ("earliest")
  // only ranks the 60 best-rated rows. sort=rating pages through the WHOLE catalogue deterministically and computes slots per page only.
  const out: Provider[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await kiorex(token, 'GET', `/search/providers?pageSize=30&page=${page}&sort=rating`);
    if (r.status !== 200) throw new Error(`search ${r.status}`);
    out.push(...r.body.items);
    if (!r.body.items.length || out.length >= (r.body.total ?? Infinity)) break;
  }
  return out;
}
export async function kxdevProviders(token: string): Promise<Provider[]> {
  return (await providers(token)).filter((p) => KXDEV_DOCTORS.includes(p.nameEn));
}
export async function providerBySpecialty(token: string, specialty: string): Promise<Provider> {
  const r = await kiorex(token, 'GET', `/search/providers?specialty=${specialty}&pageSize=30&sort=rating`);
  const items: Provider[] = (r.body.items ?? []).filter((p: Provider) => KXDEV_DOCTORS.includes(p.nameEn));
  if (!items.length) throw new Error(`no ${specialty} provider (run provider sync)`);
  return items[0];
}

/** A free future slot for a provider; `skip` spreads parallel/rerun scenarios over different slots. */
let bustN = 0;
/**
 * `fresh: true` bypasses Kiorex's 60 s slot cache (its key is the query window truncated to the hour) by shifting the window start by a unique
 * whole number of hours, so the listing reflects what Kiorly has NOW (bookings made directly on Kiorly or by earlier files in this run).
 */
export async function freeSlots(token: string, p: Provider, days = 12, opts: { fresh?: boolean } = {}): Promise<{ startsAt: string; endsAt: string }[]> {
  const bust = opts.fresh ? ((++bustN % 48) + 1) * 3600_000 : 0;
  const from = new Date(Date.now() + 3 * 86400_000 + bust), to = new Date(Date.now() + days * 86400_000);
  const r = await kiorex(token, 'GET', `/providers/${p.id}/slots?typeId=${p.defaultTypeId}&from=${from.toISOString()}&to=${to.toISOString()}`);
  if (r.status !== 200) throw new Error(`slots ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.slots;
}
/** Pick a random slot beyond the 36 h cancellation window so reruns do not collide. */
export async function pickSlot(token: string, p: Provider) {
  const s = await freeSlots(token, p, 12, { fresh: true }); // never from Kiorex's 60 s cache: slots booked a moment ago by this or an earlier file would still be listed (flaky BK-04 race test)
  if (!s.length) throw new Error('no free slots');
  return s[Math.floor(Math.random() * s.length)];
}

export async function hold(token: string, p: Provider, slot: { startsAt: string; endsAt: string }) {
  return kiorex(token, 'POST', '/bookings', { providerId: p.id, typeId: p.defaultTypeId, startsAt: slot.startsAt, endsAt: slot.endsAt });
}
export const confirmBody = { marketplaceConsent: true, remindersConsent: true };
export const confirm = (token: string, id: string, key = id) => kiorex(token, 'POST', `/bookings/${id}/confirm`, confirmBody, { 'Idempotency-Key': key });

/** Hold + confirm one booking and wait for Kiorly's appointment. */
export async function book(token: string, p: Provider, slot?: { startsAt: string; endsAt: string }) {
  let s = slot ?? (await pickSlot(token, p));
  let h = await hold(token, p, s);
  // Kiorex caches slots for 60 s, so a freshly booked slot can still be offered: pick another (unless the caller pinned one)
  for (let i = 0; i < 6 && h.status === 409 && !slot; i++) { s = await pickSlot(token, p); h = await hold(token, p, s); }
  if (h.status !== 201) throw new Error(`hold ${h.status} ${JSON.stringify(h.body)}`);
  const c = await confirm(token, h.body.id);
  if (c.status !== 200) throw new Error(`confirm ${c.status} ${JSON.stringify(c.body)}`);
  return { id: h.body.id as string, booking: c.body, slot: s };
}

export async function kiorlyAppointmentFor(bookingId: string) {
  const rows = await q('kiorly', 'select * from "Appointment" where "externalReference" = $1', [bookingId]);
  return rows[0];
}
export async function bookingStatus(token: string, id: string): Promise<string> {
  return (await kiorex(token, 'GET', `/bookings/${id}`)).body.status;
}
export async function waitStatus(token: string, id: string, want: string | string[], ms = 30_000) {
  const wants = Array.isArray(want) ? want : [want];
  return waitFor(`booking ${id} -> ${wants.join('|')}`, async () => { const s = await bookingStatus(token, id); return wants.includes(s) ? s : undefined; }, ms);
}
export async function webhookReceipts(aggregateId: string) {
  return q('kiorex_platform', 'select type, "eventId" from "WebhookReceipt" where "aggregateId" = $1 order by "receivedAt"', [aggregateId]);
}
export { syncProviders, sleep, opsLogin };

/** After a listing pause/resume Kiorly's outbox needs a few seconds to tell Kiorex; wait until the directory is LIVE again. */
export async function waitProvidersLive(ops: string, n = 3) {
  return waitFor('providers LIVE in Kiorex', async () => (await kiorex(ops, 'GET', '/admin/providers?status=LIVE')).body.total >= n, 60_000, 1000);
}
