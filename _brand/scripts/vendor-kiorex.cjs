// Vendors the Kiorex logo system v2 into the Kiorex apps (copy, never symlink): node scripts/vendor-kiorex.cjs
// Component source -> <app>/src/brand/kiorex-logo/; static assets -> <app>/public/ (web, ops) or assets/ (Expo); self-hosted wordmark font -> public/fonts/.
// Kiorly apps are NOT targets (they keep vendor.cjs and their own marks).
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), ws = path.join(root, "..");
const dist = (...p) => path.join(root, "dist", ...p);
const cp = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); };
const src = (names, to) => names.forEach((n) => cp(path.join(root, "kiorex-logo", n), path.join(to, n)));
const WEB = ["geometry.ts", "model.ts", "KiorexLogo.web.tsx", "index.ts", "fonts.css", "spec-fixture.ts", "kiorex-logo.test.tsx"];
const NATIVE = ["geometry.ts", "model.ts", "KiorexLogo.native.tsx", "spec-fixture.ts", "kiorex-logo.native.test.tsx"];
const PUBLIC = ["favicon.svg", "favicon.ico", "favicon-32.png", "apple-touch-icon.png", "og-image.png", "og-image-dark.png", "manifest.webmanifest"];
const font = () => [["PlusJakartaSans-SemiBold-latin.woff2", "plus-jakarta-sans-600.woff2"], ["OFL.txt", "OFL.txt"]];
// New brand tokens (Kiorex logo system v2) are inserted additively into an app's vendored tokens.css (idempotent); the apps' other tokens are untouched.
function patchTokens(file) {
  if (!fs.existsSync(file)) return;
  let css = fs.readFileSync(file, "utf8");
  const gen = fs.readFileSync(path.join(root, "tokens.css"), "utf8");
  const block = gen.split("\n").filter((l) => /^ {2}--kx-brand-/.test(l)).join("\n");
  css = css.replace(/^ {2}--kx-brand-[\w-]+:[^\n]*\n/gm, "");
  css = css.replace(/(color-scheme: light;\n)/, `$1${block}\n`);
  fs.writeFileSync(file, css);
}
function web(app, { svgs = true, tests = true } = {}) {
  const base = path.join(ws, app); if (!fs.existsSync(base)) return console.log("skip", app);
  src(tests ? WEB : WEB.filter((n) => !/test|spec-fixture/.test(n)), path.join(base, "src/brand/kiorex-logo"));
  const pub = path.join(base, "public");
  for (const f of PUBLIC) if (fs.existsSync(dist(f))) cp(dist(f), path.join(pub, f));
  for (const f of fs.readdirSync(dist("pwa"))) cp(dist("pwa", f), path.join(pub, "pwa", f));
  if (svgs) for (const f of ["kiorex-logo-full.svg", "kiorex-logo-full-dark.svg", "kiorex-logo-full-mono.svg", "kiorex-mark.svg", "kiorex-mark-dark.svg", "kiorex-mark-mono.svg"]) cp(path.join(root, f), path.join(pub, f));
  for (const [a, b] of font()) cp(path.join(root, "fonts", a), path.join(pub, "fonts", b));
  patchTokens(path.join(base, "src/brand/tokens.css"));
  console.log("vendored", app);
}
web("kiorex-platform/apps/web"); web("kiorex-platform/apps/ops");
// Passport (kiorex-account): UI logo component + static assets
web("kiorex-account/apps/passport-ui", { tests: false });
// Booking widget (Preact): model + geometry + Preact component, no assets
{
  const base = path.join(ws, "kiorex-platform/apps/widget");
  if (fs.existsSync(base)) { src(["geometry.ts", "model.ts", "KiorexLogo.preact.tsx"], path.join(base, "src/brand/kiorex-logo")); console.log("vendored widget"); }
}
// Expo app
{
  const base = path.join(ws, "kiorex-platform/apps/mobile");
  src(NATIVE, path.join(base, "src/brand/kiorex-logo"));
  const A = path.join(base, "assets");
  for (const [a, b] of [["expo/icon.png", "icon.png"], ["expo/adaptive-foreground.png", "adaptive-icon.png"], ["expo/adaptive-background.png", "adaptive-background.png"], ["expo/adaptive-monochrome.png", "adaptive-monochrome.png"], ["expo/splash-icon.png", "splash-icon.png"], ["expo/splash-icon-dark.png", "splash-icon-dark.png"], ["expo/notification-icon.png", "notification-icon.png"], ["expo/favicon.png", "favicon.png"]]) cp(dist(a), path.join(A, b));
  for (const f of ["favicon.svg", "favicon.ico", "favicon-32.png", "apple-touch-icon.png", "og-image.png", "manifest.webmanifest"]) if (fs.existsSync(path.join(base, "public"))) cp(dist(f), path.join(base, "public", f));
  cp(path.join(root, "theme.ts"), path.join(base, "src/brand/theme.ts")); // additive: brand.indigoLift / oceanLift / darkSurface / ink
  console.log("vendored mobile");
}
