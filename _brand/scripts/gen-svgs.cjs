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
  const { buildScene, PALETTE, PRODUCT_NAMES, PRODUCT_NAMES_AR } = loadScene();
  const defs = [["kiorex", "lockup"], ["kiorex", "mark"], ["kiorex", "wordmark"], ["clinic", "lockup"], ["clinic", "wordmark"], ["clinic", "mark"], ["lab", "lockup"], ["lab", "wordmark"], ["lab", "mark"],
    ["pharmacy", "lockup"], ["pharmacy", "wordmark"], ["pharmacy", "mark"], ["passport", "lockup"], ["nurse", "lockup"]];
  for (const stale of fs.readdirSync(dir)) if (/^kiorly-(lockup|wordmark)/.test(stale)) fs.unlinkSync(path.join(dir, stale)); // legacy un-suffixed "kiorly" files
  // Arabic lockups/wordmarks (clinic|lab|pharmacy): <product>-<lockup|wordmark>-ar[-mono|-inverse].svg; words are HarfBuzz-shaped outlines, artwork unchanged, mark on the right.
  const arDefs = ["clinic", "lab", "pharmacy"].flatMap((p) => [[p, "lockup"], [p, "wordmark"]]);
  const jobs = [...defs.map(([p, v]) => [p, v, "en"]), ...arDefs.map(([p, v]) => [p, v, "ar"])];
  for (const tone of ["color", "mono", "inverse"]) for (const [prod, v, lang] of jobs) {
    const sc = buildScene(v, prod, lang); const pal = PALETTE[tone];
    const body = sc.nodes.map((n) => n.k === "poly" ? `<polyline points="${n.points}" fill="none" stroke="${pal[n.role]}" stroke-width="${n.sw}"/>`
      : n.k === "pulse" ? `<path d="${n.d}" fill="none" stroke="${pal[n.role]}" stroke-width="${n.sw}" stroke-linejoin="round" stroke-linecap="round"/>`
      : n.k === "line" ? `<line x1="${n.x1}" y1="${n.y1}" x2="${n.x2}" y2="${n.y2}" stroke="${pal[n.role]}" stroke-width="${n.sw}"/>`
      : `<path fill="${pal[n.role]}" d="${n.d}" transform="${n.transform}"/>`).join("\n  ");
    const name = `${prod}-${v}${lang === "ar" ? "-ar" : ""}${tone === "color" ? "" : "-" + tone}.svg`;
    fs.writeFileSync(path.join(dir, name), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sc.viewBox.join(" ")}" role="img"${lang === "ar" ? ' lang="ar"' : ""} aria-label="${v === "mark" ? "Kiorex mark" : lang === "ar" ? PRODUCT_NAMES_AR[prod] : PRODUCT_NAMES[prod]}">\n  ${body}\n</svg>\n`);
  }
};
