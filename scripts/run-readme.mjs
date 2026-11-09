// Runs every README code block that imports the package (blocks marked `<!-- harness: skip -->`
// need a framework or a browser and are skipped), so the documentation cannot drift from the code.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const readme = readFileSync("README.md", "utf8");
const rx = /(<!--\s*harness:\s*skip\s*-->\s*\n)?```js\n([\s\S]*?)```/g;
const dir = mkdtempSync(join(".", ".readme-"));
let failed = 0;
let n = 0;
for (let m = rx.exec(readme); m !== null; m = rx.exec(readme)) {
  if (m[1] || !m[2].includes('from "hmrc-fraud-prevention-headers')) continue;
  n++;
  const file = join(dir, `block-${n}.mjs`);
  writeFileSync(file, m[2]);
  const run = spawnSync(process.execPath, [file], { encoding: "utf8" });
  console.log(`${run.status === 0 ? "ok" : "FAIL"} README block ${n}`);
  process.stdout.write(run.stdout);
  if (run.status !== 0) {
    failed++;
    console.log(run.stderr);
  }
}
rmSync(dir, { recursive: true, force: true });
if (n === 0 || failed) process.exit(1);
