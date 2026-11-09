# Replacing a hand-written header builder

Most MTD codebases build the fraud prevention headers in one file of their own (a
`fraudPreventionHeaders.ts`, an `hmrc-fraud-headers.builder.ts`, an `mtd-headers.ts`). They share a
shape: a client context posted by the front end, a server context read from the request, a
`kv()` or `encode()` helper, and one function returning a header object for one connection
method. Each piece has a counterpart here, so the switch is usually one file.

## Piece by piece

| In a hand-written builder | Here |
|---|---|
| a `kv(pairs)` or `encode(value)` helper around `encodeURIComponent` | `encodeKeyValue`, `encodeList`, `percentEncode` (RFC 3986: also encodes `!'()*`, which `encodeURIComponent` leaves raw) |
| `new Date().toISOString()` for the IP timestamps | `formatTimestamp(date)` (always `yyyy-MM-ddThh:mm:ss.sssZ`, also from strings with an offset) |
| a timezone string built from `getTimezoneOffset()` | `localTimezone()` or `formatTimezone(minutesEastOfUtc)` |
| `createHash("sha256")` for licence keys (Node only) | `hashLicenseKey(key)` (synchronous, every runtime) |
| reading `x-forwarded-for` and `req.socket.remotePort` by hand | `requestFraudData(facts, { trustedProxies, clientPortHeader, vendorPublicIp })`, or `fromExpress`, `fromFastify`, `fromHono` |
| building `by=...&for=...` by hand | `vendorForwarded` from `requestFraudData`, or `buildForwardedChain(clientIp, servers)` |
| `window.screen`, `innerWidth`, `navigator.userAgent`, a device id cookie in the front end | `collectBrowserFraudData()` from `hmrc-fraud-prevention-headers/browser` |
| one function per connection method | `buildFraudPreventionHeaders({ connectionMethod, ... })` for any of the eight |
| `if (value) headers[name] = value` (silently leaving a header out) | the builder throws `MissingFraudDataError` naming each missing header; `unavailable` records the ones HMRC agreed you cannot collect |
| a placeholder (`"Unknown"`, a fixed port, a fixed screen size) | never needed: report it missing instead |
| calling HMRC's Test API by hand to check | `validateFraudPreventionHeaders(headers)` in unit tests, same codes and response shape |

## A typical switch (web app via server)

Before, in a typical hand-written file:

```ts
const headers: Record<string, string> = {
  "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
  "Gov-Client-User-IDs": `my-app=${encodeURIComponent(user.email)}`,
  "Gov-Vendor-Product-Name": encodeURIComponent("My App"),
  "Gov-Vendor-Version": `my-app=${encodeURIComponent(version)}`,
};
if (client.deviceId) headers["Gov-Client-Device-ID"] = client.deviceId;
if (client.screens) headers["Gov-Client-Screens"] = client.screens;
// ... twelve more
```

After:

```ts
import { buildFraudPreventionHeaders } from "hmrc-fraud-prevention-headers";
import { fromExpress } from "hmrc-fraud-prevention-headers/express";

// what collectBrowserFraudData() returned in the browser: take its five fields by name
const { deviceId, screens, windowSize, timezone, browserUserAgent } = clientData;
const headers = buildFraudPreventionHeaders({
  deviceId,
  screens,
  windowSize,
  timezone,
  browserUserAgent,
  ...fromExpress(req, { trustedProxies: 1, clientPortHeader: "x-client-port", vendorPublicIp }),
  connectionMethod: "WEB_APP_VIA_SERVER",
  userIds: { "my-app": user.email },
  multiFactor: user.factors,
  vendorLicenseIds: { "my-app": licenceHash },
  vendorProductName: "My App",
  vendorVersion: { "my-app": version },
});
```

Keep your existing tests that compare header strings: where they now differ, run
`validateFraudPreventionHeaders` on the old strings, it names the rule the old version broke with
HMRC's message where HMRC published one.

## Mobile and desktop

For `MOBILE_APP_VIA_SERVER` and `DESKTOP_APP_VIA_SERVER`, the app posts its fields (device id,
local IPs and their timestamp, screens, window, timezone, user agent parts, MAC addresses on
desktop) to your server exactly as the builder names them, and the server adds the request side
the same way as above. For the `*_DIRECT` methods the app calls `buildFraudPreventionHeaders`
itself. The package imports no Node API: the builder needs only the `TextEncoder` global (in
React Native from 0.74 and in Electron), the validator also `TextDecoder`.
