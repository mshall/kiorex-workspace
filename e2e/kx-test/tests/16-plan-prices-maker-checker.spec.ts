import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { ensureSession, liveToken, openAs } from '../lib/session';

/**
 * Plan prices with a second approver, end to end on the DEPLOYED kx-test hosts: Kiorly ops PROPOSES, a different Kiorly super admin APPROVES, the product (Pharmacy, Lab, Clinic)
 * holds the price, the public API shows it only when it is in force.
 *
 * What changes on the live system and how it is undone. Prices are append-only by design, so nothing is deleted:
 *  - PHARMACY and LAB: throwaway prices in an UNLAUNCHED test market, code ZZ, currency XTS (the ISO testing code). No organisation sits on market ZZ (the preview says 0 organisations),
 *    no landing page asks for ZZ, nothing is charged. The rows stay as inert history (priceVersion grows by one per run). The real market EG is never touched.
 *  - CLINIC: it holds the real organisation Dr Ahmed Shall. NO Clinic price is ever published here: proposals are previewed, proposed, rejected and withdrawn only, and the spec checks
 *    that the Clinic price rows are identical before and after. (The Clinic publish path is covered by integration tests on a private database.)
 *  - Every proposal this run leaves pending is withdrawn or rejected in afterAll; rejected and withdrawn proposals stay in the history (that is the rule under test).
 * Personas: ops (ops_admin) proposes, superAdmin decides. One super admin exists on kx-test, so "a different person" is ops proposing and the super admin approving, and the super admin
 * trying (and failing) to approve their own proposal.
 */
const ADMIN = `${URLS.api}/api/v1/admin/kiorly-plans`;
const PUB = `${URLS.api}/api/v1/public/plans`;
const TAG = `E2E ${Date.now().toString(36).toUpperCase()}`;
const MARKET = 'ZZ', CUR = 'XTS';

test.describe.serial('Kiorly plan prices: maker-checker on kx-test', () => {
  let api: APIRequestContext; let supCtx: BrowserContext; let opsCtx: BrowserContext; let sup: Page; let ops: Page;
  let supH: Record<string, string>; let opsH: Record<string, string>;
  const mine: string[] = []; // proposal ids this run created
  let clinicBefore = ''; let clinicPlanId = ''; let egMarket = '';

  const body = (o: Record<string, unknown> = {}) => ({ product: 'PHARMACY', planRef: 'PRO', marketCode: MARKET, currency: CUR, interval: 'MONTHLY', amount: '20.00', note: TAG, ...o });
  const propose = async (h: Record<string, string>, o: Record<string, unknown> = {}) => { const r = await api.post(`${ADMIN}/proposals`, { headers: h, data: body(o) }); expect(r.status(), await r.text()).toBe(201); const j = await r.json(); mine.push(j.id); return j; };
  const act = (h: Record<string, string>, id: string, action: string, data: object = {}) => api.post(`${ADMIN}/proposals/${id}/${action}`, { headers: h, data });
  const overview = async (h = supH) => (await api.get(ADMIN, { headers: h })).json();
  const clinicRows = async () => { const o = await overview(); return JSON.stringify(o.clinic.plans.map((p: { id: string; prices: { id: string; amount: string; priceVersion: number; validTo: string | null }[] }) => [p.id, p.prices.map((x) => [x.id, x.amount, x.priceVersion, x.validTo])]).sort()); };

  test.beforeAll(async ({ browser, playwright }) => {
    api = await playwright.request.newContext();
    await ensureSession(browser, 'superAdmin'); await ensureSession(browser, 'ops');
    ({ context: supCtx, page: sup } = await openAs(browser, 'superAdmin')); ({ context: opsCtx, page: ops } = await openAs(browser, 'ops'));
    await sup.goto(`${URLS.opsKiorly}/kiorly-plans`); await ops.goto(`${URLS.opsKiorly}/kiorly-plans`);
    supH = { authorization: `Bearer ${await liveToken(sup)}`, origin: URLS.opsKiorly, 'content-type': 'application/json' };
    opsH = { authorization: `Bearer ${await liveToken(ops)}`, origin: URLS.opsKiorly, 'content-type': 'application/json' };
    const o = await overview();
    clinicBefore = await clinicRows(); clinicPlanId = o.clinic.plans.find((p: { key: string }) => p.key === 'LITE')?.id ?? o.clinic.plans[0].id; egMarket = o.clinic.markets.find((m: { code: string }) => m.code === 'EG').code;
  });
  test.afterAll(async () => {
    try { // nothing of this run stays pending
      const all = (await (await api.get(`${ADMIN}/proposals?status=PENDING`, { headers: supH })).json()) as { id: string; proposedBy: string; note: string | null }[];
      for (const p of all.filter((x) => x.note === TAG || mine.includes(x.id))) {
        const a = await act(supH, p.id, 'withdraw'); if (a.status() !== 200) { const b = await act(supH, p.id, 'reject', { note: 'cleanup' }); console.log(`cleanup ${p.id}: withdraw ${a.status()}, reject ${b.status()}`); }
      }
      console.log(`Test market ${MARKET} (${CUR}) price rows are append-only and stay as inert history; no Clinic price was published (rows unchanged: ${clinicBefore === (await clinicRows())}).`);
    } catch (e) { console.log(`CLEANUP FAILED, withdraw the pending "${TAG}" proposals in the Kiorly admin Plans screen: ${(e as Error).message}`); }
    await api?.dispose(); await supCtx?.close(); await opsCtx?.close();
  });

  test('roles: ops proposes but does not decide; a super admin decides; finance and the public are out; the overview says what you may do', async () => {
    expect((await api.get(`${ADMIN}/proposals`)).status()).toBe(401);
    const o = await overview(opsH); expect(o.capabilities).toMatchObject({ canPropose: true, canApprove: false });
    const s = await overview(supH); expect(s.capabilities).toMatchObject({ canPropose: true, canApprove: true });
    for (const k of ['pharmacy', 'lab']) { expect(s[k].available, `${k} price connection: ${JSON.stringify(s[k]).slice(0, 200)}`).toBe(true); expect(s[k].editions).toEqual(['LITE', 'PRO', 'CHAIN']); }
    expect((await act(opsH, 'kpp_doesnotexist1', 'approve')).status()).toBe(403);
    expect((await act(opsH, 'kpp_doesnotexist1', 'reject')).status()).toBe(403);
    expect((await api.post(`${ADMIN}/clinic/${clinicPlanId}/prices`, { headers: supH, data: { marketId: 'x', amount: '1' } })).status()).toBe(409); // no direct publishing any more
  });

  test('a preview writes nothing, reports the impact and warns (never blocks) when the annual price is not above the monthly one', async () => {
    const before = (await overview()).proposals.length;
    const first = await propose(opsH, { amount: '10.00' }); // monthly 10.00 in the test market, pending
    const r = await api.post(`${ADMIN}/prices/preview`, { headers: opsH, data: body({ interval: 'ANNUAL', amount: '8.00' }) });
    expect(r.status(), await r.text()).toBe(200);
    const j = await r.json(); expect(j.preview.affected).toBe(0); expect(j.preview.priceVersion).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(j.warnings)).toBe(true);
    expect((await overview()).proposals.length).toBe(before + 1); // only the one proposal above
    expect((await act(opsH, first.id, 'withdraw')).status()).toBe(200);
  });

  test('Pharmacy through the screens: ops proposes in the UI, cannot approve; the super admin approves in the UI; the price is published once and shown by the public API only for that market', async () => {
    await ops.goto(`${URLS.opsKiorly}/kiorly-plans`);
    await ops.getByTestId('propose-pharmacy-PRO').click();
    const d = ops.getByTestId('propose-dialog');
    await d.getByLabel(/^market$/i).fill(MARKET); await d.getByLabel(/^currency$/i).fill(CUR); await d.getByLabel(/^amount$/i).fill('20.00'); await d.getByLabel(/note for the approver/i).fill(TAG);
    await expect(d.getByTestId('propose-submit')).toBeDisabled(); // preview first
    await d.getByTestId('propose-preview').click();
    await expect(d.getByTestId('price-preview')).toContainText(/no existing subscriber|organisation\(s\) are on this edition/i, { timeout: 30_000 });
    await d.getByTestId('propose-submit').click();
    await expect(ops.getByTestId('pharmacy-note')).toContainText(/different super admin approves/i, { timeout: 30_000 });
    const mineRow = ops.locator('[data-testid^="proposal-kpp_"]', { hasText: /waiting for approval/i }).filter({ hasText: '20.00 XTS' }).first();
    await expect(mineRow).toContainText(MARKET);
    const id = ((await mineRow.getAttribute('data-testid')) ?? '').replace('proposal-', ''); mine.push(id);
    await expect(ops.getByTestId(`approve-${id}`)).toHaveCount(0); await expect(ops.getByTestId(`reject-${id}`)).toHaveCount(0);
    expect((await act(opsH, id, 'approve')).status()).toBe(403);
    expect((await (await api.get(`${PUB}?market=${MARKET}`)).json()).modules.find((m: { id: string }) => m.id === 'pharmacy').plans.every((p: { priceStatus: string }) => p.priceStatus === 'TO_BE_ANNOUNCED')).toBe(true); // nothing yet
    await sup.goto(`${URLS.opsKiorly}/kiorly-plans`);
    await sup.getByTestId(`approve-${id}`).click();
    await sup.getByLabel(/^note/i).fill(TAG); await sup.getByTestId('decide-confirm').click();
    await expect(sup.getByTestId('proposals-msg')).toContainText(/approved and published/i, { timeout: 60_000 });
    await expect(sup.getByTestId(`status-${id}`)).toContainText(/approved and published/i);
    await expect(sup.locator(`[data-testid^="pharmacy-price-PRO-${MARKET}-MONTHLY-"]`).first()).toContainText('20.00 XTS');
    const pub = await (await api.get(`${PUB}?market=${MARKET}`)).json();
    const pro = pub.modules.find((m: { id: string }) => m.id === 'pharmacy').plans.find((p: { id: string }) => p.id === 'pro');
    expect(pro.priceStatus).toBe('SET'); expect(pro.prices[0]).toMatchObject({ interval: 'MONTHLY', unit: 'PER_TENANT', amount: '20.00', currency: CUR });
    const eg = await (await api.get(PUB)).json(); // the real market is untouched
    for (const m of eg.modules.filter((x: { id: string }) => x.id !== 'clinic')) for (const p of m.plans) { expect(p.priceStatus, `${m.id}/${p.id} in EG`).toBe('TO_BE_ANNOUNCED'); expect(p.prices).toEqual([]); }
    expect((await act(supH, id, 'approve')).status()).toBe(409); // decided once
  });

  test('versions: a second price supersedes the first in the same market; an annual price below the monthly one is warned about and still goes through when approved', async () => {
    const m = await propose(opsH, { amount: '25.00' });
    expect((await act(supH, m.id, 'approve')).status()).toBe(200);
    const a = await propose(opsH, { interval: 'ANNUAL', amount: '15.00' });
    expect(a.warnings.map((w: { code: string }) => w.code)).toContain('ANNUAL_NOT_ABOVE_MONTHLY');
    expect((await act(supH, a.id, 'approve')).status()).toBe(200);
    const ph = (await overview()).pharmacy.prices.filter((p: { marketCode: string; edition: string }) => p.marketCode === MARKET && p.edition === 'PRO');
    const monthly = ph.filter((p: { interval: string }) => p.interval === 'MONTHLY').sort((x: { priceVersion: number }, y: { priceVersion: number }) => y.priceVersion - x.priceVersion);
    expect(monthly.length).toBeGreaterThanOrEqual(2); expect(monthly[0].amount).toBe('25.00'); expect(monthly[0].validTo).toBeNull(); expect(monthly[1].validTo).not.toBeNull();
    expect((await overview()).catalogueWarnings.some((w: { product: string; market: string; code: string }) => w.product === 'PHARMACY' && w.market === MARKET && w.code === 'ANNUAL_NOT_ABOVE_MONTHLY')).toBe(true);
    const pro = (await (await api.get(`${PUB}?market=${MARKET}`)).json()).modules.find((x: { id: string }) => x.id === 'pharmacy').plans.find((p: { id: string }) => p.id === 'pro');
    expect(pro.prices.map((p: { interval: string; amount: string }) => `${p.interval}:${p.amount}`)).toEqual(['MONTHLY:25.00', 'ANNUAL:15.00']);
  });

  test('Lab: a rejected proposal stays in the history and frees the slot; the next one is approved and published', async () => {
    const r = await propose(opsH, { product: 'LAB', planRef: 'PRO', amount: '30.00' });
    expect((await api.post(`${ADMIN}/proposals`, { headers: opsH, data: body({ product: 'LAB', planRef: 'PRO', amount: '31.00' }) })).status()).toBe(409); // a second open proposal for the same slot is refused
    const rej = await act(supH, r.id, 'reject', { note: `${TAG} too high` }); expect(rej.status()).toBe(200); expect((await rej.json()).status).toBe('REJECTED');
    const hist = (await (await api.get(`${ADMIN}/proposals?status=REJECTED`, { headers: opsH })).json()) as { id: string; decisionNote: string }[];
    expect(hist.find((x) => x.id === r.id)?.decisionNote).toContain('too high');
    const ok = await propose(opsH, { product: 'LAB', planRef: 'PRO', amount: '30.00' });
    const done = await act(supH, ok.id, 'approve'); expect(done.status(), await done.text()).toBe(200);
    const lab = (await overview()).lab.prices.filter((p: { marketCode: string; edition: string }) => p.marketCode === MARKET && p.edition === 'PRO');
    expect(lab[0]).toMatchObject({ amount: '30.00', currency: CUR, proposedBy: expect.any(String), publishedBy: expect.any(String) });
    expect(lab[0].proposedBy).not.toBe(lab[0].publishedBy); // the maker and the checker differ, on the product's own row
  });

  test('a super admin never approves or rejects their own proposal; only the proposer withdraws; the withdrawn one stays in the history', async () => {
    const own = await propose(supH, { product: 'LAB', planRef: 'CHAIN', amount: '40.00' });
    for (const a of ['approve', 'reject']) { const r = await act(supH, own.id, a); expect(r.status()).toBe(403); expect((await r.json()).code).toBe('TWO_PERSON_RULE'); }
    expect((await act(opsH, own.id, 'withdraw')).status()).toBe(403);
    const w = await act(supH, own.id, 'withdraw'); expect(w.status()).toBe(200); expect((await w.json()).status).toBe('WITHDRAWN');
    expect((await overview()).lab.prices.some((p: { edition: string; marketCode: string }) => p.edition === 'CHAIN' && p.marketCode === MARKET)).toBe(false);
    expect(((await (await api.get(`${ADMIN}/proposals?status=WITHDRAWN`, { headers: opsH })).json()) as { id: string }[]).some((x) => x.id === own.id)).toBe(true);
  });

  test('Clinic: previewed, proposed, rejected and withdrawn on the real market, and no Clinic price row changes', async () => {
    const clinicBody = (o: Record<string, unknown> = {}) => ({ product: 'CLINIC', planRef: clinicPlanId, marketCode: egMarket, currency: 'EGP', interval: 'MONTHLY', unit: 'PER_TENANT', amount: '1.00', validFrom: '2099-01-01T00:00:00Z', note: TAG, ...o });
    const pv = await api.post(`${ADMIN}/prices/preview`, { headers: opsH, data: clinicBody() }); expect(pv.status(), await pv.text()).toBe(200);
    expect((await api.post(`${ADMIN}/prices/preview`, { headers: opsH, data: clinicBody({ marketCode: 'ZZ' }) })).status()).toBe(400); // the Clinic does not know market ZZ: refused up front
    expect(await clinicRows()).toBe(clinicBefore);
    const p = await api.post(`${ADMIN}/proposals`, { headers: opsH, data: clinicBody() }); expect(p.status(), await p.text()).toBe(201); const pj = await p.json(); mine.push(pj.id);
    expect((await api.post(`${ADMIN}/proposals`, { headers: opsH, data: clinicBody({ amount: '2.00' }) })).status()).toBe(409); // one open proposal per slot
    expect((await act(opsH, pj.id, 'approve')).status()).toBe(403);
    const rej = await act(supH, pj.id, 'reject', { note: `${TAG} test only` }); expect(rej.status()).toBe(200);
    const own = await api.post(`${ADMIN}/proposals`, { headers: supH, data: clinicBody() }); expect(own.status()).toBe(201); const oj = await own.json(); mine.push(oj.id);
    expect((await act(supH, oj.id, 'approve')).status()).toBe(403);
    expect((await act(supH, oj.id, 'withdraw')).status()).toBe(200);
    expect(await clinicRows()).toBe(clinicBefore); // no Clinic price was published
    const hist = (await (await api.get(`${ADMIN}/proposals?product=CLINIC`, { headers: opsH })).json()) as { id: string; status: string }[];
    expect(hist.find((x) => x.id === pj.id)?.status).toBe('REJECTED'); expect(hist.find((x) => x.id === oj.id)?.status).toBe('WITHDRAWN');
  });

  test('the history is append-only: there is no way to edit or delete a proposal through the API', async () => {
    const id = mine[0]!;
    for (const m of ['PATCH', 'PUT', 'DELETE']) { const r = await api.fetch(`${ADMIN}/proposals/${id}`, { method: m, headers: supH, data: {} }); expect(r.status(), m).toBeGreaterThanOrEqual(400); }
    const list = (await (await api.get(`${ADMIN}/proposals`, { headers: supH })).json()) as { status: string }[];
    for (const s of ['APPROVED', 'REJECTED', 'WITHDRAWN']) expect(list.some((x) => x.status === s), s).toBe(true);
  });

  test('Arabic screen: headings in Arabic, right to left, Western digits only, no horizontal scroll', async () => {
    await sup.evaluate(() => { localStorage.setItem('kx-lang', 'ar'); localStorage.setItem('kiorly.lang', 'ar'); });
    await sup.goto(`${URLS.opsKiorly}/kiorly-plans`);
    await expect(sup.getByRole('heading', { name: 'مقترحات الأسعار' })).toBeVisible({ timeout: 30_000 });
    await expect(sup.getByRole('heading', { name: 'أسعار الصيدلية' })).toBeVisible();
    const text = await sup.getByTestId('proposals-section').innerText(); expect(text).not.toMatch(/[٠-٩۰-۹]/);
    expect(await sup.evaluate(() => document.documentElement.dir)).toBe('rtl');
    expect(await sup.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await sup.evaluate(() => { localStorage.setItem('kx-lang', 'en'); localStorage.setItem('kiorly.lang', 'en'); });
  });
});
