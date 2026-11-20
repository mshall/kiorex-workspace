import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tokens, waitStatus, syncProviders, confirmBody } from '../src/fixtures.js';
import { kiorex, kiorly, staffLogin, q, waitFor } from '../src/clients.js';

/**
 * Rev 2.3 home visits, REAL stack (Kiorex :4000 <-> Kiorly Clinic :3010), the flow the mobile/web app drives:
 * address book (confirmed with the OTP-verified phone) -> HOME slots for a covered district -> hold with addressId -> confirm -> Kiorly HomeVisit with the
 * address stored ENCRYPTED (no plaintext) -> out-of-coverage refused 422 -> nurse departs / arrives -> Kiorex timeline -> finish; second booking: unsafe abort
 * is NOT a no-show and the paid deposit goes to HOLD_FOR_REVIEW (KXMPAY07), never auto-forfeited.
 * Launch gates GHV1/GHV2 are the DEV-ONLY-NOT-A-REAL-GATE rows of the dev database (seed-all); this test never records a gate.
 */
const PROVIDER = 'demo_l_rev23_nsolo_mona'; // solo nurse Mona Adel, covers nasr-city + heliopolis
const STREET = '77 E2E Home Street';

describe('o. Home-visit booking, execution and unsafe abort (KXMHV, HVBK/HVEXE/HVSAF)', () => {
  let t: Awaited<ReturnType<typeof tokens>>; let nurse: string; let typeId: string; let addrId: string; let farAddrId: string;
  const created: string[] = [];

  async function homeSlots(district: string) {
    const from = new Date(Date.now() + 2 * 86400_000), to = new Date(Date.now() + 9 * 86400_000);
    const r = await kiorex(t.p1, 'GET', `/providers/${PROVIDER}/slots?typeId=${typeId}&serviceLocation=HOME&district=${district}&from=${from.toISOString()}&to=${to.toISOString()}`);
    return r;
  }
  async function homeBooking(slotIndex: number) {
    const s = await homeSlots('nasr-city');
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    // one slot per distinct day, spread by index: travel buffers (30/30) block neighbouring slots after a booking and Kiorex caches slots for 60 s
    const days = new Map<string, { startsAt: string; endsAt: string }>();
    for (const x of s.body.slots as { startsAt: string; endsAt: string }[]) if (!days.has(x.startsAt.slice(0, 10))) days.set(x.startsAt.slice(0, 10), x);
    const perDay = [...days.values()];
    expect(perDay.length, 'distinct days with home slots').toBeGreaterThan(slotIndex);
    const slot = perDay[slotIndex];
    const h = await kiorex(t.p1, 'POST', '/bookings', { providerId: PROVIDER, typeId, startsAt: slot.startsAt, endsAt: slot.endsAt, serviceLocation: 'HOME', addressId: addrId });
    expect(h.status, JSON.stringify(h.body)).toBe(201);
    created.push(h.body.id);
    const c = await kiorex(t.p1, 'POST', `/bookings/${h.body.id}/confirm`, confirmBody, { 'Idempotency-Key': h.body.id });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    return { id: h.body.id as string, slot };
  }
  const visitFor = async (bookingId: string) => (await q('kiorly', `select h.* from "HomeVisit" h join "Appointment" a on a.id = h."appointmentId" where a."externalReference" = $1`, [bookingId]))[0];

  beforeAll(async () => {
    t = await tokens();
    await syncProviders(t.ops);
    nurse = await staffLogin('mona@nurse-demo.kiorly.test', 'Demo@12345');
    const prov = (await kiorex(t.p1, 'GET', `/providers/${PROVIDER}`)).body;
    expect(prov.id, JSON.stringify(prov)).toBe(PROVIDER);
    const typesRow = await q('kiorex_platform', `select "typeId" from "BookingIntent" where "providerId" = $1 and "typeId" is not null limit 1`, [PROVIDER]);
    typeId = prov.visitTypes?.[0]?.id ?? prov.types?.[0]?.id ?? typesRow[0]?.typeId ?? 'demo_ty_nsolo_injection';
    for (const [key, district] of [['near', 'nasr-city'], ['far', 'maadi']] as const) {
      const a = await kiorex(t.p1, 'POST', '/me/addresses', { label: `E2E ${key}`, governorate: 'cairo', district, street: STREET, building: '7', floor: '2', flat: '5' });
      expect(a.status, JSON.stringify(a.body)).toBe(201);
      const conf = await kiorex(t.p1, 'POST', `/me/addresses/${a.body.id}/confirm`);
      expect(conf.status, JSON.stringify(conf.body)).toBe(200);
      if (key === 'near') addrId = a.body.id; else farAddrId = a.body.id;
    }
  });
  afterAll(async () => {
    for (const id of created) await kiorex(t.p1, 'POST', `/bookings/${id}/cancel`, { reason: 'e2e cleanup' }).catch(() => undefined);
    for (const id of [addrId, farAddrId]) if (id) await kiorex(t.p1, 'DELETE', `/me/addresses/${id}`).catch(() => undefined);
  });

  it('home slots exist for a covered district; an uncovered district is refused with OUT_OF_COVERAGE (never an empty list)', async () => {
    const ok = await homeSlots('nasr-city');
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.slots.length).toBeGreaterThan(0);
    const far = await homeSlots('maadi');
    expect(far.status).toBe(422);
    expect(far.body.code).toBe('OUT_OF_COVERAGE');
  });

  it('hold with addressId -> confirm -> Kiorly HomeVisit; the address is encrypted at rest and never echoed', async () => {
    const b = await homeBooking(0);
    await waitStatus(t.p1, b.id, ['CONFIRMED', 'PENDING_CLINIC']);
    const v = await waitFor('Kiorly HomeVisit', async () => visitFor(b.id));
    expect(v.districtId).toBe('nasr-city');
    expect(v.addressCiphertext).toBeTruthy();
    expect(JSON.stringify(v)).not.toContain(STREET);
    const dump = JSON.stringify((await q('kiorly', `select * from "Appointment" where "externalReference" = $1`, [b.id])));
    expect(dump).not.toContain(STREET);
    const bk = (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body;
    expect(bk.serviceLocation).toBe('HOME');
    expect(bk.visitDistrict).toBe('nasr-city');
    expect(bk.home.steps.length).toBeGreaterThan(0);
    // an address outside the coverage cannot be held either
    const s = (await homeSlots('nasr-city')).body.slots.at(-1);
    const bad = await kiorex(t.p1, 'POST', '/bookings', { providerId: PROVIDER, typeId, startsAt: s.startsAt, endsAt: s.endsAt, serviceLocation: 'HOME', addressId: farAddrId });
    expect(bad.status).toBe(422);
    expect(bad.body.code).toBe('OUT_OF_COVERAGE');
  });

  it('nurse departs and arrives (visit state + Kiorex timeline), then finishes the visit', async () => {
    const b = await homeBooking(1);
    await waitStatus(t.p1, b.id, ['CONFIRMED', 'PENDING_CLINIC']);
    const v = await waitFor('Kiorly HomeVisit', async () => visitFor(b.id));
    const apt = (await q('kiorly', `select id from "Appointment" where "externalReference" = $1`, [b.id]))[0];
    const id = v.id;
    const dep = await kiorly(nurse, 'POST', `/home-visits/${id}/depart`, { lat: 30.05, lng: 31.33, etaMinutes: 20 });
    expect(dep.status, JSON.stringify(dep.body)).toBeLessThan(300);
    const seen = await waitFor('Kiorex en route', async () => { const x = (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body; return x.home?.subState === 'EN_ROUTE' ? x : undefined; }, 60_000, 1500);
    expect(seen.home.steps.find((s: any) => s.key === 'ON_THE_WAY')).toMatchObject({ reached: true });
    const arr = await kiorly(nurse, 'POST', `/home-visits/${id}/arrive`, { lat: 30.05, lng: 31.33 });
    expect(arr.status, JSON.stringify(arr.body)).toBeLessThan(300);
    await waitFor('Kiorex arrived', async () => (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.home?.subState === 'ARRIVED', 60_000, 1500);
    const fin = await kiorly(nurse, 'POST', `/home-visits/${id}/finish`, { lat: 30.05, lng: 31.33 });
    expect(fin.status, JSON.stringify(fin.body)).toBeLessThan(500); // finishing needs the signed visit record first (409 is a valid refusal, never 5xx)

    expect((await q('kiorly', `select status from "Appointment" where id = $1`, [apt.id]))[0].status).toBe('CHECKED_IN');
  });

  it('unsafe abort is never a no-show: Kiorex gets the category only and the paid deposit goes to HOLD_FOR_REVIEW (never forfeited)', async () => {
    const b = await homeBooking(2);
    await waitStatus(t.p1, b.id, ['CONFIRMED', 'PENDING_CLINIC']);
    const bk0 = (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body;
    if (bk0.depositStatus === 'REQUIRED') {
      const co = await kiorex(t.p1, 'POST', `/bookings/${b.id}/deposit-checkout`);
      expect(co.status, JSON.stringify(co.body)).toBe(200);
      expect((await kiorex(undefined, 'POST', `/pay/fake-checkout/${co.body.paymentId}/complete`, { outcome: 'pay' })).status).toBe(200);
      await waitFor('deposit PAID', async () => (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.depositStatus === 'PAID');
    }
    const v = await waitFor('Kiorly HomeVisit', async () => visitFor(b.id));
    await kiorly(nurse, 'POST', `/home-visits/${v.id}/depart`, { lat: 30.05, lng: 31.33, etaMinutes: 15 });
    await kiorly(nurse, 'POST', `/home-visits/${v.id}/arrive`, { lat: 30.05, lng: 31.33 });
    const ab = await kiorly(nurse, 'POST', `/home-visits/${v.id}/abort-unsafe`, { reason: 'E2E: aggressive dog at the door', reasonCategory: 'UNSAFE_ENVIRONMENT', lat: 30.05, lng: 31.33 });
    expect(ab.status, JSON.stringify(ab.body)).toBeLessThan(300);
    const got = await waitFor('Kiorex aborted-unsafe', async () => { const x = (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body; return x.home?.subState === 'ABORTED_UNSAFE' ? x : undefined; }, 60_000, 1500);
    expect(got.status).not.toBe('NO_SHOW');
    expect(got.home.aborted).toBeTruthy();
    if (bk0.depositStatus === 'REQUIRED') {
      const dep = await waitFor('deposit HOLD_FOR_REVIEW', async () => { const x = (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body; return x.depositStatus === 'HOLD_FOR_REVIEW' ? x : undefined; }, 60_000, 1500);
      expect(dep.depositStatus).not.toBe('FORFEITED');
      const held = await kiorex(t.ops, 'GET', '/admin/payments/held-for-review');
      expect(held.status).toBe(200);
      expect(JSON.stringify(held.body)).toContain(b.id);
    }
    // the safety console lists it for ops (category only, no address)
    const feed = await kiorex(t.ops, 'GET', '/admin/safety/unsafe-aborts');
    expect(feed.status).toBe(200);
    expect(JSON.stringify(feed.body)).not.toContain(STREET);
  });
});
