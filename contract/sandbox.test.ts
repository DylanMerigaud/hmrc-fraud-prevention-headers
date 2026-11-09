/**
 * Live contract: HMRC's Test Fraud Prevention Headers API agrees with the offline validator.
 *
 * Needs sandbox application credentials (HMRC Developer Hub, an application subscribed to the
 * Test Fraud Prevention Headers API) in HMRC_CLIENT_ID and HMRC_CLIENT_SECRET; skipped without
 * them. Run weekly by .github/workflows/contract.yml.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { type FraudPreventionInput, buildFraudPreventionHeaders } from "../src/build.js";
import { CONNECTION_METHODS, type ConnectionMethod } from "../src/spec.js";
import { validateFraudPreventionHeaders } from "../src/validate.js";

const BASE = "https://test-api.service.hmrc.gov.uk";
const id = process.env.HMRC_CLIENT_ID;
const secret = process.env.HMRC_CLIENT_SECRET;
const skip = id && secret ? false : "HMRC_CLIENT_ID and HMRC_CLIENT_SECRET are not set";

async function token(): Promise<string> {
  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id ?? "",
      client_secret: secret ?? "",
    }),
  });
  assert.equal(res.status, 200, `token endpoint answered ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** A realistic input for every method; the builder keeps only the headers each method sends. */
function input(method: ConnectionMethod): FraudPreventionInput {
  const now = new Date();
  return {
    connectionMethod: method,
    deviceId: "3f1b6c2e-8f4a-4b1e-9d2c-7a5e0c9b1d42",
    userIds:
      method.startsWith("DESKTOP") || method.startsWith("OTHER") || method.startsWith("BATCH")
        ? { os: "alice", "hmrc-fph-contract": "alice123" }
        : { "hmrc-fph-contract": "alice123" },
    timezone: "UTC+00:00",
    screens: [{ width: 1920, height: 1080, scalingFactor: 1, colourDepth: 24 }],
    windowSize: { width: 1256, height: 803 },
    browserUserAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    userAgent: {
      osFamily: "Linux",
      osVersion: "6.8",
      deviceManufacturer: "Dell Inc.",
      deviceModel: "OptiPlex 7090",
    },
    localIps: ["10.1.2.3"],
    localIpsTimestamp: now,
    macAddresses: ["3c:22:fb:7a:10:9e"],
    multiFactor: [{ type: "TOTP", timestamp: now, uniqueReference: "a1b2c3d4e5f60718a1b2c3d4" }],
    publicIp: "81.2.69.142",
    publicIpTimestamp: now,
    publicPort: 51123,
    vendorPublicIp: "81.2.69.160",
    vendorForwarded: [{ by: "81.2.69.160", for: "81.2.69.142" }],
    vendorLicenseIds: {
      "hmrc-fph-contract": "8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1",
    },
    vendorProductName: "hmrc-fraud-prevention-headers contract",
    vendorVersion: { "hmrc-fph-contract-client": "0.1.0", "hmrc-fph-contract-server": "0.1.0" },
  };
}

test(
  "HMRC's sandbox validator returns the offline validator's code for every method",
  { skip },
  async () => {
    const bearer = await token();
    for (const method of CONNECTION_METHODS) {
      const headers = buildFraudPreventionHeaders(input(method), { validate: false });
      const res = await fetch(`${BASE}/test/fraud-prevention-headers/validate`, {
        headers: {
          accept: "application/vnd.hmrc.1.0+json",
          authorization: `Bearer ${bearer}`,
          ...headers,
        },
      });
      assert.equal(res.status, 200, `${method}: validate answered ${res.status}`);
      const hmrc = (await res.json()) as { code: string; errors?: unknown; warnings?: unknown };
      const ours = validateFraudPreventionHeaders(headers);
      assert.equal(ours.code, hmrc.code, `${method}: HMRC said ${JSON.stringify(hmrc)}`);
    }
  },
);
