// DESKTOP_APP_DIRECT: a desktop application calling HMRC itself, no server of yours in between.
import {
  buildFraudPreventionHeaders,
  formatTimestamp,
  localTimezone,
} from "hmrc-fraud-prevention-headers";

const headers = buildFraudPreventionHeaders({
  connectionMethod: "DESKTOP_APP_DIRECT",
  deviceId: "9a7c0e55-2b7d-4c41-a3f6-0d0e4b6a8c11",
  localIps: ["192.168.1.24", "fe80::1c2b:3aff:fe4d:5e6f"],
  localIpsTimestamp: formatTimestamp(new Date()),
  macAddresses: ["3c:22:fb:7a:10:9e"],
  multiFactor: [
    { type: "AUTH_CODE", timestamp: new Date(), uniqueReference: "c0ffee5a1t3dha5h0fph0n3" },
  ],
  screens: [{ width: 1920, height: 1080, scalingFactor: 1, colourDepth: 24 }],
  windowSize: { width: 1280, height: 800 },
  timezone: localTimezone(),
  userAgent: {
    osFamily: "Windows",
    osVersion: "11",
    deviceManufacturer: "Lenovo",
    deviceModel: "ThinkPad X1 Carbon",
  },
  userIds: { os: "LAPTOP\\alice", "my-desktop-app": "alice123" },
  vendorLicenseIds: {
    "my-desktop-app": "3D5F0B6C9E2A41B8A7C4E1D2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A2",
  },
  vendorProductName: "My Desktop Tax App",
  vendorVersion: { "my-desktop-app": "3.2.1" },
});

console.log(headers["Gov-Client-User-Agent"]);
console.log(headers["Gov-Client-User-IDs"]);
console.log(headers["Gov-Client-Local-IPs"]);
