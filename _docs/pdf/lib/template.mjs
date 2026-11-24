import fs from 'node:fs';
import path from 'node:path';

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cssStr = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ') + '"';

const FONTS = [
  ['Inter', 400, 'inter-latin-400-normal'], ['Inter', 500, 'inter-latin-500-normal'], ['Inter', 600, 'inter-latin-600-normal'], ['Inter', 700, 'inter-latin-700-normal'],
  ['Jost', 500, 'jost-latin-500-normal'], ['Jost', 600, 'jost-latin-600-normal'], ['Jost', 700, 'jost-latin-700-normal'],
  ['JetBrains Mono', 400, 'jetbrains-mono-latin-400-normal'], ['JetBrains Mono', 600, 'jetbrains-mono-latin-600-normal'],
  ['IBM Plex Sans Arabic', 400, 'ibm-plex-sans-arabic-arabic-400-normal'], ['IBM Plex Sans Arabic', 500, 'ibm-plex-sans-arabic-arabic-500-normal'],
  ['IBM Plex Sans Arabic', 600, 'ibm-plex-sans-arabic-arabic-600-normal'], ['IBM Plex Sans Arabic', 700, 'ibm-plex-sans-arabic-arabic-700-normal'],
  ['Noto Sans Math', 400, 'noto-sans-math-latin-400-normal'],
];
export function fontFaces(dir) {
  return FONTS.map(([fam, w, f]) => `@font-face{font-family:"${fam}";font-weight:${w};font-style:normal;font-display:block;src:url("file://${encodeURI(path.join(dir, f + '.woff2'))}") format("woff2")}`).join('\n')
    + `\n@font-face{font-family:"Inter";font-weight:400;font-style:normal;font-display:block;unicode-range:U+0100-02AF,U+1E00-1EFF,U+2C60-2C7F,U+A720-A7FF;src:url("file://${encodeURI(path.join(dir, 'inter-latin-ext-400-normal.woff2'))}") format("woff2")}`;
}

export function familyVars(f) {
  const text = f.text || f.accent;
  const base = f.base || f.accent;
  return `--acc:${f.accent};--acc-text:${text};--acc2:${f.accent2};--acc-soft:${f.tint};--deep:${f.deep};--base:${base === f.accent && f.deep ? mix(f.deep, f.accent, 0.5) : base};--pulse:${f.pulse || '#E8735E'}`;
}
function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export function buildHtml({ doc, fam, parsed, brandDir, fontsDir, css, js, built, srcRel }) {
  const m = parsed.meta;
  const read = (f) => fs.readFileSync(path.join(brandDir, 'dist/svg', f), 'utf8').replace(/<\?xml[^>]*\?>/, '');
  // Kiorex-family covers (platform, business) use the NEW 8-channel KIOREX logo (founder spec 25 Nov 2026); the Kiorly families keep their lockups and the legacy chevron watermark (unchanged).
  const readRoot = (f) => fs.readFileSync(path.join(brandDir, f), 'utf8').replace(/<\?xml[^>]*\?>/, '');
  const kiorex = fam.logo === 'kiorex';
  const lockup = kiorex ? readRoot('kiorex-logo-full.svg') : read(`${fam.logo}-lockup.svg`);
  const mark = kiorex ? readRoot('kiorex-mark-onbrand.svg') : read('kiorex-mark-legacy-inverse.svg');
  const rev = m.revisionLabel || doc.revision || 'Rev 2.3';
  const status = m.status || 'Reference';
  const subtitle = doc.subtitle || m.kv.subtitle || '';
  const eyebrow = m.eyebrow || doc.group || '';
  const code = doc.code;
  const [kx, num] = code.split('-');
  const title = doc.title;
  const conf = 'Kiorex  ·  Confidential';
  const kvRows = [
    ['Document', `${code} · ${title}`, true],
    ['Revision', rev + (m.date ? '' : ''), false], ['Date', m.date || '', false], ['Status', status, false],
    ['Audience', m.kv.audience || '', false], ['Owner role', m.kv.owner || '', false],
    ['Supersedes', (m.kv.supersedes || (/supersedes[:\s]+([^)]+)/i.exec(m.kv.revision || '') || [])[1] || '').replace(/\.$/, ''), false],
    ['Document group', `${doc.group} · ${fam.label}`, false],
    ['Source file', srcRel, false], ['Built', built, false],
  ].filter(([, v]) => v);
  const cells = kvRows.map(([k, v, w]) => `<div class="cell${w ? ' wide' : ''}"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('');
  const tags = m.tags.length ? `<div class="tags">${m.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : '';
  const wc = parsed.whatChangedHtml
    ? `<div class="whatchanged"><aside class="callout c-changed"><div class="c-icon"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg></div><div class="c-body"><div class="c-title">What changed in ${esc(rev)}</div><div class="c-text">${parsed.whatChangedHtml}</div></div></aside></div>` : '';
  const ex = [m.extraction && `<b>Extraction note.</b> ${esc(m.extraction)}`, m.revisionNote && `<b>Revision note.</b> ${esc(m.revisionNote)}`].filter(Boolean).join('<br><br>');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(code + ' ' + title)}</title>
<meta name="author" content="Kiorex"><meta name="description" content="${esc(subtitle)}">
<style>${fontFaces(fontsDir)}</style><style>${css}</style></head>
<body style="${familyVars(fam)};--mark:url('data:image/svg+xml;base64,${Buffer.from(mark).toString('base64')}')">
<section class="cover" id="cover">
  <div class="orb"></div><div class="band"></div>
  <div class="chev">${mark}</div><div class="bandtxt">KIOREX</div>
  <div class="top"><div class="lockup">${lockup}</div><div class="fam">${esc(fam.label)}</div></div>
  <div class="mid">
    <div class="eyebrow">${esc(eyebrow)}</div>
    <div class="code">${esc(kx)}<b>-</b>${esc(num)}</div>
    <h1>${esc(title)}</h1><div class="rule"></div>
    <div class="sub">${esc(subtitle)}</div>
  </div>
  <div class="meta">
    <div><div class="k">Revision</div><div class="v">${esc(rev)}</div></div>
    <div><div class="k">Date</div><div class="v">${esc(m.date || '')}</div></div>
    <div><div class="k">Status</div><div class="v"><span class="chip"><i></i>${esc(status)}</span></div></div>
    <div><div class="k">Audience</div><div class="v" style="font-size:8.4pt">${esc((m.kv.audience || doc.group || '').slice(0, 70))}</div></div>
  </div>
  <div class="foot"><span>Kiorex v2 · Reference Edition</span><span>Confidential · ${esc(code)}</span></div>
</section>
<section class="control">
  <div class="hidden-strings"><span class="str-doctitle">${esc(code + '  ·  ' + title)}</span><span class="str-conf">${esc(conf)}</span><span class="str-code">${esc(code + '  ·  ' + rev)}</span></div>
  <div class="eyebrow-s">Document control</div><div class="page-title str-sec">About this document</div>
  <div class="grid">${cells}</div>${tags}${wc}${ex ? `<div class="exnote">${ex}</div>` : ''}
</section>
<section class="toc">
  <div class="eyebrow-s">${esc(code)}</div><div class="page-title str-sec">Contents</div>
  <ol id="toc"></ol>
</section>
<main id="content">${parsed.bodyHtml}</main>
<script>${js}</script>
</body></html>`;
}
