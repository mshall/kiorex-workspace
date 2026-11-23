import { randomBytes, randomInt } from 'node:crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { PASSPORT, PHARMACY_API, LAB_API } from '../src/env.js';
import { loginWithPhone } from '../src/passport.js';
import { resetOtpLimits } from '../src/db.js';
import { waitFor } from '../src/clients.js';
import { pharmacyStaff, labStaff } from '../src/verticals.js';

/**
 * Early session end for the Pharmacy and Lab staff webs: a product web session started with Kiorex Passport ends when Passport revokes it
 * (account page API: DELETE /api/sessions/:id, or "sign out other sessions"), through OIDC back-channel logout to
 * POST <product>/api/v1/auth/oidc/backchannel-logout. Real services over HTTP, no fakes. The browser part is the SPA's own PKCE redirect, so the
 * test does what the SPA does: authorize (code + PKCE + nonce), then POST /auth/oidc/exchange.
 * Also: staff management sets StaffUser.phone, which the first Passport sign-in links by (verified phone, never auto-created).
 */
const PRODUCTS = [
  { name: 'Pharmacy', api: PHARMACY_API, clientId: 'kiorly-pharmacy-web', origin: 'http://localhost:5192', owner: '+201000002007', sessionKey: 'accessToken' as const },
  { name: 'Lab', api: LAB_API, clientId: 'kiorly-lab-web', origin: 'http://localhost:5193', owner: '+201000002010', sessionKey: 'token' as const },
];
type R = { status: number; body: any };
async function call(base: string, method: string, path: string, token?: string, body?: unknown, form?: Record<string, string>): Promise<R> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload: string | undefined;
  if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString(); }
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(base + path, { method, headers, body: payload });
  const t = await res.text(); let b: any; try { b = t ? JSON.parse(t) : null; } catch { b = t; }
  return { status: res.status, body: b };
}
const randomPhone = () => `+2012${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;

/** What the staff web SPA does: authorize at Passport (public PKCE client, nonce), then the API redeems the code. Returns the product session. */
async function webSignIn(p: (typeof PRODUCTS)[number], phone: string) {
  const nonce = randomBytes(16).toString('base64url');
  const a = await loginWithPhone(phone, { clientId: p.clientId, redirectUri: `${p.origin}/auth/callback`, scope: 'openid profile phone', nonce, codeOnly: true });
  const r = await call(p.api, 'POST', '/auth/oidc/exchange', undefined, { code: a.code, codeVerifier: a.verifier, redirectUri: a.redirectUri, nonce });
  return { status: r.status, body: r.body, token: r.body?.[p.sessionKey] as string, endSessionUrl: r.body?.endSessionUrl as string | undefined };
}
/** The Passport account page session of a person (client kiorex-passport-web), used with /api/sessions exactly like the page does. */
const accountPage = (phone: string) => loginWithPhone(phone, { clientId: 'kiorex-passport-web', redirectUri: `${PASSPORT}/account/callback` });
const passportSessions = async (token: string) => ((await (await fetch(`${PASSPORT}/api/sessions`, { headers: { authorization: `Bearer ${token}` } })).json()) as any).sessions as Array<{ session_id: string; current: boolean; clients: string[] }>;
const me = (p: (typeof PRODUCTS)[number], token: string) => call(p.api, 'GET', '/auth/me', token);

beforeAll(async () => { await resetOtpLimits(); });

for (const p of PRODUCTS) {
  describe(`${p.name} web session ends when Passport revokes it`, () => {
    it('a web session signs in with Passport, then DELETE /api/sessions/:id (account page) ends it through back-channel logout; the other web session survives', async () => {
      const a = await webSignIn(p, p.owner);
      const b = await webSignIn(p, p.owner);
      expect(a.status, JSON.stringify(a.body)).toBe(200); expect(b.status).toBe(200);
      expect(a.endSessionUrl).toContain('/session/end');
      expect((await me(p, a.token)).status).toBe(200);
      expect((await me(p, b.token)).status).toBe(200);

      const page = await accountPage(p.owner);
      const mine = (await passportSessions(page.accessToken)).filter((s) => s.clients.includes(p.clientId));
      expect(mine.length).toBeGreaterThanOrEqual(2);
      // the dev IdP records one session per browser; revoke the newest two, one at a time, and watch exactly one product session end
      const first = mine[0]!;
      const del = await fetch(`${PASSPORT}/api/sessions/${first.session_id}`, { method: 'DELETE', headers: { authorization: `Bearer ${page.accessToken}` } });
      expect(del.status).toBe(200);
      const delivery = ((await del.json()) as any).deliveries.find((d: any) => d.clientId === p.clientId);
      expect(delivery, 'the dev IdP delivered a logout_token to the product').toMatchObject({ ok: true, event: 'session.revoked' });
      // exactly one of the two product sessions is now refused with SESSION_REVOKED, the other still works
      const states = await waitFor(`${p.name}: one session ended`, async () => {
        const s = await Promise.all([me(p, a.token), me(p, b.token)]);
        return s.some((x) => x.status === 401) ? s : undefined;
      }, 15_000, 300);
      expect(states.filter((x) => x.status === 401)).toHaveLength(1);
      expect(states.find((x) => x.status === 401)!.body.code).toBe('SESSION_REVOKED');
      expect(states.filter((x) => x.status === 200)).toHaveLength(1);

      // "sign out all other sessions" on the account page ends the remaining product session too
      const others = await fetch(`${PASSPORT}/api/sessions`, { method: 'DELETE', headers: { authorization: `Bearer ${page.accessToken}` } });
      expect(others.status).toBe(200);
      await waitFor(`${p.name}: all sessions ended`, async () => (await me(p, a.token)).status === 401 && (await me(p, b.token)).status === 401 ? true : undefined, 15_000, 300);
    });

    it('the receiver refuses unsigned, garbage and missing logout tokens and never ends a session for them', async () => {
      const s = await webSignIn(p, p.owner);
      for (const form of [{ logout_token: 'a.b.c' }, { logout_token: '' }, {}, { logout_token: s.token }]) {
        const r = await call(p.api, 'POST', '/auth/oidc/backchannel-logout', undefined, undefined, form as Record<string, string>);
        expect(r.status, JSON.stringify(form)).toBe(400);
      }
      expect((await me(p, s.token)).status).toBe(200);
    });
  });
}

describe('staff management phone -> Passport first sign-in link (Pharmacy)', () => {
  it('the owner adds a cashier with a phone; that person signs in with Passport and lands on that staff row (role from our row)', async () => {
    const owner = await pharmacyStaff('owner');
    const phone = randomPhone();
    const email = `e2e.${randomBytes(4).toString('hex')}@demo.kiorly.local`;
    const created = await call(PHARMACY_API, 'POST', '/staff', owner, { displayName: 'E2E Passport Cashier', email, password: 'Passw0rd!x', role: 'CASHIER', phone: phone.replace('+20', '+20 ') });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.phone).toBe(phone); expect(created.body.passportLinked).toBe(false);
    // duplicates and malformed numbers are refused
    expect((await call(PHARMACY_API, 'POST', '/staff', owner, { displayName: 'Dup', email: `d.${email}`, password: 'Passw0rd!x', role: 'CASHIER', phone })).body.code).toBe('PHONE_TAKEN');
    expect((await call(PHARMACY_API, 'PATCH', `/staff/${created.body.id}`, owner, { phone: '0100' })).body.code).toBe('INVALID_PHONE');

    const s = await webSignIn(PRODUCTS[0]!, phone);
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    const m = await me(PRODUCTS[0]!, s.token);
    expect(m.body.user).toMatchObject({ id: created.body.id, role: 'CASHIER' });
    expect((await call(PHARMACY_API, 'GET', '/staff', owner)).body.find((x: any) => x.id === created.body.id)).toMatchObject({ passportLinked: true, phone });

    // deactivating the staff member ends the Passport web session at once
    expect((await call(PHARMACY_API, 'PATCH', `/staff/${created.body.id}`, owner, { active: false })).status).toBe(200);
    expect((await me(PRODUCTS[0]!, s.token)).status).toBe(401);
  });
});

describe('staff management phone -> Passport first sign-in link (Lab)', () => {
  it('the lab owner adds a technologist with a phone; first Passport sign-in links it; duplicates are refused', async () => {
    const owner = await labStaff('owner');
    const phone = randomPhone();
    const email = `e2e.${randomBytes(4).toString('hex')}@demo-lab.test`;
    const created = await call(LAB_API, 'POST', '/staff', owner, { displayName: 'E2E Passport Tech', email, role: 'TECHNOLOGIST', phone });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.passportLinked).toBe(false);
    expect((await call(LAB_API, 'POST', '/staff', owner, { displayName: 'Dup', email: `d.${email}`, role: 'TECHNOLOGIST', phone })).body.code).toBe('PHONE_TAKEN');
    const s = await webSignIn(PRODUCTS[1]!, phone);
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    expect((await me(PRODUCTS[1]!, s.token)).body.user).toMatchObject({ id: created.body.id, role: 'TECHNOLOGIST' });
    expect((await call(LAB_API, 'PUT', `/staff/${created.body.id}`, owner, { active: false })).status).toBe(200);
    expect((await me(PRODUCTS[1]!, s.token)).status).toBe(401);
  });
});
