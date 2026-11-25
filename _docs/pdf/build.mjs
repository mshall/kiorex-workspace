#!/usr/bin/env node
// Kiorex v2 document PDF builder.  node build.mjs --all | --doc KX-05 [--doc KX-09] | --file path.md  [--out dir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDoc, makeMd } from './lib/md.mjs';
import { buildHtml } from './lib/template.mjs';
import { launch, renderPdf } from './lib/pdf.mjs';
import { designCss } from './lib/design/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const argv = process.argv.slice(2);
const opt = { docs: [], out: path.join(here, 'out'), all: false, files: [], keepHtml: false, dividers: true };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--all') opt.all = true;
  else if (a === '--doc') opt.docs.push(...argv[++i].split(',').map((s) => s.trim().toUpperCase().replace(/^KX(\d)/, 'KX-$1')));
  else if (a === '--file') opt.files.push(argv[++i]);
  else if (a === '--out') opt.out = path.resolve(argv[++i]);
  else if (a === '--keep-html') opt.keepHtml = true;
  else if (a === '--no-dividers') opt.dividers = false;
  else if (a === '-h' || a === '--help') { console.log('node build.mjs --all | --doc KX-05[,KX-09] | --file x.md  [--out dir] [--keep-html] [--no-dividers]'); process.exit(0); }
  else { console.error('Unknown argument: ' + a); process.exit(2); }
}
if (!opt.all && !opt.docs.length && !opt.files.length) { console.error('Nothing to build. Use --all, --doc KX-05 or --file path.md'); process.exit(2); }

const manifest = JSON.parse(fs.readFileSync(path.join(here, 'docs.manifest.json'), 'utf8'));
let jobs = [];
if (opt.all) jobs = manifest.docs;
for (const c of opt.docs) { const d = manifest.docs.find((x) => x.code === c); if (!d) { console.error(`Unknown document code ${c}`); process.exit(2); } jobs.push(d); }
for (const f of opt.files) {
  const abs = path.resolve(f); const base = path.basename(abs, '.md');
  jobs.push({ code: ((/^#\s*(KX-?\d+)/im.exec(fs.readFileSync(abs, 'utf8')) || /^(KX-?\d+)/i.exec(base) || ['', 'KX-XX'])[1]).toUpperCase().replace(/^KX(\d)/, 'KX-$1'), file: base, title: '', subtitle: '', family: 'platform', group: 'Document', sources: [abs] });
}
jobs = jobs.filter((d, i, a) => a.findIndex((x) => x.code === d.code && x.file === d.file) === i);
fs.mkdirSync(opt.out, { recursive: true });
const tmp = path.join(opt.out, '.tmp'); fs.mkdirSync(tmp, { recursive: true });

const css = designCss();
const micro = fs.readFileSync(path.join(repo, '_brand/kiorex-micro.svg'), 'utf8').replace(/<\?xml[^>]*\?>/, '').trim();
const js = fs.readFileSync(path.join(here, 'assets/enhance.js'), 'utf8');
const md = makeMd();
const d0 = new Date(); const built = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
const results = [];
const browser = await launch();
for (const doc of jobs) {
  const src = doc.sources.map((s) => path.resolve(repo, s)).find((p) => fs.existsSync(p));
  if (!src) { console.log(`SKIP  ${doc.code}  no Markdown source found (looked for: ${doc.sources.join(', ')})`); results.push({ code: doc.code, status: 'skipped' }); continue; }
  const t0 = Date.now();
  try {
    const fam = manifest.families[doc.family] || manifest.families.platform;
    const parsed = parseDoc(fs.readFileSync(src, 'utf8'), md);
    const srcRel = path.relative(repo, src);
    if (!doc.title) doc.title = parsed.meta.title || doc.file;
    const html = buildHtml({ doc, fam, parsed, brandDir: path.join(repo, '_brand'), fontsDir: path.join(here, 'fonts'), css, js, built, srcRel });
    const htmlFile = path.join(tmp, doc.code + '.html'); fs.writeFileSync(htmlFile, html);
    const outFile = path.join(opt.out, doc.file + '.pdf');
    const r = await renderPdf(browser, {
      htmlFile, outFile, enhanceCfg: { code: doc.code, dividers: opt.dividers },
      chrome: { code: doc.code, title: doc.title, rev: parsed.meta.revisionLabel || 'Rev 2.3', mark: micro },
      meta: { title: `${doc.code} ${doc.title}`, subject: doc.subtitle || doc.title, keywords: [doc.code, doc.group, 'Kiorex', ...(parsed.meta.tags || [])] },
    });
    if (!opt.keepHtml) fs.rmSync(htmlFile, { force: true });
    const kb = (r.bytes / 1024).toFixed(0);
    console.log(`OK    ${doc.code}  ${String(r.pages).padStart(3)} pages  ${kb.padStart(5)} KB  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${doc.file}.pdf${r.breaks ? `  (${r.breaks} heading break(s))` : ''}${r.warnings.length ? `  [${r.warnings.length} warning(s)]` : ''}`);
    for (const w of r.warnings) console.log('      warn: ' + w);
    results.push({ code: doc.code, status: 'ok', pages: r.pages, kb: +kb, warnings: r.warnings, source: srcRel, file: doc.file + '.pdf' });
  } catch (e) {
    console.log(`FAIL  ${doc.code}  ${e.message}`); results.push({ code: doc.code, status: 'failed', error: e.message });
  }
}
await browser.close();
fs.writeFileSync(path.join(opt.out, 'build-report.json'), JSON.stringify(results, null, 2));
if (!opt.keepHtml) fs.rmSync(tmp, { recursive: true, force: true });
const failed = results.filter((r) => r.status === 'failed').length;
console.log(`\nDone: ${results.filter((r) => r.status === 'ok').length} built, ${results.filter((r) => r.status === 'skipped').length} skipped, ${failed} failed -> ${opt.out}`);
process.exit(failed ? 1 : 0);
