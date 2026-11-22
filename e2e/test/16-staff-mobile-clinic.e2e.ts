import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kiorly, q } from '../src/clients.js';

/**
 * Kiorly Team (staff app) x Kiorly Clinic, REAL stack and the seeded demo data (TEST_DATA.md / kiorly-team/docs/TEST_DATA.md). Every flow is driven the way the app
 * drives it (`X-Kiorly-Client: kiorly-team/*`, the /mobile/* routes plus the existing clinic routes the app calls, see Docs/MOBILE.md section 5) and every result is
 * read back through the endpoints the CLINIC WEB APP uses (appointments, front-desk board, encounters, nurse vitals trend, /revenue/totals, /home-visits,
 * /home-visits/safety-alerts, /admin/audit-logs) so a mobile write is proven visible on the web.
 *
 * a. role matrix      every clinic demo role: bootstrap modules / plan / safetyAlertsOnly + endpoint scoping (an endpoint is never wider than the role's module)
 * b. BASIC org        entitlement off, alerts inbox still works, everything else 403 FEATURE_DISABLED, web traffic untouched
 * c. clinic day       front desk check-in -> nurse vitals (critical -> safety alert) -> doctor queue, SOAP, sign Rx -> critical lab approval -> revenue = web totals
 * d. home visits      solo nurse Mona + agency nurse: book (dispatch), depart/arrive, SOS visible, unsafe abort, nursing note -> visit finished
 * e. offline replay   same Idempotency-Key twice = one effect (vitals, ack, approve, sign, check-in, device register, home-visit transitions)
 * f. devices          register, org-admin listing, remote sign-out kills the session
 *
 * Needs `npm run db:seed:demo` + `db:seed:mobile` (the suite re-runs the idempotent mobile seed if the demo critical lab order is missing). Never runs seed --reset.
 * Dev-only fictional data; passwords are the documented demo ones.
 */
const PW = 'Demo@12345';
const APP = { 'x-kiorly-client': 'kiorly-team/1.0-e2e' };
const app = (t: string | undefined, m: string, p: string, b?: unknown, h: Record<string, string> = {}) => kiorly(t, m, p, b, { ...APP, ...h });
const web = (t: string, m: string, p: string, b?: unknown, h: Record<string, string> = {}) => kiorly(t, m, p, b, h);

interface Session { token: string; refresh: string; sessionId: string; email: string }
const sessions = new Map<string, Session>();
async function signIn(email: string, fresh = false): Promise<Session> {
  if (!fresh && sessions.has(email)) return sessions.get(email)!;
  const r = await kiorly(undefined, 'POST', '/auth/login', { email, password: PW });
  expect(r.status, `login ${email}: ${JSON.stringify(r.body)}`).toBe(200);
  const s = { token: r.body.accessToken as string, refresh: r.body.refreshToken as string, sessionId: r.body.sessionId as string, email };
  if (!fresh) sessions.set(email, s);
  return s;
}
const tok = async (email: string) => (await signIn(email)).token;
const NA = (u: string) => `${u}.na@demo.kiorex.test`;
const bootstrap = async (email: string) => { const r = await app(await tok(email), 'GET', '/mobile/bootstrap'); expect(r.status, email).toBe(200); return r.body; };
const mods = (b: any) => (b.modules as { key: string; enabled: boolean }[]).filter((m) => m.enabled).map((m) => m.key.replace('clinic.', '')).sort();
const sorted = (s: string) => s.split(',').sort();
const dayOf = (iso: string) => iso.slice(0, 10);
/** YYYY-MM-DD +- n days (pure calendar arithmetic, no timezone involved). */
const addDays = (ymd: string, n: number) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const resetReason = 'e2e16 reset';

// ============================================================================================================================================================
describe('a. Role matrix: bootstrap modules, plan, safetyAlertsOnly and endpoint scoping for every clinic demo role', () => {
  // role -> exact module set (MOBILE.md "Modules per role")
  const matrix: { who: string; email: string; role: string; plan: string; raw: string; edition: string; modules: string }[] = [
    { who: 'owner (Nile Care)', email: NA('owner'), role: 'GROUP_ADMIN', plan: 'PRO', raw: 'PRO', edition: 'CLINIC', modules: 'schedule,patients,visits,prescriptions,labs,vitals,revenue' },
    { who: 'manager', email: NA('manager'), role: 'BRANCH_MANAGER', plan: 'PRO', raw: 'PRO', edition: 'CLINIC', modules: 'schedule,patients,vitals,revenue' },
    { who: 'front desk 1', email: NA('frontdesk1'), role: 'RECEPTIONIST', plan: 'PRO', raw: 'PRO', edition: 'CLINIC', modules: 'schedule,patients' },
    { who: 'front desk 2', email: NA('frontdesk2'), role: 'RECEPTIONIST', plan: 'PRO', raw: 'PRO', edition: 'CLINIC', modules: 'schedule,patients' },
    { who: 'nurse', email: NA('nurse'), role: 'NURSE', plan: 'PRO', raw: 'PRO', edition: 'CLINIC', modules: 'schedule,patients,vitals,homevisits' },
    { who: 'doctor Nadia', email: NA('nadia'), role: 'PHYSICIAN', plan: 'PRO', raw: 'PRO', edition: 'CLINIC', modules: 'schedule,patients,visits,prescriptions,labs,vitals' },
    { who: 'doctor Tamer', email: NA('tamer'), role: 'PHYSICIAN', plan: 'PRO', raw: 'PRO', edition: 'CLINIC', modules: 'schedule,patients,visits,prescriptions,labs,vitals' },
    { who: 'accountant', email: NA('accountant'), role: 'FINANCE_OFFICER', plan: 'PRO', raw: 'PRO', edition: 'CLINIC', modules: 'schedule,revenue' },
    { who: 'call centre', email: NA('callcenter'), role: 'CALL_CENTER', plan: 'PRO', raw: 'PRO', edition: 'CLINIC', modules: 'schedule,patients' },
    // Nurse edition: nurses carry role PHYSICIAN + profession NURSE and never get visit notes / prescription signing (ADR-029)
    { who: 'solo nurse Mona', email: 'mona@nurse-demo.kiorly.test', role: 'PHYSICIAN', plan: 'PRO', raw: 'NURSE_PRO', edition: 'NURSE', modules: 'schedule,patients,vitals,homevisits,revenue' },
    { who: 'agency owner', email: 'owner@nurse-demo.kiorly.test', role: 'CLINIC_ADMIN', plan: 'ENTERPRISE', raw: 'NURSE_AGENCY', edition: 'NURSE', modules: 'schedule,patients,visits,prescriptions,labs,vitals,homevisits,revenue' },
    { who: 'agency dispatcher', email: 'dispatch@nurse-demo.kiorly.test', role: 'RECEPTIONIST', plan: 'ENTERPRISE', raw: 'NURSE_AGENCY', edition: 'NURSE', modules: 'schedule,patients,homevisits' },
    { who: 'agency nurse 1', email: 'nurse1@nurse-demo.kiorly.test', role: 'PHYSICIAN', plan: 'ENTERPRISE', raw: 'NURSE_AGENCY', edition: 'NURSE', modules: 'schedule,patients,vitals,homevisits' },
    { who: 'agency nurse 2', email: 'nurse2@nurse-demo.kiorly.test', role: 'PHYSICIAN', plan: 'ENTERPRISE', raw: 'NURSE_AGENCY', edition: 'NURSE', modules: 'schedule,patients,vitals,homevisits' },
  ];
  for (const r of matrix) {
    it(`${r.who} (${r.email}): ${r.role}, plan ${r.plan}, modules ${r.modules}`, async () => {
      const b = await bootstrap(r.email);
      expect([b.user.role, b.org.plan, b.org.rawPlan, b.org.edition]).toEqual([r.role, r.plan, r.raw, r.edition]);
      expect(b.entitlement).toMatchObject({ key: 'mobile_staff_app', enabled: true, reason: null });
      expect(b.safetyAlertsOnly).toBe(false);
      expect(mods(b)).toEqual(sorted(r.modules));
      // modules[] carries the screens of an enabled module and nothing for a disabled one
      for (const m of b.modules) expect(m.enabled ? m.screens.length > 0 : m.screens.length === 0, m.key).toBe(true);
    });
  }
  it('semantic role invariants: only doctors + owners get visits/prescriptions; revenue only owner/manager/finance; no nurse-profession account can sign or see the lab-results review queue (sample collection stays under home visits)', async () => {
    const all = await Promise.all(matrix.map(async (r) => ({ r, m: mods(await bootstrap(r.email)) })));
    for (const { r, m } of all) {
      if (m.includes('prescriptions') || m.includes('visits')) expect(['owner (Nile Care)', 'doctor Nadia', 'doctor Tamer', 'agency owner'], r.who).toContain(r.who);
      if (m.includes('revenue')) expect(['GROUP_ADMIN', 'CLINIC_ADMIN', 'BRANCH_MANAGER', 'FINANCE_OFFICER'], r.who).toContain(r.role === 'PHYSICIAN' ? 'GROUP_ADMIN' /* Mona is the org owner */ : r.role);
      if (r.who.includes('nurse')) { expect(m, r.who).not.toContain('prescriptions'); expect(m, r.who).not.toContain('visits'); expect(m, r.who).not.toContain('labs'); expect(m, r.who).toContain('homevisits'); }
    }
  });

  // endpoint -> module (an endpoint must never be wider than the module the role gets in bootstrap)
  const probes: { name: string; mod: string; call: (t: string) => Promise<{ status: number; body: any }> }[] = [
    { name: 'GET /mobile/schedule', mod: 'schedule', call: (t) => app(t, 'GET', '/mobile/schedule') },
    { name: 'GET /mobile/search', mod: 'patients', call: (t) => app(t, 'GET', '/mobile/search?q=da') },
    { name: 'GET /mobile/prescriptions', mod: 'prescriptions', call: (t) => app(t, 'GET', '/mobile/prescriptions') },
    { name: 'GET /mobile/lab-results', mod: 'labs', call: (t) => app(t, 'GET', '/mobile/lab-results') },
    { name: 'GET /mobile/revenue/snapshot', mod: 'revenue', call: (t) => app(t, 'GET', '/mobile/revenue/snapshot') },
    { name: 'POST /mobile/vitals', mod: 'vitals', call: (t) => app(t, 'POST', '/mobile/vitals', { patientId: 'e2e16-no-such-patient', pulse: 70 }) },
  ];
  for (const r of matrix.filter((m) => m.edition === 'CLINIC')) {
    it(`endpoint scoping for ${r.who}: allowed exactly where the module is on`, async () => {
      const t = await tok(r.email); const on = sorted(r.modules);
      for (const p of probes) {
        const res = await p.call(t);
        if (on.includes(p.mod)) expect([403], `${r.who} ${p.name} must be allowed`).not.toContain(res.status);
        else expect(res.status, `${r.who} ${p.name} must be refused (${JSON.stringify(res.body)})`).toBe(403);
      }
      // read-only basics every staff role has
      for (const path of ['/mobile/summary', '/mobile/inbox', '/mobile/alerts']) expect((await app(t, 'GET', path)).status, path).toBe(200);
    });
  }
  it('a nurse and a front desk cannot sign prescriptions or approve results (403), even by id', async () => {
    for (const who of [NA('nurse'), NA('frontdesk1'), NA('accountant')]) {
      const t = await tok(who);
      expect((await app(t, 'POST', '/mobile/prescriptions/any-id/sign')).status, who).toBe(403);
      expect((await app(t, 'POST', '/mobile/lab-results/any-id/approve', {})).status, who).toBe(403);
    }
  });
});

// ============================================================================================================================================================
describe('b. BASIC org (Corner Family Clinic): upgrade screen, safety alerts still work', () => {
  const basic = ['owner.basic', 'doctor.basic', 'nurse.basic'].map((u) => `${u}@demo.kiorex.test`);
  const resetBasicAlert = () => Promise.all([
    q('kiorly', `delete from "MobileAlertAck" where "tenantId" = 'demo_t_bs'`),
    q('kiorly', `update "VitalsObservation" set "escalatedAt" = null where id = 'demo_vit_bs_crit'`),
  ]);
  beforeAll(resetBasicAlert);
  afterAll(resetBasicAlert); // leave the demo alert open for the app demo

  for (const email of basic) {
    it(`${email}: entitlement off (PLAN_BELOW_PRO), no modules, safetyAlertsOnly`, async () => {
      const b = await bootstrap(email);
      expect(b.org).toMatchObject({ plan: 'BASIC', rawPlan: 'LITE' });
      expect(b.entitlement).toMatchObject({ key: 'mobile_staff_app', enabled: false, reason: 'PLAN_BELOW_PRO', requiredPlan: 'PRO' });
      expect(b.safetyAlertsOnly).toBe(true);
      expect(b.modules).toEqual([]);
    });
    it(`${email}: every /mobile route except bootstrap/alerts is 403 FEATURE_DISABLED; app-flagged web routes too; plain web traffic is untouched`, async () => {
      const t = await tok(email);
      for (const [m, p] of [['GET', '/mobile/summary'], ['GET', '/mobile/schedule'], ['GET', '/mobile/search?q=ab'], ['GET', '/mobile/inbox'], ['GET', '/mobile/prescriptions'], ['GET', '/mobile/lab-results'], ['GET', '/mobile/revenue/snapshot'], ['POST', '/mobile/vitals'], ['POST', '/mobile/devices']] as const) {
        const r = await app(t, m, p, m === 'POST' ? {} : undefined);
        expect(r.status, `${m} ${p}`).toBe(403);
        expect(r.body, `${m} ${p}`).toMatchObject({ code: 'FEATURE_DISABLED', key: 'mobile_staff_app', scope: 'org', reason: 'PLAN_BELOW_PRO' });
        expect(r.body.messageAr).toBeTruthy();
      }
      expect((await app(t, 'GET', '/patients?pageSize=1')).status, 'app-flagged request to a web route').toBe(403);
      expect((await web(t, 'GET', '/patients?pageSize=1')).status, 'same call without the app header (web) is untouched').toBe(200);
      // the plan gate runs before every controller guard (role / scope / entitlement): app-flagged routes behind those guards answer FEATURE_DISABLED too
      for (const p of ['/revenue/totals', '/exports/offboarding', '/hr/employees', '/operations/summary', '/expenses', '/clinical/form-templates', '/home-visits/route']) {
        const r = await app(t, 'GET', p);
        expect([r.status, r.body.code], `${email} ${p}`).toEqual([403, 'FEATURE_DISABLED']);
      }
    });
  }
  it('the safety-alert inbox works on BASIC: list, acknowledge (idempotent, first wins), and a second role sees it acknowledged', async () => {
    const owner = await tok('owner.basic@demo.kiorex.test'), nurse = await tok('nurse.basic@demo.kiorex.test');
    const l = await app(owner, 'GET', '/mobile/alerts');
    expect(l.status).toBe(200);
    const a = l.body.items.find((x: any) => x.kind === 'CRITICAL_VITALS');
    expect(a, 'seeded BASIC critical-vitals alert (db:seed:mobile)').toBeTruthy();
    expect(a.title && a.titleAr && a.body && a.bodyAr).toBeTruthy();
    const ack = await app(owner, 'POST', `/mobile/alerts/${a.id}/ack`, { note: 'e2e16 seen' });
    expect([ack.status, ack.body.alreadyAcknowledged, ack.body.ackedBy]).toEqual([200, false, expect.any(String)]);
    const again = await app(nurse, 'POST', `/mobile/alerts/${a.id}/ack`, {});
    expect([again.status, again.body.alreadyAcknowledged, again.body.ackedBy]).toEqual([200, true, ack.body.ackedBy]);
    expect((await app(owner, 'GET', '/mobile/alerts')).body.items.find((x: any) => x.id === a.id)).toBeUndefined();
    const all = (await app(owner, 'GET', '/mobile/alerts?status=all')).body.items.find((x: any) => x.id === a.id);
    expect(all).toMatchObject({ ackNote: 'e2e16 seen' });
    // same fact on the web side: the vitals reading is escalated (the web nurse vitals trend shows the critical reading)
    const row = (await q('kiorly', `select "escalatedAt" from "VitalsObservation" where id = 'demo_vit_bs_crit'`))[0];
    expect(row.escalatedAt, 'critical vitals marked escalated by the ack').toBeTruthy();
  });
  it('remote sign-out is exempt from the entitlement (a BASIC org can still revoke a device row)', async () => {
    const t = await tok('owner.basic@demo.kiorex.test');
    const r = await app(t, 'DELETE', '/mobile/devices/e2e16-none');
    expect(r.status, 'reaches the controller (404 DEVICE_NOT_FOUND), not the entitlement gate').toBe(404);
  });
});

// ============================================================================================================================================================
describe('c. Clinic day (Nile Care, PRO): front desk -> nurse -> doctor -> lab approval -> revenue', () => {
  const CLINIC = 'demo_c_na_maadi'; const NADIA = 'demo_u_na_nadia';
  const ctx: Record<string, any> = {};
  const startsAt = new Date(Date.now() + (5 + Math.floor(Math.random() * 3000)) * 60_000).toISOString(); // random slot: re-runs never collide on the doctor's agenda
  const date = dayOf(startsAt);

  beforeAll(async () => {
    // the critical lab order is part of the mobile demo seed; re-open it (and its alert) so the approve flow is repeatable
    if (!(await q('kiorly', `select 1 from "ClinicalOrder" where id = 'demo_co_mobile_crit'`)).length) {
      const { execSync } = await import('node:child_process');
      execSync('npm run db:seed:mobile', { cwd: new URL('../../clinics-management/apps/api', import.meta.url).pathname, env: { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5433/kiorly?schema=public' }, stdio: 'pipe' });
    }
    await q('kiorly', `delete from "MobileResultReview" where "tenantId" = 'demo_t_na' and "orderId" in ('demo_co_mobile_crit','demo_co_mobile_norm')`);
    await q('kiorly', `delete from "MobileAlertAck" where "tenantId" = 'demo_t_na'`);
    // a non-sample patient (sample/demo patients never post revenue): find or create the fictional E2E patient
    const fd = await tok(NA('frontdesk1'));
    const found = await web(fd, 'GET', '/patients?search=E2ESTAFF&pageSize=5');
    ctx.patient = found.body.items?.find((p: any) => p.lastNameEn === 'E2ESTAFF');
    if (!ctx.patient) {
      const c = await web(fd, 'POST', '/patients', { firstNameEn: 'Salma', lastNameEn: 'E2ESTAFF', firstNameAr: 'سلمى', lastNameAr: 'اختبار', dob: '1991-03-04', gender: 'F', phone: `+201007${String(Date.now()).slice(-6)}`, acquisitionChannel: 'DOCTOR_REFERRAL', acquisitionReferralName: 'Dr E2E Referrer' });
      expect(c.status, JSON.stringify(c.body)).toBe(201);
      ctx.patient = c.body;
    }
  });

  it('revenue baseline: accountant, manager and owner each get a snapshot that equals the web ledger totals (/revenue/totals) for today, 7 and 30 days', async () => {
    for (const who of [NA('accountant'), NA('manager'), NA('owner')]) {
      const t = await tok(who);
      const s = await app(t, 'GET', '/mobile/revenue/snapshot'); expect(s.status, who).toBe(200);
      const today = s.body.today.date as string, d7 = s.body.daily[0].date as string;
      expect(s.body.daily).toHaveLength(7);
      expect(s.body.daily[6].date).toBe(today);
      expect(d7).toBe(addDays(today, -6));
      const w = async (from: string, to: string) => (await web(t, 'GET', `/revenue/totals?from=${from}&to=${to}`)).body;
      const [wt, w7, w30] = await Promise.all([w(today, today), w(d7, today), w(addDays(today, -29), today)]);
      expect([s.body.today.net, s.body.today.gross], `${who} today`).toEqual([wt.netTotal, wt.grossTotal]);
      expect(s.body.last7.net).toBeCloseTo(w7.netTotal, 2); expect(s.body.last7.gross).toBeCloseTo(w7.grossTotal, 2);
      expect(s.body.last30.net).toBeCloseTo(w30.netTotal, 2); expect(s.body.last30.gross).toBeCloseTo(w30.grossTotal, 2);
      expect(s.body.currency).toBe('EGP');
      if (who !== NA('manager')) expect(s.body.last30.net, 'seeded demo history is visible (a branch manager is scoped to assigned clinics)').toBeGreaterThan(0);
      ctx[`rev0:${who}`] = s.body;
    }
  });

  it('front desk books and checks in the appointment (ticket + queue), visible on the web board and appointment', async () => {
    const fd = await tok(NA('frontdesk1'));
    const b = await web(fd, 'POST', '/appointments', { clinicId: CLINIC, patientId: ctx.patient.id, clinicianId: NADIA, startsAt, feeAmount: 25, notes: 'e2e16 staff flow' });
    expect(b.status, JSON.stringify(b.body)).toBe(201);
    ctx.appt = b.body.id;
    // the staff app schedule of the front desk and of the doctor shows it (SCHEDULED/CONFIRMED)
    const before = (await app(fd, 'GET', `/mobile/schedule?date=${date}`)).body;
    expect(before.items.find((i: any) => i.id === ctx.appt)).toMatchObject({ status: expect.stringMatching(/SCHEDULED|CONFIRMED/), patient: { id: ctx.patient.id }, clinician: { id: NADIA } });
    const ci = await app(fd, 'POST', `/front-desk/appointments/${ctx.appt}/check-in`, { paymentAmount: 25 });
    expect(ci.status, JSON.stringify(ci.body)).toBe(201);
    expect(ci.body).toMatchObject({ appointmentId: ctx.appt, status: 'CHECKED_IN', paymentRecorded: 25 });
    expect(ci.body.queueTicketNumber).toBeGreaterThan(0);
    ctx.ticket = ci.body.queueTicketNumber; ctx.enc = ci.body.openEncounterId;
    expect(ctx.enc).toBeTruthy();
    // --- same data on the web
    const wa = await web(fd, 'GET', `/appointments/${ctx.appt}`);
    expect(wa.body).toMatchObject({ status: 'CHECKED_IN', queueTicketNumber: ctx.ticket, patientId: ctx.patient.id });
    const board = await web(fd, 'GET', `/front-desk/board?clinicId=${CLINIC}`);
    expect([...board.body.waiting, ...board.body.inExam].find((x: any) => x.appointmentId === ctx.appt), 'front-desk board (web)').toMatchObject({ ticketNumber: ctx.ticket, patientName: expect.stringContaining('E2ESTAFF') });
    // --- and in the app for front desk (queue) and for the doctor
    const q1 = (await app(fd, 'GET', `/mobile/schedule?date=${date}`)).body;
    expect(q1.queue.find((i: any) => i.id === ctx.appt)).toMatchObject({ queueTicketNumber: ctx.ticket, status: 'CHECKED_IN' });
    expect(q1.counts.waiting).toBeGreaterThanOrEqual(1);
  });

  it('nurse records normal vitals, then a CRITICAL reading: flags + escalation guidance, safety alert for nurse/manager/owner, push to managers, visible on the web trend', async () => {
    const nurse = await tok(NA('nurse'));
    const ok = await app(nurse, 'POST', '/mobile/vitals', { patientId: ctx.patient.id, appointmentId: ctx.appt, systolic: 124, diastolic: 80, pulse: 74, spo2: 98, temperatureC: 36.8 });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body).toMatchObject({ critical: false, escalation: null });
    const crit = await app(nurse, 'POST', '/mobile/vitals', { patientId: ctx.patient.id, appointmentId: ctx.appt, systolic: 232, diastolic: 128, pulse: 148, spo2: 81 });
    expect(crit.status, JSON.stringify(crit.body)).toBe(201);
    expect(crit.body).toMatchObject({ critical: true, escalation: { required: true } });
    expect(crit.body.flags).toMatchObject({ spo2: 'CRITICAL_LOW', systolic: 'CRITICAL_HIGH' });
    expect(crit.body.escalation.guidanceAr).toBeTruthy();
    ctx.critVitals = crit.body.id;
    const alertId = `vit_${crit.body.id}`;
    for (const who of [NA('nurse'), NA('manager'), NA('owner')]) {
      const a = (await app(await tok(who), 'GET', '/mobile/alerts')).body.items.find((x: any) => x.id === alertId);
      expect(a, `${who} sees the critical-vitals alert`).toMatchObject({ kind: 'CRITICAL_VITALS', severity: 'CRITICAL', subject: { type: 'PATIENT', id: ctx.patient.id } });
    }
    // a role without alert access (front desk) neither sees it nor can ack it
    const fdAlerts = await app(await tok(NA('frontdesk1')), 'GET', '/mobile/alerts');
    expect((fdAlerts.body.items ?? []).find((x: any) => x.id === alertId)).toBeUndefined();
    // push (mock) to managers carries the alert key and no clinical value
    const inbox = (await app(await tok(NA('manager')), 'GET', '/mobile/inbox?limit=20')).body.items.find((x: any) => x.data?.vitalsId === crit.body.id);
    expect(inbox, 'manager inbox CRITICAL_VITALS push').toMatchObject({ kind: 'SAFETY' });
    expect(JSON.stringify(inbox)).not.toMatch(/232|148/);
    // --- web: the nurse vitals trend (the web vitals panel) has both readings with the critical flag
    const trend = (await web(await tok(NA('manager')), 'GET', `/nurse/patients/${ctx.patient.id}/vitals/trend`)).body.items;
    expect(trend.find((x: any) => x.id === ok.body.id)).toMatchObject({ systolic: 124, spo2: 98, critical: false });
    expect(trend.find((x: any) => x.id === crit.body.id)).toMatchObject({ systolic: 232, spo2: 81, critical: true });
    // acknowledge: first acknowledger (manager) wins; the nurse's later ack reports alreadyAcknowledged; it leaves the open list for everybody
    const ack = await app(await tok(NA('manager')), 'POST', `/mobile/alerts/${alertId}/ack`, { note: 'called doctor' });
    expect(ack.body).toMatchObject({ id: alertId, alreadyAcknowledged: false });
    expect((await app(nurse, 'POST', `/mobile/alerts/${alertId}/ack`, {})).body).toMatchObject({ alreadyAcknowledged: true, ackedBy: ack.body.ackedBy });
    expect((await app(await tok(NA('owner')), 'GET', '/mobile/alerts')).body.items.find((x: any) => x.id === alertId)).toBeUndefined();
    expect((await app(nurse, 'GET', '/mobile/alerts?status=all')).body.items.find((x: any) => x.id === alertId)).toMatchObject({ ackNote: 'called doctor' });
    // --- web: the audit log has the critical recording
    const audit = (await web(await tok(NA('owner')), 'GET', '/admin/audit-logs?pageSize=50&action=vitals.critical_recorded')).body.items;
    expect(audit.find((x: any) => x.resourceId === crit.body.id), 'web audit log').toBeTruthy();
  });

  it('doctor: queue shows the patient, opens the visit, writes SOAP, adds a prescription, signs it; the web encounter + appointment agree', async () => {
    const doc = await tok(NA('nadia'));
    const sched = (await app(doc, 'GET', `/mobile/schedule?date=${date}`)).body;
    expect(sched.queue.map((i: any) => i.id)).toContain(ctx.appt);
    expect(sched.items.every((i: any) => i.clinician.id === NADIA), 'a physician sees only own appointments').toBe(true);
    const sum = (await app(doc, 'GET', '/mobile/summary')).body;
    expect(sum.today.total).toBeGreaterThanOrEqual(1);
    // open the visit (start-visit returns the draft encounter check-in already opened)
    const sv = await app(doc, 'POST', `/front-desk/appointments/${ctx.appt}/start-visit`);
    expect(sv.status, JSON.stringify(sv.body)).toBe(201);
    expect(sv.body).toMatchObject({ encounterId: ctx.enc, alreadyOpen: true });
    const soap = { chiefComplaint: 'e2e16 cough 3 days', subjective: 'S: dry cough, no fever', objective: 'O: chest clear, SpO2 98%', assessment: 'A: allergic rhinitis', plan: 'P: antihistamine, review in 1 week' };
    const patch = await app(doc, 'PATCH', `/encounters/${ctx.enc}`, soap);
    expect(patch.status, JSON.stringify(patch.body)).toBe(200);
    const med = await app(doc, 'POST', `/encounters/${ctx.enc}/medications`, { drugName: 'Cetirizine 10 mg', dosage: '1 tablet daily', route: 'ORAL' });
    expect(med.status, JSON.stringify(med.body)).toBe(201);
    // pending prescription list
    const pend = (await app(doc, 'GET', '/mobile/prescriptions?status=pending')).body.items.find((x: any) => x.encounterId === ctx.enc);
    expect(pend).toMatchObject({ status: 'DRAFT', patient: { id: ctx.patient.id }, medications: [expect.objectContaining({ drugName: 'Cetirizine 10 mg' })] });
    // roles that must not sign
    expect((await app(await tok(NA('nurse')), 'POST', `/mobile/prescriptions/${ctx.enc}/sign`)).status).toBe(403);
    expect((await app(await tok(NA('tamer')), 'POST', `/mobile/prescriptions/${ctx.enc}/sign`)).status, 'another physician cannot sign it (assigned clinician only)').toBe(403);
    const sign = await app(doc, 'POST', `/mobile/prescriptions/${ctx.enc}/sign`);
    expect(sign.status, JSON.stringify(sign.body)).toBe(200);
    expect(sign.body).toMatchObject({ encounterId: ctx.enc, status: 'FINALIZED' });
    // --- same data on the web (the encounter the web visit screen opens)
    const enc = (await web(doc, 'GET', `/encounters/${ctx.enc}`)).body;
    expect(enc).toMatchObject({ status: 'FINALIZED', ...soap, patientId: ctx.patient.id, clinicianId: NADIA });
    expect(enc.finalizedAt).toBeTruthy();
    expect((await web(await tok(NA('frontdesk1')), 'GET', `/appointments/${ctx.appt}`)).body.status, 'appointment completed on the web').toBe('COMPLETED');
    const signed = (await app(doc, 'GET', '/mobile/prescriptions?status=signed')).body.items.find((x: any) => x.encounterId === ctx.enc);
    expect(signed).toMatchObject({ status: 'FINALIZED', signedAt: expect.any(String) });
    expect((await app(doc, 'GET', '/mobile/prescriptions?status=pending')).body.items.find((x: any) => x.encounterId === ctx.enc)).toBeUndefined();
    const sched2 = (await app(doc, 'GET', `/mobile/schedule?date=${date}`)).body;
    expect(sched2.items.find((i: any) => i.id === ctx.appt).status).toBe('COMPLETED');
    expect(sched2.queue.map((i: any) => i.id)).not.toContain(ctx.appt);
    // second sign = no second effect
    const again = await app(doc, 'POST', `/mobile/prescriptions/${ctx.enc}/sign`);
    expect([again.status, again.body.code]).toEqual([409, 'ALREADY_SIGNED']);
    // patient timeline on the web lists the visit
    const tl = (await web(doc, 'GET', `/patients/${ctx.patient.id}/timeline`)).body.items;
    expect(tl.find((x: any) => x.encounterId === ctx.enc)).toMatchObject({ type: 'VISIT', status: 'FINALIZED' });
  });

  it('critical lab result: doctor sees it flagged, a critical-result alert exists, approval is recorded once, nurse/front desk cannot approve, web audit shows it', async () => {
    const doc = await tok(NA('nadia')), nurse = await tok(NA('nurse'));
    const pend = (await app(doc, 'GET', '/mobile/lab-results?status=pending')).body.items.find((x: any) => x.orderId === 'demo_co_mobile_crit');
    expect(pend, 'seeded critical potassium result').toMatchObject({ critical: true, review: null });
    expect(pend.items.some((i: any) => String(i.flag).startsWith('CRITICAL'))).toBe(true);
    // the nurse has no Lab results queue at all (a physician concern): the endpoint is refused, not just hidden
    expect((await app(nurse, 'GET', '/mobile/lab-results?status=pending')).status).toBe(403);
    expect((await app(nurse, 'POST', '/mobile/lab-results/demo_co_mobile_crit/approve', {})).status).toBe(403);
    expect((await app(await tok(NA('frontdesk1')), 'POST', '/mobile/lab-results/demo_co_mobile_crit/approve', {})).status).toBe(403);
    // the critical-lab alert is visible to the doctor and the owner; acknowledging it is separate from approving
    const alert = (await app(await tok(NA('owner')), 'GET', '/mobile/alerts')).body.items.find((x: any) => x.kind === 'CRITICAL_LAB_RESULT' && x.subject?.id === 'demo_co_mobile_crit');
    expect(alert, 'owner sees CRITICAL_LAB_RESULT').toBeTruthy();
    expect((await app(doc, 'GET', '/mobile/alerts')).body.items.some((x: any) => x.id === alert.id)).toBe(true);
    const sumBefore = (await app(doc, 'GET', '/mobile/summary')).body.pendingLabReviews;
    const ap = await app(doc, 'POST', '/mobile/lab-results/demo_co_mobile_crit/approve', { note: 'e2e16: repeat K+, treat' });
    expect([ap.status, ap.body.alreadyApproved]).toEqual([200, false]);
    const ap2 = await app(doc, 'POST', '/mobile/lab-results/demo_co_mobile_crit/approve', { note: 'second tap' });
    expect([ap2.status, ap2.body.alreadyApproved, ap2.body.reviewedAt]).toEqual([200, true, ap.body.reviewedAt]);
    expect((await app(doc, 'GET', '/mobile/lab-results?status=pending')).body.items.map((x: any) => x.orderId)).not.toContain('demo_co_mobile_crit');
    const rev = (await app(doc, 'GET', '/mobile/lab-results?status=reviewed')).body.items.find((x: any) => x.orderId === 'demo_co_mobile_crit');
    expect(rev.review).toMatchObject({ note: 'e2e16: repeat K+, treat', reviewedBy: expect.any(String) });
    expect((await app(doc, 'GET', '/mobile/summary')).body.pendingLabReviews).toBe(sumBefore - 1);
    expect(await q('kiorly', `select count(*)::int as n from "MobileResultReview" where "orderId" = 'demo_co_mobile_crit'`)).toEqual([{ n: 1 }]);
    // web: audit log of the organisation records the approval exactly once
    const audit = (await web(await tok(NA('owner')), 'GET', '/admin/audit-logs?pageSize=50&action=mobile.lab_result_approved')).body.items.filter((x: any) => x.resourceId === 'demo_co_mobile_crit');
    expect(audit.length).toBeGreaterThanOrEqual(1);
    const ack = await app(doc, 'POST', `/mobile/alerts/${alert.id}/ack`, {});
    expect(ack.status).toBe(200);
  });

  it('revenue after the visit: the 25 EGP visit is in today\'s snapshot of accountant and owner; manager/accountant/owner each equal their web totals', async () => {
    for (const who of [NA('accountant'), NA('manager'), NA('owner')]) {
      const t = await tok(who);
      const s = (await app(t, 'GET', '/mobile/revenue/snapshot')).body; const base = ctx[`rev0:${who}`];
      // a branch manager is scoped to the clinics assigned to them (not Maadi): its figure must still equal its own web totals, below
      if (who !== NA('manager')) expect(s.today.gross - base.today.gross, `${who} today gross delta`).toBeGreaterThanOrEqual(25 - 0.01);
      expect(Number.isInteger(s.completedVisitsToday)).toBe(true);
      const wt = (await web(t, 'GET', `/revenue/totals?from=${s.today.date}&to=${s.today.date}`)).body;
      expect([s.today.net, s.today.gross]).toEqual([wt.netTotal, wt.grossTotal]);
      const w7 = (await web(t, 'GET', `/revenue/totals?from=${addDays(s.today.date, -6)}&to=${s.today.date}`)).body;
      expect(s.last7.net).toBeCloseTo(w7.netTotal, 2);
    }
    // roles without revenue are refused
    for (const who of [NA('nurse'), NA('nadia'), NA('frontdesk1')]) expect((await app(await tok(who), 'GET', '/mobile/revenue/snapshot')).status, who).toBe(403);
  });
});

// ============================================================================================================================================================
describe('d. Home-visit rounds: solo nurse Mona and an agency nurse (start, en route, arrive, SOS, unsafe abort, nursing note -> finished)', () => {
  const GEO = { lat: 30.09, lng: 31.32 };
  const book = async (who: string, body: Record<string, unknown>) => {
    const t = await tok(who);
    for (let i = 0; i < 25; i++) {
      const d = new Date(Date.now() + (2 + Math.floor(Math.random() * 26)) * 86_400_000); d.setUTCHours(6 + Math.floor(Math.random() * 8), 0, 0, 0);
      const r = await web(t, 'POST', '/home-visits/bookings', { ...body, startsAt: d.toISOString(), addressConfirmed: true });
      if (r.status === 201) return r.body;
      // slot taken, or too close to another visit of the same nurse (the shared demo DB accumulates visits across runs): try another slot
      expect([[409, 'SLOT_TAKEN'], [422, 'HOME_VISIT_TRAVEL_INFEASIBLE']], JSON.stringify(r.body)).toContainEqual([r.status, r.body.code]);
    }
    throw new Error('no free home slot found');
  };
  const created: string[] = []; const alertsToResolve: { tenant: string; who: string; id: string }[] = [];

  afterAll(async () => {
    // keep the demo inbox tidy: resolve the SOS / unsafe-abort alerts this suite raised (web: POST /home-visits/safety-alerts/:id/resolve)
    for (const a of alertsToResolve) await web(await tok(a.who), 'POST', `/home-visits/safety-alerts/${a.id}/resolve`).catch(() => undefined);
    for (const id of created) await q('kiorly', `update "Appointment" set status = 'CANCELLED' where id = $1 and status in ('SCHEDULED','CONFIRMED')`, [id]);
  });

  it('solo nurse Mona: dispatch books, route shows it, depart -> arrive -> SOS (alert on the app + web) -> nursing note signed -> visit FINISHED (appointment COMPLETED)', async () => {
    const mona = await tok('mona@nurse-demo.kiorly.test');
    const hv = await book('mona@nurse-demo.kiorly.test', { clinicId: 'demo_c_nsolo', patientId: 'demo_p_nsolo_h1001', clinicianId: 'demo_u_nsolo_mona', appointmentTypeId: 'demo_ty_nsolo_injection', visitAddress: { district: 'heliopolis', line1: '9 E2E Street (invented)', lat: GEO.lat, lng: GEO.lng } });
    created.push(hv.appointmentId);
    expect(hv).toMatchObject({ state: 'CONFIRMED', clinicianId: 'demo_u_nsolo_mona', district: 'heliopolis' });
    const day = dayOf(hv.plannedStartsAt);
    // the round (app) = /home-visits/route; the web list = /home-visits
    const route = (await app(mona, 'GET', `/home-visits/route?date=${day}`)).body;
    expect(route.items.find((i: any) => i.id === hv.id)).toMatchObject({ state: 'CONFIRMED', patient: { name: 'Hoda Mahmoud' }, address: { district: 'heliopolis' } });
    expect((await app(mona, 'GET', `/mobile/schedule?date=${day}`)).body.items.find((i: any) => i.id === hv.appointmentId)).toMatchObject({ isHomeVisit: true });
    // depart (en route)
    const dep = await app(mona, 'POST', `/home-visits/${hv.id}/depart`, { ...GEO, etaMinutes: 20 }, { 'Idempotency-Key': `e2e16-dep-${hv.id}` });
    expect([dep.status, dep.body.state]).toEqual([200, 'ON_MY_WAY']); expect(dep.body.enRouteAt).toBeTruthy();
    // replay of the same queued depart (lost response): idempotent for the same actor -> 200 with the current visit, replayed:true, nothing changes
    const dep2 = await app(mona, 'POST', `/home-visits/${hv.id}/depart`, { ...GEO }, { 'Idempotency-Key': `e2e16-dep-${hv.id}` });
    expect([dep2.status, dep2.body.state, dep2.body.replayed], JSON.stringify(dep2.body)).toEqual([200, 'ON_MY_WAY', true]);
    expect(dep2.body.enRouteAt).toBe(dep.body.enRouteAt);
    expect(dep.body.replayed, 'the first (real) transition is not flagged').toBeUndefined();
    expect((await web(mona, 'GET', `/home-visits/${hv.id}`)).body.enRouteAt).toBe(dep.body.enRouteAt);
    expect(Number((await q('kiorly', `select count(*)::int as n from "HomeVisitGeostamp" where "visitId" = $1 and kind = 'ON_MY_WAY'`, [hv.id]))[0].n), 'no second event/geostamp').toBe(1);
    // arrive needs a live geostamp (never queued offline): without coordinates it is refused and the state stays ON_MY_WAY
    const noGeo = await app(mona, 'POST', `/home-visits/${hv.id}/arrive`, {});
    expect(noGeo.status, JSON.stringify(noGeo.body)).toBeGreaterThanOrEqual(400);
    expect((await web(mona, 'GET', `/home-visits/${hv.id}`)).body.state).toBe('ON_MY_WAY');
    const arr = await app(mona, 'POST', `/home-visits/${hv.id}/arrive`, GEO);
    expect([arr.status, arr.body.state]).toEqual([200, 'ARRIVED']);
    // replayed arrive: 200 replayed:true, same arrivedAt, no second geostamp; a genuinely illegal transition (depart after arrival) is still 409
    const arr2 = await app(mona, 'POST', `/home-visits/${hv.id}/arrive`, GEO);
    expect([arr2.status, arr2.body.state, arr2.body.replayed, arr2.body.arrivedAt]).toEqual([200, 'ARRIVED', true, arr.body.arrivedAt]);
    expect(Number((await q('kiorly', `select count(*)::int as n from "HomeVisitGeostamp" where "visitId" = $1 and kind = 'ARRIVED'`, [hv.id]))[0].n)).toBe(1);
    const illegal = await app(mona, 'POST', `/home-visits/${hv.id}/depart`, GEO);
    expect([illegal.status, illegal.body.code]).toEqual([409, 'ILLEGAL_TRANSITION']);
    // SOS: raised, delivered within SLA, shows on the app alert inbox and on the web safety-alert list
    const sos = await app(mona, 'POST', `/home-visits/${hv.id}/sos`, GEO);
    expect(sos.status, JSON.stringify(sos.body)).toBe(200);
    expect(sos.body).toMatchObject({ delivered: true, withinSla: true, show: { ambulance: '123' } });
    const sosId = sos.body.alert.id as string; alertsToResolve.push({ tenant: 'nsolo', who: 'mona@nurse-demo.kiorly.test', id: sosId });
    const inApp = (await app(mona, 'GET', '/mobile/alerts')).body.items.find((x: any) => x.id === `hv_${sosId}`);
    expect(inApp).toMatchObject({ kind: 'HOME_VISIT_SOS', severity: 'CRITICAL', subject: { type: 'HOME_VISIT', id: hv.id } });
    const onWeb = (await web(mona, 'GET', '/home-visits/safety-alerts')).body.items.find((x: any) => x.id === sosId);
    expect(onWeb).toMatchObject({ kind: 'SOS', visitId: hv.id, withinSla: true, acknowledgedAt: null });
    // ack in the app -> acknowledged on the web
    expect((await app(mona, 'POST', `/mobile/alerts/hv_${sosId}/ack`, { note: 'safe, e2e' })).body).toMatchObject({ alreadyAcknowledged: false });
    expect((await web(mona, 'GET', '/home-visits/safety-alerts')).body.items.find((x: any) => x.id === sosId)).toMatchObject({ status: 'ACKNOWLEDGED', acknowledgedAt: expect.any(String) });
    // the app's "Finish visit" needs a signed nursing note (the clinical encounter must be finalized first)
    const early = await app(mona, 'POST', `/home-visits/${hv.id}/finish`, GEO);
    expect([early.status, early.body.message]).toEqual([400, expect.stringContaining('Finalize the linked encounter')]);
    // vitals + nursing note (visit record) + sign -> the visit is finished
    const rec = await app(mona, 'GET', `/nurse/visits/${hv.appointmentId}/record`); expect(rec.status).toBe(200);
    const vit = await app(mona, 'POST', '/mobile/vitals', { patientId: 'demo_p_nsolo_h1001', appointmentId: hv.appointmentId, systolic: 118, diastolic: 76, pulse: 70, spo2: 98 });
    expect(vit.status).toBe(201);
    expect((await app(mona, 'PUT', `/nurse/visits/${hv.appointmentId}/record`, { assessment: 'e2e16 stable', intervention: 'injection given as ordered' })).status).toBe(200);
    const signed = await app(mona, 'POST', `/nurse/visits/${hv.appointmentId}/record/sign`);
    expect([signed.status, signed.body.status, signed.body.locked]).toEqual([200, 'SIGNED', true]);
    expect(signed.body.vitals.map((v: any) => v.id)).toContain(vit.body.id);
    const fin = (await web(mona, 'GET', `/home-visits/${hv.id}`)).body;
    expect(fin).toMatchObject({ state: 'FINISHED' }); expect(fin.finishedAt).toBeTruthy();
    expect((await web(mona, 'GET', `/appointments/${hv.appointmentId}`)).body.status).toBe('COMPLETED');
    expect((await web(mona, 'GET', `/home-visits?from=${day}&to=${addDays(day, 1)}`)).body.items.find((i: any) => i.id === hv.id)).toMatchObject({ state: 'FINISHED' });
  });

  it('arrival off site: the nurse is never blocked; arrivalDistanceM + arrivedOffSite show to the dispatcher/owner (web detail + /mobile/schedule) and not to the nurse; no patient-facing alert; replay is idempotent', async () => {
    const owner = await tok('owner@nurse-demo.kiorly.test'), nurse = await tok('nurse1@nurse-demo.kiorly.test'), disp = await tok('dispatch@nurse-demo.kiorly.test');
    const hv = await book('dispatch@nurse-demo.kiorly.test', { clinicId: 'demo_c_nagy', clinicianId: 'demo_u_nagy_nurse1', appointmentTypeId: 'demo_ty_nagy_injection', patientId: 'demo_p_nagy_h1013', visitAddress: { district: 'maadi', line1: '5 E2E Street (invented)', lat: 29.96, lng: 31.25 } });
    created.push(hv.appointmentId);
    const day = dayOf(hv.plannedStartsAt);
    expect((await app(nurse, 'POST', `/home-visits/${hv.id}/depart`, { lat: 29.97, lng: 31.26 })).body.state).toBe('ON_MY_WAY');
    const outbox = async () => Number((await q('kiorly', `select count(*)::int as n from "OutboxEvent" where "aggregateId" = $1`, [hv.appointmentId]))[0].n);
    const alertsBefore = Number((await q('kiorly', `select count(*)::int as n from "HomeSafetyAlert" where "visitId" = $1`, [hv.id]))[0].n);
    // arrival fix ~1.8 km from the address (0.016 deg latitude): accepted (200), flagged
    const arr = await app(nurse, 'POST', `/home-visits/${hv.id}/arrive`, { lat: 29.976, lng: 31.25 });
    expect([arr.status, arr.body.state], JSON.stringify(arr.body)).toEqual([200, 'ARRIVED']);
    expect(arr.body.arrivedOffSite, 'the nurse is not shown the flag').toBeUndefined();
    const row = (await q('kiorly', `select "arrivalDistanceM" as d, "arrivedOffSite" as off from "HomeVisit" where id = $1`, [hv.id]))[0];
    expect(row.off).toBe(true); expect(row.d).toBeGreaterThan(1500); expect(row.d).toBeLessThan(2100);
    for (const [who, label] of [[owner, 'owner'], [disp, 'dispatcher']] as const) {
      const d = (await web(who, 'GET', `/home-visits/${hv.id}`)).body;
      expect(d, `${label} web visit detail`).toMatchObject({ state: 'ARRIVED', arrivedOffSite: true, arrivalDistanceM: row.d });
      const sch = (await app(who, 'GET', `/mobile/schedule?date=${day}`)).body.items.find((i: any) => i.id === hv.appointmentId);
      expect(sch, `${label} /mobile/schedule`).toMatchObject({ isHomeVisit: true, arrivedOffSite: true, arrivalDistanceM: row.d });
    }
    expect((await web(nurse, 'GET', `/home-visits/${hv.id}`)).body.arrivedOffSite, 'clinician view').toBeUndefined();
    expect((await app(nurse, 'GET', `/mobile/schedule?date=${day}`)).body.items.find((i: any) => i.id === hv.appointmentId).arrivedOffSite).toBeUndefined();
    // no alert is raised for it (no safety alert row; not in the app inbox for anyone)
    expect(Number((await q('kiorly', `select count(*)::int as n from "HomeSafetyAlert" where "visitId" = $1`, [hv.id]))[0].n)).toBe(alertsBefore);
    for (const who of [owner, nurse, disp]) expect(JSON.stringify((await app(who, 'GET', '/mobile/alerts')).body.items.filter((x: any) => x.subject?.id === hv.id))).not.toContain('OFF_SITE');
    // replay of the queued arrive: idempotent, nothing new, the stored distance is unchanged
    const before = await outbox();
    const again = await app(nurse, 'POST', `/home-visits/${hv.id}/arrive`, { lat: 29.96, lng: 31.25 });
    expect([again.status, again.body.replayed]).toEqual([200, true]);
    expect(await outbox()).toBe(before);
    expect((await q('kiorly', `select "arrivalDistanceM" as d from "HomeVisit" where id = $1`, [hv.id]))[0].d).toBe(row.d);
  });

  it('agency: dispatcher books for nurse1; nurse1 departs, arrives, presses SOS; owner and nurse see it, owner acknowledges; a second visit is aborted unsafe -> NURSE_SAFETY for the owner; the aide/dispatcher scope holds', async () => {
    const owner = await tok('owner@nurse-demo.kiorly.test'), nurse = await tok('nurse1@nurse-demo.kiorly.test'), disp = await tok('dispatch@nurse-demo.kiorly.test');
    const base = { clinicId: 'demo_c_nagy', clinicianId: 'demo_u_nagy_nurse1', appointmentTypeId: 'demo_ty_nagy_injection', visitAddress: { district: 'maadi', line1: '3 E2E Street (invented)', lat: 29.96, lng: 31.25 } };
    const v1 = await book('dispatch@nurse-demo.kiorly.test', { ...base, patientId: 'demo_p_nagy_h1013' }); created.push(v1.appointmentId);
    const v2 = await book('dispatch@nurse-demo.kiorly.test', { ...base, patientId: 'demo_p_nagy_h1005' }); created.push(v2.appointmentId);
    expect([v1.state, v2.state]).toEqual(['CONFIRMED', 'CONFIRMED']);
    // the nurse's round shows both; the dispatcher (web list) too; the other nurse (nurse2) does not
    const d1 = dayOf(v1.plannedStartsAt);
    expect((await app(nurse, 'GET', `/home-visits/route?date=${d1}`)).body.items.map((i: any) => i.id)).toContain(v1.id);
    expect((await web(disp, 'GET', `/home-visits?from=${d1}&to=${addDays(d1, 1)}`)).body.items.map((i: any) => i.id)).toContain(v1.id);
    expect((await app(await tok('nurse2@nurse-demo.kiorly.test'), 'GET', `/home-visits/route?date=${d1}`)).body.items.map((i: any) => i.id)).not.toContain(v1.id);
    expect((await app(await tok('nurse2@nurse-demo.kiorly.test'), 'POST', `/home-visits/${v1.id}/depart`, { lat: 29.96, lng: 31.25 })).status, 'another nurse cannot drive this visit').toBeGreaterThanOrEqual(400);
    // visit 1: en route, arrive, SOS
    const G = { lat: 29.96, lng: 31.25 };
    expect((await app(nurse, 'POST', `/home-visits/${v1.id}/depart`, G)).body.state).toBe('ON_MY_WAY');
    expect((await app(nurse, 'POST', `/home-visits/${v1.id}/arrive`, G)).body.state).toBe('ARRIVED');
    const sos = await app(nurse, 'POST', `/home-visits/${v1.id}/sos`, G);
    expect(sos.body).toMatchObject({ delivered: true, withinSla: true });
    const sosId = sos.body.alert.id as string; alertsToResolve.push({ tenant: 'nagy', who: 'owner@nurse-demo.kiorly.test', id: sosId });
    for (const who of [owner, nurse]) expect((await app(who, 'GET', '/mobile/alerts')).body.items.find((x: any) => x.id === `hv_${sosId}`), 'SOS in the app inbox').toMatchObject({ kind: 'HOME_VISIT_SOS', severity: 'CRITICAL' });
    expect((await web(owner, 'GET', '/home-visits/safety-alerts')).body.items.find((x: any) => x.id === sosId), 'SOS on the web').toMatchObject({ kind: 'SOS', visitId: v1.id });
    // the agency dispatcher sees the SOS in the app inbox and on the web, home-visit kinds only, scoped to the agency
    const dAlerts = (await app(disp, 'GET', '/mobile/alerts')).body;
    expect(dAlerts.items.find((x: any) => x.id === `hv_${sosId}`), 'dispatcher sees the SOS').toMatchObject({ kind: 'HOME_VISIT_SOS', severity: 'CRITICAL' });
    expect(dAlerts.items.every((x: any) => x.id.startsWith('hv_') && ['HOME_VISIT_SOS', 'HOME_VISIT_MISSED_CHECKIN', 'NURSE_SAFETY'].includes(x.kind)), 'dispatcher gets home-visit alert kinds only').toBe(true);
    const dWeb = await web(disp, 'GET', '/home-visits/safety-alerts');
    expect(dWeb.status, 'dispatcher may read the web safety alerts').toBe(200);
    expect(dWeb.body.items.find((x: any) => x.id === sosId)).toMatchObject({ kind: 'SOS', visitId: v1.id });
    expect((await web(disp, 'POST', `/home-visits/safety-alerts/${sosId}/resolve`)).status, 'web resolve stays manager-only').toBe(403);
    expect((await app(disp, 'POST', '/mobile/alerts/vit_any-id/ack', {})).status, 'dispatcher cannot ack clinical alerts').toBe(404);
    // another org's dispatcher/owner does not see this agency's alert (Nile Care front desk has no alert access at all)
    expect((await app(await tok(NA('frontdesk1')), 'GET', '/mobile/alerts')).body.items.find((x: any) => x.id === `hv_${sosId}`)).toBeUndefined();
    // nurse2 (another nurse) must not see this nurse's alert
    expect((await app(await tok('nurse2@nurse-demo.kiorly.test'), 'GET', '/mobile/alerts')).body.items.find((x: any) => x.id === `hv_${sosId}`)).toBeUndefined();
    expect((await app(owner, 'POST', `/mobile/alerts/hv_${sosId}/ack`, {})).body).toMatchObject({ alreadyAcknowledged: false });
    expect((await web(owner, 'GET', '/home-visits/safety-alerts')).body.items.find((x: any) => x.id === sosId).status).toBe('ACKNOWLEDGED');
    // visit 2: depart then abort as unsafe -> not a no-show, NURSE_SAFETY alert for the owner
    expect((await app(nurse, 'POST', `/home-visits/${v2.id}/depart`, G)).body.state).toBe('ON_MY_WAY');
    const ab = await app(nurse, 'POST', `/home-visits/${v2.id}/abort-unsafe`, { reason: 'e2e16 aggressive dog at the door', reasonCategory: 'UNSAFE_ENVIRONMENT', ...G });
    expect(ab.status, JSON.stringify(ab.body)).toBe(200);
    expect((await web(owner, 'GET', `/home-visits/${v2.id}`)).body).toMatchObject({ state: 'ABORTED_UNSAFE' });
    const aborted = (await app(owner, 'GET', '/mobile/alerts')).body.items.find((x: any) => x.kind === 'NURSE_SAFETY' && x.subject?.id === v2.id);
    expect(aborted, 'unsafe abort alert for the agency owner').toMatchObject({ severity: 'HIGH' });
    const webAb = (await web(owner, 'GET', '/home-visits/safety-alerts')).body.items.find((x: any) => x.visitId === v2.id);
    expect(webAb).toMatchObject({ kind: 'UNSAFE_ABORT' }); alertsToResolve.push({ tenant: 'nagy', who: 'owner@nurse-demo.kiorly.test', id: webAb.id });
    const dAbort = (await app(disp, 'GET', '/mobile/alerts')).body.items.find((x: any) => x.kind === 'NURSE_SAFETY' && x.subject?.id === v2.id);
    expect(dAbort, 'dispatcher sees the unsafe-abort alert').toMatchObject({ severity: 'HIGH' });
    expect((await app(disp, 'POST', `/mobile/alerts/${dAbort.id}/ack`, { note: 'dispatcher called the nurse' })).body, 'dispatcher acknowledges').toMatchObject({ id: dAbort.id, alreadyAcknowledged: false });
    expect((await app(owner, 'GET', '/mobile/alerts')).body.items.find((x: any) => x.id === dAbort.id), 'ack by the dispatcher clears it for the owner').toBeUndefined();
    // agency nurse finishing without a signed note is refused the same way
    const fin = await app(nurse, 'POST', `/home-visits/${v1.id}/finish`, G);
    expect(fin.status).toBe(400);
  });
});

// ============================================================================================================================================================
describe('e. Offline queue replay: the same Idempotency-Key twice has exactly one effect', () => {
  const NADIA = 'demo_u_na_nadia';
  it('quick vitals: replay returns the same reading (replayed=true), stores one row, one trend entry, one alert, one push', async () => {
    const nurse = await tok(NA('nurse')), mgr = await tok(NA('manager'));
    const pid = 'demo_p_na_8';
    const key = `e2e16-vit-${Date.now()}`;
    const body = { patientId: pid, systolic: 236, diastolic: 131, pulse: 151, spo2: 80 };
    const n0 = (await web(nurse, 'GET', `/nurse/patients/${pid}/vitals/trend`)).body.items.length;
    const pushes0 = (await app(mgr, 'GET', '/mobile/inbox?limit=100')).body.items.filter((x: any) => x.kind === 'SAFETY').length;
    const a = await app(nurse, 'POST', '/mobile/vitals', body, { 'Idempotency-Key': key });
    const b = await app(nurse, 'POST', '/mobile/vitals', body, { 'Idempotency-Key': key });
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(b.body.id, 'same reading id on replay').toBe(a.body.id);
    expect([a.body.replayed, b.body.replayed]).toEqual([false, true]);
    expect(b.body).toMatchObject({ critical: true, escalation: { required: true } });
    expect(await q('kiorly', `select count(*)::int as n from "VitalsObservation" where id = $1`, [a.body.id])).toEqual([{ n: 1 }]);
    // the web trend is capped (30 newest) once the shared demo patient has many readings, so assert growth up to the cap and that the new reading is in it
    const trend = (await web(nurse, 'GET', `/nurse/patients/${pid}/vitals/trend`)).body.items;
    expect(trend.length, 'web trend grew by one (up to its cap)').toBe(Math.min(n0 + 1, 30));
    expect(JSON.stringify(trend)).toContain(a.body.id);
    expect((await app(nurse, 'GET', '/mobile/alerts')).body.items.filter((x: any) => x.id === `vit_${a.body.id}`)).toHaveLength(1);
    expect((await app(mgr, 'GET', '/mobile/inbox?limit=100')).body.items.filter((x: any) => x.kind === 'SAFETY').length, 'one push, not two (inbox page is capped at 100 once the shared dev DB has many SAFETY pushes)').toBe(Math.min(pushes0 + 1, 100));
    // a different key (a genuinely new reading) is stored separately; the same key from another user is not a replay
    const c = await app(nurse, 'POST', '/mobile/vitals', body, { 'Idempotency-Key': `${key}-2` });
    expect(c.body.id).not.toBe(a.body.id);
    const d = await app(await tok(NA('nadia')), 'POST', '/mobile/vitals', body, { 'Idempotency-Key': key });
    expect([d.body.id === a.body.id, d.body.replayed]).toEqual([false, false]);
    // clean up the alerts this raised
    for (const id of [a.body.id, c.body.id, d.body.id]) await app(mgr, 'POST', `/mobile/alerts/vit_${id}/ack`, { note: 'e2e16 cleanup' });
  });

  it('draft save (queued PATCH /encounters/:id) is idempotent; check-in replay does not issue a second ticket; Rx sign / approve / ack replays are no-ops', async () => {
    const fd = await tok(NA('frontdesk2')), doc = await tok(NA('nadia'));
    const startsAt = new Date(Date.now() + (3100 + Math.floor(Math.random() * 3000)) * 60_000).toISOString();
    const ap = await web(fd, 'POST', '/appointments', { clinicId: 'demo_c_na_maadi', patientId: 'demo_p_na_10', clinicianId: NADIA, startsAt, notes: 'e2e16 replay' });
    expect(ap.status, JSON.stringify(ap.body)).toBe(201);
    const ci = await app(fd, 'POST', `/front-desk/appointments/${ap.body.id}/check-in`, {}, { 'Idempotency-Key': 'e2e16-ci' });
    expect(ci.status).toBe(201);
    const ci2 = await app(fd, 'POST', `/front-desk/appointments/${ap.body.id}/check-in`, {}, { 'Idempotency-Key': 'e2e16-ci' });
    expect(ci2.status, 'second check-in is refused or returns the same ticket, never a second ticket').toBeGreaterThanOrEqual(200);
    if (ci2.status < 300) expect(ci2.body.queueTicketNumber).toBe(ci.body.queueTicketNumber);
    const board = (await web(fd, 'GET', '/front-desk/board?clinicId=demo_c_na_maadi')).body;
    expect([...board.waiting, ...board.inExam].filter((x: any) => x.appointmentId === ap.body.id)).toHaveLength(1);
    const enc = ci.body.openEncounterId;
    const save = { chiefComplaint: 'e2e16 replay', subjective: 'S1', objective: 'O1', assessment: 'A1', plan: 'P1' };
    const p1 = await app(doc, 'PATCH', `/encounters/${enc}`, save, { 'Idempotency-Key': 'e2e16-save' });
    const p2 = await app(doc, 'PATCH', `/encounters/${enc}`, save, { 'Idempotency-Key': 'e2e16-save' });
    expect([p1.status, p2.status]).toEqual([200, 200]);
    expect((await web(doc, 'GET', `/encounters/${enc}`)).body).toMatchObject(save);
    // lab approve + alert ack replays were shown in (c); here: ack of an unknown / foreign alert id is refused, not created
    expect((await app(doc, 'POST', '/mobile/alerts/vit_e2e16-unknown/ack', {})).status).toBeGreaterThanOrEqual(400);
    // leave nothing open: complete this encounter with no medications so the demo queue stays clean
    await app(doc, 'PATCH', `/encounters/${enc}`, { noMedications: true });
    expect((await web(doc, 'POST', `/encounters/${enc}/finalize`)).status).toBe(201);
  });

  it('device registration replay: same install id = same device row, token rotated, old token rejected (DEVICE_REVOKED)', async () => {
    const t = await tok(NA('nurse'));
    const deviceId = `e2e16-${Date.now()}-replay`;
    const r1 = await app(t, 'POST', '/mobile/devices', { deviceId, platform: 'android', name: 'E2E phone', appVersion: '1.0.0' });
    const r2 = await app(t, 'POST', '/mobile/devices', { deviceId, platform: 'android', name: 'E2E phone', appVersion: '1.0.0' });
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(r2.body.id).toBe(r1.body.id);
    expect(r2.body.deviceToken).not.toBe(r1.body.deviceToken);
    expect(await q('kiorly', `select count(*)::int as n from "MobileDevice" where "deviceId" = $1`, [deviceId])).toEqual([{ n: 1 }]);
    const old = await app(t, 'GET', '/mobile/summary', undefined, { 'x-kiorly-device': r1.body.id, 'x-kiorly-device-token': r1.body.deviceToken });
    expect([old.status, old.body.code]).toEqual([401, 'DEVICE_REVOKED']);
    expect((await app(t, 'GET', '/mobile/summary', undefined, { 'x-kiorly-device': r2.body.id, 'x-kiorly-device-token': r2.body.deviceToken })).status).toBe(200);
    await q('kiorly', `delete from "MobileDevice" where "deviceId" = $1`, [deviceId]);
  });
});

// ============================================================================================================================================================
describe('f. Devices: registration, org-admin listing, remote sign-out', () => {
  const ids: string[] = [];
  afterAll(async () => { for (const d of ids) await q('kiorly', `delete from "MobileDevice" where "deviceId" = $1`, [d]); });

  it('a doctor registers a device, the app sends the device headers, the owner (org admin) sees it, the doctor sees only own devices', async () => {
    const doc = await signIn(NA('nadia'), true);
    const deviceId = `e2e16-${Date.now()}-doc`; ids.push(deviceId);
    const reg = await app(doc.token, 'POST', '/mobile/devices', { deviceId, platform: 'web', name: 'E2E Expo web', appVersion: '1.0.0', pushToken: 'mock-token-e2e16' });
    expect(reg.status, JSON.stringify(reg.body)).toBe(201);
    expect(reg.body).toMatchObject({ deviceId, status: 'ACTIVE' }); expect(reg.body.deviceToken.length).toBeGreaterThan(20);
    const H = { 'x-kiorly-device': reg.body.id, 'x-kiorly-device-token': reg.body.deviceToken };
    const boot = await app(doc.token, 'GET', '/mobile/bootstrap', undefined, H);
    expect(boot.body.device).toMatchObject({ id: reg.body.id, status: 'ACTIVE' });
    expect((await app(doc.token, 'GET', '/mobile/summary', undefined, { ...H, 'x-kiorly-device-token': 'wrong-token' })).body.code).toBe('DEVICE_REVOKED');
    const own = (await app(doc.token, 'GET', '/mobile/devices')).body.items;
    expect(own.find((x: any) => x.id === reg.body.id)).toMatchObject({ mine: true, platform: 'web', hasPushToken: true, status: 'ACTIVE' });
    expect(own.every((x: any) => x.mine), 'non-admins list only their own devices').toBe(true);
    const all = (await app(await tok(NA('owner')), 'GET', '/mobile/devices')).body.items;
    expect(all.find((x: any) => x.id === reg.body.id)).toMatchObject({ mine: false, staff: { name: expect.stringContaining('Nadia') } });
    // the audit log (web) shows the registration
    const aud = (await web(await tok(NA('owner')), 'GET', '/admin/audit-logs?pageSize=50&action=mobile.device_registered')).body.items;
    expect(aud.find((x: any) => x.resourceId === reg.body.id), 'web audit log: device registered').toBeTruthy();
    ids.push(reg.body.id);
  });

  it('remote sign-out: only owner/admin or the device owner can revoke; revoking kills the refresh session so the access token stops working everywhere (app AND web)', async () => {
    const doc = await signIn(NA('nadia'), true);
    const deviceId = `e2e16-${Date.now()}-signout`; ids.push(deviceId);
    const reg = await app(doc.token, 'POST', '/mobile/devices', { deviceId, platform: 'ios', name: 'Nadia iPhone (e2e16)' });
    const H = { 'x-kiorly-device': reg.body.id, 'x-kiorly-device-token': reg.body.deviceToken };
    expect((await app(doc.token, 'GET', '/mobile/summary', undefined, H)).status).toBe(200);
    // another non-admin (nurse) cannot revoke it
    expect((await app(await tok(NA('nurse')), 'DELETE', `/mobile/devices/${reg.body.id}`)).status).toBe(403);
    // the org owner revokes it (remote sign-out)
    const rev = await app(await tok(NA('owner')), 'DELETE', `/mobile/devices/${reg.body.id}`);
    expect([rev.status, rev.body.status]).toEqual([200, 'REVOKED']);
    expect((await app(await tok(NA('owner')), 'DELETE', `/mobile/devices/${reg.body.id}`)).body.status, 'idempotent').toBe('REVOKED');
    const row = (await q('kiorly', `select status, "revokedAt", "pushToken" from "MobileDevice" where id = $1`, [reg.body.id]))[0];
    expect([row.status, row.revokedAt != null, row.pushToken]).toEqual(['REVOKED', true, null]);
    // the device's session is dead: app call, plain web call with the same token, and refresh all fail
    expect([401], 'app with device headers').toContain((await app(doc.token, 'GET', '/mobile/summary', undefined, H)).status);
    expect((await web(doc.token, 'GET', '/auth/me')).status, 'web call with the same access token').toBe(401);
    expect((await kiorly(undefined, 'POST', '/auth/refresh', { refreshToken: doc.refresh })).status, 'refresh token').toBe(401);
    const sess = (await q('kiorly', `select "revokedAt" from "UserSession" where id = $1`, [doc.sessionId]))[0];
    expect(sess.revokedAt, 'refresh session revoked in the DB').toBeTruthy();
    // web audit log shows the remote sign-out as such
    const aud = (await web(await tok(NA('owner')), 'GET', '/admin/audit-logs?pageSize=50&action=mobile.device_revoked')).body.items;
    expect(aud.find((x: any) => x.resourceId === reg.body.id)).toBeTruthy();
    // the staff member can sign in again and register again (device reactivated, new token)
    const again = await signIn(NA('nadia'), true);
    const reg2 = await app(again.token, 'POST', '/mobile/devices', { deviceId, platform: 'ios', name: 'Nadia iPhone (e2e16)' });
    expect([reg2.status, reg2.body.status, reg2.body.id]).toEqual([201, 'ACTIVE', reg.body.id]);
    // own revoke (sign out from the app) works for the owner of the device on any plan
    expect((await app(again.token, 'DELETE', `/mobile/devices/${reg2.body.id}`)).status).toBe(200);
  });
});
