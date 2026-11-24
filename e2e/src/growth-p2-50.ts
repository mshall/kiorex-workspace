import { kiorex, q, syncProviders } from './clients.js';
import type { Provider } from './fixtures.js';

/** Suite 50 helpers (add-only). Everything here talks to the real APIs of the instance under test; database writes are limited to a visit type's deposit amount (restored by the suite). */

/** Makes the REWARD_RULES in force a CREDIT-mode, non-zero-amount set for the run: draft by `maker`, second approver `checker` (maker-checker). Returns the version id. */
export async function activateRewardRules(maker: string, checker: string, patch: (r: any) => any) {
  const cur = (await kiorex(maker, 'GET', '/ops/growth/config/in-force?kind=REWARD_RULES&market=EG')).body;
  if (!cur?.payload) throw new Error(`no REWARD_RULES in force: ${JSON.stringify(cur)}`);
  const payload = patch(JSON.parse(JSON.stringify(cur.payload)));
  const d = await kiorex(maker, 'POST', '/ops/growth/config', { kind: 'REWARD_RULES', scope: 'GLOBAL', payload, reason: 'e2e suite 50 credit rules', ticket: 'E2E-50', announcement: 'Reward amounts for the e2e stack.' });
  if (d.status !== 201) throw new Error(`draft ${d.status} ${JSON.stringify(d.body)}`);
  const s = await kiorex(maker, 'POST', `/ops/growth/config/${d.body.id}/submit`); if (s.status !== 200) throw new Error(`submit ${s.status} ${JSON.stringify(s.body)}`);
  const a = await kiorex(checker, 'POST', `/ops/growth/config/${d.body.id}/approve`); if (a.status !== 200) throw new Error(`approve ${a.status} ${JSON.stringify(a.body)}`);
  return d.body.id as string;
}

/** Sets a deposit on the provider's clinic's marketplace-bookable types (a TEST VALUE, KX-12 amounts are NEEDS_HUMAN) and syncs it to Kiorex; returns the undo. */
export async function setDeposit(ops: string, p: Provider, depositEgp: number | null) {
  const clinicId = (await q('kiorly', `select "clinicId" from "MarketplaceListing" where id = $1`, [p.id]))[0].clinicId as string;
  const rows = await q('kiorly', `update "AppointmentType" set "depositAmount" = $2 where "clinicId" = $1 and "marketplaceBookable" returning id`, [clinicId, depositEgp]);
  await bump(ops, p.id);
  return async () => { await q('kiorly', `update "AppointmentType" set "depositAmount" = null where id = any($1)`, [rows.map((r: any) => r.id)]); await bump(ops, p.id); };
}

export const bump = async (ops: string, listingId: string) => {
  await q('kiorly', `update "MarketplaceListing" set "updatedAt" = greatest(now() at time zone 'utc', "updatedAt") + interval '1 second' where "clinicianId" = (select "clinicianId" from "MarketplaceListing" where id = $1)`, [listingId]);
  await syncProviders(ops);
};
