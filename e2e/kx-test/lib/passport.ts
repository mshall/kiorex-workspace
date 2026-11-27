import type { Page } from '@playwright/test';
import { latestOtp, waitForNewOtp } from './aws';
import { msToNextStep, totp } from './totp';
import { URLS } from './hosts';

/**
 * Drives the REAL Passport hosted pages (kx-test runs the public DEV IdP with the mock sender, so the one-time code is written to the container log instead of an SMS):
 * phone, code read through SSM, optional TOTP (ops roles), optional passkey offer (skipped). Returns when the browser has left Passport.
 */
export async function passportSignIn(page: Page, o: { phone: string; totpSecret?: string; lang?: 'en' | 'ar' }): Promise<void> {
  const passportHost = new URL(URLS.passport).host;
  await page.waitForURL((u) => u.host === passportHost, { timeout: 30_000 });
  await page.locator('#phone').waitFor({ timeout: 30_000 });
  const before = latestOtp(o.phone);
  await page.locator('#phone').fill(o.phone);
  await page.locator('form button[type=submit]').first().click();
  await page.locator('#code').waitFor({ timeout: 30_000 });
  const code = await waitForNewOtp(o.phone, before);
  await page.locator('#code').fill(code);
  await page.locator('form button[type=submit]').first().click();
  const deadline = Date.now() + 60_000;
  let totpDone = false;
  while (Date.now() < deadline) {
    if (new URL(page.url()).host !== passportHost) return;
    if (!totpDone && (await page.locator('#totp').isVisible().catch(() => false))) {
      if (!o.totpSecret) throw new Error('Passport asked for a TOTP code but no secret was provided');
      if (msToNextStep() < 4000) await page.waitForTimeout(msToNextStep() + 300); // never submit at the very end of a step
      await page.locator('#totp').fill(totp(o.totpSecret));
      await page.locator('form button[type=submit]').first().click();
      totpDone = true;
    } else if (await page.locator('#finish button').isVisible().catch(() => false)) {
      await page.locator('#finish button').click(); // "skip passkey"
    } else if (await page.locator('.error').first().isVisible().catch(() => false)) {
      throw new Error(`Passport showed an error: ${(await page.locator('.error').first().innerText()).slice(0, 120)}`);
    }
    await page.waitForTimeout(400);
  }
  throw new Error('Passport sign-in did not complete');
}
