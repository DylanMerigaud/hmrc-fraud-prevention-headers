import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fromExpress } from "../src/adapters/express.js";
import { fromFastify } from "../src/adapters/fastify.js";
import { fromHono } from "../src/adapters/hono.js";
import { requestFraudData } from "../src/request.js";

const at = new Date("2020-09-21T14:30:05.123Z");
const headers = { "x-forwarded-for": "1.1.1.1, 81.2.69.142", "x-client-port": "51123" };
const options = {
  trustedProxies: 1,
  clientPortHeader: "x-client-port",
  vendorPublicIp: "203.0.113.6",
};
const expected = requestFraudData(
  { remoteAddress: "10.0.0.5", remotePort: 4000, headers, receivedAt: at },
  options,
);

// receivedAt is not an adapter input, so compare everything but the timestamp.
function strip<T extends { publicIpTimestamp: string }>(d: T): Omit<T, "publicIpTimestamp"> {
  const { publicIpTimestamp, ...rest } = d;
  assert.match(publicIpTimestamp, /^\d{4}-/);
  return rest;
}

test("express reads req.socket and req.headers", () => {
  const r = fromExpress(
    { socket: { remoteAddress: "10.0.0.5", remotePort: 4000 }, headers },
    options,
  );
  assert.deepEqual(strip(r), strip(expected));
  assert.equal(r.publicIp, "81.2.69.142");
  assert.equal(r.publicPort, 51123);
});

test("express falls back to req.connection and tolerates no socket", () => {
  const r = fromExpress({
    connection: { remoteAddress: "::ffff:81.2.69.142", remotePort: 51123 },
    headers: {},
  });
  assert.equal(r.publicIp, "81.2.69.142");
  assert.equal(r.publicPort, 51123);
  assert.equal(fromExpress({ headers: {} }).publicIp, undefined);
});

test("fastify reads request.raw.socket and request.headers", () => {
  const r = fromFastify(
    { raw: { socket: { remoteAddress: "10.0.0.5", remotePort: 4000 } }, headers },
    options,
  );
  assert.deepEqual(strip(r), strip(expected));
  assert.equal(fromFastify({ raw: {}, headers: {} }).publicIp, undefined);
});

test("hono reads raw Headers and connInfo", () => {
  const r = fromHono(
    { req: { raw: { headers: new Headers(headers) } } },
    { ...options, connInfo: { remote: { address: "10.0.0.5", port: 4000 } } },
  );
  assert.deepEqual(strip(r), strip(expected));
  const direct = fromHono(
    { req: { raw: { headers: new Headers() } } },
    { connInfo: { remote: { address: "81.2.69.142", port: 51123 } } },
  );
  assert.equal(direct.publicIp, "81.2.69.142");
  assert.equal(direct.publicPort, 51123);
  assert.equal(fromHono({ req: { raw: { headers: new Headers() } } }).publicIp, undefined);
});

test("hono without connInfo behind trusted proxies gives no public IP or port", () => {
  const r = fromHono(
    {
      req: {
        raw: {
          headers: new Headers({
            "x-forwarded-for": "6.6.6.6, 81.2.69.142",
            "x-client-port": "51123",
          }),
        },
      },
    },
    { trustedProxies: 1, clientPortHeader: "x-client-port" },
  );
  assert.equal(r.publicIp, undefined);
  assert.equal(r.publicPort, undefined);
});
