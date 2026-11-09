import { type RequestFraudData, type RequestOptions, requestFraudData } from "../request.js";

interface SocketLike {
  remoteAddress?: string;
  remotePort?: number;
}

/** The structural subset of an Express (or `node:http`) request that is read. */
export interface ExpressRequestLike {
  socket?: SocketLike;
  connection?: SocketLike;
  headers: Record<string, string | readonly string[] | undefined>;
}

/** Reads the fraud prevention data of an Express request: socket address, port and headers. */
export function fromExpress(req: ExpressRequestLike, options?: RequestOptions): RequestFraudData {
  const socket = req.socket ?? req.connection;
  return requestFraudData(
    {
      ...(socket?.remoteAddress !== undefined && { remoteAddress: socket.remoteAddress }),
      ...(socket?.remotePort !== undefined && { remotePort: socket.remotePort }),
      headers: req.headers ?? {},
    },
    options,
  );
}
