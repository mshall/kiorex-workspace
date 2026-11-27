import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tokens, providerBySpecialty, type Provider } from '../src/fixtures.js';
import { kiorex, kiorly, opsLogin, q, staffLogin, waitFor } from '../src/clients.js';
import { bookWith, clinicCharges, clinicDecision, completeVisit, freshPatient, kxdevGrowthTenant, secondSuperAdmin } from '../src/growth.js';
import { unlockForRun } from '../src/growth-p3.js';
import { activateRewardRules, setDeposit } from '../src/growth-p2-50.js';
import { activatePromotion, creditLot, exposure, kxLine, promoBody, providerFacts, walletBalance } from '../src/growth-p2s.js';

/**
 * GRW-P2-S end to end on the real stack (Clinic + Kiorex + Postgres + dev Passport), mock PSP and mock providers: the sponsored-promotion money flow of KX-30 section 14.4 and its reconciliation RC-S3 / RC-S4.
 * The worked example: visit deposit D 500, sponsored S 100 (provider funded), patient credit C 150 (Kiorex funded), card K 250 (all in EGP; the amounts below are minor units).
 *   the patient pays 250 by card; the Clinic is told gross 500 with the tender split; at completion the Clinic debits its wallet by exactly 100 (once); the Kiorex line becomes DEBITED;
 *   the Kiorex fee (40) is unchanged; with REWARD_RULES.postToPayLedger OFF (default, finance H-25) the Pay ledger holds only what the card paid and the payout is 250; with it ON the sponsored
 *   100 and the credit 150 reach HELD, the payout waits for the Clinic DEBIT and then pays 500.
 * Cancel releases the budget and voids the sponsored share (never paid to the patient); the credit comes back as credit. `growth.sponsored_promotions` is launch-locked: it gets DEV TEST FIXTURE gate evidence for this run only.
 * Test fixtures (undone in afterAll): a CLINIC_ADMIN and a booking slug on the KX-DEV clinic, a test deposit on its visit types, a wallet grant (an append-only ledger row), a REWARD_RULES version (restored by a new version).
 */
const FLAGS = ['growth.sponsored_promotions', 'growth.rewards', 'growth.patient_credit', 'growth.patient_referral'];
const D = 500; const S = 100; const C = 150; const K = D - S - C;
const mn = (egp: number) => egp * 100;

describe('51. provider-sponsored promotions: the money flow end to end (RC-S3, RC-S4)', () => {
  let t: Awaited<ReturnType<typeof tokens>>; let second: Awaited<ReturnType<typeof secondSuperAdmin>>; let p: Provider; let owner: string; let platform: string; let staff: string; let tenantId: string; let promoId: string;
  let clinicianId: string; let restoreTenant: () => Promise<void> = async () => undefined; let originalRules: any;
  const undo: (() => Promise<void>)[] = [];
  const ops = async () => (await opsLogin()).accessToken; // the suite outlives one access token: always the cached, still valid one
  const setRules = async (postToPayLedger: boolean) => activateRewardRules(await ops(), second.token, (r) => ({ ...r, mode: 'CREDIT', postToPayLedger, amounts: { referrerMinor: 5000, refereeMinor: 3000, repeatMinor: 1000, promoMinor: 2000 }, perUserAnnualCapMinor: 1_000_000, perCampaignCapMinor: 10_000_000, ruleBudgetCeilingMinor: 100_000_000 }))
    .then(() => new Promise((r) => setTimeout(r, 3500))); // the Kiorex policy cache
  const intentOf = async (bookingId: string) => (await q('kiorex_platform', `select * from "PaymentIntent" where "bookingId" = $1 order by "createdAt" desc limit 1`, [bookingId]))[0];
  const acct = async (account: string, clinic = true) => { void clinic; const r = (await q('kiorex_platform', `select coalesce(sum("debitMinor"),0)::int d, coalesce(sum("creditMinor"),0)::int c from "LedgerEntry" where account = $1`, [account]))[0]; return { debit: Number(r.d), credit: Number(r.c), net: Number(r.d) - Number(r.c) }; };
  const sponsorNetOf = async (paymentId: string) => Number((await q('kiorex_platform', `select coalesce(sum(e."debitMinor" - e."creditMinor"),0)::int n from "LedgerEntry" e join "LedgerTx" t on t.id = e."txId" where t."paymentId" = $1 and e.account = 'SPONSOR_FUNDED:clinicCredit'`, [paymentId]))[0].n);
  const heldOf = async (paymentId: string) => Number((await q('kiorex_platform', `select coalesce(sum(e."creditMinor" - e."debitMinor"),0)::int n from "LedgerEntry" e join "LedgerTx" t on t.id = e."txId" where t."paymentId" = $1 and e.account like 'HELD:%'`, [paymentId]))[0].n);

  /** A fresh patient with credit C, booked and paid: returns what the tests assert on. */
  async function bookAndPay(opts: { credit?: number } = {}) {
    const pt = await freshPatient('Sponsored Tester');
    if (opts.credit) await creditLot(pt.sub, mn(opts.credit));
    const b = await bookWith(pt.token, p);
    await waitFor('the sponsored line', async () => (await kxLine(b.id))?.state === 'APPLIED' ? true : undefined, 20_000, 500);
    const co = await kiorex(pt.token, 'POST', `/bookings/${b.id}/deposit-checkout`, {}); expect(co.status, JSON.stringify(co.body)).toBe(200);
    expect((await kiorex(undefined, 'POST', `/pay/fake-checkout/${co.body.paymentId}/complete`, { outcome: 'pay' })).status).toBe(200);
    await waitFor('deposit PAID', async () => (await kiorex(pt.token, 'GET', `/bookings/${b.id}`)).body.depositStatus === 'PAID', 30_000);
    return { pt, b, co: co.body as any };
  }

  beforeAll(async () => {
    t = await tokens(); second = await secondSuperAdmin(); p = await providerBySpecialty(t.p1, 'cardiology'); // fee 600: a deposit of 500 is allowed
    for (const f of FLAGS) undo.push(await unlockForRun(t.ops, f));
    originalRules = (await kiorex(t.ops, 'GET', '/ops/growth/config/in-force?kind=REWARD_RULES&market=EG')).body?.payload;
    await setRules(false);
    undo.push(await setDeposit(t.ops, p, D));
    const f = await providerFacts(p.id); clinicianId = f.clinicianId; tenantId = f.tenantId;
    p = { ...p, defaultTypeId: (await q('kiorly', `select id from "AppointmentType" where "clinicId" = $1 and "marketplaceBookable" order by "feeAmount" desc limit 1`, [f.clinicId]))[0].id }; // the consultation (fee 600): a deposit of 500 must never exceed the fee of the type that is booked
    const fx = await kxdevGrowthTenant(p.id); owner = fx.admin; restoreTenant = fx.restore;
    platform = await staffLogin('superadmin@kiorly.com'); staff = await staffLogin('kxdev.hesham.nabil@kiorly.dev');
    const g = await kiorly(platform, 'POST', `/admin/platform/tenants/${tenantId}/credits`, { amount: 2000, reason: 'GOODWILL', note: 'e2e suite 51 sponsor wallet' }); expect([200, 201], JSON.stringify(g.body)).toContain(g.status);
    promoId = await activatePromotion(owner, t.ops, promoBody(clinicianId, { discount: { kind: 'FIXED_MINOR', value: mn(S) } }));
  });
  afterAll(async () => {
    if (promoId) await kiorly(owner, 'POST', `/promotions/${promoId}/pause`, { reason: 'e2e done' }).catch(() => undefined);
    if (originalRules) await activateRewardRules(await ops(), second.token, () => originalRules).catch(() => undefined);
    for (const u of undo.reverse()) await u().catch(() => undefined);
    await restoreTenant(); await second?.drop();
  });

  it('the promotion went from the owner console through Kiorex review to ACTIVE in both systems, and the patient quote says "sponsored by <clinic>" with the end date (never a Kiorex discount)', async () => {
    expect((await kiorly(owner, 'GET', `/promotions/${promoId}`)).body.status).toBe('ACTIVE');
    const pt = await freshPatient('Quote Tester'); const b = await bookWith(pt.token, p, { confirm: false });
    const quote = (await kiorex(pt.token, 'GET', `/growth/v1/promotions/quote?bookingId=${b.id}`)).body.quote;
    expect(quote).toMatchObject({ promotionId: promoId, amountMinor: mn(S), currency: 'EGP' });
    expect(quote.label.en).toMatch(/^Discount sponsored by .+ until \d{4}-\d{2}-\d{2}$/); expect(quote.label.ar).toMatch(/^خصم برعاية /); expect(JSON.stringify(quote)).not.toMatch(/Kiorex discount/i);
    expect(quote.lines.map((l: any) => l.code)).toEqual(['PRICE', 'SPONSORED_DISCOUNT', 'CARD']);
    await kiorex(pt.token, 'POST', `/bookings/${b.id}/release`);
  });

  it('RC-S4 worked example, posting OFF (default): the patient pays 250, the Clinic is told gross 500 with the tender split, the wallet is debited 100 once at completion, the fee stays 40, the payout is the 250 the card paid', async () => {
    const before = await walletBalance(tenantId); const exp0 = await exposure(promoId);
    const { pt, b, co } = await bookAndPay({ credit: C });
    expect(co).toMatchObject({ amountMinor: mn(K), rewardMinor: mn(C), sponsoredDiscountMinor: mn(S) });
    expect(co.lines.map((l: any) => [l.code, l.amountMinor])).toEqual([['PRICE', mn(D)], ['SPONSORED_DISCOUNT', -mn(S)], ['PATIENT_CREDIT', -mn(C)], ['CARD', mn(K)]]);
    const pi = await intentOf(b.id); expect(pi).toMatchObject({ amountMinor: mn(K), rewardMinor: mn(C), sponsoredMinor: mn(S), sponsoredPostedMinor: 0, status: 'CAPTURED' });
    const dep = await waitFor('the Clinic deposit', async () => (await q('kiorly', `select amount::float a, source from "PatientDeposit" d join "Appointment" a2 on a2.id = d."appointmentId" where a2."externalReference" = $1`, [b.id]))[0]);
    expect(dep.a).toBe(D); // gross 500 recorded at the Clinic (card 250 + credit 150 + sponsored 100)
    expect(await heldOf(pi.id)).toBe(mn(K)); expect(await sponsorNetOf(pi.id)).toBe(0); // posting OFF: nothing moved for this payment
    expect((await kxLine(b.id))).toMatchObject({ state: 'APPLIED', amountMinor: mn(S) });
    expect((await exposure(promoId)).reserve - exp0.reserve).toBe(mn(S)); // the budget hold exists while the booking is open
    const apt = await completeVisit(pt.token, b.id, staff);
    await waitFor('the Clinic debits the wallet (completion poller)', async () => (await kxLine(b.id))?.state === 'DEBITED' ? true : undefined, 150_000, 2000);
    expect(Number((await walletBalance(tenantId)).toFixed(2))).toBe(Number((before - S).toFixed(2))); // exactly 100, once
    const ex = await exposure(promoId); expect(ex.debit - exp0.debit).toBe(mn(S)); expect(ex.exposure - exp0.exposure).toBe(mn(S)); // reserve converted to debit: nothing counted twice
    const rate = Number((await q('kiorly', `select r.amount::float a from "KiorexCommissionRate" r join "Market" m on m.id = r."marketId" where m.code = 'EG' and r."validTo" is null order by r."validFrom" desc limit 1`))[0]?.a ?? NaN);
    const dec = (await q('kiorly', `select decision, amount::float amt, "rateSource", "feeBasisMinor"::int fb, "sponsoredDiscountMinor"::int sd, "basisPolicyVersion" from "KiorexCommissionDecision" where "appointmentId" = $1 order by "createdAt" desc limit 1`, [apt.id]))[0];
    // the Clinic decides the fee: a configured rate row when one is in force, otherwise the commission-policy default (rateSource KIOREX_DEFAULT: 3% of the fee basis between the floor and the cap; the clone's EG row of EGP 1 is a stale fixture the policy default supersedes)
    const expectedFee = (dec as any).rateSource === 'KIOREX_DEFAULT' ? Number((dec as any).amt) : rate;
    const charges = await clinicCharges(apt.id); expect(charges.map((c: any) => Number(c.amount))).toEqual([expectedFee]); // the fee is the one the decision records, computed on the basis BEFORE the sponsored discount, NOT reduced by the sponsored amount
    if ((dec as any).rateSource === 'KIOREX_DEFAULT') expect(expectedFee).toBe(Math.min(75, Math.max(10, Math.round(mn(600) * 0.03) / 100))); // SEEDED_DEFAULT Clinic 3% min 10 cap 75 on EGP 600
    expect(dec).toMatchObject({ decision: 'CHARGE', fb: mn(600), sd: mn(S) }); expect(dec.basisPolicyVersion).toBeTruthy(); // the basis is the fee BEFORE the sponsored discount (GROSS_BEFORE_SPONSORED); the decision only carries the reference fields
    expect((await clinicDecision(apt.id)).length).toBe(1);
    await waitFor('the deposit is released', async () => (await intentOf(b.id)).releasedAt ? true : undefined, 30_000);
    const payout = (await kiorex(await ops(), 'POST', '/admin/payouts/run')).body; const mine = (await intentOf(b.id));
    expect(mine.payoutId).toBeTruthy(); expect(payout.payouts.find((x: any) => x.clinicId === pi.clinicId)?.amountMinor).toBeGreaterThanOrEqual(mn(K)); // card 250 (posting off): no sponsored or credit part
    // Kiorex Pay books no revenue or expense for the sponsored amount: scoped to THIS payment (a stack that has shipped commission defaults books pharmacy and lab release fees to MARKETPLACE_FEES for other suites' orders)
    expect(Number((await q('kiorex_platform', `select coalesce(sum(e."creditMinor"),0)::int n from "LedgerEntry" e join "LedgerTx" t on t.id = e."txId" where t."paymentId" = $1 and e.account = 'MARKETPLACE_FEES'`, [pi.id]))[0].n)).toBe(0);
    const unbalanced = await q('kiorex_platform', `select "txId" from "LedgerEntry" group by "txId" having sum("debitMinor") <> sum("creditMinor")`); expect(unbalanced).toHaveLength(0);
  }, 240_000);

  it('RC-S3: every Clinic DEBIT of this promotion has exactly one Kiorex booking line in DEBITED, and the Kiorex line says no more than the Clinic debited', async () => {
    const debits = await q('kiorly', `select "bookingRef", "amountMinor"::int a from "PromotionBudgetEntry" where "promotionId" = $1 and type = 'DEBIT'`, [promoId]);
    expect(debits.length).toBeGreaterThanOrEqual(1);
    for (const d of debits) { const l = await q('kiorex_platform', `select state, "amountMinor" from "BookingSponsoredDiscount" where "bookingIntentId" = $1`, [d.bookingRef]); expect(l, d.bookingRef).toHaveLength(1); expect(l[0]).toMatchObject({ state: 'DEBITED', amountMinor: d.a }); }
    const dk = await q('kiorex_platform', `select "bookingIntentId" from "BookingSponsoredDiscount" where "promotionId" = $1 and state = 'DEBITED'`, [promoId]);
    expect(dk.map((r: any) => r.bookingIntentId).sort()).toEqual(debits.map((d: any) => d.bookingRef).sort());
  });

  it('RC-S4 with postToPayLedger ON (finance H-25 decided): the sponsored 100 and the credit 150 reach HELD (500 in all), the payout waits for the Clinic DEBIT and then pays 500; the Pay ledger balances', async () => {
    await setRules(true);
    const { pt, b } = await bookAndPay({ credit: C }); const pi = await intentOf(b.id);
    expect(pi).toMatchObject({ amountMinor: mn(K), rewardPostedMinor: mn(C), sponsoredPostedMinor: mn(S) }); expect(await heldOf(pi.id)).toBe(mn(D));
    expect(await sponsorNetOf(pi.id)).toBe(mn(S)); // the receivable settled by the Clinic wallet DEBIT
    await completeVisit(pt.token, b.id, staff);
    await waitFor('the deposit is released', async () => (await intentOf(b.id)).releasedAt ? true : undefined, 30_000);
    const stateBefore = (await kxLine(b.id)).state; const run1 = (await kiorex(await ops(), 'POST', '/admin/payouts/run')).body; const stateAfter = (await kxLine(b.id)).state;
    if (stateBefore !== 'DEBITED' && stateAfter !== 'DEBITED') { expect(run1.heldBack?.find((h: any) => h.paymentId === pi.id)?.holdMinor).toBe(mn(S)); expect((await intentOf(b.id)).payoutId).toBeNull(); } // the gate: nothing paid before the DEBIT
    await waitFor('the Clinic DEBIT', async () => (await kxLine(b.id))?.state === 'DEBITED' ? true : undefined, 150_000, 2000);
    const run2 = (await kiorex(await ops(), 'POST', '/admin/payouts/run')).body; const after = await intentOf(b.id);
    expect(after.payoutId).toBeTruthy(); expect(run2.heldBack?.some((h: any) => h.paymentId === pi.id) ?? false).toBe(false);
    const po = (await q('kiorex_platform', `select "amountMinor", "paymentRefs" from "Payout" where id = $1`, [after.payoutId]))[0]; expect(Number(po.amountMinor)).toBeGreaterThanOrEqual(mn(D)); expect(po.paymentRefs).toContain(pi.id);
    expect(await heldOf(pi.id)).toBe(0);
    const unbalanced = await q('kiorex_platform', `select "txId" from "LedgerEntry" group by "txId" having sum("debitMinor") <> sum("creditMinor")`); expect(unbalanced).toHaveLength(0);
    const drift = await q('kiorex_platform', `select p.id from "PaymentIntent" p where p."sponsoredMinor" > 0 and (select coalesce(sum(e."debitMinor" - e."creditMinor"),0) from "LedgerEntry" e join "LedgerTx" t on t.id = e."txId" where t."paymentId" = p.id and e.account = 'SPONSOR_FUNDED:clinicCredit') <> p."sponsoredPostedMinor"`); expect(drift).toHaveLength(0); // RC-S4 Pay side
    await setRules(false);
  }, 400_000);

  it('cancel after payment: the card 250 goes back to the card, the credit 150 comes back as credit, the sponsored 100 is voided and never paid to the patient, the Clinic hold is released and the wallet is untouched', async () => {
    const before = await walletBalance(tenantId); const exp0 = await exposure(promoId);
    const { pt, b } = await bookAndPay({ credit: C }); const pi = await intentOf(b.id);
    const c = await kiorex(pt.token, 'POST', `/bookings/${b.id}/cancel`, { reason: 'plans changed' }); expect(c.status, JSON.stringify(c.body)).toBe(200);
    const rf = await waitFor('refund settled', async () => { const r0 = (await q('kiorex_platform', `select status, "amountMinor" from "Refund" where "paymentId" = $1`, [pi.id]))[0]; return r0?.status === 'SETTLED' ? r0 : undefined; }, 60_000);
    expect(Number(rf.amountMinor)).toBe(mn(K)); // only what the card paid: not 400 and not 500
    expect(await intentOf(b.id)).toMatchObject({ status: 'REFUNDED', refundedMinor: mn(K), sponsoredVoidedMinor: mn(S) });
    expect((await kiorex(pt.token, 'GET', '/growth/v1/credit')).body.openBalanceMinor).toBe(mn(C)); // the credit is back, as credit
    await waitFor('the Clinic releases the hold', async () => (await kxLine(b.id))?.state === 'RELEASED' ? true : undefined, 90_000, 1000);
    const ex = await exposure(promoId); expect(ex.exposure).toBe(exp0.exposure); // budget returned
    expect(Number((await walletBalance(tenantId)).toFixed(2))).toBe(Number(before.toFixed(2))); // the wallet was never touched
    expect(await heldOf(pi.id)).toBe(0);
  }, 240_000);

  it('a booking made while the promotion is paused gets no sponsored line and the full deposit; resuming restores the offer', async () => {
    expect((await kiorly(owner, 'POST', `/promotions/${promoId}/pause`, { reason: 'e2e check' })).status).toBe(200);
    await waitFor('projection PAUSED', async () => (await q('kiorex_platform', `select 1 from "SponsoredPromotionProjection" where "promotionId" = $1 and status = 'PAUSED'`, [promoId]))[0], 60_000, 1000);
    const pt = await freshPatient('Paused Tester'); const b = await bookWith(pt.token, p);
    expect(await kxLine(b.id)).toBeUndefined();
    const co = await kiorex(pt.token, 'POST', `/bookings/${b.id}/deposit-checkout`, {}); expect(co.body).toMatchObject({ amountMinor: mn(D) }); expect(co.body).not.toHaveProperty('sponsoredDiscountMinor');
    await kiorex(pt.token, 'POST', `/bookings/${b.id}/cancel`, { reason: 'test' });
    expect((await kiorly(owner, 'POST', `/promotions/${promoId}/resume`)).status).toBe(200);
    await waitFor('projection ACTIVE', async () => (await q('kiorex_platform', `select 1 from "SponsoredPromotionProjection" where "promotionId" = $1 and status = 'ACTIVE'`, [promoId]))[0], 60_000, 1000);
  }, 120_000);

  it('the ops ledger view shows the distinct provider-sponsored discount line per booking and no patient field', async () => {
    const r = await kiorex(await ops(), 'GET', `/admin/growth/sponsored-promotions/${promoId}/ledger`); expect(r.status).toBe(200);
    const rows = r.body.lines as any[]; expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(r.body)).not.toMatch(/"sub"|phone|\+20\d{9}|nameEn/);
    for (const l of rows) expect(l).toMatchObject({ ledgerLine: 'PROVIDER_SPONSORED_DISCOUNT', signedAmountMinor: -l.amountMinor });
    expect(r.body.byState.map((x: any) => x.state)).toEqual(expect.arrayContaining(['DEBITED', 'RELEASED']));
  });
});
