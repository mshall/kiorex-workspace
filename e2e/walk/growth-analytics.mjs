// Browser walk for the ops pages "Growth analytics" and "Acquisition" (GRW-P1-J): real dev stack, axe (WCAG 2.1 AA), AR and EN (RTL), light and dark, three widths.
// Usage: node walk/growth-analytics.mjs   (needs the stack up, ops web on :5181; screenshots go to _docs/test-flow/growth-analytics)
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, open, sanity, axe, URLS } from './lib.mjs';
import { opsSignIn } from './ops.mjs';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../_docs/test-flow/growth-analytics'); mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(); const auth = await opsSignIn(browser, 'super');
const PAGES = [{ step: 'analytics', path: '/growth-analytics', ready: '[data-testid=ga-tiles]' }, { step: 'acquisition', path: '/acquisition', ready: '[data-testid=acq-tiles]' }];
const COMBOS = []; for (const lang of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) COMBOS.push({ lang, theme, width });
const problems = [];
for (const pg of PAGES) for (const c of COMBOS) {
  const { page, context, logs } = await open(browser, { product: 'ops', ...c });
  await context.addInitScript(([k, v, l, t]) => { try { sessionStorage.setItem(k, v); localStorage.setItem('kx-lang', l); localStorage.setItem('kx-theme', t); } catch {} }, [auth.key, auth.value, c.lang, c.theme]);
  await page.goto(URLS.ops + pg.path); await page.waitForSelector(pg.ready, { timeout: 20000 }).catch(() => problems.push(`[${pg.step} ${c.lang} ${c.theme} ${c.width}] page did not render ${pg.ready}`));
  await page.waitForTimeout(800);
  const dir = await page.evaluate(() => document.documentElement.dir); if ((c.lang === 'ar') !== (dir === 'rtl')) problems.push(`[${pg.step} ${c.lang}] dir=${dir}`);
  await page.screenshot({ path: path.join(OUT, `ops-${pg.step}-${c.lang}-${c.theme}-${c.width}.png`), fullPage: true });
  const probs = [...await sanity(page), ...(await axe(page)).map((a) => 'axe ' + a), ...logs.filter((l) => !/favicon|auth\/config/.test(l))];
  if (probs.length) problems.push(`[${pg.step} ${c.lang} ${c.theme} ${c.width}] ` + probs.join(' || '));
  await context.close();
}
await browser.close();
console.log(problems.length ? 'PROBLEMS\n' + problems.join('\n') : `OK: ${PAGES.length * COMBOS.length} views, no axe, overflow, raw-key or console problems`);
process.exit(problems.length ? 1 : 0);
