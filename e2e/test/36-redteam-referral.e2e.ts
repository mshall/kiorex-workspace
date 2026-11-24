import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { KIOREX_API, KIOREX } from '../src/env.js';
import { kiorex, q, sleep } from '../src/clients.js';
import { resetRateLimits } from '../src/db.js';
import { tokens } from '../src/fixtures.js';
import { freshPatient, signClinicLt, newLinkCode } from '../src/growth.js';
import { forgeJwt, hasMarkup, INJECTION_CORPUS, unlockForRun } from '../src/growth-p3.js';

/**
 * GRW-GC-4 red team, referral side, on the real local stack (HTTP, Postgres, Passport tokens): the attacks of the referral and link-token threat tables driven end to end.
 * Covered: the counsel gate cannot be unlocked by a patient or a forged super-admin token; forged, tampered and expired JWTs; self-referral and the no-oracle refusals; injection corpus in AR and EN;
 * first-claim-wins under 8 parallel claims; network-prefix and farming signals reach the review queue without a person in them; the claim rate limit; `lt` forging, swapping, expiry and replay;
 * widget origin forgery. Not here (honest gap, covered in test/growth-referral.int.spec.ts): attendance-driven rules (fake booking, cancellation after reward) and the staff-phone match, which needs the
 * Clinic endpoint that is not built yet. Launch-locked flags get DEV TEST FIXTURE gate evidence for this run only and are put back at the end.
 */
const REF = '/growth/v1/referral'; const REFERRAL_FLAG = 'growth.patient_referral'; const VISITOR_FLAG = 'growth.analytics_visitor';
const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

describe('36. red team: referral, link tokens and widget origin', () => {
  let t: Awaited<ReturnType<typeof tokens>>; const undo: (() => Promise<void>)[] = []; const org = `org_e2e36_${randomBytes(3).toString('hex')}`;
  beforeAll(async () => { t = await tokens(); });
  afterAll(async () => { for (const u of undo.reverse()) await u().catch(() => undefined); await q('kiorex_platform', `delete from "WidgetRegistration" where "orgRef" like 'org_e2e36_%'`).catch(() => undefined); });

  describe('the counsel gate and token forgery', () => {
    it('referral is launch-locked: 403 FEATURE_DISABLED for a real patient; a patient token and forged super-admin JWTs cannot record the gate', async () => {
      const p = await freshPatient('Red Team Gate');
      const locked = await kiorex(p.token, 'GET', `${REF}/me`); expect(locked.status).toBe(403); expect(locked.body.code).toBe('FEATURE_DISABLED'); expect(locked.body.key).toBe(REFERRAL_FLAG);
      const before = Number((await q('kiorex_platform', `select count(*)::int c from "FlagGateEvidence" where "flagKey" = $1`, [REFERRAL_FLAG]))[0].c);
      const gate = { gateId: 'GATE-FORGED', approver: 'attacker', approvedOn: new Date().toISOString(), documentUrl: 'https://evil.example/doc' };
      expect((await kiorex(p.token, 'PUT', `/admin/flags/${REFERRAL_FLAG}/gate`, gate)).status).toBe(403);
      for (const jwt of [forgeJwt({ sub: 'x', kx_roles: ['super_admin', 'ops_admin'] }, 'none'), forgeJwt({ sub: 'x', kx_roles: ['super_admin', 'ops_admin'] }, 'HS256')]) expect((await kiorex(jwt, 'PUT', `/admin/flags/${REFERRAL_FLAG}/gate`, gate)).status).toBe(401);
      expect((await kiorex(t.ops, 'PUT', `/admin/flags/${REFERRAL_FLAG}/gate`, { ...gate, approvedOn: 'not-a-date' })).status).toBeGreaterThanOrEqual(400);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "FlagGateEvidence" where "flagKey" = $1`, [REFERRAL_FLAG]))[0].c)).toBe(before);
      expect((await kiorex(p.token, 'GET', `${REF}/me`)).status).toBe(403);
    });
    it('unlock for the run (test fixture gate); forged, tampered, expired and wrong-audience JWTs are 401 on patient and admin endpoints', async () => {
      undo.push(await unlockForRun(t.ops, REFERRAL_FLAG)); undo.push(await unlockForRun(t.ops, VISITOR_FLAG));
      await sleep(1500);
      const claims = { sub: 'sub_attacker', kx_roles: ['patient', 'super_admin', 'ops_admin'], phone_number: '+201000000001' };
      const [h, pl, sig] = t.p1.split('.') as [string, string, string];
      const tampered = `${h}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(pl, 'base64url').toString()), kx_roles: ['super_admin'] })).toString('base64url')}.${sig}`;
      const jwts = [forgeJwt(claims, 'none'), forgeJwt(claims, 'HS256'), forgeJwt({ ...claims, exp: 1 }, 'HS256'), forgeJwt({ ...claims, aud: 'other-api' }, 'HS256'), tampered, 'garbage', `${h}.${pl}.`];
      for (const jwt of jwts) for (const [m, path] of [['GET', `${REF}/me`], ['POST', `${REF}/claim`], ['GET', '/admin/growth/referrals'], ['GET', '/admin/growth/experiments'], ['GET', '/admin/growth/campaigns']] as const) {
        const r = await kiorex(jwt, m, path, m === 'POST' ? { code: 'ABCDEFGH' } : undefined); expect(r.status, `${m} ${path}`).toBe(401);
      }
      expect((await kiorex(undefined, 'GET', `${REF}/me`)).status).toBe(401);
      const fresh = await freshPatient('Red Team Role');
      expect((await kiorex(fresh.token, 'GET', '/admin/growth/referrals')).status).toBe(403); // a patient is not ops
      expect((await kiorex(fresh.token, 'POST', '/admin/growth/experiments', {})).status).toBe(403);
    });
  });

  describe('claims: no oracle, no self-referral, injection, first claim wins, rate limit', () => {
    let referrer: Awaited<ReturnType<typeof freshPatient>>; let code = '';
    beforeAll(async () => { referrer = await freshPatient('Referrer Red'); const me = await kiorex(referrer.token, 'GET', `${REF}/me`); expect(me.status).toBe(200); code = me.body.code; expect(code).toMatch(/^[0-9A-Z]{8}$/); });

    it('self-referral is refused with the standard shape and leaves no relationship', async () => {
      const r = await kiorex(referrer.token, 'POST', `${REF}/claim`, { code }); expect(r.status).toBe(409); expect(r.body).toMatchObject({ code: 'REFERRAL_REJECTED', status: 'REJECTED', reason: 'SELF_REFERRAL' });
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "ReferralRelationship" where "refereeSub" = $1`, [referrer.sub]))[0].c)).toBe(0);
    });
    it('an unknown code and a suspended code answer the SAME body (no oracle); a malformed code is 400; the owner of a code is never named', async () => {
      const donor = await freshPatient('Suspended Owner'); const dc = (await kiorex(donor.token, 'GET', `${REF}/me`)).body.code;
      await q('kiorex_platform', `update "ReferralCode" set status = 'SUSPENDED' where code = $1`, [dc]);
      const f = await freshPatient('Prober');
      const unknown = await kiorex(f.token, 'POST', `${REF}/claim`, { code: 'ZZZZZZZZ' }); const suspended = await kiorex(f.token, 'POST', `${REF}/claim`, { code: dc });
      expect(unknown.status).toBe(409); expect(same(unknown.body, suspended.body)).toBe(true);
      expect(JSON.stringify([unknown.body, suspended.body])).not.toMatch(new RegExp(`${donor.sub}|${referrer.sub}|\\+20\\d{8}`));
      for (const bad of ['abc', '', 'ABCDEFGHI', 12345678 as unknown as string]) expect((await kiorex(f.token, 'POST', `${REF}/claim`, { code: bad })).status).toBe(400);
      expect((await kiorex(f.token, 'POST', `${REF}/claim`, {})).status).toBe(400);
    });
    it('an injection corpus (markup, SQL, template, path, NUL, header splitting, oversized, Arabic) as code, channel or locale never gives a 5xx and is never reflected', async () => {
      const f = await freshPatient('Injector');
      for (const x of INJECTION_CORPUS) {
        const a = await kiorex(f.token, 'POST', `${REF}/claim`, { code: x }); expect(a.status, `claim ${x.slice(0, 20)}`).toBeLessThan(500); expect(hasMarkup(JSON.stringify(a.body))).toBe(false);
        const b = await kiorex(referrer.token, 'POST', `${REF}/invites`, { channel: x, locale: x }); expect(b.status, `invite ${x.slice(0, 20)}`).toBe(400); expect(hasMarkup(JSON.stringify(b.body))).toBe(false);
      }
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "ReferralCode"`))[0].c)).toBeGreaterThan(0); // the table is still there
      const raw = await fetch(`${KIOREX_API}${REF}/claim`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${f.token}` }, body: '{"code":"\u0000ABCDEFG"}' }); expect(raw.status).toBeLessThan(500);
      const big = await kiorex(f.token, 'POST', `${REF}/claim`, { code: 'ABCDEFGH', pad: 'x'.repeat(2_000_000) }); expect(big.status).toBeLessThan(500); // FINDING (low): the global JSON limit is 8 MB (vault uploads), so a 2 MB padded claim is parsed and answered 409; only /touch and partner intake cap their bodies
    });
    it('first claim wins: 8 parallel claims by one person make ONE relationship; a later claim of another code answers the first and changes nothing', async () => {
      const other = await freshPatient('Second Referrer'); const oc = (await kiorex(other.token, 'GET', `${REF}/me`)).body.code;
      const f = await freshPatient('Parallel Referee');
      const rs = await Promise.all(Array.from({ length: 8 }, () => kiorex(f.token, 'POST', `${REF}/claim`, { code })));
      expect(new Set(rs.map((r) => r.status)).size).toBe(1); expect(rs[0]!.status).toBe(200); expect(new Set(rs.map((r) => r.body.status)).size).toBe(1);
      const rows = await q('kiorex_platform', `select "referrerSub", status from "ReferralRelationship" where "refereeSub" = $1`, [f.sub]); expect(rows).toHaveLength(1); expect(rows[0].referrerSub).toBe(referrer.sub);
      const later = await kiorex(f.token, 'POST', `${REF}/claim`, { code: oc }); expect(later.status).toBe(200); expect(later.body.status).toBe(rows[0].status);
      expect((await q('kiorex_platform', `select "referrerSub" from "ReferralRelationship" where "refereeSub" = $1`, [f.sub])).map((r: any) => r.referrerSub)).toEqual([referrer.sub]);
    });
    it('the claim rate limit holds: the 21st refused claim of one person within the hour is 429', async () => {
      const f = await freshPatient('Hammer'); let last = 0;
      for (let i = 0; i < 22; i++) { last = (await kiorex(f.token, 'POST', `${REF}/claim`, { code: 'ZZZZZZZZ' })).status; if (last === 429) break; }
      expect(last).toBe(429);
    });
    it('farming and network-prefix: seven new accounts from one network claim one code; signals land in the review queue and the queue shows no person', async () => {
      const sigCount = async () => Number((await q('kiorex_platform', `select count(*)::int c from "GrowthFraudSignal" where "ruleId" = 'RF_DUP_ACCOUNT'`))[0].c); const sigBefore = await sigCount();
      const farmer = await freshPatient('Farmer'); const fc = (await kiorex(farmer.token, 'GET', `${REF}/me`)).body.code;
      for (let i = 0; i < 7; i++) { const f = await freshPatient(`Ring ${i}`); const r = await kiorex(f.token, 'POST', `${REF}/claim`, { code: fc }); expect([200, 409]).toContain(r.status); }
      expect(await sigCount()).toBeGreaterThan(sigBefore);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "ReferralRelationship" where "referrerSub" = $1 and "reviewState" = 'HOLD'`, [farmer.sub]))[0].c)).toBeGreaterThanOrEqual(1);
      const queue = await kiorex(t.ops, 'GET', '/admin/growth/referrals'); expect(queue.status).toBe(200);
      expect(JSON.stringify(queue.body)).not.toMatch(new RegExp(`${farmer.sub}|\\+20\\d{9}|@[a-z]+\\.`));
    });
  });

  describe('link token (lt) forging and replay', () => {
    const touch = (body: Record<string, unknown>, h: Record<string, string> = {}) => kiorex(undefined, 'POST', '/growth/v1/touch', { landingKind: 'PROVIDER_LINK', ...body }, { 'x-kx-consent': 'analytics', ...h });
    const rows = async (org_: string) => Number((await q('kiorex_platform', `select count(*)::int c from "GrowthTouchpoint" where "providerOrgRef" = $1`, [org_]))[0].c);
    it('garbage, swapped-org, expired, oversized and wrong-secret tokens are refused and store nothing; the Clinic-signed token stores one touch bound to its org', async () => {
      const code = newLinkCode(); const good = signClinicLt({ tenantId: org, code });
      for (const lt of ['garbage', 'a.b', good.slice(0, -2) + 'AA', signClinicLt({ tenantId: org, code, secret: 'attacker-secret' }), signClinicLt({ tenantId: org, code, now: Date.now() - 80 * 3600_000 }), 'x'.repeat(2000), `${good}.extra`]) {
        const r = await touch({ lt }); expect([400, 401, 410, 422], `lt ${lt.slice(0, 18)}`).toContain(r.status);
      }
      const [pl, sg] = good.split('.') as [string, string]; const swapped = `${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(pl, 'base64url').toString()), o: 'org_victim' })).toString('base64url')}.${sg}`;
      expect([400, 401, 422]).toContain((await touch({ lt: swapped })).status);
      expect(await rows('org_victim')).toBe(0); expect(await rows(org)).toBe(0);
      const ok = await touch({ lt: good }); expect(ok.status).toBe(202);
      expect(await rows(org)).toBe(1);
    });
    it('replaying one valid token 5 times never moves it to another organisation, and a token whose code is registered to a different organisation is ignored', async () => {
      const code = newLinkCode(); const lt = signClinicLt({ tenantId: org, code });
      for (let i = 0; i < 5; i++) expect((await touch({ lt })).status).toBe(202);
      const orgs = await q('kiorex_platform', `select distinct "providerOrgRef" o, "ltTokenId" t from "GrowthTouchpoint" where "linkCode" = $1`, [code]); expect(orgs).toHaveLength(1); expect(orgs[0].o).toBe(org);
      const code2 = newLinkCode(); const src = await q('kiorex_platform', `insert into "GrowthAcquisitionSource" (id, market, "sourceKind", "sourceRef", "ownerOrgRef", active) values ($1,'EG','PROVIDER_LINK',$2,'org_owner_real',true) returning id`, [`src_e2e36_${randomBytes(3).toString('hex')}`, code2]);
      expect(src).toHaveLength(1);
      expect((await touch({ lt: signClinicLt({ tenantId: org, code: code2 }), ref: code2 })).status).toBe(202);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "GrowthTouchpoint" where "linkCode" = $1 and "providerOrgRef" = $2`, [code2, org]))[0].c)).toBe(0);
      await q('kiorex_platform', `delete from "GrowthAcquisitionSource" where "sourceRef" = $1 and id like 'src_e2e36_%'`, [code2]).catch(() => undefined);
    });
    it('without analytics consent a token stores nothing at all and no visitor cookie is set', async () => {
      const code = newLinkCode(); const before = await rows(org);
      const r = await fetch(`${KIOREX_API}/growth/v1/touch`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ landingKind: 'PROVIDER_LINK', lt: signClinicLt({ tenantId: org, code }) }) });
      expect(r.status).toBe(202); expect(r.headers.get('set-cookie')).toBeNull(); expect(await rows(org)).toBe(before);
    });
  });

  describe('widget origin forgery', () => {
    beforeAll(async () => { await resetRateLimits(); }); // the shared Postgres limiter keeps one minute of session buckets between runs
    const OK = 'https://clinic-site.example.test'; const slug = `e2e36-${randomBytes(3).toString('hex')}`;
    const session = (parentOrigin: string, origin: string, o = org) => fetch(`${KIOREX_API}/widget/v1/session`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ org: slug, parentOrigin }) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) as any }));
    it('a session needs the widget app as Origin and an allow-listed parent; forged origins, wildcard look-alikes and credentials in the origin are refused and audited', async () => {
      await q('kiorex_platform', `insert into "WidgetRegistration" (id, market, "orgRef", "orgSlug", origins, status, "syncedAt", "createdAt", "updatedAt") values ($1,'EG',$2,$3,$4,'ACTIVE',now(),now(),now())`, [`wr_e2e36_${randomBytes(3).toString('hex')}`, org, slug, [OK]]);
      const unlockWidgets = await unlockForRun(t.ops, 'growth.widgets').catch(() => async () => undefined); undo.push(unlockWidgets); await sleep(1200);
      expect((await session(OK, 'https://evil.example')).status).toBe(403);
      expect((await session(OK, `${KIOREX}`.replace('localhost', 'localhost'))).status).toBe(200);
      for (const parent of ['https://not-allowed.example.test', `${OK}.evil.example`, 'https://clinic-site.example.test@evil.example', 'http://clinic-site.example.test', 'https://CLINIC-SITE.example.test.evil.example', '*', 'null', 'javascript:alert(1)', 'https://sub.clinic-site.example.test']) {
        const r = await session(parent, KIOREX); expect([400, 403], `parent ${parent}`).toContain(r.status); expect(r.body?.token).toBeUndefined();
      }
      const audit = (await kiorex(t.ops, 'GET', `/widget/v1/ops/audit?org=${org}`)).body as any[]; expect(Array.isArray(audit) && audit.length).toBeTruthy();
    });
    it('a widget token is not a general credential: tampered or expired tokens are refused; other routes are WIDGET_ROUTE_NOT_ALLOWED', async () => {
      const ok = await session(OK, KIOREX); expect(ok.status).toBe(200); const token = ok.body.token as string;
      const asWidget = (path: string, tok = token, origin = KIOREX, bearer?: string) => fetch(`${KIOREX_API}${path}`, { headers: { 'x-kx-widget': tok, origin, ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) } }).then((r) => r.status);
      expect(await asWidget('/widget/v1/config')).toBe(200);
      expect(await asWidget('/widget/v1/config', token.slice(0, -3) + 'AAA')).toBeGreaterThanOrEqual(401);
      expect(await asWidget('/widget/v1/config', token, 'https://evil.example')).toBe(403);
      expect(await asWidget('/me/sessions', token, KIOREX, t.p1)).toBe(403); expect(await asWidget('/admin/growth/referrals', token, KIOREX, t.ops)).toBe(403);
      await q('kiorex_platform', `update "WidgetRegistration" set origins = '{}' where "orgRef" = $1`, [org]); // the clinic removed the origin: revocation is immediate
      expect(await asWidget('/widget/v1/config')).toBe(403);
    });
  });
});
