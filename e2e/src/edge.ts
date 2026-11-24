import { createHmac, randomUUID } from 'node:crypto';
import { KIOREX_API, FLAGS_SECRET } from './env.js';
import { partnerCall } from './hmac.js';
import { kiorex, q } from './clients.js';

/** Unique per-run prefix for every row an edge suite creates, so a cleanup can target it and reruns never collide. */
export const edgePrefix = (tag: string) => `edge_${tag}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/** Must equal PSP_FAKE_WEBHOOK_SECRET of the running Kiorex API (sandbox-fake PSP; .env.example default). */
export const PSP_FAKE_SECRET = process.env.E2E_PSP_FAKE_SECRET ?? 'psp_fake_secret_change_me';

export interface PspEvent { eventId: string; type: 'payment.captured' | 'payment.failed' | 'refund.settled'; pspRef: string; paymentId?: string; amountMinor: number; feeMinor?: number; occurredAt: string; currency?: string }

/** Raw signed delivery of a sandbox PSP webhook, exactly as the PSP would send it (HMAC over the raw body). */
export async function pspDeliver(psp: string, ev: PspEvent | Record<string, unknown>, opts: { badSig?: boolean; raw?: string; sendRaw?: string } = {}) {
  const raw = opts.raw ?? JSON.stringify(ev);
  const sig = createHmac('sha256', PSP_FAKE_SECRET).update(raw).digest('hex');
  const res = await fetch(`${KIOREX_API}/pay/webhooks/${psp}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-psp-signature': opts.badSig ? sig.replace(/.$/, sig.endsWith('0') ? '1' : '0') : sig }, body: opts.sendRaw ?? raw });
  const text = await res.text(); let body: any; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
export const pspEvent = (p: { id: string; pspRef: string; amountMinor: number }, type: PspEvent['type'], over: Partial<PspEvent> = {}): PspEvent =>
  ({ eventId: `pspev_${randomUUID()}`, type, pspRef: p.pspRef, paymentId: p.id, amountMinor: p.amountMinor, feeMinor: 0, occurredAt: new Date().toISOString(), ...over });

/** Kiorly Clinic registers a pay link at Kiorex (product-key HMAC, as the real clinic does). */
export async function registerPayLink(i: { token: string; clinicId: string; amountMinor: number; currency?: string; externalRef?: string }) {
  return partnerCall(KIOREX_API.replace(/\/api\/v1$/, ''), { key: 'ff_kiorly-clinic_dev', secret: FLAGS_SECRET }, 'POST', '/api/v1/pay/links', i, { 'x-kiorex-product-key': 'ff_kiorly-clinic_dev' });
}
export async function payLinkIntent(prefix: string, amountMinor = 10_000) {
  const token = `${prefix}_${randomUUID().slice(0, 8)}`; const clinicId = `${prefix}_clinic`;
  const r = await registerPayLink({ token, clinicId, amountMinor });
  if (r.status !== 201) throw new Error(`pay link ${r.status} ${JSON.stringify(r.body)}`);
  const co = await kiorex(undefined, 'POST', `/pay/links/${token}/checkout`);
  if (co.status !== 200) throw new Error(`checkout ${co.status} ${JSON.stringify(co.body)}`);
  const row = (await q('kiorex_platform', `select id, "pspRef", psp, "amountMinor", status from "PaymentIntent" where id = $1`, [co.body.paymentId]))[0];
  return { token, clinicId, ...row } as { token: string; clinicId: string; id: string; pspRef: string; psp: string; amountMinor: number; status: string };
}
export async function intentRow(id: string) {
  return (await q('kiorex_platform', `select status, "refundedMinor", "releasedAt", "feeMinor" from "PaymentIntent" where id = $1`, [id]))[0];
}
/** Net ledger balance for one account (credit-normal accounts: credit - debit). */
export async function ledgerBalance(account: string): Promise<number> {
  const r = await q('kiorex_platform', `select coalesce(sum("creditMinor" - "debitMinor"), 0)::int b from "LedgerEntry" where account = $1`, [account]);
  return r[0].b;
}

/**
 * Removes everything an edge suite left in the Kiorex platform DB for payments whose clinicId starts with `prefix`. The ledger is append-only
 * (triggers), so like purgeTenant this switches FK checks and triggers off for ONE transaction (dev databases only).
 */
export async function purgeEdgePayments(prefix: string) {
  const { pool } = await import('./db.js');
  const c = await pool('kiorex_platform').connect();
  try {
    await c.query('BEGIN'); await c.query('SET LOCAL session_replication_role = replica');
    const ids = (await c.query(`select id from "PaymentIntent" where "clinicId" like $1`, [`${prefix}%`])).rows.map((r) => r.id as string);
    if (ids.length) {
      await c.query(`delete from "LedgerEntry" where "txId" in (select id from "LedgerTx" where "paymentId" = any($1))`, [ids]);
      await c.query(`delete from "LedgerTx" where "paymentId" = any($1)`, [ids]);
      const rf = (await c.query(`select id from "Refund" where "paymentId" = any($1)`, [ids])).rows.map((r) => r.id as string);
      await c.query(`delete from "OutboxEvent" where "aggregateId" = any($1) or "aggregateId" = any($2) or payload->>'paymentId' = any($1)`, [ids, rf]);
      await c.query(`delete from "Refund" where "paymentId" = any($1)`, [ids]);
      await c.query(`delete from "WebhookReceipt" where "aggregateId" = any($1) or payload->>'paymentId' = any($1)`, [ids]);
      await c.query(`delete from "PaymentIntent" where id = any($1)`, [ids]);
    }
    await c.query(`delete from "PayLink" where "clinicId" like $1`, [`${prefix}%`]);
    await c.query(`delete from "Payout" where "clinicId" like $1`, [`${prefix}%`]);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => undefined); throw e; } finally { c.release(); }
}

/** A signed Kiorly -> Kiorex outbox event for a booking (what the Clinic outbox would send), to drive lifecycle edges without clinic UI work. */
export async function kiorlyEvent(bookingId: string, appointmentId: string, type: string, data: Record<string, unknown> = {}) {
  const { kiorexWebhook } = await import('./hmac.js');
  const { WEBHOOK_SECRET } = await import('./env.js');
  const eventId = `edge-${randomUUID()}`;
  return kiorexWebhook(WEBHOOK_SECRET, '/webhooks/kiorly', { eventId, type, aggregateType: 'Appointment', aggregateId: appointmentId, occurredAt: new Date().toISOString(), target: 'KIOREX', data: { externalReference: bookingId, appointmentId, ...data } });
}
