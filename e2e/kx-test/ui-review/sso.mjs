// Re-opens a saved e2e persona using ONLY the Passport session cookie (valid 30 days): no one-time code is requested. Usage: node sso.mjs <persona> <app: ops|pharmacy|lab|patient>
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const root = path.resolve(import.meta.dirname, '../../..');
const { chromium } = require(path.join(root, 'node_modules/playwright-core'));
const [persona, app, alias] = process.argv.slice(2); const authDir = path.join(root, 'e2e/kx-test/.auth');
const urls = { ops: 'https://admin.test.kiorex.com/', opsKiorly: 'https://admin.test.kiorly.com/', pharmacy: 'https://pharmacies.test.kiorly.com/login', lab: 'https://labs.test.kiorly.com/login', patient: 'https://test.kiorex.com/', passport: 'https://passport.test.kiorex.com/account' };
const saved = JSON.parse(fs.readFileSync(path.join(authDir, persona + '.json'), 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
const ctx = await browser.newContext({ storageState: { cookies: saved.storageState.cookies, origins: [] }, locale: 'en-US' });
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem('kiorly.lang', 'en'); localStorage.setItem('kx-lang', 'en'); } catch {} });
await page.goto(urls[app]); await page.waitForTimeout(1500);
if (app === 'pharmacy' || app === 'lab') await page.getByRole('button', { name: /Sign in with Kiorex Passport/i }).click();
else if (app === 'passport') await page.getByRole('button', { name: /sign in|continue|log in/i }).first().click({ timeout: 8000 }).catch(() => {});
else if (app === 'patient') await page.getByRole('button', { name: /^(Sign in|Log in)$/i }).first().click();
const origin = new URL(urls[app]).origin;
try { await page.waitForURL((u) => u.origin === origin && !/\/auth\/callback|\/account\/callback|\/login/.test(u.pathname), { timeout: 45000 }); } catch { console.log('FAILED, stuck at', page.url()); await page.screenshot({ path: '/tmp/sso-fail.png' }); await browser.close(); process.exit(2); }
await page.waitForLoadState('networkidle').catch(() => {});
const ss = await page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
fs.writeFileSync(path.join(authDir, (alias ?? persona) + '.json'), JSON.stringify({ savedAt: Date.now(), origin, storageState: await ctx.storageState(), sessionStorage: ss }), { mode: 0o600 });
console.log('SSO ok', persona, page.url()); await browser.close();
