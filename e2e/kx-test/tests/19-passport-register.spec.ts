import { randomBytes } from 'node:crypto';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { passportSignIn } from '../lib/passport';
import { liveToken } from '../lib/session';
import { latestOtp, ssm, waitForNewOtp } from '../lib/aws';

/**
 * Passport create-account, sign-in, duplicate handling and "Go back" on kx-test (28 Nov 2026).
 *
 * Budget: FOUR phone codes in total, all for ONE throwaway synthetic patient (Passport allows 5 per phone and 20 per address and hour; the founder and other agents share the address):
 *   1 create the account, 2 sign in as the new user, 3 and 4 the duplicate-registration path with the step-back checks. Every other check needs no code.
 * The throwaway account is tagged DEMO in the Passport database at the end (and also if a test fails midway) so the founder's `demo-data:remove` can delete it; no real person, no real organisation.
 * The patient web is the app that sends the person to Passport; nothing here touches the Clinic.
 */
const tag = randomBytes(3).toString('hex');
const phone = `+2010${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
const NAME = `KX Register ${tag}`;
const passportHost = new URL(URLS.passport).host;
const appOrigin = new URL(URLS.patientWeb).origin;

async function toPassport(ctx: BrowserContext, via: 'signin' | 'join' = 'signin'): Promise<{ page: Page; authUrl: string }> {
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('kx-lang', 'en'); localStorage.setItem('kx-theme', 'light'); } catch { /* ignore */ } });
  await page.goto(`${URLS.patientWeb}/${via === 'join' ? 'join' : ''}`);
  const req = page.waitForRequest((r) => r.url().startsWith(`${URLS.passport}/auth?`), { timeout: 30_000 });
  if (via === 'signin') await page.getByRole('button', { name: /^(Sign in|Log in)$/i }).first().click();
  await page.getByTestId('entry-continue').click(); // the Kiorex entry page (Sign in | Join us) comes before Passport (PASSPORT_ENTRY_CONTRACT.md)
  const authUrl = (await req).url();
  await page.waitForURL((u) => u.host === passportHost && u.pathname.startsWith('/interaction/'), { timeout: 30_000 });
  await page.locator('#phone').waitFor();
  return { page, authUrl };
}
const fresh = async (browser: Browser) => browser.newContext({ locale: 'en-US' });
const withParam = (u: string, k: string, v: string) => { const x = new URL(u); x.searchParams.set(k, v); return x.toString(); };
/** Signed in as the throwaway patient: the access token the app holds names him (a new member is then walked through Kiorex's own welcome steps, which is not Passport's business). */
async function expectSignedInAsNewPatient(page: Page) {
  await page.waitForURL((u) => u.origin === appOrigin && !u.pathname.startsWith('/auth/callback'), { timeout: 60_000 });
  await expect.poll(async () => { try { return await liveToken(page); } catch { return null; } }, { timeout: 30_000 }).toMatch(/^eyJ/);
  const claims = JSON.parse(Buffer.from((await liveToken(page)).split('.')[1]!, 'base64url').toString()) as { name?: string; phone_number?: string };
  expect(claims.name).toBe(NAME); expect(claims.phone_number).toBe(phone);
}
const tagDemo = () => ssm(`docker exec -i kx-test-postgres-1 psql -U postgres -d passport -tA -c "UPDATE accounts SET data_class='DEMO' WHERE phone='${phone}'"`);

test.describe.serial('Passport: create account, sign in, duplicate, Go back', () => {
  test.afterAll(() => { try { tagDemo(); } catch { /* best effort: the sync script tags again */ } });

  test('the page offers Sign in and Create account, names the product, and carries no development note', async ({ browser }) => {
    const ctx = await fresh(browser); const { page, authUrl } = await toPassport(ctx);
    await expect(page.getByText('Signing in to Kiorex')).toBeVisible();
    const tabs = page.getByRole('navigation', { name: /Sign in or create an account/i });
    await expect(tabs.getByRole('link', { name: 'Sign in' })).toHaveAttribute('aria-current', 'page');
    await expect(tabs.getByRole('link', { name: 'Create account' })).toBeVisible();
    await expect(page.getByText(/Development identity provider/i)).toHaveCount(0); // hosted build: no dev/demo content
    await expect(page.getByText(/Secure sign-in with Kiorex Passport/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible();
    // the Kiorex "Join us" entry sends intent=register: Passport opens on the Create account tab
    const join = await toPassport(await fresh(browser), 'join');
    await expect(join.page.getByRole('navigation').getByRole('link', { name: 'Create account' })).toHaveAttribute('aria-current', 'page');
    await join.page.context().close();
    // the product's intent=register opens the Create account tab with the consent and the optional name
    const p2 = await ctx.newPage(); await p2.goto(withParam(authUrl, 'intent', 'register'));
    await expect(p2.getByRole('navigation').getByRole('link', { name: 'Create account' })).toHaveAttribute('aria-current', 'page');
    await expect(p2.getByText('Creating your account for Kiorex')).toBeVisible();
    await expect(p2.locator('#consent')).toBeVisible(); await expect(p2.locator('#name')).toBeVisible();
    // consent is required: without it no code is requested (the form does not submit)
    await p2.locator('#phone').fill(phone);
    await p2.locator('form[action$="/phone"] button[type=submit]').click();
    await expect(p2.locator('#code')).toHaveCount(0);
    expect(await p2.locator('#consent').evaluate((e) => (e as HTMLInputElement).validity.valueMissing)).toBe(true);
    await ctx.close();
  });

  test('Arabic: right to left, Arabic labels, the Arabic companion font, Western digits, Go back in Arabic', async ({ browser }) => {
    const ctx = await fresh(browser); const { page, authUrl } = await toPassport(ctx);
    const ar = await ctx.newPage(); await ar.goto(withParam(withParam(authUrl, 'ui_locales', 'ar'), 'intent', 'register'));
    await expect(ar.locator('html')).toHaveAttribute('dir', 'rtl'); await expect(ar.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(ar.getByRole('link', { name: 'إنشاء حساب' })).toHaveAttribute('aria-current', 'page');
    await expect(ar.getByRole('button', { name: 'رجوع' })).toBeVisible();
    await expect(ar.getByText('أوافق على')).toBeVisible();
    expect(await ar.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/^"?IBM Plex Sans Arabic/);
    await ar.locator('#phone').fill('٠١٠٠٠١٢٣٤٥٦٧'); // Arabic-Indic digits typed on a phone keypad become 0-9 as they are typed
    expect(await ar.locator('#phone').inputValue()).toBe('0100012345' + '67');
    await expect(ar.getByText(/[٠-٩]/)).toHaveCount(0); // no Arabic-Indic digit anywhere on the page
    await page.close(); await ctx.close();
  });

  test('Go back from the first step returns to the app that sent the person; a hostile return_to is never followed', async ({ browser }) => {
    const ctx = await fresh(browser); const { page, authUrl } = await toPassport(ctx);
    await page.getByRole('button', { name: 'Go back' }).click();
    // no return_to: kiorex-web is answered with the OAuth cancel (access_denied) and lands on its own entry page with the calm "cancelled" message (PASSPORT_ENTRY_CONTRACT.md)
    await page.waitForURL((u) => u.origin === appOrigin && !u.pathname.startsWith('/auth/callback'), { timeout: 30_000 });
    expect(new URL(page.url()).host).not.toBe(passportHost); expect(new URL(page.url()).pathname).toBe('/signin');
    // a return_to on a registered origin is honoured; foreign ones fall back to the same cancel answer, never to the attacker
    for (const [rt, expectPath] of [[`${appOrigin}/search?q=back`, '/search'], ['https://evil.example/steal', '/signin'], ['//evil.example/x', '/signin'], ['javascript:alert(1)', '/signin'], [`${appOrigin}.evil.example/`, '/signin']] as const) {
      const p = await ctx.newPage(); await p.goto(withParam(authUrl, 'return_to', rt)); await p.locator('#phone').waitFor();
      const nav = p.waitForURL((u) => u.host !== passportHost && !u.pathname.startsWith('/auth/callback'), { timeout: 30_000 });
      await p.getByRole('button', { name: 'Go back' }).click(); await nav;
      const u = new URL(p.url());
      expect(u.origin, `return_to=${rt}`).toBe(appOrigin); expect(u.hostname).not.toContain('evil'); expect(u.pathname).toBe(expectPath);
      await p.close();
    }
    await ctx.close();
  });

  test('CODE 1: a new patient creates an account through Passport (name, consent, verified code) and lands in the app', async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await fresh(browser); const { page } = await toPassport(ctx);
    await passportSignIn(page, { phone, register: { name: NAME } });
    await expectSignedInAsNewPatient(page);
    try { tagDemo(); } catch { /* tagged again at the end */ }
    const row = ssm(`docker exec -i kx-test-postgres-1 psql -U postgres -d passport -tA -c "SELECT roles, data_class, name FROM accounts WHERE phone='${phone}'"`).trim();
    expect(row).toContain('["patient"]'); expect(row, 'never an auto-granted role').not.toMatch(/ops|admin|owner|clinic_/); expect(row).toContain('DEMO'); expect(row).toContain(NAME);
    await ctx.close();
  });

  test('CODE 2: the new user signs in again on the Sign in tab', async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await fresh(browser); const { page } = await toPassport(ctx);
    await passportSignIn(page, { phone });
    await expectSignedInAsNewPatient(page);
    await ctx.close();
  });

  test('CODES 3 and 4: registering a number that has an account says so after the code; Go back and the browser Back step one screen at a time without leaking the number', async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await fresh(browser); const { page } = await toPassport(ctx);
    const submitPhone = async () => { // Create account tab, consent, phone
      await page.getByRole('link', { name: 'Create account' }).click();
      await page.locator('#consent').check(); await page.locator('#phone').fill(phone);
      const before = latestOtp(phone);
      await page.locator('form[action$="/phone"] button[type=submit]').click();
      await page.locator('#code').waitFor({ timeout: 30_000 });
      return before;
    };
    const before3 = await submitPhone(); // code 3
    expect(page.url(), 'the number is never put into the address').not.toContain(phone.slice(-8));
    await page.getByRole('button', { name: 'Go back' }).click(); // code step -> phone step
    await page.locator('#phone').waitFor();
    expect(await page.locator('#phone').inputValue(), 'the half-entered number is not kept').toBe('');
    expect(page.url()).toContain('/interaction/'); expect(page.url()).not.toContain(phone.slice(-8));
    const code3 = await waitForNewOtp(phone, before3);
    // the abandoned code is dead: OIDC state is intact, a fresh request works
    const before4 = latestOtp(phone);
    await page.locator('#phone').fill(phone);
    await page.getByRole('link', { name: 'Create account' }).click();
    await page.locator('#consent').check();
    await page.locator('form[action$="/phone"] button[type=submit]').click(); // code 4
    await page.locator('#code').waitFor({ timeout: 30_000 });
    const code4 = await waitForNewOtp(phone, before4); expect(code4).not.toBe(code3);
    await page.locator('#code').fill(code4);
    await page.locator('form[action$="/verify"] button[type=submit]').first().click();
    await expect(page.getByRole('heading', { name: 'You already have an account' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#dup-signin')).toBeVisible();
    // the browser Back button steps back to the code screen (same, still valid code), not out of Passport and not into a broken OIDC state
    await page.goBack();
    await page.locator('#code').waitFor({ timeout: 30_000 });
    expect(new URL(page.url()).host).toBe(passportHost);
    await page.locator('#code').fill(code4);
    await page.locator('form[action$="/verify"] button[type=submit]').first().click();
    await expect(page.locator('#dup-signin')).toBeVisible({ timeout: 30_000 });
    await page.locator('#dup-signin').click(); // "Sign in" for the existing account
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline && new URL(page.url()).host === passportHost) {
      if (await page.locator('#finish button').isVisible().catch(() => false)) await page.locator('#finish button').click();
      await page.waitForTimeout(400);
    }
    await expectSignedInAsNewPatient(page);
    await ctx.close();
  });

  test('the throwaway patient is tagged for demo-data:remove', async () => {
    tagDemo();
    const n = ssm(`docker exec -i kx-test-postgres-1 psql -U postgres -d passport -tA -c "SELECT count(*) FROM accounts WHERE phone='${phone}' AND data_class='DEMO'"`).trim();
    expect(n).toBe('1');
  });
});
