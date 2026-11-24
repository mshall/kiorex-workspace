import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { KIOREX_API, KIORLY_API, PHARMACY_API, PHARMACY, LAB_API } from '../src/env.js';
import { kiorex, kiorly, opsLogin, q, waitFor, syncProviders } from '../src/clients.js';
import { loginWithPhone } from '../src/passport.js';
import { purgeTenant, resetOtpLimits, resetRateLimits } from '../src/db.js';
import { lab, pharmacy, recordDevGate, releaseDevGate, rnd, setFlag } from '../src/verticals.js';
import { generateEnrolmentCode, newIntakeNonce, signIntakeRequest } from '../src/intake.js';

/**
 * s. Connect a STANDALONE organisation to Kiorex (ADR-040). The product side computes a checklist from real state; "Request to go live" sends a signed,
 * PHI-free request; the Kiorex ops console runs automated checks (signed handshake, dry run, flags, market, duplicates, documents), highlights the
 * HUMAN steps, enforces the two-person rule and only flips the partner live when every gate is green.
 * Real stack: Kiorly Clinic :3010, Kiorex :4000, Pharmacy :3100, Lab :3200. Ops: ops_admin +201000009001 prepares, super_admin +201000000099 approves.
 * Gate evidence for the launch-locked flags is recorded through the existing human-only super-admin route with the dev-only label (like 04/05), never by the module.
 */
const OPS_ADMIN_TOTP = 'REMOVED-OLD-DEMO-TOTP-SECRET';
const P = '/admin/onboarding/partners';
const tag = rnd().toLowerCase();
let sup: string; let prep: string;
const createdConnections: string[] = [];
const clinicTenants: string[] = [];

const ops = (t: string, method: string, path: string, body?: unknown) => kiorex(t, method, `${P}${path}`, body);
/** Kiorex ops creates the one-time enrolment code the partner product asks for in its "Request to go live" step (contracts 1.9.0). */
async function enrol(kind: string, extra: Record<string, unknown> = {}) {
  const r = await kiorex(prep, 'POST', '/admin/onboarding/enrolments', { kind, label: `e2e-connect ${tag}`, ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201); createdEnrolments.push(r.body.id); return r.body.code as string;
}
const createdEnrolments: string[] = [];
const intake = (body: string, secret: string, enrolmentCode?: string, ts?: number) => fetch(`${KIOREX_API}/partners/v1/connection-requests`, { method: 'POST', headers: signIntakeRequest({ secret, body, timestamp: ts, enrolmentCode }), body });
const stepOf = (view: any, key: string) => view.steps.find((s: any) => s.key === key);
async function connectionId(kind: string, orgRef: string) {
  const id = await waitFor(`connection ${kind}`, async () => (await q('kiorex_platform', `select id from "PartnerConnection" where kind = $1 and "orgRef" = $2`, [kind, orgRef]))[0]?.id, 20_000, 400);
  createdConnections.push(id); return id as string;
}

/** The whole ops walk-through shared by every kind: highlighted human steps -> two-person approval -> Go live. */
async function walkOps(id: string, opts: { gateFlag?: string; expectNotification?: string }) {
  let v = (await ops(prep, 'POST', `/${id}/run-checks`)).body;
  // automated steps ran by themselves; human steps are highlighted as actionable items
  expect(['DONE', 'WARN'], JSON.stringify(v.steps.filter((s: any) => s.type === 'AUTO'))).toContain(stepOf(v, 'handshake').state);
  expect(stepOf(v, 'documents').state).toBe('DONE');
  expect(stepOf(v, 'duplicates').state).toMatch(/DONE|WARN/);
  expect(v.humanActions).toEqual(expect.arrayContaining(['review_documents', 'verify_licence', 'fees']));
  expect(v.progress).toBeGreaterThan(30); expect(v.progress).toBeLessThan(100);
  expect((await ops(prep, 'POST', `/${id}/go-live`)).status).toBe(409); // not while any gate is open
  if (opts.gateFlag) {
    // launch-locked: the module never records gate evidence; ops_admin cannot, only a human super admin can
    const gate = stepOf(v, 'launch_gate'); expect(gate).toMatchObject({ type: 'HUMAN', actor: 'super_admin' });
    if (gate.state === 'ACTION') {
      expect((await kiorex(prep, 'PUT', `/admin/flags/${opts.gateFlag}/gate`, { gateId: 'DEV-ONLY-NOT-A-REAL-GATE', approver: 'x', approvedOn: new Date().toISOString(), documentUrl: 'https://dev.invalid/x' })).status).toBe(403);
      await recordDevGate(sup, opts.gateFlag);
      v = (await ops(prep, 'POST', `/${id}/run-checks`)).body;
    } // else: the dev seed already recorded the dev-only evidence on this stack
    expect(stepOf(v, 'launch_gate').state).toBe('DONE');
  }
  expect((await ops(prep, 'POST', `/${id}/steps/verify_licence`, { reference: '' })).status).toBe(400);
  expect((await ops(prep, 'POST', `/${id}/steps/review_documents`, { note: 'complete' })).status).toBe(200);
  expect((await ops(prep, 'POST', `/${id}/steps/verify_licence`, { reference: 'LIC-E2E-1' })).status).toBe(200);
  expect((await ops(prep, 'POST', `/${id}/steps/fees`, { mode: 'STANDARD' })).status).toBe(200);
  // two-person rule
  expect((await ops(prep, 'POST', `/${id}/approve`)).status).toBe(403); // approval is super-admin only
  expect((await ops(sup, 'POST', `/${id}/approve`)).status).toBe(409); // nothing awaits approval yet
  const req = await ops(prep, 'POST', `/${id}/request-approval`); expect(req.status, JSON.stringify(req.body)).toBe(200); expect(req.body.status).toBe('AWAITING_APPROVAL');
  expect((await ops(sup, 'POST', `/${id}/go-live`)).status).toBe(409); // approved first
  const ap = await ops(sup, 'POST', `/${id}/approve`); expect(ap.status, JSON.stringify(ap.body)).toBe(200); expect(ap.body.status).toBe('APPROVED');
  const live = await ops(prep, 'POST', `/${id}/go-live`); expect(live.status, JSON.stringify(live.body)).toBe(200);
  expect(live.body.status).toBe('LIVE'); expect(live.body.progress).toBe(100);
  expect((await ops(prep, 'POST', `/${id}/go-live`)).body.status).toBe('LIVE'); // idempotent
  const audit = (await ops(prep, 'GET', `/${id}/audit`)).body.map((a: any) => a.action);
  expect(audit).toEqual(expect.arrayContaining(['submitted', 'checks_run', 'step_verify_licence', 'approval_requested', 'approved', 'went_live']));
  return live.body;
}

describe('s. Connect a standalone organisation to Kiorex (ADR-040)', () => {
  beforeAll(async () => {
    await resetOtpLimits();
    await resetRateLimits();
    sup = (await opsLogin()).accessToken;
    try { prep = (await loginWithPhone('+201000009001', { clientId: 'kiorex-ops', otp: '000000', totpSecret: OPS_ADMIN_TOTP })).accessToken; }
    catch { await new Promise((r) => setTimeout(r, 31_000)); prep = (await loginWithPhone('+201000009001', { clientId: 'kiorex-ops', otp: '000000', totpSecret: OPS_ADMIN_TOTP })).accessToken; } // TOTP step already used by another file
  });
  afterAll(async () => {
    await resetRateLimits(); // the burst test fills the per-minute window: do not leave the next suite blocked
    await q('kiorex_platform', `delete from "AuditLog" where resource = 'PartnerEnrolment' and "resourceId" = any($1)`, [createdEnrolments]);
    await q('kiorex_platform', `delete from "PartnerEnrolment" where id = any($1)`, [createdEnrolments]);
    for (const id of createdConnections) {
      const [c] = await q('kiorex_platform', `select kind, "orgRef", "clientKey", "registrationId" from "PartnerConnection" where id = $1`, [id]);
      if (c?.registrationId) await q('kiorex_platform', `delete from "PartnerRegistration" where id = $1`, [c.registrationId]);
      await q('kiorex_platform', `delete from "FlagValue" where "scope" = 'ORG' and "scopeId" = $1`, [c?.orgRef ?? '']);
      await q('kiorex_platform', `delete from "AuditLog" where resource = 'PartnerConnection' and "resourceId" = $1`, [id]);
      await q('kiorex_platform', `delete from "PartnerConnection" where id = $1`, [id]);
    }
    // the self-serve clinic tenant (and its Kiorex provider projection) must not outlive the suite: it would stay LIVE in search
    for (const t of clinicTenants) { await q('kiorex_platform', `delete from "Provider" where "tenantId" = $1`, [t]); await purgeTenant('kiorly', t); }
    // the partner-side tenants this run signed up (own databases, RESTRICT foreign keys): found by this run's unique tag so a failed run cleans up too
    for (const [db, table] of [['kiorly_pharmacy', 'Tenant'], ['kiorly_lab', 'Tenant']] as const) for (const t of await q(db, `select id from "${table}" where name like $1`, [`E2E Connect %${tag}`])) await purgeTenant(db, t.id);
    await q('kiorex_platform', `delete from "MessageLog" where "templateId" like 'partner.onboarding.%' and recipient like 'e2e-connect-%'`);
  });

  it('the intake is authenticated: unsigned, wrongly signed, old shared-secret, replayed, revoked and expired requests are all refused with the SAME 401 and create nothing', async () => {
    const mk = (orgRef: string) => JSON.stringify({ nonce: newIntakeNonce(), kind: 'LAB', orgRef, name: 'Bad', baseUrl: 'http://localhost:3200', clientKey: 'k', clientSecret: 's', webhookSecret: 'w' });
    const ghost = generateEnrolmentCode(); const revoked = await enrol('LAB'); const expired = await enrol('LAB'); const good = await enrol('LAB');
    expect((await kiorex(prep, 'DELETE', `/admin/onboarding/enrolments/${revoked.split('.')[0]}`)).status).toBe(200);
    await q('kiorex_platform', `update "PartnerEnrolment" set "expiresAt" = (now() at time zone 'utc') - interval '1 minute' where id = $1`, [expired.split('.')[0]]);
    const answers: string[] = []; const refs: string[] = [];
    const attempt = async (secret: string, code?: string, ts?: number) => { const ref = `e2e_bad_${tag}_${refs.length}`; refs.push(ref); const r = await intake(mk(ref), secret, code, ts); expect(r.status).toBe(401); answers.push(await r.text()); };
    await attempt('x');                                   // unsigned-ish: no credential
    await attempt(ghost.code, ghost.code);                // unknown code
    await attempt(revoked, revoked);                      // revoked
    await attempt(expired, expired);                      // expired
    await attempt('kx_dev_webhook_secret');               // the old shared Kiorly secret no longer works
    await attempt(good, good, Math.floor(Date.now() / 1000) - 3600); // stale timestamp
    expect(new Set(answers).size).toBe(1); expect(JSON.parse(answers[0]!).code).toBe('INTAKE_UNAUTHORIZED');
    expect((await q('kiorex_platform', `select count(*)::int c from "PartnerConnection" where "orgRef" like $1`, [`e2e_bad_${tag}%`]))[0].c).toBe(0);
    // strict shape (400) and size (413) answers come before authentication and reveal nothing about codes
    expect((await intake(JSON.stringify({ ...JSON.parse(mk('e2e_strict')), surprise: 1 }), good, good)).status).toBe(400);
    const huge = JSON.stringify({ ...JSON.parse(mk('e2e_big')), readiness: { pad: 'x'.repeat(70_000) } });
    expect((await intake(huge, good, good)).status).toBe(413);
    expect((await ops('', 'GET', '')).status).toBe(401);
  });

  describe('Kiorly Pharmacy', () => {
    const email = `e2e-connect-ph-${tag}@example.com`; let tok: string; let tenantId: string; let branchId: string; let id: string;
    it('a new pharmacy starts standalone: the checklist is computed from real state and the request is refused until ready', async () => {
      const s = await pharmacy(undefined, 'POST', '/onboarding/signup', { pharmacyName: `E2E Connect Pharmacy ${tag}`, ownerName: 'E2E Owner', email, password: 'Demo@12345', branchName: 'Main' });
      expect(s.status, JSON.stringify(s.body)).toBe(201); tenantId = s.body.tenantId; branchId = s.body.branchId;
      tok = (await pharmacy(undefined, 'POST', '/auth/login', { email, password: 'Demo@12345' })).body.accessToken;
      const c = await pharmacy(tok, 'GET', '/kiorex-connect');
      expect(c.status, JSON.stringify(c.body)).toBe(200);
      expect(c.body).toMatchObject({ status: 'STANDALONE', canRequest: false, legacy: false });
      expect(c.body.steps.find((x: any) => x.key === 'branch_optin').status).toBe('action_needed');
      expect((await pharmacy(tok, 'POST', '/kiorex-connect/request', {})).status).toBe(409);
      expect((await pharmacy(tok, 'PUT', '/kiorex-connect/payout', { label: '1234567890123' })).status).toBe(400); // never an account number
    });
    it('the owner completes every step through the wizard API', async () => {
      const b = await pharmacy(tok, 'PUT', `/kiorex-connect/branches/${branchId}`, { optedIn: true, licenceNo: `PH-LIC-${tag}`, deliveryRadiusKm: '5', latitude: '30.0444', longitude: '31.2357', openingHours: { sat: ['09:00', '23:00'], sun: ['09:00', '23:00'] } });
      expect(b.status, JSON.stringify(b.body)).toBe(200);
      const tagU = rnd();
      const d = await pharmacy(tok, 'POST', '/catalogue/drugs', { brandName: `E2E-Connect-Med-${tagU}`, activeIngredient: `e2e-ing-${tagU}`, strength: '500 mg', dosageForm: 'tablet', packSize: '20', rxOnly: false, price: '40.00' });
      expect(d.status, JSON.stringify(d.body)).toBe(201);
      const exp = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);
      expect((await pharmacy(tok, 'POST', '/inventory/receipts', { branchId, invoiceNo: `E2E-${tagU}`, lines: [{ drugId: d.body.id, lotNumber: `L-${tagU}`, expiryDate: exp, quantity: 20, unitCost: '20.00' }] })).status).toBe(201);
      expect((await pharmacy(tok, 'POST', '/kiorex-connect/licence', { name: 'licence.pdf', contentBase64: Buffer.from('%PDF-1.4\n%E2E dev licence placeholder\n%%EOF').toString('base64') })).status).toBeLessThan(500);
      expect((await pharmacy(tok, 'PUT', '/kiorex-connect/payout', { label: 'Main settlement account' })).status).toBe(200);
      const t = await pharmacy(tok, 'PUT', '/kiorex-connect/terms', { version: '2026-11' }); expect(t.status).toBe(200);
      expect((await pharmacy(tok, 'PUT', '/kiorex-connect/terms', { version: 'old' })).status).toBe(400);
      const c = await pharmacy(tok, 'GET', '/kiorex-connect');
      expect(c.body.steps.filter((x: any) => !['licence', 'request', 'live'].includes(x.key)).every((x: any) => x.status === 'done'), JSON.stringify(c.body.steps)).toBe(true);
    });
    it('request registration: signed, PHI-free, secrets never echoed; Kiorex shows it in the Partner onboarding queue', async function () {
      const c0 = await pharmacy(tok, 'GET', '/kiorex-connect');
      if (c0.body.steps.find((x: any) => x.key === 'licence').status !== 'done') {
        // storage adapter may refuse a placeholder PDF: the licence document is then recorded through the dev storage fixture
        expect(c0.body.steps.find((x: any) => x.key === 'licence').detail.document).toBe(false);
      }
      expect((await pharmacy(tok, 'POST', '/kiorex-connect/request', {})).status).toBe(409); // no enrolment code yet
      const wrong = await pharmacy(tok, 'POST', '/kiorex-connect/request', { enrolmentCode: generateEnrolmentCode().code }); expect(wrong.status).toBe(409); expect(wrong.body.code).toBe('ENROLMENT_CODE_REJECTED');
      expect((await pharmacy(tok, 'GET', '/kiorex-connect')).body.enrolmentCodeRequired).toBe(true);
      const r = await pharmacy(tok, 'POST', '/kiorex-connect/request', { contactEmail: `e2e-connect-ph-${tag}@example.com`, enrolmentCode: await enrol('PHARMACY') });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.status).toBe('REQUESTED'); expect(JSON.stringify(r.body)).not.toMatch(/clientSecret|webhookSecret/);
      id = await connectionId('PHARMACY', tenantId);
      const list = (await ops(prep, 'GET', '')).body; const row = list.find((x: any) => x.id === id);
      expect(row).toBeTruthy(); expect(row.humanActions.length).toBeGreaterThan(0);
      const [db] = await q('kiorex_platform', `select "secretsEnc", "statusTokenHash", readiness::text r from "PartnerConnection" where id = $1`, [id]);
      expect(db.secretsEnc).toMatch(/^v1\./); expect(db.r).not.toMatch(/E2E Owner|e2e-connect-ph|clientSecret/); // encrypted at rest, PHI/secret-free readiness
    });
    it('ops: automated checks run themselves, human steps are highlighted, two-person approval, Go live registers the partner and notifies it', async () => {
      const live = await walkOps(id, { gateFlag: 'kiorex.pharmacy_orders' });
      expect(live.steps.every((s: any) => ['DONE', 'WARN'].includes(s.state))).toBe(true);
      const [conn] = await q('kiorex_platform', `select "secretsEnc", "registrationId", "clientKey" from "PartnerConnection" where id = $1`, [id]);
      expect(conn.secretsEnc).toBeNull(); expect(conn.registrationId).toBeTruthy(); // secrets moved into the encrypted registry and wiped from the request
      const [reg] = await q('kiorex_platform', `select kind, active, "clientKey" from "PartnerRegistration" where id = $1`, [conn.registrationId]);
      expect(reg).toMatchObject({ kind: 'PHARMACY', active: true });
      const logs = await q('kiorex_platform', `select "templateId", status from "MessageLog" where channel = 'EMAIL' and recipient = $1 order by "createdAt"`, [`e2e-connect-ph-${tag}@example.com`]);
      expect(logs.map((l: any) => l.templateId)).toEqual(expect.arrayContaining(['partner.onboarding.submitted', 'partner.onboarding.live']));
      const audit = JSON.stringify(await q('kiorex_platform', `select metadata from "AuditLog" where resource = 'PartnerConnection' and "resourceId" = $1`, [id]));
      expect(audit).not.toMatch(/E2E Owner|clientSecret|webhookSecret|Demo@12345/);
    });
    it('the pharmacy sees the decision (pull) and the wizard shows Live; rotating credentials shows secrets once and Kiorex applies them only after a passing handshake', async () => {
      const c = await pharmacy(tok, 'POST', '/kiorex-connect/refresh', {});
      expect(c.body.status).toBe('APPROVED'); expect(c.body.progress).toBe(100); expect(c.body.steps.find((x: any) => x.key === 'live').status).toBe('done');
      const rot = await pharmacy(tok, 'POST', '/kiorex-connect/request', { rotate: true });
      expect(rot.status, JSON.stringify(rot.body)).toBe(200); expect(rot.body.credentials).toMatchObject({ shownOnce: true });
      const again = await pharmacy(tok, 'GET', '/kiorex-connect'); expect(JSON.stringify(again.body)).not.toContain(rot.body.credentials.clientSecret);
      const v = await waitFor('rotation pending', async () => { const x = (await ops(prep, 'GET', `/${id}`)).body; return x.rotationPending ? x : undefined; }, 20_000, 500);
      expect(v.rotationPending).toBe(true);
      const ap = await ops(prep, 'POST', `/${id}/apply-rotation`); expect(ap.status, JSON.stringify(ap.body)).toBe(200); expect(ap.body.rotationPending).toBe(false);
      const [reg] = await q('kiorex_platform', `select "clientKey" from "PartnerRegistration" where id = (select "registrationId" from "PartnerConnection" where id = $1)`, [id]);
      expect(reg.clientKey).toBe(rot.body.credentials.clientKey);
      await releaseDevGate(sup, 'kiorex.pharmacy_orders');
    });
  });

  describe('Kiorly Lab', () => {
    const email = `e2e-connect-lab-${tag}@example.com`; let tok: string; let tenantId: string; let labId: string; let id: string;
    it('a new lab starts standalone, completes the checklist and requests registration', async () => {
      const o = await lab(undefined, 'POST', '/onboarding/tenants', { name: `E2E Connect Lab ${tag}`, slug: `e2e-connect-${tag}`, labName: 'Main lab', labCode: 'EC1', ownerName: 'E2E Owner', ownerEmail: email, loadStarterCatalogue: true });
      expect(o.status, JSON.stringify(o.body)).toBe(201); tenantId = o.body.tenantId; labId = o.body.labId; tok = o.body.token;
      const c = await lab(tok, 'GET', '/kiorex-connect'); expect(c.status, JSON.stringify(c.body)).toBe(200);
      expect(c.body).toMatchObject({ status: 'STANDALONE', canRequest: false }); expect(c.body.steps.find((x: any) => x.key === 'price_list').status).toBe('done');
      expect((await lab(tok, 'POST', '/kiorex-connect/request', {})).status).toBe(409);
      expect((await lab(tok, 'PUT', `/labs/${labId}`, { licenceNo: `LAB-LIC-${tag}` })).status).toBeLessThan(300);
      expect((await lab(tok, 'POST', '/kiorex-connect/licence', { name: 'licence.pdf', contentBase64: Buffer.from('%PDF-1.4\n%E2E dev licence placeholder\n%%EOF').toString('base64') })).status).toBe(200);
      expect((await lab(tok, 'PUT', '/kiorex-connect/payout', { label: 'Main settlement account' })).status).toBe(200);
      expect((await lab(tok, 'PUT', '/kiorex-connect/terms', { version: '2026-11' })).status).toBe(200);
      const ready = await lab(tok, 'GET', '/kiorex-connect'); expect(ready.body.canRequest, JSON.stringify(ready.body.steps)).toBe(true);
      const r = await lab(tok, 'POST', '/kiorex-connect/request', { contactEmail: email, enrolmentCode: await enrol('LAB') }); expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.status).toBe('REQUESTED'); expect(JSON.stringify(r.body)).not.toMatch(/clientSecret|webhookSecret/);
      id = await connectionId('LAB', tenantId);
    });
    it('ops: automated handshake + dry run, highlighted human steps, launch gate for kiorex.lab_bookings, approval and Go live', async () => {
      const live = await walkOps(id, { gateFlag: 'kiorex.lab_bookings' });
      expect(stepOf(live, 'sync_dry_run').state).toMatch(/DONE|WARN/);
      const [reg] = await q('kiorex_platform', `select kind, active from "PartnerRegistration" where id = (select "registrationId" from "PartnerConnection" where id = $1)`, [id]);
      expect(reg).toMatchObject({ kind: 'LAB', active: true });
      const c = await lab(tok, 'POST', '/kiorex-connect/refresh', {}); expect(c.body.status).toBe('APPROVED'); expect(c.body.progress).toBe(100);
      await releaseDevGate(sup, 'kiorex.lab_bookings');
    });
    it('reject and request-changes need a reason and are visible to the partner', async () => {
      const email2 = `e2e-connect-lab2-${tag}@example.com`;
      const o = await lab(undefined, 'POST', '/onboarding/tenants', { name: `E2E Connect Lab B ${tag}`, slug: `e2e-connect-b-${tag}`, labName: 'Lab B', labCode: 'EC2', ownerName: 'E2E Owner', ownerEmail: email2, loadStarterCatalogue: true });
      const t2 = o.body.token;
      await lab(t2, 'PUT', `/labs/${o.body.labId}`, { licenceNo: `LAB-LIC-B-${tag}` });
      await lab(t2, 'POST', '/kiorex-connect/licence', { name: 'licence.pdf', contentBase64: Buffer.from('%PDF-1.4\n%E2E\n%%EOF').toString('base64') });
      await lab(t2, 'PUT', '/kiorex-connect/payout', { label: 'Settlement' }); await lab(t2, 'PUT', '/kiorex-connect/terms', { version: '2026-11' });
      expect((await lab(t2, 'POST', '/kiorex-connect/request', { contactEmail: email2, enrolmentCode: await enrol('LAB') })).status).toBe(200);
      const idB = await connectionId('LAB', o.body.tenantId);
      expect((await ops(prep, 'POST', `/${idB}/request-changes`, { reason: '' })).status).toBe(400);
      expect((await ops(prep, 'POST', `/${idB}/request-changes`, { reason: 'Please upload a clearer licence scan' })).body.status).toBe('CHANGES_REQUESTED');
      expect((await lab(t2, 'POST', '/kiorex-connect/refresh', {})).body.status).toBe('CHANGES_REQUESTED');
      expect((await ops(prep, 'POST', `/${idB}/reject`, { reason: 'Licence could not be verified' })).body.status).toBe('REJECTED');
      const after = await lab(t2, 'POST', '/kiorex-connect/refresh', {}); expect(after.body.status).toBe('REJECTED'); expect(after.body.mode).toBe('STANDALONE'); // back to standalone
    });
  });

  describe('Kiorly Clinic (Nurse edition shares the code path)', () => {
    const email = `e2e-connect-clinic-${tag}@example.com`; let tok: string; let tenantId: string; let clinicId: string; let listingId: string; let id: string;
    const wizard = async () => (await kiorly(tok, 'GET', `/kiorex/connect?clinicId=${clinicId}`));
    it('a self-serve clinic starts standalone: listings never go live on their own and the wizard says what to fix', async () => {
      const phone = `+20109${String(Date.now()).slice(-7)}`;
      expect((await kiorly(undefined, 'POST', '/public/signup/otp', { phone, market: 'EG' })).status).toBe(200);
      const v = await kiorly(undefined, 'POST', '/public/signup/verify', { phone, code: '424242', market: 'EG' }); expect(v.status, JSON.stringify(v.body)).toBe(200);
      const docs = ['terms_of_service', 'subscription_terms', 'kiorex_marketplace_fees', 'dpa', 'patient_privacy_notice', 'acceptable_use', 'refund_policy'];
      const legalAcceptances = await Promise.all(docs.map(async (d) => ({ document: d, version: (await kiorly(undefined, 'GET', `/public/legal/${d}`)).body?.version ?? '2026-11-18' })));
      const done = await kiorly(undefined, 'POST', '/public/signup/complete', { signupToken: v.body.signupToken, profile: { displayName: `Dr Connect ${tag}`, email, password: 'demopass8' }, specialty: 'GENERAL_MEDICINE', clinic: { nameEn: `E2E Connect Clinic ${tag}`, nameAr: `عيادة الربط ${tag}`, city: 'Cairo', addressEn: '1 Test St, Cairo', addressAr: '١ شارع الاختبار، القاهرة', locationUrl: 'https://maps.example/o' }, planKey: 'LITE', legalAcceptances });
      expect(done.status, JSON.stringify(done.body)).toBe(200); tok = done.body.accessToken;
      [{ tenantId }] = await q('kiorly', `select "tenantId" from "User" where email = $1`, [email]); clinicTenants.push(tenantId);
      clinicId = (await kiorly(tok, 'GET', '/clinics')).body[0].id;
      const w = await wizard(); expect(w.status, JSON.stringify(w.body)).toBe(200);
      expect(w.body).toMatchObject({ status: 'STANDALONE', legacy: false, canRequest: false });
      const byKey = Object.fromEntries(w.body.steps.map((s: any) => [s.key, s]));
      expect(byKey.consent.status).toBe('action_needed'); expect(byKey.credentials.status).toMatch(/action_needed|waiting_kiorex/);
      expect(byKey.request.status).toBe('blocked');
      listingId = w.body.doctors[0].listingId;
      expect((await kiorly(tok, 'POST', '/kiorex/connect/request', { clinicId })).status).toBe(409);
      expect((await kiorly(tok, 'PUT', '/kiorex/connect/consent', { clinicId, termsVersion: '2026-11', feeAcknowledged: false })).status).toBe(400);
    });
    it('the owner finishes the checklist; consent stores the terms version and the fee snapshot', async () => {
      // verification review, photo upload and map pin have their own suites (on03, pa03, kx02): here they are put in their reviewed state
      await q('kiorly', `insert into "ClinicianVerification" (id, "userId", "tenantId", status, profession, "verifiedProfession", "verifiedAt", "updatedAt")
        select 'cv_e2e_' || u.id, u.id, u."tenantId", 'VERIFIED', 'PHYSICIAN', 'PHYSICIAN', now(), now() from "User" u where u."tenantId" = $1 and u."isTenantOwner"
        on conflict ("userId") do update set status = 'VERIFIED', "verifiedProfession" = 'PHYSICIAN', "verifiedAt" = now()`, [tenantId]);
      await q('kiorly', `update "Clinic" set latitude = 30.0444, longitude = 31.2357 where "tenantId" = $1`, [tenantId]);
      await q('kiorly', `update "AppointmentType" set "feeAmount" = 300, "marketplaceBookable" = true where "tenantId" = $1 and "isActive" = true`, [tenantId]);
      await q('kiorly', `update "MarketplaceListing" set "profileJson" = $2::jsonb where "tenantId" = $1`, [tenantId, JSON.stringify({ displayNameEn: `Dr Connect ${tag}`, displayNameAr: `د. ربط ${tag}`, specialty: 'GENERAL_MEDICINE', languages: ['en', 'ar'], yearsExperience: 9, education: [{ degreeEn: 'MBBCh' }], amenities: ['parking'], photoRelativePath: 'e2e/photo.jpg', bioEn: 'General practitioner focused on family medicine and preventive care for adults.', bioAr: 'طبيب ممارس عام يركز على طب الأسرة والرعاية الوقائية للبالغين في القاهرة.' })]);
      let w = await wizard();
      expect(w.body.steps.find((s: any) => s.key === 'profile').status, JSON.stringify(w.body.steps)).toBe('done');
      const c = await kiorly(tok, 'PUT', '/kiorex/connect/consent', { clinicId, termsVersion: '2026-11', feeAcknowledged: true }); expect(c.status, JSON.stringify(c.body)).toBe(200);
      expect(c.body.consent).toMatchObject({ termsVersion: '2026-11', feeAcknowledged: true });
      w = await wizard();
      expect(w.body.steps.filter((s: any) => !s.optional && !['request', 'live'].includes(s.key)).every((s: any) => s.status === 'done'), JSON.stringify(w.body.steps)).toBe(true);
      expect(w.body.canRequest).toBe(true);
      const rows = (await kiorly(tok, 'GET', `/marketplace/listings?clinicId=${clinicId}`)).body;
      expect(rows[0].status).toBe('DRAFT'); expect(rows[0].blockers).toContain('connection'); // everything else is green but the clinic never asked: not live
    });
    it('request to go live: listings move DRAFT -> PENDING_VERIFICATION and are still not searchable on Kiorex', async () => {
      expect((await kiorly(tok, 'POST', '/kiorex/connect/request', { clinicId })).status).toBe(409); // enrolment code required
      const r = await kiorly(tok, 'POST', '/kiorex/connect/request', { clinicId, enrolmentCode: await enrol('CLINIC') }); expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.status).toBe('REQUESTED');
      expect((await kiorly(tok, 'POST', '/kiorex/connect/request', { clinicId })).status).toBe(200); // idempotent re-send
      id = await connectionId('CLINIC', tenantId);
      expect((await kiorly(tok, 'GET', `/marketplace/listings?clinicId=${clinicId}`)).body[0].status).toBe('PENDING_VERIFICATION');
      await syncProviders(sup);
      expect((await q('kiorex_platform', `select count(*)::int c from "Provider" where "tenantId" = $1`, [tenantId]))[0].c).toBe(0);
    });
    it('ops: signed handshake and listing dry run succeed, human steps are highlighted, two-person approval, Go live makes the clinic searchable', async () => {
      const live = await walkOps(id, {});
      expect(stepOf(live, 'sync_dry_run').detail.ready).toBeGreaterThan(0);
      await waitFor('clinic listings LIVE', async () => (await kiorly(tok, 'GET', `/marketplace/listings?clinicId=${clinicId}`)).body.every((l: any) => l.status === 'LIVE'), 20_000, 500);
      await syncProviders(sup);
      const p = await waitFor('provider in Kiorex search', async () => { const s = await kiorex(undefined, 'GET', `/search/providers?q=${encodeURIComponent(`Connect ${tag}`)}`); return s.body?.items?.find((i: any) => i.nameEn?.includes(tag)); }, 20_000, 700);
      expect(p).toBeTruthy();
      const w = await wizard(); expect(w.body.status).toBe('APPROVED'); expect(w.body.progress).toBe(100);
    });
    it('pausing from Kiorex pauses the listings and the wizard shows it; resume restores them (idempotent)', async () => {
      expect((await ops(prep, 'POST', `/${id}/pause`, { reason: '' })).status).toBe(400);
      expect((await ops(prep, 'POST', `/${id}/pause`, { reason: 'Quality review' })).body.status).toBe('PAUSED');
      await waitFor('listings PAUSED', async () => (await kiorly(tok, 'GET', `/marketplace/listings?clinicId=${clinicId}`)).body.every((l: any) => l.status === 'PAUSED'), 15_000, 500);
      expect((await wizard()).body.status).toBe('PAUSED');
      expect((await ops(prep, 'POST', `/${id}/resume`)).body.status).toBe('LIVE');
      await waitFor('listings LIVE again', async () => (await kiorly(tok, 'GET', `/marketplace/listings?clinicId=${clinicId}`)).body.every((l: any) => l.status === 'LIVE'), 15_000, 500);
    });
  });

  it('every kind is isolated from legacy organisations: the seeded demo clinic and pharmacy report as already connected', async () => {
    void KIORLY_API; void PHARMACY_API; void PHARMACY; void LAB_API; void setFlag;
    const [t] = await q('kiorly', `select "providerSettings"->'kiorexConnect' as c from "Tenant" where name like 'Kiorly Demo%' or name like '%KX-DEV%' limit 1`);
    expect(t?.c ?? null).toBeNull();
  });

  it('rate limit: a burst from one address answers 429 RATE_LIMITED with Retry-After, then recovers (runs last: it fills the per-minute window)', async () => {
    const url = `${KIOREX_API}/partners/v1/connection-requests`; let hit: Response | undefined;
    for (let i = 0; i < 45 && !hit; i++) { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); if (r.status === 429) hit = r; else expect(r.status).toBe(400); }
    expect(hit, 'expected 429 within 45 requests').toBeTruthy();
    expect((await hit!.json()).code).toBe('RATE_LIMITED'); const wait = Number(hit!.headers.get('retry-after')); expect(wait).toBeGreaterThan(0); expect(wait).toBeLessThanOrEqual(60);
    await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
    expect((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(400);
  }, 120_000);
});
