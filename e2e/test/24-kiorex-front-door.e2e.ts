import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { KIOREX_API } from '../src/env.js';
import { kiorex, kiorly, opsLogin, q, waitFor } from '../src/clients.js';
import { purgeTenant } from '../src/db.js';
import { lab, pharmacy, rnd } from '../src/verticals.js';
import { newIntakeNonce } from '../src/intake.js';
import { createHash } from 'node:crypto';

/**
 * t. The state-aware front door of "Connect to Kiorex" (ADR-040 amendment) on the real stack: Clinic :3010, Pharmacy :3100, Lab :3200 and Kiorex :4000.
 * A standalone organisation of each product: state NOT_CONNECTED -> viewed (privacy-safe marker) -> started -> Talk to us creates ONE lead in Kiorex ops
 * (status follows the wizard), the funnel counts distinct organisations, the public lead endpoint is signed, validated, rate limited and answers one uniform 401.
 */
const tag = rnd().toLowerCase();
const LEAD_SECRET = process.env.KIOREX_LEAD_SIGNING_SECRET ?? 'kiorex-dev-lead-signing-secret';
const signed = (body: string, secret = LEAD_SECRET, ts = Math.floor(Date.now() / 1000)) => ({ 'content-type': 'application/json', 'X-Kiorly-Timestamp': String(ts), 'X-Kiorly-Signature': `sha256=${createHmac('sha256', createHash('sha256').update(secret).digest('hex')).update(`${ts}.${body}`).digest('hex')}` });
const postLead = (path: string, body: string, h = signed(body)) => fetch(`${KIOREX_API}/partners/v1/${path}`, { method: 'POST', headers: h, body });
const form = (o: Record<string, unknown> = {}) => ({ contactName: 'E2E Owner', contactRole: 'Owner', phone: '+201000009888', preferredTime: 'MORNING', note: 'Call after 10', consent: true, ...o });
let sup: string; const clinicTenants: string[] = [];

interface Org { kind: 'CLINIC' | 'PHARMACY' | 'LAB'; orgRef: string; door: () => Promise<any>; call: (path: string, body?: unknown) => Promise<{ status: number; body: any }> }
const orgs: Org[] = [];
const leadsOf = async (orgRef: string) => ((await kiorex(sup, 'GET', '/admin/partner-leads')).body as any[]).filter((l) => l.orgRef === orgRef);
const funnel = async (kind: string) => (await kiorex(sup, 'GET', `/admin/partner-leads/funnel?days=30&kind=${kind}`)).body;
const count = (f: any, s: string) => f.stages.find((x: any) => x.stage === s).count as number;

describe('t. Front door of Connect to Kiorex: lead capture and funnel (ADR-040)', () => {
  beforeAll(async () => {
    sup = (await opsLogin()).accessToken;
    await q('kiorex_platform', `delete from "RateLimitBucket" where key like 'lfail:%' or key like 'llead:%' or key like 'lfunnel:%' or key like 'lead-org:%'`, []); // a previous run must not pre-block this address
    // Pharmacy
    const email = `e2e-door-ph-${tag}@example.com`;
    expect((await pharmacy(undefined, 'POST', '/onboarding/signup', { pharmacyName: `E2E Door Pharmacy ${tag}`, ownerName: 'E2E Owner', email, password: 'Demo@12345', branchName: 'Main' })).status).toBeLessThan(300);
    const ptok = (await pharmacy(undefined, 'POST', '/auth/login', { email, password: 'Demo@12345' })).body.accessToken;
    const [{ id: pid }] = await q('kiorly_pharmacy', `select id from "Tenant" where name = $1`, [`E2E Door Pharmacy ${tag}`]);
    orgs.push({ kind: 'PHARMACY', orgRef: pid, door: async () => (await pharmacy(ptok, 'GET', '/kiorex-connect/front-door')).body, call: (p, b) => pharmacy(ptok, 'POST', `/kiorex-connect/front-door/${p}`, b ?? {}) });
    // Lab
    const lemail = `e2e-door-lab-${tag}@example.com`;
    const o = await lab(undefined, 'POST', '/onboarding/tenants', { name: `E2E Door Lab ${tag}`, slug: `e2e-door-${tag}`, labName: 'Main lab', labCode: 'ED1', ownerName: 'E2E Owner', ownerEmail: lemail, loadStarterCatalogue: true });
    expect(o.status, JSON.stringify(o.body)).toBe(201);
    orgs.push({ kind: 'LAB', orgRef: o.body.tenantId, door: async () => (await lab(o.body.token, 'GET', '/kiorex-connect/front-door')).body, call: (p, b) => lab(o.body.token, 'POST', `/kiorex-connect/front-door/${p}`, b ?? {}) });
    // Clinic (self-serve sign-up starts standalone)
    const phone = `+20109${String(Date.now()).slice(-7)}`; const cemail = `e2e-door-clinic-${tag}@example.com`;
    expect((await kiorly(undefined, 'POST', '/public/signup/otp', { phone, market: 'EG' })).status).toBe(200);
    const v = await kiorly(undefined, 'POST', '/public/signup/verify', { phone, code: '424242', market: 'EG' });
    const docs = ['terms_of_service', 'subscription_terms', 'kiorex_marketplace_fees', 'dpa', 'patient_privacy_notice', 'acceptable_use', 'refund_policy'];
    const legalAcceptances = await Promise.all(docs.map(async (d) => ({ document: d, version: (await kiorly(undefined, 'GET', `/public/legal/${d}`)).body?.version ?? '2026-11-18' })));
    const done = await kiorly(undefined, 'POST', '/public/signup/complete', { signupToken: v.body.signupToken, profile: { displayName: `Dr Door ${tag}`, email: cemail, password: 'demopass8' }, specialty: 'GENERAL_MEDICINE', clinic: { nameEn: `E2E Door Clinic ${tag}`, nameAr: `عيادة الباب ${tag}`, city: 'Cairo', addressEn: '1 Test St, Cairo', addressAr: '١ شارع الاختبار، القاهرة', locationUrl: 'https://maps.example/o' }, planKey: 'LITE', legalAcceptances });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    const ctok = done.body.accessToken; const [{ tenantId }] = await q('kiorly', `select "tenantId" from "User" where email = $1`, [cemail]); clinicTenants.push(tenantId);
    const clinicId = (await kiorly(ctok, 'GET', '/clinics')).body[0].id;
    orgs.push({ kind: 'CLINIC', orgRef: tenantId, door: async () => (await kiorly(ctok, 'GET', `/kiorex/front-door?clinicId=${clinicId}`)).body, call: (p, b) => kiorly(ctok, 'POST', `/kiorex/front-door/${p}`, { clinicId, ...(b as object) }) });
  }, 120_000);
  afterAll(async () => {
    for (const t of clinicTenants) await purgeTenant('kiorly', t);
    for (const [db, table] of [['kiorly_pharmacy', 'Tenant'], ['kiorly_lab', 'Tenant']] as const) for (const t of await q(db, `select id from "${table}" where name like $1`, [`E2E Door %${tag}`])) await purgeTenant(db, t.id);
    for (const o of orgs) { await q('kiorex_platform', `delete from "PartnerLead" where "orgRef" = $1`, [o.orgRef]); await q('kiorex_platform', `delete from "PartnerFunnelMark" where "orgRef" = $1`, [o.orgRef]); }
  });

  for (const kind of ['CLINIC', 'PHARMACY', 'LAB'] as const) {
    it(`${kind}: a standalone organisation sees the landing state, a viewed marker, then started, then Talk to us creates one lead`, async () => {
      const o = orgs.find((x) => x.kind === kind)!; const before = await funnel(kind);
      expect((await o.door()).state).toBe('NOT_CONNECTED');
      expect((await o.call('interest')).body.sent).toBe(true);
      expect((await o.call('interest')).body.sent).toBe(false); // once per organisation
      await waitFor('INTERESTED marker', async () => (await q('kiorex_platform', `select 1 from "PartnerFunnelMark" where kind = $1 and "orgRef" = $2 and stage = 'INTERESTED'`, [kind, o.orgRef])).length > 0);
      // validation: consent and a way to reach the person are required; nothing is sent
      expect((await o.call('talk', form({ consent: false }))).status).toBe(400);
      expect((await o.call('talk', form({ phone: undefined, email: undefined }))).status).toBe(400);
      expect(await leadsOf(o.orgRef)).toHaveLength(0);
      const started = await o.call('start'); expect(started.status, JSON.stringify(started.body)).toBe(200); expect(started.body.state).toBe('IN_PROGRESS');
      await waitFor('STARTED marker', async () => (await q('kiorex_platform', `select 1 from "PartnerFunnelMark" where kind = $1 and "orgRef" = $2 and stage = 'STARTED'`, [kind, o.orgRef])).length > 0);
      const talk = await o.call('talk', form()); expect(talk.status, JSON.stringify(talk.body)).toBe(200); expect(talk.body.leadAt).toBeTruthy();
      let leads = await leadsOf(o.orgRef); expect(leads).toHaveLength(1);
      expect(leads[0]).toMatchObject({ kind, contactName: 'E2E Owner', preferredTime: 'MORNING', status: 'STARTED', connectionId: null }); // the wizard was started: the lead says so
      expect((await o.call('talk', form({ contactName: 'E2E Owner Two' }))).status).toBe(200);
      leads = await leadsOf(o.orgRef); expect(leads).toHaveLength(1); expect(leads[0].contactName).toBe('E2E Owner Two'); // one lead per organisation
      const after = await funnel(kind);
      expect(count(after, 'interested') - count(before, 'interested')).toBe(1);
      expect(count(after, 'started') - count(before, 'started')).toBe(1);
      expect(count(after, 'submitted')).toBe(count(before, 'submitted'));
    });
  }

  it('the public lead endpoint: signed, strict, rate limited, uniform 401, no PHI fields accepted', async () => {
    await new Promise((r) => setTimeout(r, 60_500 - (Date.now() % 60_000))); // fixed rate-limit windows: start of a fresh minute
    await q('kiorex_platform', `delete from "RateLimitBucket" where key like 'lfail:%' or key like 'llead:%' or key like 'lead-org:%'`, []); // earlier runs/tests of this file must not pre-block this address
    const body = (o: Record<string, unknown> = {}) => JSON.stringify({ nonce: newIntakeNonce(), kind: 'CLINIC', orgRef: `e2e-door-x-${tag}-${Math.random().toString(36).slice(2, 6)}`, orgName: 'Door X', contactName: 'X', phone: '+201000009777', locale: 'en', market: 'EG', consent: true, ...o });
    const bad = await Promise.all([body(), body(), body()].map(async (b, i) => (await postLead('leads', b, i === 0 ? signed(b, 'wrong-secret') : i === 1 ? signed(b, LEAD_SECRET, Math.floor(Date.now() / 1000) - 3600) : { 'content-type': 'application/json' })).text()));
    expect(new Set(bad).size).toBe(1); expect(JSON.parse(bad[0]!).code).toBe('LEAD_UNAUTHORIZED');
    const ok = body(); expect((await postLead('leads', ok)).status).toBe(200);
    expect((await postLead('leads', ok)).status).toBe(401); // replayed nonce
    const phi = body({ patientName: 'Somebody' }); expect((await postLead('leads', phi)).status).toBe(400);
    expect((await postLead('leads', body({ consent: false }))).status).toBe(400);
    expect((await postLead('funnel', JSON.stringify({ nonce: newIntakeNonce(), kind: 'CLINIC', orgRef: `e2e-door-y-${tag}`, stage: 'LIVE' }))).status).toBe(400);
    // per-IP limit: a burst is refused with 429 and Retry-After, the refused hit is not counted
    let limited: Response | undefined; for (let i = 0; i < 14 && !limited; i++) { const r = await postLead('leads', body()); if (r.status === 429) limited = r; }
    expect(limited, 'a burst of leads from one address must hit the rate limit').toBeTruthy(); expect(Number(limited!.headers.get('retry-after'))).toBeGreaterThan(0);
    await q('kiorex_platform', `delete from "PartnerLead" where "orgRef" like $1`, [`e2e-door-x-${tag}%`]); await q('kiorex_platform', `delete from "PartnerFunnelMark" where "orgRef" like $1`, [`e2e-door-x-${tag}%`]);
  }, 150_000);

  it('ops can set status, assignee and a note on a lead (and the funnel page API answers for every kind)', async () => {
    const o = orgs[0]!; const [l] = await leadsOf(o.orgRef);
    const p = await kiorex(sup, 'PATCH', `/admin/partner-leads/${l.id}`, { status: 'CONTACTED', assignee: 'sara' }); expect(p.status).toBe(200); expect(p.body).toMatchObject({ assignee: 'sara' });
    expect((await kiorex(sup, 'POST', `/admin/partner-leads/${l.id}/notes`, { text: 'Spoke to the owner' })).body.notes).toHaveLength(1);
    for (const k of ['CLINIC', 'NURSE', 'PHARMACY', 'LAB']) expect((await kiorex(sup, 'GET', `/admin/partner-leads/funnel?days=30&kind=${k}`)).status).toBe(200);
  });
});
