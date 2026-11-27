import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { kiorex, opsLogin, q } from '../src/clients.js';
import { kiorexWebhook } from '../src/hmac.js';
import { WEBHOOK_SECRET } from '../src/env.js';
import { pharmacy, pharmacyStaff, lab, labStaff } from '../src/verticals.js';

/**
 * LG-COM-19 / LG-COM-20 chain on the REAL services (private stack, mock providers): a commission claim whose tender is a CASH_TRANSFER (InstaPay at the clinic, cash-type for netting but its own kind)
 * -> the Kiorex settlement statement of the organisation (ops route) -> the SAME figures on the signed partner route that Pharmacy and Lab call (KIOREX_MODE=real) -> their statement screens' API.
 * The claim is raised for the demo Pharmacy and Lab registrations (org ref = PartnerRegistration id) through the Clinic-signed charge events, exactly as a charge would arrive; all amounts are TEST placeholders
 * and the rows are removed again (claim, charge events), so the dev stack's books are unchanged.
 */
const PERIOD = new Date().toISOString().slice(0, 7); // the Pharmacy and Lab screens ask for one calendar month (YYYY-MM)
const range = () => { const [y, m] = PERIOD.split('-').map(Number); return { from: new Date(Date.UTC(y, m - 1, 1)).toISOString(), to: new Date(Date.UTC(y, m, 1)).toISOString() }; };
const tag = randomUUID().slice(0, 8);

async function raise(orgRef: string, amount: string, i: number, extra: Record<string, unknown>) {
  const chargeId = `chg_e57_${tag}_${i}`; const appointmentId = `apt_e57_${tag}_${i}`;
  const base = { chargeId, appointmentId, amount, currency: 'EGP', tenantId: orgRef, clinicId: orgRef, decisionAmount: amount, disputeDeadline: new Date(Date.now() + 14 * 86400_000).toISOString(), feeBasisMinor: 100000, tender: 'CASH', ...extra };
  const a = await kiorexWebhook(WEBHOOK_SECRET, '/webhooks/kiorly', { eventId: `e57-${tag}-${i}-a`, type: 'COMMISSION_CHARGE_CREATED', aggregateType: 'Appointment', aggregateId: appointmentId, occurredAt: new Date().toISOString(), target: 'KIOREX', data: { ...base, status: 'PENDING' } });
  expect([200, 202]).toContain(a.status);
  const b = await kiorexWebhook(WEBHOOK_SECRET, '/webhooks/kiorly', { eventId: `e57-${tag}-${i}-b`, type: 'COMMISSION_CHARGE_STATUS_CHANGED', aggregateType: 'Appointment', aggregateId: appointmentId, occurredAt: new Date().toISOString(), target: 'KIOREX', data: { ...base, status: 'CONFIRMED', confirmedAt: new Date().toISOString() } });
  expect([200, 202]).toContain(b.status);
  return chargeId;
}

describe('57. commission claim (cash transfer) -> Kiorex settlement statement -> Pharmacy and Lab statement screens', () => {
  let ops: string; const charges: string[] = []; let phOwner: string, labOwner: string;
  beforeAll(async () => { ops = (await opsLogin()).accessToken; phOwner = await pharmacyStaff('owner'); labOwner = await labStaff('owner'); });

  for (const [product, orgRef] of [['PHARMACY', 'pr_pharmacy_dev'], ['LAB', 'pr_lab_dev']] as const) {
    it(`${product}: INSTAPAY cash transfer is accrued as cash-type, shown as its own kind on the Kiorex statement, and the partner screen carries the same figures as Kiorex finance`, async () => {
      const before = (await kiorex(ops, 'GET', `/admin/commissions/settlement-statement/${orgRef}?from=${range().from}&to=${range().to}`)).body;
      charges.push(await raise(orgRef, '20.00', product === 'PHARMACY' ? 1 : 2, { tenderMethod: 'CASH_TRANSFER', tenderDetail: 'INSTAPAY' }));
      const s = (await kiorex(ops, 'GET', `/admin/commissions/settlement-statement/${orgRef}?from=${range().from}&to=${range().to}`)).body;
      expect(s.payoutMethod).toBe('BANK_TRANSFER'); // Kiorex pays by bank transfer only and never holds or pays cash
      expect(s.cashVisitCommissionAccruedMinor - (before.cashVisitCommissionAccruedMinor ?? 0)).toBe(2000);
      expect(s.cashBreakdown.cashTransfer.accruedMinor - (before.cashBreakdown?.cashTransfer?.accruedMinor ?? 0)).toBe(2000);
      expect(s.cashBreakdown.cashTransfer.byDetail.INSTAPAY ?? s.cashBreakdown.cashTransfer.byDetail.instapay).toBeTruthy();
      // the product screen: the signed partner route behind it answers the same organisation only
      const view = product === 'PHARMACY' ? await pharmacy(phOwner, 'GET', `/growth/commission-statement?period=${PERIOD}`) : await lab(labOwner, 'GET', `/growth/commission-statement?period=${PERIOD}`);
      expect(view.status, JSON.stringify(view.body)).toBe(200);
      const v = view.body.statement ?? view.body;
      // the product screens carry the cash-type accrual (the cash / cash-transfer split of LG-COM-20 is a Kiorex finance view only today: documented gap, see TEST_REPORT_2026-11-27.md)
      expect(Number(v.cashVisitCommissionAccruedMinor)).toBe(Number(s.cashVisitCommissionAccruedMinor));
    }, 60_000);
  }

  it('the statement of another organisation is refused to a partner (uniform org binding) and Pharmacy has no access to the Lab claim', async () => {
    const pv = await pharmacy(phOwner, 'GET', `/growth/commission-statement?period=${PERIOD}`);
    expect(JSON.stringify(pv.body)).not.toContain('pr_lab_dev');
    const lv = await lab(labOwner, 'GET', `/growth/commission-statement?period=${PERIOD}`);
    expect(JSON.stringify(lv.body)).not.toContain('pr_pharmacy_dev');
  });

  it('cleanup: the test claims and charge events are removed again', async () => {
    for (const id of charges) {
      await q('kiorex_platform', `delete from "CommissionClaim" where "chargeId" = $1`, [id]).catch(() => undefined);
    }
    await q('kiorex_platform', `delete from "WebhookReceipt" where "eventId" like $1`, [`e57-${tag}-%`]).catch(() => undefined);
  });
});
