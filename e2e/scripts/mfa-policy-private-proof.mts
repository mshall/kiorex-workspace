/**
 * PRIVATE-STACK proof that Pharmacy follows the Passport MFA policy (28 Nov 2026). NEVER point it at kx-test: it flips the policy by SQL in a throwaway Passport database.
 *
 *   Passport dev IdP  http://localhost:4491   private DB kxa_passport_proof (`KX_DB_SCHEMA` default, port 4491, fake upstream 4492)
 *   Pharmacy API      http://localhost:3191   NODE_ENV=production AUTH_MODE=both OIDC_ISSUER=<Passport> OIDC_PHONE_LINK=true, private DB kxa_pharmacy_proof
 *
 * Run: npx tsx e2e/scripts/mfa-policy-private-proof.mts   (PASSPORT, PHARMACY and PGURL are overridable; refuses any non-localhost URL)
 * Steps: sign up a pharmacy owner -> Passport sign-in (policy OFF) -> /auth/me 200 without an authenticator -> policy ON (SQL) -> a new Passport sign-in is walked through
 * enrolment (setup key + code), carries the MFA claim and works -> a password session started while the policy was off is refused; the password route is refused for the owner.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Client } from 'pg';

const PASSPORT = process.env.PASSPORT ?? 'http://localhost:4491';
const PHARMACY = process.env.PHARMACY ?? 'http://localhost:3191';
const PGURL = process.env.PGURL ?? 'postgresql://postgres:postgres@127.0.0.1:5433/kxa_passport_proof';
for (const u of [PASSPORT, PHARMACY, PGURL]) if (!/localhost|127\.0\.0\.1/.test(u)) { console.error(`refusing non-local target ${u.replace(/:[^:@/]*@/, ':***@')}`); process.exit(2); }
const REDIRECT = 'http://localhost:5192/auth/callback';
const results: Array<[string, boolean, string?]> = [];
const check = (name: string, ok: boolean, detail?: string) => { results.push([name, ok, detail]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

class Jar {
  private c = new Map<string, string>();
  async req(url: string, init: RequestInit & { form?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { 'user-agent': 'private-proof', 'x-forwarded-for': '10.77.0.1', ...(init.headers as Record<string, string>) };
    if (this.c.size) headers.cookie = [...this.c].map(([k, v]) => `${k}=${v}`).join('; ');
    let body = init.body as string | undefined;
    if (init.form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(init.form).toString(); }
    const res = await fetch(url, { ...init, headers, body, redirect: 'manual' });
    for (const sc of res.headers.getSetCookie()) { const [p] = sc.split(';'); const i = p.indexOf('='); const k = p.slice(0, i), v = p.slice(i + 1); if (!v || /expires=Thu, 01 Jan 1970/i.test(sc)) this.c.delete(k); else this.c.set(k, v); }
    return res;
  }
  async follow(res: Response, base: string) { let url = base; while (res.status >= 300 && res.status < 400) { url = new URL(res.headers.get('location')!, url).toString(); if (url.startsWith(REDIRECT)) return { res, url }; res = await this.req(url); } return { res, url }; }
}
const b32 = (s: string) => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; for (const ch of s.replace(/=+$/, '')) bits += A.indexOf(ch).toString(2).padStart(5, '0'); const out: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
const totp = (secret: string, t = Date.now()) => { const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(t / 30000))); const h = createHmac('sha1', b32(secret)).update(ctr).digest(); const o = h[19] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, '0'); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const post = async (url: string, body: unknown, headers: Record<string, string> = {}) => { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) as any }; };
const get = async (url: string, token: string) => { const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } }); return { status: r.status, body: await r.json().catch(() => ({})) as any }; };

async function otpFor(phone: string, before: number): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const j = await (await fetch(`${PASSPORT}/dev/inbox?to=${encodeURIComponent(phone)}`)).json() as { messages: Array<{ id: number; body?: string; text?: string; params?: unknown }> };
    const m = j.messages.filter((x) => x.id > before).pop();
    if (m) { const mm = /\b(\d{6})\b/.exec(JSON.stringify(m)); if (mm) return mm[1]; }
    await sleep(300);
  }
  throw new Error('no one-time code in the dev inbox');
}
const lastInboxId = async (phone: string) => { const j = await (await fetch(`${PASSPORT}/dev/inbox?to=${encodeURIComponent(phone)}`)).json() as { messages: Array<{ id: number }> }; return j.messages.at(-1)?.id ?? 0; };

/** Authorization-code + PKCE sign-in through the real hosted pages. Returns what the person met and the Pharmacy session. */
async function signIn(phone: string, o: { claim?: string; enrolWith?: boolean } = {}) {
  const jar = new Jar(); const verifier = randomBytes(32).toString('base64url'); const challenge = createHash('sha256').update(verifier).digest('base64url'); const nonce = verifier.slice(0, 8);
  const q = new URLSearchParams({ client_id: 'kiorly-pharmacy-web', redirect_uri: REDIRECT, response_type: 'code', scope: 'openid profile phone', state: 's1', nonce, code_challenge: challenge, code_challenge_method: 'S256', ui_locales: 'en', prompt: 'login' });
  const a = await jar.follow(await jar.req(`${PASSPORT}/auth?${q}`), PASSPORT);
  const uid = new URL(a.url).pathname.split('/')[2]!;
  await jar.req(`${PASSPORT}/interaction/${uid}`);
  const before = await lastInboxId(phone);
  const ph = await jar.req(`${PASSPORT}/interaction/${uid}/phone`, { method: 'POST', form: { phone, lang: 'en' } }); if (ph.status !== 200) throw new Error(`phone ${ph.status}`);
  let r = await jar.req(`${PASSPORT}/interaction/${uid}/verify`, { method: 'POST', form: { code: await otpFor(phone, before), lang: 'en' } });
  let html = await r.text(); let enrolment = false; let offered = false; let secret = '';
  if (html.includes('id="totp-secret"')) { // mandatory enrolment page: setup key shown, no skip
    enrolment = true; secret = /id="totp-secret"><code>([A-Z2-7]+)<\/code>/.exec(html)![1]!; const noSkip = !html.includes('totp-skip');
    check('enrolment page cannot be skipped', noSkip);
    r = await jar.req(`${PASSPORT}/interaction/${uid}/totp`, { method: 'POST', form: { totp: totp(secret), lang: 'en' } }); html = await r.text();
  } else if (html.includes('id="totp"')) { offered = true; }
  if (r.status === 200) r = await jar.req(`${PASSPORT}/interaction/${uid}/finish`, { method: 'POST', form: { lang: 'en' } }); // passkey offer: skip
  const done = await jar.follow(r, PASSPORT);
  const code = new URL(done.url).searchParams.get('code'); if (!code) throw new Error(`no code at the callback: ${done.url}`);
  const ex = await post(`${PHARMACY}/api/v1/auth/oidc/exchange`, { code, codeVerifier: verifier, redirectUri: REDIRECT, nonce, ...(o.claim ? { claim: o.claim } : {}) });
  return { enrolment, offered, secret, exchange: ex, token: ex.body.accessToken as string | undefined };
}

const run = async () => {
  const tag = randomBytes(3).toString('hex'); const phone = `+2012${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`; const email = `owner.${tag}@proof.kiorly.test`; const password = `Pr-${randomBytes(9).toString('base64url')}`;
  const pg = new Client({ connectionString: PGURL }); await pg.connect();
  const policyRow = await pg.query('select version, policy from mfa_policy where id = 1');
  check('private Passport starts with the policy OFF', !policyRow.rows[0] || policyRow.rows[0].policy.enabled === false);
  const cov0 = await (await fetch(`${PASSPORT}/.well-known/kiorex-mfa-policy`)).json() as any;
  check('public coverage: pharmacy mandatory list empty', cov0.types.pharmacy.mandatory.length === 0);

  // 1. sign up the owner (standalone), continue with Passport using the claim
  const su = await post(`${PHARMACY}/api/v1/onboarding/signup`, { pharmacyName: `[TEST] Proof ${tag}`, ownerName: 'Proof Owner', email, password });
  check('self sign-up answers 201 with an owner claim', su.status === 201 && !!su.body.ownerClaim, String(su.status));
  const s1 = await signIn(phone, { claim: su.body.ownerClaim });
  check('policy OFF: no enrolment page, no authenticator needed', !s1.enrolment);
  check('policy OFF: Passport session exchange succeeds', s1.exchange.status === 200 || s1.exchange.status === 201, JSON.stringify(s1.exchange.body).slice(0, 120));
  const me1 = await get(`${PHARMACY}/api/v1/auth/me`, s1.token!);
  check('policy OFF: privileged OWNER without an authenticator works (/auth/me 200)', me1.status === 200 && JSON.stringify(me1.body).includes('OWNER'), String(me1.status));

  // 2. the same owner may use a password while the policy is OFF (AUTH_MODE=both)
  const pwOff = await post(`${PHARMACY}/api/v1/auth/login`, { email, password });
  const me2 = pwOff.status === 200 ? await get(`${PHARMACY}/api/v1/auth/me`, pwOff.body.accessToken) : { status: 0 };
  check('policy OFF: owner e-mail + password sign-in is allowed and works', pwOff.status === 200 && me2.status === 200, `${pwOff.status}/${me2.status}`);

  // 3. register the pharmacy in Passport (as platform onboarding does) so the policy can match the owner, then turn the policy ON by SQL (PRIVATE database only)
  const acc = await pg.query(`select sub from accounts where phone = $1`, [phone]); const ownerSub = acc.rows[0]?.sub as string;
  check('Passport account exists for the verified phone', !!ownerSub);
  // an organisation of type pharmacy with the owner as member
  const orgId = `org_proof_${tag}`;
  await pg.query(`insert into organizations (org_id, legal_name, country, edition, status, product_refs, created_by, data_class) values ($1,$2,'eg','CLINIC','active',$3,$4,'DEMO')`, [orgId, `[TEST] Proof ${tag}`, JSON.stringify({ kiorly_pharmacy_tenant_id: `t_${tag}` }), ownerSub]);
  await pg.query(`insert into memberships (id, org_id, sub, role_hint, status, effective_from) values ($1,$2,$3,'owner','active', now() - interval '1 minute')`, [`m_${tag}`, orgId, ownerSub]);
  await pg.query(`insert into mfa_policy (id, policy, version, updated_by, updated_at) values (1, $1, 1, null, now()) on conflict (id) do update set policy = excluded.policy, version = mfa_policy.version + 1, updated_at = now()`, [JSON.stringify({ enabled: true, rules: [{ scope: 'org_type', value: 'pharmacy', roles: ['owner', 'pharmacist'] }] })]);
  const cov1 = await (await fetch(`${PASSPORT}/.well-known/kiorex-mfa-policy`)).json() as any;
  check('policy ON (private DB): public coverage lists owner and pharmacist for pharmacy', cov1.enabled === true && cov1.types.pharmacy.mandatory.join() === 'owner,pharmacist');
  await sleep(16_000); // the product caches the policy for 15 s

  // 4. effects on the product
  const old = await get(`${PHARMACY}/api/v1/auth/me`, pwOff.body.accessToken);
  check('policy ON: the password session started while OFF is refused with MFA_REQUIRED', old.status === 403 && JSON.stringify(old.body).includes('MFA_REQUIRED'), `${old.status}`);
  const oldPassport = await get(`${PHARMACY}/api/v1/auth/me`, s1.token!);
  check('policy ON: the earlier Passport session (no MFA claim) is refused with MFA_REQUIRED', oldPassport.status === 403 && JSON.stringify(oldPassport.body).includes('MFA_REQUIRED'), `${oldPassport.status}`);
  const pwOn = await post(`${PHARMACY}/api/v1/auth/login`, { email, password });
  check('policy ON: owner e-mail + password is refused with PASSPORT_REQUIRED_FOR_ROLE', pwOn.status === 403 && pwOn.body.code === 'PASSPORT_REQUIRED_FOR_ROLE', `${pwOn.status} ${pwOn.body.code}`);
  const s2 = await signIn(phone);
  check('policy ON: the next Passport sign-in forces the enrolment page', s2.enrolment);
  const me3 = await get(`${PHARMACY}/api/v1/auth/me`, s2.token!);
  check('policy ON: after enrolment the session carries the MFA claim and works (/auth/me 200)', me3.status === 200, String(me3.status));

  // 5. back to OFF (SQL, private): the enrolled owner is only OFFERED the code; skipping works
  await pg.query(`update mfa_policy set policy = $1, version = version + 1 where id = 1`, [JSON.stringify({ enabled: false, rules: [] })]);
  await sleep(16_000);
  const pwBack = await post(`${PHARMACY}/api/v1/auth/login`, { email, password });
  check('policy OFF again: the owner password sign-in works again', pwBack.status === 200, String(pwBack.status));
  await pg.end();
};
run().then(() => { const bad = results.filter((r) => !r[1]); console.log(`\n${results.length - bad.length}/${results.length} passed`); process.exit(bad.length ? 1 : 0); }).catch((e) => { console.error('ERROR', e); process.exit(1); });
