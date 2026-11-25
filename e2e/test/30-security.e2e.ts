import { createHash, createHmac, createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { KIORLY, KIOREX, PHARMACY, LAB, PASSPORT, PATIENT_1 } from '../src/env.js';
import { kiorex, kiorly, patientLogin, q, staffLogin, syncProviders, waitFor } from '../src/clients.js';
import { book, hold, freeSlots, kiorlyAppointmentFor, providerBySpecialty, tokens, type Provider } from '../src/fixtures.js';
import { decodeJwt } from '../src/passport.js';
import { growthRoutes } from '../src/growth-p3.js';

/**
 * PENTEST 2026-11 security regression suite (_docs/security/PENTEST_2026-11_REPORT.md).
 *
 * Runs ONLY against the throw-away stack from `scripts/sec-stack.sh up --prod` (production-mode boot of every API on sec_* database clones, ports
 * 4300-4303). Destructive on purpose (races, restore abuse, throttles); never run it against the shared dev stack:
 *   npm run test:security
 * It asserts: production boots refuse dev features, headers/CORS/docs, JWT forgery, Passport OIDC hardening, marketplace HMAC, IDOR, money races,
 * partial-refund math, the org-backup restore exploit (KX-PT-01), login throttling and X-Forwarded-For spoofing, SSRF on tenant webhooks.
 */
const ON = !!process.env.E2E_SEC_STACK;
const b64 = (o: unknown) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const sha = (s?: string) => createHash('sha256').update(s ?? '').digest('hex');
const get = async (url: string, headers: Record<string, string> = {}) => { const r = await fetch(url, { headers, redirect: 'manual' }); return { status: r.status, headers: r.headers, text: await r.text() }; };

describe.skipIf(!ON)('30. security (production-mode boot, throw-away databases)', () => {
  let t: Awaited<ReturnType<typeof tokens>>;
  beforeAll(async () => { t = await tokens(); });

  describe('a. production boot refuses dev features and exposes nothing extra', () => {
    it('Kiorex: dev inbox / payment simulators / whatsapp conversation / swagger are gone', async () => {
      for (const p of ['/api/v1/dev/messaging/outbox', '/api/v1/dev/payments', '/api/v1/dev/channels/whatsapp/conversation?phone=%2B201000000001']) expect((await get(KIOREX + p)).status, p).toBe(404);
      expect((await kiorex(undefined, 'POST', '/dev/messaging/inbound', { channel: 'WHATSAPP', from: '+201000000001', text: 'hi' })).status).toBe(404);
      expect((await get(KIOREX + '/api/docs')).status).toBe(404);
      expect((await get(KIOREX + '/api/docs-json')).status).toBe(404);
    });
    it('Clinic: dev inbox, swagger, fixed signup OTP and dev reset links are off even though the env tries to enable them', async () => {
      for (const p of ['/api/v1/dev/inbox', '/api/v1/dev/inbox/status', '/docs', '/docs-json']) expect((await get(KIORLY + p)).status, p).toBe(404);
      const r = await fetch(`${KIORLY}/api/v1/auth/password/forgot`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner.na@demo.kiorex.test' }) });
      const body = (await r.json()) as Record<string, unknown>;
      expect(JSON.stringify(body)).not.toMatch(/devResetLink|reset-password\?token/);
    });
    it('Pharmacy / Lab: dev provider tools, dev login and swagger are refused', async () => {
      expect([401, 404]).toContain((await get(PHARMACY + '/api/v1/dev/providers/status')).status);
      expect([401, 404]).toContain((await get(LAB + '/api/v1/dev/inbox')).status);
      expect([403, 404]).toContain((await get(LAB + '/api/v1/auth/dev/orgs')).status);
      const dl = await fetch(`${LAB}/api/v1/auth/dev-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orgSlug: 'demo-lab', email: 'director@demo-lab.test' }) });
      expect([403, 404]).toContain(dl.status);
      for (const base of [PHARMACY, LAB]) { expect((await get(base + '/docs')).status, base).toBe(404); expect((await get(base + '/docs-json')).status).toBe(404); }
    });
  });

  describe('b. headers, CORS, information disclosure', () => {
    it('every API sends nosniff / frame-ancestors none / HSTS and no X-Powered-By', async () => {
      for (const base of [KIOREX, KIORLY, PHARMACY, LAB]) {
        const r = await get(base + '/api/v1/health/live');
        expect(r.headers.get('x-content-type-options'), base).toBe('nosniff');
        expect(r.headers.get('x-frame-options'), base).toBe('DENY');
        expect(r.headers.get('content-security-policy') ?? '').toContain("frame-ancestors 'none'");
        expect(r.headers.get('strict-transport-security') ?? '').toContain('max-age=');
        expect(r.headers.get('x-powered-by'), base).toBeNull();
      }
    });
    it('Kiorex CORS does not reflect an arbitrary origin, and never with credentials', async () => {
      const r = await get(KIOREX + '/api/v1/health/live', { origin: 'https://evil.example' });
      expect(r.headers.get('access-control-allow-origin')).toBeNull();
      expect(r.headers.get('access-control-allow-credentials')).toBeNull();
      const pre = await fetch(KIOREX + '/api/v1/bookings', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
      expect(pre.headers.get('access-control-allow-origin')).toBeNull();
    });
    it('Clinic never allows credentialed cross-origin requests (bearer-only API)', async () => {
      const r = await get(KIORLY + '/api/v1/health/live', { origin: 'https://evil.example' });
      expect(r.headers.get('access-control-allow-credentials')).toBeNull();
    });
    it('errors do not leak stack traces or file paths; unknown routes are generic', async () => {
      for (const [base, p] of [[KIOREX, '/api/v1/bookings/%00'], [KIORLY, '/api/v1/patients/%00'], [PHARMACY, '/api/v1/patients/%00'], [LAB, '/api/v1/orders/%00']] as const) {
        const r = await get(base + p, { authorization: 'Bearer x' });
        expect(r.text, base).not.toMatch(/at .*\(.*\.(ts|js):\d+|node_modules|\/Users\//);
      }
    });
  });

  describe('c. token validation (alg none, key confusion, tampering, expiry, audience)', () => {
    it('forged and tampered access tokens are refused by all four APIs', async () => {
      const l = await patientLogin(PATIENT_1); const [h, , sig] = l.accessToken.split('.'); const hdr = JSON.parse(Buffer.from(h, 'base64url').toString()); const pl = decodeJwt(l.accessToken);
      const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const rs = (hh: object, pp: object) => { const s = createSign('RSA-SHA256'); const i = `${b64(hh)}.${b64(pp)}`; s.update(i); return `${i}.${s.sign(privateKey).toString('base64url')}`; };
      const jwks = await (await fetch(`${PASSPORT}/jwks`)).text();
      const forged: Record<string, string> = {
        none: `${b64({ alg: 'none', typ: 'JWT' })}.${b64(pl)}.`,
        hs256WithPublicKey: `${b64({ alg: 'HS256', typ: 'JWT', kid: hdr.kid })}.${b64(pl)}.` + createHmac('sha256', jwks).update(`${b64({ alg: 'HS256', typ: 'JWT', kid: hdr.kid })}.${b64(pl)}`).digest('base64url'),
        attackerKey: rs({ alg: 'RS256', typ: 'JWT', kid: hdr.kid }, pl),
        attackerKeyElevated: rs({ alg: 'RS256', typ: 'JWT', kid: hdr.kid }, { ...pl, kx_roles: ['super_admin', 'ops_admin'] }),
        tamperedPayload: `${h}.${b64({ ...pl, kx_roles: ['super_admin'] })}.${sig}`,
        expired: `${h}.${b64({ ...pl, exp: pl.exp - 99999, iat: pl.iat - 99999 })}.${sig}`,
        wrongAudience: `${h}.${b64({ ...pl, aud: 'someone-else' })}.${sig}`,
      };
      for (const [k, tok] of Object.entries(forged)) {
        for (const [name, url] of Object.entries({ kiorex: `${KIOREX}/api/v1/auth/me`, clinic: `${KIORLY}/api/v1/auth/me`, pharmacy: `${PHARMACY}/api/v1/auth/me`, lab: `${LAB}/api/v1/auth/me` })) {
          expect((await fetch(url, { headers: { authorization: `Bearer ${tok}` } })).status, `${k} on ${name}`).toBe(401);
        }
      }
    });
    it('a Kiorex patient token is not accepted by the Clinic, Pharmacy or Lab APIs', async () => {
      const l = await patientLogin(PATIENT_1);
      for (const url of [`${KIORLY}/api/v1/auth/me`, `${PHARMACY}/api/v1/auth/me`, `${LAB}/api/v1/auth/me`]) expect((await fetch(url, { headers: { authorization: `Bearer ${l.accessToken}` } })).status).toBe(401);
    });
  });

  describe('d. Passport OIDC hardening (authorization endpoint of the dev IdP)', () => {
    const chal = createHash('sha256').update('v'.repeat(43)).digest('base64url');
    const auth = async (extra: Record<string, string>) => fetch(`${PASSPORT}/auth?${new URLSearchParams({ client_id: 'kiorex-web', response_type: 'code', scope: 'openid profile phone kx', state: 's', redirect_uri: 'http://localhost:5180/auth/callback', code_challenge: chal, code_challenge_method: 'S256', ...extra })}`, { redirect: 'manual' });
    it('PKCE is mandatory and S256 only', async () => {
      const noPkce = await fetch(`${PASSPORT}/auth?${new URLSearchParams({ client_id: 'kiorex-web', response_type: 'code', scope: 'openid', state: 's', redirect_uri: 'http://localhost:5180/auth/callback' })}`, { redirect: 'manual' });
      expect(noPkce.headers.get('location') ?? '').toContain('error=invalid_request');
      expect((await auth({ code_challenge_method: 'plain' })).headers.get('location') ?? '').toContain('error=invalid_request');
    });
    it('redirect_uri must match exactly (path traversal, suffix host, extra query, other host)', async () => {
      for (const ru of ['http://localhost:5180/auth/callback/../evil', 'http://localhost:5180/auth/callback?x=1', 'http://localhost:5180.evil.com/auth/callback', 'http://evil.com/auth/callback', 'http://localhost:5180/auth/callbackX']) expect((await auth({ redirect_uri: ru })).status, ru).toBe(400);
    });
    it('implicit / token response types are refused and refresh-token reuse is rejected', async () => {
      expect((await auth({ response_type: 'token' })).headers.get('location') ?? '').toMatch(/error=/);
      expect((await auth({ response_type: 'id_token', nonce: 'n' })).headers.get('location') ?? '').toMatch(/error=/);
      const l = await (await import('../src/passport.js')).loginWithPhone(PATIENT_1);
      const tok = (rt: string) => fetch(`${PASSPORT}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rt, client_id: 'kiorex-web' }) });
      const first = await tok(l.refreshToken!); expect(first.status).toBe(200);
      expect((await tok(l.refreshToken!)).status).toBe(400); // the rotated-out token is dead
    });
  });

  describe('e. marketplace HMAC (Kiorex -> Clinic): replay, skew, tampering, missing parts', () => {
    const MKT = `${KIORLY}/marketplace/v1`;
    const call = async (o: { nonce?: string; ts?: string; secret?: string; signWith?: string; signPath?: string; omit?: string[] }) => {
      const url = new URL(MKT + '/clinics'); const ts = o.ts ?? String(Date.now()), nonce = o.nonce ?? randomUUID();
      const sig = createHmac('sha256', o.signWith ?? 'kx_dev_secret_change_me').update(`${ts}\n${nonce}\nGET\n${o.signPath ?? url.pathname}\n${sha()}`).digest('base64url');
      const h: Record<string, string> = { 'x-kiorly-client-key': 'kx_dev_client', 'x-kiorly-client-secret': o.secret ?? 'kx_dev_secret_change_me', 'x-kiorly-timestamp': ts, 'x-kiorly-nonce': nonce, 'x-kiorly-signature': sig };
      for (const k of o.omit ?? []) delete h[k];
      return (await fetch(url, { headers: h })).status;
    };
    it('accepts one valid call and refuses every replay / forgery', async () => {
      const n = randomUUID();
      expect(await call({ nonce: n })).toBe(200);
      expect(await call({ nonce: n })).toBe(401); // replayed nonce
      expect(await call({ ts: String(Date.now() - 600_000) })).toBe(401);
      expect(await call({ ts: String(Date.now() + 600_000) })).toBe(401);
      expect(await call({ ts: 'NaN' })).toBe(401);
      expect(await call({ secret: 'wrong' })).toBe(401);
      expect(await call({ signWith: 'other-secret' })).toBe(401);
      expect(await call({ signPath: '/marketplace/v1/providers' })).toBe(401);
      for (const h of ['x-kiorly-signature', 'x-kiorly-client-secret', 'x-kiorly-nonce', 'x-kiorly-timestamp', 'x-kiorly-client-key']) expect(await call({ omit: [h] }), `without ${h}`).toBe(401);
    });
    it('webhook into Kiorex: bad signature, stale timestamp and a signature-less request are refused', async () => {
      const raw = JSON.stringify({ type: 'appointment.updated', id: randomUUID(), data: {} }); const ts = String(Math.floor(Date.now() / 1000));
      const good = `sha256=${createHmac('sha256', 'kx_dev_webhook_secret').update(`${ts}.${raw}`).digest('hex')}`;
      const post = (h: Record<string, string>) => fetch(`${KIOREX}/api/v1/webhooks/kiorly`, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: raw }).then((r) => r.status);
      expect(await post({ 'x-kiorly-timestamp': ts, 'x-kiorly-signature': 'sha256=' + '0'.repeat(64) })).toBe(401);
      expect(await post({ 'x-kiorly-timestamp': ts })).toBe(401);
      expect(await post({ 'x-kiorly-timestamp': String(Number(ts) - 3600), 'x-kiorly-signature': `sha256=${createHmac('sha256', 'kx_dev_webhook_secret').update(`${Number(ts) - 3600}.${raw}`).digest('hex')}` })).toBe(401);
      expect(await post({ 'x-kiorly-timestamp': ts, 'x-kiorly-signature': good.replace(/.$/, (c) => (c === '0' ? '1' : '0')) })).toBe(401);
    });
  });

  describe('f. authorization: anonymous, wrong-role and cross-patient access', () => {
    let p: Provider; let bookingId: string;
    beforeAll(async () => { p = await providerBySpecialty(t.p1, 'paediatrics'); bookingId = (await book(t.p1, p)).id; });
    afterAll(async () => { await kiorex(t.p1, 'POST', `/bookings/${bookingId}/cancel`, {}).catch(() => undefined); });
    it('another patient and anonymous callers cannot read, confirm, cancel or pay for a booking', async () => {
      expect((await kiorex(t.p2, 'GET', `/bookings/${bookingId}`)).status).toBe(404);
      expect((await kiorex(undefined, 'GET', `/bookings/${bookingId}`)).status).toBe(401);
      expect((await kiorex(t.p2, 'POST', `/bookings/${bookingId}/cancel`, {})).status).toBeGreaterThanOrEqual(403);
      expect((await kiorex(t.p2, 'POST', `/bookings/${bookingId}/deposit-checkout`)).status).toBeGreaterThanOrEqual(403);
      expect((await kiorex(t.p2, 'GET', `/bookings/${bookingId}/messages`)).status).not.toBe(200);
      expect((await kiorex(t.p1, 'GET', `/bookings/${bookingId}`)).status).toBe(200);
    });
    it('a patient token never reaches ops / admin / control-plane routes', async () => {
      for (const p of ['/admin/flags/products/kiorly-clinic', '/admin/payments/dashboard', '/ops/growth/overview', '/admin/onboarding/partners', '/admin/onboarding/enrolments', '/ops/growth/config']) expect([401, 403, 404], p).toContain((await kiorex(t.p1, 'GET', p)).status);
      expect((await kiorex(t.p1, 'POST', '/admin/payments/refund', { paymentId: 'x', reason: 'abc' })).status).toBe(403);
      expect((await kiorex(undefined, 'GET', '/admin/payments/dashboard')).status).toBe(401);
    });
    it('clinic staff of one tenant cannot read another tenant (cross-tenant ids, anonymous, forged tenantId)', async () => {
      const na = await staffLogin('owner.na@demo.kiorex.test', 'Demo@12345'); const df = await staffLogin('owner.df@demo.kiorex.test', 'Demo@12345');
      const mine = await kiorly(na, 'GET', '/patients?pageSize=5'); expect(mine.status).toBe(200);
      const first = (mine.body.items ?? mine.body.data ?? mine.body)[0]; expect(first?.id).toBeTruthy();
      expect((await kiorly(df, 'GET', `/patients/${first.id}`)).status).toBe(404);
      expect((await kiorly(df, 'GET', `/patients/${first.id}/timeline`)).body?.items?.length ?? 0).toBe(0);
      expect((await kiorly(undefined, 'GET', `/patients/${first.id}`)).status).toBe(401);
      const apts = await kiorly(na, 'GET', '/appointments?pageSize=3'); const a = (apts.body.items ?? apts.body.data ?? apts.body)[0];
      if (a?.id) expect((await kiorly(df, 'PATCH', `/appointments/${a.id}/status`, { status: 'CANCELLED', cancellationReason: 'x' })).status).toBeGreaterThanOrEqual(403);
    });
  });

  describe('g. races: holds, idempotent confirm, deposit capture, refund', () => {
    let p: Provider; let typeIds: string[] = []; let clinicId = '';
    beforeAll(async () => { p = await providerBySpecialty(t.p1, 'paediatrics'); });
    afterAll(async () => { if (typeIds.length) { await q('kiorly', `update "AppointmentType" set "depositAmount" = null where id = any($1)`, [typeIds]); } });
    it('12 parallel holds on one slot create exactly one hold', async () => {
      const slots = await freeSlots(t.p1, p, 12, { fresh: true }); const slot = slots[Math.floor(slots.length / 3)];
      const rs = await Promise.all(Array.from({ length: 12 }, (_, i) => hold(i % 2 ? t.p1 : t.p2, p, slot)));
      expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
      expect(rs.filter((r) => r.status === 409).length).toBe(11);
      const w = rs.find((r) => r.status === 201)!; const owner = rs.indexOf(w) % 2 ? t.p1 : t.p2;
      // parallel confirms, same key and different keys: one booking, one Kiorly appointment
      const same = await Promise.all(Array.from({ length: 6 }, () => kiorex(owner, 'POST', `/bookings/${w.body.id}/confirm`, { marketplaceConsent: true, remindersConsent: true }, { 'Idempotency-Key': 'sec-same' })));
      expect(same.map((r) => `${r.status}${r.status === 200 ? '' : ' ' + JSON.stringify(r.body).slice(0, 120)}`), 'six parallel confirms with ONE idempotency key all answer 200 (the first does the work, the rest replay it)').toEqual(Array(6).fill('200'));
      await Promise.all(Array.from({ length: 4 }, (_, i) => kiorex(owner, 'POST', `/bookings/${w.body.id}/confirm`, { marketplaceConsent: true, remindersConsent: true }, { 'Idempotency-Key': 'sec-diff-' + i })));
      await waitFor('kiorly appointment', async () => (await q('kiorly', `select 1 from "Appointment" where "externalReference" = $1`, [w.body.id]))[0]);
      expect(await q('kiorly', `select 1 from "Appointment" where "externalReference" = $1`, [w.body.id])).toHaveLength(1);
      await Promise.all(Array.from({ length: 4 }, () => kiorex(owner, 'POST', `/bookings/${w.body.id}/cancel`, {})));
      expect((await kiorex(owner, 'GET', `/bookings/${w.body.id}`)).body.status).toBe('CANCELLED');
    });
    it('parallel capture + parallel cancel: one capture, exactly one full refund, replayed completion is inert', async () => {
      const apt0 = await kiorlyAppointmentFor((await book(t.p1, p)).id); clinicId = apt0.clinicId;
      typeIds = (await q('kiorly', `update "AppointmentType" set "depositAmount" = 150 where "clinicId" = $1 and "marketplaceBookable" returning id`, [clinicId])).map((r: { id: string }) => r.id);
      await q('kiorly', `update "MarketplaceListing" set "updatedAt" = (now() at time zone 'utc') + interval '1 second' where "clinicId" = $1`, [clinicId]); await syncProviders(t.ops);
      const b = await book(t.p1, p); const co = await kiorex(t.p1, 'POST', `/bookings/${b.id}/deposit-checkout`); const pid = co.body.paymentId as string;
      await Promise.all(Array.from({ length: 10 }, () => kiorex(undefined, 'POST', `/pay/fake-checkout/${pid}/complete`, { outcome: 'pay' })));
      await waitFor('PAID', async () => (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.depositStatus === 'PAID');
      await Promise.all(Array.from({ length: 8 }, () => kiorex(t.p1, 'POST', `/bookings/${b.id}/cancel`, { reason: 'race' })));
      await waitFor('REFUNDED', async () => (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.depositStatus === 'REFUNDED');
      expect(await q('kiorex_platform', `select "amountMinor" from "Refund" where "paymentId" = $1`, [pid])).toEqual([{ amountMinor: 15000 }]);
      await kiorex(undefined, 'POST', `/pay/fake-checkout/${pid}/complete`, { outcome: 'pay' });
      expect((await q('kiorex_platform', `select status, "refundedMinor" from "PaymentIntent" where id = $1`, [pid]))[0]).toMatchObject({ status: 'REFUNDED', refundedMinor: 15000 });
    });
    it('ops partial refunds: bad amounts are rejected, parallel refunds can never exceed what was captured', async () => {
      const b = await book(t.p1, p); const pid = (await kiorex(t.p1, 'POST', `/bookings/${b.id}/deposit-checkout`)).body.paymentId as string;
      await kiorex(undefined, 'POST', `/pay/fake-checkout/${pid}/complete`, { outcome: 'pay' });
      await waitFor('PAID', async () => (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.depositStatus === 'PAID');
      for (const amountMinor of [-100, 0, 0.5, 1.5, '100', 'NaN', 1e21, Number.MAX_SAFE_INTEGER, 15001]) expect((await kiorex(t.ops, 'POST', '/admin/payments/refund', { paymentId: pid, amountMinor, reason: 'abuse test' })).status, String(amountMinor)).toBeGreaterThanOrEqual(400);
      const par = await Promise.all(Array.from({ length: 8 }, (_, i) => kiorex(t.ops, 'POST', '/admin/payments/refund', { paymentId: pid, amountMinor: 5000, reason: 'parallel ' + i })));
      expect(par.filter((r) => r.status === 200).length).toBeLessThanOrEqual(3);
      const row = (await q('kiorex_platform', `select "amountMinor", "refundedMinor" from "PaymentIntent" where id = $1`, [pid]))[0];
      expect(row.refundedMinor).toBeLessThanOrEqual(row.amountMinor);
      expect(row.refundedMinor % 5000).toBe(0);
    });
  });

  describe('h. KX-PT-01 organization backup restore cannot cross tenants (Critical)', () => {
    const upload = async (tok: string, sql: string) => { const fd = new FormData(); fd.append('file', new Blob([sql], { type: 'application/sql' }), 'evil.sql'); return fetch(`${KIORLY}/api/v1/admin/data-explorer/import`, { method: 'POST', headers: { authorization: `Bearer ${tok}` }, body: fd }); };
    it('ON CONFLICT DO UPDATE / INSERT..SELECT / Tenant / FeatureFlag / cross-tenant rows never execute', async () => {
      await q('kiorly', `update "Subscription" set "planId" = (select id from "Plan" where key = 'CLINIC') where "tenantId" in ('demo_t_na','demo_t_df')`);
      const attacker = await staffLogin('owner.na@demo.kiorex.test', 'Demo@12345');
      const bcrypt = (await import('node:crypto')).scryptSync; void bcrypt;
      const evilHash = '$2b$10$ddXgvmEVsQCgeK94hKf92u1hwaUDa9eY64ULbM8nTYXEsrY.jyJjK'; // not a hash of the attacker password: the takeover must fail for a different reason than a bad hash
      const sql = [
        `INSERT INTO "User"("id","tenantId","email","passwordHash","displayName","role","updatedAt") VALUES ('demo_u_df_owner','demo_t_na','owner.df@demo.kiorex.test','${evilHash}','pwn','GROUP_ADMIN',now()) ON CONFLICT (id) DO UPDATE SET "passwordHash"=EXCLUDED."passwordHash";`,
        `INSERT INTO "Patient"("id","tenantId","name") SELECT id,'demo_t_na',"passwordHash" FROM "User";`,
        `INSERT INTO "Patient"("id","tenantId","nameEn") VALUES ('sec_x_patient','demo_t_df','planted');`,
        `INSERT INTO "FeatureFlag"("key") VALUES ('sec.planted');`,
        `INSERT INTO "Tenant"("id") VALUES ('demo_t_na');`,
        `INSERT INTO "Patient"("id","tenantId","nameEn") VALUES ('sec_y_patient','demo_t_na',(SELECT "passwordHash" FROM "User" LIMIT 1));`,
        '',
      ].join('\n');
      const before = (await q('kiorly', `select "passwordHash" from "User" where id = 'demo_u_df_owner'`))[0].passwordHash;
      const t0 = ((await q('kiorly', `select (now() at time zone 'utc') as t`))[0].t as Date).toISOString(); // an ISO string: the driver would shift a Date into local time for a timestamp-without-zone column; // the job of THIS upload, not one a run a few seconds earlier left (a second run within a minute matched that one and read the new job before it finished)
      const r = await upload(attacker, sql); expect(r.status).toBeLessThan(300);
      await waitFor('import job finished', async () => (await q('kiorly', `select 1 from "TenantExportJob" where scope = 'ORG_IMPORT' and status in ('READY','FAILED') and "createdAt" >= $1::timestamp and "rowCounts" is not null limit 1`, [t0]))[0], 30_000);
      expect((await q('kiorly', `select "passwordHash" from "User" where id = 'demo_u_df_owner'`))[0].passwordHash).toBe(before);
      expect(await q('kiorly', `select 1 from "Patient" where id in ('sec_x_patient','sec_y_patient')`)).toHaveLength(0);
      expect(await q('kiorly', `select 1 from "FeatureFlag" where key = 'sec.planted'`)).toHaveLength(0);
      const job = (await q('kiorly', `select "rowCounts" from "TenantExportJob" where scope = 'ORG_IMPORT' order by "createdAt" desc limit 1`))[0];
      expect(job.rowCounts.sqlStatements).toBe(0);
      expect(job.rowCounts.sqlRejected).toBeGreaterThanOrEqual(5);
    });
  });

  describe('i. login abuse: forged X-Forwarded-For does not buy more guesses; unknown users are not distinguishable by status', () => {
    it('rotating X-Forwarded-For for one e-mail is throttled per account', async () => {
      const email = `nobody-${randomUUID().slice(0, 8)}@example.com`; const codes: number[] = [];
      for (let i = 0; i < 26; i++) codes.push((await fetch(`${KIORLY}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${i + 1}` }, body: JSON.stringify({ email, password: 'wrong-' + i }) })).status);
      expect(codes.slice(0, 20).every((c) => c === 401)).toBe(true);
      expect(codes.slice(21).every((c) => c === 429)).toBe(true);
    });
    it('unknown and known e-mails get the same status and body on a wrong password', async () => {
      const a = await fetch(`${KIORLY}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner.na@demo.kiorex.test', password: 'wrong-password' }) });
      const b = await fetch(`${KIORLY}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `ghost-${randomUUID().slice(0, 6)}@example.com`, password: 'wrong-password' }) });
      expect(a.status).toBe(b.status); expect(await a.text()).toBe(await b.text());
    });
    it('Passport: a wrong OTP never logs in, even for seeded numbers', async () => {
      const { loginWithPhone } = await import('../src/passport.js');
      await expect(loginWithPhone(PATIENT_1, { otp: '111111' })).rejects.toThrow();
    });
  });

  describe('j. SSRF through tenant webhooks', () => {
    it('webhook targets that are internal, metadata, loopback or non-https are refused at creation', async () => {
      await q('kiorly', `update "Subscription" set "planId" = (select id from "Plan" where key = 'CLINIC') where "tenantId" = 'demo_t_na'`);
      const tok = await staffLogin('owner.na@demo.kiorex.test', 'Demo@12345');
      const c = await kiorly(tok, 'POST', '/admin/integration-clients', { name: 'sec-ssrf-' + randomUUID().slice(0, 6), scopes: ['APPOINTMENTS_READ'] });
      expect(c.status).toBeLessThan(300); const id = c.body.id ?? c.body.client?.id;
      try {
        for (const url of ['http://169.254.169.254/latest/meta-data/', 'https://169.254.169.254/latest/meta-data/', 'https://127.0.0.1:9/hook', 'https://localhost/hook', 'https://[::1]/hook', 'https://10.0.0.5/hook', 'http://example.com/hook', 'https://metadata.google.internal/', 'file:///etc/passwd', 'https://user:pw@example.com/']) {
          const r = await kiorly(tok, 'POST', `/admin/integration-clients/${id}/webhooks`, { url, eventTypes: ['APPOINTMENT_CREATED'] });
          expect(r.status, url).toBeGreaterThanOrEqual(400); expect(r.status, url).toBeLessThan(500);
        }
      } finally { await kiorly(tok, 'POST', `/admin/integration-clients/${id}/deactivate`, {}).catch(() => undefined); }
    });
  });

  describe('k. fuzzing: malformed, oversized and unicode input never produces a 5xx or a stack trace on public endpoints', () => {
    const weird = ['', ' ', '\u0000', '😀'.repeat(300), 'A'.repeat(70_000), '../../etc/passwd', '%00', "' OR 1=1 --", '<script>alert(1)</script>', '{{7*7}}', '${7*7}', '‮', '__proto__', 'constructor', 'open/constructor:x'];
    it('GET path and query parameters', async () => {
      for (const w of weird.filter((x) => x.length < 8000)) {
        for (const url of [`${KIOREX}/api/v1/providers/${encodeURIComponent(w)}`, `${KIOREX}/api/v1/search/providers?q=${encodeURIComponent(w)}&specialty=${encodeURIComponent(w)}&page=${encodeURIComponent(w)}`, `${KIOREX}/api/v1/rx/verify?t=${encodeURIComponent(w)}`, `${KIORLY}/api/v1/public/links/q/${encodeURIComponent(w)}`, `${KIORLY}/api/v1/public/links/go/${encodeURIComponent(w)}`, `${KIOREX}/r/${encodeURIComponent(w)}`, `${KIOREX}/q/${encodeURIComponent(w)}`]) {
          const r = await fetch(url, { redirect: 'manual' }).catch(() => null);
          if (r) { expect(r.status, url.slice(0, 120)).toBeLessThan(500); if (r.status >= 300 && r.status < 400) expect(r.headers.get('location') ?? '').not.toMatch(/evil|\/\/\/|javascript:/i); }
        }
      }
    });
    it('malformed and oversized JSON bodies on public POST endpoints', async () => {
      const targets = [`${KIOREX}/api/v1/growth/v1/touch`, `${KIOREX}/api/v1/growth/v1/events`, `${KIOREX}/api/v1/growth/v1/consent`, `${KIOREX}/api/v1/partners/v1/leads`, `${KIOREX}/api/v1/partners/v1/connection-requests`, `${KIORLY}/api/v1/auth/login`, `${KIORLY}/api/v1/public/signup/otp`, `${PHARMACY}/api/v1/auth/login`, `${LAB}/api/v1/auth/oidc/exchange`];
      for (const url of targets) for (const body of ['{', '[]', 'null', '"x"', '{"__proto__":{"polluted":true}}', '{"constructor":{"prototype":{"polluted":true}}}', JSON.stringify({ a: 'x'.repeat(300_000) }), JSON.stringify({ email: ['a'], password: { $ne: 1 }, phone: 123 })]) {
        const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => null);
        if (r) expect(r.status, `${url} ${body.slice(0, 30)}`).toBeLessThan(500);
      }
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
    it('Host header attacks do not change generated links or crash the API', async () => {
      for (const host of ['evil.example', 'localhost:4300@evil.example', 'a'.repeat(5000)]) {
        const r = await fetch(`${KIOREX}/api/v1/health/live`, { headers: { host } }).catch(() => null);
        if (r) expect(r.status).toBeLessThan(500);
      }
    });
  });
  describe('l. wave 7 (GRW-GC-4): the growth family in production mode', () => {
    it('every growth route read from the controllers: non-public routes need a session (401), admin routes refuse a patient (403), public routes answer without a 5xx and never hand out a stack', async () => {
      const routes = await growthRoutes(); expect(routes.length).toBeGreaterThan(120);
      const patient = t.p1; const bad: string[] = [];
      for (const r of routes) {
        const url = `${KIOREX}/api/v1${r.path}`; const send = (tok?: string) => fetch(url, { method: r.method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: r.method === 'GET' ? undefined : '{}' }).then(async (x) => ({ status: x.status, text: await x.text() }));
        const anon = await send(); if (anon.status >= 500) bad.push(`anon ${r.method} ${r.path} -> ${anon.status}`);
        if (/stack|at \w+ \(|node_modules|PrismaClient/.test(anon.text)) bad.push(`anon ${r.method} ${r.path} leaks internals`);
        if (!r.public) { if (anon.status !== 401) bad.push(`needs a session: ${r.method} ${r.path} -> ${anon.status}`); if (r.path.startsWith('/admin/') || r.path.startsWith('/ops/')) { const p = await send(patient); if (p.status !== 403) bad.push(`patient on admin ${r.method} ${r.path} -> ${p.status}`); } }
      }
      expect(bad).toEqual([]);
    }, 240_000);
    it('OpenAPI and docs are hidden, dev feature routes are gone, no fixture gate evidence exists and no launch-locked growth flag is effective', async () => {
      for (const p of ['/api/docs', '/api/docs-json', '/api/openapi.json', '/api/v1/openapi.json', '/api/v1/docs', '/api/v1/growth/v1/openapi', '/swagger', '/api/swagger-json']) expect((await get(KIOREX + p)).status, p).toBe(404);
      for (const p of ['/api/v1/dev/messaging/inbound', '/api/v1/dev/channels/whatsapp/conversation', '/api/v1/dev/payments', '/api/v1/dev/samples']) expect((await get(KIOREX + p)).status, p).toBe(404);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "FlagGateEvidence" where "gateId" like 'DEV-TEST-FIXTURE%'`))[0].c)).toBe(0);
      const flags = (await kiorex(t.ops, 'GET', '/admin/flags')).body; const arr = Array.isArray(flags) ? flags : (flags.flags ?? flags.items ?? []);
      for (const f of arr.filter((x: any) => ['growth.patient_referral', 'growth.rewards', 'growth.patient_credit', 'growth.sponsored_promotions', 'growth.marketing_messaging', 'growth.analytics_visitor', 'kiorex.whatsapp_ai_assistant', 'growth.support_goodwill'].includes(x.key))) expect(f.effective?.global, f.key).toBe(false);
    });
    it('experiment, assignment and referral endpoints: no consent means no cookie, no assignment and no data; a forged consent header without the visitor cookie is the same; CORS never reflects an arbitrary origin', async () => {
      const r = await fetch(`${KIOREX}/api/v1/growth/v1/experiments/assignments`, { headers: { origin: 'https://evil.example', 'x-kx-consent': 'analytics' } });
      expect(r.status).toBe(200); expect(r.headers.get('set-cookie')).toBeNull(); expect((await r.json() as any).assignments).toEqual([]);
      expect(r.headers.get('access-control-allow-origin')).not.toBe('https://evil.example'); expect(r.headers.get('access-control-allow-credentials')).not.toBe('true');
      expect(r.headers.get('x-powered-by')).toBeNull(); expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    });
  });

});

void createSign; void LAB;
