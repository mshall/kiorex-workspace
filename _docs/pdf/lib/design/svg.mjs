// Kiorex document design system: inline SVG primitives.
// Brand rules (_brand/KIOREX_LOGO_SPEC_v2.md): indigo #3730A3, ocean #0369A1, coral #E8735E only for lines, dividers and large
// highlights (never small text); Plus Jakarta Sans for titles, Inter for labels. The logo geometry is never drawn here.
export const COL = {
  indigo: '#3730A3', indigo9: '#221E62', indigoSoft: '#EEEDFA', indigoLine: '#B4B0E3',
  ocean: '#0369A1', oceanSoft: '#E4F1F8', oceanLine: '#9FCBE3',
  coral: '#E8735E', coralSoft: '#FDF0EC', coralLine: '#F2B3A6',
  ok: '#15803D', okSoft: '#E5F6EA', okLine: '#9AD4AE', warn: '#B45309', warnSoft: '#FEF4DC', warnLine: '#EBC477',
  bad: '#B91C1C', badSoft: '#FDEAEA',
  ink: '#11102E', n900: '#1A1D36', n800: '#2A2F4A', n700: '#3F4663', n600: '#535B7B', n500: '#6F7899', n400: '#9AA2BF', n300: '#C5CBDF', n200: '#DDE1EF', n100: '#EBEEF8', n50: '#F4F6FC', white: '#FFFFFF',
};
export const TONE = {
  indigo: { fill: COL.indigoSoft, stroke: COL.indigo, line: COL.indigoLine, head: COL.indigo, text: COL.ink, sub: COL.n700 },
  ocean: { fill: COL.oceanSoft, stroke: COL.ocean, line: COL.oceanLine, head: COL.ocean, text: COL.ink, sub: COL.n700 },
  neutral: { fill: COL.white, stroke: COL.n300, line: COL.n200, head: COL.ink, text: COL.ink, sub: COL.n600 },
  ground: { fill: COL.n50, stroke: COL.n300, line: COL.n200, head: COL.ink, text: COL.ink, sub: COL.n600 },
  ok: { fill: COL.okSoft, stroke: COL.ok, line: COL.okLine, head: COL.ok, text: COL.ink, sub: COL.n700 },
  warn: { fill: COL.warnSoft, stroke: COL.warn, line: COL.warnLine, head: COL.warn, text: COL.ink, sub: COL.n700 },
  coral: { fill: COL.coralSoft, stroke: COL.coral, line: COL.coralLine, head: COL.ink, text: COL.ink, sub: COL.n700 },
  dark: { fill: COL.ink, stroke: COL.ink, line: COL.n700, head: '#FFFFFF', text: '#FFFFFF', sub: '#C9CDEB' },
  solid: { fill: COL.indigo, stroke: COL.indigo, line: COL.indigo, head: '#FFFFFF', text: '#FFFFFF', sub: '#DAD8F5' },
  solidOcean: { fill: COL.ocean, stroke: COL.ocean, line: COL.ocean, head: '#FFFFFF', text: '#FFFFFF', sub: '#D6EBF6' },
};
const HEAD = `font-family="'Plus Jakarta Sans','Inter',sans-serif"`;
const BODY = `font-family="'Inter','Noto Sans Math','IBM Plex Sans Arabic',sans-serif"`;
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// approximate text width (Inter ~0.545 em average, bold ~0.6)
export const tw = (s, size, bold) => String(s).length * size * (bold ? 0.6 : 0.535);
export function wrap(text, maxPx, size, bold) {
  const words = String(text).split(/\s+/).filter(Boolean); const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (tw(t, size, bold) > maxPx && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur); return lines;
}

export class Dia {
  constructor(w, h, label) { this.w = w; this.h = h; this.label = label || ''; this.parts = []; this.mk = {}; }
  add(s) { this.parts.push(s); return this; }
  marker(tone) { this.mk[tone] = 1; return `url(#kxa-${tone})`; }
  // ----- text
  text(x, y, str, o = {}) {
    const { size = 11, weight = 400, fill = COL.n700, anchor = 'start', head = false, spacing, upper = false, opacity } = o;
    const lines = Array.isArray(str) ? str : [str]; const lh = o.lh || size * 1.32;
    const tsp = lines.map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(upper ? String(l).toUpperCase() : l)}</tspan>`).join('');
    return this.add(`<text x="${x}" y="${y}" ${head ? HEAD : BODY} font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${spacing ? ` letter-spacing="${spacing}"` : ''}${opacity ? ` opacity="${opacity}"` : ''}>${tsp}</text>`);
  }
  // ----- containers
  lane(x, y, w, h, label, o = {}) {
    const t = TONE[o.tone || 'ground'];
    this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${o.fill || t.fill}" stroke="${o.stroke || t.line}" stroke-width="1.2"${o.dash === false ? '' : ' stroke-dasharray="5 4"'}/>`);
    if (label) this.text(x + 14, y + 19, label, { size: 9.5, weight: 700, fill: o.labelFill || (o.tone === 'indigo' ? COL.indigo : o.tone === 'ocean' ? COL.ocean : COL.n600), spacing: 1.4, upper: true });
    return this;
  }
  box(x, y, w, h, o = {}) {
    const t = TONE[o.tone || 'neutral']; const pad = o.pad ?? 11; const ts = o.ts || 12; const ss = o.ss || 10.2;
    this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 9}" fill="${o.fill || t.fill}" stroke="${t.stroke}" stroke-width="${o.sw ?? 1.2}"${o.dash ? ' stroke-dasharray="5 3"' : ''}/>`);
    if (o.bar) this.add(`<rect x="${x}" y="${y}" width="4" height="${h}" rx="2" fill="${t.stroke}"/>`);
    const tl = o.t ? wrap(o.t, w - pad * 2 - (o.bar ? 4 : 0), ts, true) : [];
    const subs = o.s ? (Array.isArray(o.s) ? o.s : [o.s]).flatMap((s) => wrap(s, w - pad * 2 - (o.bar ? 4 : 0), ss, false)) : [];
    const th = tl.length * ts * 1.25, sh = subs.length * ss * 1.34, gap = tl.length && subs.length ? 4 : 0;
    let y0 = o.valign === 'top' ? y + pad + ts * 0.85 : y + (h - th - sh - gap) / 2 + ts * 0.9;
    const cx = o.align === 'center' ? x + w / 2 : x + pad + (o.bar ? 4 : 0);
    const an = o.align === 'center' ? 'middle' : 'start';
    if (tl.length) this.text(cx, y0, tl, { size: ts, weight: 600, fill: t.head === COL.ink ? COL.ink : (o.tone === 'neutral' || o.tone === 'ground' ? COL.ink : t.head === '#FFFFFF' ? '#fff' : COL.ink), anchor: an, head: true, lh: ts * 1.25 });
    if (subs.length) this.text(cx, y0 + th - ts * 0.9 + gap + ss * 1.0 + (tl.length ? 0.5 : 0), subs, { size: ss, fill: t.sub, anchor: an, lh: ss * 1.34 });
    if (o.tag) this.tag(x + w - 8, y - 7, o.tag, { tone: o.tagTone || o.tone || 'indigo', anchor: 'end' });
    return this;
  }
  tag(x, y, str, o = {}) {
    const t = TONE[o.tone || 'indigo']; const size = o.size || 8.4; const w = tw(str, size, true) + 14; const h = size + 8;
    const x0 = o.anchor === 'end' ? x - w : o.anchor === 'middle' ? x - w / 2 : x;
    const solid = o.solid !== false && (o.tone === 'indigo' || o.tone === 'ocean' || o.tone === 'dark' || !o.tone);
    this.add(`<rect x="${x0}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${solid ? (o.tone === 'ocean' ? COL.ocean : o.tone === 'dark' ? COL.ink : COL.indigo) : t.fill}" stroke="${solid ? 'none' : t.stroke}" stroke-width="1"/>`);
    this.add(`<text x="${x0 + w / 2}" y="${y + h / 2 + size * 0.36}" ${BODY} font-size="${size}" font-weight="700" fill="${solid ? '#fff' : COL.ink}" text-anchor="middle" letter-spacing=".5">${esc(str)}</text>`);
    return this;
  }
  num(x, y, n, tone = 'indigo', r = 9) {
    const t = tone === 'ocean' ? COL.ocean : tone === 'dark' ? COL.ink : COL.indigo;
    this.add(`<circle cx="${x}" cy="${y}" r="${r}" fill="${t}"/><text x="${x}" y="${y + 3.6}" ${HEAD} font-size="10.5" font-weight="700" fill="#fff" text-anchor="middle">${n}</text>`);
    return this;
  }
  // ledger: stacked, append-only look
  ledger(x, y, w, h, o = {}) {
    const t = TONE[o.tone || 'indigo']; const rows = Math.max(2, Math.floor((h - 26) / 9));
    this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="#fff" stroke="${t.stroke}" stroke-width="1.3"/>`);
    this.add(`<rect x="${x}" y="${y}" width="${w}" height="22" rx="9" fill="${t.stroke}"/><rect x="${x}" y="${y + 12}" width="${w}" height="10" fill="${t.stroke}"/>`);
    this.text(x + 10, y + 15, o.t || 'Ledger', { size: 10.5, weight: 700, fill: '#fff', head: true });
    for (let i = 0; i < rows; i++) this.add(`<rect x="${x + 10}" y="${y + 30 + i * 9}" width="${w - 20 - (i % 3) * 14}" height="3" rx="1.5" fill="${t.line}"/>`);
    if (o.s) this.text(x + w / 2, y + h + 13, o.s, { size: 9.5, fill: COL.n600, anchor: 'middle' });
    return this;
  }
  // ----- connectors
  arrow(pts, o = {}) {
    const tone = o.tone || 'indigo'; const col = { indigo: COL.indigo, ocean: COL.ocean, coral: COL.coral, ink: COL.n800, grey: COL.n500, ok: COL.ok, warn: COL.warn }[tone] || COL.indigo;
    const r = o.r ?? 7; let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = pts[i]; if (i < pts.length - 1 && r) {
        const [px, py] = pts[i - 1], [nx, ny] = pts[i + 1];
        const a = Math.hypot(x - px, y - py), b = Math.hypot(nx - x, ny - y), rr = Math.min(r, a / 2, b / 2);
        d += ` L${x - (x - px) / a * rr} ${y - (y - py) / a * rr} Q${x} ${y} ${x + (nx - x) / b * rr} ${y + (ny - y) / b * rr}`;
      } else d += ` L${x} ${y}`;
    }
    this.mk[tone] = col;
    const end = o.noHead ? '' : ` marker-end="url(#kxa-${tone})"`; const start = o.both ? ` marker-start="url(#kxa-${tone})"` : '';
    this.add(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${o.w || 1.8}" stroke-linecap="round" stroke-linejoin="round"${o.dash ? ' stroke-dasharray="6 4"' : ''}${end}${start}/>`);
    if (o.label) {
      let lx = o.lx, ly = o.ly;
      if (lx == null) { let best = 0, bi = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (l > best) { best = l; bi = i; } } lx = (pts[bi][0] + pts[bi - 1][0]) / 2; ly = (pts[bi][1] + pts[bi - 1][1]) / 2; }
      this.chip(lx, ly, o.label, { stroke: col, size: o.ls || 9.2 });
    }
    return this;
  }
  chip(cx, cy, str, o = {}) {
    const size = o.size || 9.2; const lines = Array.isArray(str) ? str : [str]; const w = Math.max(...lines.map((l) => tw(l, size, false))) + 12; const h = lines.length * size * 1.3 + 6;
    this.add(`<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${Math.min(8, h / 2)}" fill="#fff" stroke="${o.stroke || COL.n300}" stroke-width="1"/>`);
    this.text(cx, cy - h / 2 + size * 1.0 + 3.4, lines, { size, fill: COL.n800, anchor: 'middle', weight: 500, lh: size * 1.3 });
    return this;
  }
  line(x1, y1, x2, y2, o = {}) { return this.add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.stroke || COL.coral}" stroke-width="${o.w || 1.6}" stroke-linecap="round"${o.dash ? ' stroke-dasharray="4 4"' : ''}/>`); }
  // the Kiorex pulse as a divider line (not the logo): a plain coral line
  rule(x, y, w) { return this.line(x, y, x + w, y, { stroke: COL.coral, w: 1.4 }); }
  svg(title) {
    const defs = Object.entries(this.mk).filter(([, c]) => typeof c === 'string').map(([tone, c]) => `<marker id="kxa-${tone}" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M1 1.4 L8.6 5 L1 8.6 Z" fill="${c}"/></marker>`).join('');
    return `<svg class="kxd" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" role="img" aria-label="${esc(title || this.label)}"><defs>${defs}</defs>${this.parts.join('')}</svg>`;
  }
}
