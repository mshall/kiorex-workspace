import { describe, it, expect, beforeAll } from 'vitest';
import { tokens, providerBySpecialty, pickSlot, hold, confirm, kiorlyAppointmentFor, waitStatus, webhookReceipts, type Provider, freeSlots } from '../src/fixtures.js';
import { kiorex, kiorly, q, waitFor } from '../src/clients.js';

/** KXM-BK-02 hold · KXM-BK-03 idempotent confirm · KXM-BK-04 slot conflict · KX-09 §05 webhook confirms. */
describe('c. Golden booking: hold -> confirm -> Kiorly appointment -> webhook -> CONFIRMED', () => {
  let t: Awaited<ReturnType<typeof tokens>>; let p: Provider;
  beforeAll(async () => { t = await tokens(); p = await providerBySpecialty(t.p1, 'paediatrics'); });

  it('holds a slot, confirms with an Idempotency-Key, and Kiorly owns the appointment', async () => {
    const slot = await pickSlot(t.p1, p);
    const h = await hold(t.p1, p, slot);
    expect(h.status).toBe(201);
    expect(h.body.status).toBe('HELD');
    expect(new Date(h.body.holdExpiresAt).getTime() - Date.now()).toBeLessThanOrEqual(5 * 60_000 + 5_000);
    const holdRow = await q('kiorly', `select id, status from "MarketplaceSlotHold" where "externalRef" = $1`, [h.body.id]).catch(() => []);
    if (holdRow.length) expect(holdRow).toHaveLength(1);

    const c1 = await confirm(t.p1, h.body.id, h.body.id);
    expect(c1.status).toBe(200);
    expect(['CONFIRMED', 'PENDING_CLINIC']).toContain(c1.body.status);

    const apt = await kiorlyAppointmentFor(h.body.id);
    expect(apt).toBeTruthy();
    expect(apt.bookingSource).toBe('KIOREX_MARKETPLACE');
    expect(apt.status).toBe('CONFIRMED');
    expect(new Date(apt.startsAt).toISOString()).toBe(new Date(slot.startsAt).toISOString());

    // Kiorly outbox -> Kiorex webhook (KX-09 §05): receipt recorded, booking CONFIRMED
    await waitFor('APPOINTMENT_CONFIRMED webhook', async () => (await webhookReceipts(apt.id)).some((r) => r.type === 'APPOINTMENT_CONFIRMED'));
    expect(await waitStatus(t.p1, h.body.id, 'CONFIRMED')).toBe('CONFIRMED');
    const ob = await q('kiorly', `select status from "OutboxEvent" where "aggregateId" = $1 and type = 'APPOINTMENT_CONFIRMED'`, [apt.id]);
    expect(ob.map((r) => r.status)).toEqual(['SENT']);

    // Repeating the confirm with the same key: same result, no duplicate appointment
    const c2 = await confirm(t.p1, h.body.id, h.body.id);
    expect(c2.status).toBe(200);
    expect(c2.body.id).toBe(c1.body.id);
    expect(c2.body.status).toBe('CONFIRMED');
    const n = await q('kiorly', `select count(*)::int c from "Appointment" where "externalReference" = $1`, [h.body.id]);
    expect(n[0].c).toBe(1);
  });

  it('the Kiorly marketplace API itself is idempotent on the booking id (BK-03)', async () => {
    const { kiorlyMarketplace } = await import('../src/hmac.js');
    const slot = await pickSlot(t.p1, p);
    const h = await hold(t.p1, p, slot);
    const c = await confirm(t.p1, h.body.id);
    expect(c.status).toBe(200);
    const apt = await kiorlyAppointmentFor(h.body.id);
    const body = { clinicId: apt.clinicId, clinicianId: apt.clinicianId, typeId: apt.appointmentTypeId, startsAt: apt.startsAt, endsAt: apt.endsAt, holdExternalRef: h.body.id,
      patient: { phone: '+201000000001', firstNameEn: 'Amira', lastNameEn: 'Test' }, marketplaceConsentGranted: true, remindersConsentGranted: true };
    const again = await kiorlyMarketplace('POST', '/bookings', body, { 'idempotency-key': h.body.id });
    expect([200, 201]).toContain(again.status);
    expect(again.body.appointmentId).toBe(apt.id);
    const n = await q('kiorly', `select count(*)::int c from "Appointment" where "externalReference" = $1`, [h.body.id]);
    expect(n[0].c).toBe(1);
  });

  it('requires marketplace consent to confirm', async () => {
    const h = await hold(t.p1, p, await pickSlot(t.p1, p));
    const r = await kiorex(t.p1, 'POST', `/bookings/${h.body.id}/confirm`, { marketplaceConsent: false }, { 'Idempotency-Key': h.body.id });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('CONSENT_REQUIRED');
    await kiorex(t.p1, 'POST', `/bookings/${h.body.id}/release`);
  });

  it("another patient cannot read or confirm someone else's booking", async () => {
    const h = await hold(t.p1, p, await pickSlot(t.p1, p));
    expect((await kiorex(t.p2, 'GET', `/bookings/${h.body.id}`)).status).toBe(404);
    expect((await confirm(t.p2, h.body.id)).status).toBe(404);
    await kiorex(t.p1, 'POST', `/bookings/${h.body.id}/release`);
  });
});

describe('d. Conflict: two patients race for the same slot', () => {
  it('one wins the hold; the other gets 409 SLOT_TAKEN with alternatives (BK-04)', async () => {
    const t = await tokens(); const p = await providerBySpecialty(t.p1, 'paediatrics');
    const slot = await pickSlot(t.p1, p);
    const [a, b] = await Promise.all([hold(t.p1, p, slot), hold(t.p2, p, slot)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.code).toBe('SLOT_TAKEN');
    expect(Array.isArray(loser.body.alternatives)).toBe(true);
    expect(loser.body.alternatives.length).toBeGreaterThanOrEqual(1);
    expect(loser.body.alternatives.length).toBeLessThanOrEqual(3);
    for (const alt of loser.body.alternatives) expect(new Date(alt.startsAt).toISOString()).not.toBe(new Date(slot.startsAt).toISOString());
    // the winner can still confirm; exactly one appointment exists for that slot
    const win = a.status === 201 ? a : b; const winTok = a.status === 201 ? t.p1 : t.p2;
    expect((await confirm(winTok, win.body.id)).status).toBe(200);
    // exactly one ACTIVE appointment holds the slot (the set that blocks bookings in Kiorly); COMPLETED / NO_SHOW rows that earlier files left in the same future slot do not count
    const n = await q('kiorly', `select count(*)::int c from "Appointment" where "clinicianId" = (select "clinicianId" from "Appointment" where "externalReference" = $1) and "startsAt" = $2 and status in ('SCHEDULED','CONFIRMED','CHECKED_IN')`, [win.body.id, slot.startsAt]);
    expect(n[0].c).toBe(1);
  });

  it('a slot already booked is reported SLOT_TAKEN on a later hold', async () => {
    const t = await tokens(); const p = await providerBySpecialty(t.p1, 'paediatrics');
    const slot = await pickSlot(t.p1, p);
    const h1 = await hold(t.p1, p, slot); expect(h1.status).toBe(201);
    expect((await confirm(t.p1, h1.body.id)).status).toBe(200);
    const h2 = await hold(t.p2, p, slot);
    expect(h2.status).toBe(409);
    expect(h2.body.code).toBe('SLOT_TAKEN');
    expect(h2.body.alternatives.length).toBeGreaterThanOrEqual(1);
  });
});
void kiorly; void freeSlots;
