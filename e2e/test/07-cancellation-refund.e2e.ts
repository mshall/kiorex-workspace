import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tokens, providerBySpecialty, book, hold, confirm, pickSlot, freeSlots, kiorlyAppointmentFor, waitStatus, syncProviders, type Provider } from '../src/fixtures.js';
import { kiorex, kiorly, staffLogin, q, waitFor, sleep } from '../src/clients.js';

/** KXM-BK-07 cancel (policy by Kiorly) · KX-06 policy · KXM-PAY-01 deposit checkout · KXM-PAY-02 refund (PSP_MODE=sandbox-fake). */
describe('f. Cancellation by patient (within policy) and by clinic; deposit refund path', () => {
  let t: Awaited<ReturnType<typeof tokens>>; let p: Provider; let staff: string;
  const DEPOSIT = 150; // EGP, TEST VALUE ONLY (KX-12 amounts are NEEDS_HUMAN); set on the visit type for this run and removed after
  let typeRows: { id: string }[] = [];

  async function bumpAndSync() {
    await q('kiorly', `update "MarketplaceListing" set "updatedAt" = greatest(now() at time zone 'utc', "updatedAt") + interval '1 second' where "clinicianId" = (select "clinicianId" from "MarketplaceListing" where id = $1)`, [p.id]);
    await syncProviders(t.ops);
  }

  beforeAll(async () => {
    t = await tokens(); p = await providerBySpecialty(t.p1, 'paediatrics'); staff = await staffLogin('kxdev.mona.fahmy@kiorly.dev');
  });
  afterAll(async () => {
    if (typeRows.length) await q('kiorly', `update "AppointmentType" set "depositAmount" = null where id = any($1)`, [typeRows.map((r) => r.id)]);
    await q('kiorly', `update "Clinic" set "kiorexCancellationPolicy" = null where id = (select "clinicId" from "MarketplaceListing" where id = $1)`, [p.id]);
    await bumpAndSync();
  });

  it('patient cancels within policy -> Kiorex CANCELLED(PATIENT) and Kiorly appointment CANCELLED', async () => {
    const b = await book(t.p1, p);
    await waitStatus(t.p1, b.id, 'CONFIRMED');
    const r = await kiorex(t.p1, 'POST', `/bookings/${b.id}/cancel`, { reason: 'Schedule change' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('CANCELLED');
    expect(r.body.cancelledBy).toBe('PATIENT');
    const apt = await kiorlyAppointmentFor(b.id);
    expect(apt.status).toBe('CANCELLED');
    // the slot is free again
    const again = await hold(t.p2, p, b.slot);
    expect(again.status).toBe(201);
    await kiorex(t.p2, 'POST', `/bookings/${again.body.id}/release`);
    // cancelling again is refused (not changeable)
    expect((await kiorex(t.p1, 'POST', `/bookings/${b.id}/cancel`, {})).status).toBe(422);
  });

  it('outside the clinic cancellation window Kiorly refuses with CANCELLATION_WINDOW_CLOSED (422)', async () => {
    // policy max is 168 h: take the earliest free slot (>= 3 days out, < 7 days) so it falls inside a 168 h window
    const b = await book(t.p1, p, (await freeSlots(t.p1, p))[0]);
    const apt = await kiorlyAppointmentFor(b.id);
    await q('kiorly', `update "Clinic" set "kiorexCancellationPolicy" = '{"patientCancelMinHours": 168}'::jsonb where id = $1`, [apt.clinicId]);
    try {
      const r = await kiorex(t.p1, 'POST', `/bookings/${b.id}/cancel`, {});
      expect(r.status).toBe(422);
      expect(r.body.code).toBe('CANCELLATION_WINDOW_CLOSED');
      expect((await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.status).toBe('CONFIRMED');
    } finally {
      await q('kiorly', `update "Clinic" set "kiorexCancellationPolicy" = null where id = $1`, [apt.clinicId]);
    }
    // clinic still cancels (always allowed) so the slot is not left booked
    await kiorly(staff, 'PATCH', `/appointments/${apt.id}/status`, { status: 'CANCELLED', cancellationReason: 'test cleanup' });
  });

  it('clinic cancels (reason required) -> Kiorex CANCELLED(CLINIC) with the apology notification', async () => {
    const b = await book(t.p1, p);
    await waitStatus(t.p1, b.id, 'CONFIRMED');
    const apt = await kiorlyAppointmentFor(b.id);
    const noReason = await kiorly(staff, 'PATCH', `/appointments/${apt.id}/status`, { status: 'CANCELLED' });
    expect(noReason.status).toBe(400);
    const ok = await kiorly(staff, 'PATCH', `/appointments/${apt.id}/status`, { status: 'CANCELLED', cancellationReason: 'Doctor unavailable' });
    expect(ok.status).toBe(200);
    await waitStatus(t.p1, b.id, 'CANCELLED');
    const got = (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body;
    expect(got.cancelledBy).toBe('CLINIC');
    expect(got.cancellationReason).toContain('Doctor unavailable');
    // the notification is created by the webhook handler just after the status flips: wait for it instead of racing it
    let msgs: any[] = [];
    for (let i = 0; i < 30; i++) { msgs = await q('kiorex_platform', `select "templateId" from "Message" where "bookingId" = $1`, [b.id]); if (msgs.some((m) => /cancel/i.test(m.templateId))) break; await new Promise((r) => setTimeout(r, 500)); }
    expect(msgs.map((m) => m.templateId).join(' ').toLowerCase()).toContain('cancel');
  });

  describe('with a deposit-required visit type (sandbox-fake PSP)', () => {
    beforeAll(async () => {
      const apt = await kiorlyAppointmentFor((await book(t.p1, p)).id);
      typeRows = await q('kiorly', `update "AppointmentType" set "depositAmount" = $2 where "clinicId" = $1 and "marketplaceBookable" returning id`, [apt.clinicId, DEPOSIT]);
      await bumpAndSync();
    });

    async function paidBooking() {
      const b = await book(t.p1, p);
      const bk = (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body;
      expect(bk.depositStatus).toBe('REQUIRED');
      expect(bk.depositAmountMinor).toBe(DEPOSIT * 100);
      const co = await kiorex(t.p1, 'POST', `/bookings/${b.id}/deposit-checkout`);
      expect(co.status).toBe(200);
      expect(co.body.checkoutUrl).toContain('/pay/fake-checkout/');
      const done = await kiorex(undefined, 'POST', `/pay/fake-checkout/${co.body.paymentId}/complete`, { outcome: 'pay' });
      expect(done.status).toBe(200);
      await waitFor('deposit PAID', async () => (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.depositStatus === 'PAID');
      return { ...b, paymentId: co.body.paymentId as string };
    }

    it('deposit is captured by the fake PSP and recorded in Kiorly as a held PatientDeposit (PAY-01)', async () => {
      const b = await paidBooking();
      const apt = await kiorlyAppointmentFor(b.id);
      const dep = await waitFor('Kiorly PatientDeposit', async () => (await q('kiorly', `select source, status, amount::float as amount from "PatientDeposit" where "appointmentId" = $1`, [apt.id]))[0]);
      expect(dep).toMatchObject({ source: 'KIOREX_PAY', status: 'HELD', amount: DEPOSIT });
      await kiorex(t.p1, 'POST', `/bookings/${b.id}/cancel`, {});
    });

    it('patient cancels within policy -> deposit refunded (PAY-02)', async () => {
      const b = await paidBooking();
      const r = await kiorex(t.p1, 'POST', `/bookings/${b.id}/cancel`, { reason: 'changed my mind' });
      expect(r.status).toBe(200);
      const got = await waitFor('deposit REFUNDED', async () => { const x = (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body; return x.depositStatus === 'REFUNDED' ? x : undefined; });
      expect(got.status).toBe('CANCELLED');
      expect(got.depositRefundable).toBe(true);
      const refunds = await q('kiorex_platform', `select status, "amountMinor" from "Refund" where "paymentId" = $1`, [b.paymentId]);
      expect(refunds).toHaveLength(1);
      expect(refunds[0].amountMinor).toBe(DEPOSIT * 100);
    });

    it('clinic cancels -> deposit always refunded (PAY-02)', async () => {
      const b = await paidBooking();
      const apt = await kiorlyAppointmentFor(b.id);
      expect((await kiorly(staff, 'PATCH', `/appointments/${apt.id}/status`, { status: 'CANCELLED', cancellationReason: 'Clinic closed' })).status).toBe(200);
      const got = await waitFor('deposit REFUNDED', async () => { const x = (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body; return x.depositStatus === 'REFUNDED' ? x : undefined; });
      expect(got.status).toBe('CANCELLED');
      expect((await q('kiorex_platform', `select 1 from "Refund" where "paymentId" = $1`, [b.paymentId])).length).toBe(1);
    });
  });
});
void sleep; void confirm; void pickSlot;
