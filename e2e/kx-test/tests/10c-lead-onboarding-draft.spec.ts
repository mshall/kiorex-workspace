import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { ensureSession, liveToken, openAs } from '../lib/session';

/**
 * ONBOARDING (and WON) join request -> ONE DRAFT onboarding request; approval of a CONNECTED draft pre-creates the enrolment code; only a reviewer cancels (founder decisions 28 Nov 2026), live on kx-test.
 * Three throwaway leads (tagged test data: name prefix [TEST], reserved e-mail domain, synthetic phones; the lead rate limits are NOT touched: 3 submissions, three different phones):
 *   A connected clinic -> won, reopened and won again (still exactly one draft), submitted by ops, approved by a DIFFERENT person (super admin)
 *   B standalone lab   -> won, submitted, rejected by the super admin with a reason, reopened
 *   C connected pharmacy -> LOST (never a draft; the manual create answers 409)
 * Proves: no draft before ONBOARDING (the draft is created when the request reaches ONBOARDING and WON reuses it), prefilled draft without contact data, assignee = lead owner, idempotent, link lead -> draft -> lead, EN and AR (Western digits), two-person rule, approval
 * of a CONNECTED draft creates ONE enrolment code (shown once, never listed; revoked again at the end) and nothing else (no connection request, no organisation); a cancel needs a reason. Everything is removed at the end by the super admin (count first). Two Passport sign-ins (ops_admin, super_admin) at most.
 */
const STAMP = Date.now().toString(36).toUpperCase(); const TAG = `OB${STAMP}`;
const phone = () => `+2010${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
const idem = () => `kx-ob-${STAMP}-${Math.random().toString(36).slice(2, 10)}`;
const lead = (type: 'CLINIC' | 'LAB' | 'PHARMACY', mode: 'STANDALONE' | 'CONNECTED') => ({
  source: 'kiorly-site', env: 'test', mode, providerType: type, legalName: `[TEST] ${TAG} ${type} ${mode}`, contactName: 'OB Test Person', phone: phone(), email: `${TAG.toLowerCase()}-${type.toLowerCase()}@example.test`, market: 'EG', governorate: 'GIZA', city: 'Dokki',
  ...(type === 'CLINIC' ? { branches: 1, staffCount: 3, specialties: ['PEDIATRICS'], answers: { rooms: 2 }, modules: ['CLINIC'] } : type === 'LAB' ? { branches: 1, staffCount: 5, answers: { homeSampling: true, collectionPoints: 1 }, modules: ['LAB'] } : { branches: 1, staffCount: 2, answers: { delivery: true, open24h: false }, modules: ['PHARMACY'] }),
  goLive: 'WITHIN_1_MONTH', locale: 'en', contactChannel: 'WHATSAPP', note: 'automated onboarding-draft check, safe to delete', consent: { accepted: true, textVersion: 'draft-2' },
});

test.describe.serial('WON creates one draft onboarding request (kx-test)', () => {
  let api: APIRequestContext; const ids: Record<'A' | 'B' | 'C', { id: string; ref: string }> = {} as never;
  let opsCtx: BrowserContext; let opsPage: Page; let supCtx: BrowserContext; let supPage: Page; let opsSub = '';
  const H = async (p: Page) => ({ authorization: `Bearer ${await liveToken(p)}`, origin: URLS.ops });
  const A = (p: Page) => async (method: string, path: string, data?: unknown) => { const r = await p.request.fetch(`${URLS.api}/api/v1/admin/${path}`, { method, headers: await H(p), data: data as never }); return { status: r.status(), body: await r.json().catch(() => ({})) as any }; };
  let ops: ReturnType<typeof A>; let sup: ReturnType<typeof A>;

  test.beforeAll(async ({ browser, playwright }) => {
    api = await playwright.request.newContext();
    await ensureSession(browser, 'ops'); ({ context: opsCtx, page: opsPage } = await openAs(browser, 'ops')); await opsPage.goto(`${URLS.ops}/leads`);
    await ensureSession(browser, 'superAdmin'); ({ context: supCtx, page: supPage } = await openAs(browser, 'superAdmin')); await supPage.goto(`${URLS.ops}/leads`);
    ops = A(opsPage); sup = A(supPage);
    opsSub = (JSON.parse(Buffer.from((await liveToken(opsPage)).split('.')[1]!, 'base64url').toString()) as { sub: string }).sub;
  });
  test.afterAll(async () => { await opsCtx?.close(); await supCtx?.close(); await api?.dispose(); });

  test('three throwaway test leads are submitted (public API, three different phones)', async () => {
    for (const [k, t, m] of [['A', 'CLINIC', 'CONNECTED'], ['B', 'LAB', 'STANDALONE'], ['C', 'PHARMACY', 'CONNECTED']] as const) {
      const r = await api.fetch(`${URLS.api}/api/v1/public/leads`, { method: 'POST', headers: { origin: URLS.site, 'content-type': 'application/json', 'idempotency-key': idem() }, data: lead(t, m) });
      expect(r.status(), await r.text()).toBe(201); const ref = (await r.json()).reference as string;
      const found = await ops('GET', `leads?q=${ref}`); expect(found.body.items).toHaveLength(1); ids[k] = { id: found.body.items[0].id, ref };
    }
  });

  test('before ONBOARDING there is no draft; the owner is set on lead A; ONBOARDING creates exactly one draft (WON reuses it), prefilled, with the lead owner as assignee and no contact data', async () => {
    expect((await ops('GET', 'leads/owners')).body.some((o: { sub: string }) => o.sub === opsSub)).toBe(true); // the console registers the signed-in user as an assignable owner
    expect((await ops('PATCH', `leads/${ids.A.id}`, { ownerSub: opsSub })).status).toBe(200);
    const q = await ops('PATCH', `leads/${ids.A.id}`, { status: 'QUALIFIED' }); expect(q.status).toBe(200); expect(q.body.onboardingRequest).toBeNull();
    const onb = await ops('PATCH', `leads/${ids.A.id}`, { status: 'ONBOARDING' }); expect(onb.status).toBe(200); expect(onb.body.onboardingRequest).toMatchObject({ status: 'DRAFT' });
    const won = await ops('PATCH', `leads/${ids.A.id}`, { status: 'WON' }); expect(won.status).toBe(200); expect(won.body.onboardingRequest.id).toBe(onb.body.onboardingRequest.id);
    const d = won.body.onboardingRequest; expect(d).toMatchObject({ status: 'DRAFT', kind: 'CLINIC', assigneeSub: opsSub });
    const draft = await ops('GET', `lead-onboarding/${d.id}`);
    expect(draft.body).toMatchObject({ leadId: ids.A.id, contactRef: ids.A.ref, status: 'DRAFT', kind: 'CLINIC', mode: 'CONNECTED', providerType: 'CLINIC', modules: ['CLINIC'], market: 'EG', legalName: `[TEST] ${TAG} CLINIC CONNECTED`, assigneeSub: opsSub, isTest: true, leadStatus: 'WON', blockers: [] });
    expect(JSON.stringify(draft.body)).not.toMatch(/OB Test Person|@example\.test|\+2010|automated onboarding-draft/); // contact data stays in the lead
    ids.A['draft' as never] = d.id as never;
  });

  test('reopening WON -> ONBOARDING -> WON never creates a second draft; the manual create is idempotent too', async () => {
    const first = (await ops('GET', `leads/${ids.A.id}`)).body.onboardingRequest.id;
    expect((await ops('PATCH', `leads/${ids.A.id}`, { status: 'ONBOARDING' })).status).toBe(200);
    const again = await ops('PATCH', `leads/${ids.A.id}`, { status: 'WON' }); expect(again.body.onboardingRequest.id).toBe(first);
    const manual = await ops('POST', `lead-onboarding/by-lead/${ids.A.id}`, {}); expect(manual.body).toMatchObject({ id: first, created: false });
    const list = await ops('GET', `lead-onboarding?test=only&assignee=${encodeURIComponent(opsSub)}`); expect(list.body.items.filter((x: { contactRef: string }) => x.contactRef === ids.A.ref)).toHaveLength(1);
  });

  test('a standalone lab creates an unassigned LAB draft; a LOST lead never creates one (manual create 409)', async () => {
    for (const s of ['QUALIFIED', 'ONBOARDING']) expect((await ops('PATCH', `leads/${ids.B.id}`, { status: s })).status).toBe(200);
    const won = await ops('PATCH', `leads/${ids.B.id}`, { status: 'WON' }); expect(won.body.onboardingRequest).toMatchObject({ status: 'DRAFT', kind: 'LAB', assigneeSub: null });
    const b = await ops('GET', `lead-onboarding/${won.body.onboardingRequest.id}`); expect(b.body).toMatchObject({ mode: 'STANDALONE', providerType: 'LAB' }); ids.B['draft' as never] = b.body.id as never;
    const lost = await ops('PATCH', `leads/${ids.C.id}`, { status: 'LOST', lostReason: 'LATER' }); expect(lost.status).toBe(200); expect(lost.body.onboardingRequest).toBeNull();
    const m = await ops('POST', `lead-onboarding/by-lead/${ids.C.id}`, {}); expect(m.status).toBe(409); expect(m.body.code).toBe('LEAD_NOT_READY');
    expect((await ops('GET', `leads/${ids.C.id}`)).body.onboardingRequest).toBeNull();
  });

  test('console UI (English): lead -> draft -> back to the lead; the explainer says nothing is activated', async () => {
    await opsPage.goto(`${URLS.ops}/leads/${ids.A.id}`);
    await expect(opsPage.getByTestId('lead-onboarding-status')).toContainText('Draft'); await expect(opsPage.getByTestId('lead-event-ONBOARDING').first()).toContainText('draft created');
    await opsPage.getByTestId('lead-onboarding-open').click();
    await expect(opsPage.getByTestId('lead-onboarding-detail')).toBeVisible(); await expect(opsPage.getByTestId('lob-explainer')).toContainText('No organisation, price, commission or Passport identity is created');
    await expect(opsPage.getByTestId('lob-status')).toContainText('Draft'); await expect(opsPage.getByTestId('lob-kind')).toHaveValue('CLINIC');
    await opsPage.getByTestId('lob-back-to-lead').click(); await expect(opsPage.getByTestId('lead-detail')).toBeVisible(); await expect(opsPage).toHaveURL(new RegExp(`/leads/${ids.A.id}$`));
    await opsPage.goto(`${URLS.ops}/leads/onboarding`); await expect(opsPage.getByTestId(`lob-open-${ids.A.ref}`)).toBeVisible();
  });

  test('console UI (Arabic): the draft page and the lead panel in Arabic, Western digits only, no horizontal overflow', async () => {
    await opsPage.addInitScript(() => { try { localStorage.setItem('kx-lang', 'ar'); localStorage.setItem('kiorly.lang', 'ar'); } catch { /* ignore */ } });
    await opsPage.goto(`${URLS.ops}/leads/onboarding/${(ids.A as any).draft}`);
    await expect(opsPage.getByTestId('lob-explainer')).toContainText('هذه مسودة'); await expect(opsPage.getByTestId('lob-status')).toContainText('مسودة');
    const text = (await opsPage.locator('main').innerText()); expect(text).not.toMatch(/[٠-٩۰-۹]/);
    expect(await opsPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await opsPage.addInitScript(() => { try { localStorage.setItem('kx-lang', 'en'); localStorage.setItem('kiorly.lang', 'en'); } catch { /* ignore */ } });
    await opsPage.goto(`${URLS.ops}/leads`);
  });

  test('workflow A: ops submits; ops and the submitter cannot approve; a different super admin approves; approval creates ONE enrolment code (shown once) and no organisation or connection', async () => {
    const id = (ids.A as any).draft as string;
    expect((await ops('POST', `lead-onboarding/${id}/submit`)).body).toMatchObject({ status: 'SUBMITTED', submittedBy: opsSub });
    expect((await ops('POST', `lead-onboarding/${id}/approve`, {})).status).toBe(403); // ops_admin cannot approve
    expect((await ops('PATCH', `lead-onboarding/${id}`, { note: 'x' })).status).toBe(409); // only a draft is editable
    const ok = await sup('POST', `lead-onboarding/${id}/approve`, { note: 'checked by a second person' }); expect(ok.status).toBe(200); expect(ok.body).toMatchObject({ status: 'APPROVED' }); expect(ok.body.decidedBy).not.toBe(opsSub);
    expect((await sup('POST', `lead-onboarding/${id}/approve`, {})).status).toBe(409); // already decided
    expect(ok.body.enrolmentCode).toMatch(/^kxe_/); expect(ok.body.shownOnce).toBe(true);
    const enr = (await sup('GET', 'onboarding/enrolments')).body.filter((e: { label: string }) => e.label.includes(TAG)); expect(enr).toHaveLength(1); expect(enr[0]).toMatchObject({ kind: 'CLINIC', status: 'ACTIVE' }); (ids.A as any).enrolment = enr[0].id;
    expect(JSON.stringify([enr, (await sup('GET', `lead-onboarding/${id}`)).body, (await ops('GET', `leads/${ids.A.id}`)).body])).not.toContain(ok.body.enrolmentCode); // the code is never listed again
    expect((await ops('POST', `lead-onboarding/${id}/enrolment`)).status).toBe(200); // a new code can be issued; the unused one is revoked
    expect((await sup('GET', 'onboarding/enrolments')).body.filter((e: { label: string; status: string }) => e.label.includes(TAG) && e.status === 'ACTIVE')).toHaveLength(1);
    expect(JSON.stringify((await sup('GET', 'onboarding/partners')).body)).not.toContain(TAG);
    const trail = (await ops('GET', `leads/${ids.A.id}`)).body.events.filter((e: { kind: string }) => e.kind === 'ONBOARDING').map((e: { data: { action: string } }) => e.data.action);
    expect(trail).toEqual(expect.arrayContaining(['DRAFT_CREATED', 'SUBMITTED', 'APPROVED']));
    await opsPage.goto(`${URLS.ops}/leads/onboarding/${id}`); await expect(opsPage.getByTestId('lob-status')).toContainText('Approved'); await expect(opsPage.getByTestId('lob-open-partner-onboarding')).toHaveAttribute('href', `/partner-onboarding?lead=${ids.A.id}`);
  });

  test('workflow B: submit, the super admin rejects with a reason (required), ops reopens the same row', async () => {
    const id = (ids.B as any).draft as string;
    expect((await ops('POST', `lead-onboarding/${id}/submit`)).body.status).toBe('SUBMITTED');
    expect((await sup('POST', `lead-onboarding/${id}/reject`, {})).status).toBe(400);
    expect((await sup('POST', `lead-onboarding/${id}/reject`, { reason: 'licence copy missing' })).body).toMatchObject({ status: 'REJECTED', decisionNote: 'licence copy missing' });
    const re = await ops('POST', `lead-onboarding/${id}/reopen`); expect(re.body).toMatchObject({ id, status: 'DRAFT' });
    expect((await ops('GET', `leads/${ids.B.id}`)).body.onboardingRequest.id).toBe(id);
    expect((await ops('POST', `lead-onboarding/${id}/cancel`, {})).status).toBe(400); // a reason is required
    expect((await ops('POST', `lead-onboarding/${id}/cancel`, { reason: 'applicant asked to wait' })).body).toMatchObject({ status: 'CANCELLED', decisionNote: 'applicant asked to wait' });
    expect((await ops('POST', `lead-onboarding/${id}/reopen`)).body).toMatchObject({ id, status: 'DRAFT' });
  });

  test('cleanup: the super admin removes the test data (count first); the drafts go with their leads', async () => {
    for (const e of (await sup('GET', 'onboarding/enrolments')).body.filter((x: { label: string; status: string }) => x.label.includes(TAG) && x.status === 'ACTIVE')) expect((await sup('DELETE', `onboarding/enrolments/${e.id}`)).status).toBe(200); // nothing usable is left behind
    const dry = await sup('POST', 'leads/test/remove', { confirm: false }); expect(dry.status).toBe(200); expect(dry.body.count).toBeGreaterThanOrEqual(3);
    const real = await sup('POST', 'leads/test/remove', { confirm: true }); expect(real.body).toMatchObject({ dryRun: false });
    expect((await sup('GET', `lead-onboarding/${(ids.A as any).draft}`)).status).toBe(404); expect((await sup('GET', `lead-onboarding/${(ids.B as any).draft}`)).status).toBe(404);
    expect((await sup('POST', 'leads/test/remove', { confirm: false })).body.count).toBe(0);
  });
});
