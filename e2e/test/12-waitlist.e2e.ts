import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tokens, providerBySpecialty, book, confirm, freeSlots, kiorlyAppointmentFor, waitStatus, type Provider } from '../src/fixtures.js';
import { kiorex, staffLogin, q, waitFor } from '../src/clients.js';

/**
 * KXM-BK-12 waitlist, real stack: a FULL schedule (one slot taken by patient 2) -> patient 1 joins the waitlist for exactly that slot window
 * (SLOTS_AVAILABLE is refused when the doctor has open slots) -> patient 2 cancels -> Kiorly emits the cancellation -> Kiorex autofill offers the slot
 * to patient 1 -> patient 1 accepts (5-minute hold) -> confirms -> Kiorly owns the appointment. Also: decline puts the entry back to WAITING.
 */
describe('n. Waitlist autofill against the real Kiorly (KXM-BK-12)', () => {
  let t: Awaited<ReturnType<typeof tokens>>; let p: Provider; let staff: string;
  const entries: string[] = [];

  beforeAll(async () => {
    t = await tokens(); p = await providerBySpecialty(t.p1, 'paediatrics'); staff = await staffLogin('kxdev.mona.fahmy@kiorly.dev');
  });
  afterAll(async () => {
    for (const id of entries) await kiorex(t.p1, 'DELETE', `/waitlist/${id}`).catch(() => undefined);
  });

  async function joinForSlot(slot: { startsAt: string; endsAt: string }) {
    const from = new Date(new Date(slot.startsAt).getTime() - 60_000).toISOString();
    const to = new Date(new Date(slot.startsAt).getTime() + 60_000).toISOString();
    return kiorex(t.p1, 'POST', '/waitlist', { providerId: p.id, typeId: p.defaultTypeId, preferredFrom: from, preferredTo: to });
  }

  it('refuses to join while the doctor has open slots in the window (409 SLOTS_AVAILABLE)', async () => {
    const [s] = await freeSlots(t.p1, p, 12, { fresh: true }); // not the 60 s cache: earlier files (10-resilience) book slots directly on Kiorly
    const r = await joinForSlot(s);
    if (r.status === 201) entries.push(r.body.id); // never leave a stray entry behind: join is idempotent per patient+doctor+type and would poison the next tests
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('SLOTS_AVAILABLE');
  });

  it('full slot -> join -> the other patient cancels -> offer -> accept -> confirm -> Kiorly appointment (offer accepted, entry BOOKED)', async () => {
    const slots = await freeSlots(t.p2, p, 12, { fresh: true });
    const slot = slots[Math.floor(slots.length / 2)];
    const taken = await book(t.p2, p, slot);
    await waitStatus(t.p2, taken.id, 'CONFIRMED');

    const joined = await joinForSlot(slot);
    expect(joined.status).toBe(201);
    entries.push(joined.body.id);
    expect(joined.body.status).toBe('WAITING');

    // the holder cancels -> capacity returns -> autofill (SLOTS_CHANGED / cancellation webhook, or the periodic scan) offers it to patient 1
    expect((await kiorex(t.p2, 'POST', `/bookings/${taken.id}/cancel`, { reason: 'e2e waitlist' })).status).toBe(200);
    const offer = await waitFor('waitlist offer', async () => {
      await kiorex(t.ops, 'POST', '/admin/waitlist/scan');
      const mine = (await kiorex(t.p1, 'GET', '/waitlist')).body.find((e: any) => e.id === joined.body.id);
      return mine?.offers?.find((o: any) => o.status === 'OFFERED');
    }, 90_000, 2000);
    expect(new Date(offer.startsAt).toISOString()).toBe(new Date(slot.startsAt).toISOString());

    // a stranger cannot accept someone else's offer
    expect((await kiorex(t.p2, 'POST', `/waitlist/offers/${offer.id}/accept`)).status).toBe(404);

    const accepted = await kiorex(t.p1, 'POST', `/waitlist/offers/${offer.id}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('HELD');
    const conf = await confirm(t.p1, accepted.body.id);
    expect(conf.status).toBe(200);
    await waitStatus(t.p1, accepted.body.id, 'CONFIRMED');
    const apt = await kiorlyAppointmentFor(accepted.body.id);
    expect(apt.status).toMatch(/SCHEDULED|CONFIRMED/);
    expect(new Date(apt.startsAt).toISOString()).toBe(new Date(slot.startsAt).toISOString());

    const after = (await kiorex(t.p1, 'GET', '/waitlist')).body.find((e: any) => e.id === joined.body.id);
    expect(after?.status).toBe('BOOKED');
    expect(after.offers[0].status).toBe('ACCEPTED');
    expect(accepted.body.id).toBe(after.offers[0].bookingId);
    // the offer cannot be accepted twice
    expect((await kiorex(t.p1, 'POST', `/waitlist/offers/${offer.id}/accept`)).status).toBe(409);
    // clean up the slot through the clinic like production
    await (await import('../src/clients.js')).kiorly(staff, 'PATCH', `/appointments/${apt.id}/status`, { status: 'CANCELLED', cancellationReason: 'e2e cleanup' });
  });

  it('declining an offer returns the entry to WAITING and never re-offers the same slot', async () => {
    const slots = await freeSlots(t.p2, p, 12, { fresh: true });
    const slot = slots[Math.max(0, Math.floor(slots.length / 3))];
    const taken = await book(t.p2, p, slot);
    await waitStatus(t.p2, taken.id, 'CONFIRMED');
    const joined = await joinForSlot(slot);
    expect(joined.status).toBe(201);
    entries.push(joined.body.id);
    await kiorex(t.p2, 'POST', `/bookings/${taken.id}/cancel`, { reason: 'e2e waitlist' });
    const offer = await waitFor('waitlist offer', async () => {
      await kiorex(t.ops, 'POST', '/admin/waitlist/scan');
      return (await kiorex(t.p1, 'GET', '/waitlist')).body.find((e: any) => e.id === joined.body.id)?.offers?.find((o: any) => o.status === 'OFFERED');
    }, 90_000, 2000);
    expect((await kiorex(t.p1, 'POST', `/waitlist/offers/${offer.id}/decline`)).status).toBe(200);
    await kiorex(t.ops, 'POST', '/admin/waitlist/scan');
    const mine = (await kiorex(t.p1, 'GET', '/waitlist')).body.find((e: any) => e.id === joined.body.id);
    expect(mine.status).toBe('WAITING');
    expect(mine.offers.filter((o: any) => o.status === 'OFFERED')).toHaveLength(0);
    expect((await kiorex(t.p1, 'DELETE', `/waitlist/${joined.body.id}`)).status).toBe(200);
    void q;
  });
});
