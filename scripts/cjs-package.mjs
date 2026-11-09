// Marks dist/cjs as CommonJS so Node and TypeScript read its .js and .d.ts files as CJS.
import { writeFileSync } from "node:fs";
writeFileSync("dist/cjs/package.json", `${JSON.stringify({ type: "commonjs" })}\n`);
