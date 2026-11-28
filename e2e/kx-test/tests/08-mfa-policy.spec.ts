import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { e2eSecrets, ssm } from '../lib/aws';
import { passportSignIn, passportSignInEnrolling } from '../lib/passport';
import { ensureSession, PERSONAS, savedToken } from '../lib/session';
import { msToNextStep, totp } from '../lib/totp';

/**
 * MFA policy (27 Nov 2026): optional by default; ops make it mandatory in the Passport console (maker-checker); the person is walked through enrolment; switching it off makes it
 * optional again (the product APIs follow it); the Pharmacy and Lab web apps explain a 403 MFA_REQUIRED in words with a link to Passport. NOTE (28 Nov 2026): this spec CHANGES the live policy through maker-checker; it is founder-gated and was not run by the agent that changed the product rule. Synthetic demo accounts only. The policy is switched back OFF at the end
 * and the enrolment of the demo pharmacist is removed, so the environment returns to its default (optional) state.
 *
 *   maker    ops (+201000009001, ops_admin)         proposes
 *   checker  opsFinance (+201000009002, ops_admin)  approves (a different person)
 *   subject  pharmacistNoMfa (+201000002004), PHARMACIST member of the demo pharmacy organisation, a privileged Pharmacy role without a Passport role
 */
const ORG = 'org_demo_delta_pharma';
const SUBJECT_SUB = '01HZKXD0000000000000002004';
const PASSPORT_UI = `${URLS.passport}/account`;

/** Last authenticator time step used per persona: Passport accepts each step once, so a second use waits for the next step. */
const lastStep = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A step-up token for an ops persona (acr mfa, fresh auth_time, 5 minutes) WITHOUT a new phone code: the persona's saved session (ensureSession signs in, and spends one code, only when
 * none is usable) plus the real `/api/step-up` call with the authenticator code from Secrets Manager. The Passport account site accepts it as its session (`kx.pp.at`).
 */
async function stepUpToken(browser: Browser, who: 'ops' | 'opsFinance'): Promise<string> {
  let base = (() => { try { return savedToken(who); } catch { return null; } })();
  const expOk = (t: string | null) => !!t && (JSON.parse(Buffer.from(t.split('.')[1]!, 'base64url').toString()) as { exp: number }).exp * 1000 > Date.now() + 120_000;
  if (!expOk(base)) { await ensureSession(browser, who); base = savedToken(who); }
  for (let attempt = 0; attempt < 3; attempt++) {
    const step = Math.floor(Date.now() / 30_000);
    if ((lastStep.get(who) ?? 0) >= step || msToNextStep() < 4000) await sleep(msToNextStep() + 500);
    const code = totp(e2eSecrets()[PERSONAS[who].totp]);
    lastStep.set(who, Math.floor(Date.now() / 30_000));
    const r = await fetch(`${URLS.passport}/api/step-up`, { method: 'POST', headers: { authorization: `Bearer ${base}`, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'totp', code }) });
    if (r.status === 200) return ((await r.json()) as { access_token: string }).access_token;
    if (r.status !== 400) throw new Error(`step-up refused: ${r.status}`);
  }
  throw new Error('step-up did not succeed');
}

/** Opens the Passport account site's policy page as the persona, with the step-up token as the page's session (no sign-in, no phone code). */
async function openPolicyPage(browser: Browser, page: Page, who: 'ops' | 'opsFinance'): Promise<void> {
  const token = await stepUpToken(browser, who);
  await page.addInitScript(([t, exp]) => { try { sessionStorage.setItem('kx.pp.at', t as string); sessionStorage.setItem('kx.pp.exp', String(exp)); localStorage.setItem('kx-lang', 'en'); } catch { /* ignore */ } }, [token, Date.now() + 280_000]);
  await page.goto(`${PASSPORT_UI}/ops/mfa`);
  await expect(page.getByRole('heading', { name: 'Two-step verification policy' })).toBeVisible({ timeout: 30_000 });
}

test.describe.serial('MFA policy on kx-test (maker-checker, mandatory enrolment, friendly Pharmacy message)', () => {
  let makerCtx: BrowserContext; let checkerCtx: BrowserContext; let maker: Page; let checker: Page;
  test.beforeAll(async ({ browser }) => {
    makerCtx = await browser.newContext({ locale: 'en-US' }); checkerCtx = await browser.newContext({ locale: 'en-US' });
    maker = await makerCtx.newPage(); checker = await checkerCtx.newPage();
  });
  test.afterAll(async () => { await makerCtx?.close(); await checkerCtx?.close(); });

  test('the default is OFF (optional): ops see it, nothing is mandatory', async ({ browser }) => {
    await openPolicyPage(browser, maker, 'ops');
    await expect(maker.locator('#mfa-current')).toContainText('Optional (switch off)');
    await expect(maker.locator('#mfa-current')).toContainText('Always mandatory, set in the configuration');
  });

  test('maker proposes a rule for the demo pharmacy organisation; the maker cannot approve; the checker (a different ops_admin) approves it', async ({ browser }) => {
    await maker.getByLabel('Make two-step verification mandatory for the rules below').check();
    // the editor starts from the stored policy and a previous run keeps its (switched-off) rules: clear them so the new rule cannot be a duplicate
    const editor = maker.locator('#mfa-editor');
    while (await editor.getByRole('button', { name: 'Remove' }).count()) await editor.getByRole('button', { name: 'Remove' }).first().click();
    await maker.getByRole('button', { name: 'Add a rule' }).click();
    // "Add a rule" appends a rule group: the form can hold more than one, so the controls of the rule just added are the last ones (strict mode)
    await maker.getByLabel('Applies to').last().selectOption('org');
    await maker.getByLabel('Organisation', { exact: true }).last().selectOption(ORG);
    await maker.getByLabel('pharmacist', { exact: true }).last().check();
    await maker.getByLabel('Reason for the change (optional)').fill('kx-test e2e: demo pharmacists');
    await maker.getByRole('button', { name: 'Submit for approval' }).click();
    await expect(maker.getByRole('status').filter({ hasText: 'Submitted. A second person must approve it.' })).toBeVisible();
    const mine = maker.locator('#mfa-pending li').first();
    await expect(mine).toContainText('demo pharmacists');
    await expect(mine.getByRole('button', { name: 'Approve and apply' })).toHaveCount(0);
    await openPolicyPage(browser, checker, 'opsFinance');
    const pending = checker.locator('#mfa-pending li').first();
    await expect(pending).toContainText('demo pharmacists');
    await pending.getByRole('button', { name: 'Approve and apply' }).click();
    await checker.getByRole('dialog').getByRole('button', { name: 'Approve and apply' }).click();
    await expect(checker.getByRole('status').filter({ hasText: 'Approved and applied.' })).toBeVisible();
    await expect(checker.locator('#mfa-current')).toContainText('Mandatory');
  });

  test('mandatory: the pharmacist is walked through enrolment at sign-in (no skip) and then works in the Pharmacy web with the MFA claim', async ({ browser }) => {
    const ctx = await browser.newContext({ locale: 'en-US' }); const page = await ctx.newPage();
    try {
      await page.addInitScript(() => { try { localStorage.setItem('kiorly.lang', 'en'); } catch { /* ignore */ } });
      await page.goto(`${URLS.pharmacy}/login`); await page.getByRole('button', { name: /Sign in with Kiorex Passport/i }).click();
      await passportSignInEnrolling(page, { phone: PERSONAS.pharmacistNoMfa.phone });
      await page.waitForURL((u) => u.origin === new URL(URLS.pharmacy).origin && !u.pathname.startsWith('/auth/callback') && !u.pathname.startsWith('/login'), { timeout: 60_000 });
      await expect(page.getByTestId('mfa-required')).toHaveCount(0); // the MFA claim is there: no friendly refusal
      const token = await page.evaluate(() => localStorage.getItem('kiorly.token'));
      const me = await page.request.get(`${URLS.pharmacy}/api/v1/auth/me`, { headers: { authorization: `Bearer ${token}` } });
      expect(me.status(), 'a privileged role with the MFA claim is accepted').toBe(200);
    } finally { await ctx.close(); }
  });

  test('switch it off again (maker proposes, checker approves): the demo pharmacist keeps an authenticator but is only OFFERED it, skipping works (the policy is off, the product follows it)', async ({ browser }) => {
    await openPolicyPage(browser, maker, 'ops'); // a new step-up token: the earlier one was good for five minutes
    await maker.getByLabel('Make two-step verification mandatory for the rules below').uncheck();
    await maker.getByRole('button', { name: 'Submit for approval' }).click();
    await expect(maker.getByRole('status').filter({ hasText: 'Submitted. A second person must approve it.' })).toBeVisible();
    await openPolicyPage(browser, checker, 'opsFinance');
    const pending = checker.locator('#mfa-pending li').first();
    await pending.getByRole('button', { name: 'Approve and apply' }).click();
    await checker.getByRole('dialog').getByRole('button', { name: 'Approve and apply' }).click();
    await expect(checker.getByRole('status').filter({ hasText: 'Approved and applied.' })).toBeVisible();
    await expect(checker.locator('#mfa-current')).toContainText('Optional (switch off)');
    await expect(checker.locator('#mfa-history')).toContainText('Applied');

    const ctx = await browser.newContext({ locale: 'en-US' }); const page = await ctx.newPage();
    try {
      await page.addInitScript(() => { try { localStorage.setItem('kiorly.lang', 'en'); } catch { /* ignore */ } });
      await page.goto(`${URLS.pharmacy}/login`); await page.getByRole('button', { name: /Sign in with Kiorex Passport/i }).click();
      await passportSignIn(page, { phone: PERSONAS.pharmacistNoMfa.phone }); // enrolled but optional: the helper skips the offered code
      await page.waitForURL((u) => u.origin === URLS.pharmacy && !u.pathname.startsWith('/login'), { timeout: 60_000 });
      await expect(page.getByTestId('mfa-required')).toHaveCount(0); // policy off again: no authenticator needed (28 Nov 2026: the product follows the Passport policy)
      const t = await page.evaluate(() => localStorage.getItem('kiorly.token'));
      expect((await page.request.get(`${URLS.pharmacy}/api/v1/auth/me`, { headers: { authorization: `Bearer ${t}` } })).status()).toBe(200);
    } finally { await ctx.close(); }
  });

  test('Lab web: the same friendly message appears when the API answers 403 MFA_REQUIRED', async ({ browser }) => {
    // no privileged Lab demo persona without MFA exists on kx-test, so the API answer is injected at the browser; the app code path is the real one
    const ctx = await browser.newContext({ locale: 'en-US' }); const page = await ctx.newPage();
    try {
      await page.addInitScript(() => { try { localStorage.setItem('kiorly.lang', 'en'); localStorage.setItem('kiorly.lab.token', 'not-a-real-token'); } catch { /* ignore */ } });
      await page.route('**/api/v1/auth/me', (r) => r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ statusCode: 403, code: 'MFA_REQUIRED', message: 'Privileged roles require multi-factor authentication' }) }));
      await page.goto(`${URLS.lab}/`);
      const box = page.getByTestId('mfa-required');
      await expect(box).toBeVisible({ timeout: 30_000 });
      await expect(box.getByTestId('mfa-passport-link')).toHaveAttribute('href', `${new URL(URLS.passport).origin}/account/security`);
    } finally { await ctx.close(); }
  });

  test('clean-up: the demo pharmacist has no authenticator again (default state of the environment)', async () => {
    const out = ssm(`docker exec -i kx-test-postgres-1 psql -U postgres -d passport -tA -c "DELETE FROM totp_credentials WHERE sub='${SUBJECT_SUB}'; SELECT (SELECT count(*) FROM totp_credentials WHERE sub='${SUBJECT_SUB}')::text || ',' || (SELECT enabled FROM (SELECT (policy->>'enabled') AS enabled FROM mfa_policy WHERE id=1) x);"`);
    expect(out.trim().split('\n').pop()).toBe('0,false');
  });
});
