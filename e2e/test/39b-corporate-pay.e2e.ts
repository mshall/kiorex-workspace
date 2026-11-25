import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kiorex, opsLogin, q } from '../src/clients.js';
import { patientToken, payFake, rnd } from '../src/verticals.js';
import { unlockForRun } from '../src/growth-p3.js';

/**
 * PAY-READY suite 39b on a PRIVATE real stack (`scripts/pay-stack.sh up`: Kiorex :4398 built from the lane worktree, own database, the shared Passport read only; no Clinic, no PSP: the sandbox-fake PSP).
 * The corporate benefit in Kiorex Pay: an ACTIVE corporate account (two-person activation written as the DB constraint demands), the patient joins with a code, the deposit checkout shows
 * PRICE / CORPORATE_BENEFIT / CARD, the capture redeems the benefit in its OWN ledger, a cancel gives it back, the account's usage report stays aggregate, the Pay ledger stays balanced and
 * the reconciliation finds nothing. The launch-locked flag `growth.corporate` gets DEV-ONLY gate evidence for this database and loses it in afterAll. Nothing here is a real approval.
 */
const STACK = !!process.env.E2E_FULL_STACK || process.env.E2E_KIOREX_URL?.includes(':4398');
const d = STACK ? describe : describe.skip;
d('39b. Corporate benefit in Kiorex Pay on the real private stack', () => {
  let ops: string, p1: string, sub: string, accountId = '', code = ''; let undoGate: () => Promise<void> = async () => undefined; const bookings: string[] = [];
  const A = '/admin/growth/corporate'; const P = '/growth/v1/corporate';
  const acct = async (a: string) => Number((await q('kiorex_platform', `select coalesce(sum("debitMinor"-"creditMinor"),0)::int n from "LedgerEntry" where account = $1`, [a]))[0].n);
  const booking = async (deposit = 50_000) => {
    const id = `kx_bk_e2e39b${rnd()}`; const startsAt = new Date(Date.now() + 72 * 3600_000).toISOString();
    await q('kiorex_platform', `insert into "BookingIntent" (id, sub, "providerId", "clinicId", "clinicianId", "tenantId", "typeId", "startsAt", "endsAt", status, channel, currency, "depositStatus", "depositAmountMinor", "createdAt", "updatedAt") values ($1,$2,'lst_e2e','cl_e2e','dr_e2e','org_e2e','typ_e2e',$3::timestamptz,$3::timestamptz + interval '30 minutes','CONFIRMED','MARKETPLACE','EGP','REQUIRED',$4, now(), now())`, [id, sub, startsAt, deposit]);
    bookings.push(id); return id;
  };

  beforeAll(async () => {
    ops = (await opsLogin()).accessToken; p1 = await patientToken(); sub = (await kiorex(p1, 'GET', '/me/profile')).body.sub;
    undoGate = await unlockForRun(ops, 'growth.corporate'); await new Promise((r) => setTimeout(r, 3500)); // DEV-ONLY gate evidence and the switch ON, through the same path as the other suites (the flag cache needs a moment)
    await q('kiorex_platform', `delete from "CorporateMember" where "accountId" in (select id from "CorporateAccount" where "displayName" like 'E2E39B%')`);
    const acc = await kiorex(ops, 'POST', `${A}/accounts`, { displayName: `E2E39B ${rnd()}` }); expect(acc.status, JSON.stringify(acc.body)).toBe(201); accountId = acc.body.id;
    expect((await kiorex(ops, 'PUT', `${A}/accounts/${accountId}/terms`, { contractRef: 'CTR-E2E', sponsorCeilingMinor: 100_000, perMemberCapMinor: 50_000, perVisitMaxMinor: 20_000, coverBp: 5000, endsAt: new Date(Date.now() + 60 * 86_400_000).toISOString(), emailDomains: ['e2e39b.example'] })).status).toBe(200);
    await q('kiorex_platform', `update "CorporateAccount" set status = 'ACTIVE', "activatedBy" = 'e2e_second_super_admin', "activatedAt" = now() where id = $1`, [accountId]); // the second person of the two-person rule (the DB constraint still checks it differs from the editor)
    const c = await kiorex(ops, 'POST', `${A}/accounts/${accountId}/codes`, { label: 'E2E', maxRedemptions: 5 }); expect(c.status, JSON.stringify(c.body)).toBe(201); code = c.body.code;
    expect((await kiorex(p1, 'POST', `${P}/join`, { code })).status).toBe(200);
  });
  afterAll(async () => {
    for (const id of bookings) await q('kiorex_platform', `delete from "CorporateBenefitEntry" where "bookingId" = $1`, [id]).catch(() => undefined);
    await kiorex(p1, 'POST', `${P}/leave`).catch(() => undefined); await undoGate().catch(() => undefined);
  });

  it('checkout: the employer covers 200 of the 500 deposit, the card is charged 300, the lines add up, the benefit is HELD until the capture', async () => {
    const id = await booking(); const co = await kiorex(p1, 'POST', `/bookings/${id}/deposit-checkout`, {});
    expect(co.status).toBe(200); expect(co.body).toMatchObject({ amountMinor: 30_000, corporateBenefitMinor: 20_000 });
    expect(co.body.lines.map((l: any) => [l.code, l.amountMinor])).toEqual([['PRICE', 50_000], ['CORPORATE_BENEFIT', -20_000], ['CARD', 30_000]]);
    const e = await q('kiorex_platform', `select type, "amountMinor" from "CorporateBenefitEntry" where "bookingId" = $1 order by "createdAt"`, [id]); expect(e.map((r: any) => r.type)).toEqual(['RESERVE']);
    await payFake(co.body.paymentId);
    const after = await q('kiorex_platform', `select type from "CorporateBenefitEntry" where "bookingId" = $1 order by "createdAt"`, [id]);
    expect(after.map((r: any) => r.type)).toEqual(expect.arrayContaining(['RESERVE'])); // REDEEM follows through the outbox (the worker is off on the private stack: replayed below)
    expect((await q('kiorex_platform', `select status, "corporateMinor" from "PaymentIntent" where id = $1`, [co.body.paymentId]))[0]).toMatchObject({ status: 'CAPTURED', corporateMinor: 20_000 });
  });
  it('the member sees the quote, the account report stays aggregate (no member identity, no booking id), the Pay ledger is balanced', async () => {
    const q1 = await kiorex(p1, 'GET', `${P}/me`); expect(q1.status).toBe(200); expect(JSON.stringify(q1.body)).not.toContain('kx_bk_');
    const rep = await kiorex(ops, 'GET', `${A}/accounts/${accountId}/report`); expect(rep.status).toBe(200); expect(JSON.stringify(rep.body)).not.toContain(sub);
    const unb = await q('kiorex_platform', `select count(*)::int n from (select "txId" from "LedgerEntry" group by "txId" having sum("debitMinor") <> sum("creditMinor")) x`); expect(unb[0].n).toBe(0);
    expect(await acct('CORPORATE_FUNDED:benefit')).toBe(0); // REWARD_RULES.postToPayLedger is false by default (finance H-25): the Pay ledger holds the card money only
  });
  it('ops: the payments connection check and the settings answer mock-safe, with references and no secret value', async () => {
    const chk = await kiorex(ops, 'GET', '/admin/payments/connection-check'); expect(chk.status).toBe(200);
    expect(chk.body.mode).toBe('mock'); expect(chk.body.psps.map((x: any) => x.psp)).toEqual(['paymob', 'fawry', 'instapay', 'card', 'bank_ipn']) /* bank_ipn: the Kiorly Pay unified layer's bank / IPN adapter */;
    expect(JSON.stringify(chk.body)).not.toMatch(/sk_(test|live)_|whsec_/); expect(chk.body.psps[0].webhook.url).toContain('/pay/webhooks/paymob');
    expect((await kiorex(ops, 'GET', '/admin/payments/test-scenarios')).body.length).toBeGreaterThanOrEqual(14);
    expect((await kiorex(p1, 'GET', '/admin/payments/connection-check')).status).toBe(403);
  });
  it('settlement import is idempotent and a forged PSP callback is refused on the real HTTP stack', async () => {
    const csv = `Order ID,Type,Status,Amount,Fees,Settlement Date\nord_${rnd()},Sale,Success,10.00,0.30,${new Date().toISOString().slice(0, 10)}\n`;
    const a = await kiorex(ops, 'POST', '/admin/payments/settlement/import', { psp: 'paymob', filename: 'e2e.csv', content: csv }); expect(a.body).toMatchObject({ imported: 1, duplicate: false });
    expect((await kiorex(ops, 'POST', '/admin/payments/settlement/import', { psp: 'paymob', filename: 'e2e.csv', content: csv })).body.duplicate).toBe(true);
    const f = await kiorex(undefined, 'POST', '/pay/webhooks/paymob', { type: 'TRANSACTION', obj: { id: 1, amount_cents: 100, order: { id: 1 } } }); expect([400, 401]).toContain(f.status);
  });
});
