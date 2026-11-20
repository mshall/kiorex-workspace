import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomInt } from 'node:crypto';
import { loginWithPhone } from '../src/passport.js';
import { tokens, providerBySpecialty, book, kiorlyAppointmentFor, waitStatus, webhookReceipts, type Provider } from '../src/fixtures.js';
import { kiorex, kiorly, staffLogin, q, waitFor } from '../src/clients.js';
import { resetOtpLimits } from '../src/db.js';

/** KXM-LC visit lifecycle · KX-09 §04 events · KXM-RV-01 verified review · KXM-RV-03 aggregate back to Kiorly · CR-03 commission charge. */
describe('e. Lifecycle: check-in -> completed -> review invitation -> verified review -> aggregate in Kiorly (+ commission)', () => {
  let ops: string; let patient: string; let p: Provider; let bookingId: string; let apt: any; let staff: string; const rateId = `e2e_rate_${Date.now()}`;
  const phone = `+2012${String(randomInt(0, 100_000_000)).padStart(8, '0')}`; // fresh patient => "new patient" for the commission rule

  beforeAll(async () => {
    const t = await tokens(); ops = t.ops;
    await resetOtpLimits();
    patient = (await loginWithPhone(phone)).accessToken;
    expect((await kiorex(patient, 'PUT', '/me/profile', { nameEn: 'Lifecycle Tester', gender: 'FEMALE', preferredLocale: 'en' })).status).toBe(200);
    p = await providerBySpecialty(t.p1, 'paediatrics');
    staff = await staffLogin('kxdev.mona.fahmy@kiorly.dev');
    // NEEDS_HUMAN (KX-12): no commission rate is seeded. A throw-away placeholder (1 EGP flat) is inserted for this test only and removed after.
    const m = await q('kiorly', `select id from "Market" where code = 'EG'`);
    const have = await q('kiorly', `select 1 from "KiorexCommissionRate" where "marketId" = $1 and "validTo" is null limit 1`, [m[0].id]);
    if (!have.length) await q('kiorly', `insert into "KiorexCommissionRate" (id, "marketId", "feeType", amount, "validFrom", "updatedAt") values ($1, $2, 'FLAT', 1, (now() at time zone 'utc') - interval '1 day', now() at time zone 'utc')`, [rateId, m[0].id]);
  });
  afterAll(async () => { await q('kiorly', `delete from "KiorexCommissionRate" where id = $1`, [rateId]); });

  it('books as a brand-new patient and Kiorex shows CONFIRMED', async () => {
    const b = await book(patient, p);
    bookingId = b.id;
    apt = await kiorlyAppointmentFor(bookingId);
    expect(apt.bookingSource).toBe('KIOREX_MARKETPLACE');
    expect(apt.isNewPatientAtBooking).toBe(true);
    await waitStatus(patient, bookingId, 'CONFIRMED');
  });

  it('clinic staff checks the patient in -> Kiorex CHECKED_IN', async () => {
    const r = await kiorly(staff, 'PATCH', `/appointments/${apt.id}/status`, { status: 'CHECKED_IN' });
    expect(r.status).toBe(200);
    expect(await waitStatus(patient, bookingId, 'CHECKED_IN')).toBe('CHECKED_IN');
  });

  it('signing the encounter completes the visit -> Kiorex COMPLETED; review invitation + commission events arrive', async () => {
    const enc = await waitFor('encounter created at check-in', async () => (await q('kiorly', `select id from "Encounter" where "appointmentId" = $1`, [apt.id]))[0]);
    expect((await kiorly(staff, 'PATCH', `/encounters/${enc.id}`, { noMedications: true, subjective: 'cough', assessment: 'URTI', plan: 'rest' })).status).toBe(200);
    expect((await kiorly(staff, 'POST', `/encounters/${enc.id}/diagnoses`, { icd10Code: 'J06.9', descriptionEn: 'URTI', isPrimary: true })).status).toBe(201);
    expect((await kiorly(staff, 'POST', `/encounters/${enc.id}/finalize`)).status).toBe(201);
    expect((await q('kiorly', `select status from "Appointment" where id = $1`, [apt.id]))[0].status).toBe('COMPLETED');
    expect(await waitStatus(patient, bookingId, 'COMPLETED')).toBe('COMPLETED');

    const types = await waitFor('COMPLETED + REVIEW_INVITATION_ELIGIBLE + COMMISSION_CHARGE_CREATED receipts', async () => {
      const t = (await webhookReceipts(apt.id)).map((r) => r.type);
      return t.includes('COMPLETED') && t.includes('REVIEW_INVITATION_ELIGIBLE') && t.includes('COMMISSION_CHARGE_CREATED') ? t : undefined;
    });
    expect(types).toContain('CHECKED_IN');
    const charge = await q('kiorly', `select status, amount from "KiorexCommissionCharge" where "appointmentId" = $1`, [apt.id]);
    expect(charge).toHaveLength(1);
    const sent = await q('kiorly', `select status from "OutboxEvent" where "aggregateId" = $1 and type in ('COMPLETED','REVIEW_INVITATION_ELIGIBLE','COMMISSION_CHARGE_CREATED')`, [apt.id]);
    expect(sent.every((r) => r.status === 'SENT')).toBe(true);
  });

  it('a review invitation is scheduled for the patient (RV-01 eligibility)', async () => {
    const msgs = await q('kiorex_platform', `select "templateId", status from "Message" where "bookingId" = $1`, [bookingId]);
    expect(msgs.map((m) => String(m.templateId).toLowerCase()).join(' ')).toContain('review');
  });

  it('the patient submits a verified review; the aggregate syncs back to Kiorly (RV-01/RV-03)', async () => {
    const r = await kiorex(patient, 'POST', `/bookings/${bookingId}/review`, { rating: 5, text: 'Excellent, kind and thorough.' });
    expect(r.status).toBe(201);
    expect(r.body.rating).toBe(5);
    // one review per completed appointment
    expect((await kiorex(patient, 'POST', `/bookings/${bookingId}/review`, { rating: 4 })).status).toBe(409);
    // someone who did not attend cannot review it
    const other = (await tokens()).p2;
    expect((await kiorex(other, 'POST', `/bookings/${bookingId}/review`, { rating: 1 })).status).toBe(404);

    const rating = await waitFor('KiorexRating in Kiorly', async () => {
      const rows = await q('kiorly', `select "averageRating"::float as avg, "reviewCount" from "KiorexRating" where "clinicianId" = $1 and "clinicId" = $2`, [apt.clinicianId, apt.clinicId]);
      return rows[0]?.reviewCount >= 1 ? rows[0] : undefined;
    }, 60_000);
    expect(rating.avg).toBeGreaterThan(0);
    const listed = await kiorex(patient, 'GET', `/providers/${p.id}/reviews`);
    expect(JSON.stringify(listed.body)).toContain('Excellent');
    void ops;
  });
});
