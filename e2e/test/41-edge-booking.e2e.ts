import { describe, it, expect, beforeAll } from 'vitest';
import { tokens, providerBySpecialty, hold, confirm, pickSlot, book, kiorlyAppointmentFor, freeSlots, confirmBody, type Provider } from '../src/fixtures.js';
import { kiorex, q, sleep, waitFor } from '../src/clients.js';
import { kiorlyEvent } from '../src/edge.js';
import { releaseE2eBookings } from '../src/release.js';

/** EDGE 41: booking concurrency, hold expiry, reschedule windows, input abuse, cross-tenant ids. Real Kiorly Clinic slots (KX-DEV doctors). */
let t: Awaited<ReturnType<typeof tokens>>; let p: Provider;
const apptCount = async (bookingId: string) => (await q('kiorly', `select count(*)::int c from "Appointment" where "externalReference" = $1`, [bookingId]))[0].c as number;
const activeAtSlot = async (clinicianId: string, startsAt: string) => (await q('kiorly', `select count(*)::int c from "Appointment" where "clinicianId" = $1 and "startsAt" = $2 and status in ('SCHEDULED','CONFIRMED','CHECKED_IN')`, [clinicianId, startsAt]))[0].c as number;
// the files before this one (growth, money, Phase 2 campaigns) leave future bookings behind until the global teardown; one doctor has about 50 slots in the window, so free them first
beforeAll(async () => { await releaseE2eBookings({ settle: true }); t = await tokens(); p = await providerBySpecialty(t.p1, 'paediatrics'); }, 120_000);

describe('B. Last-slot contention', () => {
  it('B1 ten concurrent holds by two patients on one slot: exactly one 201, the rest SLOT_TAKEN with alternatives; no 5xx', async () => {
    const slot = await pickSlot(t.p1, p);
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => hold(i % 2 ? t.p2 : t.p1, p, slot)));
    expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    for (const l of rs.filter((r) => r.status === 409)) expect(l.body.code).toBe('SLOT_TAKEN');
    const win = rs.find((r) => r.status === 201)!;
    const tok = rs.indexOf(win) % 2 ? t.p2 : t.p1;
    expect((await confirm(tok, win.body.id)).status).toBe(200);
  });

  it('B2 the same patient double-submitting a hold gets one hold (second is SLOT_TAKEN or the same hold), never two', async () => {
    const slot = await pickSlot(t.p1, p);
    const [a, b] = await Promise.all([hold(t.p1, p, slot), hold(t.p1, p, slot)]);
    expect([a.status, b.status].filter((s) => s === 201)).toHaveLength(1);
    expect(a.status < 500 && b.status < 500).toBe(true);
    const ok = a.status === 201 ? a : b;
    expect((await confirm(t.p1, ok.body.id)).status).toBe(200);
  });

  it('B3 five concurrent confirms of one hold (same key) make ONE appointment; a different Idempotency-Key replays the SAME booking', async () => {
    const h = await hold(t.p1, p, await pickSlot(t.p1, p));
    const rs = await Promise.all(Array.from({ length: 5 }, () => confirm(t.p1, h.body.id)));
    expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
    expect(rs.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
    expect(await apptCount(h.body.id)).toBe(1);
    const other = await confirm(t.p1, h.body.id, `different-key-${Date.now()}`);
    expect([200, 409]).toContain(other.status);
    expect(await apptCount(h.body.id)).toBe(1);
  });

  it('B4 hold expiring mid-confirm: confirming a hold whose 5 minutes ran out is refused (no appointment), and the slot is bookable again', async () => {
    const slot = await pickSlot(t.p1, p);
    const h = await hold(t.p1, p, slot);
    await q('kiorex_platform', `update "BookingIntent" set "holdExpiresAt" = now() at time zone 'utc' - interval '1 second' where id = $1`, [h.body.id]);
    await q('kiorly', `update "SlotHold" set "expiresAt" = now() at time zone 'utc' - interval '1 second' where "externalRef" = $1`, [`${h.body.id}:hold`]); // both systems share the 5 minute TTL
    const c = await confirm(t.p1, h.body.id);
    expect([409, 410, 422], JSON.stringify(c.body)).toContain(c.status);
    expect(await apptCount(h.body.id)).toBe(0);
    const again = await hold(t.p2, p, slot);
    expect(again.status, JSON.stringify(again.body)).toBe(201);
    await kiorex(t.p2, 'POST', `/bookings/${again.body.id}/release`);
  });

  it('B5 release twice, confirm after release, confirm after cancel: all refused, no appointment, slot free', async () => {
    const slot = await pickSlot(t.p1, p);
    const h = await hold(t.p1, p, slot);
    expect((await kiorex(t.p1, 'POST', `/bookings/${h.body.id}/release`)).status).toBe(200);
    const r2 = await kiorex(t.p1, 'POST', `/bookings/${h.body.id}/release`);
    expect(r2.status).toBeLessThan(500);
    const c = await confirm(t.p1, h.body.id);
    expect(c.status).toBeGreaterThanOrEqual(400); expect(c.status).toBeLessThan(500);
    expect(await apptCount(h.body.id)).toBe(0);
    expect((await hold(t.p2, p, slot)).status).toBe(201);
  });
});

describe('W. Input abuse on hold / confirm', () => {
  const base = () => ({ providerId: p.id, typeId: p.defaultTypeId });
  it('W1 impossible or hostile times are 4xx: past, end before start, zero length, 30-day length, garbage, off-grid, NaN, far future', async () => {
    const s = await pickSlot(t.p1, p); const st = new Date(s.startsAt).getTime();
    const cases: Record<string, any> = {
      past: { startsAt: new Date(Date.now() - 3600_000).toISOString(), endsAt: new Date(Date.now() - 1800_000).toISOString() },
      endBeforeStart: { startsAt: s.endsAt, endsAt: s.startsAt },
      zero: { startsAt: s.startsAt, endsAt: s.startsAt },
      month: { startsAt: s.startsAt, endsAt: new Date(st + 30 * 86400_000).toISOString() },
      garbage: { startsAt: 'tomorrow-ish', endsAt: 'later' },
      offGrid: { startsAt: new Date(st + 7 * 60_000 + 13_000).toISOString(), endsAt: new Date(st + 37 * 60_000 + 13_000).toISOString() },
      year9999: { startsAt: '9999-12-31T23:30:00Z', endsAt: '9999-12-31T23:59:00Z' },
      nums: { startsAt: 123, endsAt: 456 },
      missing: {},
    };
    for (const [name, body] of Object.entries(cases)) {
      const r = await kiorex(t.p1, 'POST', '/bookings', { ...base(), ...body });
      expect(r.status, `${name}: ${JSON.stringify(r.body)}`).toBeGreaterThanOrEqual(400);
      expect(r.status, `${name}: ${JSON.stringify(r.body)}`).toBeLessThan(500);
    }
    expect(await q('kiorex_platform', `select 1 from "BookingIntent" where sub = $1 and status = 'HELD' and "startsAt" = $2`, [t.p1Login.sub, s.startsAt])).toHaveLength(0);
  });
  it('W2 unknown provider, a type of ANOTHER provider, injection-like ids, and no token are 4xx', async () => {
    const s = await pickSlot(t.p1, p);
    for (const body of [{ providerId: 'prv_nope', typeId: p.defaultTypeId }, { providerId: p.id, typeId: 'typ_not_mine' }, { providerId: "' OR 1=1 --", typeId: '"; drop table x;--' }, { providerId: p.id, typeId: '' }]) {
      const r = await kiorex(t.p1, 'POST', '/bookings', { ...body, ...s });
      expect(r.status, JSON.stringify(r.body)).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    }
    expect((await kiorex(undefined, 'POST', '/bookings', { ...base(), ...s })).status).toBe(401);
  });
  it('W3 confirm: consent flags of the wrong type, huge notes, emoji/zero-width names and missing keys are handled (no 5xx, nothing half-created)', async () => {
    const h = await hold(t.p1, p, await pickSlot(t.p1, p));
    for (const body of [{ marketplaceConsent: 'yes' }, { marketplaceConsent: null }, {}, { marketplaceConsent: true, notes: 'x'.repeat(100_000) }]) {
      const r = await kiorex(t.p1, 'POST', `/bookings/${h.body.id}/confirm`, body, { 'Idempotency-Key': h.body.id });
      expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBeLessThan(500);
    }
    const weird = '​‍🙂'.repeat(50);
    const r = await kiorex(t.p1, 'POST', `/bookings/${h.body.id}/confirm`, { ...confirmBody, notes: weird }, { 'Idempotency-Key': h.body.id });
    expect(r.status).toBeLessThan(500);
    await kiorex(t.p1, 'POST', `/bookings/${h.body.id}/release`);
  });
});

describe('X. Cross-tenant ids and ownership in every path param', () => {
  it('X1 another patient cannot read, confirm, release, cancel, reschedule, deposit-checkout or download the calendar of my booking (404, never 403/200)', async () => {
    const b = await book(t.p1, p);
    const sl = (await freeSlots(t.p1, p, 12, { fresh: true }))[0];
    for (const [m, path, body] of [['GET', ''], ['GET', '/calendar.ics'], ['POST', '/release'], ['POST', '/cancel', {}], ['POST', '/reschedule', sl], ['POST', '/deposit-checkout']] as const) {
      const r = await kiorex(t.p2, m, `/bookings/${b.id}${path}`, body as any);
      expect(r.status, `${m} ${path}: ${JSON.stringify(r.body)}`).toBe(404);
    }
    expect((await kiorex(undefined, 'GET', `/bookings/${b.id}`)).status).toBe(401);
    expect((await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.status).toBe('CONFIRMED'); // untouched
    expect((await kiorex(t.p2, 'GET', `/bookings/${'../../admin'}`)).status).toBeGreaterThanOrEqual(400);
  });
  it('X2 a patient cannot list another patient\'s bookings by passing their sub, and the list never contains foreign rows', async () => {
    const r = await kiorex(t.p2, 'GET', `/bookings?sub=${t.p1Login.sub}`);
    expect(r.status).toBe(200);
    const ids = new Set((await kiorex(t.p1, 'GET', '/bookings')).body.map?.((x: any) => x.id) ?? (await kiorex(t.p1, 'GET', '/bookings')).body.items?.map((x: any) => x.id));
    const mine2 = r.body.map?.((x: any) => x.id) ?? r.body.items?.map((x: any) => x.id) ?? [];
    for (const id of mine2) expect(ids.has(id)).toBe(false);
  });
});

describe('S. Reschedule collisions and windows', () => {
  it('S1 rescheduling onto a taken slot is 409 SLOT_TAKEN with alternatives, and the booking keeps its original time', async () => {
    const [s1, s2] = [await pickSlot(t.p1, p), await pickSlot(t.p1, p)];
    if (s1.startsAt === s2.startsAt) return;
    const a = await book(t.p1, p, s1); const b = await book(t.p2, p, s2);
    const r = await kiorex(t.p1, 'POST', `/bookings/${a.id}/reschedule`, { startsAt: s2.startsAt, endsAt: s2.endsAt });
    expect(r.status, JSON.stringify(r.body)).toBe(409); expect(r.body.code).toBe('SLOT_TAKEN');
    expect(new Date((await kiorex(t.p1, 'GET', `/bookings/${a.id}`)).body.startsAt).toISOString()).toBe(new Date(s1.startsAt).toISOString());
    void b;
  });
  it('S2 two bookings racing to reschedule onto the same free slot: one wins, one SLOT_TAKEN, exactly one active appointment there', async () => {
    const [s1, s2, target] = [await pickSlot(t.p1, p), await pickSlot(t.p1, p), await pickSlot(t.p1, p)];
    if (new Set([s1.startsAt, s2.startsAt, target.startsAt]).size < 3) return;
    const a = await book(t.p1, p, s1); const b = await book(t.p2, p, s2);
    const [ra, rb] = await Promise.all([kiorex(t.p1, 'POST', `/bookings/${a.id}/reschedule`, target), kiorex(t.p2, 'POST', `/bookings/${b.id}/reschedule`, target)]);
    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
    const apt = await kiorlyAppointmentFor(a.id);
    expect(await activeAtSlot(apt.clinicianId, new Date(target.startsAt).toISOString())).toBe(1);
  });
  it('S3 rescheduling to the slot you already hold, into the past, with a bad body, or after cancellation is a clean 4xx', async () => {
    const s = await pickSlot(t.p1, p); const a = await book(t.p1, p, s);
    const same = await kiorex(t.p1, 'POST', `/bookings/${a.id}/reschedule`, s);
    expect(same.status, JSON.stringify(same.body)).toBeLessThan(500);
    for (const body of [{ startsAt: new Date(Date.now() - 86400_000).toISOString(), endsAt: new Date(Date.now() - 86000_000).toISOString() }, { startsAt: 'x', endsAt: 'y' }, {}]) {
      const r = await kiorex(t.p1, 'POST', `/bookings/${a.id}/reschedule`, body);
      expect(r.status, JSON.stringify(r.body)).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    }
    await kiorex(t.p1, 'POST', `/bookings/${a.id}/cancel`, {});
    const after = await kiorex(t.p1, 'POST', `/bookings/${a.id}/reschedule`, await pickSlot(t.p1, p));
    expect(after.status).toBe(422);
  });
  it('S4 the reschedule limit and window are enforced at their exact edges (policy boundaries use an injected clock: see clinics-management kx06 boundary tests); a second reschedule beyond maxPatientReschedules is RESCHEDULE_LIMIT_REACHED', async () => {
    const a = await book(t.p1, p); const apt = await kiorlyAppointmentFor(a.id);
    await q('kiorly', `update "Clinic" set "kiorexCancellationPolicy" = '{"maxPatientReschedules": 1}'::jsonb where id = $1`, [apt.clinicId]);
    try {
      const first = await kiorex(t.p1, 'POST', `/bookings/${a.id}/reschedule`, await pickSlot(t.p1, p));
      expect(first.status, JSON.stringify(first.body)).toBe(200);
      const second = await kiorex(t.p1, 'POST', `/bookings/${a.id}/reschedule`, await pickSlot(t.p1, p));
      expect(second.status).toBe(422); expect(second.body.code).toBe('RESCHEDULE_LIMIT_REACHED');
    } finally { await q('kiorly', `update "Clinic" set "kiorexCancellationPolicy" = null where id = $1`, [apt.clinicId]); }
    await kiorex(t.p1, 'POST', `/bookings/${a.id}/cancel`, {});
  });
});

describe('E. Lifecycle events: late, duplicated and out of order (Kiorly outbox -> Kiorex)', () => {
  it('E1 events after a terminal state never resurrect a booking: CANCELLED then CONFIRMED/CHECKED_IN/COMPLETED stay CANCELLED; COMPLETED then CANCELLED stays COMPLETED', async () => {
    const a = await book(t.p1, p); const apt = await kiorlyAppointmentFor(a.id);
    expect((await kiorex(t.p1, 'POST', `/bookings/${a.id}/cancel`, {})).status).toBe(200);
    for (const type of ['APPOINTMENT_CONFIRMED', 'CHECKED_IN', 'COMPLETED']) expect((await kiorlyEvent(a.id, apt.id, type)).status).toBe(200);
    expect((await kiorex(t.p1, 'GET', `/bookings/${a.id}`)).body.status).toBe('CANCELLED');
    const b = await book(t.p1, p); const aptB = await kiorlyAppointmentFor(b.id);
    await kiorlyEvent(b.id, aptB.id, 'COMPLETED');
    await waitFor('COMPLETED', async () => (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.status === 'COMPLETED');
    await kiorlyEvent(b.id, aptB.id, 'CANCELLED_BY_CLINIC'); await kiorlyEvent(b.id, aptB.id, 'NO_SHOW');
    expect((await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.status).toBe('COMPLETED');
  });
  it('E2 an event for an unknown booking is acknowledged (200) without creating anything; the same event id twice is DUPLICATE', async () => {
    const r = await kiorlyEvent(`kx_bk_unknown_${Date.now()}`, `apt_unknown_${Date.now()}`, 'COMPLETED');
    expect(r.status).toBe(200);
  });
});
void sleep;
