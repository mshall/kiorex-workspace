import { describe, it, expect } from 'vitest';
import { randomInt } from 'node:crypto';
import { PASSPORT } from '../src/env.js';
import { loginWithPhone } from '../src/passport.js';
import { kiorex, waitFor } from '../src/clients.js';
import { resetOtpLimits } from '../src/db.js';

/** KA-07 session revoke -> OIDC back-channel logout to Kiorex (KXM-AC-05). */
describe('h. Back-channel logout', () => {
  it('revoking the Passport session invalidates the Kiorex session', async () => {
    await resetOtpLimits();
    const phone = `+2012${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
    const l = await loginWithPhone(phone);
    expect((await kiorex(l.accessToken, 'GET', '/auth/me')).status).toBe(200);
    expect((await kiorex(l.accessToken, 'GET', '/me/sessions')).status).toBe(200);

    const sessions = await (await fetch(`${PASSPORT}/api/sessions`, { headers: { authorization: `Bearer ${l.accessToken}` } })).json() as any;
    const list: any[] = Array.isArray(sessions) ? sessions : sessions.sessions ?? sessions.items;
    expect(list.length).toBeGreaterThanOrEqual(1);
    const sid = list.find((s) => s.current)?.session_id ?? list[0].session_id;
    const del = await fetch(`${PASSPORT}/api/sessions/${sid}`, { method: 'DELETE', headers: { authorization: `Bearer ${l.accessToken}` } });
    expect([200, 204]).toContain(del.status);

    // the access token is still a valid JWT, but the Kiorex session (sid) was revoked by the logout_token
    const after = await waitFor('Kiorex rejects the revoked session', async () => (await kiorex(l.accessToken, 'GET', '/auth/me')).status === 401 ? 401 : undefined, 15_000, 500);
    expect(after).toBe(401);
  });

  it('Kiorex rejects an unsigned/garbage logout_token', async () => {
    const r = await kiorex(undefined, 'POST', '/auth/backchannel-logout', { logout_token: 'a.b.c' });
    expect([400, 401]).toContain(r.status);
  });
});
