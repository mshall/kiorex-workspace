import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument } from 'pdf-lib';


export function findChromium() {
  if (process.env.KX_CHROMIUM && fs.existsSync(process.env.KX_CHROMIUM)) return process.env.KX_CHROMIUM;
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const linux = path.join(os.homedir(), '.cache/ms-playwright');
  for (const root of [cache, linux]) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
    for (const d of dirs) {
      for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-linux/chrome', 'chrome-linux64/chrome']) {
        const p = path.join(root, d, rel); if (fs.existsSync(p)) return p;
      }
    }
  }
  throw new Error('No Chromium found. Set KX_CHROMIUM=/path/to/chrome (the e2e-web Playwright cache is used by default).');
}

export async function launch() {
  return chromium.launch({ executablePath: findChromium(), headless: true, args: ['--font-render-hinting=none', '--disable-lcd-text', '--allow-file-access-from-files'] });
}

// One layout pass: load, enhance, paginate with Paged.js. Returns the live page and the heading ids that ended a page with nothing after them.
async function layout(browser, { htmlFile, enhanceCfg }) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1400 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)));
  await page.goto('file://' + htmlFile, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const hasMermaid = await page.evaluate(() => !!document.querySelector('.mermaid-src'));
  if (hasMermaid) await page.addScriptTag({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/mermaid/dist/mermaid.min.js') });
  const enh = await page.evaluate((cfg) => window.kxEnhance(cfg), enhanceCfg);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { window.PagedConfig = { auto: false }; });
  await page.addScriptTag({ content: pagedSource() });
  const pages = await page.evaluate(async () => {
    const p = new window.Paged.Previewer();
    const flow = await p.preview();
    await document.fonts.ready;
    return flow.total;
  });
  // headings (and Diagram frames' captions) stranded at the foot of a page: nothing of their section follows on the same page
  const orphans = await page.evaluate(() => {
    const out = [];
    const pgs = [...document.querySelectorAll('.pagedjs_page')];
    pgs.forEach((pg, pi) => {
      if (pi === pgs.length - 1 || pg.querySelector('.cover,.divider')) return;
      const area = pg.querySelector('.pagedjs_page_content'); if (!area) return;
      const ar = area.getBoundingClientRect();
      const heads = [...area.querySelectorAll('h2,h3,h4')]; if (!heads.length) return;
      const last = heads[heads.length - 1];
      const unit = last.closest('.banner') || last;
      const r = unit.getBoundingClientRect();
      if (r.top - ar.top < 24) return;                       // already first on its page: moving it cannot help
      const after = [...area.querySelectorAll('p,li,tr,figure,pre,.callout,.kpi,.caprow,.adrcard,svg,img,.flow,.edge')].filter((e) => !unit.contains(e) && e.getBoundingClientRect().top >= r.bottom - 2 && e.getBoundingClientRect().height > 2);
      if (!after.length && last.id) out.push(last.id);
    });
    return out;
  });
  return { ctx, page, pages, enh, orphans, consoleErrors };
}

export async function renderPdf(browser, { htmlFile, outFile, meta, enhanceCfg, chrome }) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const breakIds = [];
  let L = null;
  for (let pass = 0; pass < 4; pass++) {
    if (L) await L.ctx.close();
    L = await layout(browser, { htmlFile, enhanceCfg: { ...enhanceCfg, breakIds } });
    const fresh = L.orphans.filter((id) => !breakIds.includes(id));
    if (!fresh.length) break;
    breakIds.push(...fresh);
  }
  const { ctx, page, pages, enh, consoleErrors } = L;
  const chromeJs = fs.readFileSync(path.join(here, 'design/chrome.js'), 'utf8');
  await page.addScriptTag({ content: chromeJs });
  await page.evaluate((cfg) => window.kxChrome(cfg), chrome);
  const checks = await page.evaluate(() => {
    const out = { overflow: [], blank: [], orphan: [] };
    document.querySelectorAll('.pagedjs_page').forEach((pg, i) => {
      if (pg.querySelector('.cover,.divider')) return;
      const area = pg.querySelector('.pagedjs_page_content'); if (!area) return;
      const ar = area.getBoundingClientRect();
      area.querySelectorAll('table,figure,pre,.kpis,.callout,.flow,svg:not(.cover svg)').forEach((e) => {
        const r = e.getBoundingClientRect(); if (r.width && r.right > ar.right + 3) out.overflow.push(`p${i + 1}: <${e.tagName.toLowerCase()}> exceeds right margin by ${Math.round(r.right - ar.right)}px`);
        if (r.width && r.bottom > ar.bottom + 3) out.overflow.push(`p${i + 1}: <${e.tagName.toLowerCase()}> exceeds bottom margin by ${Math.round(r.bottom - ar.bottom)}px`);
      });
      const t = (area.textContent || '').trim();
      if (t.length < 3 && !area.querySelector('svg,img,.divider,.cover')) out.blank.push(i + 1);
    });
    return out;
  });
  // Paged.js lays out landscape pages but only emits one @page size; give Chromium native named pages for printing.
  await page.addStyleTag({ content: '@page wide{size:297mm 210mm;margin:0} .pagedjs_wide_page{page:wide} .pagedjs_wide_page,.pagedjs_wide_page .pagedjs_sheet{width:297mm !important;height:210mm !important}' });
  await page.emulateMedia({ media: 'print' });
  const buf = await page.pdf({ preferCSSPageSize: true, printBackground: true, outline: true, tagged: true, displayHeaderFooter: false });
  await ctx.close();

  // metadata via pdf-lib
  const pdf = await PDFDocument.load(buf, { updateMetadata: false });
  pdf.setTitle(meta.title); pdf.setAuthor('Kiorex'); pdf.setSubject(meta.subject); pdf.setKeywords(meta.keywords);
  pdf.setCreator('Kiorex docs PDF generator'); pdf.setProducer('Kiorex docs PDF generator (Chromium + Paged.js + pdf-lib)');
  pdf.setCreationDate(new Date()); pdf.setModificationDate(new Date());
  const out = await pdf.save({ useObjectStreams: true });
  fs.writeFileSync(outFile, out);
  return { pages: pdf.getPageCount(), bytes: out.length, warnings: [...(enh.warnings || []), ...checks.overflow, ...(checks.blank.length ? [`blank pages: ${checks.blank.join(',')}`] : []), ...consoleErrors.map((e) => 'page error: ' + e)], enh, breaks: breakIds.length };
}

// Paged.js 0.4.3 does not repeat <thead> on continuation pages: patch rebuildAncestors to clone it into the continued table.
let _paged;
function pagedSource() {
  if (_paged) return _paged;
  let src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/pagedjs/dist/paged.polyfill.js'), 'utf8');
  const needle = '\t\t\tadded.push(parent);\n';
  if (!src.includes(needle)) throw new Error('Paged.js patch point not found (pagedjs version changed?)');
  src = src.replace(needle, needle + `\t\t\tif (parent.nodeName === "TABLE" && node.nodeName !== "THEAD" && !ancestors.some((a) => a.nodeName === "THEAD")) { const th = ancestor.querySelector(":scope > thead"); if (th) { const c = th.cloneNode(true); c.removeAttribute("data-ref"); c.querySelectorAll("[data-ref]").forEach((e) => e.removeAttribute("data-ref")); parent.appendChild(c); } }\n`);
  return (_paged = src);
}
