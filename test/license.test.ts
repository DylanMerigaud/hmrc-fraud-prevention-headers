import { strict as assert } from "node:assert";
import { test } from "node:test";
import { hashLicenseKey } from "../src/license.js";

test("hashLicenseKey is uppercase SHA-256 hex", () => {
  assert.equal(
    hashLicenseKey("abc"),
    "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD",
  );
});
