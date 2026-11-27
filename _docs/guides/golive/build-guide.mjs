// Builds the guide PDF: each chapter is rendered separately with Chromium (so page numbers of the contents are exact), then merged and stamped with header, footer and page numbers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from '../../pdf/node_modules/pdf-lib/cjs/index.js';
import { launch } from '../../pdf/lib/pdf.mjs';
import { chapters } from './content.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(HERE, 'build'); fs.mkdirSync(BUILD, { recursive: true });
const OUT = process.argv[2] || path.join(HERE, 'Kiorex_Market_GoLive_Egypt.pdf');
const logoFull = fs.readFileSync(path.join(HERE, '../../../_brand/kiorex-logo-full-onbrand.svg'), 'utf8');
const logoLight = fs.readFileSync(path.join(HERE, '../../../_brand/kiorex-logo-full.svg'), 'utf8');
const markPng = fs.readFileSync(path.join(HERE, '../../../_brand/dist/favicon-48.png'));
const DATE = '27 November 2026';

const css = `
@font-face{font-family:'Plus Jakarta Sans';font-weight:600;src:url('../../../../_brand/fonts/PlusJakartaSans-SemiBold-latin.woff2')}
@font-face{font-family:Inter;font-weight:400;src:url('../../../pdf/fonts/inter-latin-400-normal.woff2')}
@font-face{font-family:Inter;font-weight:500;src:url('../../../pdf/fonts/inter-latin-500-normal.woff2')}
@font-face{font-family:Inter;font-weight:600;src:url('../../../pdf/fonts/inter-latin-600-normal.woff2')}
@font-face{font-family:Inter;font-weight:700;src:url('../../../pdf/fonts/inter-latin-700-normal.woff2')}
@font-face{font-family:'JetBrains Mono';font-weight:400;src:url('../../../pdf/fonts/jetbrains-mono-latin-400-normal.woff2')}
:root{--indigo:#3730A3;--ocean:#0369A1;--coral:#E8735E;--ground:#F4F6FC;--ink:#0F172A;--muted:#475569;--line:#DCDBEF;--i50:#F1F1F9;--o50:#EDF5F8;--c50:#FDF5F4}
@page{size:A4;margin:22mm 16mm 20mm 16mm}
@page cover{margin:0}
*{box-sizing:border-box}
html{font-family:Inter,sans-serif;font-size:9.4pt;line-height:1.48;color:var(--ink)}
body{margin:0}
h1,h2,h3,.ct,.brandfont{font-family:'Plus Jakarta Sans',Inter,sans-serif;font-weight:600}
h1{font-size:25pt;line-height:1.15;color:var(--indigo);margin:0 0 4mm}
.chnum{font-family:'Plus Jakarta Sans';font-weight:600;font-size:10pt;letter-spacing:.3em;color:var(--ocean);margin:0 0 2mm}
.bar{height:3px;width:46mm;background:linear-gradient(90deg,var(--indigo),var(--ocean));border-radius:2px;position:relative;margin:0 0 7mm}
.bar:after{content:"";position:absolute;right:-8mm;top:0;width:5mm;height:3px;background:var(--coral);border-radius:2px}
h2{font-size:13.5pt;color:var(--ocean);margin:7mm 0 2.5mm;break-after:avoid}
p{margin:0 0 2.6mm}
.lead{font-size:11pt;line-height:1.55;color:var(--ink)}
code{font-family:'JetBrains Mono',monospace;font-size:8pt;background:var(--i50);color:var(--indigo);padding:.2mm 1.1mm;border-radius:1mm;word-break:break-word}
pre{font-family:'JetBrains Mono';font-size:8pt;background:var(--ink);color:#e2e8f0;padding:3mm;border-radius:2mm;white-space:pre-wrap}
ul{margin:0 0 3mm;padding-left:5mm} li{margin:0 0 1.4mm}
ul.check{list-style:none;padding-left:0}
ul.check li{position:relative;padding-left:7mm}
ul.check li:before{content:"";position:absolute;left:0;top:.9mm;width:3.6mm;height:3.6mm;border:1.3px solid var(--indigo);border-radius:1mm;background:#fff}
ol.steps{list-style:none;counter-reset:s;padding:0;margin:0 0 4mm}
ol.steps li{counter-increment:s;position:relative;padding:0 0 2.2mm 9mm;break-inside:avoid;margin:0}
ol.steps li:before{content:counter(s);position:absolute;left:0;top:-.2mm;width:6mm;height:6mm;border-radius:50%;background:var(--indigo);color:#fff;font:600 8.5pt 'Plus Jakarta Sans';text-align:center;line-height:6mm}
table{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:8.6pt}
th{background:linear-gradient(90deg,var(--indigo),var(--ocean));color:#fff;text-align:left;padding:1.8mm 2.4mm;font-weight:600}
td{padding:1.8mm 2.4mm;vertical-align:top;border-bottom:1px solid var(--line)}
tr{break-inside:avoid} tbody tr:nth-child(even) td{background:#FAFAFD}
td:first-child{font-weight:600}
.callout{border-left:4px solid var(--ocean);background:var(--o50);border-radius:0 2mm 2mm 0;padding:2.6mm 3.4mm;margin:3mm 0 4mm;break-inside:avoid}
.callout .ct{font-size:9.5pt;margin-bottom:.8mm;color:var(--ocean)}
.callout.warn{border-color:var(--coral);background:var(--c50)} .callout.warn .ct{color:#B4452F}
.callout p{margin:0}
.kpis{display:flex;gap:3mm;margin:4mm 0 3mm}
.kpi{flex:1;background:var(--i50);border-radius:2.5mm;padding:3mm;border-top:3px solid var(--indigo)}
.kpi:nth-child(2){border-color:var(--ocean)} .kpi:nth-child(3){border-color:var(--coral)}
.kpi b{display:block;font:600 22pt 'Plus Jakarta Sans';color:var(--indigo);line-height:1.1}
.kpi span{font-size:8pt;color:var(--muted);display:block;margin-top:1mm}
figure{margin:3mm 0 5mm;break-inside:avoid}
.shot{position:relative;border:1px solid var(--line);border-radius:2mm;box-shadow:0 1px 5px rgba(55,48,163,.12);background:#fff}
.shot img{display:block;width:100%;height:100%;object-fit:cover;object-position:top;border-radius:2mm}
figure{width:84%;margin-left:auto;margin-right:auto;page-break-inside:avoid}
figure.narrow{width:52%}
.pair{display:flex;gap:4mm;margin:3mm 0 5mm}.pair figure{width:50%;margin:0}
figcaption{font-size:8pt;color:var(--muted);margin-top:1.6mm}
figcaption b{color:var(--indigo)}
.pin{position:absolute;width:5mm;height:5mm;margin:-2.5mm 0 0 -2.5mm;border-radius:50%;background:var(--coral);color:#fff;font:600 7.5pt 'Plus Jakarta Sans';text-align:center;line-height:5mm;border:1.4px solid #fff;box-shadow:0 0 0 1px var(--coral)}
.mask{position:absolute;background:#fff}
.pill{display:inline-block;font:600 8pt 'Plus Jakarta Sans';padding:.4mm 2.4mm;border-radius:5mm;background:var(--i50);color:var(--indigo)}
.pill.amber{background:#FEF3C7;color:#92400E}
.verdict{background:var(--i50);border:1px solid var(--line);border-radius:2.5mm;padding:3.4mm;margin:2mm 0 3mm;font-size:10.5pt}
/* cover */
.cover{page:cover;height:297mm;width:210mm;position:relative;color:#fff;background:linear-gradient(135deg,#3730A3 0%,#2B4BAA 55%,#0369A1 100%);overflow:hidden}
.cover .logo{position:absolute;left:20mm;top:22mm;width:78mm}
.cover .logo svg{width:100%;height:auto}
.cover .eyebrow{position:absolute;left:20mm;top:100mm;font:600 10pt 'Plus Jakarta Sans';letter-spacing:.3em;color:#C7C5E5}
.cover h1{position:absolute;left:20mm;top:110mm;width:150mm;color:#fff;font-size:40pt;line-height:1.08;margin:0}
.cover .tag{position:absolute;left:20mm;top:172mm;width:150mm;font-size:12.5pt;line-height:1.5;color:#E7E6F5}
.cover .pulse{position:absolute;left:0;right:0;top:206mm}
.cover .meta{position:absolute;left:20mm;bottom:24mm;right:20mm;font-size:9pt;color:#DCDBEF;display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.3);padding-top:4mm}
.cover .meta b{display:block;color:#fff;font:600 9.5pt 'Plus Jakarta Sans'}
.cover .wm{position:absolute;right:-30mm;bottom:20mm;width:140mm;opacity:.07}
/* toc */
.toc{margin-top:6mm}
.toc .row{display:flex;align-items:baseline;gap:2mm;margin:4mm 0 0}
.toc .row .n{font:600 10pt 'Plus Jakarta Sans';color:var(--ocean);width:9mm}
.toc .row .t{font:600 11.5pt 'Plus Jakarta Sans';color:var(--indigo)}
.toc .row .d{flex:1;border-bottom:1.5px dotted #B1AEDB;transform:translateY(-1px)}
.toc .row .p{font:600 10.5pt 'Plus Jakarta Sans';color:var(--indigo)}
.toc .subs{margin:.8mm 0 0 11mm;font-size:8.8pt;color:var(--muted)}
.toc .subs div{break-inside:avoid}
`;
const doc = (body, cls = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>How to take a market live (Egypt)</title><style>${css}</style></head><body class="${cls}">${body}</body></html>`;

const cover = `<div class="cover">
<div class="logo">${logoFull}</div>
<div class="eyebrow">OPERATIONS GUIDE</div>
<h1>How to take a market live (Egypt)</h1>
<div class="tag">Step by step for the founder acting as Kiorex ops and super admin: record the launch gate for <b>market.eg.live</b>, verify what patients see, roll it back, and what Kiorly can and cannot do today.</div>
<svg class="pulse" viewBox="0 0 800 40" width="100%" height="14mm" preserveAspectRatio="none"><polyline points="0,20 330,20 345,14 360,4 372,36 384,10 392,20 800,20" fill="none" stroke="#E8735E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
<div class="meta"><div><b>Kiorex and Kiorly</b>Private, for the founder</div><div><b>${DATE}</b>Test stack screenshots; same screens as kx-test</div><div><b>Version 1</b>Contains no secrets</div></div>
</div>`;

const render = async (browser, html, name, opts = {}) => {
  const f = path.join(BUILD, name + '.html'); fs.writeFileSync(f, html);
  const page = await browser.newPage();
  await page.goto('file://' + f, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.close();
  fs.writeFileSync(path.join(BUILD, name + '.pdf'), pdf);
  return PDFDocument.load(pdf);
};

const browser = await launch();
const chs = chapters();
const coverDoc = await render(browser, doc(cover), 'cover');
const chDocs = [];
for (const c of chs) chDocs.push(await render(browser, doc(`<div class="chnum">CHAPTER ${c.num}</div><h1>${c.title}</h1><div class="bar"></div>${c.html}`), 'ch-' + c.id));
// contents page needs the page numbers
let start = 3; const pages = [];
for (const d of chDocs) { pages.push(start); start += d.getPageCount(); }
const tocHtml = `<div class="chnum">CONTENTS</div><h1>What is in this guide</h1><div class="bar"></div><div class="toc">${chs.map((c, i) => `<div class="row"><span class="n">${c.num}</span><span class="t">${c.title}</span><span class="d"></span><span class="p">${pages[i]}</span></div>${c.sub.length ? `<div class="subs">${c.sub.map((s) => `<div>${s}</div>`).join('')}</div>` : ''}`).join('')}</div>
<h2 style="margin-top:12mm">Quick map</h2>
<table><thead><tr><th>I want to ...</th><th>Go to</th></tr></thead><tbody>
<tr><td>Know exactly what to prepare</td><td>Chapter 02, Before you start</td></tr>
<tr><td>Record the Egypt gate</td><td>Chapter 03, section 3.4 (super admin account)</td></tr>
<tr><td>Check what patients see</td><td>Chapter 03, sections 3.3 and 3.5</td></tr>
<tr><td>Close Egypt again</td><td>Chapter 03, section 3.7</td></tr>
<tr><td>Know what Kiorly can do</td><td>Chapter 04, Part B (verdict: partial)</td></tr>
<tr><td>Fix a problem</td><td>Chapter 05, Troubleshooting</td></tr></tbody></table>`;
const tocDoc = await render(browser, doc(tocHtml), 'toc');
await browser.close();

const out = await PDFDocument.create();
for (const d of [coverDoc, tocDoc, ...chDocs]) for (const p of await out.copyPages(d, d.getPageIndices())) out.addPage(p);
const helv = await out.embedFont(StandardFonts.Helvetica), helvB = await out.embedFont(StandardFonts.HelveticaBold);
const mark = await out.embedPng(markPng);
const total = out.getPageCount();
out.getPages().forEach((pg, i) => {
  if (i === 0) return;
  const { width, height } = pg.getSize();
  const ind = rgb(0.216, 0.188, 0.639), mut = rgb(0.28, 0.33, 0.41);
  pg.drawImage(mark, { x: 16 * 2.835, y: height - 14.5 * 2.835, width: 7 * 2.835, height: 7 * 2.835 });
  pg.drawText('KIOREX', { x: 25 * 2.835, y: height - 11.3 * 2.835, size: 8.5, font: helvB, color: ind });
  pg.drawText('How to take a market live (Egypt)', { x: width - 16 * 2.835 - helv.widthOfTextAtSize('How to take a market live (Egypt)', 8), y: height - 11.3 * 2.835, size: 8, font: helv, color: mut });
  pg.drawLine({ start: { x: 16 * 2.835, y: height - 16 * 2.835 }, end: { x: width - 16 * 2.835, y: height - 16 * 2.835 }, thickness: 0.6, color: rgb(0.86, 0.86, 0.94) });
  pg.drawLine({ start: { x: 16 * 2.835, y: 15 * 2.835 }, end: { x: width - 16 * 2.835, y: 15 * 2.835 }, thickness: 0.6, color: rgb(0.86, 0.86, 0.94) });
  pg.drawText('Private, for the founder. Contains no secrets. Screenshots from a private test stack.', { x: 16 * 2.835, y: 10.5 * 2.835, size: 7.5, font: helv, color: mut });
  const t = `Page ${i + 1} of ${total}`; pg.drawText(t, { x: width - 16 * 2.835 - helvB.widthOfTextAtSize(t, 8), y: 10.5 * 2.835, size: 8, font: helvB, color: ind });
});
out.setTitle('How to take a market live (Egypt)'); out.setAuthor('Kiorex'); out.setSubject('Operations guide: launch gate market.eg.live, Kiorex and Kiorly'); out.setKeywords(['Kiorex', 'Kiorly', 'market go-live', 'Egypt', 'launch gate']); out.setCreator('Kiorex guide builder'); out.setCreationDate(new Date('2026-11-27T12:00:00Z'));
fs.writeFileSync(OUT, await out.save());
console.log('written', OUT, 'pages', total, 'chapter pages', JSON.stringify(chDocs.map((d) => d.getPageCount())));
