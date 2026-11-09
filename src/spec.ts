/** HMRC fraud prevention headers specification version implemented. */
export const SPEC_VERSION = "3.3";

/** The eight connection methods HMRC defines. */
export type ConnectionMethod =
  | "WEB_APP_VIA_SERVER"
  | "DESKTOP_APP_DIRECT"
  | "DESKTOP_APP_VIA_SERVER"
  | "MOBILE_APP_DIRECT"
  | "MOBILE_APP_VIA_SERVER"
  | "BATCH_PROCESS_DIRECT"
  | "OTHER_DIRECT"
  | "OTHER_VIA_SERVER";

/** The eight connection methods, in the order of the specification. */
export const CONNECTION_METHODS: readonly ConnectionMethod[] = [
  "WEB_APP_VIA_SERVER",
  "DESKTOP_APP_DIRECT",
  "DESKTOP_APP_VIA_SERVER",
  "MOBILE_APP_DIRECT",
  "MOBILE_APP_VIA_SERVER",
  "BATCH_PROCESS_DIRECT",
  "OTHER_DIRECT",
  "OTHER_VIA_SERVER",
];

/** Every fraud prevention header name that at least one connection method sends. */
export type HeaderName =
  | "Gov-Client-Browser-JS-User-Agent"
  | "Gov-Client-Connection-Method"
  | "Gov-Client-Device-ID"
  | "Gov-Client-Local-IPs"
  | "Gov-Client-Local-IPs-Timestamp"
  | "Gov-Client-MAC-Addresses"
  | "Gov-Client-Multi-Factor"
  | "Gov-Client-Public-IP"
  | "Gov-Client-Public-IP-Timestamp"
  | "Gov-Client-Public-Port"
  | "Gov-Client-Screens"
  | "Gov-Client-Timezone"
  | "Gov-Client-User-Agent"
  | "Gov-Client-User-IDs"
  | "Gov-Client-Window-Size"
  | "Gov-Vendor-Forwarded"
  | "Gov-Vendor-License-IDs"
  | "Gov-Vendor-Product-Name"
  | "Gov-Vendor-Public-IP"
  | "Gov-Vendor-Version";

/** The 20 header names, in alphabetical order. */
export const HEADER_NAMES: readonly HeaderName[] = [
  "Gov-Client-Browser-JS-User-Agent",
  "Gov-Client-Connection-Method",
  "Gov-Client-Device-ID",
  "Gov-Client-Local-IPs",
  "Gov-Client-Local-IPs-Timestamp",
  "Gov-Client-MAC-Addresses",
  "Gov-Client-Multi-Factor",
  "Gov-Client-Public-IP",
  "Gov-Client-Public-IP-Timestamp",
  "Gov-Client-Public-Port",
  "Gov-Client-Screens",
  "Gov-Client-Timezone",
  "Gov-Client-User-Agent",
  "Gov-Client-User-IDs",
  "Gov-Client-Window-Size",
  "Gov-Vendor-Forwarded",
  "Gov-Vendor-License-IDs",
  "Gov-Vendor-Product-Name",
  "Gov-Vendor-Public-IP",
  "Gov-Vendor-Version",
];

/** Headers each connection method must send, in HMRC's page order. */
export const REQUIRED_HEADERS: Readonly<Record<ConnectionMethod, readonly HeaderName[]>> = {
  WEB_APP_VIA_SERVER: [
    "Gov-Client-Connection-Method",
    "Gov-Client-Browser-JS-User-Agent",
    "Gov-Client-Device-ID",
    "Gov-Client-Multi-Factor",
    "Gov-Client-Public-IP",
    "Gov-Client-Public-IP-Timestamp",
    "Gov-Client-Public-Port",
    "Gov-Client-Screens",
    "Gov-Client-Timezone",
    "Gov-Client-User-IDs",
    "Gov-Client-Window-Size",
    "Gov-Vendor-Forwarded",
    "Gov-Vendor-License-IDs",
    "Gov-Vendor-Product-Name",
    "Gov-Vendor-Public-IP",
    "Gov-Vendor-Version",
  ],
  DESKTOP_APP_DIRECT: [
    "Gov-Client-Connection-Method",
    "Gov-Client-Device-ID",
    "Gov-Client-Local-IPs",
    "Gov-Client-Local-IPs-Timestamp",
    "Gov-Client-MAC-Addresses",
    "Gov-Client-Multi-Factor",
    "Gov-Client-Screens",
    "Gov-Client-Timezone",
    "Gov-Client-User-Agent",
    "Gov-Client-User-IDs",
    "Gov-Client-Window-Size",
    "Gov-Vendor-License-IDs",
    "Gov-Vendor-Product-Name",
    "Gov-Vendor-Version",
  ],
  DESKTOP_APP_VIA_SERVER: [
    "Gov-Client-Connection-Method",
    "Gov-Client-Device-ID",
    "Gov-Client-Local-IPs",
    "Gov-Client-Local-IPs-Timestamp",
    "Gov-Client-MAC-Addresses",
    "Gov-Client-Multi-Factor",
    "Gov-Client-Public-IP",
    "Gov-Client-Public-IP-Timestamp",
    "Gov-Client-Public-Port",
    "Gov-Client-Screens",
    "Gov-Client-Timezone",
    "Gov-Client-User-Agent",
    "Gov-Client-User-IDs",
    "Gov-Client-Window-Size",
    "Gov-Vendor-Forwarded",
    "Gov-Vendor-License-IDs",
    "Gov-Vendor-Product-Name",
    "Gov-Vendor-Public-IP",
    "Gov-Vendor-Version",
  ],
  MOBILE_APP_DIRECT: [
    "Gov-Client-Connection-Method",
    "Gov-Client-Device-ID",
    "Gov-Client-Local-IPs",
    "Gov-Client-Local-IPs-Timestamp",
    "Gov-Client-Multi-Factor",
    "Gov-Client-Screens",
    "Gov-Client-Timezone",
    "Gov-Client-User-Agent",
    "Gov-Client-User-IDs",
    "Gov-Client-Window-Size",
    "Gov-Vendor-License-IDs",
    "Gov-Vendor-Product-Name",
    "Gov-Vendor-Version",
  ],
  MOBILE_APP_VIA_SERVER: [
    "Gov-Client-Connection-Method",
    "Gov-Client-Device-ID",
    "Gov-Client-Local-IPs",
    "Gov-Client-Local-IPs-Timestamp",
    "Gov-Client-Multi-Factor",
    "Gov-Client-Public-IP",
    "Gov-Client-Public-IP-Timestamp",
    "Gov-Client-Public-Port",
    "Gov-Client-Screens",
    "Gov-Client-Timezone",
    "Gov-Client-User-Agent",
    "Gov-Client-User-IDs",
    "Gov-Client-Window-Size",
    "Gov-Vendor-Forwarded",
    "Gov-Vendor-License-IDs",
    "Gov-Vendor-Product-Name",
    "Gov-Vendor-Public-IP",
    "Gov-Vendor-Version",
  ],
  BATCH_PROCESS_DIRECT: [
    "Gov-Client-Connection-Method",
    "Gov-Client-Device-ID",
    "Gov-Client-Local-IPs",
    "Gov-Client-Local-IPs-Timestamp",
    "Gov-Client-MAC-Addresses",
    "Gov-Client-Timezone",
    "Gov-Client-User-Agent",
    "Gov-Client-User-IDs",
    "Gov-Vendor-License-IDs",
    "Gov-Vendor-Product-Name",
    "Gov-Vendor-Version",
  ],
  OTHER_DIRECT: [
    "Gov-Client-Connection-Method",
    "Gov-Client-Device-ID",
    "Gov-Client-Local-IPs",
    "Gov-Client-Local-IPs-Timestamp",
    "Gov-Client-MAC-Addresses",
    "Gov-Client-Multi-Factor",
    "Gov-Client-Timezone",
    "Gov-Client-User-Agent",
    "Gov-Client-User-IDs",
    "Gov-Vendor-License-IDs",
    "Gov-Vendor-Product-Name",
    "Gov-Vendor-Version",
  ],
  OTHER_VIA_SERVER: [
    "Gov-Client-Connection-Method",
    "Gov-Client-Device-ID",
    "Gov-Client-Local-IPs",
    "Gov-Client-Local-IPs-Timestamp",
    "Gov-Client-MAC-Addresses",
    "Gov-Client-Multi-Factor",
    "Gov-Client-Public-IP",
    "Gov-Client-Public-IP-Timestamp",
    "Gov-Client-Public-Port",
    "Gov-Client-Timezone",
    "Gov-Client-User-Agent",
    "Gov-Client-User-IDs",
    "Gov-Vendor-Forwarded",
    "Gov-Vendor-License-IDs",
    "Gov-Vendor-Product-Name",
    "Gov-Vendor-Public-IP",
    "Gov-Vendor-Version",
  ],
};

/**
 * Headers a connection method no longer has to send but that HMRC's change log says are "not an
 * issue" to send: web app via server since 3.1 (Browser-Plugins, Local-IPs,
 * Local-IPs-Timestamp) and 3.2 (Browser-Do-Not-Track); mobile app direct and via server since
 * 3.2 (MAC-Addresses). The validator does not report them as unexpected for that method.
 */
export const TOLERATED_HEADERS: Readonly<Record<ConnectionMethod, readonly string[]>> = {
  WEB_APP_VIA_SERVER: [
    "Gov-Client-Browser-Plugins",
    "Gov-Client-Local-IPs",
    "Gov-Client-Local-IPs-Timestamp",
    "Gov-Client-Browser-Do-Not-Track",
  ],
  DESKTOP_APP_DIRECT: [],
  DESKTOP_APP_VIA_SERVER: [],
  MOBILE_APP_DIRECT: ["Gov-Client-MAC-Addresses"],
  MOBILE_APP_VIA_SERVER: ["Gov-Client-MAC-Addresses"],
  BATCH_PROCESS_DIRECT: [],
  OTHER_DIRECT: [],
  OTHER_VIA_SERVER: [],
};

/** True when the connection method goes through intermediary servers (name ends with `_VIA_SERVER`). */
export function isViaServer(method: ConnectionMethod): boolean {
  return method.endsWith("_VIA_SERVER");
}
