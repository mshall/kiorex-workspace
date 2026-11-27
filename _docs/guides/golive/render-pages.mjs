// QA helper: split a PDF into page PNGs with macOS sips (no extra tools needed). Usage: node render-pages.mjs file.pdf outdir [width]
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
import { PDFDocument } from '../../pdf/node_modules/pdf-lib/cjs/index.js';
const [file, dir, w = '900'] = process.argv.slice(2); fs.mkdirSync(dir, { recursive: true });
const src = await PDFDocument.load(fs.readFileSync(file));
for (let i = 0; i < src.getPageCount(); i++) {
  const d = await PDFDocument.create(); const [p] = await d.copyPages(src, [i]); d.addPage(p);
  const one = `${dir}/p${String(i + 1).padStart(2, '0')}.pdf`; fs.writeFileSync(one, await d.save());
  execFileSync('sips', ['-s', 'format', 'png', '--resampleWidth', w, one, '--out', one.replace('.pdf', '.png')], { stdio: 'ignore' }); fs.unlinkSync(one);
}
console.log('pages', src.getPageCount());
