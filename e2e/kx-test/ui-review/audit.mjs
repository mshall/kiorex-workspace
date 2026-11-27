// UI/UX review runner for the deployed kx-test hosts. Usage: node audit.mjs <targets.json> [--out DIR] [--tag before|after]
// Uses playwright-core + axe-core (from kiorex-platform/node_modules). Reads saved e2e sessions from ../.auth (git-ignored).
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../../..');
const { chromium } = require(path.join(root, 'node_modules/playwright-core'));
const axeSrc = fs.readFileSync(path.join(root, 'kiorex-platform/node_modules/axe-core/axe.min.js'), 'utf8');
const args = process.argv.slice(2); const cfgFile = args[0];
const opt = (k, d) => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : d; };
const outRoot = opt('--out', path.join(root, '_private/ui-review')); const tag = opt('--tag', 'before');
const widths = (opt('--widths', '360,390,768,1024,1440,1920')).split(',').map(Number);
const targets = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const authDir = path.join(root, 'e2e/kx-test/.auth');
const shotWidths = new Set((opt('--shots', '360,1440')).split(',').map(Number));
const langs = opt('--langs', 'en,ar').split(','); const themes = opt('--themes', 'light,dark').split(',');
const results = [];
const slug = (s) => s.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 60);

function loadSession(name) { if (!name) return null; const f = path.join(authDir, `${name}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }

const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
for (const t of targets) {
  const sess = loadSession(t.session);
  if (t.session && !sess) { results.push({ surface: t.surface, page: t.path, error: 'no saved session ' + t.session }); continue; }
  for (const lang of langs) for (const theme of themes) {
    const context = await browser.newContext({ storageState: sess?.storageState, locale: lang === 'ar' ? 'ar-EG' : 'en-US', colorScheme: theme, viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript(({ lang, theme, sessOrigin, ss }) => {
      try {
        for (const k of ['kiorly.lang', 'kx-lang', 'kh.lang', 'cms_locale', 'lang']) localStorage.setItem(k, lang);
        document.cookie = `cms_locale=${lang}; Path=/`;
        localStorage.setItem('kx-theme', theme);
        if (sessOrigin && location.origin === sessOrigin) for (const [k, v] of Object.entries(ss)) sessionStorage.setItem(k, v);
        localStorage.setItem('cms-theme', JSON.stringify({ state: { themeId: theme === 'dark' ? 'default-dark' : 'default-light', persistDefault: true }, version: 0 }));
      } catch {}
    }, { lang, theme, sessOrigin: sess?.origin, ss: sess?.sessionStorage ?? {} });
    const page = await context.newPage(); const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message.slice(0, 200)));
    const failed = []; page.on('response', (r) => { if (r.status() >= 400 && !/favicon|\.map$/.test(r.url())) failed.push(`${r.status()} ${r.url().slice(0, 120)}`); });
    let first = true;
    for (const w of widths) {
      const rec = { surface: t.surface, page: t.path, url: t.url + t.path, lang, theme, width: w, session: t.session ?? null };
      try {
        await page.setViewportSize({ width: w, height: w <= 400 ? 800 : 900 });
        if (first) { await page.goto(t.url + t.path, { waitUntil: 'load', timeout: 45000 }); first = false; }
        if (t.before) await t.before.reduce(async (p, a) => { await p; await page.click(a, { timeout: 5000 }).catch(() => {}); }, Promise.resolve());
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(t.wait ?? 1200);
        const m = await page.evaluate(() => {
          const de = document.documentElement; const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
          const overflowX = de.scrollWidth - de.clientWidth;
          const offenders = []; for (const e of document.querySelectorAll('body *')) { if (offenders.length > 4) break; const r = e.getBoundingClientRect(); if (r.width && (r.right > de.clientWidth + 2 || r.left < -2) && vis(e) && !e.closest('[aria-hidden=true],.sr-only')) { let p = e.parentElement, clipped = false; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') { clipped = true; break; } p = p.parentElement; } if (!clipped) offenders.push(`${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').slice(0, 2).join('.') : ''} r=${Math.round(r.right)} l=${Math.round(r.left)}`); } }
          const small = []; for (const e of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=link],[role=checkbox],[role=switch]')) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.width < 24 || r.height < 24) small.push(`${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`); }
          const icon = document.querySelector('link[rel~=icon]'); const noname = []; for (const e of document.querySelectorAll('button,a[href],[role=button]')) { if (!vis(e)) continue; const n = (e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || '').trim(); if (!n && !e.querySelector('img[alt]:not([alt=""]),svg title')) noname.push(e.outerHTML.slice(0, 90)); }
          const fonts = getComputedStyle(document.body).fontFamily.slice(0, 80); const bg = getComputedStyle(document.body).backgroundColor; const color = getComputedStyle(document.body).color;
          return { title: document.title, htmlLang: de.lang, dir: de.dir || getComputedStyle(de).direction, bodyDir: getComputedStyle(document.body).direction, overflowX, offenders, small: small.slice(0, 12), smallCount: small.length, favicon: icon?.getAttribute('href') ?? null, noname: noname.slice(0, 5), nonameCount: noname.length, fonts, bg, color, h1: document.querySelectorAll('h1').length, robots: document.querySelector('meta[name=robots]')?.content ?? null, viewport: document.querySelector('meta[name=viewport]')?.content ?? null, hasMain: !!document.querySelector('main,[role=main]'), imgNoAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length, bodyText: document.body.innerText.slice(0, 160).replace(/\s+/g, ' ') };
        });
        Object.assign(rec, m);
        if (w === 1440 || w === 360) {
          await page.evaluate(axeSrc);
          const ax = await page.evaluate(async () => { const r = await window.axe.run(document, { resultTypes: ['violations'] }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes.slice(0, 3).map((n) => ({ t: n.target.join(' ').slice(0, 90), s: (n.failureSummary || '').split('\n').slice(1, 3).join(' ').slice(0, 160) })) })); }).catch((e) => [{ id: 'axe-error', impact: 'n/a', n: 0, help: String(e).slice(0, 100) }]);
          rec.axe = ax;
        }
        if (shotWidths.has(w) || (lang === 'en' && theme === 'light')) {
          const dir = path.join(outRoot, t.surface, tag); fs.mkdirSync(dir, { recursive: true });
          const f = `${slug(t.path === '/' ? 'home' : t.path)}__${lang}_${theme}_${w}.png`; await page.screenshot({ path: path.join(dir, f), fullPage: w <= 768 && false }); rec.shot = path.relative(outRoot, path.join(dir, f));
        }
      } catch (e) { rec.error = String(e).slice(0, 200); }
      results.push(rec);
    }
    // keyboard pass (once per lang/theme): tab through 12 stops at 1440
    try {
      await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(t.url + t.path, { waitUntil: 'load', timeout: 45000 }).catch(() => {}); await page.waitForTimeout(1200);
      const stops = []; for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); const s = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { el: e.tagName.toLowerCase() + (e.id ? '#' + e.id : ''), name: (e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '').trim().slice(0, 30), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0, shadow: cs.boxShadow !== 'none', inView: r.top >= 0 && r.bottom <= innerHeight + 4, x: Math.round(r.left), y: Math.round(r.top) }; }); stops.push(s); }
      const noFocus = stops.filter((s) => s && !s.outline && !s.shadow); results.push({ surface: t.surface, page: t.path, lang, theme, kind: 'keyboard', stops: stops.length, noFocusVisible: noFocus.map((s) => `${s.el} "${s.name}"`).slice(0, 6), order: stops.filter(Boolean).map((s) => `${s.el}:${s.name}@${s.x},${s.y}`).slice(0, 14) });
    } catch (e) { results.push({ surface: t.surface, page: t.path, lang, theme, kind: 'keyboard', error: String(e).slice(0, 150) }); }
    results.push({ surface: t.surface, page: t.path, lang, theme, kind: 'console', consoleErrors: [...new Set(consoleErrors)].slice(0, 6), failed: [...new Set(failed)].slice(0, 6) });
    await context.close();
  }
}
await browser.close();
const outFile = path.join(outRoot, `results_${tag}_${path.basename(cfgFile, '.json')}.json`); fs.mkdirSync(outRoot, { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(results, null, 1)); console.log('wrote', outFile, results.length);
