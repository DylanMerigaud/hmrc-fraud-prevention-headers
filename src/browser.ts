import type { Screen, WindowSize } from "./build.js";
import { formatTimezone } from "./time.js";

/** The structural subset of `window` that {@link collectBrowserFraudData} reads. */
export interface BrowserLike {
  screen: { width: number; height: number; colorDepth: number };
  devicePixelRatio?: number;
  innerWidth: number;
  innerHeight: number;
  navigator: { userAgent: string };
  localStorage?: StorageLike;
  crypto?: CryptoLike;
}

/** The subset of `Storage` used to persist the device id. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The subset of Web Crypto used to create a device id. */
export interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => unknown;
}

/** Browser-side fraud prevention data, plain JSON with the builder's field names. */
export interface BrowserFraudData {
  deviceId: string;
  /** One entry: browsers expose only the screen the window is on. */
  screens: Screen[];
  windowSize: WindowSize;
  timezone: string;
  browserUserAgent: string;
}

/** Options of {@link collectBrowserFraudData}. */
export interface CollectOptions {
  /** The window to read. Defaults to the global `window`. */
  window?: BrowserLike;
  /** `localStorage` key of the device id. Default `hmrc-fph-device-id`. */
  storageKey?: string;
}

const DEFAULT_KEY = "hmrc-fph-device-id";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function globalCrypto(): CryptoLike | undefined {
  return (globalThis as { crypto?: CryptoLike }).crypto;
}

/**
 * Creates a lowercase v4 UUID with `crypto.randomUUID`, or, when that is missing, from
 * `crypto.getRandomValues`. Defaults to the global `crypto`, which Node 18 does not define: pass
 * a Web Crypto object there. Throws an Error when neither function is available.
 */
export function createDeviceId(crypto: CryptoLike | undefined = globalCrypto()): string {
  if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID().toLowerCase();
  if (crypto && typeof crypto.getRandomValues === "function") {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = ((b[6] as number) & 0x0f) | 0x40;
    b[8] = ((b[8] as number) & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  throw new Error(
    'createDeviceId needs crypto.randomUUID or crypto.getRandomValues: pass a Web Crypto object (on Node 18, `require("node:crypto").webcrypto`)',
  );
}

/**
 * Returns the device id stored under `key`, creating and storing one when absent or not a UUID.
 * Storage that is missing or throws (private mode) gives a fresh id for this call only.
 */
export function getOrCreateDeviceId(
  storage: StorageLike | undefined,
  key: string = DEFAULT_KEY,
  random: () => string = createDeviceId,
): string {
  try {
    const existing = storage?.getItem(key);
    if (typeof existing === "string" && UUID.test(existing)) return existing;
  } catch {
    // storage unavailable: fall through to a fresh id
  }
  const id = random();
  try {
    storage?.setItem(key, id);
  } catch {
    // not persisted: the id is valid for this call
  }
  return id;
}

/**
 * Collects the browser-side data of `WEB_APP_VIA_SERVER`: device id, screen, window size,
 * timezone and user agent. Send it to your server and spread it into `FraudPreventionInput`.
 * Browsers expose only the current screen, so `screens` has one entry. Throws an Error when no
 * window is available: run it in a browser or pass `window`.
 */
export function collectBrowserFraudData(options: CollectOptions = {}): BrowserFraudData {
  const w = options.window ?? (globalThis as { window?: BrowserLike }).window;
  if (!w) {
    throw new Error(
      "collectBrowserFraudData must run in a browser or be given `window` in its options",
    );
  }
  let storage: StorageLike | undefined;
  try {
    // sandboxed iframes throw a SecurityError on the property access itself
    storage = w.localStorage;
  } catch {
    storage = undefined;
  }
  return {
    deviceId: getOrCreateDeviceId(storage, options.storageKey ?? DEFAULT_KEY, () =>
      createDeviceId(w.crypto ?? globalCrypto()),
    ),
    screens: [
      {
        width: w.screen.width,
        height: w.screen.height,
        scalingFactor: w.devicePixelRatio || 1,
        colourDepth: w.screen.colorDepth,
      },
    ],
    windowSize: { width: Math.round(w.innerWidth), height: Math.round(w.innerHeight) },
    timezone: formatTimezone(-new Date().getTimezoneOffset()),
    browserUserAgent: w.navigator.userAgent,
  };
}
