# hmrc-fraud-prevention-headers

[![CI](https://github.com/DylanMerigaud/hmrc-fraud-prevention-headers/actions/workflows/ci.yml/badge.svg)](https://github.com/DylanMerigaud/hmrc-fraud-prevention-headers/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/hmrc-fraud-prevention-headers.svg)](https://www.npmjs.com/package/hmrc-fraud-prevention-headers)
[![license](https://img.shields.io/npm/l/hmrc-fraud-prevention-headers.svg)](LICENSE)

Every call to an HMRC Making Tax Digital API (VAT, Income Tax Self Assessment) must carry the
fraud prevention headers: up to 19 `Gov-Client-*` and `Gov-Vendor-*` headers whose set and format
depend on how your software connects. This library builds them, collects the browser side,
reads the request side behind proxies, and validates them offline with the same codes as HMRC's
Test Fraud Prevention Headers API. It is for anyone writing MTD software in TypeScript or
JavaScript: a web app, a desktop or mobile app with or without a backend, a batch process.

It implements [HMRC fraud prevention specification v3.3](https://developer.service.hmrc.gov.uk/guides/fraud-prevention/)
(27 January 2025) for all eight connection methods. Zero dependencies, ESM and CommonJS, typed,
runs on Node 18+, Deno, Bun, edge runtimes and browsers.

## Install

```sh
npm install hmrc-fraud-prevention-headers
```

## Quick start

```js
import {
  buildFraudPreventionHeaders,
  validateFraudPreventionHeaders,
} from "hmrc-fraud-prevention-headers";

const headers = buildFraudPreventionHeaders({
  connectionMethod: "WEB_APP_VIA_SERVER",
  // collected in the browser (see "Browser collector")
  deviceId: "3f1b6c2e-8f4a-4b1e-9d2c-7a5e0c9b1d42",
  screens: [{ width: 1920, height: 1080, scalingFactor: 1, colourDepth: 24 }],
  windowSize: { width: 1256, height: 803 },
  timezone: "UTC+00:00",
  browserUserAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  // seen by your server (see "Behind a proxy")
  publicIp: "81.2.69.142",
  publicPort: 51123,
  publicIpTimestamp: new Date(),
  vendorPublicIp: "81.2.69.160",
  vendorForwarded: [{ by: "81.2.69.160", for: "81.2.69.142" }],
  // known to your application
  userIds: { "my-tax-app": "alice@example.com" },
  multiFactor: [{ type: "TOTP", timestamp: new Date(), uniqueReference: "a1b2c3d4e5f60718" }],
  vendorLicenseIds: { "my-tax-app": "8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1" },
  vendorProductName: "My Tax App",
  vendorVersion: { "my-tax-app-web": "1.4.0" },
});

console.log(headers["Gov-Client-Screens"]);
// width=1920&height=1080&scaling-factor=1&colour-depth=24
console.log(headers["Gov-Vendor-Product-Name"]);
// My%20Tax%20App
console.log(validateFraudPreventionHeaders(headers).code);
// VALID_HEADERS
```

`headers` is a plain object: pass it to `fetch`, axios or any HTTP client along with your
`Authorization` header.

## What it does

- **Builds** the exact header strings for `WEB_APP_VIA_SERVER`, `DESKTOP_APP_DIRECT`,
  `DESKTOP_APP_VIA_SERVER`, `MOBILE_APP_DIRECT`, `MOBILE_APP_VIA_SERVER`, `BATCH_PROCESS_DIRECT`,
  `OTHER_DIRECT` and `OTHER_VIA_SERVER`, in HMRC's order, with the percent encoding, key-value and
  list rules of the spec. Only the headers your connection method sends come out.
- **Refuses to invent data.** A header you have no data for throws `MissingFraudDataError`
  naming every missing header. HMRC forbids placeholders such as `null` or `unknown`; when HMRC
  has agreed that a value cannot be collected, you say so with `unavailable` (see
  "Missing data").
- **Validates offline** with the response shape and codes of HMRC's Test API
  (`VALID_HEADERS`, `INVALID_HEADERS`, `POTENTIALLY_INVALID_HEADERS`; `MISSING_HEADER`,
  `EMPTY_HEADER`, `INVALID_HEADER`, `POTENTIALLY_INVALID_HEADER`, `UNEXPECTED_HEADER`), using
  HMRC's own messages where HMRC has published them, plus the cross checks
  (`Gov-Vendor-Forwarded` against both public IPs, window against screens).
- **Reads the request side**: the client's public IP and port behind your proxies, the
  timestamp, and the `Gov-Vendor-Forwarded` hop chain, with adapters for Express, Fastify and
  Hono.
- **Collects the browser side** for `WEB_APP_VIA_SERVER`: device id (persisted), screen,
  window, timezone, user agent, as one JSON object to post to your server.
- **Helpers**: `percentEncode`, `encodeKeyValue`, `encodeList`, `formatTimestamp`,
  `formatTimezone`, `localTimezone`, `hashLicenseKey`, `buildForwardedChain`, `isPublicIp`.

## Usage

### Browser collector (WEB_APP_VIA_SERVER)

<!-- harness: skip -->
```js
import { collectBrowserFraudData } from "hmrc-fraud-prevention-headers/browser";

// Call it right before the action that reaches HMRC, and send the result with the request.
const fraudData = collectBrowserFraudData();
await fetch("/api/vat/returns", {
  method: "POST",
  headers: { "content-type": "application/json", "x-fraud-data": JSON.stringify(fraudData) },
  body: JSON.stringify(vatReturn),
});
```

`fraudData` holds `deviceId`, `screens`, `windowSize`, `timezone` and `browserUserAgent`, named
as the builder's input, so the server spreads it in. The device id is a UUID kept in
`localStorage` (key `hmrc-fph-device-id`), as HMRC asks: generated once, regenerated only if the
user clears it. Browsers expose the current screen only, so `screens` has one entry.

### Server side with Express (also Fastify and Hono)

<!-- harness: skip -->
```js
import express from "express";
import { buildFraudPreventionHeaders } from "hmrc-fraud-prevention-headers";
import { fromExpress } from "hmrc-fraud-prevention-headers/express";

const app = express();

app.post("/api/vat/returns", express.json(), async (req, res) => {
  const seen = fromExpress(req, {
    trustedProxies: 1, // one load balancer in front of this server
    clientPortHeader: "x-client-port", // set by your load balancer, see below
    vendorPublicIp: "81.2.69.160", // the public IP your DNS points at
  });
  const headers = buildFraudPreventionHeaders({
    connectionMethod: "WEB_APP_VIA_SERVER",
    ...JSON.parse(req.get("x-fraud-data")),
    ...seen,
    userIds: { "my-tax-app": req.user.email },
    multiFactor: req.user.lastTotp,
    vendorLicenseIds: { "my-tax-app": process.env.LICENSE_HASH },
    vendorProductName: "My Tax App",
    vendorVersion: { "my-tax-app-web": "1.4.0" },
  });
  const hmrc = await fetch(`https://api.service.hmrc.gov.uk/organisations/vat/${vrn}/returns`, {
    method: "POST",
    headers: { ...headers, authorization: `Bearer ${token}`, accept: "application/vnd.hmrc.1.0+json" },
    body: JSON.stringify(req.body),
  });
  res.status(hmrc.status).json(await hmrc.json());
});
```

`fromFastify(request, options)` takes a Fastify request. `fromHono(c, { ...options, connInfo:
getConnInfo(c) })` takes a Hono context and the `getConnInfo` result of your runtime's Hono
helper (`hono/bun`, `hono/deno`, `@hono/node-server/conninfo`). None of the three imports the
framework.

### Behind a proxy: public IP, port and the forwarded chain

```js
import { requestFraudData } from "hmrc-fraud-prevention-headers";

const seen = requestFraudData(
  {
    remoteAddress: "10.0.3.17", // the load balancer, as the socket sees it
    remotePort: 41000,
    headers: { "x-forwarded-for": "81.2.69.142", "x-client-port": "51123" },
  },
  { trustedProxies: 1, clientPortHeader: "x-client-port", vendorPublicIp: "81.2.69.160" },
);
console.log(seen.publicIp, seen.publicPort);
// 81.2.69.142 51123
console.log(seen.vendorForwarded);
// [ { by: '81.2.69.160', for: '81.2.69.142' } ]
```

- `trustedProxies` is how many proxies you run in front of the server. The client is read that
  many entries from the right of `X-Forwarded-For`, so an address a client wrote into the header
  itself is never taken. With `0` (the default) the socket address is the client.
- The client's TCP source port does not survive a proxy. HMRC still requires it, so make your
  edge forward it in a header (nginx: `proxy_set_header X-Client-Port $remote_port;`, HAProxy:
  `http-request set-header X-Client-Port %[src_port]`) and name that header in
  `clientPortHeader`. Without it, `publicPort` is left out and the builder reports it missing:
  it is never guessed.
- `forwardedServers` lists further public TLS-terminating hops after `vendorPublicIp`, in the
  order the request crosses them; `buildForwardedChain(clientIp, servers)` builds the same chain
  directly.

### Desktop, mobile and batch applications

```js
import { buildFraudPreventionHeaders, localTimezone } from "hmrc-fraud-prevention-headers";

const headers = buildFraudPreventionHeaders({
  connectionMethod: "MOBILE_APP_VIA_SERVER",
  deviceId: "9a7c0e55-2b7d-4c41-a3f6-0d0e4b6a8c11",
  localIps: ["10.0.0.12"],
  localIpsTimestamp: new Date(),
  multiFactor: [{ type: "AUTH_CODE", timestamp: new Date(), uniqueReference: "c0ffee5a1t3dha5h" }],
  publicIp: "81.2.69.142",
  publicIpTimestamp: new Date(),
  publicPort: 51123,
  screens: [{ width: 390, height: 844, scalingFactor: 3, colourDepth: 32 }],
  windowSize: { width: 390, height: 844 },
  timezone: localTimezone(),
  userAgent: { osFamily: "iOS", osVersion: "18.1", deviceManufacturer: "Apple", deviceModel: "iPhone14,7" },
  userIds: { "my-mobile-app": "alice123" },
  vendorPublicIp: "81.2.69.160",
  vendorForwarded: [{ by: "81.2.69.160", for: "81.2.69.142" }],
  vendorLicenseIds: { "my-mobile-app": "8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1" },
  vendorProductName: "My Mobile Tax App",
  vendorVersion: { "my-mobile-app": "2.0.0", "my-api": "5.3.1" },
});
console.log(headers["Gov-Client-User-Agent"]);
// os-family=iOS&os-version=18.1&device-manufacturer=Apple&device-model=iPhone14%2C7
```

In React Native, the values come from the platform: `Dimensions.get("screen")` and
`PixelRatio.get()` for `screens`, `Dimensions.get("window")` for `windowSize`, a UUID you store
once (`createDeviceId()` from `hmrc-fraud-prevention-headers/browser` makes one where
`crypto.getRandomValues` exists) for `deviceId`, and a device information module for
`userAgent` and `localIps`. Desktop applications add `macAddresses` and an `os` entry in
`userIds` (the operating system account, such as `DOMAIN\\alice`).

### Validate headers you already send

```js
import { validateFraudPreventionHeaders } from "hmrc-fraud-prevention-headers";

const result = validateFraudPreventionHeaders({
  "gov-client-connection-method": "DESKTOP_APP_VIA_SERVER",
  "gov-client-screens": "width=1920&height=1080",
  "gov-client-timezone": "GMT",
});
console.log(result.code);
// INVALID_HEADERS
console.log(result.errors.find((e) => e.headers.includes("gov-client-screens")).message);
// At least 1 screen is missing a value for scaling factor
```

It accepts a plain object or a `Headers` instance, in any casing, and never throws. It runs the
checks HMRC documents (formats, ranges, required sets per method, the forwarded cross check) and
a few that implementers learned from HMRC's feedback ([docs/FIELD-NOTES.md](docs/FIELD-NOTES.md)):
example values copied from the spec, private IPs as public ones, a licence that is not hashed, a
percent encoded browser user agent. Passing it, like passing HMRC's Test API, does not guarantee
HMRC accepts your production traffic: HMRC also checks that values are realistic.

### Missing data

```js
import { MissingFraudDataError, buildFraudPreventionHeaders } from "hmrc-fraud-prevention-headers";

const input = {
  connectionMethod: "BATCH_PROCESS_DIRECT",
  deviceId: "9a7c0e55-2b7d-4c41-a3f6-0d0e4b6a8c11",
  localIps: ["10.20.0.5"],
  localIpsTimestamp: new Date(),
  macAddresses: ["3c:22:fb:7a:10:9e"],
  timezone: "UTC+00:00",
  userAgent: { osFamily: "Linux", osVersion: "6.8", deviceManufacturer: "Dell Inc.", deviceModel: "PowerEdge R650" },
  userIds: { os: "batch-runner" },
  vendorProductName: "My Batch Filer",
  vendorVersion: { "my-batch-filer": "1.0.0" },
};

try {
  buildFraudPreventionHeaders(input);
} catch (error) {
  if (error instanceof MissingFraudDataError) console.log(error.headers);
  // [ 'Gov-Vendor-License-IDs' ]
}

// After HMRC agreed that this software holds no licence keys:
const headers = buildFraudPreventionHeaders({
  ...input,
  unavailable: { "Gov-Vendor-License-IDs": "omit" },
});
console.log("Gov-Vendor-License-IDs" in headers);
// false
```

HMRC's rule ([missing header data](https://developer.service.hmrc.gov.uk/guides/fraud-prevention/getting-it-right/))
is that every header is required, a value you cannot collect is reported to HMRC first, and only
then is the header omitted or sent empty (`"omit"` or `"empty"`). The cases HMRC names are
multi-factor with password-only sign in, licence ids with no licence, and the public IP and
port over a private network. Two cases vendors still ask HMRC about are tracked in
[income-tax-mtd-changelog issue 465](https://github.com/hmrc/income-tax-mtd-changelog/issues/465):
the public port on serverless hosting and local IPs of a sandboxed iOS app on cellular.

### Licence keys

```js
import { hashLicenseKey } from "hmrc-fraud-prevention-headers";

console.log(hashLicenseKey("LICENCE-KEY-0001").length);
// 64
```

`Gov-Vendor-License-IDs` must carry a hash of each licence key, made with the same function every
time. `hashLicenseKey` is SHA-256 in uppercase hex, synchronous and dependency free, so it gives
the same value on every runtime.

## How it compares

| Option | Builds the headers | Validates offline | All 8 connection methods | Open source, maintained |
|---|---|---|---|---|
| **hmrc-fraud-prevention-headers** | yes | yes, Test API codes | yes | MIT |
| [user-data-for-fraud-prevention](https://www.npmjs.com/package/user-data-for-fraud-prevention) (Intuit) | no, collects browser data | no | web only | ISC, last release December 2022 |
| [@hmrc-sync/engine](https://www.npmjs.com/package/@hmrc-sync/engine) | yes | no | `WEB_APP_VIA_SERVER` in its README | no linked repository |
| [@readystack/hmrc-fraud-prevention-header-lint](https://www.npmjs.com/package/@readystack/hmrc-fraud-prevention-header-lint) | no | yes | | commercial, licence key |
| [HMRC Test Fraud Prevention Headers API](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/txm-fph-validator-api/1.0) | no | online, sandbox credentials | yes | HMRC service |
| Hand-written builder | yes | no | the one you wrote | yours to keep up with the spec |

Most MTD codebases on GitHub write their own builder (search for `Gov-Client-Connection-Method`:
close to 300 files). The rules that trip them are the ones this library encodes and tests:
which characters to percent encode and which separators not to, which headers a method sends,
the timestamp formats, the forwarded chain that must match both public IPs, and no
placeholders. Use HMRC's Test API as the final check with your sandbox credentials; use this
validator in your unit tests and CI, where you have no credentials and no network.

## Specification coverage

| Connection method | Headers |
|---|---|
| `WEB_APP_VIA_SERVER` | 16 |
| `DESKTOP_APP_DIRECT` | 14 |
| `DESKTOP_APP_VIA_SERVER` | 19 |
| `MOBILE_APP_DIRECT` | 13 |
| `MOBILE_APP_VIA_SERVER` | 18 |
| `BATCH_PROCESS_DIRECT` | 11 |
| `OTHER_DIRECT` | 12 |
| `OTHER_VIA_SERVER` | 17 |

`REQUIRED_HEADERS[method]` lists them in HMRC's order and `SPEC_VERSION` is `"3.3"`. The test
suite builds every example of HMRC's spec pages byte for byte and replays every response
published for HMRC's Test API. A weekly job reads HMRC's pages and fails when a method's header
list or the spec version changes, so a spec change shows up here as a red build, not in your
production logs. The reference notes behind the code are in [docs/SPEC.md](docs/SPEC.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports with the input and HMRC's answer are the most
useful thing you can send.

## License

[MIT](LICENSE)
