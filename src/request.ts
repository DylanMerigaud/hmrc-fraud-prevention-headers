import { type ForwardedHop, buildForwardedChain } from "./build.js";
import { ipVersion, normalizeIp } from "./ip.js";
import { formatTimestamp } from "./time.js";

/** What a request tells the server about its client, independent of the web framework. */
export interface RequestFacts {
  /** Address of the TCP peer (the socket), as the runtime reports it. */
  remoteAddress?: string;
  /** TCP source port of the peer. */
  remotePort?: number;
  /** Request headers; lookup is case-insensitive, an array value is joined with ",". */
  headers: Record<string, string | readonly string[] | undefined>;
  /** When the request arrived. Defaults to now. */
  receivedAt?: Date;
}

/** Options of {@link requestFraudData}. */
export interface RequestOptions {
  /** Hops of `X-Forwarded-For` to trust from the right. Default 0: the socket address is the client. */
  trustedProxies?: number;
  /** Header your edge sets with the client's TCP source port, for example `x-client-port`. */
  clientPortHeader?: string;
  /** Public IP your DNS points at (WAF, load balancer). */
  vendorPublicIp?: string;
  /** Public IPs of further TLS-terminating hops after `vendorPublicIp`. */
  forwardedServers?: readonly string[];
}

/** Request-derived fraud prevention data; spread it into `FraudPreventionInput`. */
export interface RequestFraudData {
  publicIp?: string;
  publicPort?: number;
  publicIpTimestamp: string;
  vendorPublicIp?: string;
  vendorForwarded?: ForwardedHop[];
}

function headerValue(
  headers: Record<string, string | readonly string[] | undefined>,
  name: string,
): string | undefined {
  const wanted = name.toLowerCase();
  const parts: string[] = [];
  for (const key of Object.keys(headers ?? {})) {
    if (key.toLowerCase() !== wanted) continue;
    const v = headers[key];
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) {
      for (const item of v) if (typeof item === "string") parts.push(item);
    }
  }
  return parts.length > 0 ? parts.join(",") : undefined;
}

function cleanIp(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const ip = normalizeIp(value);
  return ipVersion(ip) === 0 ? undefined : ip;
}

function validPort(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : undefined;
}

/**
 * Reads the client's public IP, port and the request timestamp from a request.
 *
 * With `trustedProxies` 0 the socket address and port are used and `X-Forwarded-For` is ignored,
 * so a client cannot spoof its address. With `trustedProxies` N the client is the entry N
 * positions from the right of the list `X-Forwarded-For` entries then the socket address
 * (clamped to the first entry); its port is only known through `clientPortHeader`. A value that
 * is not an IP gives no `publicIp`. Never throws on odd input.
 */
export function requestFraudData(
  facts: RequestFacts,
  options: RequestOptions = {},
): RequestFraudData {
  const trusted = Math.max(0, Math.floor(options.trustedProxies ?? 0)) || 0;
  const headers = facts.headers ?? {};
  let publicIp: string | undefined;
  let publicPort: number | undefined;

  if (trusted === 0) {
    publicIp = cleanIp(facts.remoteAddress);
    publicPort = validPort(facts.remotePort);
  } else {
    const list = (headerValue(headers, "x-forwarded-for") ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e !== "")
      .map((e) => normalizeIp(e));
    if (typeof facts.remoteAddress === "string" && facts.remoteAddress.trim() !== "") {
      list.push(normalizeIp(facts.remoteAddress));
    }
    publicIp = cleanIp(list[Math.max(0, list.length - 1 - trusted)]);
    if (options.clientPortHeader !== undefined) {
      const raw = headerValue(headers, options.clientPortHeader)?.trim();
      if (raw !== undefined && /^[0-9]{1,5}$/.test(raw)) publicPort = validPort(Number(raw));
    }
  }

  const out: RequestFraudData = {
    publicIpTimestamp: formatTimestamp(facts.receivedAt ?? new Date()),
  };
  if (publicIp !== undefined) out.publicIp = publicIp;
  if (publicPort !== undefined) out.publicPort = publicPort;
  if (options.vendorPublicIp !== undefined) {
    out.vendorPublicIp = options.vendorPublicIp;
    if (publicIp !== undefined) {
      out.vendorForwarded = buildForwardedChain(publicIp, [
        options.vendorPublicIp,
        ...(options.forwardedServers ?? []),
      ]);
    }
  }
  return out;
}
