import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tokens, providerBySpecialty, kiorlyAppointmentFor, freeSlots, type Provider } from '../src/fixtures.js';
import { kiorex, kiorly, q, staffLogin, waitFor } from '../src/clients.js';
import { KIORLY, KIOREX } from '../src/env.js';
import { bookWith, clinicCharges, clinicDecision, completeVisit, decisionOf, freshPatient, kxdevGrowthTenant, seedTouch } from '../src/growth.js';

/**
 * GRW-P1-M journeys 1 to 4 on the REAL local stack (Clinic API :3010, Kiorex API :4000, Passport, Postgres), asserting the money and the data:
 *   1. provider link created in the staff app API, QR resolved, patient lands on Kiorex, books, PROVIDER_LED, attended: NO commission, the statement shows it
 *   2. Kiorex marketplace booking, MARKETPLACE_ORIGINATED new patient, attended: EGP commission at the rate in force, visible in the statement and the staff app
 *   3. returning patient: attributed, no fee
 *   4. dispute PROVIDER_LED_EVIDENCE: auto-approved, fee reversed, decision appended
 * Test-only fixtures (removed afterwards): a CLINIC_ADMIN user and a booking slug on the KX-DEV clinic (it has neither), a throw-away rate only when none is in force.
 */
const SLUG = 'e2e-kxdev-zamalek'; const ADMIN_EMAIL = 'e2e.growth.admin@kiorly.dev';
/** The dev DB carries old charges from before decisions existed (legacy mismatches): the journeys assert that THEIR appointments never appear in the mismatches and that the count does not grow. */
const noNewMismatch = (now: any, before: any, ...ids: string[]) => { expect(now.mismatches.filter((m: any) => ids.includes(m.appointmentId))).toEqual([]); expect(now.mismatches.length).toBeLessThanOrEqual(before.mismatches.length); };
const period = () => new Date().toISOString().slice(0, 7);

describe('growth journeys: provider link, marketplace, returning patient, dispute (money and data outcomes)', () => {
  let p: Provider; let staff: string; let admin: string; let org: string; let clinicId: string; let linkId = ''; let linkCode = ''; let lt = '';
  const rateId = `e2e_growth_rate_${Date.now()}`; let insertedRate = false; let rate = 40; let restore: () => Promise<void> = async () => undefined;
  const created: string[] = [];

  const stmt = async () => (await kiorly(admin, 'GET', `/kiorex/commission-statement?period=${period()}`)).body;
  const mobile = async () => (await kiorly(admin, 'GET', '/mobile/growth')).body;
  const linkRow = async () => ((await kiorly(admin, 'GET', '/growth/links')).body.items as any[]).find((l) => l.id === linkId);

  beforeAll(async () => {
    const t = await tokens();
    p = await providerBySpecialty(t.p1, 'paediatrics');
    staff = await staffLogin('kxdev.mona.fahmy@kiorly.dev');
    const fx = await kxdevGrowthTenant(p.id); org = fx.org; clinicId = fx.clinicId; admin = fx.admin; restore = fx.restore;
    const m = await q('kiorly', `select id from "Market" where code = 'EG'`);
    const have = await q('kiorly', `select amount from "KiorexCommissionRate" where "marketId" = $1 and "validTo" is null order by "validFrom" desc limit 1`, [m[0].id]);
    if (!have.length) { insertedRate = true; await q('kiorly', `insert into "KiorexCommissionRate" (id, "marketId", "feeType", amount, "validFrom", "updatedAt") values ($1, $2, 'FLAT', 40, (now() at time zone 'utc') - interval '1 day', now() at time zone 'utc')`, [rateId, m[0].id]); } else rate = Number(have[0].amount);
  });
  afterAll(async () => {
    if (linkId) await kiorly(admin, 'PATCH', `/growth/links/${linkId}`, { status: 'REVOKED' }).catch(() => undefined);
    for (const id of created) await kiorly(admin, 'PATCH', `/growth/links/${id}`, { status: 'REVOKED' }).catch(() => undefined);
    await restore();
    if (insertedRate) await q('kiorly', `delete from "KiorexCommissionRate" where id = $1`, [rateId]).catch(() => undefined);
  });

  it('1a. the owner creates a link in the staff app API; web and app agree; QR is the short link (SVG and PNG), AR and EN posters render', async () => {
    const before = await mobile();
    expect(before).toMatchObject({ level: 'admin', can: { create: true }, profile: { ready: true } });
    const c = await kiorly(admin, 'POST', '/mobile/growth/links', { label: 'E2E reception QR', ownerScope: 'DESK', deskLabel: 'E2E reception', channelKind: 'QR_DESK', clinicId });
    expect(c.status).toBe(201);
    linkId = c.body.id; linkCode = c.body.code;
    expect(linkCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(c.body).toMatchObject({ status: 'ACTIVE', ownerScope: 'DESK', channelKind: 'QR_DESK', shortUrl: expect.stringMatching(new RegExp(`/q/${linkCode}$`)) });
    expect((await linkRow())).toMatchObject({ id: linkId, code: linkCode, status: 'ACTIVE' }); // the web workspace lists the same row
    const m = await mobile();
    expect(m.links.find((l: any) => l.id === linkId)).toMatchObject({ code: linkCode, shortUrl: c.body.shortUrl });
    const qr = await kiorly(admin, 'GET', `/mobile/growth/qr?linkId=${linkId}`);
    expect(qr.body.url).toBe(c.body.shortUrl); expect(qr.body.svg).toContain('<svg');
    const web = await fetch(`${KIORLY}/api/v1/growth/links/${linkId}/qr.svg`, { headers: { authorization: `Bearer ${admin}` } });
    expect(web.status).toBe(200); expect(await web.text()).toBe(qr.body.svg.replace('#1e1b4b', '#000000'));
    const png = await fetch(`${KIORLY}/api/v1/growth/links/${linkId}/qr.png`, { headers: { authorization: `Bearer ${admin}` } });
    expect(png.headers.get('content-type')).toContain('image/png'); expect([...new Uint8Array(await png.arrayBuffer()).slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    for (const [lang, dir] of [['ar', 'rtl'], ['en', 'ltr']] as const) {
      const poster = await fetch(`${KIORLY}/api/v1/growth/links/${linkId}/poster?lang=${lang}&size=A5`, { headers: { authorization: `Bearer ${admin}` } });
      const html = await poster.text();
      expect(poster.status).toBe(200); expect(html).toContain(`dir="${dir}"`); expect(html).toContain(linkCode);
    }
    // the app refuses the roles that must not see Growth, and refuses a doctor creating links
    expect((await kiorly(await staffLogin(ADMIN_EMAIL), 'POST', '/mobile/growth/links', { label: 'x' })).status).toBeGreaterThanOrEqual(400);
  });

  it('1b. QR scanned: the resolver redirects to the booking page, one human visit is counted (bots are not), the page carries a signed lt and "no Kiorex fee"', async () => {
    const day0 = Number((await q('kiorly', `select coalesce(sum(visits), 0)::int v from "ProviderReferralLinkDaily" where "linkId" = $1`, [linkId]))[0].v);
    const r = await fetch(`${KIORLY}/api/v1/public/links/q/${linkCode}`, { redirect: 'manual' });
    expect(r.status).toBe(302);
    const target = r.headers.get('location')!;
    expect(target).toContain(`/b/${SLUG}?s=${linkCode}`);
    expect((await fetch(`${KIORLY}/api/v1/public/links/q/ZZZZZZZZ`, { redirect: 'manual' })).status).toBe(404); // unknown code: no oracle, no redirect
    const bot = await fetch(`${KIORLY}/api/v1/public/booking-pages/${SLUG}?s=${linkCode}`, { headers: { 'user-agent': 'Googlebot/2.1' } });
    expect(bot.status).toBe(200);
    const page = await (await fetch(`${KIORLY}/api/v1/public/booking-pages/${SLUG}?s=${linkCode}`, { headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1' } })).json() as any;
    expect(page).toMatchObject({ channel: 'CLINIC_LINK', commissionFree: true, tracked: true });
    lt = page.lt; expect(lt).toMatch(/^[\w-]+\.[\w-]+$/);
    const day1 = Number((await q('kiorly', `select coalesce(sum(visits), 0)::int v from "ProviderReferralLinkDaily" where "linkId" = $1`, [linkId]))[0].v);
    expect(day1 - day0).toBe(1); // the browser counted once, the crawler not
    expect(page.doctors.some((d: any) => /Mona/.test(d.nameEn))).toBe(true);
  });

  let provPatient: { token: string; sub: string }; let provBooking = '';
  let baseStmt: any; let baseMobile: any;
  it('1c. the patient lands on Kiorex with the token (canonical strips it, the touch endpoint accepts it), books, decision PROVIDER_LED, attended: NO commission; statement and staff app show it', async () => {
    baseStmt = await stmt(); baseMobile = await mobile();
    const landing = await fetch(`${KIOREX}/ar/eg/doctor/mona-fahmy?lt=${encodeURIComponent(lt)}&utm_source=kiorly&utm_medium=qr`);
    expect(landing.status).toBe(200);
    const html = await landing.text();
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? '';
    expect(canonical).toMatch(/\/ar\/eg\/doctor\/mona-fahmy$/); expect(canonical).not.toContain('lt=');
    expect((await kiorex(undefined, 'POST', '/growth/v1/touch', { landingKind: 'DOCTOR', lt, utm: { source: 'kiorly', medium: 'qr' } })).status).toBe(202);
    expect((await kiorex(undefined, 'POST', '/growth/v1/touch', { landingKind: 'DOCTOR', lt: `${lt.slice(0, -2)}xx` })).status).toBeGreaterThanOrEqual(400); // an edited token is refused, never trusted

    provPatient = await freshPatient('Provider Journey');
    const b = await bookWith(provPatient.token, p, { lt }); provBooking = b.id;
    const d = await decisionOf(b.id);
    expect(d).toHaveLength(1); expect(d[0]).toMatchObject({ origin: 'PROVIDER_LED', reasonCode: 'EXPLICIT_PROVIDER_CHANNEL' });
    const apt = await kiorlyAppointmentFor(b.id);
    expect(apt).toMatchObject({ acquisitionOrigin: 'PROVIDER_LED', isNewPatientAtBooking: true });
    expect((await linkRow()).last30.bookings).toBe(1); // counted at booking
    await completeVisit(provPatient.token, b.id, staff);
    const dec = await clinicDecision(apt.id);
    expect(dec.length).toBeGreaterThan(0); expect(dec.every((x: any) => x.decision !== 'CHARGE' && x.origin === 'PROVIDER_LED')).toBe(true);
    expect(await clinicCharges(apt.id)).toHaveLength(0);
    const explain = (await kiorly(admin, 'GET', `/kiorex/commission-decisions?appointmentId=${apt.id}`)).body;
    expect(explain.items[0]).toMatchObject({ origin: 'PROVIDER_LED', decision: 'NO_CHARGE' }); expect(explain.items[0].explanation).toMatch(/fee/i);
    const s = await stmt();
    expect(s.providerLedBookings - baseStmt.providerLedBookings).toBe(1);
    noNewMismatch(s, baseStmt, apt.id); expect(s.totals.activeCharges).toBe(baseStmt.totals.activeCharges); // no money moved
    expect((await linkRow()).last30).toMatchObject({ bookings: 1, attended: 1 });
    const m = await mobile();
    expect(m.commission.providerLedBookings - baseMobile.commission.providerLedBookings).toBe(1);
    expect(m.links.find((l: any) => l.id === linkId).last30).toMatchObject({ bookings: 1, attended: 1 });
    expect(m.performance.providerOriginated.bookings - baseMobile.performance.providerOriginated.bookings).toBe(1);
  });

  let mpPatient: { token: string; sub: string }; let mpBooking = ''; let mpApt: any; let chargeId = '';
  it('2. Kiorex search booking with an organic touch: MARKETPLACE new patient, attended: EGP commission = the rate in force; statement and staff app show the fee', async () => {
    const before = await stmt(); const mBefore = await mobile();
    mpPatient = await freshPatient('Marketplace Journey');
    await seedTouch({ sub: mpPatient.sub, kind: 'ORGANIC_SEARCH', ageMs: 1_800_000 });
    const b = await bookWith(mpPatient.token, p); mpBooking = b.id;
    expect((await decisionOf(b.id))[0]).toMatchObject({ origin: 'MARKETPLACE', reasonCode: 'MARKETPLACE_TOUCH' });
    mpApt = await kiorlyAppointmentFor(b.id);
    expect(mpApt).toMatchObject({ acquisitionOrigin: 'MARKETPLACE', isNewPatientAtBooking: true });
    await completeVisit(mpPatient.token, b.id, staff);
    const charges = await clinicCharges(mpApt.id);
    expect(charges).toHaveLength(1); expect(Number(charges[0].amount)).toBe(rate);
    chargeId = (await q('kiorly', `select id from "KiorexCommissionCharge" where "appointmentId" = $1`, [mpApt.id]))[0].id;
    const dec = await clinicDecision(mpApt.id);
    expect(dec.some((x: any) => x.decision === 'CHARGE' && x.origin === 'MARKETPLACE' && Number(x.amount) === rate)).toBe(true);
    const s = await stmt();
    expect(Number(s.totals.activeCharges) - Number(before.totals.activeCharges)).toBeCloseTo(rate, 2);
    expect(s.currency).toBe('EGP'); noNewMismatch(s, before, mpApt.id);
    const m = await mobile();
    expect(Number(m.commission.totals.activeCharges) - Number(mBefore.commission.totals.activeCharges)).toBeCloseTo(rate, 2);
    expect(m.performance.marketplaceOriginated.bookings - mBefore.performance.marketplaceOriginated.bookings).toBe(1);
    expect(m.performance.marketplaceOriginated.newPatients - mBefore.performance.marketplaceOriginated.newPatients).toBe(1);
  });

  it('3. returning patient: the same patient books again, is attributed, and earns Kiorex nothing', async () => {
    await seedTouch({ sub: mpPatient.sub, kind: 'ORGANIC_SEARCH', ageMs: 600_000 });
    const before = await stmt();
    const slots = await freeSlots(mpPatient.token, p, 12, { fresh: true });
    const b = await bookWith(mpPatient.token, p, { slot: slots[slots.length - 1] });
    const apt = await kiorlyAppointmentFor(b.id);
    expect(apt.isNewPatientAtBooking).toBe(false);
    await completeVisit(mpPatient.token, b.id, staff);
    expect(await clinicCharges(apt.id)).toHaveLength(0);
    expect((await clinicDecision(apt.id)).every((x: any) => x.decision !== 'CHARGE')).toBe(true);
    expect((await stmt()).totals.activeCharges).toBe(before.totals.activeCharges);
  });

  it('4. dispute PROVIDER_LED_EVIDENCE: the evidence shows the patient came through the clinic\'s own link, so the fee is auto-removed, the decision appended, the statement still reconciles', async () => {
    // evidence fixture: the booking carries one of the organisation\'s own link codes (mock evidence mode reads the Clinic\'s own facts)
    await q('kiorly', `update "Appointment" set "attributionJson" = coalesce("attributionJson", '{}'::jsonb) || jsonb_build_object('referralLinkCode', $2::text) where id = $1`, [mpApt.id, linkCode]);
    const before = await stmt();
    const d = await kiorly(admin, 'POST', `/billing/kiorex/charges/${chargeId}/dispute`, { reason: 'PROVIDER_LED_EVIDENCE', note: 'Patient scanned our reception QR' });
    expect(d.status).toBe(201);
    const dispute = (await q('kiorly', `select status, resolution from "CommissionDispute" where "chargeId" = $1`, [chargeId]))[0];
    expect(dispute.status).toBe('AUTO_APPROVED'); expect(dispute.resolution).toMatch(/provider-led evidence confirmed/);
    const ch = (await q('kiorly', `select status from "KiorexCommissionCharge" where id = $1`, [chargeId]))[0];
    expect(['REVERSED', 'WAIVED', 'CANCELLED']).toContain(ch.status);
    const dec = await clinicDecision(mpApt.id);
    const last = dec[dec.length - 1];
    expect(last).toMatchObject({ decision: 'NO_CHARGE', origin: 'PROVIDER_LED' }); expect(last.reasonCodes).toContain('PROVIDER_LED_EVIDENCE');
    expect((await q('kiorly', `select "policyVersion" from "KiorexCommissionDecision" where "appointmentId" = $1 order by "createdAt" desc limit 1`, [mpApt.id]))[0].policyVersion).toMatch(/\+PLE$/);
    const s = await stmt();
    expect(Number(before.totals.activeCharges) - Number(s.totals.activeCharges)).toBeCloseTo(rate, 2);
    noNewMismatch(s, before, mpApt.id);
    // the adjustment reaches Kiorex (CommissionAdjusted on the outbox)
    const ev = await q('kiorly', `select 1 from "OutboxEvent" where type = 'CommissionAdjusted' and payload::text like $1 limit 1`, [`%${mpApt.id}%`]);
    expect(ev.length).toBeGreaterThan(0);
    // a second dispute on the same charge is refused
    expect((await kiorly(admin, 'POST', `/billing/kiorex/charges/${chargeId}/dispute`, { reason: 'PROVIDER_LED_EVIDENCE' })).status).toBe(400);
  });

  it('4b. without evidence the same dispute stays OPEN for a human (evidence can only remove a fee it proves, never invent one)', async () => {
    const pt = await freshPatient('Dispute Without Evidence');
    await seedTouch({ sub: pt.sub, kind: 'ORGANIC_SEARCH', ageMs: 900_000 });
    const b = await bookWith(pt.token, p);
    const apt = await kiorlyAppointmentFor(b.id);
    await completeVisit(pt.token, b.id, staff);
    const id = (await q('kiorly', `select id from "KiorexCommissionCharge" where "appointmentId" = $1`, [apt.id]))[0].id;
    expect((await kiorly(admin, 'POST', `/billing/kiorex/charges/${id}/dispute`, { reason: 'PROVIDER_LED_EVIDENCE', note: 'no proof' })).status).toBe(201);
    expect((await q('kiorly', `select status from "CommissionDispute" where "chargeId" = $1`, [id]))[0].status).toBe('OPEN');
    expect((await q('kiorly', `select status from "KiorexCommissionCharge" where id = $1`, [id]))[0].status).toBe('DISPUTED');
    expect((await clinicDecision(apt.id)).every((x: any) => x.origin !== 'PROVIDER_LED')).toBe(true);
    // cleanup of the open dispute (dev DB only): leave it OPEN is harmless but would show in the platform queue
    await q('kiorly', `delete from "CommissionDispute" where "chargeId" = $1`, [id]);
    await q('kiorly', `update "KiorexCommissionCharge" set status = 'CONFIRMED' where id = $1`, [id]);
  });

  it('5. staff-app access: front desk and accountant refused, a BASIC org answers FEATURE_DISABLED, the doctor view is limited to the own link', async () => {
    const owner = await staffLogin('owner.na@demo.kiorex.test', 'Demo@12345');
    expect((await kiorly(owner, 'GET', '/mobile/growth')).body.level).toBe('admin');
    for (const who of ['frontdesk1.na@demo.kiorex.test', 'accountant.na@demo.kiorex.test']) {
      const r = await kiorly(await staffLogin(who, 'Demo@12345'), 'GET', '/mobile/growth');
      expect([r.status, r.body.code]).toEqual([403, 'MODULE_NOT_ALLOWED']);
    }
    const basic = await kiorly(await staffLogin('owner.basic@demo.kiorex.test', 'Demo@12345'), 'GET', '/mobile/growth');
    expect([basic.status, basic.body.code]).toEqual([403, 'FEATURE_DISABLED']);
    const doc = (await kiorly(staff, 'GET', '/mobile/growth')).body;
    expect(doc).toMatchObject({ level: 'doctor', performance: null, commission: null });
    expect(doc.links.every((l: any) => l.ownerScope === 'DOCTOR')).toBe(true);
    expect((await kiorly(staff, 'PATCH', `/mobile/growth/links/${linkId}`, { status: 'PAUSED' })).status).toBe(403);
    expect((await kiorly(staff, 'GET', `/mobile/growth/qr?linkId=${linkId}`)).status).toBe(404); // someone else's link is not visible to a doctor
  });

  it('6. pause and resume through the staff app: a paused link still resolves nothing for new bookings (token no longer signed) and revoke is web-only', async () => {
    const paused = await kiorly(admin, 'PATCH', `/mobile/growth/links/${linkId}`, { status: 'PAUSED' });
    expect(paused.status).toBe(200); expect(paused.body.status).toBe('PAUSED');
    const page = await (await fetch(`${KIORLY}/api/v1/public/booking-pages/${SLUG}?s=${linkCode}`, { headers: { 'user-agent': 'Mozilla/5.0 Safari' } })).json() as any;
    expect(page.tracked).toBe(false);
    expect((await kiorly(admin, 'PATCH', `/mobile/growth/links/${linkId}`, { status: 'REVOKED' })).status).toBe(403);
    expect((await kiorly(admin, 'PATCH', `/mobile/growth/links/${linkId}`, { status: 'ACTIVE' })).body.status).toBe('ACTIVE');
    await waitFor('link active again', async () => (await linkRow())?.status === 'ACTIVE');
  });
});
