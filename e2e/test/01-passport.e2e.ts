import { describe, it, expect } from 'vitest';
import { PASSPORT, PATIENT_1, KIOREX_API } from '../src/env.js';
import { patientLogin, kiorex } from '../src/clients.js';
import { loginWithPhone } from '../src/passport.js';
import { resetOtpLimits } from '../src/db.js';

/** KA-01 phone OTP login · KA-03 auth code + PKCE · KXM-AC-01 Kiorex accepts the Passport access token (aud kiorex-api). */
describe('a. Passport phone-OTP login (auth code + PKCE)', () => {
  it('discovery advertises S256 PKCE and the issuer', async () => {
    const d: any = await (await fetch(`${PASSPORT}/.well-known/openid-configuration`)).json();
    expect(d.issuer).toBe(PASSPORT);
    expect(d.code_challenge_methods_supported).toContain('S256');
  });

  it('logs in +201000000001 with the seeded 000000 OTP and gets an access token for kiorex-api', async () => {
    const l = await patientLogin(PATIENT_1);
    expect(l.claims.aud).toBe('kiorex-api');
    expect(l.claims.phone_number).toBe(PATIENT_1);
    expect(l.claims.phone_number_verified).toBe(true);
    expect(l.claims.kx_roles).toEqual(['patient']);
    expect(l.claims.iss).toBe(PASSPORT);
    expect(l.claims.exp - l.claims.iat).toBeLessThanOrEqual(15 * 60);
    expect(l.claims.sid).toBeTruthy();
    const me = await kiorex(l.accessToken, 'GET', '/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ phone: PATIENT_1, roles: ['patient'] });
  });

  it('Kiorex rejects missing / garbage tokens', async () => {
    expect((await kiorex(undefined, 'GET', '/auth/me')).status).toBe(401);
    expect((await kiorex('not.a.jwt', 'GET', '/auth/me')).status).toBe(401);
  });

  it('a wrong OTP does not log in (even for a seeded number)', async () => {
    await resetOtpLimits();
    // 000000 is accepted only for the seeded test numbers; any other number must be rejected
    await expect(loginWithPhone(PATIENT_1, { otp: '111111' })).rejects.toThrow();
  });
});
