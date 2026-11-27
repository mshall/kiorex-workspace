import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { here, URLS } from '../lib/hosts';
import { ssm } from '../lib/aws';
import { latestOtp, waitForNewOtp } from '../lib/aws';
import { msToNextStep, totp } from '../lib/totp';

/**
 * The demo TOTP seeds that older versions of the (public) repositories published must be worthless on kx-test. Nothing is typed here: the old values are read from the git HISTORY of the
 * kiorex-account repository at run time (phone -> secret pairs of every committed seed-users.json), so no old secret is committed again. If the history is ever rewritten and no old
 * value remains, the test skips and says so.
 *   1. Negative sign-in: the phone code is real, the authenticator code computed from the OLD secret is refused by Passport (page error, no session).
 *   2. Database: no totp_credentials row of kx-test holds any old secret.
 */
const repo = path.resolve(here, '../../../kiorex-account');
function oldSecrets(): Record<string, string> {
  const out: Record<string, string> = {};
  let revs: string[] = [];
  try { revs = execFileSync('git', ['-C', repo, 'rev-list', '--all', '--', 'config/seed-users.json'], { encoding: 'utf8' }).split('\n').filter(Boolean); } catch { return out; }
  for (const rev of revs) {
    try {
      const j = JSON.parse(execFileSync('git', ['-C', repo, 'show', `${rev}:config/seed-users.json`], { encoding: 'utf8', maxBuffer: 20_000_000 })) as { users: Array<{ phone: string; totpSecret?: string }> };
      for (const u of j.users) if (u.totpSecret && /^[A-Z2-7]{16,}$/.test(u.totpSecret)) out[u.phone] = u.totpSecret;
    } catch { /* a revision without a parsable seed */ }
  }
  return out;
}

const OLD = oldSecrets();
test.describe.serial('the published demo TOTP secrets are not valid on kx-test', () => {
  test.skip(Object.keys(OLD).length === 0, 'no old secret in the git history of kiorex-account (history rewritten): nothing to test');

  for (const phone of ['+201000009001', '+201000009002', '+201000000099']) {
    test(`${phone.slice(0, 7)}***${phone.slice(-2)}: the code computed from the old published secret is refused`, async ({ browser }) => {
      test.skip(!OLD[phone], 'no old secret recorded for this account');
      const ctx = await browser.newContext({ locale: 'en-US' }); const page = await ctx.newPage();
      try {
        await page.goto(`${URLS.ops}/`);
        await page.waitForURL((u) => u.host === new URL(URLS.passport).host, { timeout: 30_000 });
        const before = latestOtp(phone);
        await page.locator('#phone').fill(phone); await page.locator('form button[type=submit]').first().click();
        await page.locator('#code').waitFor();
        await page.locator('#code').fill(await waitForNewOtp(phone, before)); await page.locator('form button[type=submit]').first().click();
        await page.locator('#totp').waitFor({ timeout: 30_000 });
        if (msToNextStep() < 4000) await page.waitForTimeout(msToNextStep() + 300);
        await page.locator('#totp').fill(totp(OLD[phone]!));
        await page.locator('form[action$="/totp"] button[type=submit]').click();
        await expect(page.locator('.error')).toContainText(/Incorrect code/i);
        expect(new URL(page.url()).host, 'still on Passport: no session was issued').toBe(new URL(URLS.passport).host);
      } finally { await ctx.close(); }
    });
  }

  test('no totp_credentials row of the kx-test Passport database holds an old secret', async () => {
    const list = [...new Set(Object.values(OLD))].map((s) => `'${s}'`).join(',');
    const out = ssm(`docker exec -i kx-test-postgres-1 psql -U postgres -d passport -tA -c "SELECT count(*) FROM totp_credentials WHERE secret IN (${list});"`);
    expect(out.trim()).toBe('0');
  });
});
