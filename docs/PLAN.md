# hmrc-fraud-prevention-headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** an npm library that collects, builds and validates the HMRC fraud prevention headers (spec v3.3) for all 8 connection methods, with zero runtime dependencies.

**Architecture:** pure TypeScript modules with no I/O: an encoding layer (RFC 3986 percent encoding, key-value and list structures), a spec table (which headers each connection method sends, in HMRC's order), a builder that turns typed input into the exact header strings, an offline validator whose output has the shape and codes of HMRC's Test Fraud Prevention Headers API, a request reader (public IP, port, timestamp, forwarded chain) with Express, Fastify and Hono adapters, and a browser collector. Dual ESM and CJS build by `tsc`.

**Tech Stack:** TypeScript 5, `node:test`, Biome (lint and format), GitHub Actions. Node 18+, Deno, Bun.

**Spec:** `docs/SPEC.md` (HMRC v3.3 read 2026-11-09, the per-method matrix in section 3, data rules in section 2, Test API codes in section 6). Field notes from real hand-rolled builders: `docs/FIELD-NOTES.md`.

## Global Constraints

- Zero runtime dependencies. `dependencies` stays absent from package.json.
- Node `>=18` (no API newer than Node 18: no `Array.prototype.findLast` polyfill issues, no `URL.canParse`, no global `crypto` assumption in core).
- Core modules do no I/O and read no globals except `TextEncoder` and `Date`; only `src/browser.ts` reads `window`, `navigator`, `localStorage`, `crypto`.
- SHA-256 is `src/sha256.ts` (done, tested), never `node:crypto` in `src`.
- Never emit U+2014 or U+2013 in any file. No text says how the code was produced.
- Every exported function and type carries a TSDoc comment.
- Header names in builder output use HMRC's casing (`Gov-Client-Public-IP`); the validator accepts any casing and reports lowercase names, as HMRC does.
- `npm test` builds then runs `node --test dist-test/test/*.test.js`; `npm run lint` is Biome; both must be green after every task.

## Public API (the contract every task codes against)

```ts
// src/spec.ts
export const SPEC_VERSION = "3.3";
export type ConnectionMethod = "WEB_APP_VIA_SERVER" | "DESKTOP_APP_DIRECT" | "DESKTOP_APP_VIA_SERVER"
  | "MOBILE_APP_DIRECT" | "MOBILE_APP_VIA_SERVER" | "BATCH_PROCESS_DIRECT" | "OTHER_DIRECT" | "OTHER_VIA_SERVER";
export const CONNECTION_METHODS: readonly ConnectionMethod[];          // the 8, in SPEC.md section 3 order
export type HeaderName = "Gov-Client-Connection-Method" | ... ;        // the 20 of SPEC.md section 3 matrix
export const HEADER_NAMES: readonly HeaderName[];
export const REQUIRED_HEADERS: Readonly<Record<ConnectionMethod, readonly HeaderName[]>>; // HMRC page order (SPEC.md 3.1 to 3.8)
export const TOLERATED_HEADERS: readonly string[];  // "Gov-Client-Browser-Plugins", "Gov-Client-Browser-Do-Not-Track"
export function isViaServer(method: ConnectionMethod): boolean;        // name ends with _VIA_SERVER

// src/encoding.ts
export function percentEncode(value: string): string;      // UTF-8, keep A-Z a-z 0-9 - . _ ~, uppercase hex
export function percentDecode(value: string): string;      // throws FraudHeaderFormatError on malformed %XX
export type Pairs = Record<string, string | number> | ReadonlyArray<readonly [string, string | number]>;
export function encodeKeyValue(pairs: Pairs): string;       // k=v&k=v, keys and values encoded
export function encodeList(values: readonly string[]): string;            // each encoded, joined by ","
export function encodeKeyValueList(structs: readonly Pairs[]): string;    // structures joined by ","
export function decodeKeyValue(value: string): Array<[string, string]>;   // "" -> []
export function decodeList(value: string): string[];                      // "" -> []
export function decodeKeyValueList(value: string): Array<Array<[string, string]>>;
export class FraudHeaderFormatError extends Error {}

// src/time.ts
export function formatTimestamp(value: Date | string | number): string;  // yyyy-MM-ddThh:mm:ss.sssZ, UTC; throws on invalid date
export function formatTimezone(offsetMinutesEastOfUtc: number): string; // 60 -> "UTC+01:00", -75 -> "UTC-01:15", 0 -> "UTC+00:00"
export function localTimezone(date?: Date): string;                      // formatTimezone(-date.getTimezoneOffset())

// src/ip.ts
export function ipVersion(value: string): 0 | 4 | 6;       // strict IPv4 dotted quad, IPv6 incl. "::" forms and IPv4 tail, no zone id
export function normalizeIp(value: string): string;        // trims, strips "[...]" and "::ffff:" IPv4-mapped prefix; returns input when not an IP
export function isPublicIp(value: string): boolean;        // false for private, loopback, link-local, CGNAT 100.64/10, unspecified, multicast, ULA fc00::/7, fe80::/10, ::1
export function isDocumentationIp(value: string): boolean; // 192.0.2/24, 198.51.100/24, 203.0.113/24, 2001:db8::/32

// src/license.ts
export function hashLicenseKey(key: string): string;       // sha256Hex(key).toUpperCase()

// src/build.ts
export interface Screen { width: number; height: number; scalingFactor: number; colourDepth: number }
export interface WindowSize { width: number; height: number }
export interface DeviceUserAgent { osFamily: string; osVersion: string; deviceManufacturer: string; deviceModel: string }
export type MultiFactorType = "TOTP" | "AUTH_CODE" | "OTHER";
export interface MultiFactor { type: MultiFactorType; timestamp: Date | string; uniqueReference: string }
export interface ForwardedHop { by: string; for: string }
export type MissingDataHandling = "omit" | "empty";
export interface FraudPreventionInput {
  connectionMethod: ConnectionMethod;
  deviceId?: string;
  userIds?: Pairs;
  timezone?: string;                       // already "UTC+hh:mm" (use localTimezone/formatTimezone)
  screens?: readonly Screen[];
  windowSize?: WindowSize;
  browserUserAgent?: string;               // WEB_APP_VIA_SERVER: sent as the browser reports it (non-ASCII percent-encoded only)
  userAgent?: DeviceUserAgent;
  localIps?: readonly string[];
  localIpsTimestamp?: Date | string;
  macAddresses?: readonly string[];
  multiFactor?: readonly MultiFactor[];
  publicIp?: string;
  publicIpTimestamp?: Date | string;
  publicPort?: number | string;
  vendorPublicIp?: string;
  vendorForwarded?: readonly ForwardedHop[];
  vendorLicenseIds?: Pairs;                // values already hashed (hashLicenseKey)
  vendorProductName?: string;              // plain text, the builder encodes it
  vendorVersion?: Pairs;
  unavailable?: Partial<Record<HeaderName, MissingDataHandling>>; // only what HMRC agreed (SPEC.md section 5)
}
export interface BuildOptions { validate?: boolean }   // default true
export function buildFraudPreventionHeaders(input: FraudPreventionInput, options?: BuildOptions): Record<HeaderName, string>;
export class MissingFraudDataError extends Error { readonly headers: HeaderName[] }
export class InvalidFraudHeadersError extends Error { readonly result: ValidationResult }
export function buildForwardedChain(clientPublicIp: string, servers: readonly string[]): ForwardedHop[];
  // servers in the order the request crosses them: [{by:s1,for:client},{by:s2,for:s1},...]; [] -> throws

// src/validate.ts
export type ValidationCode = "VALID_HEADERS" | "INVALID_HEADERS" | "POTENTIALLY_INVALID_HEADERS";
export type IssueCode = "INVALID_HEADER" | "INVALID_HEADERS" | "MISSING_HEADER" | "EMPTY_HEADER"
  | "POTENTIALLY_INVALID_HEADER" | "UNEXPECTED_HEADER";
export interface ValidationIssue { code: IssueCode; message: string; headers: string[] } // lowercase names
export interface ValidationResult { specVersion: string; code: ValidationCode; message: string;
  errors?: ValidationIssue[]; warnings?: ValidationIssue[] }
export type HeaderSource = Record<string, string | readonly string[] | undefined> | { forEach(cb: (value: string, key: string) => void): void };
export function validateFraudPreventionHeaders(headers: HeaderSource): ValidationResult;

// src/request.ts
export interface RequestFacts { remoteAddress?: string; remotePort?: number; headers: Record<string, string | readonly string[] | undefined>; receivedAt?: Date }
export interface RequestOptions {
  trustedProxies?: number;      // hops of X-Forwarded-For to trust from the right, default 0 (socket address)
  clientPortHeader?: string;    // header your edge sets with the client's TCP source port, e.g. "x-client-port"
  vendorPublicIp?: string;      // public IP your DNS points at (WAF, load balancer)
  forwardedServers?: readonly string[]; // public IPs of further TLS-terminating hops after vendorPublicIp
}
export interface RequestFraudData { publicIp?: string; publicPort?: number; publicIpTimestamp: string; vendorPublicIp?: string; vendorForwarded?: ForwardedHop[] }
export function requestFraudData(facts: RequestFacts, options?: RequestOptions): RequestFraudData;

// src/adapters/express.ts, fastify.ts, hono.ts (subpath exports ./express ./fastify ./hono)
export function fromExpress(req: { socket?: {remoteAddress?: string; remotePort?: number}; headers: ... }, options?: RequestOptions): RequestFraudData;
export function fromFastify(request: { raw: { socket?: ... }; headers: ... }, options?: RequestOptions): RequestFraudData;
export function fromHono(c: { req: { raw: Request } }, options?: RequestOptions & { connInfo?: { remote: { address?: string; port?: number } } }): RequestFraudData;

// src/browser.ts (subpath ./browser)
export interface BrowserFraudData { deviceId: string; screens: Screen[]; windowSize: WindowSize; timezone: string; browserUserAgent: string }
export interface CollectOptions { window?: BrowserLike; storageKey?: string /* default "hmrc-fph-device-id" */ }
export function collectBrowserFraudData(options?: CollectOptions): BrowserFraudData;
export function getOrCreateDeviceId(storage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | undefined, key?: string, random?: () => string): string;
export function createDeviceId(): string;  // crypto.randomUUID, else RFC 4122 v4 from crypto.getRandomValues
```

`src/index.ts` re-exports spec, encoding, time, ip, license, build, validate, request and `sha256Hex`.

## Review Focus

1. A value containing `=`, `&`, `,` or `%` (a user id `a&b=c`, a model `MacBookPro15,2`): must be encoded so the structure still parses; covered by T1 property tests and T4 golden `iPhone12%2C3`.
2. A request behind a proxy with no client port available: `requestFraudData` returns no `publicPort`, and `buildFraudPreventionHeaders` throws `MissingFraudDataError` naming `Gov-Client-Public-Port` unless `unavailable` says otherwise; never a placeholder. T4 and T5 tests.
3. A spoofed `X-Forwarded-For` with `trustedProxies: 0`: the socket address wins. T5 test.
4. IPv4-mapped IPv6 socket addresses (`::ffff:81.2.69.142`) from Node: normalized to IPv4 so the Forwarded cross check holds. T1 and T5 tests.
5. Timestamps given as ISO strings with offsets or without milliseconds: normalized to `.sssZ` UTC; an unparseable date throws, never "Invalid Date". T1 test.

---

### Task 1: encoding, time, ip, license

**Files:** Create `src/encoding.ts`, `src/time.ts`, `src/ip.ts`, `src/license.ts`; tests `test/encoding.test.ts`, `test/time.test.ts`, `test/ip.test.ts`, `test/license.test.ts`.

**Interfaces:** Produces the signatures of the Public API block for these four files. Consumes `sha256Hex` from `src/sha256.ts`.

- [ ] Step 1: failing tests, with these exact assertions:
  - `percentEncode("Product Name") === "Product%20Name"`, `percentEncode("domain\\alice") === "domain%5Calice"`, `percentEncode("iPhone12,3") === "iPhone12%2C3"`, `percentEncode("fc00::") === "fc00%3A%3A"`, `percentEncode("Dell Inc.") === "Dell%20Inc."`, `percentEncode("é") === "%C3%A9"`, `percentEncode("a!'()*") === "a%21%27%28%29%2A"`.
  - `encodeKeyValue({ "os-family": "Windows", "os-version": "Server 2012", "device-manufacturer": "Dell Inc.", "device-model": "OptiPlex 980" }) === "os-family=Windows&os-version=Server%202012&device-manufacturer=Dell%20Inc.&device-model=OptiPlex%20980"`.
  - `encodeList(["fc00::", "10.1.2.3"]) === "fc00%3A%3A,10.1.2.3"`; `encodeList([""])` throws `FraudHeaderFormatError` (list values must not be empty).
  - property test, seeded PRNG (mulberry32, seed 1, 2000 cases of random strings over ASCII 0x20..0x7e plus "é中😀"): `percentDecode(percentEncode(s)) === s`; `percentEncode(s)` matches `/^(?:[A-Za-z0-9\-._~]|%[0-9A-F]{2})*$/`; `decodeKeyValue(encodeKeyValue([[a, b], [c, d]]))` deep-equals the input for random non-empty keys.
  - `percentDecode("%G1")` throws `FraudHeaderFormatError`.
  - `formatTimestamp("2020-09-21T15:30:05.123+01:00") === "2020-09-21T14:30:05.123Z"`, `formatTimestamp(new Date(Date.UTC(2020, 8, 21, 14, 30, 5))) === "2020-09-21T14:30:05.000Z"`, `formatTimestamp("nope")` throws `RangeError`.
  - `formatTimezone(0) === "UTC+00:00"`, `formatTimezone(60) === "UTC+01:00"`, `formatTimezone(-75) === "UTC-01:15"`, `formatTimezone(330) === "UTC+05:30"`.
  - `ipVersion("198.51.100.0") === 4`, `ipVersion("ABCD:EF01:2345:6789:ABCD:EF01:2345:6789") === 6`, `ipVersion("::1") === 6`, `ipVersion("::ffff:1.2.3.4") === 6`, `ipVersion("256.1.1.1") === 0`, `ipVersion("01.2.3.4") === 0`, `ipVersion("fe80::1%eth0") === 0`.
  - `normalizeIp("::ffff:81.2.69.142") === "81.2.69.142"`, `normalizeIp("[2a00:1450::1]") === "2a00:1450::1"`.
  - `isPublicIp`: true for `81.2.69.142`, `2a00:1450:4009:81f::200e`; false for `10.0.0.1`, `172.16.0.1`, `192.168.1.1`, `127.0.0.1`, `169.254.1.1`, `100.64.0.1`, `0.0.0.0`, `::1`, `fc00::1`, `fe80::1`, `224.0.0.1`. `isDocumentationIp("203.0.113.6") === true`, `isDocumentationIp("2001:db8::1") === true`.
  - `hashLicenseKey("abc") === "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD"`.
- [ ] Step 2: run `npm test`, expect the new tests to fail (missing modules).
- [ ] Step 3: implement. `percentEncode` walks `TextEncoder` bytes. IPv6 parsing expands to 8 groups (handles one `::`, an IPv4 tail) for range checks.
- [ ] Step 4: `npm test` and `npm run lint` green.
- [ ] Step 5: commit `feat: percent encoding, timestamps, IP helpers and license hashing`.

### Task 2: spec table

**Files:** Create `src/spec.ts`; test `test/spec.test.ts`.

**Interfaces:** Produces `SPEC_VERSION`, `ConnectionMethod`, `CONNECTION_METHODS`, `HeaderName`, `HEADER_NAMES`, `REQUIRED_HEADERS`, `TOLERATED_HEADERS`, `isViaServer`.

- [ ] Step 1: failing test: the counts per method equal SPEC.md section 3 (`WEB_APP_VIA_SERVER` 16, `DESKTOP_APP_DIRECT` 14, `DESKTOP_APP_VIA_SERVER` 19, `MOBILE_APP_DIRECT` 13, `MOBILE_APP_VIA_SERVER` 18, `BATCH_PROCESS_DIRECT` 11, `OTHER_DIRECT` 12, `OTHER_VIA_SERVER` 17); each list equals, in order, the "Header" column of SPEC.md tables 3.1 to 3.8 (write the 8 expected arrays out in the test); every list starts with `Gov-Client-Connection-Method`; `isViaServer("OTHER_VIA_SERVER") === true`, `isViaServer("BATCH_PROCESS_DIRECT") === false`.
- [ ] Step 2: run, fail. Step 3: implement from SPEC.md section 3 tables. Step 4: green. Step 5: commit `feat: v3.3 header table per connection method`.

### Task 3: offline validator (opus)

**Files:** Create `src/validate.ts`; tests `test/validate.test.ts`, `test/parity.test.ts`, fixture `test/fixtures/spec-examples.ts`.

**Interfaces:** Consumes Task 1 and Task 2. Produces `validateFraudPreventionHeaders`, `ValidationResult`, `ValidationIssue`, `IssueCode`, `ValidationCode`, `HeaderSource`.

Rules (each one a test): header lookup case-insensitive, multi-valued headers joined with ","; no `gov-*` header at all gives `{code: "INVALID_HEADERS", message: "No fraud prevention headers submitted. These are required by law. Check the specification."}` and no arrays; missing or unknown connection method gives `MISSING_HEADER` or `INVALID_HEADER` on it and stops; for each required header of the method, absent gives `MISSING_HEADER` message `"Header required"`, present but empty gives `EMPTY_HEADER` message `"Header value is empty"`; a `gov-client-*` or `gov-vendor-*` header outside the method's list and outside `TOLERATED_HEADERS` gives warning `UNEXPECTED_HEADER`; any value with a character outside 0x20..0x7e gives `INVALID_HEADER` "Value must be US-ASCII, with other characters percent encoded"; a whole value or a key-value value equal (case-insensitive) to `null`, `undefined`, `unknown`, `n/a`, `none` gives `INVALID_HEADER` "Value must not be a placeholder". Per header:
- Device-ID: UUID `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`i.
- Local-IPs: list, each decoded value an IP; Local-IPs-Timestamp and Public-IP-Timestamp: `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$` and a real date.
- MAC-Addresses: list, each decoded `^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$`i; `00:00:00:00:00:00` is a warning.
- Multi-Factor: list of structures, `type` in TOTP AUTH_CODE OTHER, decoded `timestamp` matches `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z$`, `unique-reference` non-empty.
- Public-IP and Vendor-Public-IP: an IP (raw or decoded), not private (`INVALID_HEADER` "Value must be a public IP address"); a documentation-range IP is a warning "Value is an example from the specification".
- Public-Port: integer 1..65535 and not 80 or 443; `12345` is the spec example warning.
- Screens: list of structures; width and height positive whole numbers; missing scaling factor gives the verbatim "At least 1 screen is missing a value for scaling factor", missing colour depth "At least 1 screen is missing a value for colour depth" (both errors on one header in one result); scaling-factor a positive number; colour-depth a positive integer.
- Timezone: `^UTC[+-](0\d|1[0-4]):(00|15|30|45)$` else verbatim "Value must be a recognised timezone in UTC format, submitted as UTC±<hh>:<mm>".
- User-Agent: key-value with all of os-family, os-version, device-manufacturer, device-model non-empty.
- Browser-JS-User-Agent: non-empty; a value with `%20` and no space is a warning "Value should be the user agent as the browser reports it, not percent encoded".
- User-IDs: at least one pair with a non-empty value; for WEB_APP_VIA_SERVER an `os` key is the verbatim warning "Check you are using the correct Gov-Client-Connection-Method. Web applications do not usually provide the os field as browsers do not expose this information.".
- Window-Size: width and height positive whole numbers; cross warning when larger than every screen of Gov-Client-Screens "Window size is larger than every screen in Gov-Client-Screens" (headers both).
- Vendor-Forwarded: list of structures each with `by` and `for` IPs (decoded); cross error code `INVALID_HEADERS`, verbatim "At least 1 pair of IPs in Gov-Vendor-Forwarded must include Gov-Client-Public-IP in the 'for' field and Gov-Vendor-Public-IP in the 'by' field. Check all 3 headers are consistent.", headers `["gov-vendor-forwarded","gov-vendor-public-ip","gov-client-public-ip"]`, IPs compared after `normalizeIp` and lowercasing.
- License-IDs: key-value, non-empty values; a value not matching `^[0-9a-fA-F]{16,}$|^[A-Za-z0-9+/_-]{20,}={0,2}$` is a warning "License value does not look hashed".
- Product-Name: non-empty, must already be percent encoded (`percentEncode(percentDecode(v)) === v`) else `INVALID_HEADER` "Value must be percent encoded".
- Vendor-Version: at least one pair; for DESKTOP, MOBILE and OTHER via-server methods fewer than two pairs is the verbatim warning "For client server architectures, submit a version for the client and the server. For all other architectures, submit at least 1 version."
- Result: errors present gives INVALID_HEADERS "At least 1 header is invalid"; only warnings gives POTENTIALLY_INVALID_HEADERS "At least 1 header is potentially invalid"; neither gives VALID_HEADERS with the verbatim valid message of SPEC.md 6.1. `specVersion` is `SPEC_VERSION`. Empty arrays are omitted.

- [ ] Step 1: `test/fixtures/spec-examples.ts` exports `SPEC_EXAMPLES: Record<ConnectionMethod, Record<HeaderName, string>>`, one full header set per method from SPEC.md 3.1 to 3.8 verbatim (first example where two are given; the full two-factor Multi-Factor value; Device-ID `beec798b-b366-47fa-b1f8-92cede14a1ce`).
- [ ] Step 2: failing tests: each SPEC_EXAMPLES set has no `errors` and only warnings whose message is one of the "example from the specification" kind (documentation IPs, port 12345); `test/parity.test.ts` replays every response of SPEC.md 6.1 and 6.2: for the 6.2 request, the headers whose code is MISSING_HEADER, INVALID_HEADER (screens `width=1920&height=1080` with both verbatim messages) and POTENTIALLY_INVALID_HEADER (vendor version `my-desktop-app=2.2.2` on DESKTOP_APP_VIA_SERVER) come out with the same code and message; the 6.1 invalid example (timezone `GMT`, vendor version absent, forwarded `by=203.0.113.6&for=198.51.100.1` against client `198.51.100.0`) yields the same three errors; WEB with `os=alice&my-application=alice123` yields the os warning; `{}` yields the no-headers message; one test per rule above.
- [ ] Step 3: run, fail. Step 4: implement as a table of per-header checkers `(value, ctx) => issues`. Step 5: green, lint. Step 6: commit `feat: offline validator with HMRC Test API codes`.

### Task 4: builder

**Files:** Create `src/build.ts`; test `test/build.test.ts`.

**Interfaces:** Consumes Tasks 1 to 3. Produces `buildFraudPreventionHeaders`, the input types, `MissingFraudDataError`, `InvalidFraudHeadersError`, `buildForwardedChain`.

Formatting: Device-ID as given; User-IDs, License-IDs, Version, User-Agent `encodeKeyValue`; Screens `encodeKeyValueList` with keys width, height, scaling-factor, colour-depth; Window-Size `width=..&height=..`; Local-IPs and MAC-Addresses `encodeList`; Multi-Factor structures type, timestamp (`formatTimestamp`), unique-reference; Public-IP and Vendor-Public-IP `normalizeIp` raw (not encoded); timestamps `formatTimestamp`; port `String`; Forwarded `encodeKeyValueList` of by, for after `normalizeIp`; Product-Name `percentEncode`; Browser-JS-User-Agent raw except non-ASCII bytes percent encoded. Output keys in `REQUIRED_HEADERS[method]` order, only that method's headers. All missing headers collected first, then one `MissingFraudDataError` listing all of them (message names each header and points to the `unavailable` option and SPEC.md section 5). `unavailable[h] === "empty"` emits `""`, `"omit"` leaves it out. With `validate` true (default) the result goes through `validateFraudPreventionHeaders`, with `unavailable` headers' MISSING_HEADER and EMPTY_HEADER errors removed, and remaining errors throw `InvalidFraudHeadersError` carrying the result.

- [ ] Step 1: failing tests: for each method, a typed input built from the DECODED values of `SPEC_EXAMPLES` produces exactly `SPEC_EXAMPLES[method]` (with `{ validate: false }`, as the examples use documentation IPs only to warn, which does not throw anyway); a WEB input missing `publicPort` throws `MissingFraudDataError` whose `headers` deep-equals `["Gov-Client-Public-Port"]`; with `unavailable: { "Gov-Client-Public-Port": "omit" }` it returns no such key and does not throw; `"empty"` returns `""`; a timezone `"GMT"` throws `InvalidFraudHeadersError` with `result.errors[0].headers` `["gov-client-timezone"]`; `buildForwardedChain("198.51.100.0", ["2001:db8:85a3::8a2e:370:7334", "203.0.113.6", "176.30.57.118"])` deep-equals the 3 hops of the SPEC.md 3.1 multi-hop example (as objects, by and for); a `userIds` value `a&b=c` round-trips through `decodeKeyValue`.
- [ ] Step 2 to 5: fail, implement, green, commit `feat: header builder for all eight connection methods`.

### Task 5: request reader and adapters

**Files:** Create `src/request.ts`, `src/adapters/express.ts`, `src/adapters/fastify.ts`, `src/adapters/hono.ts`; tests `test/request.test.ts`, `test/adapters.test.ts`.

**Interfaces:** Consumes Task 1 and `buildForwardedChain`. Produces `requestFraudData`, `RequestFacts`, `RequestOptions`, `RequestFraudData`, `fromExpress`, `fromFastify`, `fromHono`. Adapters take structural types only (no import of the frameworks).

Rules: client IP is `normalizeIp(remoteAddress)` when `trustedProxies` is 0; otherwise the X-Forwarded-For entry `trustedProxies` positions from the right (list = XFF entries then the socket address; the client is `list[list.length - 1 - trustedProxies]`, clamped to the first entry). Port: when `trustedProxies` is 0, `remotePort`; otherwise the integer value of `clientPortHeader` when set and valid, else undefined. `publicIpTimestamp` is `formatTimestamp(receivedAt ?? new Date())`. `vendorForwarded` is `buildForwardedChain(publicIp, [vendorPublicIp, ...forwardedServers])` when `vendorPublicIp` and `publicIp` are both known. Hono reads headers from `c.req.raw.headers` and the address from `options.connInfo` (the result of Hono's `getConnInfo(c)`).

- [ ] Step 1: failing tests: socket `::ffff:81.2.69.142` port 51123 gives `{publicIp: "81.2.69.142", publicPort: 51123}`; XFF `"1.1.1.1, 81.2.69.142"` with socket `10.0.0.5` and `trustedProxies: 1` gives `81.2.69.142` (the spoofed `1.1.1.1` ignored), and with `trustedProxies: 0` gives `10.0.0.5`; `clientPortHeader: "x-client-port"` with value `"51123"` gives 51123, with `"abc"` gives undefined; `receivedAt` `2020-09-21T14:30:05.123Z` passes through; vendor chain with `vendorPublicIp: "203.0.113.6"` gives `[{by: "203.0.113.6", for: client}]`; each adapter, given a minimal fake object, returns the same data as `requestFraudData`.
- [ ] Step 2 to 5: fail, implement, green, commit `feat: request reader with Express, Fastify and Hono adapters`.

### Task 6: browser collector

**Files:** Create `src/browser.ts`; test `test/browser.test.ts`.

**Interfaces:** Consumes `formatTimezone`, `Screen`, `WindowSize`. Produces `collectBrowserFraudData`, `getOrCreateDeviceId`, `createDeviceId`, `BrowserFraudData`, `CollectOptions`, `BrowserLike` (the structural subset of `window` read: `screen.width`, `screen.height`, `screen.colorDepth`, `devicePixelRatio`, `innerWidth`, `innerHeight`, `navigator.userAgent`, `localStorage`, `crypto`).

Rules: one screen from `window.screen` (browsers expose the current screen only; documented); `scalingFactor` = `devicePixelRatio || 1`; `colourDepth` = `screen.colorDepth`; window from `innerWidth`/`innerHeight` rounded; timezone `formatTimezone(-new Date().getTimezoneOffset())`; device id persisted under `storageKey` in `localStorage`; storage that throws (private mode) falls back to a fresh id for this call. `createDeviceId` returns a lowercase v4 UUID matching the validator's regex. The returned object is plain JSON, with the builder's field names, so a server can spread it into `FraudPreventionInput`.

- [ ] Step 1: failing tests with a fake window (screen 1920x1080, colorDepth 24, devicePixelRatio 1.25, inner 1256x803, UA string, an in-memory storage): exact object; a second call returns the same device id; a storage whose getItem throws still returns a UUID; output passes `buildFraudPreventionHeaders` for WEB_APP_VIA_SERVER when merged with server data from Task 5.
- [ ] Step 2 to 5: fail, implement, green, commit `feat: browser collector`.

### Task 7: package surface, examples, docs, contract job (opus writes the README)

**Files:** `src/index.ts`; `examples/web-app-via-server.mjs`, `examples/desktop-app-direct.mjs`, `examples/validate-headers.mjs`, `examples/node-http-server.mjs`; `scripts/runtime-smoke.mjs`, `scripts/runtime-smoke.cjs`; `contract/spec-drift.test.ts`, `contract/sandbox.test.ts`; `.github/workflows/contract.yml`; `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/spec_change.md`, `docs/FIELD-NOTES.md`.

- Every example imports `hmrc-fraud-prevention-headers` by name, runs offline, prints its result and exits 0 (`node scripts/run-examples.mjs` green). `node-http-server.mjs` starts `node:http` on port 0, sends itself one request with `x-forwarded-for` and `x-client-port`, builds WEB_APP_VIA_SERVER headers, prints the validator code, closes.
- Runtime smoke: import from `dist/esm/index.js` (mjs) or require `dist/cjs/index.js` (cjs), build the WEB example and assert `validateFraudPreventionHeaders(...).code !== "INVALID_HEADERS"`.
- `contract/spec-drift.test.ts`: fetch each of the 8 method pages and the change log; for each page the set of `Gov-(Client|Vendor)-[A-Za-z-]+` names found in its main content equals `REQUIRED_HEADERS[method]`; the change log's newest version equals `SPEC_VERSION`. `contract/sandbox.test.ts`: when `HMRC_CLIENT_ID` and `HMRC_CLIENT_SECRET` are set, gets a client-credentials token and calls `GET https://test-api.service.hmrc.gov.uk/test/fraud-prevention-headers/validate` with headers built for each method, asserting HMRC's `code` equals the offline validator's `code`; otherwise the test is skipped with that reason.
- `contract.yml`: `schedule: cron "17 6 * * 1"` and `workflow_dispatch`, Node 22, `npm ci && npm run test:contract`, secrets passed as env.
- README: what and for whom in the first lines, install, a quickstart that runs as written and prints `VALID_HEADERS`, one example per feature (builder per method family, validator, request adapters, browser collector, React Native mapping, missing data), the comparison with the options of the fifth filter (Intuit user-data-for-fraud-prevention, @hmrc-sync, hmrc-mtd-mcp, the commercial linter, the HMRC Test API itself), spec version and how spec changes are caught (contract job), license. Framework and browser blocks carry `<!-- harness: skip -->`.

- [ ] Steps: write, `npm test`, `npm run lint`, `node scripts/run-examples.mjs`, `node scripts/runtime-smoke.mjs`, `node scripts/runtime-smoke.cjs`, commit `docs: README, examples, contract job`.

## Done criteria

1. `npm test` green; `npm run lint` and `npm run typecheck` green; examples and both smoke scripts exit 0.
2. Every SPEC.md section 3 example is produced byte for byte by the builder (Task 4 golden test) and validates without errors (Task 3).
3. Every HMRC-published Test API response in SPEC.md section 6 is reproduced by the validator (Task 3 parity test).
4. `npm pack` tarball holds `dist/esm`, `dist/cjs` with `.d.ts`, README, LICENSE, CHANGELOG; zero `dependencies`.
5. Independent review findings fixed; `python3 scripts/oss_lib_harness.py check` (growth-cockpit) prints PASS.
6. Published: public repository, tag v0.1.0, `npm view hmrc-fraud-prevention-headers version` prints 0.1.0.

## Harness criteria answered (career/osslib-evals/CRITERIA.json)

Scored: quickstart in the README (Task 7), CI workflow (done), typed (TypeScript and shipped .d.ts), lint config (`biome.json`), J3 why this one (README comparison, Task 7); owner track record is not in the build's hands. Executable gates: E1 the packed tarball installs and imports, E2 README blocks run (`OSS_LIB_OFFLINE` irrelevant: nothing touches the network), E3 `npm test`, E4 `.d.ts` named in `exports`, E5 every `examples/*.mjs` runs. Also measured: install line, usage and features sections, comparison, spec named, changelog, license, issue templates, contributing, examples, docs directory.
