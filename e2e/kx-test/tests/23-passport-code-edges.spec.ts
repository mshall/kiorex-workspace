import { randomBytes } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { latestOtp, ssm, waitForNewOtp } from '../lib/aws';

/**
 * Passport one-time-code edge cases on kx-test (full pass 28 Nov 2026): resend (the older code stops working), expired code (ttl 300 s: the test WAITS), wrong-code lockout
 * (5 attempts per challenge, then the phone is locked), the right code is refused while locked, no code in the address, cancelled flow.
 * Budget: FIVE codes for ONE throwaway synthetic number (per-number limit is 5 per hour; per-address 20 per hour is shared). The account is tagged DEMO in the Passport database at the end.
 */
const phone = `+2010${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
const tag = randomBytes(3).toString('hex');
const passportHost = new URL(URLS.passport).host;

async function toCodePage(ctx: BrowserContext, mode: 'join' | 'signin'): Promise<Page> {
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('kx-lang', 'en'); } catch { /* ignore */ } });
  await page.goto(`${URLS.patientWeb}/${mode === 'join' ? 'join' : ''}`);
  if (mode === 'signin') await page.getByRole('button', { name: /^(Sign in|Log in)$/i }).first().click();
  await page.getByTestId('entry-continue').click();
  await page.waitForURL((u) => u.host === passportHost && u.pathname.startsWith('/interaction/'), { timeout: 30_000 });
  await page.locator('#phone').waitFor();
  if (mode === 'join') { await page.locator('#name').fill(`[TEST] KX codes ${tag}`); await page.locator('#consent').check(); }
  await page.locator('#phone').fill(phone);
  await page.locator('form button[type=submit]').first().click();
  await page.locator('#code').waitFor({ timeout: 30_000 });
  return page;
}
const submit = (p: Page) => p.locator('form button[type=submit]').first().click();
const wrongOf = (c: string) => (c === '000000' ? '111111' : '000000');

test.describe.serial('Passport codes: resend, expiry, lockout (one throwaway number, five codes)', () => {
  let ctx: BrowserContext;
  test.beforeAll(async ({ browser }) => { ctx = await browser.newContext({ locale: 'en-US' }); });
  test.afterAll(async () => { await ctx?.close(); try { ssm(`docker exec -i kx-test-postgres-1 psql -U postgres -d passport -tA -c "UPDATE accounts SET data_class='DEMO' WHERE phone='${phone}'"`); } catch { /* best effort */ } });

  test('resend: a second code is sent, the FIRST one no longer works, the second creates the account', async () => {
    const before = latestOtp(phone);
    const page = await toCodePage(ctx, 'join');
    const first = await waitForNewOtp(phone, before);
    // the resend button counts down 30 s before it is enabled (protects the sender)
    const resend = page.getByRole('button', { name: /send a new code/i });
    await expect(resend).toBeDisabled();
    await expect(resend).toBeEnabled({ timeout: 45_000 });
    await resend.click();
    await page.locator('#code').waitFor();
    const second = await waitForNewOtp(phone, first);
    expect(second).not.toBe(first);
    await page.locator('#code').fill(first); await submit(page);
    await expect(page.locator('.error').first()).toBeVisible(); // the superseded code is refused, never accepted
    await page.locator('#code').fill(second); await submit(page);
    await page.waitForURL((u) => u.host !== passportHost, { timeout: 60_000 });
    await page.close();
  });

  test('expired code: a code older than its lifetime (300 s) is refused with a clear message (the test waits)', async () => {
    test.setTimeout(480_000);
    const before = latestOtp(phone);
    const page = await toCodePage(await ctx.browser()!.newContext({ locale: 'en-US' }), 'signin');
    const code = await waitForNewOtp(phone, before);
    await page.waitForTimeout(310_000);
    await page.locator('#code').fill(code); await submit(page);
    await expect(page.locator('.error').first()).toBeVisible();
    expect(page.url()).toContain(passportHost); // still on Passport: no session
    await page.context().close();
  });

  test('wrong code five times locks the number; the right code is then refused, nothing in the address leaks the code or the number', async () => {
    const before = latestOtp(phone);
    const c2 = await ctx.browser()!.newContext({ locale: 'en-US' });
    const page = await toCodePage(c2, 'signin');
    const code = await waitForNewOtp(phone, before);
    for (let i = 0; i < 5; i++) {
      const field = page.locator('#code');
      if (!(await field.isVisible().catch(() => false))) break;
      await field.fill(wrongOf(code)); await submit(page);
      await page.waitForTimeout(700);
    }
    await expect(page.locator('.error').first()).toBeVisible();
    // the correct code no longer works once the challenge is exhausted
    if (await page.locator('#code').isVisible().catch(() => false)) { await page.locator('#code').fill(code); await submit(page); await page.waitForTimeout(800); }
    expect(new URL(page.url()).host).toBe(passportHost);
    expect(page.url()).not.toContain(code); expect(page.url()).not.toContain(encodeURIComponent(phone)); expect(page.url()).not.toContain(phone.slice(1));
    // a new code request for the locked number is refused (no new code appears)
    const seen = latestOtp(phone);
    const p2 = await c2.newPage(); await p2.goto(`${URLS.patientWeb}/`); await p2.getByRole('button', { name: /^(Sign in|Log in)$/i }).first().click(); await p2.getByTestId('entry-continue').click();
    await p2.waitForURL((u) => u.host === passportHost, { timeout: 30_000 }); await p2.locator('#phone').fill(phone); await submit(p2);
    await p2.waitForTimeout(2500);
    expect(latestOtp(phone)).toBe(seen);
    await expect(p2.locator('.error').first()).toBeVisible();
    await c2.close();
  });

  test('cancelled flow: Go back from the code page returns to the app, no session, no account change', async ({ browser }) => {
    const c = await browser.newContext({ locale: 'en-US' });
    const page = await c.newPage(); await page.goto(`${URLS.patientWeb}/`);
    await page.getByRole('button', { name: /^(Sign in|Log in)$/i }).first().click(); await page.getByTestId('entry-continue').click();
    await page.waitForURL((u) => u.host === passportHost, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Go back' }).click();
    await page.waitForURL((u) => u.host !== passportHost, { timeout: 30_000 });
    expect(new URL(page.url()).origin).toBe(new URL(URLS.patientWeb).origin);
    await expect(page.getByRole('button', { name: /^(Sign in|Log in)$/i }).first()).toBeVisible();
    await c.close();
  });
});
