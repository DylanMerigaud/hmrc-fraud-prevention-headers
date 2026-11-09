import { sha256Hex } from "./sha256.js";

/** Hashes a license key for Gov-Vendor-License-IDs: SHA-256 as uppercase hex. */
export function hashLicenseKey(key: string): string {
  return sha256Hex(key).toUpperCase();
}
