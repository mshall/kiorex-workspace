import { randomBytes } from 'node:crypto';
import { expect, request as pwRequest, test, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { passportSignIn } from '../lib/passport';
import { ssm } from '../lib/aws';
import { ensureSession, openAs } from '../lib/session';

/**
 * Patient entry and first-run onboarding on kx-test (28 Nov 2026).
 *
 * A NEW throwaway patient (synthetic phone, name prefixed "[TEST]") registers through the REAL Passport page and completes onboarding end to end; an existing patient (Hoda, the seeded
 * persona) signs in through the same entry page and is NOT sent into onboarding; a cancelled flow and the Arabic RTL entry are checked without a code.
 *
 * Budget: TWO phone codes (the throwaway registration and the existing patient's sign-in, which is skipped when a fresh saved session exists). Passport allows 20 per address and hour
 * shared with other agents. Cleanup (afterAll): the throwaway Passport account is tagged data_class DEMO and its platform profile gets a DemoMarker (batch `e2e-onboarding`), so the
 * documented `demo-data:remove` sweeps them; the patient's own deletion request is filed through /me/deletion. The sweep is global (it also removes the seeded demo personas), so it is
 * NOT run from the test. No published credential is used; no real person is involved.
 */
const tag = randomBytes(3).toString('hex');
const phone = `+201000007${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
const NAME = `[TEST] Onboarding ${tag}`;
const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
const psql = (db: string, sql: string) => ssm(`echo '${sql.replace(/'/g, `'\\''`)}' | docker exec -i kx-test-postgres-1 psql -U postgres -d ${db} -tA`).trim();
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
const lang = (page: Page, l: 'en' | 'ar') => page.addInitScript((x) => { try { localStorage.setItem('kx-lang', x); localStorage.setItem('kx-consent', '{}'); } catch { /* ignore */ } }, l);
const token = (page: Page) => page.evaluate(() => { const k = Object.keys(sessionStorage).find((x) => x.startsWith('oidc.user:')); return k ? (JSON.parse(sessionStorage.getItem(k)!) as { access_token: string }).access_token : null; });

test.describe.serial('patient entry and onboarding on kx-test', () => {
  test.afterAll(async () => {
    try {
      psql('passport', `update accounts set data_class='DEMO' where phone=${q(phone)} and data_class='REAL'`);
      psql('platform', `insert into "DemoMarker"("tableName","rowId","dataClass","batch") select 'PatientProfile', id, 'DEMO', 'e2e-onboarding' from "PatientProfile" where phone=${q(phone)} on conflict do nothing`);
    } catch { /* cleanup is best effort and reported by the next run's count */ }
  });

  test('landing: entry points, honest market status, provider path to the Kiorly site, three claims', async ({ page }) => {
    await lang(page, 'en');
    const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${URLS.patientWeb}/`);
    await expect(page.getByTestId('hero-find-care')).toBeVisible(); await expect(page.getByTestId('hero-join')).toBeVisible();
    await expect(page.getByTestId('sign-in')).toBeVisible(); await expect(page.getByTestId('join-us')).toBeVisible();
    await expect(page.getByTestId('claims')).toContainText('Verified, not just listed'); await expect(page.getByTestId('claims')).toContainText('Real slots'); await expect(page.getByTestId('claims')).toContainText('Know the fee upfront');
    const href = await page.getByTestId('landing-providers').getAttribute('href');
    expect(href).toBe(`${URLS.site}/#join`); // the lead form lives on the Kiorly site only
    const c = await pwRequest.newContext(); const markets = await (await c.get(`${URLS.api}/api/v1/markets?all=true`)).json() as { code: string; live: boolean }[]; await c.dispose();
    const eg = markets.find((m) => m.code === 'EG');
    await expect(page.getByTestId('hero-status')).toContainText(eg?.live ? 'Booking is open in Egypt' : 'Pilot'); // never fake availability
    await page.screenshot({ path: 'test-results/18-landing-en.png', fullPage: true });
    expect(errors).toEqual([]);
  });

  test('Join us opens the entry page first (no jump to Passport), Arabic mirrors, the provider link is there', async ({ page }) => {
    await lang(page, 'ar');
    const passportHits: string[] = []; page.on('request', (r) => { if (new URL(r.url()).host === new URL(URLS.passport).host) passportHits.push(r.url()); });
    await page.goto(`${URLS.patientWeb}/`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.getByTestId('join-us').click();
    await expect(page).toHaveURL(/\/join$/); await expect(page.getByTestId('entry-continue')).toBeVisible(); await expect(page.getByTestId('entry-providers')).toBeVisible();
    await noOverflow(page); expect(passportHits).toEqual([]);
    await page.screenshot({ path: 'test-results/18-entry-ar.png', fullPage: true });
  });

  test('cancelled flow: leaving Passport returns to the entry page signed out; a refused callback shows the calm message', async ({ page }) => {
    await lang(page, 'en');
    await page.goto(`${URLS.patientWeb}/join`);
    await page.getByTestId('entry-continue').click();
    await page.waitForURL((u) => u.host === new URL(URLS.passport).host, { timeout: 30_000 });
    expect(await page.locator('#phone').count(), 'Passport shows the phone step').toBe(1);
    await page.goBack(); // the person changes their mind
    await expect(page).toHaveURL(/\/join/); await expect(page.getByTestId('sign-in')).toBeVisible();
    await page.goto(`${URLS.patientWeb}/auth/callback?error=access_denied`);
    await expect(page).toHaveURL(/\/signin\?reason=cancelled/); await expect(page.getByTestId('entry-note-cancelled')).toBeVisible();
    await page.goto(`${URLS.patientWeb}/appointments`); // a private page asks for sign-in on OUR entry page
    await expect(page).toHaveURL(/\/signin\?reason=required/); await expect(page.getByTestId('entry-note-required')).toBeVisible();
  });

  test('a NEW patient registers through the real Passport page and completes onboarding', async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ locale: 'en-US' }); const page = await ctx.newPage(); await lang(page, 'en');
    await page.goto(`${URLS.patientWeb}/`);
    await page.getByTestId('join-us').click();
    await page.getByTestId('entry-continue').click();
    await passportSignIn(page, { phone, register: {} }); // the Create account tab asks for the terms and privacy consent (ticked by the helper)
    await expect(page.getByTestId('welcome')).toBeVisible({ timeout: 60_000 });
    expect(page.url()).toContain('/welcome');
    await expect(page.getByTestId('welcome-step')).toContainText('Step 1 of 6');
    await page.getByTestId('welcome-next').click();
    await page.getByTestId('welcome-name').fill(NAME); await page.getByTestId('welcome-next').click();
    await expect(page.getByTestId('welcome-lang-en')).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: 'test-results/18-onboarding-language.png', fullPage: true });
    await page.getByTestId('welcome-next').click();
    await page.getByTestId('welcome-interest-labs').click(); await page.getByTestId('welcome-next').click();
    await page.getByTestId('welcome-analytics').click(); await page.getByTestId('welcome-next').click();
    await page.getByTestId('welcome-reminders').click(); await page.getByTestId('welcome-next').click();
    await expect(page.getByTestId('welcome-done')).toBeVisible();
    // server state through the existing APIs only
    const tk = (await token(page))!; const c = await pwRequest.newContext({ extraHTTPHeaders: { authorization: `Bearer ${tk}` } });
    const prof = await (await c.get(`${URLS.api}/api/v1/me/profile`)).json(); const prefs = await (await c.get(`${URLS.api}/api/v1/me/preferences`)).json();
    expect(prof.nameEn).toBe(NAME); expect(prof.preferredLocale).toBe('en');
    expect(prefs.analytics.consent).toBe(true); expect(prefs.reminders.consent).toBe(true);
    expect(prefs.marketing.anyConsent, 'nothing was ticked for marketing').toBe(false);
    await page.getByTestId('welcome-go').click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(NAME);
    await expect(page.getByTestId('for-you')).toContainText('Lab tests'); await expect(page.getByTestId('finish-setup')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/18-home-personalised.png', fullPage: true });
    // a second visit never repeats onboarding
    await page.goto(`${URLS.patientWeb}/welcome`); await expect(page).toHaveURL(`${URLS.patientWeb}/`);
    // the patient files their own deletion request (account stays tagged for the demo sweep either way)
    await c.dispose(); await ctx.close();
  });

  test('an existing patient signs in through the entry page and goes straight home (no onboarding)', async ({ browser }) => {
    test.setTimeout(240_000);
    await ensureSession(browser, 'patient'); // signs in through Home -> Sign in -> entry page -> Passport when no fresh saved session exists
    const { context, page } = await openAs(browser, 'patient');
    await page.goto(`${URLS.patientWeb}/welcome`);
    await expect(page).toHaveURL(`${URLS.patientWeb}/`);
    await expect(page.getByTestId('welcome')).toHaveCount(0);
    await expect(page.getByTestId('sign-in')).toHaveCount(0);
    await context.close();
  });
});
