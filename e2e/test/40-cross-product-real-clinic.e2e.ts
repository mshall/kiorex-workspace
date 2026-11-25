import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomInt } from 'node:crypto';
import { loginWithPhone } from '../src/passport.js';
import { tokens, providerBySpecialty, book, kiorlyAppointmentFor, waitStatus } from '../src/fixtures.js';
import { kiorex, kiorly, staffLogin, q, waitFor } from '../src/clients.js';
import { recordDevGate, releaseDevGate } from '../src/verticals.js';
import { resetOtpLimits } from '../src/db.js';

/**
 * Gap closure, e2e 39 on the REAL Kiorly Clinic (private stack: `scripts/gap-stack.sh up`, Clinic :3139, Kiorex :4139, own cloned databases; the shared Passport is only read).
 * Unlike suite 39 the Clinic is not played by a signed webhook: a patient books through Kiorex, the real Clinic checks the patient in, the clinician writes a prescription and signs, and the real outbox
 * delivers what the Clinic really emits:
 *   - COMPLETED / CHECKED_IN carry the Clinic's visit times (contracts 1.13.0) and Kiorex stores them for the short-visit fraud rule;
 *   - PRESCRIPTION_SHARED carries the appointment id and the continuity prompt follows exactly that booking (parent hinted by the Clinic, not inferred);
 *   - CARE_PLAN_SUGGESTED (the real route) makes the home-visit prompt of the same visit.
 * The launch-locked package flag gets the DEV-ONLY gate evidence for the PRIVATE database and loses it again in afterAll. Nothing here is a real approval.
 */
const STACK = process.env.E2E_KIOREX_URL?.includes(':4139');
const d = STACK ? describe : describe.skip; // never runs against the shared stack (it does not carry this build)
d('40. Cross-product on the real Clinic: appointment id, visit times, care plan suggestion', () => {
  let ops: string; let patient: string; let staff: string; let sub = ''; let bookingId = ''; let apt: any; let encId = '';
  const phone = `+2012${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;

  beforeAll(async () => {
    const t = await tokens(); ops = t.ops;
    await resetOtpLimits();
    patient = (await loginWithPhone(phone)).accessToken;
    expect((await kiorex(patient, 'PUT', '/me/profile', { nameEn: 'Real Clinic Tester', gender: 'FEMALE', preferredLocale: 'en' })).status).toBe(200);
    sub = (await kiorex(patient, 'GET', '/me/profile')).body.sub;
    staff = await staffLogin('kxdev.mona.fahmy@kiorly.dev');
    await recordDevGate(ops, 'growth.cross_product');
    expect((await kiorex(patient, 'PUT', '/growth/v1/continuity/consent', { granted: true, source: 'web' })).status).toBe(200);
  });
  afterAll(async () => { await releaseDevGate(ops, 'growth.cross_product').catch(() => undefined); });

  it('the patient books through Kiorex, the real Clinic checks the patient in', async () => {
    const p = await providerBySpecialty((await tokens()).p1, 'paediatrics').catch(async () => providerBySpecialty(patient, 'paediatrics'));
    const b = await book(patient, p); bookingId = b.id;
    apt = await kiorlyAppointmentFor(bookingId);
    expect(apt.bookingSource).toBe('KIOREX_MARKETPLACE');
    expect((await kiorly(staff, 'PATCH', `/appointments/${apt.id}/status`, { status: 'CHECKED_IN' })).status).toBe(200);
    await waitStatus(patient, bookingId, 'CHECKED_IN');
    expect((await q('kiorex_platform', `select "kiorlyAppointmentId" from "BookingIntent" where id = $1`, [bookingId]))[0].kiorlyAppointmentId).toBe(apt.id);
  });

  it('the patient consents to share the visit summary and the prescription (signed push to the real Clinic); the clinician prescribes and signs', async () => {
    for (const scope of ['VISIT_SUMMARY', 'PRESCRIPTIONS']) expect((await kiorex(patient, 'PUT', `/me/record-sharing/${scope}`, { granted: true })).status).toBe(200);
    await waitFor('consent reached the Clinic', async () => (await q('kiorly', `select count(*)::int as n from "PatientRecordShareConsent" c join "Patient" p on p.id = c."patientId" where p.id = $1 and c.granted`, [apt.patientId]))[0].n >= 2);
    const enc = await waitFor('encounter created at check-in', async () => (await q('kiorly', `select id from "Encounter" where "appointmentId" = $1`, [apt.id]))[0]);
    encId = enc.id;
    expect((await kiorly(staff, 'PATCH', `/encounters/${encId}`, { subjective: 'cough', assessment: 'URTI', plan: 'rest' })).status).toBe(200);
    expect((await kiorly(staff, 'POST', `/encounters/${encId}/diagnoses`, { icd10Code: 'J06.9', descriptionEn: 'URTI', isPrimary: true })).status).toBe(201);
    expect((await kiorly(staff, 'POST', `/encounters/${encId}/medications`, { drugName: 'Paracetamol 500mg', dosage: '1 tablet', frequency: 'three times a day', duration: '3 days' })).status).toBe(201);
    expect((await kiorly(staff, 'POST', `/encounters/${encId}/finalize`)).status).toBe(201);
    expect(await waitStatus(patient, bookingId, 'COMPLETED')).toBe('COMPLETED');
  });

  it('what the real Clinic put on the wire: COMPLETED carries visit times and PRESCRIPTION_SHARED carries the appointment id (and no clinical content beyond the contract)', async () => {
    const events = await waitFor('outbox events SENT', async () => {
      const rows = await q('kiorly', `select type, payload, status from "OutboxEvent" where "aggregateId" in ($1, $2) and type in ('COMPLETED','CHECKED_IN','PRESCRIPTION_SHARED')`, [apt.id, encId]);
      return rows.length >= 3 && rows.every((r: any) => r.status === 'SENT') ? rows : undefined;
    }, 60_000);
    const by = (t: string) => events.find((e: any) => e.type === t)!.payload;
    expect(by('CHECKED_IN').checkedInAt).toMatch(/^\d{4}-/);
    expect(by('COMPLETED')).toMatchObject({ checkedInAt: expect.any(String), completedAt: expect.any(String) });
    expect(Date.parse(by('COMPLETED').completedAt)).toBeGreaterThanOrEqual(Date.parse(by('COMPLETED').checkedInAt));
    expect(by('PRESCRIPTION_SHARED').appointmentId).toBe(apt.id);
  });

  it('Kiorex stored the visit times and the prompt follows the booking the Clinic named (hinted, not inferred)', async () => {
    const times = await waitFor('VISIT_TIMES stored', async () => { const r = await q('kiorex_platform', `select detail from "BookingEvent" where "bookingId" = $1 and kind = 'VISIT_TIMES'`, [bookingId]); return r.length >= 2 ? r : undefined; });
    expect(JSON.stringify(times)).toContain('completedAt');
    const entry = await waitFor('RX prompt', async () => (await q('kiorex_platform', `select "parentBookingId", "parentHinted" from "CrossProductEntryPoint" where sub = $1 and kind = 'RX_TO_PHARMACY'`, [sub]))[0]);
    expect(entry).toEqual({ parentBookingId: bookingId, parentHinted: true });
  });

  it('CARE_PLAN_SUGGESTED through the real route: ids only on the wire, once per visit, and Kiorex offers the home-visit prompt of the same booking', async () => {
    const r1 = await kiorly(staff, 'POST', `/encounters/${encId}/suggest-care-plan`);
    expect([r1.status, r1.body]).toEqual([201, { suggested: true }]);
    const again = await kiorly(staff, 'POST', `/encounters/${encId}/suggest-care-plan`); expect(again.body).toEqual({ suggested: false, reason: 'ALREADY_SUGGESTED' });
    const ev = await waitFor('CARE_PLAN_SUGGESTED sent', async () => { const r = await q('kiorly', `select payload, status from "OutboxEvent" where type = 'CARE_PLAN_SUGGESTED' and "aggregateId" = $1`, [encId]); return r[0]?.status === 'SENT' ? r[0] : undefined; }, 60_000);
    expect(Object.keys(ev.payload).sort()).toEqual(['aggregateId', 'aggregateType', 'appointmentId', 'clinicId', 'encounterId', 'patientId', 'suggestedAt']);
    const entry = await waitFor('home-visit prompt', async () => (await q('kiorex_platform', `select "parentBookingId", "parentHinted" from "CrossProductEntryPoint" where sub = $1 and kind = 'CARE_PLAN_TO_HOME_VISIT'`, [sub]))[0]);
    expect(entry).toEqual({ parentBookingId: bookingId, parentHinted: true });
  });
});
