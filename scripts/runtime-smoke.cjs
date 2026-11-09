// Requires the built CommonJS package and builds and validates one header set. Run by CI on Node.
const {
  buildFraudPreventionHeaders,
  validateFraudPreventionHeaders,
} = require("../dist/cjs/index.js");

const headers = buildFraudPreventionHeaders({
  connectionMethod: "MOBILE_APP_DIRECT",
  deviceId: "9a7c0e55-2b7d-4c41-a3f6-0d0e4b6a8c11",
  localIps: ["10.0.0.12"],
  localIpsTimestamp: new Date(),
  multiFactor: [{ type: "TOTP", timestamp: new Date(), uniqueReference: "a1b2c3d4e5f60718" }],
  screens: [{ width: 390, height: 844, scalingFactor: 3, colourDepth: 32 }],
  windowSize: { width: 390, height: 844 },
  timezone: "UTC+00:00",
  userAgent: {
    osFamily: "iOS",
    osVersion: "18.1",
    deviceManufacturer: "Apple",
    deviceModel: "iPhone14,7",
  },
  userIds: { "my-mobile-app": "alice123" },
  vendorLicenseIds: {
    "my-mobile-app": "8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1",
  },
  vendorProductName: "My Mobile Tax App",
  vendorVersion: { "my-mobile-app": "2.0.0" },
});
const { code } = validateFraudPreventionHeaders(headers);
if (code !== "VALID_HEADERS") throw new Error(`expected VALID_HEADERS, got ${code}`);
console.log(`cjs ${code} ${headers["Gov-Client-User-Agent"]}`);
