import { createHash, createHmac, randomUUID } from 'node:crypto';
const MKT = 'http://localhost:4301/marketplace/v1'; const KEY = 'kx_dev_client', SEC = 'kx_dev_secret_change_me';
const sha = (b?: string) => createHash('sha256').update(b ?? '').digest('hex');
async function call(o: { path: string; method?: string; body?: unknown; ts?: string; nonce?: string; secret?: string; signWith?: string; signPath?: string; omit?: string[]; tamper?: boolean }) {
  const method = o.method ?? 'GET'; const url = new URL(MKT + o.path);
  const raw = o.body === undefined ? undefined : JSON.stringify(o.body);
  const ts = o.ts ?? String(Date.now()), nonce = o.nonce ?? randomUUID();
  const canon = `${ts}\n${nonce}\n${method}\n${o.signPath ?? url.pathname}\n${sha(raw)}`;
  const sig = createHmac('sha256', o.signWith ?? SEC).update(canon).digest('base64url');
  const h: Record<string,string> = { 'content-type': 'application/json', 'x-kiorly-client-key': KEY, 'x-kiorly-client-secret': o.secret ?? SEC, 'x-kiorly-timestamp': ts, 'x-kiorly-nonce': nonce, 'x-kiorly-signature': sig };
  for (const k of o.omit ?? []) delete h[k];
  const res = await fetch(url, { method, headers: h, body: o.tamper && raw ? raw.replace('"', '" ') : raw });
  return res.status;
}
const n = randomUUID();
console.log('valid', await call({ path: '/clinics' , nonce: n}));
console.log('replay same nonce', await call({ path: '/clinics', nonce: n }));
console.log('stale ts -10min', await call({ path: '/clinics', ts: String(Date.now() - 600_000) }));
console.log('future ts +10min', await call({ path: '/clinics', ts: String(Date.now() + 600_000) }));
console.log('wrong secret', await call({ path: '/clinics', secret: 'nope' }));
console.log('right secret, sig by other key', await call({ path: '/clinics', signWith: 'other' }));
console.log('sig for another path', await call({ path: '/clinics', signPath: '/marketplace/v1/providers' }));
console.log('no signature', await call({ path: '/clinics', omit: ['x-kiorly-signature'] }));
console.log('no secret hdr', await call({ path: '/clinics', omit: ['x-kiorly-client-secret'] }));
console.log('no nonce', await call({ path: '/clinics', omit: ['x-kiorly-nonce'] }));
console.log('NaN ts', await call({ path: '/clinics', ts: 'NaN' }));
console.log('unknown key', (await fetch(MKT + '/clinics', { headers: { 'x-kiorly-client-key': 'zzz', 'x-kiorly-client-secret': 'a', 'x-kiorly-timestamp': String(Date.now()), 'x-kiorly-nonce': 'x', 'x-kiorly-signature': 'y' } })).status);
