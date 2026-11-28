import { expect, test, type BrowserContext, type Page, type Response } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { passportSignIn } from '../lib/passport';
import { dropSession, ensureSession, openAs, PERSONAS } from '../lib/session';

/**
 * Privileged roles (Pharmacy: OWNER, PHARMACIST, BRANCH_MANAGER, CHAIN_OPS; Lab: OWNER, LAB_DIRECTOR, AUTHORIZED_SIGNATORY) follow the Passport MFA policy (28 Nov 2026, founder decision):
 * the policy for pharmacy and lab is OFF by default, so a phone-code-only session works; when ops turn the policy ON (maker-checker) the product answers 403 MFA_REQUIRED for a session without
 * the claim (kiorly-pharmacy and kiorly-lab auth.guard.ts + mfa-policy.ts, unit and integration tests on a private stack). This live test never enables the policy.
 * The positive tests sign the demo owners in with phone code + TOTP (Passport then issues acr=mfa).
 */
test.describe.serial('privileged role without an authenticator follows the (OFF) policy', () => {
  test('Pharmacy: a PHARMACIST who signs in with the phone code only works while the policy is off (200 on /auth/me)', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' }); const page = await context.newPage(); const seen: { url: string; status: number; body?: string }[] = [];
    page.on('response', async (r: Response) => { if (/\/auth\/(oidc\/exchange|me)$/.test(new URL(r.url()).pathname)) seen.push({ url: new URL(r.url()).pathname, status: r.status(), body: r.status() >= 400 ? (await r.text().catch(() => '')).slice(0, 200) : undefined }); });
    try {
      await page.addInitScript(() => { try { localStorage.setItem('kiorly.lang', 'en'); } catch { /* ignore */ } });
      await page.goto(`${URLS.pharmacy}/login`); await page.getByRole('button', { name: /Sign in with Kiorex Passport/i }).click();
      await passportSignIn(page, { phone: PERSONAS.pharmacistNoMfa.phone });
      await expect.poll(() => seen.find((s) => s.url.endsWith('/auth/me'))?.status, { timeout: 45_000 }).toBeDefined();
      const exchange = seen.find((s) => s.url.endsWith('/oidc/exchange')); const me = seen.find((s) => s.url.endsWith('/auth/me'));
      expect(exchange?.status, 'the Passport code exchange itself succeeds').toBe(200);
      expect(me?.status, JSON.stringify(me)).toBe(200);
    } finally { await context.close(); }
  });
});

test.describe.serial('Pharmacy web as owner (phone code + TOTP)', () => {
  let ctx: BrowserContext; let page: Page;
  test.beforeAll(async ({ browser }) => { await ensureSession(browser, 'pharmacyOwner'); ({ context: ctx, page } = await openAs(browser, 'pharmacyOwner')); });
  test.afterAll(async () => { await ctx?.close(); });
  const api = async (path: string) => { const r = await page.request.get(`${URLS.pharmacy}/api/v1${path}`, { headers: { authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('kiorly.token'))}` } }); return { status: r.status(), body: await r.json().catch(() => null) as any }; };

  test('/auth/me answers 200 for the OWNER (MFA claim present) after Passport sign-in', async () => {
    await page.goto(`${URLS.pharmacy}/`); await expect(page.getByText(/Owner/).first()).toBeVisible();
    const me = await api('/auth/me'); expect(me.status, JSON.stringify(me.body)).toBe(200); expect(JSON.stringify(me.body)).toContain('OWNER');
  });
  test('Orders: the Kiorex marketplace demo orders are listed', async () => {
    await page.goto(`${URLS.pharmacy}/orders`); await expect(page.getByText("You don't have access to this page")).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Kiorex orders' })).toBeVisible(); 
    await expect(page.getByText('Waiting for your response')).toBeVisible(); await expect(page.getByText('Dispensed, rejected or expired')).toBeVisible();
    await page.getByText('All', { exact: true }).first().click();
    await expect.poll(() => page.locator('h2').count(), { message: 'the 6 Kiorex demo orders of the Pharmacy are listed under All' }).toBeGreaterThanOrEqual(6);
  });
  test('Finance / commission statement view loads for the owner', async () => {
    await page.goto(`${URLS.pharmacy}/finance`); await expect(page.getByText("You don't have access to this page")).toHaveCount(0); await expect(page.getByRole('heading', { name: /Finance/i }).first()).toBeVisible();
  });
  test('Growth page shows the commission statement with its rate for owners', async () => {
    await page.goto(`${URLS.pharmacy}/growth`); await expect(page.getByText('Commission statement')).toBeVisible();
    await expect(page.getByText(/visible to owners, branch managers and chain operations/i)).toHaveCount(0); // that line is the cashier's view; the owner sees the figures instead
  });
  test('sign out', async () => { await page.goto(`${URLS.pharmacy}/`); await page.getByRole('button', { name: 'Sign out' }).click(); await page.waitForURL(/\/login|passport/, { timeout: 30000 }); dropSession('pharmacyOwner'); });
});
