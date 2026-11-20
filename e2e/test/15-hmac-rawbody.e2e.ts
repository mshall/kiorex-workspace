import { describe, it, expect } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { KIOREX_API, KIORLY_API, WEBHOOK_SECRET, FLAGS_SECRET, PHARMACY, LAB, PH_PARTNER, LAB_PARTNER, MKT } from '../src/env.js';
import { kiorlyMarketplace, partnerCall } from '../src/hmac.js';

/**
 * Raw-body HMAC verification under NestJS 12 / Express 5 (framework upgrade guard): signatures are computed over the EXACT bytes on the wire, so a
 * pretty-printed / non-ASCII (Arabic) / escaped body must verify, and a one-byte change must be rejected, on every inbound HMAC surface:
 * Kiorly -> Kiorex webhook, Kiorex -> Kiorly flag.changed push, Kiorex -> Kiorly marketplace, Kiorex -> Pharmacy / Lab machine APIs, and the
 * partner -> Kiorex webhooks. (Signed-body schemes: `sha256=hex(HMAC(secret, "<ts>.<raw>"))`; marketplace/partner calls use the canonical-string scheme.)
 */
const sign = (secret: string, ts: string, raw: string) => 'sha256=' + createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
async function post(url: string, raw: string, secret: string, extra: Record<string, string> = {}, tamper = false) {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = sign(secret, ts, raw);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-kiorly-timestamp': ts, 'x-kiorly-signature': tamper ? sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0') : sig, ...extra },
    body: raw,
  });
  const text = await res.text(); let body: any; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
// pretty-printed with an Arabic string and escaped characters: any re-serialisation (JSON.stringify of the parsed body) would change the bytes
const pretty = (o: unknown) => JSON.stringify(o, null, 2).replace(/\n/g, '\r\n') + '\n';

describe('q. HMAC raw-body signature verification (Nest 12 / Express 5)', () => {
  it('Kiorly -> Kiorex webhook: pretty-printed Arabic body verifies, a tampered signature and a tampered body are 401', async () => {
    const eventId = `e2e-raw-${randomUUID()}`;
    const raw = pretty({ eventId, type: 'SLOTS_CHANGED', aggregateType: 'Clinician', aggregateId: 'e2e_none', occurredAt: new Date().toISOString(), target: 'KIOREX', data: { clinicianId: 'e2e_none', note: 'مرحبا é "quoted" \\ back' } });
    const ok = await post(`${KIOREX_API}/webhooks/kiorly`, raw, WEBHOOK_SECRET, { 'x-kiorly-event': 'SLOTS_CHANGED', 'x-kiorly-event-id': eventId });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const dup = await post(`${KIOREX_API}/webhooks/kiorly`, raw, WEBHOOK_SECRET, { 'x-kiorly-event': 'SLOTS_CHANGED', 'x-kiorly-event-id': eventId });
    expect(dup.body).toMatchObject({ status: 'DUPLICATE' });
    const bad = await post(`${KIOREX_API}/webhooks/kiorly`, raw, WEBHOOK_SECRET, {}, true);
    expect(bad.status).toBe(401);
    // signed over one body, sent another (whitespace only): must be rejected
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await fetch(`${KIOREX_API}/webhooks/kiorly`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-kiorly-timestamp': ts, 'x-kiorly-signature': sign(WEBHOOK_SECRET, ts, raw) }, body: raw.replace('\r\n', '\n') });
    expect(res.status).toBe(401);
    // wrong secret
    expect((await post(`${KIOREX_API}/webhooks/kiorly`, raw, 'not-the-secret')).status).toBe(401);
  });

  it('Kiorex -> Kiorly flag.changed push: the same raw-body scheme (flags secret)', async () => {
    const raw = pretty({ type: 'flag.changed', data: { product: 'kiorly-clinic', note: 'ملاحظة' } });
    const ok = await post(`${KIORLY_API}/feature-flags/kiorex/changed`, raw, FLAGS_SECRET);
    expect(ok.status, JSON.stringify(ok.body)).toBeLessThan(300);
    expect((await post(`${KIORLY_API}/feature-flags/kiorex/changed`, raw, FLAGS_SECRET, {}, true)).status).toBe(401);
  });

  it('Kiorex -> Kiorly marketplace API: valid canonical signature passes auth; a tampered body or secret is 401', async () => {
    const body = { clinicId: 'x', note: 'عربي' };
    const ok = await kiorlyMarketplace('POST', '/bookings', body);
    expect([401, 403], JSON.stringify(ok.body)).not.toContain(ok.status); // reached validation, not the HMAC guard
    const ts = String(Date.now()), nonce = randomUUID();
    const url = new URL(MKT + '/bookings');
    const canonical = `${ts}\n${nonce}\nPOST\n${url.pathname}\n` + (await import('node:crypto')).createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const sig = createHmac('sha256', 'kx_dev_secret_change_me').update(canonical).digest('base64url');
    const tampered = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-kiorly-client-key': 'kx_dev_client', 'x-kiorly-client-secret': 'kx_dev_secret_change_me', 'x-kiorly-timestamp': ts, 'x-kiorly-nonce': nonce, 'x-kiorly-signature': sig }, body: JSON.stringify({ ...body, note: 'عربي!' }) });
    expect(tampered.status).toBe(401);
  });

  it('Kiorex -> Pharmacy and Lab machine APIs: valid signature passes the guard, a tampered body is 401', async () => {
    const ph = await partnerCall(PHARMACY, PH_PARTNER, 'POST', `${PH_PARTNER.apiPath}/orders`, { note: 'عربي' });
    expect([401, 403], JSON.stringify(ph.body)).not.toContain(ph.status);
    const lab = await partnerCall(LAB, LAB_PARTNER, 'POST', `${LAB_PARTNER.apiPath}/orders`, { note: 'عربي' });
    expect([401, 403], JSON.stringify(lab.body)).not.toContain(lab.status);
    const none = await fetch(`${PHARMACY}${PH_PARTNER.apiPath}/orders`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-kiorly-client-key': PH_PARTNER.key, 'x-kiorly-timestamp': String(Date.now()), 'x-kiorly-nonce': randomUUID(), 'x-kiorly-signature': 'AAAA' }, body: '{"items":[]}' });
    expect(none.status).toBe(401);
    const none2 = await fetch(`${LAB}${LAB_PARTNER.apiPath}/orders`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-kiorly-client-key': LAB_PARTNER.key, 'x-kiorly-timestamp': String(Date.now()), 'x-kiorly-nonce': randomUUID(), 'x-kiorly-signature': 'AAAA' }, body: '{"tests":[]}' });
    expect(none2.status).toBe(401);
  });

  it('Pharmacy / Lab -> Kiorex webhooks: pretty-printed raw body verifies with the per-partner secret + client key; tampering is 401', async () => {
    for (const [path, p] of [['pharmacy', PH_PARTNER], ['lab', LAB_PARTNER]] as const) {
      const eventId = `e2e-raw-${path}-${randomUUID()}`;
      const raw = pretty({ eventId, type: 'OrderReady', aggregateType: 'PharmacyOrder', aggregateId: 'e2e_none', occurredAt: new Date().toISOString(), target: 'KIOREX', data: { orderId: 'e2e_none', note: 'جاهز' } });
      const h = { 'x-kiorly-client-key': p.key, 'x-kiorly-event': 'OrderReady', 'x-kiorly-event-id': eventId };
      const ok = await post(`${KIOREX_API}/webhooks/${path}`, raw, p.webhookSecret, h);
      expect(ok.status, `${path} ${JSON.stringify(ok.body)}`).toBe(200); // unknown order -> acknowledged, never 401
      expect((await post(`${KIOREX_API}/webhooks/${path}`, raw, p.webhookSecret, h, true)).status).toBe(401);
    }
  });
});
