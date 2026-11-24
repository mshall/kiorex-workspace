import { randomBytes } from 'node:crypto';
import { kiorex, kiorly, q, waitFor } from './clients.js';
import { kiorlyMarketplace } from './hmac.js';

/** GRW-P2-S helpers (add-only; suites 51 and 52 part B). Everything goes through the real APIs of the instance under test; database writes are limited to patient-credit vouchers (the two rows the issuance service writes) and reads. */
export const PROMO_ADMIN = '/admin/growth/sponsored-promotions';
export const dayMs = 86_400_000;

export const promoBody = (clinicianId: string, o: Record<string, unknown> = {}) => ({
  nameAr: 'خصم الكشف', nameEn: 'Visit discount', patientCopyAr: 'خصم على سعر الكشف برعاية العيادة', patientCopyEn: 'A discount on the visit fee, sponsored by the clinic',
  scope: { doctorIds: [clinicianId], appointmentTypeIds: [], careTypes: ['IN_CLINIC'] }, discount: { kind: 'FIXED_MINOR', value: 10_000 }, budgetCapMinor: 70_000, perPatientLimit: 5,
  eligibility: { newPatientsOnly: false, firstBookingOnly: false, minLeadHours: 0, kiorexOnly: true }, startsAt: new Date(Date.now() - 3_600_000).toISOString(), endsAt: new Date(Date.now() + 30 * dayMs).toISOString(), fundingMode: 'WALLET_ONLY', ...o,
});

/** The clinician id and organisation (tenant) of a Kiorex provider row. */
export async function providerFacts(providerId: string) {
  const r = (await q('kiorex_platform', `select "clinicianId", "tenantId", "clinicId" from "Provider" where id = $1`, [providerId]))[0];
  if (!r) throw new Error(`no provider ${providerId}`);
  return { clinicianId: r.clinicianId as string, tenantId: r.tenantId as string, clinicId: r.clinicId as string };
}

/** Owner creates and submits; Kiorex ops approve CONTENT and SCOPE through the ops API (Kiorex sends the decision to the Clinic as a signed command); waits until BOTH systems say ACTIVE. */
export async function activatePromotion(owner: string, ops: string, body: Record<string, unknown>) {
  const c = await kiorly(owner, 'POST', '/promotions', body); if (c.status !== 201 && c.status !== 200) throw new Error(`create promotion ${c.status} ${JSON.stringify(c.body)}`);
  const id = c.body.id as string;
  const s = await kiorly(owner, 'POST', `/promotions/${id}/submit`); if (s.status !== 200) throw new Error(`submit ${s.status} ${JSON.stringify(s.body)}`);
  await waitFor('promotion in the Kiorex review queue', async () => (await kiorex(ops, 'GET', `${PROMO_ADMIN}/${id}`)).status === 200, 60_000, 1000);
  for (const kind of ['CONTENT', 'SCOPE']) {
    const d = await kiorex(ops, 'POST', `${PROMO_ADMIN}/${id}/decisions`, { version: 1, kind, decision: 'APPROVED' }); if (d.status !== 200) throw new Error(`decide ${kind} ${d.status} ${JSON.stringify(d.body)}`);
  }
  await waitFor('promotion ACTIVE in the Clinic', async () => (await kiorly(owner, 'GET', `/promotions/${id}`)).body?.status === 'ACTIVE', 30_000, 1000);
  await waitFor('promotion ACTIVE in the Kiorex projection', async () => (await q('kiorex_platform', `select 1 from "SponsoredPromotionProjection" where "promotionId" = $1 and status = 'ACTIVE'`, [id]))[0], 60_000, 1000);
  return id;
}

/** A patient-credit voucher straight into the tables (the same two rows the issuance service writes), so the money-flow test does not depend on a completed referral visit. CREDIT mode needs REWARD_RULES.mode CREDIT and the credit flags. */
export async function creditLot(sub: string, amountMinor: number) {
  const id = `rwl_e2e51${randomBytes(4).toString('hex')}`;
  await q('kiorex_platform', `insert into "RewardLot" (id, market, sub, kind, mode, "amountMinor", "ruleVersionId", "expiresAt", status, funding, scope, "issuedBy") values ($1,'EG',$2,'PROMO','CREDIT',$3,'rv-e2e', now() + interval '30 days','ACTIVE','PLATFORM_MARKETING','{}'::jsonb,'e2e')`, [id, sub, amountMinor]);
  await q('kiorex_platform', `insert into "RewardLedgerEntry" (id, "lotId", type, "amountMinor", "idempotencyKey", "ruleVersionId", "reasonCode", actor, "createdAt") values ($1,$2,'ISSUE',$3,$4,'rv-e2e','PROMO_CAMPAIGN','system', now())`, [`rwe_e2e51${randomBytes(4).toString('hex')}`, id, amountMinor, `rwd:issue:${id}`]);
  return id;
}

export const walletBalance = async (tenantId: string) => Number((await q('kiorly', `select balance::float b from "CreditWallet" where "tenantId" = $1`, [tenantId]))[0]?.b ?? 0);
export const exposure = async (promotionId: string) => {
  const e = await q('kiorly', `select type, "amountMinor" from "PromotionBudgetEntry" where "promotionId" = $1`, [promotionId]);
  const sum = (t: string) => e.filter((x: any) => x.type === t).reduce((s: number, x: any) => s + Number(x.amountMinor), 0);
  return { reserve: sum('RESERVE'), release: sum('RELEASE'), debit: sum('DEBIT'), reverse: sum('REVERSE_DEBIT'), exposure: sum('RESERVE') + sum('DEBIT') - sum('RELEASE') - sum('REVERSE_DEBIT') };
};
export const kxLine = async (bookingId: string) => (await q('kiorex_platform', `select state, "amountMinor", "reservationRef", "promotionId" from "BookingSponsoredDiscount" where "bookingIntentId" = $1`, [bookingId]))[0];
/** A signed Kiorex-to-Clinic promotion command (reserve, release, reverse, review-decision) exactly as Kiorex sends it. */
export const clinicCommand = (promotionId: string, verb: 'reserve' | 'release' | 'reverse' | 'review-decision', body: unknown) => kiorlyMarketplace('POST', `/promotions/${promotionId}/${verb}`, body);
export const reserveBody = (o: Record<string, unknown> = {}) => ({ version: 1, bookingRef: `kx_bk_e2e_${randomBytes(4).toString('hex')}`, patientRef: `pref_${randomBytes(8).toString('hex')}`, careType: 'IN_CLINIC', amountMinor: 10_000, currency: 'EGP', idempotencyKey: `spr:e2e:${randomBytes(6).toString('hex')}`, ...o });

/** Owner creates and submits; the two Kiorex review decisions arrive as the SIGNED `review-decision` commands (as Kiorex sends them) with two reviewer ids, so the Clinic rules are tested without the Kiorex ops layer. Waits for ACTIVE. */
export async function activateViaCommands(owner: string, body: Record<string, unknown>, kinds: Array<'CONTENT' | 'SCOPE' | 'HIGH_VALUE'> = ['CONTENT', 'SCOPE']) {
  const c = await kiorly(owner, 'POST', '/promotions', body); if (c.status !== 201 && c.status !== 200) throw new Error(`create promotion ${c.status} ${JSON.stringify(c.body)}`);
  const id = c.body.id as string;
  const s = await kiorly(owner, 'POST', `/promotions/${id}/submit`); if (s.status !== 200) throw new Error(`submit ${s.status} ${JSON.stringify(s.body)}`);
  for (const k of kinds) { const d = await clinicCommand(id, 'review-decision', { version: 1, reviewKind: k, decision: 'APPROVED', decidedBy: `ops:e2e_${k.toLowerCase()}_reviewer` }); if (d.status !== 200) throw new Error(`decision ${k} ${d.status} ${JSON.stringify(d.body)}`); }
  await waitFor('promotion ACTIVE', async () => (await kiorly(owner, 'GET', `/promotions/${id}`)).body?.status === 'ACTIVE', 20_000, 500);
  return id;
}

/** A booking made DIRECTLY at the Clinic's marketplace API for a Kiorex hold (what Kiorex does at confirm), with a sponsoredDiscount block of the caller's choosing: the way to forge one. */
export async function directBooking(o: { holdId: string; clinicHoldId?: string; slot: { startsAt: string; endsAt: string }; clinicId: string; clinicianId: string; typeId: string; phone: string; block?: unknown }) {
  const body = { clinicId: o.clinicId, clinicianId: o.clinicianId, typeId: o.typeId, startsAt: o.slot.startsAt, endsAt: o.slot.endsAt, holdExternalRef: o.holdId, ...(o.clinicHoldId ? { holdId: o.clinicHoldId } : {}), patient: { phone: o.phone, firstNameEn: 'Promo', lastNameEn: 'Forger' }, marketplaceConsentGranted: true, remindersConsentGranted: true, ...(o.block !== undefined ? { sponsoredDiscount: o.block } : {}) };
  return kiorlyMarketplace('POST', '/bookings', body, { 'idempotency-key': o.holdId });
}

/** Pauses every promotion in `ids` except `keep` and waits until Kiorex no longer offers them, so a quote picks exactly the promotion a test is about. */
export async function isolate(owner: string, ids: string[], keep: string[]) {
  const stop = ids.filter((i) => !keep.includes(i));
  for (const id of stop) { const s = (await kiorly(owner, 'GET', `/promotions/${id}`)).body?.status; if (s === 'ACTIVE' || s === 'EXHAUSTED') await kiorly(owner, 'POST', `/promotions/${id}/pause`, { reason: 'e2e isolate' }); }
  if (stop.length) await waitFor('Kiorex stops offering the paused promotions', async () => Number((await q('kiorex_platform', `select count(*)::int c from "SponsoredPromotionProjection" where "promotionId" = any($1) and status = 'ACTIVE'`, [stop]))[0].c) === 0, 60_000, 1000);
}
