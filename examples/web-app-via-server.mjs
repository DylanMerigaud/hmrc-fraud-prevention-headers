// WEB_APP_VIA_SERVER: the browser posts what it collected, the server adds what it saw.
import {
  buildFraudPreventionHeaders,
  hashLicenseKey,
  validateFraudPreventionHeaders,
} from "hmrc-fraud-prevention-headers";

// What collectBrowserFraudData() returned in the user's browser, posted to your server as JSON.
const fromBrowser = {
  deviceId: "3f1b6c2e-8f4a-4b1e-9d2c-7a5e0c9b1d42",
  screens: [{ width: 2560, height: 1440, scalingFactor: 1.5, colourDepth: 24 }],
  windowSize: { width: 1707, height: 960 },
  timezone: "UTC+00:00",
  browserUserAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
};

// What your server knows about the request and the signed-in user.
const fromServer = {
  publicIp: "81.2.69.142",
  publicPort: 51123,
  publicIpTimestamp: new Date(),
  vendorPublicIp: "81.2.69.160",
  vendorForwarded: [{ by: "81.2.69.160", for: "81.2.69.142" }],
  userIds: { "my-tax-app": "alice@example.com" },
  multiFactor: [
    { type: "TOTP", timestamp: new Date(), uniqueReference: hashLicenseKey("totp-secret-id-42") },
  ],
  vendorLicenseIds: { "my-tax-app": hashLicenseKey("LICENCE-KEY-0001") },
  vendorProductName: "My Tax App",
  vendorVersion: { "my-tax-app-web": "1.4.0" },
};

const headers = buildFraudPreventionHeaders({
  connectionMethod: "WEB_APP_VIA_SERVER",
  ...fromBrowser,
  ...fromServer,
});

for (const [name, value] of Object.entries(headers)) console.log(`${name}: ${value}`);
console.log(validateFraudPreventionHeaders(headers).code);
