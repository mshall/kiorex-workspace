// Serialises the scenes from components/shared/logo-scene.ts to static SVG files (dist/svg). The TS source is bundled with esbuild so the
// static files can never drift from the React / React Native components.
const fs = require("fs"), path = require("path");
const need = require("./resolve.cjs");
const esbuild = need("esbuild");
function loadScene() {
  const r = esbuild.buildSync({ entryPoints: [path.join(__dirname, "../components/shared/logo-scene.ts")], bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent" });
  const m = { exports: {} };
  new Function("module", "exports", r.outputFiles[0].text)(m, m.exports);
  return m.exports;
}
module.exports = function (dir) {
  const { buildScene, PALETTE, PRODUCT_NAMES } = loadScene();
  const defs = [["kiorex", "lockup"], ["kiorex", "mark"], ["kiorex", "wordmark"], ["clinic", "lockup"], ["clinic", "wordmark"], ["clinic", "mark"], ["lab", "lockup"], ["lab", "wordmark"], ["lab", "mark"],
    ["pharmacy", "lockup"], ["pharmacy", "wordmark"], ["pharmacy", "mark"], ["passport", "lockup"], ["nurse", "lockup"]];
  for (const stale of fs.readdirSync(dir)) if (/^kiorly-(lockup|wordmark)/.test(stale)) fs.unlinkSync(path.join(dir, stale)); // legacy un-suffixed "kiorly" files
  for (const tone of ["color", "mono", "inverse"]) for (const [prod, v] of defs) {
    const sc = buildScene(v, prod); const pal = PALETTE[tone];
    const body = sc.nodes.map((n) => n.k === "poly" ? `<polyline points="${n.points}" fill="none" stroke="${pal[n.role]}" stroke-width="${n.sw}"/>`
      : n.k === "pulse" ? `<path d="${n.d}" fill="none" stroke="${pal[n.role]}" stroke-width="${n.sw}" stroke-linejoin="round" stroke-linecap="round"/>`
      : n.k === "line" ? `<line x1="${n.x1}" y1="${n.y1}" x2="${n.x2}" y2="${n.y2}" stroke="${pal[n.role]}" stroke-width="${n.sw}"/>`
      : `<path fill="${pal[n.role]}" d="${n.d}" transform="${n.transform}"/>`).join("\n  ");
    const name = `${prod}-${v}${tone === "color" ? "" : "-" + tone}.svg`;
    fs.writeFileSync(path.join(dir, name), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sc.viewBox.join(" ")}" role="img" aria-label="${v === "mark" ? "Kiorex mark" : PRODUCT_NAMES[prod]}">\n  ${body}\n</svg>\n`);
  }
};
