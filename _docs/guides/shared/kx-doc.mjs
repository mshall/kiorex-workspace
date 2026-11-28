// Generic guide-to-PDF builder: cover, contents with exact page numbers, numbered chapters and sections, running header and footer in brand type, Page X of Y.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { css, ROOT } from './kx-theme.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(path.join(ROOT, '_docs/pdf/package.json'));
const { PDFDocument } = req('pdf-lib');
const { launch } = await import(path.join(ROOT, '_docs/pdf/lib/pdf.mjs'));
const logoFull = fs.readFileSync(path.join(ROOT, '_brand/kiorex-logo-full-onbrand.svg'), 'utf8');
const markOn = fs.readFileSync(path.join(ROOT, '_brand/kiorex-mark-onbrand.svg'), 'utf8');
const mark = fs.readFileSync(path.join(ROOT, '_brand/kiorex-mark.svg'), 'utf8');
const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').trim();

function numberSections(html, n) {
  let k = 0;
  return html.replace(/<h2>(.*?)<\/h2>/gs, (m, t) => {
    const mm = /^(\d+)\.(\d+)\s+(.*)$/s.exec(t);
    if (mm) { k = +mm[2]; return `<h2><span class="sn">${mm[1]}.${mm[2]}</span><span>${mm[3]}</span></h2>`; }
    k += 1; return `<h2><span class="sn">${n}.${k}</span><span>${t}</span></h2>`;
  });
}
const enhanceJs = `
document.querySelectorAll('td').forEach(td=>{const t=td.textContent.trim();const m=/^(PASS|FIXED|SKIP|OPEN|DESIGN|DORMANT)\\b/.exec(t);if(m&&td.children.length===0){td.innerHTML='<span class="pill '+m[1].toLowerCase()+'">'+m[1]+'</span>'+t.slice(m[1].length).replace(/^/,' ')}});
document.querySelectorAll('td code').forEach(c=>{if(c.textContent.length<=30)c.style.whiteSpace='nowrap'});
document.querySelectorAll('table').forEach(t=>{if(t.querySelectorAll('tbody tr').length<=7&&t.textContent.length<2200)t.style.breakInside='avoid';});
`;

/** Overlay running header (mark, wordmark, running title) and footer (note, Page X of Y, progress) on every page except the first. */
export async function stampPdf(browser, pdfBytes, runner, footer, buildDir) {
  const src = await PDFDocument.load(pdfBytes); const total = src.getPageCount();
  const fonts = css.split('/* cover */')[0].match(/@font-face[^}]*}/g).join('\n');
  const pgs = Array.from({ length: total }, (_, i) => i === 0 ? '<section class="pg"></section>' : `<section class="pg"><div class="hd"><span class="lg">${mark}<i>KIORE<em>X</em></i></span><span class="rt">${String(runner(i) || '').replace(/&/g, '&amp;')}</span></div><div class="ft"><span>${footer}</span><span class="pn">Page ${i + 1} of ${total}</span></div><div class="prog"><u style="width:${((i + 1) / total * 100).toFixed(1)}%"></u></div></section>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
@page{size:A4;margin:0}html,body{margin:0;background:transparent}*{box-sizing:border-box}
.pg{position:relative;width:210mm;height:296.6mm;page-break-after:always;overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif}
.hd{position:absolute;left:16mm;right:16mm;top:11mm;height:9mm;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #D5D9EC}
.lg{display:flex;align-items:center;gap:2mm}.lg svg{height:6.4mm;width:auto}.lg i{font:600 8pt 'Plus Jakarta Sans';font-style:normal;letter-spacing:.3em;color:#3730A3}.lg em{font-style:normal;color:#0369A1}
.rt{font:600 7.6pt 'Plus Jakarta Sans';color:#475569}
.ft{position:absolute;left:16mm;right:16mm;bottom:9mm;display:flex;justify-content:space-between;font:500 7.2pt 'Plus Jakarta Sans';color:#475569}
.pn{font-weight:700;color:#3730A3;font-size:7.8pt}
.prog{position:absolute;left:16mm;right:16mm;bottom:15mm;height:1.6px;background:#E3E5F3}.prog u{display:block;height:100%;background:linear-gradient(90deg,#3730A3,#0369A1);position:relative}
.prog u:after{content:"";position:absolute;right:-1.5mm;top:-.7mm;width:2.6mm;height:3px;background:#E8735E;border-radius:2px}
</style></head><body>${pgs}</body></html>`;
  const f = path.join(buildDir, 'overlay.html'); fs.mkdirSync(buildDir, { recursive: true }); fs.writeFileSync(f, html);
  const page = await browser.newPage(); await page.goto('file://' + f, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
  const ovPdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, omitBackground: true }); await page.close();
  const ovDoc = await PDFDocument.load(ovPdf);
  if (ovDoc.getPageCount() < total) throw new Error('overlay pages ' + ovDoc.getPageCount() + ' < ' + total);
  const emb = await src.embedPdf(ovDoc, Array.from({ length: total }, (_, i) => i));
  src.getPages().forEach((pg, i) => { if (i > 0) pg.drawPage(emb[i]); });
  return await src.save();
}
export async function buildDoc(o) {
  const BUILD = path.join(o.buildDir || path.join(HERE, '.build'), o.slug); fs.mkdirSync(BUILD, { recursive: true });
  const doc = (body, extra = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${o.title}</title><style>${css}${extra}${o.css || ''}</style></head><body>${body}<script>${enhanceJs}</script></body></html>`;
  const render = async (browser, html, name) => {
    const f = path.join(BUILD, name + '.html'); fs.writeFileSync(f, html);
    const page = await browser.newPage(); await page.goto('file://' + f, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }); await page.close();
    return { bytes: pdf, d: await PDFDocument.load(pdf) };
  };
  const cover = `<div class="cover"><div class="grid"></div><div class="wm">${markOn}</div><div class="glow"></div>
<div class="logo">${logoFull}</div><div class="tagline">${o.tagline || 'KIOREX AND KIORLY'}</div>
<div class="eyebrow">${o.eyebrow}</div><h1>${o.title}</h1><div class="tag">${o.subtitle}</div>
<svg class="pulse" viewBox="0 0 800 40" width="100%" height="14mm" preserveAspectRatio="none"><polyline points="0,20 330,20 345,14 360,4 372,36 384,10 392,20 800,20" fill="none" stroke="#E8735E" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
<div class="meta">${o.meta.map(([b, s]) => `<div><b>${b}</b>${s}</div>`).join('')}</div></div>`;
  const chs = o.chapters.map((c) => { const n = parseInt(c.num, 10); const html = numberSections(c.html, n); const sub = [...html.matchAll(/<h2><span class="sn">([\d.]+)<\/span><span>(.*?)<\/span><\/h2>/gs)].map((m) => `${m[1]}  ${strip(m[2])}`); return { ...c, html, sub }; });
  const browser = await launch();
  const covR = await render(browser, doc(cover), 'cover');
  const chR = [];
  for (const c of chs) chR.push(await render(browser, doc(`<div class="opener"><div class="num">${c.num}</div><div class="eyebrow">${c.eyebrow || 'CHAPTER ' + c.num}</div><h1>${c.title}</h1><div class="bar"></div></div>${c.html}`), 'ch-' + c.id));
  const mkToc = (st) => { let start = st; const pages = []; for (const r of chR) { pages.push(start); start += r.d.getPageCount(); }
    return `<div class="opener"><div class="eyebrow">CONTENTS</div><h1>${o.tocTitle || 'What is in this guide'}</h1><div class="bar"></div></div><div class="toc">${chs.map((c, i) => `<div class="row"><span class="n">${c.num}</span><span class="t">${c.title}</span><span class="d"></span><span class="p">${pages[i]}</span></div>${c.sub.length ? `<div class="subs">${c.sub.map((s) => `<div>${s}</div>`).join('')}</div>` : ''}`).join('')}</div>${o.quickMap || ''}`; };
  let tocR = await render(browser, doc(mkToc(3)), 'toc');
  const tp = tocR.d.getPageCount(); if (tp !== 1) tocR = await render(browser, doc(mkToc(2 + tp)), 'toc');
  const all = [covR, tocR, ...chR];
  let out = await PDFDocument.create();
  for (const r of all) for (const p of await out.copyPages(r.d, r.d.getPageIndices())) out.addPage(p);
  const names = ['cover', ...Array(tocR.d.getPageCount()).fill('Contents')]; chs.forEach((c, i) => { for (let k = 0; k < chR[i].d.getPageCount(); k++) names.push(`${c.num}  ${c.title}`); });
  const merged = await out.save();
  const stamped = await stampPdf(browser, merged, (i) => names[i], o.footer, BUILD);
  await browser.close();
  out = await PDFDocument.load(stamped);
  out.setTitle(o.title); out.setAuthor('Kiorex'); out.setSubject(o.subtitle.replace(/<[^>]+>/g, '')); out.setKeywords(o.keywords || ['Kiorex', 'Kiorly']); out.setCreator('Kiorex guide builder'); out.setCreationDate(new Date());
  fs.writeFileSync(o.out, await out.save());
  const total = out.getPageCount();
  console.log('written', o.out, 'pages', total, 'chapter pages', JSON.stringify(chR.map((r) => r.d.getPageCount())));
  return total;
}
