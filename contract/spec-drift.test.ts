/**
 * Live contract: HMRC's published guide still describes the headers this library implements.
 *
 * Run weekly by .github/workflows/contract.yml (never by `npm test`). A red run means HMRC
 * changed the specification: update docs/SPEC.md, src/spec.ts and the golden fixtures.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CONNECTION_METHODS,
  type ConnectionMethod,
  REQUIRED_HEADERS,
  SPEC_VERSION,
} from "../src/spec.js";
import { headingHeaders, newestVersion } from "./parse.js";

const GUIDE = "https://developer.service.hmrc.gov.uk/guides/fraud-prevention";

function slug(method: ConnectionMethod): string {
  return method.toLowerCase().replace(/_/g, "-");
}

async function page(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "hmrc-fraud-prevention-headers contract test" },
  });
  assert.equal(res.status, 200, `${url} answered ${res.status}`);
  return res.text();
}

for (const method of CONNECTION_METHODS) {
  test(`${method}: the HMRC page lists the same headers in the same order`, async () => {
    const html = await page(`${GUIDE}/connection-method/${slug(method)}/`);
    const listed = headingHeaders(html);
    assert.ok(listed.length > 0, "no Gov-* heading found: the page structure changed");
    assert.deepEqual(listed, [...REQUIRED_HEADERS[method]]);
  });
}

test("the change log's newest version is the one implemented", async () => {
  const html = await page(`${GUIDE}/change-log/`);
  assert.equal(newestVersion(html), SPEC_VERSION);
});
