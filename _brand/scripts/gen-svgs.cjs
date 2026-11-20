// Serialises scenes (compiled on the fly from the TS sources by stripping types) to static SVG files.
const fs = require("fs"), path = require("path");
function loadTs(file) { // minimal TS->CJS for these two simple files
  let s = fs.readFileSync(file, "utf8");
  s = s.replace(/^import .*$/gm, "").replace(/export type [^;]*;\n?/gs, "")
    .replace(/export const (\w+)(: [^=]+)? =/g, "const $1 =").replace(/export function/g, "function")
    .replace(/: Record<[^>]*>>?/g, "").replace(/\(([^)]*)\)/g, (m) => m);
  return s;
}
module.exports = function (dir) {
  const wm = fs.readFileSync(path.join(__dirname, "../components/shared/wordmarks.generated.ts"), "utf8");
  const WORDS = JSON.parse(wm.match(/WORDS[^=]*= (\{.*\});/s)[1]);
  const PALETTE = { color: { indigo: "#3730A3", ocean: "#0369A1", coral: "#E8735E", sub: "#5F6888", rose: "#E11D48" }, inverse: { indigo: "#FFFFFF", ocean: "#7DD3FC", coral: "#F08A75", sub: "#C7CBEA", rose: "#FB7185" }, mono: { indigo: "currentColor", ocean: "currentColor", coral: "currentColor", sub: "currentColor", rose: "currentColor" } };
  // Evaluate scene builder via Function after crude type stripping
  let src = fs.readFileSync(path.join(__dirname, "../components/shared/logo-scene.ts"), "utf8");
  src = src.replace(/^import .*$/gm, "").replace(/^export type [\s\S]*?;\n(?=\n|export|const|function)/gm, "")
    .replace(/export type Node =[\s\S]*?;\n/m, "").replace(/export type Scene[^\n]*\n/, "")
    .replace(/export const PALETTE[\s\S]*?\n};\n/, "").replace(/export const PULSE_LENGTH/, "const PULSE_LENGTH")
    .replace(/export function/g, "function").replace(/: (Node\[\]|Role|Product|Variant|Scene|Tone|number|string)(\s*[,)={;])/g, "$2")
    .replace(/\): \{[^}]*\} \{/g, ") {").replace(/function markNodes\(nurse: boolean\)\s*:?\s*Node\[\]/, "function markNodes(nurse)")
    .replace(/const hasSub = \(p: Product\)/, "const hasSub = (p)").replace(/ as Role/g, "");
  src = src.replace(/function wordNodes\(([^)]*)\)[^{]*\{/, "function wordNodes(product, x, baseline) {").replace(/function buildScene\([^)]*\)[^{]*\{/, "function buildScene(variant, product = 'kiorex') {")
    .replace(/function markNodes\(nurse: boolean\)[^{]*\{/, "function markNodes(nurse) {");
  src = src.replace(/const nodes: Node\[\]/g, "const nodes").replace(/const (\w+): Role =/g, "const $1 =").replace(/\(l\) =>/g, "(l) =>");
  src += "\nreturn buildScene;";
  const buildScene = new Function("WORDS", src)(WORDS);
  const defs = [["kiorex", "lockup"], ["kiorex", "mark"], ["kiorex", "wordmark"], ["kiorly", "lockup"], ["passport", "lockup"], ["nurse", "lockup"], ["kiorly", "wordmark"]];
  for (const tone of ["color", "mono", "inverse"]) for (const [prod, v] of defs) {
    const sc = buildScene(v, prod); const pal = PALETTE[tone];
    const body = sc.nodes.map((n) => n.k === "poly" ? `<polyline points="${n.points}" fill="none" stroke="${pal[n.role]}" stroke-width="${n.sw}"/>`
      : n.k === "pulse" ? `<path d="${n.d}" fill="none" stroke="${pal[n.role]}" stroke-width="${n.sw}" stroke-linejoin="round" stroke-linecap="round"/>`
      : n.k === "line" ? `<line x1="${n.x1}" y1="${n.y1}" x2="${n.x2}" y2="${n.y2}" stroke="${pal[n.role]}" stroke-width="${n.sw}"/>`
      : `<path fill="${pal[n.role]}" d="${n.d}" transform="${n.transform}"/>`).join("\n  ");
    const name = `${prod === "kiorex" ? "kiorex" : prod}-${v}${tone === "color" ? "" : "-" + tone}.svg`;
    fs.writeFileSync(path.join(dir, name), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sc.viewBox.join(" ")}" role="img" aria-label="${prod === "passport" ? "Kiorex Passport" : prod === "kiorex" ? "Kiorex" : "Kiorly by Kiorex"}">\n  ${body}\n</svg>\n`);
  }
};
