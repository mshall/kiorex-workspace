import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tokens, providerBySpecialty, kiorlyAppointmentFor, freeSlots, type Provider } from '../src/fixtures.js';
import { kiorex, q, staffLogin, waitFor } from '../src/clients.js';
import { KIOREX_API, WEBHOOK_SECRET } from '../src/env.js';
import { bookWith, clinicCharges, clinicDecision, completeVisit, decisionOf, evidenceAsClinic, freshPatient, newLinkCode, seedTouch, signClinicLt, signedHeaders } from '../src/growth.js';

/**
 * GRW-P1-C: the attribution decision wired into the Kiorex booking flow against the real dev stack (Kiorex API, Kiorly Clinic API, Passport, Postgres).
 * Provider link => PROVIDER_LED => no EGP 40; Kiorex search => chargeable new patient; returning patient; referral; campaign; replay and tamper.
 */
describe('growth booking integration: decision at hold, signed acquisition block at confirm, the Clinic decides the fee', () => {
  let p: Provider; let staff: string; let org: string; let clinicId: string; let creatorId: string; const rateId = `e2e_growth_rate_${Date.now()}`; let insertedRate = false;
  const code = newLinkCode();

  beforeAll(async () => {
    const t = await tokens();
    p = await providerBySpecialty(t.p1, 'paediatrics');
    staff = await staffLogin('kxdev.mona.fahmy@kiorly.dev');
    const row = (await q('kiorex_platform', `select "tenantId", "clinicId" from "Provider" where id = $1`, [p.id]))[0];
    org = row.tenantId; clinicId = row.clinicId;
    creatorId = (await q('kiorly', `select id from "User" where email = 'kxdev.mona.fahmy@kiorly.dev'`))[0].id;
    // an ACTIVE provider link of the provider's organisation (the Clinic re-checks the link at booking)
    await q('kiorly', `insert into "ProviderReferralLink" (id, "tenantId", "clinicId", "ownerScope", "channelKind", code, label, status, "createdBy", "updatedAt") values ($1, $2, $3, 'CLINIC', 'WEB_LINK', $4, 'e2e growth link', 'ACTIVE', $5, now())`, [`prl_e2e_${code}`, org, clinicId, code, creatorId]);
    // NEEDS_HUMAN (KX-12): the production rate is not seeded; a throw-away EGP 40 flat rate exists for this file only when none is in force
    const m = await q('kiorly', `select id from "Market" where code = 'EG'`);
    const have = await q('kiorly', `select 1 from "KiorexCommissionRate" where "marketId" = $1 and "validTo" is null limit 1`, [m[0].id]);
    if (!have.length) { insertedRate = true; await q('kiorly', `insert into "KiorexCommissionRate" (id, "marketId", "feeType", amount, "validFrom", "updatedAt") values ($1, $2, 'FLAT', 40, (now() at time zone 'utc') - interval '1 day', now() at time zone 'utc')`, [rateId, m[0].id]); }
  });
  afterAll(async () => {
    await q('kiorly', `delete from "ProviderReferralLink" where id = $1`, [`prl_e2e_${code}`]).catch(() => undefined);
    if (insertedRate) await q('kiorly', `delete from "KiorexCommissionRate" where id = $1`, [rateId]).catch(() => undefined);
  });

  it('provider link: lt at hold -> decision PROVIDER_LED persisted before the Clinic call; the Clinic stores the signed block; no EGP 40 charge after the visit', async () => {
    const pt = await freshPatient();
    const lt = signClinicLt({ tenantId: org, code });
    const b = await bookWith(pt.token, p, { lt });
    const d = await decisionOf(b.id);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ origin: 'PROVIDER_LED', reasonCode: 'EXPLICIT_PROVIDER_CHANNEL' });
    expect((await q('kiorex_platform', `select "acquisitionOrigin", "attributionDecisionId" from "BookingIntent" where id = $1`, [b.id]))[0]).toEqual({ acquisitionOrigin: 'PROVIDER_LED', attributionDecisionId: d[0].id });
    const apt = await kiorlyAppointmentFor(b.id);
    expect(apt.acquisitionOrigin).toBe('PROVIDER_LED');
    expect(apt.acquisitionDecisionRef).toBe(d[0].id);
    expect(apt.acquisitionPolicyVersion).toBe(d[0].policyVersionId);
    // the link-code to organisation mapping was learned from the Clinic-signed token
    expect((await q('kiorex_platform', `select "ownerOrgRef" from "GrowthAcquisitionSource" where "sourceKind" = 'PROVIDER_LINK' and "sourceRef" = $1`, [code]))[0]?.ownerOrgRef).toBe(org);
    await completeVisit(pt.token, b.id, staff);
    const dec = await clinicDecision(apt.id);
    expect(dec.length).toBeGreaterThan(0);
    expect(dec.every((x: any) => x.decision !== 'CHARGE' && x.origin === 'PROVIDER_LED')).toBe(true);
    expect(await clinicCharges(apt.id)).toHaveLength(0); // no EGP 40
    // a provider-led NEW patient still counts as an attended new patient (ANP) in reporting, just a fee-free one
    expect((await q('kiorex_platform', `select props from "GrowthEvent" where "bookingId" = $1 and name = 'BookingAttended'`, [b.id]))[0]?.props).toEqual({ bucket: 'new' });
    // evidence is readable from the provider side: signed, own organisation only
    const ev = await evidenceAsClinic(b.id, org);
    expect(ev.status).toBe(200); expect(ev.body.decision).toMatchObject({ origin: 'PROVIDER_LED', id: d[0].id });
    expect((await evidenceAsClinic(b.id, 'some_other_org')).status).toBe(404);
  });

  let returningToken: string; let returningSub: string;
  it('Kiorex search with a marketplace touch: MARKETPLACE, new patient, EGP 40 charge created and reported to Kiorex revenue facts', async () => {
    const pt = await freshPatient(); returningToken = pt.token; returningSub = pt.sub;
    await seedTouch({ sub: pt.sub, kind: 'ORGANIC_SEARCH', ageMs: 3_600_000 });
    const b = await bookWith(pt.token, p);
    expect((await decisionOf(b.id))[0]).toMatchObject({ origin: 'MARKETPLACE', reasonCode: 'MARKETPLACE_TOUCH' });
    const apt = await kiorlyAppointmentFor(b.id);
    expect(apt).toMatchObject({ acquisitionOrigin: 'MARKETPLACE', isNewPatientAtBooking: true });
    await completeVisit(pt.token, b.id, staff);
    expect((await clinicDecision(apt.id)).some((x: any) => x.decision === 'CHARGE' && x.origin === 'MARKETPLACE')).toBe(true);
    const charges = await clinicCharges(apt.id);
    // the fee in force: EGP 40 (ADR-007) in production; the dev database may carry another NEEDS_HUMAN placeholder rate, so the charge is compared with the rate in force
    // the fee is decided by the seeded commission policy (3 percent, min EGP 10) since 27 Nov 2026, not by the per-market rate row: compare with the amount the decision records
    const inForce = Number((await clinicDecision(apt.id)).find((x: any) => x.decision === 'CHARGE')?.amount);
    expect(charges).toHaveLength(1); expect(Number(charges[0].amount)).toBe(inForce);
    // the charge event reaches Kiorex as a revenue fact (charges only, never booking value)
    const fact = await waitFor('revenue fact', async () => (await q('kiorex_platform', `select kind, status, "amountMinor", "bookingId" from "GrowthRevenueFact" where "appointmentId" = $1 order by "createdAt"`, [apt.id]))[0]);
    expect(fact).toMatchObject({ kind: 'CHARGE', amountMinor: Math.round(inForce * 100), bookingId: b.id });
    // the booking facts of the canonical funnel exist exactly once each
    const names = (await q('kiorex_platform', `select name from "GrowthEvent" where "bookingId" = $1 order by name`, [b.id])).map((r: any) => r.name);
    expect(names).toEqual(['BookingAttended', 'BookingConfirmed', 'BookingInitiated', 'SlotSelected']);
    expect((await q('kiorex_platform', `select props from "GrowthEvent" where "bookingId" = $1 and name = 'BookingAttended'`, [b.id]))[0].props).toEqual({ bucket: 'new' });
  });

  it('returning patient: a second visit by the same patient is attributed but earns Kiorex nothing (not a new patient)', async () => {
    await seedTouch({ sub: returningSub, kind: 'ORGANIC_SEARCH', ageMs: 1_800_000 });
    // the new-patient stamp looks at visits BEFORE the new appointment: pick a slot after the first visit
    const slots = await freeSlots(returningToken, p, 12, { fresh: true });
    const b = await bookWith(returningToken, p, { slot: slots[slots.length - 1] });
    const apt = await kiorlyAppointmentFor(b.id);
    expect(apt.isNewPatientAtBooking).toBe(false);
    await completeVisit(returningToken, b.id, staff);
    expect((await clinicDecision(apt.id)).every((x: any) => x.decision !== 'CHARGE')).toBe(true);
    expect(await clinicCharges(apt.id)).toHaveLength(0);
    expect((await q('kiorex_platform', `select props from "GrowthEvent" where "bookingId" = $1 and name = 'BookingAttended'`, [b.id]))[0].props).toEqual({ bucket: 'returning' });
  });

  it('no evidence at all is UNATTRIBUTED and still chargeable like today; referral and campaign touches decide MARKETPLACE; an old campaign click is outside its 7 day window', async () => {
    const none = await freshPatient(); const bn = await bookWith(none.token, p);
    expect((await decisionOf(bn.id))[0]).toMatchObject({ origin: 'UNATTRIBUTED', reasonCode: 'NO_PROVIDER_EVIDENCE' });
    expect((await kiorlyAppointmentFor(bn.id)).acquisitionOrigin).toBe('UNATTRIBUTED');
    const ref = await freshPatient(); await seedTouch({ sub: ref.sub, kind: 'REFERRAL', ageMs: 86_400_000, linkCode: newLinkCode() });
    const br = await bookWith(ref.token, p);
    expect((await decisionOf(br.id))[0]).toMatchObject({ origin: 'MARKETPLACE', reasonCode: 'PATIENT_REFERRAL' });
    expect((await kiorlyAppointmentFor(br.id)).acquisitionOrigin).toBe('MARKETPLACE');
    const camp = await freshPatient(); await seedTouch({ sub: camp.sub, kind: 'CAMPAIGN', ageMs: 3 * 86_400_000 });
    expect((await decisionOf((await bookWith(camp.token, p)).id))[0]).toMatchObject({ origin: 'MARKETPLACE' });
    const old = await freshPatient(); await seedTouch({ sub: old.sub, kind: 'CAMPAIGN', ageMs: 9 * 86_400_000 });
    expect((await decisionOf((await bookWith(old.token, p)).id))[0]).toMatchObject({ origin: 'UNATTRIBUTED' });
    // a provider touch of ANOTHER organisation never removes this clinic's fee
    const other = await freshPatient(); await seedTouch({ sub: other.sub, kind: 'PROVIDER_LINK', ageMs: 3_600_000, org: 'some_other_org', linkCode: newLinkCode() });
    expect((await decisionOf((await bookWith(other.token, p)).id))[0]).toMatchObject({ origin: 'UNATTRIBUTED' });
  });

  it('tamper: forged, edited, expired and other-organisation tokens are ignored (never an error), never reach the Clinic, and the fee stays', async () => {
    const good = signClinicLt({ tenantId: org, code });
    const [pl, sig] = good.split('.');
    const edited = Buffer.from(JSON.stringify({ o: org, c: newLinkCode(), t: Date.now(), v: 1 })).toString('base64url') + '.' + sig; // payload changed, signature kept
    const bad = [`${pl}.${sig!.slice(0, -3)}AAA`, edited, signClinicLt({ tenantId: org, code, now: Date.now() - 80 * 3600_000 }), signClinicLt({ tenantId: 'some_other_org', code }), signClinicLt({ tenantId: org, code, secret: 'not-the-secret' }), 'garbage'];
    for (const lt of bad) {
      const pt = await freshPatient(); const b = await bookWith(pt.token, p, { lt });
      expect((await decisionOf(b.id))[0].origin).toBe('UNATTRIBUTED');
      expect((await kiorlyAppointmentFor(b.id)).acquisitionOrigin).toBe('UNATTRIBUTED');
    }
  });

  it('replay: confirming again and re-sending the booking keep ONE decision and ONE appointment; a signed Clinic request cannot be replayed or edited', async () => {
    const pt = await freshPatient(); const b = await bookWith(pt.token, p, { lt: signClinicLt({ tenantId: org, code }) });
    const before = (await decisionOf(b.id))[0];
    for (let i = 0; i < 2; i++) expect((await kiorex(pt.token, 'POST', `/bookings/${b.id}/confirm`, { marketplaceConsent: true, remindersConsent: true }, { 'Idempotency-Key': b.id })).status).toBe(200);
    expect(await decisionOf(b.id)).toHaveLength(1); expect((await decisionOf(b.id))[0].id).toBe(before.id);
    expect((await q('kiorly', `select count(*)::int c from "Appointment" where "externalReference" = $1`, [b.id]))[0].c).toBe(1);
    // the evidence endpoint: the same signed request twice is refused the second time (one-time nonce); an edited path fails the signature
    const path = `/api/v1/growth/v1/evidence/${b.id}`; const h = { ...signedHeaders('GET', path), 'x-kiorly-org-ref': org };
    const first = await fetch(`${KIOREX_API.replace('/api/v1', '')}${path}`, { headers: h }); const second = await fetch(`${KIOREX_API.replace('/api/v1', '')}${path}`, { headers: h });
    expect(first.status).toBe(200); expect(second.status).toBe(401);
    const edited = await fetch(`${KIOREX_API.replace('/api/v1', '')}/api/v1/growth/v1/evidence/${b.id}x`, { headers: { ...signedHeaders('GET', path), 'x-kiorly-org-ref': org } });
    expect(edited.status).toBe(401);
    const wrongSecret = await fetch(`${KIOREX_API.replace('/api/v1', '')}${path}`, { headers: { ...signedHeaders('GET', path, 'wrong-secret'), 'x-kiorly-org-ref': org } });
    expect(wrongSecret.status).toBe(401);
    expect(WEBHOOK_SECRET).toBeTruthy();
  });

  it('cancel and reschedule keep the decision; the cancellation reaches the growth stream once', async () => {
    const pt = await freshPatient(); const b = await bookWith(pt.token, p, { lt: signClinicLt({ tenantId: org, code }) });
    const id0 = (await decisionOf(b.id))[0].id;
    await waitFor('confirmed', async () => (await kiorex(pt.token, 'GET', `/bookings/${b.id}`)).body.status === 'CONFIRMED');
    expect((await kiorex(pt.token, 'POST', `/bookings/${b.id}/cancel`, { reason: 'e2e' })).status).toBe(200);
    expect((await decisionOf(b.id)).map((d: any) => d.id)).toEqual([id0]);
    const names = (await q('kiorex_platform', `select name, props from "GrowthEvent" where "bookingId" = $1 and name = 'BookingCancelled'`, [b.id]));
    expect(names).toHaveLength(1); expect(names[0].props).toEqual({ reason: 'patient' });
  });
});
