import { type RequestFraudData, type RequestOptions, requestFraudData } from "../request.js";

/** The structural subset of a Hono context that is read. */
export interface HonoContextLike {
  req: { raw: { headers: { forEach(cb: (value: string, key: string) => void): void } } };
}

/** Options of {@link fromHono}. */
export interface HonoOptions extends RequestOptions {
  /**
   * The result of Hono's `getConnInfo(c)`. Needed: without it there is no socket address, so
   * `publicIp` and `publicPort` are undefined, also behind `trustedProxies`.
   */
  connInfo?: { remote: { address?: string; port?: number } };
}

/**
 * Reads the fraud prevention data of a Hono request. Headers come from `c.req.raw.headers`;
 * Hono does not expose the socket, so the address and port come from `options.connInfo`; pass
 * it, or the result has no `publicIp` and no `publicPort`.
 */
export function fromHono(c: HonoContextLike, options: HonoOptions = {}): RequestFraudData {
  const { connInfo, ...rest } = options;
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const remote = connInfo?.remote;
  return requestFraudData(
    {
      ...(remote?.address !== undefined && { remoteAddress: remote.address }),
      ...(remote?.port !== undefined && { remotePort: remote.port }),
      headers,
    },
    rest,
  );
}
