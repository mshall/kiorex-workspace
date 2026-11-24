// Proves the Kiorly brand outputs did not change when the Kiorex logo was replaced (Kiorex v2 logo system, 25 Nov 2026).
// `node scripts/kiorly-guard.cjs --write` records sha256 of every Kiorly-owned brand file into kiorly-checksums.json; without flags it verifies them.
// Covered: dist/svg/{clinic,lab,pharmacy,kiorly,nurse}-*.svg, dist/products/** (clinic, lab, pharmacy, kiorly asset sets), the shared scene/wordmark/web/native components the Kiorly apps vendor, kiorex-app-icon-legacy.svg.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const root = path.join(__dirname, "..");
const MANIFEST = path.join(root, "kiorly-checksums.json");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
function files() {
  const out = [];
  for (const f of fs.readdirSync(path.join(root, "dist/svg"))) if (/^(clinic|lab|pharmacy|kiorly|nurse)-/.test(f)) out.push(path.join("dist/svg", f));
  for (const f of walk(path.join(root, "dist/products"))) out.push(path.relative(root, f));
  for (const f of ["components/shared/logo-scene.ts", "components/shared/wordmarks.generated.ts", "components/shared/wordmarks-ar.generated.ts", "components/shared/foot-text.ts", "components/web/KiorexLogo.tsx", "components/native/KiorexLogo.tsx", "components/web/KxBrandBackdrop.tsx", "components/web/KxControls.tsx", "components/index.ts"]) out.push(f);
  return out.filter((f) => !f.endsWith(".DS_Store")).sort();
}
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");
function compute() { const m = {}; for (const f of files()) m[f] = sha(f); return m; }
module.exports = { compute, MANIFEST };
if (require.main === module) {
  if (process.argv.includes("--write")) { fs.writeFileSync(MANIFEST, JSON.stringify(compute(), null, 1) + "\n"); console.log("wrote", Object.keys(compute()).length, "checksums"); }
  else {
    const want = JSON.parse(fs.readFileSync(MANIFEST, "utf8")), got = compute(); const bad = [];
    for (const k of new Set([...Object.keys(want), ...Object.keys(got)])) if (want[k] !== got[k]) bad.push(k);
    if (bad.length) { console.error("KIORLY ASSETS CHANGED:\n" + bad.join("\n")); process.exit(1); }
    console.log("kiorly assets unchanged:", Object.keys(want).length, "files");
  }
}
