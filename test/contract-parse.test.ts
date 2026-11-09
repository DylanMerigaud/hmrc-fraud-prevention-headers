import { strict as assert } from "node:assert";
import { test } from "node:test";
import { headingHeaders, newestVersion } from "../contract/parse.js";

test("headingHeaders reads the Gov-* h3 headings in page order and ignores body mentions", () => {
  const html = `<main><p>Check Gov-Client-Public-Port first.</p>
    <ol><li><h3 class="govuk-heading-s">Gov-Client-Connection-Method</h3><p>x</p></li>
    <li><h3><span>Gov-Client-Device-ID</span></h3><p>see Gov-Vendor-Public-IP</p></li>
    <li><h3>Missing header data</h3></li></ol></main>`;
  assert.deepEqual(headingHeaders(html), ["Gov-Client-Connection-Method", "Gov-Client-Device-ID"]);
});

test("newestVersion picks the highest version the change log names", () => {
  const html =
    "<h2>Version 3.2</h2><h2>Version 3.3</h2><p>27 January 2025</p><h2>Version 3.10</h2>";
  assert.equal(newestVersion(html), "3.10");
  assert.equal(newestVersion("<p>nothing</p>"), undefined);
});
