import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Browser } from '@playwright/test';
import { passportSignIn } from '../../kx-test/lib/passport';
import { URLS } from '../../kx-test/lib/hosts';

/**
 * Signs in exactly like the mobile apps do: authorization-code + PKCE (S256) as the public native client, redirect to the custom scheme
 * (`kiorex://auth/callback`, `kiorly://auth/callback`), on the REAL hosted Passport pages (phone one-time code read through SSM). A browser cannot open a
 * custom scheme, so the 303 `Location` header is read instead and the code is exchanged at the token endpoint by plain fetch, as the app does.
 * The tokens go to the git-ignored `.auth/` folder and are reused until they expire (Passport allows 5 codes per phone and 20 per IP and hour).
 */
export interface NativeTokens { accessToken: string; refreshToken?: string; idToken?: string; expiresAt: number; savedAt: number }
const AUTH_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.auth');
const b64u = (b: Buffer) => b.toString('base64url');

export async function nativeSignIn(browser: Browser, o: { clientId: string; scheme: string; scopes: string[]; phone: string; cacheName: string }): Promise<NativeTokens> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const file = path.join(AUTH_DIR, `${o.cacheName}.json`);
  const disc = (await (await fetch(`${URLS.issuer}/.well-known/openid-configuration`)).json()) as { authorization_endpoint: string; token_endpoint: string };
  try {
    const t = JSON.parse(fs.readFileSync(file, 'utf8')) as NativeTokens;
    if (process.env.KX_E2E_FRESH !== '1') {
      if (t.expiresAt - Date.now() > 120_000) return t;
      if (t.refreshToken) { // the app's own silent refresh (rotation): costs no one-time code
        const r = await fetch(disc.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: o.clientId, refresh_token: t.refreshToken }) });
        if (r.ok) {
          const j = (await r.json()) as { access_token: string; refresh_token?: string; id_token?: string; expires_in?: number };
          const n: NativeTokens = { accessToken: j.access_token, refreshToken: j.refresh_token ?? t.refreshToken, idToken: j.id_token ?? t.idToken, expiresAt: Date.now() + (j.expires_in ?? 900) * 1000, savedAt: Date.now() };
          fs.writeFileSync(file, JSON.stringify(n), { mode: 0o600 });
          return n;
        }
      }
    }
  } catch { /* none */ }
  const verifier = b64u(crypto.randomBytes(32));
  const state = b64u(crypto.randomBytes(12));
  const redirect = `${o.scheme}://auth/callback`;
  const u = new URL(disc.authorization_endpoint);
  Object.entries({ client_id: o.clientId, redirect_uri: redirect, response_type: 'code', scope: o.scopes.join(' '), state, code_challenge: b64u(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256' }).forEach(([k, v]) => u.searchParams.set(k, v));
  const ctx = await browser.newContext({ locale: 'en-US' });
  const page = await ctx.newPage();
  let callback: string | null = null;
  page.on('response', (r) => { const loc = r.headers()['location']; if (process.env.KX_DEBUG && loc) console.log('redirect', r.status(), new URL(r.url()).pathname, '->', loc.replace(/code=[^&]+/, 'code=*').slice(0, 140)); if (loc?.startsWith(`${o.scheme}://`)) callback = loc; });
  page.goto(u.toString()).catch(() => undefined);
  try {
    // the page never "leaves" Passport (a browser cannot open the custom scheme) and the authorization code lives only 60 s: stop as soon as the redirect was seen
    const signIn = passportSignIn(page, { phone: o.phone }).catch((e) => { if (!callback) throw e; });
    const seen = (async () => { for (let i = 0; i < 600 && !callback; i++) await new Promise((r) => setTimeout(r, 100)); })();
    await Promise.race([signIn, seen]);
    if (!callback) await seen;
  } finally { await ctx.close().catch(() => undefined); }
  if (!callback) throw new Error('Passport never redirected to the app scheme');
  const cb = new URL(callback);
  if (cb.searchParams.get('state') !== state) throw new Error('state mismatch');
  const code = cb.searchParams.get('code');
  if (!code) throw new Error(`no code in the callback (${cb.searchParams.get('error') ?? 'unknown'})`);
  const res = await fetch(disc.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: o.clientId, code, redirect_uri: redirect, code_verifier: verifier }) });
  if (!res.ok) throw new Error(`token endpoint ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { access_token: string; refresh_token?: string; id_token?: string; expires_in?: number };
  const t: NativeTokens = { accessToken: j.access_token, refreshToken: j.refresh_token, idToken: j.id_token, expiresAt: Date.now() + (j.expires_in ?? 900) * 1000, savedAt: Date.now() };
  fs.writeFileSync(file, JSON.stringify(t), { mode: 0o600 });
  return t;
}
