// node probe.mjs <session|-> <url> <lang> <theme> <width> <jsfile> [shotfile]  : opens page, evaluates the file's expression, prints JSON
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const root = path.resolve(import.meta.dirname, '../../..');
const { chromium } = require(path.join(root, 'node_modules/playwright-core'));
const [session, url, lang, theme, width, js, shot] = process.argv.slice(2);
const sess = session !== '-' ? JSON.parse(fs.readFileSync(path.join(root, 'e2e/kx-test/.auth', session + '.json'), 'utf8')) : null;
const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
const ctx = await browser.newContext({ storageState: sess?.storageState, locale: lang === 'ar' ? 'ar-EG' : 'en-US', colorScheme: theme, viewport: { width: +width, height: 800 } });
await ctx.addInitScript(({ lang, theme, o, ss }) => { try { for (const k of ['kiorly.lang', 'kx-lang', 'kh.lang', 'cms_locale']) localStorage.setItem(k, lang); document.cookie = `cms_locale=${lang}; Path=/`; localStorage.setItem('kx-theme', theme); localStorage.setItem('cms-theme', JSON.stringify({ state: { themeId: theme === 'dark' ? 'default-dark' : 'default-light', persistDefault: true }, version: 0 })); if (o && location.origin === o) for (const [k, v] of Object.entries(ss)) sessionStorage.setItem(k, v); } catch {} }, { lang, theme, o: sess?.origin, ss: sess?.sessionStorage ?? {} });
const page = await ctx.newPage(); await page.goto(url, { waitUntil: 'load' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1500);
if (process.env.AXE) await page.evaluate(fs.readFileSync(path.join(root, 'kiorex-platform/node_modules/axe-core/axe.min.js'), 'utf8'));
const out = await page.evaluate(fs.readFileSync(js, 'utf8')); console.log(JSON.stringify(out, null, 1));
if (shot) await page.screenshot({ path: shot });
await browser.close();
