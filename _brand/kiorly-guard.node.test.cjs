// Kiorly-unchanged proof (Kiorex logo system v2): replacing the Kiorex logo must not alter a single byte of any Kiorly brand asset.
// Verifies sha256 of every Kiorly-owned file against kiorly-checksums.json (recorded BEFORE the change) after regenerating them with the rewired generators.
// Run: node --test _brand/kiorly-guard.node.test.cjs   (regenerates dist/ first when it is absent: dist/ is git-ignored)
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path"), cp = require("child_process");
const root = __dirname;
test("Kiorly brand assets are byte-identical to the recorded checksums", () => {
  if (!fs.existsSync(path.join(root, "dist/svg")) || process.env.KIORLY_GUARD_REGEN === "1") cp.execFileSync("node", ["scripts/gen-assets.cjs"], { cwd: root, stdio: "pipe" });
  const { compute, MANIFEST } = require("./scripts/kiorly-guard.cjs");
  const want = JSON.parse(fs.readFileSync(MANIFEST, "utf8")), got = compute();
  assert.ok(Object.keys(want).length > 150, "manifest looks truncated");
  const bad = [...new Set([...Object.keys(want), ...Object.keys(got)])].filter((k) => want[k] !== got[k]);
  assert.deepStrictEqual(bad, [], "Kiorly assets changed: " + bad.join(", "));
});
test("the Kiorly generators read the LEGACY Kiorex mark, never the new logo", () => {
  const assets = fs.readFileSync(path.join(root, "scripts/gen-assets.cjs"), "utf8"), svgs = fs.readFileSync(path.join(root, "scripts/gen-svgs.cjs"), "utf8");
  assert.match(assets, /kiorex-app-icon-legacy\.svg/); assert.match(assets, /kiorex-mark-legacy-mono\.svg/);
  assert.doesNotMatch(assets, /kiorex-logo-full|kiorex-badge/);
  assert.doesNotMatch(svgs, /kiorex-logo-full|kiorex-badge/);
  for (const f of ["kiorex-mark-legacy.svg", "kiorex-app-icon-legacy.svg"]) assert.ok(fs.existsSync(path.join(root, f)), f + " missing");
});
test("the new Kiorex generator never writes into the Kiorly output folders", () => {
  const v2 = fs.readFileSync(path.join(root, "scripts/gen-kiorex-v2.cjs"), "utf8");
  assert.doesNotMatch(v2, /products\/|["']products["']|kiorly-/);
});
