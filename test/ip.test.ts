import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  canonicalIp,
  ipVersion,
  isDocumentationIp,
  isPublicIp,
  normalizeIp,
  sameIp,
} from "../src/ip.js";

test("ipVersion", () => {
  assert.equal(ipVersion("198.51.100.0"), 4);
  assert.equal(ipVersion("ABCD:EF01:2345:6789:ABCD:EF01:2345:6789"), 6);
  assert.equal(ipVersion("::1"), 6);
  assert.equal(ipVersion("::ffff:1.2.3.4"), 6);
  assert.equal(ipVersion("256.1.1.1"), 0);
  assert.equal(ipVersion("01.2.3.4"), 0);
  assert.equal(ipVersion("fe80::1%eth0"), 0);
  assert.equal(ipVersion("1::2::3"), 0);
  assert.equal(ipVersion(""), 0);
});

test("normalizeIp", () => {
  assert.equal(normalizeIp("::ffff:81.2.69.142"), "81.2.69.142");
  assert.equal(normalizeIp("[2a00:1450::1]"), "2a00:1450::1");
  assert.equal(normalizeIp(" 1.2.3.4 "), "1.2.3.4");
  assert.equal(normalizeIp("not-an-ip"), "not-an-ip");
});

test("isPublicIp", () => {
  for (const ip of ["81.2.69.142", "2a00:1450:4009:81f::200e"])
    assert.equal(isPublicIp(ip), true, ip);
  for (const ip of [
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "127.0.0.1",
    "169.254.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fc00::1",
    "fe80::1",
    "224.0.0.1",
    "ff02::1",
    "garbage",
  ]) {
    assert.equal(isPublicIp(ip), false, ip);
  }
});

test("isDocumentationIp", () => {
  assert.equal(isDocumentationIp("203.0.113.6"), true);
  assert.equal(isDocumentationIp("198.51.100.0"), true);
  assert.equal(isDocumentationIp("192.0.2.1"), true);
  assert.equal(isDocumentationIp("2001:db8::1"), true);
  assert.equal(isDocumentationIp("81.2.69.142"), false);
});

test("canonicalIp and sameIp compare addresses whatever their spelling", () => {
  assert.equal(
    canonicalIp("2001:0DB8:85a3:0000:0000:8a2e:0370:7334"),
    "2001:db8:85a3::8a2e:370:7334",
  );
  assert.equal(canonicalIp("2001:db8:0:1:0:0:0:1"), "2001:db8:0:1::1");
  assert.equal(canonicalIp("::ffff:81.2.69.142"), "81.2.69.142");
  assert.equal(canonicalIp("2001:db8:1:1:1:1:1:1"), "2001:db8:1:1:1:1:1:1");
  assert.ok(sameIp("2001:0db8::", "2001:db8::0"));
  assert.ok(!sameIp("nope", "nope"));
});
