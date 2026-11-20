// Generates dist/: static SVG logo set, favicons, PWA icons, OG image, Expo icon/adaptive/splash PNGs (sharp).
const fs = require("fs"), path = require("path");
const need = require("./resolve.cjs");
const sharp = need("sharp");
const root = path.join(__dirname, "..");
const out = (...p) => path.join(root, "dist", ...p);
fs.mkdirSync(out("svg"), { recursive: true }); fs.mkdirSync(out("pwa"), { recursive: true }); fs.mkdirSync(out("expo"), { recursive: true });

// Static SVGs rendered from the same scene as the React components (via a tiny TS-free re-implementation of scene serialisation)
require("./gen-svgs.cjs")(out("svg"));

const iconSvg = fs.readFileSync(path.join(root, "kiorex-app-icon.svg"));
// maskable / adaptive: full-bleed gradient, mark inside safe zone (66%)
const bleed = (scale, bg = true) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3730A3"/><stop offset="1" stop-color="#0369A1"/></linearGradient></defs>
  ${bg ? '<rect width="1024" height="1024" fill="url(#g)"/>' : ""}
  <g transform="translate(512 512) scale(${scale}) translate(-549.5 -440)">
    <polyline points="373,237 505,440 373,643" fill="none" stroke="#fff" stroke-width="44"/>
    <polyline points="720,237 588,440 720,643" fill="none" stroke="#fff" stroke-width="44"/>
    <path d="M222 440 H510 L525 428 L540 466 L557 392 L574 460 L588 441 H877" fill="none" stroke="#E8735E" stroke-width="13" stroke-linejoin="round" stroke-linecap="round"/>
  </g></svg>`);
const markOnly = (stroke, scale) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g transform="translate(512 512) scale(${scale}) translate(-549.5 -440)">
    <polyline points="373,237 505,440 373,643" fill="none" stroke="#3730A3" stroke-width="38"/>
    <polyline points="720,237 588,440 720,643" fill="none" stroke="#0369A1" stroke-width="38"/>
    <path d="M222 440 H510 L525 428 L540 466 L557 392 L574 460 L588 441 H877" fill="none" stroke="#E8735E" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"/></g></svg>`);
const png = (svg, size, file) => sharp(svg, { density: 384 }).resize(size, size).png().toFile(file);

(async () => {
  // favicon / PWA
  fs.copyFileSync(path.join(root, "kiorex-mark.svg"), out("favicon.svg"));
  await png(iconSvg, 16, out("favicon-16.png")); await png(iconSvg, 32, out("favicon-32.png")); await png(iconSvg, 48, out("favicon-48.png"));
  await png(iconSvg, 180, out("apple-touch-icon.png"));
  for (const s of [192, 512]) { await png(iconSvg, s, out("pwa", `icon-${s}.png`)); await png(bleed(0.62), s, out("pwa", `maskable-${s}.png`)); }
  // .ico (PNG-in-ICO, 16/32/48)
  const pngs = await Promise.all([16, 32, 48].map((s) => sharp(iconSvg, { density: 384 }).resize(s, s).png().toBuffer()));
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = 6 + 16 * pngs.length; const dirs = [], sizes = [16, 32, 48];
  pngs.forEach((b, i) => { const d = Buffer.alloc(16); d[0] = sizes[i]; d[1] = sizes[i]; d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6); d.writeUInt32LE(b.length, 8); d.writeUInt32LE(off, 12); off += b.length; dirs.push(d); });
  fs.writeFileSync(out("favicon.ico"), Buffer.concat([head, ...dirs, ...pngs]));
  fs.writeFileSync(out("manifest.webmanifest"), JSON.stringify({ name: "Kiorex", short_name: "Kiorex", theme_color: "#3730A3", background_color: "#F4F6FC", display: "standalone",
    icons: [{ src: "pwa/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "pwa/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] }, null, 2));
  // Expo
  await png(Buffer.from(iconSvg.toString().replace(/rx="228"/, 'rx="0"')), 1024, out("expo", "icon.png"));
  await png(bleed(0.62, false), 1024, out("expo", "adaptive-foreground.png"));
  fs.writeFileSync(out("expo", "adaptive-background-color.txt"), "#3730A3\n");
  await png(markOnly(0, 0.9), 1024, out("expo", "splash-icon.png"));
  await png(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#3730A3" opacity="0"/><g transform="translate(512 512) scale(0.9) translate(-549.5 -440)">
    <polyline points="373,237 505,440 373,643" fill="none" stroke="#fff" stroke-width="38"/><polyline points="720,237 588,440 720,643" fill="none" stroke="#38BDF8" stroke-width="38"/>
    <path d="M222 440 H510 L525 428 L540 466 L557 392 L574 460 L588 441 H877" fill="none" stroke="#F08A75" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"/></g></svg>`), 1024, out("expo", "splash-icon-dark.png"));
  await png(iconSvg, 48, out("expo", "favicon.png"));
  // OG image 1200x630: Ground background, lockup + tagline-free
  const lockup = fs.readFileSync(out("svg", "kiorex-lockup.svg"), "utf8").trim().replace(/<svg[^>]*>/, (m) => m.replace(/ (width|height)="[^"]*"/g, ""));
  const vb = lockup.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
  const lw = 880, lh = (lw * vb[3]) / vb[2];
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F6FC"/><stop offset="1" stop-color="#E4E8F7"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/><rect x="0" y="618" width="1200" height="12" fill="#3730A3"/><rect x="800" y="618" width="400" height="12" fill="#0369A1"/>
  <svg x="${(1200 - lw) / 2}" y="${(630 - lh) / 2}" width="${lw}" height="${lh}" viewBox="${vb.join(" ")}">${lockup.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg></svg>`;
  fs.writeFileSync(out("og-image.svg"), og);
  await sharp(Buffer.from(og)).png().toFile(out("og-image.png"));
  // Email / print letterhead
  fs.writeFileSync(out("svg", "letterhead.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 794 1123" width="794" height="1123"><rect width="794" height="1123" fill="#fff"/>
  <svg x="56" y="48" width="220" height="${220 * vb[3] / vb[2]}" viewBox="${vb.join(" ")}">${lockup.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>
  <line x1="56" y1="120" x2="738" y2="120" stroke="#E2E6F2" stroke-width="1"/><line x1="56" y1="120" x2="156" y2="120" stroke="#E8735E" stroke-width="2"/>
  <line x1="56" y1="1063" x2="738" y2="1063" stroke="#E2E6F2" stroke-width="1"/></svg>`);
  console.log("assets ok");
})();
