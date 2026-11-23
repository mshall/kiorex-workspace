// Generates dist/: static SVG logo set, favicons, PWA icons, OG image, Expo icon/adaptive/splash PNGs (sharp).
const fs = require("fs"), path = require("path");
const need = require("./resolve.cjs");
const sharp = need("sharp");
const root = path.join(__dirname, "..");
const out = (...p) => path.join(root, "dist", ...p);
fs.mkdirSync(out("svg"), { recursive: true }); fs.mkdirSync(out("pwa"), { recursive: true }); fs.mkdirSync(out("expo"), { recursive: true });

// Static SVGs rendered from the same scene as the React components (via a tiny TS-free re-implementation of scene serialisation)
require("./gen-svgs.cjs")(out("svg"));

const ACCENT = { kiorex: { light: "#0369A1", dark: "#38BDF8", name: "Kiorex" }, clinic: { light: "#0D9488", dark: "#2DD4BF", name: "Kiorly Clinic" },
  lab: { light: "#7C3AED", dark: "#A78BFA", name: "Kiorly Lab" }, pharmacy: { light: "#16A34A", dark: "#4ADE80", name: "Kiorly Pharmacy" },
  // The Kiorly staff app (ADR-037, 23 Nov 2026): the Kiorex mark with the Kiorly accent (Ocean), NOT a product colour (the app spans Clinic teal, Lab violet, Pharmacy green).
  kiorly: { light: "#0369A1", dark: "#38BDF8", name: "Kiorly" } };
const png = (svg, size, file) => sharp(svg, { density: 384 }).resize(size, size).png().toFile(file);

// One asset set per brand: "kiorex" -> dist/ (unchanged paths); clinic/lab/pharmacy -> dist/products/<p>/ with the product accent on the right chevron + icon gradient.
async function build(prod, D, vb0) {
  const A = ACCENT[prod];
  const o = (...p) => path.join(D, ...p);
  fs.mkdirSync(o("pwa"), { recursive: true }); fs.mkdirSync(o("expo"), { recursive: true });
  const iconSvg = Buffer.from(fs.readFileSync(path.join(root, "kiorex-app-icon.svg"), "utf8").replace(/#0369A1/g, A.light).replace('aria-label="Kiorex app icon"', `aria-label="${A.name} app icon"`));
  const bleed = (scale, bg = true) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3730A3"/><stop offset="1" stop-color="${A.light}"/></linearGradient></defs>
  ${bg ? '<rect width="1024" height="1024" fill="url(#g)"/>' : ""}
  <g transform="translate(512 512) scale(${scale}) translate(-549.5 -440)">
    <polyline points="373,237 505,440 373,643" fill="none" stroke="#fff" stroke-width="44"/>
    <polyline points="720,237 588,440 720,643" fill="none" stroke="#fff" stroke-width="44"/>
    <path d="M222 440 H510 L525 428 L540 466 L557 392 L574 460 L588 441 H877" fill="none" stroke="#E8735E" stroke-width="13" stroke-linejoin="round" stroke-linecap="round"/>
  </g></svg>`);
  const markOnly = (scale) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g transform="translate(512 512) scale(${scale}) translate(-549.5 -440)">
    <polyline points="373,237 505,440 373,643" fill="none" stroke="#3730A3" stroke-width="38"/>
    <polyline points="720,237 588,440 720,643" fill="none" stroke="${A.light}" stroke-width="38"/>
    <path d="M222 440 H510 L525 428 L540 466 L557 392 L574 460 L588 441 H877" fill="none" stroke="#E8735E" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"/></g></svg>`);
  fs.copyFileSync(prod === "kiorex" || prod === "kiorly" ? path.join(root, "kiorex-mark.svg") : out("svg", `${prod}-mark.svg`), o("favicon.svg"));
  await png(iconSvg, 16, o("favicon-16.png")); await png(iconSvg, 32, o("favicon-32.png")); await png(iconSvg, 48, o("favicon-48.png"));
  await png(iconSvg, 180, o("apple-touch-icon.png"));
  for (const sz of [192, 512]) { await png(iconSvg, sz, o("pwa", `icon-${sz}.png`)); await png(bleed(0.62), sz, o("pwa", `maskable-${sz}.png`)); }
  const pngs = await Promise.all([16, 32, 48].map((sz) => sharp(iconSvg, { density: 384 }).resize(sz, sz).png().toBuffer()));
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = 6 + 16 * pngs.length; const dirs = [], sizes = [16, 32, 48];
  pngs.forEach((b, i) => { const d = Buffer.alloc(16); d[0] = sizes[i]; d[1] = sizes[i]; d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6); d.writeUInt32LE(b.length, 8); d.writeUInt32LE(off, 12); off += b.length; dirs.push(d); });
  fs.writeFileSync(o("favicon.ico"), Buffer.concat([head, ...dirs, ...pngs]));
  fs.writeFileSync(o("manifest.webmanifest"), JSON.stringify({ name: A.name, short_name: A.name, theme_color: "#3730A3", background_color: "#F4F6FC", display: "standalone",
    icons: [{ src: "pwa/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "pwa/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] }, null, 2));
  // Expo
  await png(Buffer.from(iconSvg.toString().replace(/rx="228"/, 'rx="0"')), 1024, o("expo", "icon.png"));
  await png(bleed(0.62, false), 1024, o("expo", "adaptive-foreground.png"));
  fs.writeFileSync(o("expo", "adaptive-background-color.txt"), "#3730A3\n");
  await png(markOnly(0.9), 1024, o("expo", "splash-icon.png"));
  await png(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#3730A3" opacity="0"/><g transform="translate(512 512) scale(0.9) translate(-549.5 -440)">
    <polyline points="373,237 505,440 373,643" fill="none" stroke="#fff" stroke-width="38"/><polyline points="720,237 588,440 720,643" fill="none" stroke="${A.dark}" stroke-width="38"/>
    <path d="M222 440 H510 L525 428 L540 466 L557 392 L574 460 L588 441 H877" fill="none" stroke="#F08A75" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"/></g></svg>`), 1024, o("expo", "splash-icon-dark.png"));
  await png(iconSvg, 48, o("expo", "favicon.png"));
  // OG image 1200x630: Ground background + the product lockup
  const lockup = fs.readFileSync(out("svg", `${prod === "kiorly" ? "kiorex" : prod}-lockup.svg`), "utf8").trim().replace(/<svg[^>]*>/, (m) => m.replace(/ (width|height)="[^"]*"/g, ""));
  const vb = lockup.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
  const lw = 880, lh = (lw * vb[3]) / vb[2];
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F6FC"/><stop offset="1" stop-color="#E4E8F7"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/><rect x="0" y="618" width="1200" height="12" fill="#3730A3"/><rect x="800" y="618" width="400" height="12" fill="${A.light}"/>
  <svg x="${(1200 - lw) / 2}" y="${(630 - lh) / 2}" width="${lw}" height="${lh}" viewBox="${vb.join(" ")}">${lockup.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg></svg>`;
  fs.writeFileSync(o("og-image.svg"), og);
  await sharp(Buffer.from(og)).png().toFile(o("og-image.png"));
  return vb;
}

(async () => {
  const vb = await build("kiorex", out());
  for (const p of ["clinic", "lab", "pharmacy", "kiorly"]) await build(p, out("products", p));
  const lockup = fs.readFileSync(out("svg", "kiorex-lockup.svg"), "utf8").trim().replace(/<svg[^>]*>/, (m) => m.replace(/ (width|height)="[^"]*"/g, ""));
  // Email / print letterhead
  fs.writeFileSync(out("svg", "letterhead.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 794 1123" width="794" height="1123"><rect width="794" height="1123" fill="#fff"/>
  <svg x="56" y="48" width="220" height="${220 * vb[3] / vb[2]}" viewBox="${vb.join(" ")}">${lockup.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>
  <line x1="56" y1="120" x2="738" y2="120" stroke="#E2E6F2" stroke-width="1"/><line x1="56" y1="120" x2="156" y2="120" stroke="#E8735E" stroke-width="2"/>
  <line x1="56" y1="1063" x2="738" y2="1063" stroke="#E2E6F2" stroke-width="1"/></svg>`);
  console.log("assets ok");
})();
