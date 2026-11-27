import { createHash, createHmac, randomBytes } from 'node:crypto';
import { PASSPORT, OTP } from './env.js';
import { localTotpSecret } from './local-totp.js';

/** Minimal cookie-jar fetch that never follows redirects (mirrors a browser on the Passport interaction pages). */
class Jar {
  private jar = new Map<string, string>();
  private ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  async req(url: string, init: { method?: string; form?: Record<string, string> } = {}): Promise<Response> {
    const headers: Record<string, string> = { 'x-forwarded-for': this.ip, 'user-agent': 'KiorexE2E/1.0' };
    if (this.jar.size) headers.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    let body: string | undefined;
    if (init.form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(init.form).toString(); }
    const res = await fetch(url, { method: init.method, headers, body, redirect: 'manual' });
    for (const sc of res.headers.getSetCookie()) {
      const [pair] = sc.split(';'); const i = pair.indexOf('=');
      const name = pair.slice(0, i), val = pair.slice(i + 1);
      if (!val || /expires=Thu, 01 Jan 1970/i.test(sc)) this.jar.delete(name); else this.jar.set(name, val);
    }
    return res;
  }
  async follow(res: Response, base: string, stopAt: string): Promise<{ res: Response; url: string }> {
    let url = base;
    while (res.status >= 300 && res.status < 400) {
      url = new URL(res.headers.get('location')!, url).toString();
      if (url.startsWith(stopAt)) return { res, url };
      res = await this.req(url);
    }
    return { res, url };
  }
}

export interface Login { accessToken: string; idToken: string; refreshToken?: string; sub: string; sid?: string; claims: Record<string, any>; /** codeOnly: the authorization code and PKCE verifier, NOT redeemed (a product API redeems it, e.g. POST /auth/oidc/exchange) */ code?: string; verifier?: string; redirectUri?: string }

export function decodeJwt(t: string): Record<string, any> {
  return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
}

const SEEDED = new Set(['+201000000001', '+201000000002', '+201000000099']);
/** Unseeded numbers: the dev IdP's log channel prints the real code to its log (.e2e/logs/passport.log). */
async function otpFromLog(phone: string): Promise<string> {
  const { readFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const file = process.env.E2E_PASSPORT_LOG ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../.e2e/logs/passport.log');
  for (let i = 0; i < 20; i++) {
    const m = [...readFileSync(file, 'utf8').matchAll(new RegExp(`to=\\${phone} locale=\\w+ code=(\\d+)`, 'g'))].pop();
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no OTP logged for ${phone}`);
}

/** Local-only (generated per machine, see local-totp.ts); never a committed value. */
export const devOpsTotpSecret = () => localTotpSecret('+201000000099');
/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from a base32 secret. */
export function totp(secretB32: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = ''; for (const ch of secretB32.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((x) => parseInt(x, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, '0');
}

/** Programmatic phone-OTP login: auth code + PKCE (S256) against the dev IdP using the seeded 000000 code. */
export async function loginWithPhone(phone: string, opts: { clientId?: string; redirectUri?: string; otp?: string; totpSecret?: string; scope?: string; nonce?: string; codeOnly?: boolean } = {}): Promise<Login> {
  const clientId = opts.clientId ?? 'kiorex-web';
  const redirectUri = opts.redirectUri ?? (clientId === 'kiorex-ops' ? 'http://localhost:5181/auth/callback' : 'http://localhost:5180/auth/callback');
  const b = new Jar();
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(8).toString('hex');
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: opts.scope ?? 'openid profile phone kx offline_access',
    state, ...(opts.nonce ? { nonce: opts.nonce } : {}), code_challenge: challenge, code_challenge_method: 'S256', ui_locales: 'en', prompt: 'login',
  });
  let r = await b.req(`${PASSPORT}/auth?${q}`);
  const { url } = await b.follow(r, PASSPORT, redirectUri);
  const uid = new URL(url).pathname.split('/')[2];
  r = await b.req(`${PASSPORT}/interaction/${uid}`);
  if (r.status !== 200) throw new Error(`phone page ${r.status}`);
  r = await b.req(`${PASSPORT}/interaction/${uid}/phone`, { method: 'POST', form: { phone, lang: 'en' } });
  if (r.status !== 200) throw new Error(`send otp ${r.status} ${(await r.text()).replace(/<[^>]+>/g," ").match(/role="alert"|Too many[^.]*\./)?.[0] ?? ""}`);
  r = await b.req(`${PASSPORT}/interaction/${uid}/verify`, { method: 'POST', form: { code: opts.otp ?? (SEEDED.has(phone) ? OTP : await otpFromLog(phone)), lang: 'en' } });
  // Privileged roles (ops_admin / super_admin) must pass TOTP (KA-03/KA-10). The ops dev user has a fixed dev-only secret (kiorex-account config/seed-users.json).
  // A time step is accepted once per credential, so a second login inside the same 30 s step waits for the next one.
  for (let attempt = 0; attempt < 2; attempt++) {
    const page = await r.clone().text();
    if (!page.includes(`/interaction/${uid}/totp`)) break;
    if (attempt) await new Promise((res) => setTimeout(res, 30_000 - (Date.now() % 30_000) + 1500));
    r = await b.req(`${PASSPORT}/interaction/${uid}/totp`, { method: 'POST', form: { totp: totp(opts.totpSecret ?? devOpsTotpSecret()), lang: 'en' } });
  }
  if (r.status === 200) r = await b.req(`${PASSPORT}/interaction/${uid}/finish`, { method: 'POST', form: { lang: 'en' } }); // skip passkey enrolment
  const end = await b.follow(r, PASSPORT, redirectUri);
  if (!end.url.startsWith(redirectUri)) throw new Error(`no callback: ${end.res.status} ${end.url}`);
  const cb = new URL(end.url);
  if (cb.searchParams.get('state') !== state) throw new Error('state mismatch');
  const code = cb.searchParams.get('code');
  if (!code) throw new Error(`no code ${end.url}`);
  if (opts.codeOnly) return { accessToken: '', idToken: '', sub: '', claims: {}, code, verifier, redirectUri };
  const tr = await fetch(`${PASSPORT}/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier, client_id: clientId }),
  });
  const tj: any = await tr.json();
  if (!tr.ok) throw new Error(`token exchange: ${JSON.stringify(tj)}`);
  const claims = decodeJwt(tj.access_token);
  return { accessToken: tj.access_token, idToken: tj.id_token, refreshToken: tj.refresh_token, sub: claims.sub, sid: claims.sid, claims };
}
