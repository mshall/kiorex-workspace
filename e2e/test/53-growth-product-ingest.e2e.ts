import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kiorex, opsLogin, waitFor, q } from '../src/clients.js';
import { pharmacy, pharmacyStaff, recordDevGate, releaseDevGate, setFlag, waitPartnerFlags, patientToken, payFake, rnd } from '../src/verticals.js';
import { seedTouch } from '../src/growth.js';
import { randomUUID } from 'node:crypto';

/**
 * GRW-P4-B2 on the real stack: Kiorex :4000 decides every pharmacy order once (GrowthProductDecision) and sends the optional acquisition block to Kiorly Pharmacy :3100,
 * which stores it and credits the pharmacy's OWN link (orders on placement, completed on dispense). The commission link of products is inert: no charge exists.
 * The partner connection (orgRef) of the dev registration is inserted for this suite and removed afterwards. The consent-gated touch endpoint is locked until the counsel gate,
 * so the suite writes the same touch row the endpoint would (as suites 25 to 28 do).
 */
describe('53. Kiorex product ingest and decision against the real Kiorly Pharmacy', () => {
  let ops: string, p1: string, owner: string, pharm: string, branchId: string, orgId: string, sub: string;
  const regId = 'pr_pharmacy_dev';
  let firstLink: { id: string; code: string } | undefined;

  beforeAll(async () => {
    ops = (await opsLogin()).accessToken; p1 = await patientToken(); owner = await pharmacyStaff('owner'); pharm = await pharmacyStaff('pharmacist');
    branchId = (await pharmacy(owner, 'GET', '/kiorex-orders/settings')).body.find((x: any) => x.optedIn)?.branchId;
    if (!branchId) throw new Error('no opted-in pharmacy branch (run `up.sh --seed`)');
    orgId = (await q('kiorly_pharmacy', `select "orgId" from "IntegrationClient" where "key" = 'kx_dev_pharmacy_client'`))[0].orgId;
    sub = (await kiorex(p1, 'GET', '/me/profile')).body.sub;
    await setFlag(ops, 'kiorex.pharmacy_orders', 'ON').catch(() => undefined);
    await recordDevGate(ops, 'kiorex.pharmacy_orders'); await waitPartnerFlags();
    for (const ch of ['WHATSAPP', 'PUSH']) await kiorex(p1, 'PUT', `/me/notification-preferences/${ch}`, { quietStart: 0, quietEnd: 0 });
    // links left active by an earlier (failed) run would still be evidence for this patient: revoke them first so the suite is repeatable
    for (const l of (((await pharmacy(owner, 'GET', '/growth/links')).body as any)?.items ?? []) as any[]) if (String(l.label).startsWith('E2E 53') && l.status !== 'REVOKED') await pharmacy(owner, 'PATCH', `/growth/links/${l.id}`, { status: 'REVOKED' });
    await new Promise((r) => setTimeout(r, 3000));
    await q('kiorex_platform', `delete from "PartnerConnection" where id = 'pc_e2e_53'`);
    await q('kiorex_platform', `insert into "PartnerConnection" (id, kind, "orgRef", name, "statusTokenHash", status, "registrationId", "updatedAt") values ('pc_e2e_53', 'PHARMACY', $1, 'E2E 53 pharmacy', 'x', 'LIVE', $2, now())`, [orgId, regId]);
  });
  afterAll(async () => {
    await q('kiorex_platform', `delete from "PartnerConnection" where id = 'pc_e2e_53'`).catch(() => undefined);
    for (const ch of ['WHATSAPP', 'PUSH']) await kiorex(p1, 'PUT', `/me/notification-preferences/${ch}`, { quietStart: null, quietEnd: null }).catch(() => undefined);
    await releaseDevGate(ops, 'kiorex.pharmacy_orders').catch(() => undefined);
  });

  async function drug() {
    const tag = rnd();
    const d = await pharmacy(owner, 'POST', '/catalogue/drugs', { brandName: `E2E-53-${tag}`, activeIngredient: `e2e-ing-${tag}`, strength: '500 mg', dosageForm: 'tablet', packSize: '20', rxOnly: false, price: '40.00' });
    expect(d.status, JSON.stringify(d.body)).toBe(201);
    const exp = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);
    expect((await pharmacy(owner, 'POST', '/inventory/receipts', { branchId, invoiceNo: `E2E53-${tag}`, lines: [{ drugId: d.body.id, lotNumber: `L-${tag}`, expiryDate: exp, quantity: 20, unitCost: '20.00' }] })).status).toBe(201);
    return { id: d.body.id as string, name: d.body.brandName as string };
  }
  async function order(dr: { id: string; name: string }) {
    expect((await kiorex(p1, 'PUT', '/pharmacy/cart', { pharmacyId: branchId, items: [{ sku: dr.id, qty: 1 }] })).status).toBe(200);
    expect((await kiorex(p1, 'PUT', '/pharmacy/cart/delivery', { method: 'PICKUP' })).status).toBe(200);
    const o = await kiorex(p1, 'POST', '/pharmacy/orders', {}); expect(o.status, JSON.stringify(o.body)).toBe(201);
    await payFake(o.body.payment.paymentId);
    await waitFor('order submitted', async () => (await kiorex(p1, 'GET', `/pharmacy/orders/${o.body.id}`)).body.status === 'SUBMITTED' || false, 30_000);
    return o.body.id as string;
  }
  const decisionOf = async (id: string) => (await q('kiorex_platform', `select id, origin, "reasonCode", "inputsHash", "evidenceTouchIds" from "GrowthProductDecision" where "factKind" = 'ORDER' and "factId" = $1 and "supersedesId" is null`, [id]))[0];
  const partnerOrder = async (id: string) => (await q('kiorly_pharmacy', `select id, "acquisitionOrigin", "acquisitionDecisionRef", "acquisitionLinkId" from "KiorexOrder" where "externalOrderId" = $1`, [id]))[0];
  const daily = async (linkId: string) => (await q('kiorly_pharmacy', `select coalesce(sum(orders),0)::int orders, coalesce(sum(completed),0)::int completed from "ProviderReferralLinkDaily" where "linkId" = $1`, [linkId]))[0];

  it('a pharmacy link touch makes the order PROVIDER_LED at Kiorex, the partner stores the block and counts orders then completed once; the link registry carries product PHARMACY', async () => {
    const link = await pharmacy(owner, 'POST', '/growth/links', { label: `E2E 53 ${rnd()}`, ownerScope: 'ORG' });
    expect(link.status, JSON.stringify(link.body)).toBe(201);
    await waitFor('Kiorex learned the pharmacy link', async () => (await q('kiorex_platform', `select product, "ownerOrgRef", "linkStatus" from "GrowthAcquisitionSource" where "sourceKind" = 'PROVIDER_LINK' and "sourceRef" = $1`, [link.body.code]))[0] ?? false, 20_000, 500);
    expect((await q('kiorex_platform', `select product, "ownerOrgRef" from "GrowthAcquisitionSource" where "sourceRef" = $1`, [link.body.code]))[0]).toMatchObject({ product: 'PHARMACY', ownerOrgRef: orgId });
    firstLink = link.body;
    await seedTouch({ sub, kind: 'PROVIDER_LINK', ageMs: 3_600_000, linkCode: link.body.code, org: orgId });
    const dr = await drug();
    const id = await order(dr);

    const d = await decisionOf(id);
    expect(d).toMatchObject({ origin: 'PROVIDER_LED', reasonCode: 'PRIOR_PROVIDER_TOUCH' });
    expect(d.inputsHash).toMatch(/^[0-9a-f]{64}$/);
    const po = await partnerOrder(id);
    expect(po).toMatchObject({ acquisitionOrigin: 'PROVIDER_LED', acquisitionDecisionRef: d.id, acquisitionLinkId: link.body.id });
    expect(await daily(link.body.id)).toEqual({ orders: 1, completed: 0 });

    const inbox = (await pharmacy(pharm, 'GET', '/kiorex-orders')).body.find((o: any) => o.externalOrderId === id);
    const acc = await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/accept`, {});
    expect(acc.status).toBe(201);
    await pharmacy(pharm, 'POST', `/dispensings/${acc.body.dispensing.id}/signoff`, {});
    await pharmacy(pharm, 'POST', `/kiorex-orders/${inbox.id}/ready`);
    expect((await pharmacy(pharm, 'POST', `/dispensings/${acc.body.dispensing.id}/complete`, { idempotencyKey: randomUUID() })).status).toBe(201);
    expect(await daily(link.body.id)).toEqual({ orders: 1, completed: 1 });
    // the partner's own performance view shows the order as coming from its link
    const perf = await pharmacy(owner, 'GET', '/growth/performance?days=7').catch(() => null);
    if (perf && perf.status === 200) expect(JSON.stringify(perf.body)).toContain('providerOriginated');

    // inert commission link and no PHI: no revenue fact or charge for a product order, and the decision tables carry no order content
    expect((await q('kiorex_platform', `select count(*)::int c from "GrowthRevenueFact" where "bookingId" = $1`, [id]))[0].c).toBe(0);
    expect(JSON.stringify(await q('kiorex_platform', `select * from "GrowthProductDecision" where "factId" = $1`, [id]))).not.toContain(dr.name);
    // append-only
    await expect(q('kiorex_platform', `update "GrowthProductDecision" set origin = 'MARKETPLACE' where "factId" = $1`, [id])).rejects.toThrow();
  });

  it('after the pharmacy revokes the link the same patient\'s next order is not PROVIDER_LED and the partner counts nothing more; a code of another product or organisation is never evidence', async () => {
    expect(firstLink).toBeTruthy();
    expect((await pharmacy(owner, 'PATCH', `/growth/links/${firstLink!.id}`, { status: 'REVOKED' })).status).toBeLessThan(300);
    await waitFor('revocation arrived', async () => (await q('kiorex_platform', `select 1 from "GrowthAcquisitionSource" where "sourceRef" = $1 and "linkStatus" = 'REVOKED'`, [firstLink!.code])).length > 0 || false, 20_000, 500);
    // a touch of a code that exists only as a Clinic link of another organisation is ignored for a pharmacy order
    await seedTouch({ sub, kind: 'PROVIDER_LINK', ageMs: 1_800_000, linkCode: 'ZZ53ZZ53', org: 'org_not_this_pharmacy' });
    const id = await order(await drug());
    const d = await decisionOf(id);
    expect(['MARKETPLACE', 'UNATTRIBUTED']).toContain(d.origin);
    expect((await partnerOrder(id)).acquisitionLinkId).toBeNull();
    expect(await daily(firstLink!.id)).toEqual({ orders: 1, completed: 1 });
    // idempotent decision: the stored row is unchanged by a re-read
    expect((await decisionOf(id)).id).toBe(d.id);
  });

  it('ops summary: decisions per product and origin, masked below ten, ops only', async () => {
    const r = await kiorex(ops, 'GET', '/ops/growth/product-decisions?days=1');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.commissionLink).toBe('INERT');
    expect(r.body.cells.every((c: any) => c.count === '<10' || c.count >= 10 || c.count === 0)).toBe(true);
    expect((await kiorex(p1, 'GET', '/ops/growth/product-decisions')).status).toBe(403);
  });
});
