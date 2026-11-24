// Repo guard: no KIOREX surface may reference the OLD Kiorex logo (two chevrons) files or the old component API.
// Allowlist: the legacy files themselves, the Kiorly generators (_brand/scripts/gen-svgs.cjs, gen-assets.cjs, vendor.cjs, kiorly-guard*), the Kiorly families of the PDF builder, Kiorly apps and docs history.
// Run: node --test _brand/kiorex-no-legacy.node.test.cjs
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const ws = path.join(__dirname, "..");
const SURFACES = [
  "kiorex-platform/apps/web/src", "kiorex-platform/apps/web/index.html", "kiorex-platform/apps/web/public",
  "kiorex-platform/apps/ops/src", "kiorex-platform/apps/ops/index.html", "kiorex-platform/apps/ops/public",
  "kiorex-platform/apps/widget/src", "kiorex-platform/apps/mobile/src", "kiorex-platform/apps/mobile/app", "kiorex-platform/apps/mobile/app.json", "kiorex-platform/apps/mobile/scripts",
  "kiorex-platform/apps/api/src/public-site", "kiorex-platform/apps/api/src/widget",
  "kiorex-account/apps/passport-ui/src", "kiorex-account/apps/dev-idp/src", "kiorex-account/apps/dev-idp/assets",
];
const SKIP_DIR = new Set(["node_modules", "dist", ".expo", "build", "test-results", "playwright-report"]);
const OLD = [
  /kiorex-(mark|lockup|wordmark|app-icon)[\w-]*legacy/, /passport-lockup/, /kiorex-logo-lockup\.svg/, /kiorex-wordmark(-inverse|-mono)?\.svg/, /kiorex-lockup(-inverse|-mono)?\.svg/, /kiorex-mark-inverse\.svg/, /kiorex-app-icon\.svg/,
  /logo-scene/, /points="40,28 58,60 40,92"/, /points="80,28 62,60 80,92"/, /wordmarks(-ar)?\.generated/, /brand\/components\/(web|native|shared)/, /<KiorexLogo[^>]*\bvariant=["'{]+(lockup|wordmark)/, /<KiorexLogo[^>]*\btone=/, /product=["']passport["']/,
];
const walk = (p) => { if (!fs.existsSync(p)) return []; const s = fs.statSync(p); if (s.isFile()) return [p]; return fs.readdirSync(p).filter((n) => !SKIP_DIR.has(n)).flatMap((n) => walk(path.join(p, n))); };
test("no Kiorex surface references the old Kiorex logo files or the old <KiorexLogo> API", () => {
  const hits = [];
  for (const s of SURFACES) for (const f of walk(path.join(ws, s))) {
    if (!/\.(tsx?|jsx?|css|html|json|cjs|mjs|svg|webmanifest)$/.test(f) || /\.d\.ts$/.test(f)) continue;
    const txt = fs.readFileSync(f, "utf8");
    for (const re of OLD) if (re.test(txt)) hits.push(`${path.relative(ws, f)}: ${re}`);
  }
  assert.deepStrictEqual(hits, []);
});
test("Kiorex static assets served by the apps are the new logo (8-channel favicon is the 4-channel micro mark)", () => {
  for (const app of ["kiorex-platform/apps/web/public", "kiorex-platform/apps/ops/public"]) {
    const fav = fs.readFileSync(path.join(ws, app, "favicon.svg"), "utf8");
    assert.match(fav, /viewBox="0 0 32 32"/); assert.doesNotMatch(fav, /stroke-width="38"/);
    const mark = fs.readFileSync(path.join(ws, app, "kiorex-mark.svg"), "utf8");
    assert.match(mark, /viewBox="20 20 110 90"/);
  }
});
