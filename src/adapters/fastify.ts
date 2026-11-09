import { type RequestFraudData, type RequestOptions, requestFraudData } from "../request.js";

/** The structural subset of a Fastify request that is read. */
export interface FastifyRequestLike {
  raw: { socket?: { remoteAddress?: string; remotePort?: number } };
  headers: Record<string, string | readonly string[] | undefined>;
}

/** Reads the fraud prevention data of a Fastify request: `request.raw.socket` and `request.headers`. */
export function fromFastify(
  request: FastifyRequestLike,
  options?: RequestOptions,
): RequestFraudData {
  const socket = request.raw?.socket;
  return requestFraudData(
    {
      ...(socket?.remoteAddress !== undefined && { remoteAddress: socket.remoteAddress }),
      ...(socket?.remotePort !== undefined && { remotePort: socket.remotePort }),
      headers: request.headers ?? {},
    },
    options,
  );
}
