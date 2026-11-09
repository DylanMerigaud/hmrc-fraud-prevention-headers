import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  FraudHeaderFormatError,
  decodeKeyValue,
  decodeKeyValueList,
  decodeList,
  encodeKeyValue,
  encodeKeyValueList,
  encodeList,
  percentDecode,
  percentEncode,
} from "../src/encoding.js";

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXTRA = ["é", "中", "😀"];

function randomString(rand: () => number, minLength: number): string {
  const length = minLength + Math.floor(rand() * 12);
  let out = "";
  for (let i = 0; i < length; i++) {
    if (rand() < 0.1) {
      out += EXTRA[Math.floor(rand() * EXTRA.length)] as string;
    } else {
      out += String.fromCharCode(0x20 + Math.floor(rand() * (0x7e - 0x20 + 1)));
    }
  }
  return out;
}

test("percentEncode follows RFC 3986 with uppercase hex", () => {
  assert.equal(percentEncode("Product Name"), "Product%20Name");
  assert.equal(percentEncode("domain\\alice"), "domain%5Calice");
  assert.equal(percentEncode("iPhone12,3"), "iPhone12%2C3");
  assert.equal(percentEncode("fc00::"), "fc00%3A%3A");
  assert.equal(percentEncode("Dell Inc."), "Dell%20Inc.");
  assert.equal(percentEncode("é"), "%C3%A9");
  assert.equal(percentEncode("a!'()*"), "a%21%27%28%29%2A");
});

test("encodeKeyValue joins encoded pairs", () => {
  assert.equal(
    encodeKeyValue({
      "os-family": "Windows",
      "os-version": "Server 2012",
      "device-manufacturer": "Dell Inc.",
      "device-model": "OptiPlex 980",
    }),
    "os-family=Windows&os-version=Server%202012&device-manufacturer=Dell%20Inc.&device-model=OptiPlex%20980",
  );
  assert.equal(
    encodeKeyValue([
      ["width", 1920],
      ["scaling-factor", 1.25],
    ]),
    "width=1920&scaling-factor=1.25",
  );
});

test("encodeKeyValueList joins structures with commas", () => {
  assert.equal(
    encodeKeyValueList([
      { by: "203.0.113.6", for: "198.51.100.0" },
      { by: "a:b", for: "c" },
    ]),
    "by=203.0.113.6&for=198.51.100.0,by=a%3Ab&for=c",
  );
});

test("encodeList encodes values and rejects empty ones", () => {
  assert.equal(encodeList(["fc00::", "10.1.2.3"]), "fc00%3A%3A,10.1.2.3");
  assert.throws(() => encodeList([""]), FraudHeaderFormatError);
});

test("percentDecode rejects malformed escapes", () => {
  assert.throws(() => percentDecode("%G1"), FraudHeaderFormatError);
  assert.throws(() => percentDecode("%4"), FraudHeaderFormatError);
  assert.equal(percentDecode("%C3%A9"), "é");
});

test("decoders handle empty input and structures", () => {
  assert.deepEqual(decodeKeyValue(""), []);
  assert.deepEqual(decodeList(""), []);
  assert.deepEqual(decodeKeyValueList(""), []);
  assert.deepEqual(decodeList("fc00%3A%3A,10.1.2.3"), ["fc00::", "10.1.2.3"]);
  assert.deepEqual(decodeKeyValueList("by=a&for=b,by=c&for=d"), [
    [
      ["by", "a"],
      ["for", "b"],
    ],
    [
      ["by", "c"],
      ["for", "d"],
    ],
  ]);
});

test("property: encode and decode round trip", () => {
  const rand = mulberry32(1);
  for (let i = 0; i < 2000; i++) {
    const s = randomString(rand, 0);
    const encoded = percentEncode(s);
    assert.equal(percentDecode(encoded), s);
    assert.match(encoded, /^(?:[A-Za-z0-9\-._~]|%[0-9A-F]{2})*$/);
    const a = randomString(rand, 1);
    const b = randomString(rand, 0);
    const c = randomString(rand, 1);
    const d = randomString(rand, 0);
    assert.deepEqual(
      decodeKeyValue(
        encodeKeyValue([
          [a, b],
          [c, d],
        ]),
      ),
      [
        [a, b],
        [c, d],
      ],
    );
  }
});
