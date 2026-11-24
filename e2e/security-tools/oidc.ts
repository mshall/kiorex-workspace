import { createHash, randomBytes } from 'node:crypto';
import { PASSPORT, PATIENT_1 } from '../src/env.js';
import { loginWithPhone } from '../src/passport.js';
const q = (o: Record<string,string>) => new URLSearchParams(o).toString();
const base = { client_id: 'kiorex-web', response_type: 'code', scope: 'openid profile phone kx', state: 's1' };
const chal = createHash('sha256').update('v'.repeat(43)).digest('base64url');
async function auth(extra: Record<string,string>, label: string) {
  const r = await fetch(`${PASSPORT}/auth?${q({ ...base, ...extra })}`, { redirect: 'manual' });
  const loc = r.headers.get('location') ?? '';
  console.log(label.padEnd(34), r.status, loc.slice(0, 110));
}
await auth({ redirect_uri: 'http://localhost:5180/auth/callback', code_challenge: chal, code_challenge_method: 'S256' }, 'baseline');
await auth({ redirect_uri: 'http://localhost:5180/auth/callback' }, 'no PKCE');
await auth({ redirect_uri: 'http://localhost:5180/auth/callback', code_challenge: chal, code_challenge_method: 'plain' }, 'PKCE plain');
await auth({ redirect_uri: 'http://localhost:5180/auth/callback/../evil', code_challenge: chal, code_challenge_method: 'S256' }, 'path traversal redirect');
await auth({ redirect_uri: 'http://localhost:5180/auth/callback?x=1', code_challenge: chal, code_challenge_method: 'S256' }, 'extra query redirect');
await auth({ redirect_uri: 'http://localhost:5180.evil.com/auth/callback', code_challenge: chal, code_challenge_method: 'S256' }, 'host suffix');
await auth({ redirect_uri: 'http://evil.com/auth/callback', code_challenge: chal, code_challenge_method: 'S256' }, 'other host');
await auth({ redirect_uri: 'http://localhost:5180/auth/callbackX', code_challenge: chal, code_challenge_method: 'S256' }, 'prefix path');
await auth({ redirect_uri: 'http://localhost:5180/auth/callback', response_type: 'id_token', nonce: 'n', code_challenge: chal, code_challenge_method: 'S256' }, 'implicit id_token');
await auth({ redirect_uri: 'http://localhost:5180/auth/callback', response_type: 'token', code_challenge: chal, code_challenge_method: 'S256' }, 'implicit token');
await auth({ redirect_uri: 'http://localhost:5180/auth/callback', client_id: 'nope', code_challenge: chal, code_challenge_method: 'S256' }, 'unknown client');
// code reuse + refresh reuse
const l = await loginWithPhone(PATIENT_1);
const tok = async (form: Record<string,string>) => { const r = await fetch(`${PASSPORT}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: q(form) }); return { s: r.status, j: await r.json() as any }; };
const r1 = await tok({ grant_type: 'refresh_token', refresh_token: l.refreshToken!, client_id: 'kiorex-web' });
console.log('refresh #1', r1.s, Object.keys(r1.j).join(','));
const r2 = await tok({ grant_type: 'refresh_token', refresh_token: l.refreshToken!, client_id: 'kiorex-web' });
console.log('refresh reuse of old', r2.s, JSON.stringify(r2.j).slice(0,100));
const r3 = await tok({ grant_type: 'refresh_token', refresh_token: r1.j.refresh_token, client_id: 'kiorex-web' });
console.log('refresh with rotated (after reuse -> should be revoked)', r3.s, JSON.stringify(r3.j).slice(0,100));
// code reuse
const c = await loginWithPhone(PATIENT_1, { codeOnly: true }) as any;
const a = await tok({ grant_type: 'authorization_code', code: c.code, redirect_uri: c.redirectUri, code_verifier: c.verifier, client_id: 'kiorex-web' });
const b = await tok({ grant_type: 'authorization_code', code: c.code, redirect_uri: c.redirectUri, code_verifier: c.verifier, client_id: 'kiorex-web' });
console.log('code first', a.s, 'reuse', b.s);
const c2 = await loginWithPhone(PATIENT_1, { codeOnly: true }) as any;
const w = await tok({ grant_type: 'authorization_code', code: c2.code, redirect_uri: c2.redirectUri, code_verifier: 'wrong'.repeat(10), client_id: 'kiorex-web' });
console.log('wrong verifier', w.s);
const w2 = await tok({ grant_type: 'authorization_code', code: c2.code, redirect_uri: 'http://localhost:5180/other', code_verifier: c2.verifier, client_id: 'kiorex-web' });
console.log('after fail, redirect mismatch', w2.s);
// userinfo / introspection abuse
const ui = await fetch(`${PASSPORT}/token/introspection`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: q({ token: l.accessToken, client_id: 'kiorex-web' }) });
console.log('introspection by public client', ui.status, (await ui.text()).slice(0,100));
