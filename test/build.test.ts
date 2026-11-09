import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  type FraudPreventionInput,
  InvalidFraudHeadersError,
  MissingFraudDataError,
  buildForwardedChain,
  buildFraudPreventionHeaders,
} from "../src/build.js";
import { decodeKeyValue } from "../src/encoding.js";
import { sameIp } from "../src/ip.js";
import { CONNECTION_METHODS, type ConnectionMethod, REQUIRED_HEADERS } from "../src/spec.js";
import { validateFraudPreventionHeaders } from "../src/validate.js";
import { SPEC_EXAMPLES } from "./fixtures/spec-examples.js";

const deviceId = "beec798b-b366-47fa-b1f8-92cede14a1ce";
const timestamp = "2020-09-21T14:30:05.123Z";
const multiFactor = [
  {
    type: "AUTH_CODE",
    timestamp: "2021-11-21T13:23Z",
    uniqueReference: "fc4b5fd6816f75a7c81fc8eaa9499d6a299bd803397166e8c4cf9280b801d62c",
  },
  {
    type: "TOTP",
    timestamp: "2021-11-21T13:20Z",
    uniqueReference: "0283da60063abfb3a87f1aed845d17fe2d9ba8c780b478dc4ae048f5ee97a6d5",
  },
] as const;
const desktopScreens = [
  { width: 1920, height: 1080, scalingFactor: 1, colourDepth: 16 },
  { width: 3000, height: 2000, scalingFactor: 1.25, colourDepth: 16 },
];
const mobileScreens = [{ width: 375, height: 812, scalingFactor: 2, colourDepth: 32 }];
const windowsAgent = {
  osFamily: "Windows",
  osVersion: "Server 2012",
  deviceManufacturer: "Dell Inc.",
  deviceModel: "OptiPlex 980",
};
const iosAgent = {
  osFamily: "iOS",
  osVersion: "13.3.1",
  deviceManufacturer: "Apple",
  deviceModel: "iPhone12,3",
};
const license = {
  "my-licensed-software": "8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1",
};
const common = {
  deviceId,
  timezone: "UTC+00:00",
  vendorLicenseIds: license,
  vendorProductName: "Product Name",
};
const client = {
  localIps: ["fc00::", "10.1.2.3"],
  localIpsTimestamp: timestamp,
  macAddresses: ["ea:43:1a:5d:21:45", "10:12:cc:fa:aa:32"],
};
const server = {
  publicIp: "198.51.100.0",
  publicIpTimestamp: timestamp,
  publicPort: 12345,
  vendorPublicIp: "203.0.113.6",
  vendorForwarded: [{ by: "203.0.113.6", for: "198.51.100.0" }],
};

const INPUTS: Record<ConnectionMethod, FraudPreventionInput> = {
  WEB_APP_VIA_SERVER: {
    ...common,
    ...server,
    connectionMethod: "WEB_APP_VIA_SERVER",
    browserUserAgent:
      "Mozilla/5.0 (iPad; U; CPU OS 3_2_1 like Mac OS X; en-us) AppleWebKit/531.21.10 (KHTML, like Gecko) Mobile/7B405",
    multiFactor,
    screens: desktopScreens,
    userIds: { "my-application": "alice123" },
    windowSize: { width: 1256, height: 803 },
    vendorVersion: { "my-web-app": "2.2.2" },
  },
  DESKTOP_APP_DIRECT: {
    ...common,
    ...client,
    connectionMethod: "DESKTOP_APP_DIRECT",
    multiFactor,
    screens: desktopScreens,
    userAgent: windowsAgent,
    userIds: { os: "domain\\alice" },
    windowSize: { width: 1256, height: 803 },
    vendorVersion: { "my-application": "1.6.0" },
  },
  DESKTOP_APP_VIA_SERVER: {
    ...common,
    ...client,
    ...server,
    connectionMethod: "DESKTOP_APP_VIA_SERVER",
    multiFactor,
    screens: desktopScreens,
    userAgent: windowsAgent,
    userIds: { os: "domain\\alice", "my-application": "alice123" },
    windowSize: { width: 1256, height: 803 },
    vendorVersion: { "my-desktop-app": "2.2.2", "my-serverside-code": "v3.8" },
  },
  MOBILE_APP_DIRECT: {
    ...common,
    localIps: client.localIps,
    localIpsTimestamp: timestamp,
    connectionMethod: "MOBILE_APP_DIRECT",
    multiFactor,
    screens: mobileScreens,
    userAgent: iosAgent,
    userIds: { "my-application": "alice123" },
    windowSize: { width: 375, height: 812 },
    vendorVersion: { "my-application": "1.6.0" },
  },
  MOBILE_APP_VIA_SERVER: {
    ...common,
    ...server,
    localIps: client.localIps,
    localIpsTimestamp: timestamp,
    connectionMethod: "MOBILE_APP_VIA_SERVER",
    multiFactor,
    screens: mobileScreens,
    userAgent: iosAgent,
    userIds: { "my-application": "alice123" },
    windowSize: { width: 375, height: 812 },
    vendorVersion: { "my-mobile-app": "2.2.2", "my-serverside-code": "v3.8" },
  },
  BATCH_PROCESS_DIRECT: {
    ...common,
    ...client,
    connectionMethod: "BATCH_PROCESS_DIRECT",
    userAgent: windowsAgent,
    userIds: { os: "domain\\alice", "my-application": "alice123" },
    vendorVersion: { "my-application": "1.6.0" },
  },
  OTHER_DIRECT: {
    ...common,
    ...client,
    connectionMethod: "OTHER_DIRECT",
    multiFactor,
    userAgent: windowsAgent,
    userIds: { os: "domain\\alice", "my-application": "alice123" },
    vendorVersion: { "my-application": "1.6.0" },
  },
  OTHER_VIA_SERVER: {
    ...common,
    ...client,
    ...server,
    connectionMethod: "OTHER_VIA_SERVER",
    multiFactor,
    userAgent: windowsAgent,
    userIds: { os: "alice", "my-application": "alice123" },
    vendorVersion: { "my-frontend-app": "2.2.2", "my-serverside-code": "v3.8" },
  },
};

for (const method of CONNECTION_METHODS) {
  test(`golden: ${method} reproduces the specification example`, () => {
    const built = buildFraudPreventionHeaders(INPUTS[method], { validate: false });
    assert.deepEqual(built, SPEC_EXAMPLES[method]);
    assert.deepEqual(Object.keys(built), REQUIRED_HEADERS[method]);
  });
}

const webReal: FraudPreventionInput = {
  ...INPUTS.WEB_APP_VIA_SERVER,
  publicIp: "81.2.69.142",
  publicPort: 51123,
  vendorPublicIp: "81.2.69.160",
  vendorForwarded: [{ by: "81.2.69.160", for: "81.2.69.142" }],
};

test("realistic WEB input validates as VALID_HEADERS", () => {
  const built = buildFraudPreventionHeaders(webReal);
  assert.equal(validateFraudPreventionHeaders(built).code, "VALID_HEADERS");
});

test("missing public port throws MissingFraudDataError naming it", () => {
  const { publicPort: _omitted, ...rest } = webReal;
  assert.throws(
    () => buildFraudPreventionHeaders(rest),
    (e: unknown) => {
      assert.ok(e instanceof MissingFraudDataError);
      assert.deepEqual(e.headers, ["Gov-Client-Public-Port"]);
      assert.match(e.message, /Gov-Client-Public-Port/);
      assert.match(e.message, /`unavailable`/);
      return true;
    },
  );
});

test("every missing header is listed in one error", () => {
  assert.throws(
    () => buildFraudPreventionHeaders({ connectionMethod: "BATCH_PROCESS_DIRECT" }),
    (e: unknown) => {
      assert.ok(e instanceof MissingFraudDataError);
      assert.deepEqual(
        e.headers,
        REQUIRED_HEADERS.BATCH_PROCESS_DIRECT.filter((h) => h !== "Gov-Client-Connection-Method"),
      );
      for (const h of e.headers) assert.ok(e.message.includes(h));
      return true;
    },
  );
});

test("unavailable omit leaves the header out, empty sends an empty value", () => {
  const { publicPort: _omitted, ...rest } = webReal;
  const omitted = buildFraudPreventionHeaders({
    ...rest,
    unavailable: { "Gov-Client-Public-Port": "omit" },
  });
  assert.equal("Gov-Client-Public-Port" in omitted, false);
  const empty = buildFraudPreventionHeaders({
    ...rest,
    unavailable: { "Gov-Client-Public-Port": "empty" },
  });
  assert.equal(empty["Gov-Client-Public-Port"], "");
});

test("a bad timezone throws InvalidFraudHeadersError", () => {
  assert.throws(
    () => buildFraudPreventionHeaders({ ...webReal, timezone: "GMT" }),
    (e: unknown) => {
      assert.ok(e instanceof InvalidFraudHeadersError);
      assert.deepEqual(e.result.errors?.[0]?.headers, ["gov-client-timezone"]);
      return true;
    },
  );
});

test("a field of another method is not emitted", () => {
  const built = buildFraudPreventionHeaders(
    { ...webReal, macAddresses: ["ea:43:1a:5d:21:45"] },
    { validate: false },
  );
  assert.equal("Gov-Client-MAC-Addresses" in built, false);
});

test("Multi-Factor keeps given precision for matching strings, normalizes the rest", () => {
  const built = buildFraudPreventionHeaders(
    {
      ...webReal,
      multiFactor: [
        { type: "TOTP", timestamp: "2021-11-21T13:20:05Z", uniqueReference: "abc" },
        { type: "TOTP", timestamp: new Date("2021-11-21T13:20:05Z"), uniqueReference: "def" },
        { type: "OTHER", timestamp: "2021-11-21T14:20:05+01:00", uniqueReference: "ghi" },
      ],
    },
    { validate: false },
  );
  assert.equal(
    built["Gov-Client-Multi-Factor"],
    "type=TOTP&timestamp=2021-11-21T13%3A20%3A05Z&unique-reference=abc,type=TOTP&timestamp=2021-11-21T13%3A20%3A05.000Z&unique-reference=def,type=OTHER&timestamp=2021-11-21T13%3A20%3A05.000Z&unique-reference=ghi",
  );
});

test("Public-IP is normalized but never re-cased or compressed", () => {
  const built = buildFraudPreventionHeaders(
    { ...webReal, publicIp: "[2001:0DB8:0:0:0:0:0:1]", vendorPublicIp: "::ffff:81.2.69.160" },
    { validate: false },
  );
  assert.equal(built["Gov-Client-Public-IP"], "2001:0DB8:0:0:0:0:0:1");
  assert.equal(built["Gov-Vendor-Public-IP"], "81.2.69.160");
});

test("a user id a&b=c round-trips", () => {
  const built = buildFraudPreventionHeaders(
    { ...webReal, userIds: { "my-application": "a&b=c" } },
    { validate: false },
  );
  assert.deepEqual(decodeKeyValue(built["Gov-Client-User-IDs"]), [["my-application", "a&b=c"]]);
});

test("buildForwardedChain links each server to the one before it", () => {
  const chain = buildForwardedChain("198.51.100.0", [
    "2001:db8:85a3::8a2e:370:7334",
    "203.0.113.6",
    "176.30.57.118",
  ]);
  assert.deepEqual(chain, [
    { by: "2001:db8:85a3::8a2e:370:7334", for: "198.51.100.0" },
    { by: "203.0.113.6", for: "2001:db8:85a3::8a2e:370:7334" },
    { by: "176.30.57.118", for: "203.0.113.6" },
  ]);
  assert.ok(sameIp(chain[0]?.by ?? "", "2001:0db8:85a3:0000:0000:8a2e:0370:7334"));
});

test("buildForwardedChain throws on an empty server list", () => {
  assert.throws(() => buildForwardedChain("198.51.100.0", []));
});

test("an unknown connection method throws a TypeError naming the eight methods", () => {
  assert.throws(
    () => buildFraudPreventionHeaders({ connectionMethod: "WEB_APP" as never }),
    (e: unknown) => e instanceof TypeError && /WEB_APP_VIA_SERVER/.test((e as Error).message),
  );
});

test("Multi-Factor rejects an impossible calendar date", () => {
  for (const timestamp of ["2021-02-30T13:23Z", "2021-04-31T13:23:05Z", "2021-11-21T13:23"]) {
    assert.throws(
      () =>
        buildFraudPreventionHeaders(
          { ...webReal, multiFactor: [{ type: "TOTP", timestamp, uniqueReference: "abc" }] },
          { validate: false },
        ),
      RangeError,
      timestamp,
    );
  }
});

test("Browser-JS-User-Agent percent-encodes control characters, so no header injection", () => {
  const built = buildFraudPreventionHeaders(
    { ...webReal, browserUserAgent: "Mozilla\r\nX-Evil: 1\u0000\u001f\u007f\t" },
    { validate: false },
  );
  assert.equal(built["Gov-Client-Browser-JS-User-Agent"], "Mozilla%0D%0AX-Evil: 1%00%1F%7F%09");
});
