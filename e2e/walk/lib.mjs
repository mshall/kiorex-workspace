// Playwright helpers for the Connect-to-Kiorex browser walk (DEV ONLY). Run from anywhere: node walk/<script>.mjs
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(path.resolve(here, '../../clinics-management/package.json'));
export const { chromium } = req('playwright');
export const AxeBuilder = req('@axe-core/playwright').default ?? req('@axe-core/playwright').AxeBuilder;
export const state = () => JSON.parse(readFileSync(path.join(here, 'state.json'), 'utf8'));
export const OUT = path.resolve(here, '../../_docs/test-flow/connect');
mkdirSync(OUT, { recursive: true });
export const URLS = { clinic: 'http://localhost:5174', nurse: 'http://localhost:5174', pharmacy: 'http://localhost:5192', lab: 'http://localhost:5193', ops: 'http://localhost:5181' };
export const WIDTHS = { 390: 844, 768: 1024, 1440: 900 };
const authFile = (k) => path.join(here, `.auth-${k}.json`);
export const saveAuth = (k, ls) => writeFileSync(authFile(k), JSON.stringify(ls));
export const loadAuth = (k) => (existsSync(authFile(k)) ? JSON.parse(readFileSync(authFile(k), 'utf8')) : {});

/** A page for product/lang/theme/width with the given localStorage (auth) pre-seeded. */
export async function open(browser, { product, lang = 'en', theme = 'light', width = 1440, auth = {}, extraLS = {} }) {
  const context = await browser.newContext({ viewport: { width, height: WIDTHS[width] ?? 900 }, locale: lang === 'ar' ? 'ar-EG' : 'en-US', colorScheme: theme });
  const ls = { ...auth, 'kx-theme': theme, 'cms-theme': JSON.stringify({ state: { themeId: theme === 'dark' ? 'default-dark' : 'default-light', persistDefault: true }, version: 0 }), 'kiorly.lang': lang, 'kx-lang': lang, cms_locale: lang, ...extraLS };
  await context.addInitScript(([l, lang]) => { try { for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v); document.cookie = `cms_locale=${lang}; Path=/`; } catch {} }, [ls, lang]);
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('requestfailed', (r) => logs.push(`requestfailed: ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/auth/config')) logs.push(`http ${r.status()}: ${r.request().method()} ${r.url().slice(0, 140)}`); });
  page.__logs = logs;
  return { context, page, logs };
}
export const shotName = (product, lang, theme, width, step) => `${product}-${lang}-${theme}-${width}-${step}.png`;
export async function shot(page, product, lang, theme, width, step) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, shotName(product, lang, theme, width, step)), fullPage: true });
}
/** horizontal overflow, raw i18n keys, "undefined"/"[object" text; returns problem strings */
export async function sanity(page) {
  return page.evaluate(() => {
    const p = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) {
      const wide = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > de.clientWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 4).map((e) => e.tagName + '.' + String(e.className).slice(0, 50));
      p.push(`overflow-x ${de.scrollWidth}>${de.clientWidth}: ${wide.join(' | ')}`);
    }
    const txt = document.body.innerText;
    const raw = txt.match(/\b(kiorexConnect|partnerOnboarding|onboarding|kiorexTab)\.[A-Za-z_.]+/g);
    if (raw) p.push('raw keys: ' + [...new Set(raw)].slice(0, 6).join(', '));
    if (/\bundefined\b|\[object Object\]|\bNaN\b/.test(txt)) p.push('undefined/NaN/object in text');
    return p;
  });
}
export async function axe(page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`);
}
