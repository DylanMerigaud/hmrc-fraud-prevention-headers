import { strict as assert } from "node:assert";
import { test } from "node:test";
import { requestFraudData } from "../src/request.js";

const at = new Date("2020-09-21T14:30:05.123Z");

test("socket ::ffff: address becomes IPv4 with its port", () => {
  const r = requestFraudData(
    { remoteAddress: "::ffff:81.2.69.142", remotePort: 51123, headers: {}, receivedAt: at },
    {},
  );
  assert.equal(r.publicIp, "81.2.69.142");
  assert.equal(r.publicPort, 51123);
});

test("trustedProxies 1 takes the entry one from the right, ignoring a spoofed first entry", () => {
  const facts = {
    remoteAddress: "10.0.0.5",
    remotePort: 4000,
    headers: { "X-Forwarded-For": "1.1.1.1, 81.2.69.142" },
  };
  assert.equal(requestFraudData(facts, { trustedProxies: 1 }).publicIp, "81.2.69.142");
  assert.equal(requestFraudData(facts, { trustedProxies: 0 }).publicIp, "10.0.0.5");
  assert.equal(requestFraudData(facts).publicIp, "10.0.0.5");
});

test("trustedProxies 2 with a proxy chain, clamped to the first entry when too large", () => {
  const facts = {
    remoteAddress: "10.0.0.5",
    headers: { "x-forwarded-for": ["81.2.69.142", "10.1.1.1"] },
  };
  assert.equal(requestFraudData(facts, { trustedProxies: 2 }).publicIp, "81.2.69.142");
  assert.equal(requestFraudData(facts, { trustedProxies: 9 }).publicIp, "81.2.69.142");
});

test("array header values are joined, empty entries ignored, brackets and mapped prefix normalized", () => {
  const r = requestFraudData(
    {
      remoteAddress: "10.0.0.5",
      headers: { "X-FORWARDED-FOR": [" , [2a00:1450::1]", "::ffff:81.2.69.142 ,"] },
    },
    { trustedProxies: 1 },
  );
  assert.equal(r.publicIp, "81.2.69.142");
});

test("garbage at the trusted position gives no public IP", () => {
  const r = requestFraudData(
    { remoteAddress: "10.0.0.5", headers: { "x-forwarded-for": "not-an-ip, 81.2.69.142" } },
    { trustedProxies: 2 },
  );
  assert.equal(r.publicIp, undefined);
  assert.equal(requestFraudData({ remoteAddress: "garbage", headers: {} }).publicIp, undefined);
});

test("no socket address and no XFF gives no public IP, never throws", () => {
  const r = requestFraudData({ headers: {} });
  assert.equal(r.publicIp, undefined);
  assert.equal(r.publicPort, undefined);
  assert.match(r.publicIpTimestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.doesNotThrow(() =>
    requestFraudData(
      { headers: { "x-forwarded-for": undefined, "x-client-port": [] } },
      { trustedProxies: 3, clientPortHeader: "X-Client-Port" },
    ),
  );
});

test("behind a proxy the socket port is not the client's: undefined without clientPortHeader", () => {
  const r = requestFraudData(
    { remoteAddress: "10.0.0.5", remotePort: 4000, headers: { "x-forwarded-for": "81.2.69.142" } },
    { trustedProxies: 1 },
  );
  assert.equal(r.publicIp, "81.2.69.142");
  assert.equal(r.publicPort, undefined);
});

test("clientPortHeader: valid digits, invalid values", () => {
  const base = { remoteAddress: "10.0.0.5", headers: {} as Record<string, string> };
  const port = (v: string) =>
    requestFraudData(
      { ...base, headers: { "x-forwarded-for": "81.2.69.142", "x-client-port": v } },
      { trustedProxies: 1, clientPortHeader: "x-client-port" },
    ).publicPort;
  assert.equal(port("51123"), 51123);
  assert.equal(port("abc"), undefined);
  assert.equal(port("0"), undefined);
  assert.equal(port("65536"), undefined);
  assert.equal(port("12.5"), undefined);
  assert.equal(port("-3"), undefined);
  assert.equal(port("1e3"), undefined);
  assert.equal(port(""), undefined);
  assert.equal(port("65535"), 65535);
});

test("receivedAt passes through and defaults to now", () => {
  assert.equal(
    requestFraudData({ headers: {}, receivedAt: at }).publicIpTimestamp,
    "2020-09-21T14:30:05.123Z",
  );
  const before = Date.now();
  const t = Date.parse(requestFraudData({ headers: {} }).publicIpTimestamp);
  assert.ok(t >= before && t <= Date.now());
});

test("vendor chain from vendorPublicIp and forwardedServers", () => {
  const facts = { remoteAddress: "81.2.69.142", remotePort: 51123, headers: {} };
  const one = requestFraudData(facts, { vendorPublicIp: "203.0.113.6" });
  assert.equal(one.vendorPublicIp, "203.0.113.6");
  assert.deepEqual(one.vendorForwarded, [{ by: "203.0.113.6", for: "81.2.69.142" }]);
  const two = requestFraudData(facts, {
    vendorPublicIp: "203.0.113.6",
    forwardedServers: ["176.30.57.118"],
  });
  assert.deepEqual(two.vendorForwarded, [
    { by: "203.0.113.6", for: "81.2.69.142" },
    { by: "176.30.57.118", for: "203.0.113.6" },
  ]);
  const none = requestFraudData({ headers: {} }, { vendorPublicIp: "203.0.113.6" });
  assert.equal(none.vendorPublicIp, "203.0.113.6");
  assert.equal(none.vendorForwarded, undefined);
  assert.equal(requestFraudData(facts).vendorForwarded, undefined);
});

test("trustedProxies without a socket address gives no public IP or port: the window cannot shift onto a client entry", () => {
  const r = requestFraudData(
    { headers: { "x-forwarded-for": "6.6.6.6, 81.2.69.142", "x-client-port": "51123" } },
    { trustedProxies: 1, clientPortHeader: "x-client-port" },
  );
  assert.equal(r.publicIp, undefined);
  assert.equal(r.publicPort, undefined);
  const blank = requestFraudData(
    { remoteAddress: " ", headers: { "x-forwarded-for": "6.6.6.6, 81.2.69.142" } },
    { trustedProxies: 1 },
  );
  assert.equal(blank.publicIp, undefined);
});

test("an X-Forwarded-For entry with a port gives the IP, and the port of the chosen entry", () => {
  const ipv4 = requestFraudData(
    {
      remoteAddress: "10.0.0.5",
      remotePort: 4000,
      headers: { "x-forwarded-for": "6.6.6.6:1, 81.2.69.142:51123" },
    },
    { trustedProxies: 1 },
  );
  assert.equal(ipv4.publicIp, "81.2.69.142");
  assert.equal(ipv4.publicPort, 51123);
  const ipv6 = requestFraudData(
    { remoteAddress: "10.0.0.5", headers: { "x-forwarded-for": "[2a00:1450::1]:51123" } },
    { trustedProxies: 1 },
  );
  assert.equal(ipv6.publicIp, "2a00:1450::1");
  assert.equal(ipv6.publicPort, 51123);
  const bare = requestFraudData(
    { remoteAddress: "10.0.0.5", headers: { "x-forwarded-for": "2a00:1450::1" } },
    { trustedProxies: 1 },
  );
  assert.equal(bare.publicIp, "2a00:1450::1");
  assert.equal(bare.publicPort, undefined);
  const header = requestFraudData(
    {
      remoteAddress: "10.0.0.5",
      headers: { "x-forwarded-for": "81.2.69.142:51123", "x-client-port": "40000" },
    },
    { trustedProxies: 1, clientPortHeader: "x-client-port" },
  );
  assert.equal(header.publicIp, "81.2.69.142");
  assert.equal(header.publicPort, 40000);
  const badPort = requestFraudData(
    { remoteAddress: "10.0.0.5", headers: { "x-forwarded-for": "81.2.69.142:0" } },
    { trustedProxies: 1 },
  );
  assert.equal(badPort.publicIp, "81.2.69.142");
  assert.equal(badPort.publicPort, undefined);
});
