#!/usr/bin/env node
// DEV ONLY helper for seed-all.sh: logs in as the seeded ops super admin (OTP 000000 + dev TOTP, PKCE) against the local Passport
// and triggers `POST /admin/providers/sync?full=true` on the local Kiorex API so the demo doctors become Providers.
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
const PASSPORT = process.env.PASSPORT_URL ?? 'http://localhost:4400', KIOREX = process.env.KIOREX_URL ?? 'http://localhost:4000/api/v1';
const PHONE_SUPER = '+201000000099', PHONE = PHONE_SUPER, TOTP_SECRET = process.env.OPS_TOTP_SEED ?? JSON.parse(readFileSync(new URL('../kiorex-account/.local/totp-secrets.json', import.meta.url), 'utf8')).secrets[PHONE_SUPER], // local-only, generated per machine REDIRECT = 'http://localhost:5181/auth/callback';
function totp(secret, at = Date.now()) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const ch of secret.toUpperCase()) bits += a.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((x) => parseInt(x, 2))); const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac('sha1', key).update(c).digest(); const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
const jar = new Map(); const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
async function req(url, form) {
  const headers = { 'x-forwarded-for': ip, 'user-agent': 'KiorexDemoSeed/1.0' }; if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  let body; if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
  const res = await fetch(url, { method: form ? 'POST' : 'GET', headers, body, redirect: 'manual' });
  for (const sc of res.headers.getSetCookie()) { const [p] = sc.split(';'); const i = p.indexOf('='); const n = p.slice(0, i), v = p.slice(i + 1); if (!v || /expires=Thu, 01 Jan 1970/i.test(sc)) jar.delete(n); else jar.set(n, v); }
  return res;
}
async function follow(res, base) { let url = base; while (res.status >= 300 && res.status < 400) { url = new URL(res.headers.get('location'), url).toString(); if (url.startsWith(REDIRECT)) return { res, url }; res = await req(url); } return { res, url }; }
const verifier = randomBytes(32).toString('base64url'), state = randomBytes(8).toString('hex');
const q = new URLSearchParams({ client_id: 'kiorex-ops', redirect_uri: REDIRECT, response_type: 'code', scope: 'openid profile phone kx offline_access', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', ui_locales: 'en', prompt: 'login' });
let r = await req(`${PASSPORT}/auth?${q}`); const { url } = await follow(r, PASSPORT); const uid = new URL(url).pathname.split('/')[2];
await req(`${PASSPORT}/interaction/${uid}`); r = await req(`${PASSPORT}/interaction/${uid}/phone`, { phone: PHONE, lang: 'en' });
r = await req(`${PASSPORT}/interaction/${uid}/verify`, { code: '000000', lang: 'en' });
for (let attempt = 0; attempt < 2; attempt++) {
  if (!(await r.clone().text()).includes(`/interaction/${uid}/totp`)) break;
  if (attempt) await new Promise((s) => setTimeout(s, 30000 - (Date.now() % 30000) + 1500));
  r = await req(`${PASSPORT}/interaction/${uid}/totp`, { totp: totp(TOTP_SECRET), lang: 'en' });
}
if (r.status === 200) r = await req(`${PASSPORT}/interaction/${uid}/finish`, { lang: 'en' });
const end = await follow(r, PASSPORT); const code = new URL(end.url).searchParams.get('code'); if (!code) throw new Error('ops login failed: ' + end.url);
const tr = await fetch(`${PASSPORT}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: verifier, client_id: 'kiorex-ops' }) });
const tj = await tr.json(); if (!tr.ok) throw new Error('token: ' + JSON.stringify(tj));
const s = await fetch(`${KIOREX}/admin/providers/sync?full=true`, { method: 'POST', headers: { authorization: `Bearer ${tj.access_token}` } });
console.log('provider sync:', s.status, await s.text());
if (!s.ok) process.exit(1);
