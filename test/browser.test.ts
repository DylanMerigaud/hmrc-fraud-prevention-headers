import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  type BrowserLike,
  collectBrowserFraudData,
  createDeviceId,
  getOrCreateDeviceId,
} from "../src/browser.js";
import { buildFraudPreventionHeaders } from "../src/build.js";
import { requestFraudData } from "../src/request.js";
import { validateFraudPreventionHeaders } from "../src/validate.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/118.0 Safari/537.36";

function fakeWindow(overrides: Partial<BrowserLike> = {}): BrowserLike {
  const store = new Map<string, string>();
  return {
    screen: { width: 1920, height: 1080, colorDepth: 24 },
    devicePixelRatio: 1.25,
    innerWidth: 1256,
    innerHeight: 803,
    navigator: { userAgent: UA },
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
    },
    crypto: globalThis.crypto,
    ...overrides,
  };
}

test("collects the exact object", () => {
  const d = collectBrowserFraudData({ window: fakeWindow() });
  const { deviceId, timezone, ...rest } = d;
  assert.match(deviceId, UUID);
  assert.match(timezone, /^UTC[+-]\d{2}:\d{2}$/);
  assert.deepEqual(rest, {
    screens: [{ width: 1920, height: 1080, scalingFactor: 1.25, colourDepth: 24 }],
    windowSize: { width: 1256, height: 803 },
    browserUserAgent: UA,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(d)), d);
});

test("rounds the window and defaults the scaling factor to 1", () => {
  const d = collectBrowserFraudData({
    window: fakeWindow({ innerWidth: 1256.4, innerHeight: 802.6, devicePixelRatio: 0 }),
  });
  assert.deepEqual(d.windowSize, { width: 1256, height: 803 });
  assert.equal(d.screens[0]?.scalingFactor, 1);
});

test("the device id persists across calls under the storage key", () => {
  const w = fakeWindow();
  const a = collectBrowserFraudData({ window: w }).deviceId;
  const b = collectBrowserFraudData({ window: w }).deviceId;
  assert.equal(a, b);
  assert.equal(w.localStorage?.getItem("hmrc-fph-device-id"), a);
  const c = collectBrowserFraudData({ window: w, storageKey: "other" }).deviceId;
  assert.notEqual(c, a);
});

test("storage that throws still gives a UUID", () => {
  const w = fakeWindow({
    localStorage: {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    },
  });
  assert.match(collectBrowserFraudData({ window: w }).deviceId, UUID);
  assert.match(getOrCreateDeviceId(undefined), UUID);
});

test("a stored value that is not a UUID is replaced", () => {
  const w = fakeWindow();
  w.localStorage?.setItem("hmrc-fph-device-id", "junk");
  const id = collectBrowserFraudData({ window: w }).deviceId;
  assert.match(id, UUID);
  assert.equal(w.localStorage?.getItem("hmrc-fph-device-id"), id);
});

test("getOrCreateDeviceId uses the injected random", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  assert.equal(
    getOrCreateDeviceId(storage, "k", () => "beec798b-b366-47fa-b1f8-92cede14a1ce"),
    "beec798b-b366-47fa-b1f8-92cede14a1ce",
  );
  assert.equal(
    getOrCreateDeviceId(storage, "k", () => "x"),
    "beec798b-b366-47fa-b1f8-92cede14a1ce",
  );
});

test("createDeviceId: randomUUID, getRandomValues fallback, nothing throws", () => {
  assert.match(createDeviceId(), UUID);
  const g = globalThis as { crypto?: unknown };
  const saved = g.crypto;
  try {
    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: (a: Uint8Array) => {
          a.fill(0xff);
          return a;
        },
      },
      configurable: true,
    });
    assert.equal(createDeviceId(), "ffffffff-ffff-4fff-bfff-ffffffffffff");
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    assert.throws(() => createDeviceId(), Error);
  } finally {
    Object.defineProperty(globalThis, "crypto", {
      value: saved,
      configurable: true,
      writable: true,
    });
  }
});

test("no window available throws a clear error", () => {
  assert.throws(() => collectBrowserFraudData(), /browser|window/);
  assert.throws(() => collectBrowserFraudData(), /`window`/);
});

test("output passes the builder", () => {
  const browser = collectBrowserFraudData({ window: fakeWindow() });
  const server = requestFraudData(
    { remoteAddress: "::ffff:81.2.69.142", remotePort: 51123, headers: {} },
    { vendorPublicIp: "81.2.69.160" },
  );
  const headers = buildFraudPreventionHeaders({
    connectionMethod: "WEB_APP_VIA_SERVER",
    ...browser,
    ...server,
    userIds: { "my-application": "alice123" },
    multiFactor: [
      {
        type: "TOTP",
        timestamp: "2021-11-21T13:20Z",
        uniqueReference: "0283da60063abfb3a87f1aed845d17fe2d9ba8c780b478dc4ae048f5ee97a6d5",
      },
    ],
    vendorLicenseIds: {
      "my-application": "8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1",
    },
    vendorProductName: "My Product",
    vendorVersion: { "my-web-app": "2.2.2" },
  });
  assert.equal(validateFraudPreventionHeaders(headers).code, "VALID_HEADERS");
});
