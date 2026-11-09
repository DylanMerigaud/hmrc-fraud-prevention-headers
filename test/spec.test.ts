import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CONNECTION_METHODS,
  HEADER_NAMES,
  REQUIRED_HEADERS,
  SPEC_VERSION,
  TOLERATED_HEADERS,
  isViaServer,
} from "../src/spec.js";

const WEB = [
  "Gov-Client-Connection-Method",
  "Gov-Client-Browser-JS-User-Agent",
  "Gov-Client-Device-ID",
  "Gov-Client-Multi-Factor",
  "Gov-Client-Public-IP",
  "Gov-Client-Public-IP-Timestamp",
  "Gov-Client-Public-Port",
  "Gov-Client-Screens",
  "Gov-Client-Timezone",
  "Gov-Client-User-IDs",
  "Gov-Client-Window-Size",
  "Gov-Vendor-Forwarded",
  "Gov-Vendor-License-IDs",
  "Gov-Vendor-Product-Name",
  "Gov-Vendor-Public-IP",
  "Gov-Vendor-Version",
];
const DESKTOP_DIRECT = [
  "Gov-Client-Connection-Method",
  "Gov-Client-Device-ID",
  "Gov-Client-Local-IPs",
  "Gov-Client-Local-IPs-Timestamp",
  "Gov-Client-MAC-Addresses",
  "Gov-Client-Multi-Factor",
  "Gov-Client-Screens",
  "Gov-Client-Timezone",
  "Gov-Client-User-Agent",
  "Gov-Client-User-IDs",
  "Gov-Client-Window-Size",
  "Gov-Vendor-License-IDs",
  "Gov-Vendor-Product-Name",
  "Gov-Vendor-Version",
];
const DESKTOP_SERVER = [
  "Gov-Client-Connection-Method",
  "Gov-Client-Device-ID",
  "Gov-Client-Local-IPs",
  "Gov-Client-Local-IPs-Timestamp",
  "Gov-Client-MAC-Addresses",
  "Gov-Client-Multi-Factor",
  "Gov-Client-Public-IP",
  "Gov-Client-Public-IP-Timestamp",
  "Gov-Client-Public-Port",
  "Gov-Client-Screens",
  "Gov-Client-Timezone",
  "Gov-Client-User-Agent",
  "Gov-Client-User-IDs",
  "Gov-Client-Window-Size",
  "Gov-Vendor-Forwarded",
  "Gov-Vendor-License-IDs",
  "Gov-Vendor-Product-Name",
  "Gov-Vendor-Public-IP",
  "Gov-Vendor-Version",
];
const MOBILE_DIRECT = [
  "Gov-Client-Connection-Method",
  "Gov-Client-Device-ID",
  "Gov-Client-Local-IPs",
  "Gov-Client-Local-IPs-Timestamp",
  "Gov-Client-Multi-Factor",
  "Gov-Client-Screens",
  "Gov-Client-Timezone",
  "Gov-Client-User-Agent",
  "Gov-Client-User-IDs",
  "Gov-Client-Window-Size",
  "Gov-Vendor-License-IDs",
  "Gov-Vendor-Product-Name",
  "Gov-Vendor-Version",
];
const MOBILE_SERVER = [
  "Gov-Client-Connection-Method",
  "Gov-Client-Device-ID",
  "Gov-Client-Local-IPs",
  "Gov-Client-Local-IPs-Timestamp",
  "Gov-Client-Multi-Factor",
  "Gov-Client-Public-IP",
  "Gov-Client-Public-IP-Timestamp",
  "Gov-Client-Public-Port",
  "Gov-Client-Screens",
  "Gov-Client-Timezone",
  "Gov-Client-User-Agent",
  "Gov-Client-User-IDs",
  "Gov-Client-Window-Size",
  "Gov-Vendor-Forwarded",
  "Gov-Vendor-License-IDs",
  "Gov-Vendor-Product-Name",
  "Gov-Vendor-Public-IP",
  "Gov-Vendor-Version",
];
const BATCH = [
  "Gov-Client-Connection-Method",
  "Gov-Client-Device-ID",
  "Gov-Client-Local-IPs",
  "Gov-Client-Local-IPs-Timestamp",
  "Gov-Client-MAC-Addresses",
  "Gov-Client-Timezone",
  "Gov-Client-User-Agent",
  "Gov-Client-User-IDs",
  "Gov-Vendor-License-IDs",
  "Gov-Vendor-Product-Name",
  "Gov-Vendor-Version",
];
const OTHER_DIRECT = [
  "Gov-Client-Connection-Method",
  "Gov-Client-Device-ID",
  "Gov-Client-Local-IPs",
  "Gov-Client-Local-IPs-Timestamp",
  "Gov-Client-MAC-Addresses",
  "Gov-Client-Multi-Factor",
  "Gov-Client-Timezone",
  "Gov-Client-User-Agent",
  "Gov-Client-User-IDs",
  "Gov-Vendor-License-IDs",
  "Gov-Vendor-Product-Name",
  "Gov-Vendor-Version",
];
const OTHER_SERVER = [
  "Gov-Client-Connection-Method",
  "Gov-Client-Device-ID",
  "Gov-Client-Local-IPs",
  "Gov-Client-Local-IPs-Timestamp",
  "Gov-Client-MAC-Addresses",
  "Gov-Client-Multi-Factor",
  "Gov-Client-Public-IP",
  "Gov-Client-Public-IP-Timestamp",
  "Gov-Client-Public-Port",
  "Gov-Client-Timezone",
  "Gov-Client-User-Agent",
  "Gov-Client-User-IDs",
  "Gov-Vendor-Forwarded",
  "Gov-Vendor-License-IDs",
  "Gov-Vendor-Product-Name",
  "Gov-Vendor-Public-IP",
  "Gov-Vendor-Version",
];

const EXPECTED: Array<[string, string[], number]> = [
  ["WEB_APP_VIA_SERVER", WEB, 16],
  ["DESKTOP_APP_DIRECT", DESKTOP_DIRECT, 14],
  ["DESKTOP_APP_VIA_SERVER", DESKTOP_SERVER, 19],
  ["MOBILE_APP_DIRECT", MOBILE_DIRECT, 13],
  ["MOBILE_APP_VIA_SERVER", MOBILE_SERVER, 18],
  ["BATCH_PROCESS_DIRECT", BATCH, 11],
  ["OTHER_DIRECT", OTHER_DIRECT, 12],
  ["OTHER_VIA_SERVER", OTHER_SERVER, 17],
];

test("spec version and method list", () => {
  assert.equal(SPEC_VERSION, "3.3");
  assert.deepEqual(
    [...CONNECTION_METHODS],
    EXPECTED.map(([m]) => m),
  );
});

test("required headers per method match SPEC.md section 3", () => {
  for (const [method, headers, count] of EXPECTED) {
    const actual = REQUIRED_HEADERS[method as keyof typeof REQUIRED_HEADERS];
    assert.equal(actual.length, count, method);
    assert.deepEqual([...actual], headers, method);
    assert.equal(actual[0], "Gov-Client-Connection-Method", method);
  }
});

test("header names cover the 20 headers of the matrix", () => {
  assert.equal(HEADER_NAMES.length, 20);
  assert.equal(new Set(HEADER_NAMES).size, 20);
  for (const [, headers] of EXPECTED) {
    for (const h of headers) assert.ok((HEADER_NAMES as readonly string[]).includes(h), h);
  }
});

test("tolerated headers per connection method", () => {
  assert.deepEqual(TOLERATED_HEADERS, {
    WEB_APP_VIA_SERVER: [
      "Gov-Client-Browser-Plugins",
      "Gov-Client-Local-IPs",
      "Gov-Client-Local-IPs-Timestamp",
      "Gov-Client-Browser-Do-Not-Track",
    ],
    DESKTOP_APP_DIRECT: [],
    DESKTOP_APP_VIA_SERVER: [],
    MOBILE_APP_DIRECT: ["Gov-Client-MAC-Addresses"],
    MOBILE_APP_VIA_SERVER: ["Gov-Client-MAC-Addresses"],
    BATCH_PROCESS_DIRECT: [],
    OTHER_DIRECT: [],
    OTHER_VIA_SERVER: [],
  });
});

test("isViaServer", () => {
  assert.equal(isViaServer("OTHER_VIA_SERVER"), true);
  assert.equal(isViaServer("BATCH_PROCESS_DIRECT"), false);
});
