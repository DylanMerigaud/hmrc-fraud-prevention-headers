import {
  FraudHeaderFormatError,
  decodeKeyValue,
  decodeKeyValueList,
  decodeList,
  percentDecode,
  percentEncode,
} from "./encoding.js";
import { canonicalIp, ipVersion, isDocumentationIp, isPublicIp, normalizeIp } from "./ip.js";
import { parseIsoTimestamp } from "./iso-time.js";
import {
  CONNECTION_METHODS,
  type ConnectionMethod,
  type HeaderName,
  REQUIRED_HEADERS,
  SPEC_VERSION,
  TOLERATED_HEADERS,
  isViaServer,
} from "./spec.js";

/** Overall result code, as returned by HMRC's Test Fraud Prevention Headers API. */
export type ValidationCode = "VALID_HEADERS" | "INVALID_HEADERS" | "POTENTIALLY_INVALID_HEADERS";

/**
 * Code of one error or warning. Errors use `INVALID_HEADER`, `INVALID_HEADERS` (cross-header),
 * `MISSING_HEADER` and `EMPTY_HEADER`; warnings use `POTENTIALLY_INVALID_HEADER` and
 * `UNEXPECTED_HEADER`.
 */
export type IssueCode =
  | "INVALID_HEADER"
  | "INVALID_HEADERS"
  | "MISSING_HEADER"
  | "EMPTY_HEADER"
  | "POTENTIALLY_INVALID_HEADER"
  | "UNEXPECTED_HEADER";

/** One error or warning; `headers` holds lowercase header names. */
export interface ValidationIssue {
  code: IssueCode;
  message: string;
  headers: string[];
}

/** Result in the shape of HMRC's `GET /test/fraud-prevention-headers/validate` response. */
export interface ValidationResult {
  specVersion: string;
  code: ValidationCode;
  message: string;
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
}

/**
 * Headers to validate: a plain object (values string, string array or undefined, any name
 * casing) or anything with `forEach(value, key)`, such as a fetch `Headers` object or a `Map`.
 */
export type HeaderSource =
  | Record<string, string | readonly string[] | undefined>
  | { forEach(cb: (value: string, key: string) => void): void };

const MSG = {
  noHeaders:
    "No fraud prevention headers submitted. These are required by law. Check the specification.",
  valid:
    "All headers required for your connection method have been supplied and all appear to be valid. Validation is based on a single request. We have access to all requests and can draw additional conclusions.",
  invalid: "At least 1 header is invalid",
  potentiallyInvalid: "At least 1 header is potentially invalid",
  required: "Header required",
  empty: "Header value is empty",
  unexpected: "Header is not expected for this connection method",
  ascii: "Value must be US-ASCII, with other characters percent encoded",
  placeholder: "Value must not be a placeholder",
  malformed: "Value contains a malformed percent escape",
  encoded: "Keys and values must be percent encoded",
  connectionMethod: "Value must be a recognised connection method",
  example: "Value is an example from the specification",
  timezone: "Value must be a recognised timezone in UTC format, submitted as UTC±<hh>:<mm>",
  scalingMissing: "At least 1 screen is missing a value for scaling factor",
  colourMissing: "At least 1 screen is missing a value for colour depth",
  osOnWeb:
    "Check you are using the correct Gov-Client-Connection-Method. Web applications do not usually provide the os field as browsers do not expose this information.",
  forwarded:
    "At least 1 pair of IPs in Gov-Vendor-Forwarded must include Gov-Client-Public-IP in the 'for' field and Gov-Vendor-Public-IP in the 'by' field. Check all 3 headers are consistent.",
  versions:
    "For client server architectures, submit a version for the client and the server. For all other architectures, submit at least 1 version.",
} as const;

const PLACEHOLDERS = new Set(["null", "undefined", "unknown", "n/a", "none"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MFA_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z$/;
const MAC = /^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/i;
const TIMEZONE = /^UTC[+-](0\d|1[0-4]):(00|15|30|45)$/;
const WHOLE = /^[1-9]\d*$/;
const POSITIVE_NUMBER = /^\d+(\.\d+)?$/;
const HASHED = /^[0-9a-fA-F]{16,}$|^[A-Za-z0-9+/_-]{20,}={0,2}$/;
const ENCODED_TOKEN = /^(?:[A-Za-z0-9\-._~]|%[0-9A-Fa-f]{2})*$/;
const MFA_TYPES = new Set(["TOTP", "AUTH_CODE", "OTHER"]);

/** What a per-header checker sees besides the value. */
interface CheckContext {
  method: ConnectionMethod;
  /** Every received header, by lowercase name. */
  headers: ReadonlyMap<string, string>;
}

/** An issue a checker reports; the header name is filled in by the caller. */
interface Finding {
  level: "error" | "warning";
  message: string;
}

/** How the placeholder rule reads a value: whole value only, or every value of its structures. */
type Shape = "single" | "list" | "keyValue";

interface HeaderRule {
  shape: Shape;
  check: (value: string, ctx: CheckContext) => Finding[];
}

const error = (message: string): Finding => ({ level: "error", message });
const warning = (message: string): Finding => ({ level: "warning", message });

function isRealTimestamp(value: string): boolean {
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString() === value;
}

function pairsToMap(pairs: Array<[string, string]>): Map<string, string> {
  return new Map(pairs);
}

function unique(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.level}\n${f.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function checkTimestamp(value: string): Finding[] {
  return TIMESTAMP.test(value) && isRealTimestamp(value)
    ? []
    : [error("Value must be a UTC timestamp in the format yyyy-MM-ddThh:mm:ss.sssZ")];
}

function checkPublicIp(value: string): Finding[] {
  const ip = normalizeIp(percentDecode(value));
  if (ipVersion(ip) === 0 || !isPublicIp(ip)) return [error("Value must be a public IP address")];
  return isDocumentationIp(ip) ? [warning(MSG.example)] : [];
}

/** Width and height of a key-value structure when both are positive whole numbers. */
function dimensions(map: Map<string, string>): { width: number; height: number } | undefined {
  const w = map.get("width") ?? "";
  const h = map.get("height") ?? "";
  return WHOLE.test(w) && WHOLE.test(h) ? { width: Number(w), height: Number(h) } : undefined;
}

const RULES: Readonly<Partial<Record<HeaderName, HeaderRule>>> = {
  "Gov-Client-Device-ID": {
    shape: "single",
    check: (v) => (UUID.test(v) ? [] : [error("Value must be a UUID")]),
  },
  "Gov-Client-Local-IPs": {
    shape: "list",
    check: (v) =>
      decodeList(v).every((ip) => ipVersion(ip) !== 0)
        ? []
        : [error("Each value must be an IP address")],
  },
  "Gov-Client-Local-IPs-Timestamp": { shape: "single", check: checkTimestamp },
  "Gov-Client-Public-IP-Timestamp": { shape: "single", check: checkTimestamp },
  "Gov-Client-MAC-Addresses": {
    shape: "list",
    check: (v) => {
      const macs = decodeList(v);
      if (!macs.every((m) => MAC.test(m))) return [error("Each value must be a MAC address")];
      return macs.some((m) => /^0+$/.test(m.replace(/[:-]/g, "")))
        ? [warning("Value contains an all-zero MAC address")]
        : [];
    },
  },
  "Gov-Client-Multi-Factor": {
    shape: "keyValue",
    check: (v) => {
      const out: Finding[] = [];
      for (const factor of decodeKeyValueList(v).map(pairsToMap)) {
        if (!MFA_TYPES.has(factor.get("type") ?? "")) {
          out.push(error("Each factor must have a type of TOTP, AUTH_CODE or OTHER"));
        }
        const ts = factor.get("timestamp") ?? "";
        if (!MFA_TIMESTAMP.test(ts) || parseIsoTimestamp(ts) === undefined) {
          out.push(
            error(
              "Each factor must have a UTC timestamp in the format yyyy-MM-ddThh:mmZ, seconds and milliseconds optional",
            ),
          );
        }
        if (!factor.get("unique-reference")) {
          out.push(error("Each factor must have a unique-reference"));
        }
      }
      return out;
    },
  },
  "Gov-Client-Public-IP": { shape: "single", check: checkPublicIp },
  "Gov-Vendor-Public-IP": { shape: "single", check: checkPublicIp },
  "Gov-Client-Public-Port": {
    shape: "single",
    check: (v) => {
      if (!WHOLE.test(v) || Number(v) > 65535) {
        return [error("Value must be a whole number from 1 to 65535")];
      }
      if (v === "80" || v === "443") {
        return [
          error("Value must be the client's source port, not a server port such as 80 or 443"),
        ];
      }
      return v === "12345" ? [warning(MSG.example)] : [];
    },
  },
  "Gov-Client-Screens": {
    shape: "keyValue",
    check: (v) => {
      const out: Finding[] = [];
      for (const screen of decodeKeyValueList(v).map(pairsToMap)) {
        if (!dimensions(screen)) {
          out.push(error("Screen width and height must be positive whole numbers"));
        }
        const scaling = screen.get("scaling-factor") ?? "";
        if (scaling === "") out.push(error(MSG.scalingMissing));
        else if (!POSITIVE_NUMBER.test(scaling) || Number(scaling) <= 0) {
          out.push(error("Scaling factor must be a positive number"));
        }
        const depth = screen.get("colour-depth") ?? "";
        if (depth === "") out.push(error(MSG.colourMissing));
        else if (!WHOLE.test(depth)) {
          out.push(error("Colour depth must be a positive whole number"));
        }
      }
      return out;
    },
  },
  "Gov-Client-Timezone": {
    shape: "single",
    check: (v) => (TIMEZONE.test(v) ? [] : [error(MSG.timezone)]),
  },
  "Gov-Client-User-Agent": {
    shape: "keyValue",
    check: (v) => {
      const map = pairsToMap(decodeKeyValue(v));
      const missing = ["os-family", "os-version", "device-manufacturer", "device-model"].filter(
        (k) => !map.get(k),
      );
      return missing.length === 0
        ? []
        : [error(`Value is missing a value for ${missing.join(", ")}`)];
    },
  },
  "Gov-Client-Browser-JS-User-Agent": {
    shape: "single",
    check: (v) =>
      v.includes("%20") && !v.includes(" ")
        ? [warning("Value should be the user agent as the browser reports it, not percent encoded")]
        : [],
  },
  "Gov-Client-User-IDs": {
    shape: "keyValue",
    check: (v, ctx) => {
      const pairs = decodeKeyValue(v);
      const out: Finding[] = [];
      if (!pairs.some(([k, val]) => k !== "" && val !== "")) {
        out.push(error("Value must contain at least 1 user identifier"));
      }
      if (ctx.method === "WEB_APP_VIA_SERVER" && pairs.some(([k]) => k === "os")) {
        out.push(warning(MSG.osOnWeb));
      }
      return out;
    },
  },
  "Gov-Client-Window-Size": {
    shape: "keyValue",
    check: (v) =>
      dimensions(pairsToMap(decodeKeyValue(v)))
        ? []
        : [error("Width and height must be positive whole numbers")],
  },
  "Gov-Vendor-Forwarded": {
    shape: "keyValue",
    check: (v) =>
      decodeKeyValueList(v)
        .map(pairsToMap)
        .every(
          (hop) => ipVersion(hop.get("by") ?? "") !== 0 && ipVersion(hop.get("for") ?? "") !== 0,
        )
        ? []
        : [error("Each hop must have an IP address in by and in for")],
  },
  "Gov-Vendor-License-IDs": {
    shape: "keyValue",
    check: (v) => {
      const pairs = decodeKeyValue(v);
      if (pairs.some(([k, val]) => k === "" || val === "")) {
        return [error("Each license must have a software name and a hashed value")];
      }
      return pairs.every(([, val]) => HASHED.test(val))
        ? []
        : [warning("License value does not look hashed")];
    },
  },
  "Gov-Vendor-Product-Name": {
    shape: "single",
    check: (v) =>
      percentEncode(percentDecode(v)) === v ? [] : [error("Value must be percent encoded")],
  },
  "Gov-Vendor-Version": {
    shape: "keyValue",
    check: (v, ctx) => {
      const count = decodeKeyValue(v).filter(([k, val]) => k !== "" && val !== "").length;
      if (count === 0) return [error("Value must contain at least 1 software name and version")];
      const clientServer = isViaServer(ctx.method) && ctx.method !== "WEB_APP_VIA_SERVER";
      return clientServer && count < 2 ? [warning(MSG.versions)] : [];
    },
  },
};

/**
 * True when every raw token is percent encoded: each list value, or each key and value of each
 * structure. A key-value fragment without `=` (left over by a raw comma, as in
 * `device-model=iPhone12,3`) fails too.
 */
function isPercentEncoded(value: string, shape: Shape): boolean {
  if (shape === "list") return value.split(",").every((v) => ENCODED_TOKEN.test(v));
  if (shape === "keyValue") {
    return value.split(",").every((struct) =>
      struct.split("&").every((pair) => {
        const eq = pair.indexOf("=");
        return (
          eq >= 0 && ENCODED_TOKEN.test(pair.slice(0, eq)) && ENCODED_TOKEN.test(pair.slice(eq + 1))
        );
      }),
    );
  }
  return true;
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDERS.has(value.trim().toLowerCase());
}

/** The percent-decoded value, or the value itself when an escape is malformed. */
function safeDecode(value: string): string {
  try {
    return percentDecode(value);
  } catch {
    return value;
  }
}

/** True when a list item, or a value of a key-value structure, is a placeholder. */
function hasInnerPlaceholder(value: string, shape: Shape): boolean {
  try {
    if (shape === "list") return decodeList(value).some(isPlaceholder);
    if (shape === "keyValue") {
      return decodeKeyValueList(value).some((s) => s.some(([, v]) => isPlaceholder(v)));
    }
  } catch {
    // a malformed escape is reported by the header's checker
  }
  return false;
}

function collect(source: HeaderSource): Map<string, string> {
  const map = new Map<string, string>();
  const add = (key: unknown, value: unknown): void => {
    if (value === undefined || value === null) return;
    const v = Array.isArray(value) ? value.map((x) => String(x)).join(",") : String(value);
    const k = String(key).trim().toLowerCase();
    const prev = map.get(k);
    map.set(k, prev === undefined ? v.trim() : `${prev},${v.trim()}`);
  };
  if (source === null || typeof source !== "object") return map;
  const forEach = (source as { forEach?: unknown }).forEach;
  if (typeof forEach === "function") {
    (source as { forEach(cb: (value: string, key: string) => void): void }).forEach((value, key) =>
      add(key, value),
    );
    return map;
  }
  for (const key of Object.keys(source)) add(key, (source as Record<string, unknown>)[key]);
  return map;
}

function decodedIp(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  try {
    return canonicalIp(percentDecode(value));
  } catch {
    return undefined;
  }
}

function crossForwarded(headers: ReadonlyMap<string, string>): ValidationIssue[] {
  const forwarded = headers.get("gov-vendor-forwarded");
  const client = decodedIp(headers.get("gov-client-public-ip"));
  const vendor = decodedIp(headers.get("gov-vendor-public-ip"));
  if (!forwarded || client === undefined || vendor === undefined) return [];
  let hops: Array<Map<string, string>>;
  try {
    hops = decodeKeyValueList(forwarded).map(pairsToMap);
  } catch {
    return [];
  }
  const ip = (v: string | undefined): string => canonicalIp(v ?? "");
  if (hops.some((hop) => ip(hop.get("for")) === client && ip(hop.get("by")) === vendor)) return [];
  return [
    {
      code: "INVALID_HEADERS",
      message: MSG.forwarded,
      headers: ["gov-vendor-forwarded", "gov-vendor-public-ip", "gov-client-public-ip"],
    },
  ];
}

function crossWindow(headers: ReadonlyMap<string, string>): ValidationIssue[] {
  const windowValue = headers.get("gov-client-window-size");
  const screensValue = headers.get("gov-client-screens");
  if (!windowValue || !screensValue) return [];
  try {
    const win = dimensions(pairsToMap(decodeKeyValue(windowValue)));
    const screens = decodeKeyValueList(screensValue)
      .map((s) => dimensions(pairsToMap(s)))
      .filter((s): s is { width: number; height: number } => s !== undefined);
    if (!win || screens.length === 0) return [];
    if (screens.some((s) => win.width <= s.width && win.height <= s.height)) return [];
  } catch {
    return [];
  }
  return [
    {
      code: "POTENTIALLY_INVALID_HEADER",
      message: "Window size is larger than every screen in Gov-Client-Screens",
      headers: ["gov-client-window-size", "gov-client-screens"],
    },
  ];
}

function result(errors: ValidationIssue[], warnings: ValidationIssue[]): ValidationResult {
  const out: ValidationResult = {
    specVersion: SPEC_VERSION,
    code: "VALID_HEADERS",
    message: MSG.valid,
  };
  if (errors.length > 0) {
    out.code = "INVALID_HEADERS";
    out.message = MSG.invalid;
    out.errors = errors;
  } else if (warnings.length > 0) {
    out.code = "POTENTIALLY_INVALID_HEADERS";
    out.message = MSG.potentiallyInvalid;
  }
  if (warnings.length > 0) out.warnings = warnings;
  return out;
}

/**
 * Checks fraud prevention headers offline against spec v3.3 and answers in the shape and with
 * the codes of HMRC's Test Fraud Prevention Headers API (`GET /test/fraud-prevention-headers/validate`).
 *
 * The required set comes from `Gov-Client-Connection-Method`. Header names are matched in any
 * casing and reported lowercase. Messages HMRC publishes are reproduced word for word. Passing
 * offline does not guarantee HMRC accepts the values: HMRC also checks that they are realistic.
 * Never throws: malformed input becomes an `INVALID_HEADER` error.
 */
export function validateFraudPreventionHeaders(headers: HeaderSource): ValidationResult {
  const received = collect(headers);
  if (![...received.keys()].some((k) => k.startsWith("gov-"))) {
    return { specVersion: SPEC_VERSION, code: "INVALID_HEADERS", message: MSG.noHeaders };
  }

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const methodName = "gov-client-connection-method";
  const methodValue = received.get(methodName);
  if (methodValue === undefined) {
    return result([{ code: "MISSING_HEADER", message: MSG.required, headers: [methodName] }], []);
  }
  if (methodValue === "") {
    return result([{ code: "EMPTY_HEADER", message: MSG.empty, headers: [methodName] }], []);
  }
  const method = CONNECTION_METHODS.find((m) => m === methodValue);
  if (method === undefined) {
    return result(
      [{ code: "INVALID_HEADER", message: MSG.connectionMethod, headers: [methodName] }],
      [],
    );
  }

  const ctx: CheckContext = { method, headers: received };
  const required = REQUIRED_HEADERS[method];
  for (const header of required) {
    const name = header.toLowerCase();
    const value = received.get(name);
    if (value === undefined) {
      errors.push({ code: "MISSING_HEADER", message: MSG.required, headers: [name] });
      continue;
    }
    if (value === "") {
      errors.push({ code: "EMPTY_HEADER", message: MSG.empty, headers: [name] });
      continue;
    }
    const rule = RULES[header];
    if (rule === undefined) continue;
    let findings: Finding[];
    if (!/^[\x20-\x7e]*$/.test(value)) {
      findings = [error(MSG.ascii)];
    } else if (isPlaceholder(value) || isPlaceholder(safeDecode(value))) {
      findings = [error(MSG.placeholder)];
    } else {
      // a placeholder inside a list or a structure does not stop the header's own checks
      findings = hasInnerPlaceholder(value, rule.shape) ? [error(MSG.placeholder)] : [];
      if (!isPercentEncoded(value, rule.shape)) findings.push(error(MSG.encoded));
      try {
        findings.push(...rule.check(value, ctx));
      } catch (e) {
        if (!(e instanceof FraudHeaderFormatError)) throw e;
        findings.push(error(MSG.malformed));
      }
    }
    for (const f of unique(findings)) {
      const issue: ValidationIssue =
        f.level === "error"
          ? { code: "INVALID_HEADER", message: f.message, headers: [name] }
          : { code: "POTENTIALLY_INVALID_HEADER", message: f.message, headers: [name] };
      (f.level === "error" ? errors : warnings).push(issue);
    }
  }

  const expected = new Set<string>([
    ...required.map((h) => h.toLowerCase()),
    ...TOLERATED_HEADERS[method].map((h) => h.toLowerCase()),
  ]);
  for (const name of received.keys()) {
    if (/^gov-(client|vendor)-/.test(name) && !expected.has(name)) {
      warnings.push({ code: "UNEXPECTED_HEADER", message: MSG.unexpected, headers: [name] });
    }
  }

  const has = (h: HeaderName): boolean => required.includes(h);
  if (has("Gov-Vendor-Forwarded")) errors.push(...crossForwarded(received));
  if (has("Gov-Client-Window-Size") && has("Gov-Client-Screens")) {
    warnings.push(...crossWindow(received));
  }
  return result(errors, warnings);
}
