// node --test scripts/seed-staging.dry-run.test.mjs   (offline: --dry-run touches neither AWS nor tofu)
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "seed-staging.sh");
const run = (...args) => spawnSync("bash", [script, ...args], { encoding: "utf8", env: { ...process.env, AWS_PROFILE: "no-such-profile", PATH: "/usr/bin:/bin" } });

describe("seed-staging.sh --dry-run (Q10)", () => {
  it("prints the six steps in dependency order and executes nothing", () => {
    const r = run("--dry-run");
    assert.equal(r.status, 0, r.stderr);
    const order = [...r.stdout.matchAll(/^\s+\d\. \[([a-z-]+)\]/gm)].map((m) => m[1]);
    assert.deepEqual(order, ["passport", "clinic", "pharmacy", "lab", "kiorex-sync", "kiorex"]);
    assert.match(r.stdout, /dry run: nothing was executed/);
    assert.match(r.stdout, /KIORLY_ENV=staging/);
    assert.ok(!/AccessDenied|ExpiredToken|Unable to locate credentials/.test(r.stdout + r.stderr), "must not call AWS");
  });
  it("--only / --skip / --reset change the plan", () => {
    assert.deepEqual([...run("--dry-run", "--only", "lab,kiorex").stdout.matchAll(/^\s+\d\. \[([a-z-]+)\]/gm)].map((m) => m[1]), ["lab", "kiorex"]);
    assert.ok(!run("--dry-run", "--skip", "passport").stdout.includes("[passport]"));
    assert.match(run("--dry-run", "--reset").stdout, /reset=true/);
  });
  it("rejects unknown options and never targets a prod stack path", () => {
    assert.equal(run("--bogus").status, 2);
    assert.ok(!/live\/prod/.test(run("--dry-run").stdout));
  });
});
