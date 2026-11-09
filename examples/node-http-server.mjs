// A server behind one proxy: the proxy sets X-Forwarded-For and forwards the client's TCP source
// port in X-Client-Port. Starts on a free local port, sends itself one request, then stops.
import { createServer, request } from "node:http";
import {
  buildFraudPreventionHeaders,
  requestFraudData,
  validateFraudPreventionHeaders,
} from "hmrc-fraud-prevention-headers";

const server = createServer((req, res) => {
  const seen = requestFraudData(
    {
      remoteAddress: req.socket.remoteAddress,
      remotePort: req.socket.remotePort,
      headers: req.headers,
    },
    { trustedProxies: 1, clientPortHeader: "x-client-port", vendorPublicIp: "81.2.69.160" },
  );
  // Only the browser's own fields are taken from what the browser sent.
  const { deviceId, screens, windowSize, timezone, browserUserAgent } = JSON.parse(
    req.headers["x-fraud-data"],
  );
  const headers = buildFraudPreventionHeaders({
    deviceId,
    screens,
    windowSize,
    timezone,
    browserUserAgent,
    ...seen,
    connectionMethod: "WEB_APP_VIA_SERVER",
    userIds: { "my-tax-app": "alice123" },
    multiFactor: [{ type: "TOTP", timestamp: new Date(), uniqueReference: "a1b2c3d4e5f60718" }],
    vendorLicenseIds: {
      "my-tax-app": "8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1",
    },
    vendorProductName: "My Tax App",
    vendorVersion: { "my-tax-app-web": "1.4.0" },
  });
  res.end(JSON.stringify({ headers, code: validateFraudPreventionHeaders(headers).code }));
});

server.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  const browser = {
    deviceId: "3f1b6c2e-8f4a-4b1e-9d2c-7a5e0c9b1d42",
    screens: [{ width: 1920, height: 1080, scalingFactor: 1, colourDepth: 24 }],
    windowSize: { width: 1256, height: 803 },
    timezone: "UTC+01:00",
    browserUserAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  };
  const req = request(
    {
      port,
      host: "127.0.0.1",
      headers: {
        "x-forwarded-for": "81.2.69.142",
        "x-client-port": "51123",
        "x-fraud-data": JSON.stringify(browser),
      },
    },
    (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        const { headers, code } = JSON.parse(body);
        console.log(headers["Gov-Client-Public-IP"], headers["Gov-Client-Public-Port"]);
        console.log(headers["Gov-Vendor-Forwarded"]);
        console.log(code);
        server.close();
      });
    },
  );
  req.end();
});
