// Tiny SVG generators for sequence diagrams and flow diagrams. Colours are the Kiorex palette (indigo, ocean; coral only for the highlight line).
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const IND = '#3730A3', OCE = '#0369A1', COR = '#E8735E', INK = '#1b1f3a', MUT = '#5a6180';

/** d = { actors: [name...], msgs: [[from, to, text, {dash, note}]...] } indexes into actors */
export function seq(d) {
  const n = d.actors.length; const colW = Math.max(150, Math.floor(900 / n)); const W = colW * n + 20; const top = 14; const rowH = 34;
  const H = top + 44 + d.msgs.length * rowH + 30;
  const cx = (i) => 10 + colW * i + colW / 2;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.cap)}" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,Segoe UI,Roboto,sans-serif" font-size="12">`;
  s += `<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${INK}"/></marker></defs>`;
  d.actors.forEach((a, i) => {
    s += `<rect x="${cx(i) - colW / 2 + 8}" y="${top}" width="${colW - 16}" height="32" rx="8" fill="#eef0fb" stroke="${IND}" stroke-width="1.2"/><text x="${cx(i)}" y="${top + 20}" text-anchor="middle" fill="${INK}" font-weight="600">${esc(a)}</text>`;
    s += `<line x1="${cx(i)}" y1="${top + 32}" x2="${cx(i)}" y2="${H - 12}" stroke="#b9bfe0" stroke-dasharray="4 4"/>`;
  });
  d.msgs.forEach((m, k) => {
    const [f, t, text, o = {}] = m; const y = top + 62 + k * rowH;
    if (f === t) { s += `<path d="M${cx(f)},${y - 8} h34 v16 h-34" fill="none" stroke="${INK}" marker-end="url(#ar)"/><text x="${cx(f) + 40}" y="${y + 2}" fill="${INK}">${esc(text)}</text>`; return; }
    const x1 = cx(f), x2 = cx(t); const mid = (x1 + x2) / 2;
    s += `<line x1="${x1}" y1="${y}" x2="${x2 + (x2 > x1 ? -2 : 2)}" y2="${y}" stroke="${o.hi ? COR : INK}" stroke-width="${o.hi ? 2 : 1.3}" ${o.dash ? 'stroke-dasharray="5 3"' : ''} marker-end="url(#ar)"/>`;
    s += `<text x="${mid}" y="${y - 6}" text-anchor="middle" fill="${o.hi ? '#9a3a25' : OCE}" font-weight="500">${esc(text)}</text>`;
  });
  return s + '</svg>';
}

/** d = { nodes: [{t, sub?, kind?}], perRow?: n } linear flow with wrapping; kind 'warn' | 'end' coloured */
export function flow(d) {
  const per = d.perRow || 5; const bw = 150, bh = 52, gx = 30, gy = 34; const rows = Math.ceil(d.nodes.length / per);
  const W = per * bw + (per - 1) * gx + 20; const H = rows * bh + (rows - 1) * gy + 20;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.cap)}" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,Segoe UI,Roboto,sans-serif" font-size="12"><defs><marker id="fa" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${IND}"/></marker></defs>`;
  const pos = (i) => { const r = Math.floor(i / per), c = i % per; return { x: 10 + c * (bw + gx), y: 10 + r * (bh + gy) }; };
  d.nodes.forEach((nd, i) => {
    const { x, y } = pos(i);
    const fill = nd.kind === 'warn' ? '#fdeee9' : nd.kind === 'end' ? '#e6f3f9' : '#eef0fb'; const stroke = nd.kind === 'warn' ? COR : nd.kind === 'end' ? OCE : IND;
    s += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`;
    s += `<text x="${x + bw / 2}" y="${y + (nd.sub ? 22 : 31)}" text-anchor="middle" fill="${INK}" font-weight="600">${esc(nd.t)}</text>`;
    if (nd.sub) s += `<text x="${x + bw / 2}" y="${y + 39}" text-anchor="middle" fill="${MUT}" font-size="11">${esc(nd.sub)}</text>`;
    if (i < d.nodes.length - 1 && !nd.noNext) {
      const a = pos(i), b = pos(i + 1);
      if (a.y === b.y) s += `<line x1="${a.x + bw}" y1="${a.y + bh / 2}" x2="${b.x - 2}" y2="${b.y + bh / 2}" stroke="${IND}" stroke-width="1.4" marker-end="url(#fa)"/>`;
      else s += `<path d="M${a.x + bw / 2},${a.y + bh} v${gy / 2} H${b.x + bw / 2} V${b.y - 2}" fill="none" stroke="${IND}" stroke-width="1.4" marker-end="url(#fa)"/>`;
    }
  });
  return s + '</svg>';
}
