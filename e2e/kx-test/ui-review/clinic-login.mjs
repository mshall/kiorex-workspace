// Signs the throwaway "[TEST] KX E2E Clinic" owner in through the real Clinic login page and saves the session as .auth/clinicOwner.json. Password comes from Secrets Manager at run time (never printed).
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url); const root = path.resolve(import.meta.dirname, '../../..');
const { chromium } = require(path.join(root, 'node_modules/playwright-core'));
const bag = JSON.parse(execFileSync('aws', ['secretsmanager', 'get-secret-value', '--secret-id', '/kx/test/e2e', '--region', 'eu-central-1', '--query', 'SecretString', '--output', 'text'], { encoding: 'utf8' }));
const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
const ctx = await browser.newContext({ locale: 'en-US' }); const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem('cms_locale', 'en'); } catch {} });
await page.goto('https://clinics.test.kiorly.com/login'); await page.waitForTimeout(2000);
await page.locator('input[type=email], input[name=email], input[autocomplete=username]').first().fill('owner@kx-e2e.kiorly.test');
await page.locator('input[type=password]').first().fill(bag.CLINIC_E2E_OWNER_PASSWORD);
await page.locator('form button[type=submit]').first().click();
await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 30000 }).catch(() => console.log('still on', page.url()));
await page.waitForLoadState('networkidle').catch(() => {});
const ss = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
fs.writeFileSync(path.join(root, 'e2e/kx-test/.auth/clinicOwner.json'), JSON.stringify({ savedAt: Date.now(), origin: 'https://clinics.test.kiorly.com', storageState: await ctx.storageState(), sessionStorage: ss }), { mode: 0o600 });
console.log('clinic login ->', page.url()); await page.screenshot({ path: path.join(root, '_private/ui-review/clinic-after-login.png') }); await browser.close();
