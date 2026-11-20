import { createHash, createHmac, randomUUID } from 'node:crypto';
import { MKT, KIORLY, MKT_KEY, MKT_SECRET, KIOREX_API } from './env.js';

const sha = (b?: string) => createHash('sha256').update(b ?? '').digest('hex');

/** Signed call to Kiorly's marketplace API exactly as the Kiorex backend does it (KX-09 §02). */
export async function kiorlyMarketplace(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const url = new URL(MKT + path);
  const raw = body === undefined ? undefined : JSON.stringify(body);
  const ts = String(Date.now()), nonce = randomUUID();
  const canonical = `${ts}\n${nonce}\n${method.toUpperCase()}\n${url.pathname}\n${sha(raw)}`;
  const sig = createHmac('sha256', MKT_SECRET).update(canonical).digest('base64url');
  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-kiorly-client-key': MKT_KEY, 'x-kiorly-client-secret': MKT_SECRET,
      'x-kiorly-timestamp': ts, 'x-kiorly-nonce': nonce, 'x-kiorly-signature': sig, ...headers,
    },
    body: raw,
  });
  const text = await res.text();
  let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}
export { KIORLY };

/** Signed Kiorex -> partner call (pharmacy / lab machine API) exactly as the Kiorex backend does it: `path` is the FULL path incl. the contract prefix. */
export async function partnerCall(base: string, creds: { key: string; secret: string }, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const url = new URL(base + path);
  const raw = body === undefined ? undefined : JSON.stringify(body);
  const ts = String(Date.now()), nonce = randomUUID();
  const canonical = `${ts}\n${nonce}\n${method.toUpperCase()}\n${url.pathname}\n${sha(raw)}`;
  const sig = createHmac('sha256', creds.secret).update(canonical).digest('base64url');
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json', 'x-kiorly-client-key': creds.key, 'x-kiorly-timestamp': ts, 'x-kiorly-nonce': nonce, 'x-kiorly-signature': sig, ...headers }, body: raw });
  const text = await res.text();
  let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

/** Signed partner/Clinic -> Kiorex webhook (`sha256=hex(HMAC(secret, ts.rawBody))`, ts in seconds). */
export async function kiorexWebhook(secret: string, path: string, envelope: Record<string, unknown>, headers: Record<string, string> = {}) {
  const raw = JSON.stringify(envelope);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = `sha256=${createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex')}`;
  const res = await fetch(`${KIOREX_API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-kiorly-timestamp': ts, 'x-kiorly-signature': sig, 'x-kiorly-event': String(envelope.type), 'x-kiorly-event-id': String(envelope.eventId), ...headers }, body: raw });
  const text = await res.text();
  let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}
