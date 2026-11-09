import {
  type Pairs,
  encodeKeyValue,
  encodeKeyValueList,
  encodeList,
  percentEncode,
} from "./encoding.js";
import { normalizeIp } from "./ip.js";
import { type ConnectionMethod, type HeaderName, REQUIRED_HEADERS } from "./spec.js";
import { formatTimestamp } from "./time.js";
import {
  type ValidationIssue,
  type ValidationResult,
  validateFraudPreventionHeaders,
} from "./validate.js";

/** One screen of the device. `scalingFactor` is 1 for a 100% scale. */
export interface Screen {
  width: number;
  height: number;
  scalingFactor: number;
  colourDepth: number;
}

/** Size in pixels of the window the user works in. */
export interface WindowSize {
  width: number;
  height: number;
}

/** Operating system and hardware of a device, for the non-browser connection methods. */
export interface DeviceUserAgent {
  osFamily: string;
  osVersion: string;
  deviceManufacturer: string;
  deviceModel: string;
}

/** Kind of a multi-factor authentication step. */
export type MultiFactorType = "TOTP" | "AUTH_CODE" | "OTHER";

/**
 * One multi-factor step. A string timestamp that is already UTC `yyyy-MM-ddThh:mmZ` (seconds and
 * milliseconds optional) is sent as given; a `Date` or any other string is normalized to `.sssZ`.
 */
export interface MultiFactor {
  type: MultiFactorType;
  timestamp: Date | string;
  uniqueReference: string;
}

/** One hop of `Gov-Vendor-Forwarded`: the server that received (`by`) and the address it saw (`for`). */
export interface ForwardedHop {
  by: string;
  for: string;
}

/** What to send for a header HMRC agreed you cannot provide: leave it out, or send it empty. */
export type MissingDataHandling = "omit" | "empty";

/** Typed fraud prevention data. Fields that do not belong to `connectionMethod` are ignored. */
export interface FraudPreventionInput {
  connectionMethod: ConnectionMethod;
  deviceId?: string;
  userIds?: Pairs;
  /** Already `UTC+hh:mm` (see `localTimezone` and `formatTimezone`). */
  timezone?: string;
  screens?: readonly Screen[];
  windowSize?: WindowSize;
  /** WEB_APP_VIA_SERVER: sent as the browser reports it, only non-ASCII characters percent-encoded. */
  browserUserAgent?: string;
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
  /** Values already hashed (see `hashLicenseKey`). */
  vendorLicenseIds?: Pairs;
  /** Plain text; the builder percent-encodes it. */
  vendorProductName?: string;
  vendorVersion?: Pairs;
  /** Only headers HMRC has agreed you cannot provide (SPEC.md section 5). */
  unavailable?: Partial<Record<HeaderName, MissingDataHandling>>;
}

/** Options of {@link buildFraudPreventionHeaders}. */
export interface BuildOptions {
  /** Run the offline validator and throw on errors. Default true. */
  validate?: boolean;
}

/** Thrown when required data is missing and `unavailable` does not cover it. */
export class MissingFraudDataError extends Error {
  /** Every missing header, in HMRC's order. */
  readonly headers: HeaderName[];
  constructor(headers: HeaderName[]) {
    super(
      `Missing fraud prevention data for: ${headers.join(", ")}. Pass the data, or, only once HMRC has agreed it (see the missing header data guidance), name the header in \`unavailable\`.`,
    );
    this.name = "MissingFraudDataError";
    this.headers = headers;
  }
}

/** Thrown when the built headers fail the offline validator. */
export class InvalidFraudHeadersError extends Error {
  /** The validation result, with `unavailable` headers' missing/empty errors removed. */
  readonly result: ValidationResult;
  constructor(result: ValidationResult) {
    const detail = (result.errors ?? []).map((e) => `${e.headers.join(", ")}: ${e.message}`);
    super(`${result.message}${detail.length > 0 ? ` (${detail.join("; ")})` : ""}`);
    this.name = "InvalidFraudHeadersError";
    this.result = result;
  }
}

const MFA_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z$/;

function multiFactorTimestamp(value: Date | string): string {
  if (typeof value === "string" && MFA_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  return formatTimestamp(value);
}

function present(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

function nonEmpty<T>(value: readonly T[] | undefined): readonly T[] | undefined {
  return value !== undefined && value.length > 0 ? value : undefined;
}

function pairsPresent(pairs: Pairs | undefined): Pairs | undefined {
  if (pairs === undefined) return undefined;
  const count = Array.isArray(pairs) ? pairs.length : Object.keys(pairs).length;
  return count > 0 ? pairs : undefined;
}

type Maker = (input: FraudPreventionInput) => string | undefined;

const MAKERS: Readonly<Record<HeaderName, Maker>> = {
  "Gov-Client-Browser-JS-User-Agent": (i) =>
    present(i.browserUserAgent)
      ? i.browserUserAgent.replace(/[\u0080-\u{10ffff}]+/gu, (run) => percentEncode(run))
      : undefined,
  "Gov-Client-Connection-Method": (i) => i.connectionMethod,
  "Gov-Client-Device-ID": (i) => (present(i.deviceId) ? i.deviceId : undefined),
  "Gov-Client-Local-IPs": (i) => {
    const ips = nonEmpty(i.localIps);
    return ips ? encodeList(ips) : undefined;
  },
  "Gov-Client-Local-IPs-Timestamp": (i) =>
    i.localIpsTimestamp === undefined ? undefined : formatTimestamp(i.localIpsTimestamp),
  "Gov-Client-MAC-Addresses": (i) => {
    const macs = nonEmpty(i.macAddresses);
    return macs ? encodeList(macs) : undefined;
  },
  "Gov-Client-Multi-Factor": (i) => {
    const factors = nonEmpty(i.multiFactor);
    return factors
      ? encodeKeyValueList(
          factors.map((f) => [
            ["type", f.type],
            ["timestamp", multiFactorTimestamp(f.timestamp)],
            ["unique-reference", f.uniqueReference],
          ]),
        )
      : undefined;
  },
  "Gov-Client-Public-IP": (i) => (present(i.publicIp) ? normalizeIp(i.publicIp) : undefined),
  "Gov-Client-Public-IP-Timestamp": (i) =>
    i.publicIpTimestamp === undefined ? undefined : formatTimestamp(i.publicIpTimestamp),
  "Gov-Client-Public-Port": (i) =>
    i.publicPort === undefined || String(i.publicPort) === "" ? undefined : String(i.publicPort),
  "Gov-Client-Screens": (i) => {
    const screens = nonEmpty(i.screens);
    return screens
      ? encodeKeyValueList(
          screens.map((s) => [
            ["width", s.width],
            ["height", s.height],
            ["scaling-factor", s.scalingFactor],
            ["colour-depth", s.colourDepth],
          ]),
        )
      : undefined;
  },
  "Gov-Client-Timezone": (i) => (present(i.timezone) ? i.timezone : undefined),
  "Gov-Client-User-Agent": (i) =>
    i.userAgent
      ? encodeKeyValue([
          ["os-family", i.userAgent.osFamily],
          ["os-version", i.userAgent.osVersion],
          ["device-manufacturer", i.userAgent.deviceManufacturer],
          ["device-model", i.userAgent.deviceModel],
        ])
      : undefined,
  "Gov-Client-User-IDs": (i) => {
    const ids = pairsPresent(i.userIds);
    return ids ? encodeKeyValue(ids) : undefined;
  },
  "Gov-Client-Window-Size": (i) =>
    i.windowSize
      ? encodeKeyValue([
          ["width", i.windowSize.width],
          ["height", i.windowSize.height],
        ])
      : undefined,
  "Gov-Vendor-Forwarded": (i) => {
    const hops = nonEmpty(i.vendorForwarded);
    return hops
      ? encodeKeyValueList(
          hops.map((h) => [
            ["by", normalizeIp(h.by)],
            ["for", normalizeIp(h.for)],
          ]),
        )
      : undefined;
  },
  "Gov-Vendor-License-IDs": (i) => {
    const ids = pairsPresent(i.vendorLicenseIds);
    return ids ? encodeKeyValue(ids) : undefined;
  },
  "Gov-Vendor-Product-Name": (i) =>
    present(i.vendorProductName) ? percentEncode(i.vendorProductName) : undefined,
  "Gov-Vendor-Public-IP": (i) =>
    present(i.vendorPublicIp) ? normalizeIp(i.vendorPublicIp) : undefined,
  "Gov-Vendor-Version": (i) => {
    const versions = pairsPresent(i.vendorVersion);
    return versions ? encodeKeyValue(versions) : undefined;
  },
};

function withoutUnavailable(
  result: ValidationResult,
  unavailable: Partial<Record<HeaderName, MissingDataHandling>>,
): ValidationResult {
  const covered = new Set(Object.keys(unavailable).map((h) => h.toLowerCase()));
  const keep = (issue: ValidationIssue): boolean =>
    !(
      (issue.code === "MISSING_HEADER" || issue.code === "EMPTY_HEADER") &&
      issue.headers.every((h) => covered.has(h))
    );
  const errors = (result.errors ?? []).filter(keep);
  const { errors: _dropped, ...rest } = result;
  return errors.length > 0 ? { ...rest, errors } : { ...rest };
}

/**
 * Builds the fraud prevention headers of one connection method from typed data, in HMRC's
 * header order and with HMRC's casing. Only the headers that method sends are produced.
 *
 * Data that is missing and not named in `input.unavailable` raises {@link MissingFraudDataError}
 * listing every such header; nothing is ever filled with a placeholder. With `validate` on (the
 * default) the result also goes through the offline validator and any error raises
 * {@link InvalidFraudHeadersError}; missing or empty errors on headers named in `unavailable`
 * are ignored.
 */
export function buildFraudPreventionHeaders(
  input: FraudPreventionInput,
  options: BuildOptions = {},
): Record<HeaderName, string> {
  const required = REQUIRED_HEADERS[input.connectionMethod] as readonly HeaderName[] | undefined;
  if (!required) {
    throw new TypeError(
      `Unknown connectionMethod ${JSON.stringify(input.connectionMethod)}: expected one of ${Object.keys(REQUIRED_HEADERS).join(", ")}`,
    );
  }
  const unavailable = input.unavailable ?? {};
  const out: Partial<Record<HeaderName, string>> = {};
  const missing: HeaderName[] = [];
  for (const header of required) {
    const value = MAKERS[header](input);
    if (value !== undefined) {
      out[header] = value;
      continue;
    }
    const handling = unavailable[header];
    if (handling === "empty") out[header] = "";
    else if (handling !== "omit") missing.push(header);
  }
  if (missing.length > 0) throw new MissingFraudDataError(missing);

  if (options.validate !== false) {
    const result = withoutUnavailable(validateFraudPreventionHeaders(out), unavailable);
    if (result.errors !== undefined && result.errors.length > 0) {
      throw new InvalidFraudHeadersError(result);
    }
  }
  return out as Record<HeaderName, string>;
}

/**
 * Builds `Gov-Vendor-Forwarded` hops from the client's public IP and the public IPs of the
 * servers in the order the request crosses them: `[{by: s1, for: client}, {by: s2, for: s1}, ...]`.
 * Throws a RangeError when `servers` is empty.
 */
export function buildForwardedChain(
  clientPublicIp: string,
  servers: readonly string[],
): ForwardedHop[] {
  if (servers.length === 0) {
    throw new RangeError("buildForwardedChain needs at least one server");
  }
  let previous = clientPublicIp;
  return servers.map((server) => {
    const hop = { by: server, for: previous };
    previous = server;
    return hop;
  });
}
