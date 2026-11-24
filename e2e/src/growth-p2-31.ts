import { kiorex, q, staffLogin, waitFor, syncProviders } from './clients.js';
import type { Provider } from './fixtures.js';

/** Helpers of suite 31 (referral and rewards on the real stack). Add-only. */
const ops = '/ops/growth/config';

/** Activates a config version with maker-checker over the real API (two different super admins). Returns the version id. */
export async function activateConfig(maker: string, checker: string, kind: string, payload: Record<string, unknown>, ticket = 'E2E-31'): Promise<string> {
  const d = await kiorex(maker, 'POST', ops, { kind, scope: 'GLOBAL', scopeId: '', payload, reason: 'e2e suite 31', ticket, announcement: 'Test values for the end-to-end suite on a private stack.' });
  if (d.status !== 201) throw new Error(`config draft ${kind} ${d.status} ${JSON.stringify(d.body)}`);
  const s = await kiorex(maker, 'POST', `${ops}/${d.body.id}/submit`); if (s.status !== 200) throw new Error(`config submit ${s.status} ${JSON.stringify(s.body)}`);
  const a = await kiorex(checker, 'POST', `${ops}/${d.body.id}/approve`); if (a.status !== 200) throw new Error(`config approve ${a.status} ${JSON.stringify(a.body)}`);
  return d.body.id as string;
}
export const inForce = async (token: string, kind: string) => (await kiorex(token, 'GET', `${ops}/in-force?kind=${kind}`)).body as { versionId: string; payload: any };

/** Puts a test deposit on the marketplace visit types of the provider's clinic and syncs it into Kiorex (as suite 07). Returns the undo. */
export async function depositOnVisitType(opsToken: string, p: Provider, amountEgp: number): Promise<() => Promise<void>> {
  const clinicId = (await q('kiorly', `select "clinicId" from "MarketplaceListing" where id = $1`, [p.id]))[0].clinicId as string;
  const rows = await q('kiorly', `update "AppointmentType" set "depositAmount" = $2 where "clinicId" = $1 and "marketplaceBookable" returning id`, [clinicId, amountEgp]);
  const bump = async () => { await q('kiorly', `update "MarketplaceListing" set "updatedAt" = greatest(now() at time zone 'utc', "updatedAt") + interval '1 second' where "clinicianId" = (select "clinicianId" from "MarketplaceListing" where id = $1)`, [p.id]); await syncProviders(opsToken); };
  await bump();
  return async () => { await q('kiorly', `update "AppointmentType" set "depositAmount" = null where id = any($1)`, [rows.map((r) => r.id)]); await bump(); };
}

/** Pays the deposit of a booking through the sandbox PSP and waits until Kiorex says PAID. Returns the checkout answer. */
export async function payDeposit(token: string, bookingId: string, body: Record<string, unknown> = {}) {
  const co = await kiorex(token, 'POST', `/bookings/${bookingId}/deposit-checkout`, body); if (co.status !== 200) throw new Error(`checkout ${co.status} ${JSON.stringify(co.body)}`);
  const done = await kiorex(undefined, 'POST', `/pay/fake-checkout/${co.body.paymentId}/complete`, { outcome: 'pay' }); if (done.status !== 200) throw new Error(`fake pay ${done.status}`);
  await waitFor('deposit PAID', async () => (await kiorex(token, 'GET', `/bookings/${bookingId}`)).body.depositStatus === 'PAID');
  return co.body;
}
export { staffLogin };
