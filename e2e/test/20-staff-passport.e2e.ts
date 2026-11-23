import { describe, it, expect, beforeAll } from 'vitest';
import { loginWithPhone } from '../src/passport.js';
import { q, resetOtpLimits } from '../src/db.js';
import { KIORLY_API, PHARMACY_API, LAB_API } from '../src/env.js';

/**
 * Kiorex Passport sign-in for the staff products, API side (the Kiorly staff app path): a public PKCE client (`kiorly`) obtains a Passport access
 * token (phone OTP 000000) and sends it as the bearer to the three product APIs. Identity only: role / tenant come from each product's own staff row.
 * Demo links are seeded (TEST_DATA.md); the phone-match first-login link is exercised by clearing one link first. Password / dev login keep working.
 */
const APP = { clientId: 'kiorly', redirectUri: 'kiorly://auth/callback' };
const staff = (phone: string) => loginWithPhone(phone, APP);
type R = { status: number; body: any };
async function get(base: string, path: string, token: string, headers: Record<string, string> = {}): Promise<R> {
  const res = await fetch(base + path, { headers: { authorization: `Bearer ${token}`, ...headers } });
  const t = await res.text(); let body: any; try { body = t ? JSON.parse(t) : null; } catch { body = t; }
  return { status: res.status, body };
}
const code = (b: any) => b?.errorCode ?? b?.code ?? b?.message?.code ?? b?.message?.errorCode;

beforeAll(async () => { await resetOtpLimits(); });

describe('Clinic API accepts Passport access tokens (staff app)', () => {
  it('seeded link: the owner of Nile Care signs in with the Passport phone; role + tenant come from the Kiorly user row', async () => {
    const t = await staff('+201000002001');
    expect(t.claims.client_id).toBe('kiorly');
    const me = await get(KIORLY_API, '/auth/me', t.accessToken);
    expect(me.status).toBe(200);
    expect(me.body.user?.email ?? me.body.email).toBe('owner.na@demo.kiorex.test');
    expect(me.body.user?.role ?? me.body.role).toBe('GROUP_ADMIN');
  });
  it('roles differ per persona: front desk (Sara) is a RECEPTIONIST, Dr Nadia a PHYSICIAN', async () => {
    const sara = await get(KIORLY_API, '/auth/me', (await staff('+201000002002')).accessToken);
    expect(sara.body.user?.role ?? sara.body.role).toBe('RECEPTIONIST');
    const nadia = await get(KIORLY_API, '/auth/me', (await staff('+201000002006')).accessToken);
    expect(nadia.body.user?.role ?? nadia.body.role).toBe('PHYSICIAN');
  });
  it('first login by verified phone links a staff member whose employee phone matches (audited); then the link is by subject', async () => {
    await q('kiorly', `delete from "KiorexIdentityLink" where "userId" = (select id from "User" where email = 'frontdesk1.na@demo.kiorex.test')`);
    const t = await staff('+201000002002');
    expect((await get(KIORLY_API, '/auth/me', t.accessToken)).status).toBe(200);
    const [row] = await q('kiorly', `select l."linkedVia", l.subject from "KiorexIdentityLink" l join "User" u on u.id = l."userId" where u.email = 'frontdesk1.na@demo.kiorex.test'`);
    expect(row.linkedVia).toBe('PHONE_MATCH'); expect(row.subject).toBe(t.sub);
  });
  it('an unlinked Passport (a patient), another client (kiorex-web) and no token are refused', async () => {
    const patient = await staff('+201000001001');
    const r = await get(KIORLY_API, '/auth/me', patient.accessToken);
    expect(r.status).toBe(401); expect(code(r.body)).toBe('PASSPORT_NOT_LINKED');
    const web = await loginWithPhone('+201000002001'); // client kiorex-web: not an accepted client of the Clinic API
    expect((await get(KIORLY_API, '/auth/me', web.accessToken)).status).toBe(401);
    expect((await get(KIORLY_API, '/auth/me', '')).status).toBe(401);
  });
});

describe('Pharmacy API accepts Passport access tokens (staff app)', () => {
  it('pharmacist (Mostafa) and owner / cashier map to their staff rows and roles', async () => {
    for (const [phone, role] of [['+201000002004', 'PHARMACIST'], ['+201000002007', 'OWNER'], ['+201000002008', 'CASHIER']] as const) {
      const me = await get(PHARMACY_API, '/auth/me', (await staff(phone)).accessToken, { 'x-kiorly-client': 'kiorly/1.0-e2e' });
      expect(me.status, phone).toBe(200); expect(me.body.user.role).toBe(role);
    }
  });
  it('first login by verified phone links the staff row (subject written, audited); unlinked patient refused', async () => {
    await q('kiorly_pharmacy', `update "StaffUser" set subject = null where email = 'cashier@demo.kiorly.local'`);
    const t = await staff('+201000002008');
    expect((await get(PHARMACY_API, '/auth/me', t.accessToken)).status).toBe(200);
    const [row] = await q('kiorly_pharmacy', `select subject from "StaffUser" where email = 'cashier@demo.kiorly.local'`);
    expect(row.subject).toBe(t.sub);
    const audits = await q('kiorly_pharmacy', `select 1 from "AuditLog" where action = 'auth.passport_linked' and "actorId" = (select id from "StaffUser" where email = 'cashier@demo.kiorly.local')`);
    expect(audits.length).toBeGreaterThan(0);
    const p = await get(PHARMACY_API, '/auth/me', (await staff('+201000001001')).accessToken);
    expect(p.status).toBe(403); expect(code(p.body)).toBe('PASSPORT_NOT_LINKED');
  });
  it('password login still works (dual mode) and local tokens are not confused with Passport tokens', async () => {
    const r = await fetch(PHARMACY_API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'pharmacist@demo.kiorly.local', password: 'Demo@12345' }) });
    expect(r.status).toBe(200);
    expect((await get(PHARMACY_API, '/auth/me', ((await r.json()) as any).accessToken)).status).toBe(200);
    expect((await fetch(PHARMACY_API + '/auth/config')).status).toBe(200);
  });
});

describe('Lab API accepts Passport access tokens (staff app)', () => {
  it('technologist, signatory and owner map to their staff rows and roles', async () => {
    for (const [phone, role] of [['+201000002005', 'TECHNOLOGIST'], ['+201000002009', 'AUTHORIZED_SIGNATORY'], ['+201000002010', 'OWNER']] as const) {
      const me = await get(LAB_API, '/auth/me', (await staff(phone)).accessToken, { 'x-kiorly-client': 'kiorly/1.0-e2e' });
      expect(me.status, phone).toBe(200); expect(me.body.user.role).toBe(role);
    }
  });
  it('first login by verified phone links the staff row; unlinked patient refused; dev login still works', async () => {
    await q('kiorly_lab', `update "StaffUser" set subject = null where email = 'tech@demo-lab.test'`);
    const t = await staff('+201000002005');
    expect((await get(LAB_API, '/auth/me', t.accessToken)).status).toBe(200);
    const [row] = await q('kiorly_lab', `select subject from "StaffUser" where email = 'tech@demo-lab.test'`);
    expect(row.subject).toBe(t.sub);
    const p = await get(LAB_API, '/auth/me', (await staff('+201000001001')).accessToken);
    expect(p.status).toBe(403); expect(code(p.body)).toBe('PASSPORT_NOT_LINKED');
    const dev = await fetch(LAB_API + '/auth/dev-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orgSlug: 'demo-lab', email: 'owner@demo-lab.test' }) });
    expect(dev.status).toBe(201);
  });
});
