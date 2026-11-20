// Re-vendors the brand kit into the three Kiorly web apps (copy, never symlink): node scripts/vendor.cjs [clinic|lab|pharmacy ...]
// Touches ONLY brand files: src/brand/components, tailwind-preset.cjs, the product-accent token block in tokens.css and the public/ logo, favicon, PWA and OG assets.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const ws = path.join(root, "..");
const TARGETS = {
  clinic: { app: "clinics-management/apps/web", extra: ["clinics-management/apps/docs"] },
  lab: { app: "kiorly-lab/apps/web", extra: [] },
  pharmacy: { app: "kiorly-pharmacy/apps/web", extra: [] },
};
const T = JSON.parse(fs.readFileSync(path.join(root, "tokens.json"), "utf8"));
const block = (dark) => Object.entries(T.products).filter(([k]) => k[0] !== "$").map(([k, v]) => dark
  ? `  --kx-product-${k}: ${v.dark};\n  --kx-product-${k}-text: ${v.dark};` : `  --kx-product-${k}: ${v.graphic};\n  --kx-product-${k}-text: ${v.text};`).join("\n");
function patchTokens(file) {
  let s = fs.readFileSync(file, "utf8").replace(/^ *--kx-product-[\w-]+:[^\n]*\n/gm, "");
  s = s.replace(/(color-scheme: light;\n)/, `$1${block(false)}\n`);
  s = s.replace(/(color-scheme: dark;\n)/g, (m, g, off) => `${g}${block(true).replace(/^/gm, s.slice(Math.max(0, off - 40), off).includes("\n    ") || /\n {4}$/.test(s.slice(0, off)) ? "  " : "")}\n`);
  fs.writeFileSync(file, s);
}
const cp = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); };
const copyDir = (a, b, skip = []) => { for (const e of fs.readdirSync(a, { withFileTypes: true })) { if (skip.includes(e.name)) continue; e.isDirectory() ? copyDir(path.join(a, e.name), path.join(b, e.name), skip) : cp(path.join(a, e.name), path.join(b, e.name)); } };
for (const prod of (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TARGETS))) {
  const t = TARGETS[prod];
  for (const dir of [t.app, ...t.extra]) {
    const brand = path.join(ws, dir, "src/brand");
    if (!fs.existsSync(brand)) continue;
    // KxControls.tsx (language + theme toggles) needs lucide-react: only the three product web apps have it, not the docs site.
    const skip = dir === t.app ? [] : ["KxControls.tsx", "kx-controls.node.test.ts"];
    for (const sub of ["shared", "web"]) copyDir(path.join(root, "components", sub), path.join(brand, "components", sub), skip);
    cp(path.join(root, "components/index.ts"), path.join(brand, "components/index.ts"));
    cp(path.join(root, "tailwind-preset.cjs"), path.join(brand, "tailwind-preset.cjs"));
    patchTokens(path.join(brand, "tokens.css"));
  }
  const pub = path.join(ws, t.app, "public");
  const dist = path.join(root, "dist"), pd = path.join(dist, "products", prod);
  cp(path.join(dist, "svg", `${prod}-lockup.svg`), path.join(pub, "kiorly-lockup.svg"));
  cp(path.join(dist, "svg", `${prod}-lockup-inverse.svg`), path.join(pub, "kiorly-lockup-inverse.svg"));
  // Arabic lockups (words shaped RTL, mark on the right): kiorly-lockup-ar[-mono|-inverse].svg
  for (const tone of ["", "-mono", "-inverse"]) cp(path.join(dist, "svg", `${prod}-lockup-ar${tone}.svg`), path.join(pub, `kiorly-lockup-ar${tone}.svg`));
  if (prod === "clinic") { cp(path.join(dist, "svg", "nurse-lockup.svg"), path.join(pub, "nurse-lockup.svg")); cp(path.join(dist, "svg", "nurse-lockup-inverse.svg"), path.join(pub, "nurse-lockup-inverse.svg")); }
  for (const f of ["favicon.svg", "favicon.ico", "apple-touch-icon.png", "og-image.png"]) cp(path.join(pd, f), path.join(pub, f));
  copyDir(path.join(pd, "pwa"), path.join(pub, "pwa"));
  for (const dir of t.extra) { const p2 = path.join(ws, dir, "public"); if (fs.existsSync(p2)) for (const f of ["favicon.svg", "favicon.ico", "apple-touch-icon.png"]) cp(path.join(pd, f), path.join(p2, f)); }
  console.log("vendored", prod);
}
