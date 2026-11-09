// Runs every examples/*.mjs file against the built package, as a user would after install.
// The package resolves to this checkout through its own name (package.json "exports").
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const files = readdirSync("examples").filter((f) => f.endsWith(".mjs"));
let failed = 0;
for (const file of files) {
  const run = spawnSync(process.execPath, [`examples/${file}`], { encoding: "utf8" });
  const ok = run.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? "ok" : "FAIL"} examples/${file}`);
  if (!ok) console.log(run.stdout + run.stderr);
}
if (failed) process.exit(1);
