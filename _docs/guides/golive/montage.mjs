// QA helper: contact sheet of rendered page PNGs. Usage: node montage.mjs dir from to out.png
import fs from 'node:fs'; import { launch } from '../../pdf/lib/pdf.mjs';
const [dir, from, to, out] = process.argv.slice(2);
const imgs = []; for (let i = +from; i <= +to; i++) imgs.push(`<img src="file://${dir}/p${String(i).padStart(2, '0')}.png" style="width:33%">`);
fs.writeFileSync(dir + '/m.html', `<body style="margin:0;background:#888;display:flex;flex-wrap:wrap;gap:4px">${imgs.join('')}</body>`);
const b = await launch(); const p = await b.newPage({ viewport: { width: 2100, height: 800 } });
await p.goto('file://' + dir + '/m.html'); await p.waitForTimeout(800); await p.screenshot({ path: out, fullPage: true }); await b.close();
