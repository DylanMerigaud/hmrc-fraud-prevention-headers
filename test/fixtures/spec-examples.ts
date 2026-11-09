import type { ConnectionMethod, HeaderName } from "../../src/spec.js";

/**
 * One full header set per connection method, values copied verbatim from the examples of
 * docs/SPEC.md sections 3.1 to 3.8 (the first example where a page gives two, the full
 * two-factor Gov-Client-Multi-Factor value everywhere).
 */
export const SPEC_EXAMPLES: Record<ConnectionMethod, Partial<Record<HeaderName, string>>> = (() => {
  const deviceId = "beec798b-b366-47fa-b1f8-92cede14a1ce";
  const multiFactor =
    "type=AUTH_CODE&timestamp=2021-11-21T13%3A23Z&unique-reference=fc4b5fd6816f75a7c81fc8eaa9499d6a299bd803397166e8c4cf9280b801d62c,type=TOTP&timestamp=2021-11-21T13%3A20Z&unique-reference=0283da60063abfb3a87f1aed845d17fe2d9ba8c780b478dc4ae048f5ee97a6d5";
  const publicIp = "198.51.100.0";
  const timestamp = "2020-09-21T14:30:05.123Z";
  const port = "12345";
  const desktopScreens =
    "width=1920&height=1080&scaling-factor=1&colour-depth=16,width=3000&height=2000&scaling-factor=1.25&colour-depth=16";
  const mobileScreens = "width=375&height=812&scaling-factor=2&colour-depth=32";
  const timezone = "UTC+00:00";
  const desktopWindow = "width=1256&height=803";
  const mobileWindow = "width=375&height=812";
  const forwarded = "by=203.0.113.6&for=198.51.100.0";
  const license =
    "my-licensed-software=8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1";
  const productName = "Product%20Name";
  const vendorIp = "203.0.113.6";
  const localIps = "fc00%3A%3A,10.1.2.3";
  const macs = "ea%3A43%3A1a%3A5d%3A21%3A45,10%3A12%3Acc%3Afa%3Aaa%3A32";
  const windowsAgent =
    "os-family=Windows&os-version=Server%202012&device-manufacturer=Dell%20Inc.&device-model=OptiPlex%20980";
  const iosAgent =
    "os-family=iOS&os-version=13.3.1&device-manufacturer=Apple&device-model=iPhone12%2C3";

  return {
    WEB_APP_VIA_SERVER: {
      "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
      "Gov-Client-Browser-JS-User-Agent":
        "Mozilla/5.0 (iPad; U; CPU OS 3_2_1 like Mac OS X; en-us) AppleWebKit/531.21.10 (KHTML, like Gecko) Mobile/7B405",
      "Gov-Client-Device-ID": deviceId,
      "Gov-Client-Multi-Factor": multiFactor,
      "Gov-Client-Public-IP": publicIp,
      "Gov-Client-Public-IP-Timestamp": timestamp,
      "Gov-Client-Public-Port": port,
      "Gov-Client-Screens": desktopScreens,
      "Gov-Client-Timezone": timezone,
      "Gov-Client-User-IDs": "my-application=alice123",
      "Gov-Client-Window-Size": desktopWindow,
      "Gov-Vendor-Forwarded": forwarded,
      "Gov-Vendor-License-IDs": license,
      "Gov-Vendor-Product-Name": productName,
      "Gov-Vendor-Public-IP": vendorIp,
      "Gov-Vendor-Version": "my-web-app=2.2.2",
    },
    DESKTOP_APP_DIRECT: {
      "Gov-Client-Connection-Method": "DESKTOP_APP_DIRECT",
      "Gov-Client-Device-ID": deviceId,
      "Gov-Client-Local-IPs": localIps,
      "Gov-Client-Local-IPs-Timestamp": timestamp,
      "Gov-Client-MAC-Addresses": macs,
      "Gov-Client-Multi-Factor": multiFactor,
      "Gov-Client-Screens": desktopScreens,
      "Gov-Client-Timezone": timezone,
      "Gov-Client-User-Agent": windowsAgent,
      "Gov-Client-User-IDs": "os=domain%5Calice",
      "Gov-Client-Window-Size": desktopWindow,
      "Gov-Vendor-License-IDs": license,
      "Gov-Vendor-Product-Name": productName,
      "Gov-Vendor-Version": "my-application=1.6.0",
    },
    DESKTOP_APP_VIA_SERVER: {
      "Gov-Client-Connection-Method": "DESKTOP_APP_VIA_SERVER",
      "Gov-Client-Device-ID": deviceId,
      "Gov-Client-Local-IPs": localIps,
      "Gov-Client-Local-IPs-Timestamp": timestamp,
      "Gov-Client-MAC-Addresses": macs,
      "Gov-Client-Multi-Factor": multiFactor,
      "Gov-Client-Public-IP": publicIp,
      "Gov-Client-Public-IP-Timestamp": timestamp,
      "Gov-Client-Public-Port": port,
      "Gov-Client-Screens": desktopScreens,
      "Gov-Client-Timezone": timezone,
      "Gov-Client-User-Agent": windowsAgent,
      "Gov-Client-User-IDs": "os=domain%5Calice&my-application=alice123",
      "Gov-Client-Window-Size": desktopWindow,
      "Gov-Vendor-Forwarded": forwarded,
      "Gov-Vendor-License-IDs": license,
      "Gov-Vendor-Product-Name": productName,
      "Gov-Vendor-Public-IP": vendorIp,
      "Gov-Vendor-Version": "my-desktop-app=2.2.2&my-serverside-code=v3.8",
    },
    MOBILE_APP_DIRECT: {
      "Gov-Client-Connection-Method": "MOBILE_APP_DIRECT",
      "Gov-Client-Device-ID": deviceId,
      "Gov-Client-Local-IPs": localIps,
      "Gov-Client-Local-IPs-Timestamp": timestamp,
      "Gov-Client-Multi-Factor": multiFactor,
      "Gov-Client-Screens": mobileScreens,
      "Gov-Client-Timezone": timezone,
      "Gov-Client-User-Agent": iosAgent,
      "Gov-Client-User-IDs": "my-application=alice123",
      "Gov-Client-Window-Size": mobileWindow,
      "Gov-Vendor-License-IDs": license,
      "Gov-Vendor-Product-Name": productName,
      "Gov-Vendor-Version": "my-application=1.6.0",
    },
    MOBILE_APP_VIA_SERVER: {
      "Gov-Client-Connection-Method": "MOBILE_APP_VIA_SERVER",
      "Gov-Client-Device-ID": deviceId,
      "Gov-Client-Local-IPs": localIps,
      "Gov-Client-Local-IPs-Timestamp": timestamp,
      "Gov-Client-Multi-Factor": multiFactor,
      "Gov-Client-Public-IP": publicIp,
      "Gov-Client-Public-IP-Timestamp": timestamp,
      "Gov-Client-Public-Port": port,
      "Gov-Client-Screens": mobileScreens,
      "Gov-Client-Timezone": timezone,
      "Gov-Client-User-Agent": iosAgent,
      "Gov-Client-User-IDs": "my-application=alice123",
      "Gov-Client-Window-Size": mobileWindow,
      "Gov-Vendor-Forwarded": forwarded,
      "Gov-Vendor-License-IDs": license,
      "Gov-Vendor-Product-Name": productName,
      "Gov-Vendor-Public-IP": vendorIp,
      "Gov-Vendor-Version": "my-mobile-app=2.2.2&my-serverside-code=v3.8",
    },
    BATCH_PROCESS_DIRECT: {
      "Gov-Client-Connection-Method": "BATCH_PROCESS_DIRECT",
      "Gov-Client-Device-ID": deviceId,
      "Gov-Client-Local-IPs": localIps,
      "Gov-Client-Local-IPs-Timestamp": timestamp,
      "Gov-Client-MAC-Addresses": macs,
      "Gov-Client-Timezone": timezone,
      "Gov-Client-User-Agent": windowsAgent,
      "Gov-Client-User-IDs": "os=domain%5Calice&my-application=alice123",
      "Gov-Vendor-License-IDs": license,
      "Gov-Vendor-Product-Name": productName,
      "Gov-Vendor-Version": "my-application=1.6.0",
    },
    OTHER_DIRECT: {
      "Gov-Client-Connection-Method": "OTHER_DIRECT",
      "Gov-Client-Device-ID": deviceId,
      "Gov-Client-Local-IPs": localIps,
      "Gov-Client-Local-IPs-Timestamp": timestamp,
      "Gov-Client-MAC-Addresses": macs,
      "Gov-Client-Multi-Factor": multiFactor,
      "Gov-Client-Timezone": timezone,
      "Gov-Client-User-Agent": windowsAgent,
      "Gov-Client-User-IDs": "os=domain%5Calice&my-application=alice123",
      "Gov-Vendor-License-IDs": license,
      "Gov-Vendor-Product-Name": productName,
      "Gov-Vendor-Version": "my-application=1.6.0",
    },
    OTHER_VIA_SERVER: {
      "Gov-Client-Connection-Method": "OTHER_VIA_SERVER",
      "Gov-Client-Device-ID": deviceId,
      "Gov-Client-Local-IPs": localIps,
      "Gov-Client-Local-IPs-Timestamp": timestamp,
      "Gov-Client-MAC-Addresses": macs,
      "Gov-Client-Multi-Factor": multiFactor,
      "Gov-Client-Public-IP": publicIp,
      "Gov-Client-Public-IP-Timestamp": timestamp,
      "Gov-Client-Public-Port": port,
      "Gov-Client-Timezone": timezone,
      "Gov-Client-User-Agent": windowsAgent,
      "Gov-Client-User-IDs": "os=alice&my-application=alice123",
      "Gov-Vendor-Forwarded": forwarded,
      "Gov-Vendor-License-IDs": license,
      "Gov-Vendor-Product-Name": productName,
      "Gov-Vendor-Public-IP": vendorIp,
      "Gov-Vendor-Version": "my-frontend-app=2.2.2&my-serverside-code=v3.8",
    },
  };
})();
