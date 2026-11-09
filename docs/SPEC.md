# HMRC Fraud Prevention Headers, specification v3.3 (reference)

Purpose: implement a header builder and an offline validator without re-reading the web.
Conventions: "Verbatim" means copied from HMRC text or examples. "UNCONFIRMED" marks anything not verified from a source page. Page text was obtained through a summarizing fetcher (quotes limited in length), except the OpenAPI file of the Test API, which was read raw.

## 1. Version, dates, sources

- Current spec version: 3.3, issued 27 January 2025 (guide index page and change log). The change log also notes "the Directions were updated on 16 April 2025".
- Date read: 2026-11-09.
- Test Fraud Prevention Headers API: "Version 1.0 - beta", page says last updated 05 November 2026.
- URLs read:
  - https://developer.service.hmrc.gov.uk/guides/fraud-prevention/ (index)
  - .../connection-method/ and its 8 sub-pages: web-app-via-server, desktop-app-direct, desktop-app-via-server, mobile-app-direct, mobile-app-via-server, batch-process-direct, other-direct, other-via-server
  - .../getting-it-right/
  - .../test-api/
  - .../change-log/
  - https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/txm-fph-validator-api/1.0 (overview)
  - https://developer.service.hmrc.gov.uk/api-documentation/docs/api/download/txm-fph-validator-api/1.0/application.yaml (OpenAPI, read raw; the .../oas/page URL is a JS shell with no content)
  - https://github.com/hmrc/income-tax-mtd-changelog/issues/465
- Not read: the Compliance and Sanctions Guidelines PDF, the Directions, the DPIA.

### 1.1 Change log (summary)

- 3.3 (27 Jan 2025): Gov-Client-Multi-Factor timestamp must contain a T and use 24-hour format. Width and height of Gov-Client-Screens and Gov-Client-Window-Size must be positive whole numbers. Separators in Gov-Client-User-Agent must not be percent encoded. Correction: Gov-Vendor-Forwarded first hop must contain the Gov-Vendor-Public-IP value.
- 3.2 (1 Aug 2023): mobile (direct and via server): no need for `os` in Gov-Client-User-IDs, no need for Gov-Client-MAC-Addresses (sending them is not an issue). Web app via server: no need for Gov-Client-Browser-Do-Not-Track (sending it is not an issue). Gov-Vendor-Forwarded must contain values from Gov-Vendor-Public-IP and Gov-Client-Public-IP. Clarified number of key-value pairs in Gov-Vendor-Version.
- 3.1 (4 Apr 2022): clarified Gov-Client-Timezone format. (31 Jan 2022): web app via server: no need for Gov-Client-Browser-Plugins, Gov-Client-Local-IPs, Gov-Client-Local-IPs-Timestamp (sending is not an issue). All other methods must still send Local-IPs and Local-IPs-Timestamp.
- 3.0 (6 Jan 2021): new headers Gov-Client-Local-IPs-Timestamp (all methods), Gov-Client-Public-IP-Timestamp (via-server methods), Gov-Vendor-Product-Name (all methods). Device-ID must be a UUID. User-Agent must be key-value. Multi-Factor accepts seconds and milliseconds. Later 3.0 entries: 30 Apr 2021 clarified formats of the two IP timestamps; 3 Jun 2021 link to Compliance and Sanctions Guidelines; 12 Jul 2021 clarified User-IDs fields.
- Removed headers: Gov-Client-Browser-Plugins and Gov-Client-Browser-Do-Not-Track are NOT in any v3.3 method page (they were web-app-only and were dropped as requirements in 3.1 and 3.2). A validator should not require them; sending them is tolerated per the change log (UNCONFIRMED how the Test API treats them: it may report UNEXPECTED_HEADER).

## 2. Data structure rules

From "Getting it right":

- Character set: "Header data contents must be submitted using the US-ASCII character set, with other characters percent encoded." The page links to RFC 3986 section 2.1 (percent-encoding) but does not list reserved characters, does not mention unreserved characters or spaces, and gives no worked examples.
- Key-value structure: `<key-1>=<value-1>&<key-2>=<value-2>&...`. "Keys and values must be percent encoded." Pairs may be in any order. If a key applies but has no value: omit the pair or include the key with an empty value.
- List structure: `<value-1>,<value-2>,...`. "Values must be percent encoded." "Values must not be empty."
- List of key-value structures (Multi-Factor, Screens, Vendor-Forwarded): structures joined by commas, inside each structure pairs joined by `&`, key and value joined by `=`.
- Separators are NOT encoded: `=`, `&` and `,` (as separators). The method pages repeat per header "percent-encode every key and value but not the separators". The 3.3 change log: separators in Gov-Client-User-Agent must not be percent encoded.
- Encoding scheme in practice (inferred from examples, treat as the RFC 3986 rule, UNCONFIRMED as exact set): encode everything outside the RFC 3986 unreserved set (`A-Z a-z 0-9 - . _ ~`). Evidence from verbatim examples:
  - `:` becomes `%3A` (IPv6 `fc00::` becomes `fc00%3A%3A`; MAC `ea:43:1a:5d:21:45` becomes `ea%3A43%3A1a%3A5d%3A21%3A45`; timestamp `13:23Z` becomes `13%3A23Z` inside Multi-Factor).
  - space becomes `%20` (`Server%202012`, `Dell%20Inc.`, `OptiPlex%20980`, `Product%20Name`).
  - `,` inside a value becomes `%2C` (`device-model=iPhone12%2C3`).
  - backslash becomes `%5C` (`os=domain%5Calice`).
  - `.` and `-` and `_` stay literal (`Dell%20Inc.`, `my-application`, `alice_secondary`).
  - Use uppercase hex. Use `%20` not `+` for space.
- Where encoding applies per header type (from the method pages):
  - IP lists (Local-IPs): percent-encode each IPv6 value; commas not encoded. IPv4 has nothing to encode.
  - Gov-Client-Public-IP and Gov-Vendor-Public-IP: single value, shown unencoded in the page example (`ABCD:EF01:2345:6789:ABCD:EF01:2345:6789`, colons literal). UNCONFIRMED whether encoded colons are also accepted.
  - Gov-Vendor-Forwarded: IPv6 values are percent-encoded in examples (`by=2001%3A0db8%3A...`).
  - Timestamp headers (Public-IP-Timestamp, Local-IPs-Timestamp): shown with literal colons (`2020-09-21T14:30:05.123Z`); timestamps inside Multi-Factor are encoded (`2021-11-21T13%3A23Z`).
- Timestamps, general rule: UTC, 24-hour, `T` separator, trailing `Z`. Convert to UTC if needed.
- Other statements: header status (correct/not) must not be shared outside the organisation (not a format rule). Contact for exceptional cases: softwaredevelopersupport@service.hmrc.gov.uk.
- How HMRC checks: automated tests for requirements and format, plus manual tests that values are "realistic and what we expect". Passing the Test API does not guarantee acceptance.

## 3. Connection methods and header tables

Choosing a method (connection-method page):

- Direct: application connects directly to HMRC. Via server: it connects through intermediary servers that are part of your application domain and under your control (exclude third-party transport layers and ISPs).
- Choose by the device where the action starts (desktop, mobile, web). A hosted desktop environment accessed remotely uses the desktop methods.
- BATCH_PROCESS_DIRECT: only when users do not initiate an action. If user-initiated actions are sent in batches, the originating device is the user's device and the batch method does not apply.
- Not listed: OTHER_DIRECT or OTHER_VIA_SERVER (HMRC may ask for details). An application may have several methods.

Connection method values (Gov-Client-Connection-Method): `BATCH_PROCESS_DIRECT`, `DESKTOP_APP_DIRECT`, `DESKTOP_APP_VIA_SERVER`, `MOBILE_APP_DIRECT`, `MOBILE_APP_VIA_SERVER`, `OTHER_DIRECT`, `OTHER_VIA_SERVER`, `WEB_APP_VIA_SERVER`.

Every page states: "You must submit data for all of these headers." No header is marked optional; only the missing-data conditions in section 5 apply. Via-server pages add: "Where multiple services manage your intermediary servers, headers must contain data from all services." and advise checking the stack can collect Gov-Client-Public-IP and Gov-Client-Public-Port.

Presence matrix (Y = sent, blank = not sent for that method). Order below is HMRC's page order for each method; the matrix uses a canonical alphabetical order.

| Header | WEB_APP_VIA_SERVER | DESKTOP_DIRECT | DESKTOP_VIA_SERVER | MOBILE_DIRECT | MOBILE_VIA_SERVER | BATCH_DIRECT | OTHER_DIRECT | OTHER_VIA_SERVER |
|---|---|---|---|---|---|---|---|---|
| Gov-Client-Browser-JS-User-Agent | Y | | | | | | | |
| Gov-Client-Connection-Method | Y | Y | Y | Y | Y | Y | Y | Y |
| Gov-Client-Device-ID | Y | Y | Y | Y | Y | Y | Y | Y |
| Gov-Client-Local-IPs | | Y | Y | Y | Y | Y | Y | Y |
| Gov-Client-Local-IPs-Timestamp | | Y | Y | Y | Y | Y | Y | Y |
| Gov-Client-MAC-Addresses | | Y | Y | | | Y | Y | Y |
| Gov-Client-Multi-Factor | Y | Y | Y | Y | Y | | Y | Y |
| Gov-Client-Public-IP | Y | | Y | | Y | | | Y |
| Gov-Client-Public-IP-Timestamp | Y | | Y | | Y | | | Y |
| Gov-Client-Public-Port | Y | | Y | | Y | | | Y |
| Gov-Client-Screens | Y | Y | Y | Y | Y | | | |
| Gov-Client-Timezone | Y | Y | Y | Y | Y | Y | Y | Y |
| Gov-Client-User-Agent | | Y | Y | Y | Y | Y | Y | Y |
| Gov-Client-User-IDs | Y | Y | Y | Y | Y | Y | Y | Y |
| Gov-Client-Window-Size | Y | Y | Y | Y | Y | | | |
| Gov-Vendor-Forwarded | Y | | Y | | Y | | | Y |
| Gov-Vendor-License-IDs | Y | Y | Y | Y | Y | Y | Y | Y |
| Gov-Vendor-Product-Name | Y | Y | Y | Y | Y | Y | Y | Y |
| Gov-Vendor-Public-IP | Y | | Y | | Y | | | Y |
| Gov-Vendor-Version | Y | Y | Y | Y | Y | Y | Y | Y |
| Count | 16 | 14 | 19 | 13 | 18 | 11 | 12 | 17 |

Notes on the matrix:
- Direct methods never send Public-IP, Public-IP-Timestamp, Public-Port, Gov-Vendor-Public-IP or Gov-Vendor-Forwarded.
- Web app via server does NOT send Local-IPs, Local-IPs-Timestamp (3.1), Browser-Plugins (3.1), Browser-Do-Not-Track (3.2), MAC-Addresses, or Gov-Client-User-Agent (it uses Browser-JS-User-Agent instead).
- Mobile methods do NOT send MAC-Addresses (3.2) and do not need `os` in User-IDs (3.2).
- Batch does NOT send Multi-Factor, Screens, Window-Size.
- Other methods do NOT send Screens, Window-Size. (Other-direct and other-via-server pages list no Screens or Window-Size.)
- Presence of Gov-Client-Device-ID, Timezone, User-IDs, License-IDs, Product-Name, Version, Connection-Method: all methods.

### 3.1 WEB_APP_VIA_SERVER (16 headers, page order)

| # | Header | Format | Example (verbatim) |
|---|---|---|---|
| 1 | Gov-Client-Connection-Method | fixed value | `WEB_APP_VIA_SERVER` |
| 2 | Gov-Client-Browser-JS-User-Agent | user agent as JavaScript reports it | `Mozilla/5.0 (iPad; U; CPU OS 3_2_1 like Mac OS X; en-us) AppleWebKit/531.21.10 (KHTML, like Gecko) Mobile/7B405` |
| 3 | Gov-Client-Device-ID | UUID | `beec798b-b366-47fa-b1f8-92cede14a1ce` |
| 4 | Gov-Client-Multi-Factor | list of kv: type, timestamp, unique-reference | `type=AUTH_CODE&timestamp=2021-11-21T13%3A23Z&unique-reference=fc4b5fd6816f75a7c81fc8eaa9499d6a299bd803397166e8c4cf9280b801d62c,type=TOTP&timestamp=2021-11-21T13%3A20Z&unique-reference=0283da60063abfb3a87f1aed845d17fe2d9ba8c780b478dc4ae048f5ee97a6d5` |
| 5 | Gov-Client-Public-IP | public IPv4 or IPv6 | `198.51.100.0` ; `ABCD:EF01:2345:6789:ABCD:EF01:2345:6789` |
| 6 | Gov-Client-Public-IP-Timestamp | `yyyy-MM-ddThh:mm:ss.sssZ` UTC | `2020-09-21T14:30:05.123Z` |
| 7 | Gov-Client-Public-Port | integer 1..65535, not a server port | `12345` |
| 8 | Gov-Client-Screens | list of kv: width, height, scaling-factor, colour-depth | `width=1920&height=1080&scaling-factor=1&colour-depth=16,width=3000&height=2000&scaling-factor=1.25&colour-depth=16` |
| 9 | Gov-Client-Timezone | `UTC±<hh>:<mm>` | `UTC+00:00` ; `UTC+01:00` ; `UTC-01:15` |
| 10 | Gov-Client-User-IDs | kv | `my-application=alice123` |
| 11 | Gov-Client-Window-Size | kv: width, height | `width=1256&height=803` |
| 12 | Gov-Vendor-Forwarded | list of kv: by, for | `by=203.0.113.6&for=198.51.100.0` |
| 13 | Gov-Vendor-License-IDs | kv: name=hash | `my-licensed-software=8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1` |
| 14 | Gov-Vendor-Product-Name | percent-encoded name | `Product%20Name` ; `Company%20Name` |
| 15 | Gov-Vendor-Public-IP | public IP | `203.0.113.6` |
| 16 | Gov-Vendor-Version | kv: name=version | `my-web-app=2.2.2` |

NOT sent: Gov-Client-Local-IPs, Gov-Client-Local-IPs-Timestamp, Gov-Client-MAC-Addresses, Gov-Client-User-Agent, Gov-Client-Browser-Plugins, Gov-Client-Browser-Do-Not-Track.
Multi-hop Forwarded example (verbatim, WAF plus two vendor servers): `by=2001%3A0db8%3A85a3%3A0000%3A0000%3A8a2e%3A0370%3A7334&for=198.51.100.0,by=203.0.113.6&for=2001%3A0db8%3A85a3%3A0000%3A0000%3A8a2e%3A0370%3A7334,by=176.30.57.118&for=203.0.113.6`

### 3.2 DESKTOP_APP_DIRECT (14 headers, page order)

| # | Header | Example (verbatim) |
|---|---|---|
| 1 | Gov-Client-Connection-Method | `DESKTOP_APP_DIRECT` |
| 2 | Gov-Client-Device-ID | `beec798b-b366-47fa-b1f8-92cede14a1ce` |
| 3 | Gov-Client-Local-IPs | `fc00%3A%3A,10.1.2.3` ; `10.1.2.3,10.3.4.2` |
| 4 | Gov-Client-Local-IPs-Timestamp | `2020-09-21T14:30:05.123Z` |
| 5 | Gov-Client-MAC-Addresses | `ea%3A43%3A1a%3A5d%3A21%3A45,10%3A12%3Acc%3Afa%3Aaa%3A32` |
| 6 | Gov-Client-Multi-Factor | `type=AUTH_CODE&timestamp=2021-11-21T13%3A23Z&unique-reference=fc4b5fd6816f75a7c81fc8eaa9499d6a299bd803397166e8c4cf9280b801d62c,type=TOTP&timestamp=2021-11-21T13%3A20Z&unique-reference=0283da60063abfb3a87f1aed845d17fe2d9ba8c780b478dc4ae048f5ee97a6d5` (full text of second factor taken from the sibling pages; this page's example was shown truncated, UNCONFIRMED identical) |
| 7 | Gov-Client-Screens | `width=1920&height=1080&scaling-factor=1&colour-depth=16,width=3000&height=2000&scaling-factor=1.25&colour-depth=16` |
| 8 | Gov-Client-Timezone | `UTC+00:00` |
| 9 | Gov-Client-User-Agent | `os-family=Windows&os-version=Server%202012&device-manufacturer=Dell%20Inc.&device-model=OptiPlex%20980` |
| 10 | Gov-Client-User-IDs | `os=domain%5Calice` (no app sign-in) ; `os=domain%5Calice&my-application=alice123` (sign-in required) |
| 11 | Gov-Client-Window-Size | `width=1256&height=803` |
| 12 | Gov-Vendor-License-IDs | `my-licensed-software=8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1` |
| 13 | Gov-Vendor-Product-Name | `Product%20Name` ; `Company%20Name` |
| 14 | Gov-Vendor-Version | `my-application=1.6.0` |

NOT sent: Public-IP, Public-IP-Timestamp, Public-Port, Gov-Vendor-Forwarded, Gov-Vendor-Public-IP, Browser-JS-User-Agent.

### 3.3 DESKTOP_APP_VIA_SERVER (19 headers, page order)

| # | Header | Example (verbatim) |
|---|---|---|
| 1 | Gov-Client-Connection-Method | `DESKTOP_APP_VIA_SERVER` |
| 2 | Gov-Client-Device-ID | `beec798b-b366-47fa-b1f8-92cede14a1ce` |
| 3 | Gov-Client-Local-IPs | `fc00%3A%3A,10.1.2.3` ; `10.1.2.3,10.3.4.2` |
| 4 | Gov-Client-Local-IPs-Timestamp | `2020-09-21T14:30:05.123Z` |
| 5 | Gov-Client-MAC-Addresses | `ea%3A43%3A1a%3A5d%3A21%3A45,10%3A12%3Acc%3Afa%3Aaa%3A32` |
| 6 | Gov-Client-Multi-Factor | `type=AUTH_CODE&timestamp=2021-11-21T13%3A23Z&unique-reference=fc4b5fd6816f75a7c81fc8eaa9499d6a299bd803397166e8c4cf9280b801d62c,type=TOTP&timestamp=2021-11-21T13%3A20Z&unique-reference=0283da60063abfb3a87f1aed845d17fe2d9ba8c780b478dc4ae048f5ee97a6d5` |
| 7 | Gov-Client-Public-IP | `198.51.100.0` ; `ABCD:EF01:2345:6789:ABCD:EF01:2345:6789` |
| 8 | Gov-Client-Public-IP-Timestamp | `2020-09-21T14:30:05.123Z` |
| 9 | Gov-Client-Public-Port | `12345` |
| 10 | Gov-Client-Screens | `width=1920&height=1080&scaling-factor=1&colour-depth=16,width=3000&height=2000&scaling-factor=1.25&colour-depth=16` |
| 11 | Gov-Client-Timezone | `UTC+00:00` |
| 12 | Gov-Client-User-Agent | `os-family=Windows&os-version=Server%202012&device-manufacturer=Dell%20Inc.&device-model=OptiPlex%20980` |
| 13 | Gov-Client-User-IDs | `os=domain%5Calice&my-application=alice123` ; `os=domain%5Calice&my-application=alice123&my-secondary-application=alice_secondary` |
| 14 | Gov-Client-Window-Size | `width=1256&height=803` |
| 15 | Gov-Vendor-Forwarded | `by=203.0.113.6&for=198.51.100.0` ; multi-hop `by=2001%3A0db8%3A85a3%3A0000%3A0000%3A8a2e%3A0370%3A7334&for=198.51.100.0,by=203.0.113.6&for=2001%3A0db8%3A85a3%3A0000%3A0000%3A8a2e%3A0370%3A7334,by=176.30.57.118&for=203.0.113.6` |
| 16 | Gov-Vendor-License-IDs | `my-licensed-software=8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1` |
| 17 | Gov-Vendor-Product-Name | `Product%20Name` ; `Company%20Name` |
| 18 | Gov-Vendor-Public-IP | `203.0.113.6` |
| 19 | Gov-Vendor-Version | `my-desktop-app=2.2.2&my-serverside-code=v3.8` |

NOT sent: Browser-JS-User-Agent. (Everything else on the list is sent.)

### 3.4 MOBILE_APP_DIRECT (13 headers, page order)

| # | Header | Example (verbatim) |
|---|---|---|
| 1 | Gov-Client-Connection-Method | `MOBILE_APP_DIRECT` |
| 2 | Gov-Client-Device-ID | `beec798b-b366-47fa-b1f8-92cede14a1ce` |
| 3 | Gov-Client-Local-IPs | `fc00%3A%3A,10.1.2.3` ; `10.1.2.3,10.3.4.2` |
| 4 | Gov-Client-Local-IPs-Timestamp | `2020-09-21T14:30:05.123Z` |
| 5 | Gov-Client-Multi-Factor | same two-factor structure as above (page example truncated in fetch) |
| 6 | Gov-Client-Screens | `width=375&height=812&scaling-factor=2&colour-depth=32` |
| 7 | Gov-Client-Timezone | `UTC+00:00` |
| 8 | Gov-Client-User-Agent | `os-family=iOS&os-version=13.3.1&device-manufacturer=Apple&device-model=iPhone12%2C3` |
| 9 | Gov-Client-User-IDs | `my-application=alice123` |
| 10 | Gov-Client-Window-Size | `width=375&height=812` |
| 11 | Gov-Vendor-License-IDs | `my-licensed-software=8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1` |
| 12 | Gov-Vendor-Product-Name | `Product%20Name` ; `Company%20Name` |
| 13 | Gov-Vendor-Version | `my-application=1.6.0` |

NOT sent: Gov-Client-MAC-Addresses, Public-IP family, Gov-Vendor-Forwarded, Gov-Vendor-Public-IP, Browser-JS-User-Agent. No `os` key needed in User-IDs.

### 3.5 MOBILE_APP_VIA_SERVER (18 headers, page order)

| # | Header | Example (verbatim) |
|---|---|---|
| 1 | Gov-Client-Connection-Method | `MOBILE_APP_VIA_SERVER` |
| 2 | Gov-Client-Device-ID | `beec798b-b366-47fa-b1f8-92cede14a1ce` |
| 3 | Gov-Client-Local-IPs | `fc00%3A%3A,10.1.2.3` ; `10.1.2.3,10.3.4.2` |
| 4 | Gov-Client-Local-IPs-Timestamp | `2020-09-21T14:30:05.123Z` |
| 5 | Gov-Client-Multi-Factor | `type=AUTH_CODE&timestamp=2021-11-21T13%3A23Z&unique-reference=...` (second factor TOTP as above) |
| 6 | Gov-Client-Public-IP | `198.51.100.0` ; `ABCD:EF01:2345:6789:ABCD:EF01:2345:6789` |
| 7 | Gov-Client-Public-IP-Timestamp | `2020-09-21T14:30:05.123Z` |
| 8 | Gov-Client-Public-Port | `12345` |
| 9 | Gov-Client-Screens | `width=375&height=812&scaling-factor=2&colour-depth=32` |
| 10 | Gov-Client-Timezone | `UTC+00:00` |
| 11 | Gov-Client-User-Agent | `os-family=iOS&os-version=13.3.1&device-manufacturer=Apple&device-model=iPhone12%2C3` |
| 12 | Gov-Client-User-IDs | `my-application=alice123` |
| 13 | Gov-Client-Window-Size | `width=375&height=812` |
| 14 | Gov-Vendor-Forwarded | `by=203.0.113.6&for=198.51.100.0` (multi-hop example exists on page, same shape as 3.1) |
| 15 | Gov-Vendor-License-IDs | `my-licensed-software=8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1` |
| 16 | Gov-Vendor-Product-Name | `Product%20Name` ; `Company%20Name` |
| 17 | Gov-Vendor-Public-IP | `203.0.113.6` |
| 18 | Gov-Vendor-Version | `my-mobile-app=2.2.2&my-serverside-code=v3.8` |

NOT sent: Gov-Client-MAC-Addresses, Browser-JS-User-Agent. No `os` key needed in User-IDs.

### 3.6 BATCH_PROCESS_DIRECT (11 headers, page order)

| # | Header | Example (verbatim) |
|---|---|---|
| 1 | Gov-Client-Connection-Method | `BATCH_PROCESS_DIRECT` |
| 2 | Gov-Client-Device-ID | `beec798b-b366-47fa-b1f8-92cede14a1ce` |
| 3 | Gov-Client-Local-IPs | `fc00%3A%3A,10.1.2.3` ; `10.1.2.3,10.3.4.2` |
| 4 | Gov-Client-Local-IPs-Timestamp | `2020-09-21T14:30:05.123Z` |
| 5 | Gov-Client-MAC-Addresses | `ea%3A43%3A1a%3A5d%3A21%3A45,10%3A12%3Acc%3Afa%3Aaa%3A32` |
| 6 | Gov-Client-Timezone | `UTC+00:00` |
| 7 | Gov-Client-User-Agent | `os-family=Windows&os-version=Server%202012&device-manufacturer=Dell%20Inc.&device-model=OptiPlex%20980` |
| 8 | Gov-Client-User-IDs | `os=domain%5Calice&my-application=alice123` |
| 9 | Gov-Vendor-License-IDs | `my-licensed-software=8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1` |
| 10 | Gov-Vendor-Product-Name | `Product%20Name` ; `Company%20Name` |
| 11 | Gov-Vendor-Version | `my-application=1.6.0` |

NOT sent: Multi-Factor, Screens, Window-Size, Public-IP family, Vendor-Forwarded, Vendor-Public-IP, Browser-JS-User-Agent. Use only when users do not initiate the action.

### 3.7 OTHER_DIRECT (12 headers, page order)

| # | Header | Example (verbatim) |
|---|---|---|
| 1 | Gov-Client-Connection-Method | `OTHER_DIRECT` |
| 2 | Gov-Client-Device-ID | `beec798b-b366-47fa-b1f8-92cede14a1ce` |
| 3 | Gov-Client-Local-IPs | `fc00%3A%3A,10.1.2.3` ; `10.1.2.3,10.3.4.2` |
| 4 | Gov-Client-Local-IPs-Timestamp | `2020-09-21T14:30:05.123Z` |
| 5 | Gov-Client-MAC-Addresses | `ea%3A43%3A1a%3A5d%3A21%3A45,10%3A12%3Acc%3Afa%3Aaa%3A32` |
| 6 | Gov-Client-Multi-Factor | `type=AUTH_CODE&timestamp=2021-11-21T13%3A23Z&unique-reference=fc4b5fd6816f75a7c81fc8eaa9499d6a299bd803397166e8c4cf9280b801d62c,...` (TOTP second factor as above) |
| 7 | Gov-Client-Timezone | `UTC+00:00` |
| 8 | Gov-Client-User-Agent | `os-family=Windows&os-version=Server%202012&device-manufacturer=Dell%20Inc.&device-model=OptiPlex%20980` |
| 9 | Gov-Client-User-IDs | `os=domain%5Calice&my-application=alice123` |
| 10 | Gov-Vendor-License-IDs | `my-licensed-software=8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1` |
| 11 | Gov-Vendor-Product-Name | `Product%20Name` ; `Company%20Name` |
| 12 | Gov-Vendor-Version | `my-application=1.6.0` |

NOT sent: Screens, Window-Size, Public-IP family, Vendor-Forwarded, Vendor-Public-IP, Browser-JS-User-Agent.

### 3.8 OTHER_VIA_SERVER (17 headers, page order)

| # | Header | Example (verbatim) |
|---|---|---|
| 1 | Gov-Client-Connection-Method | `OTHER_VIA_SERVER` |
| 2 | Gov-Client-Device-ID | `beec798b-b366-47fa-b1f8-92cede14a1ce` |
| 3 | Gov-Client-Local-IPs | `fc00%3A%3A,10.1.2.3` ; `10.1.2.3,10.3.4.2` |
| 4 | Gov-Client-Local-IPs-Timestamp | `2020-09-21T14:30:05.123Z` |
| 5 | Gov-Client-MAC-Addresses | `ea%3A43%3A1a%3A5d%3A21%3A45,10%3A12%3Acc%3Afa%3Aaa%3A32` |
| 6 | Gov-Client-Multi-Factor | `type=AUTH_CODE&timestamp=2021-11-21T13%3A23Z&unique-reference=...` |
| 7 | Gov-Client-Public-IP | `198.51.100.0` ; `ABCD:EF01:2345:6789:ABCD:EF01:2345:6789` |
| 8 | Gov-Client-Public-IP-Timestamp | `2020-09-21T14:30:05.123Z` |
| 9 | Gov-Client-Public-Port | `12345` |
| 10 | Gov-Client-Timezone | `UTC+00:00` |
| 11 | Gov-Client-User-Agent | `os-family=Windows&os-version=Server%202012&device-manufacturer=Dell%20Inc.&device-model=OptiPlex%20980` |
| 12 | Gov-Client-User-IDs | `os=alice&my-application=alice123` |
| 13 | Gov-Vendor-Forwarded | `by=203.0.113.6&for=198.51.100.0` ; multi-hop as above |
| 14 | Gov-Vendor-License-IDs | `my-licensed-software=8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1` |
| 15 | Gov-Vendor-Product-Name | `Product%20Name` ; `Company%20Name` |
| 16 | Gov-Vendor-Public-IP | `203.0.113.6` |
| 17 | Gov-Vendor-Version | `my-frontend-app=2.2.2&my-serverside-code=v3.8` |

NOT sent: Screens, Window-Size, Browser-JS-User-Agent.

## 4. Per-header detail

Header names are case-insensitive on the wire; the Test API reports them lowercase.

### Gov-Client-Connection-Method
- Fixed enum, see section 3. Send with all requests. Never missing.

### Gov-Client-Device-ID
- UUID/GUID identifying the originating device. Generate it in the application and store it persistently (hidden file, Windows registry, cookie). It should not expire. If the end user deletes it, generate a new one.
- Example: `beec798b-b366-47fa-b1f8-92cede14a1ce`. Missing: no condition stated.

### Gov-Client-Local-IPs
- Comma-separated list of ALL local IPv4 and IPv6 addresses of the originating device. Collect immediately before each request from client to backend. Percent-encode each IPv6 value (colons become `%3A`); commas are not encoded. List values must not be empty.
- Examples: `fc00%3A%3A,10.1.2.3` and `10.1.2.3,10.3.4.2`. Not sent for web app via server. Missing: no condition stated (but see issue 465: sandboxed iOS on cellular).

### Gov-Client-Local-IPs-Timestamp
- `yyyy-MM-ddThh:mm:ss.sssZ`, UTC, 24-hour, `T` required, seconds and milliseconds with trailing zeros. Collected at the same moment as Local-IPs (immediately before the client request), value not altered afterwards. Example `2020-09-21T14:30:05.123Z`.

### Gov-Client-MAC-Addresses
- Comma-separated list of the device's MAC addresses; each value percent-encoded (colons become `%3A`), commas not encoded. Example `ea%3A43%3A1a%3A5d%3A21%3A45,10%3A12%3Acc%3Afa%3Aaa%3A32`. Lowercase hex in the example. HMRC states no further MAC format rule (UNCONFIRMED: colon-separated 6 octets assumed from example). Not sent for web or mobile methods.

### Gov-Client-Multi-Factor
- List of key-value structures, one per MFA factor, for users accessing YOUR software (not users granting authority to your software). Keys: `type` (`TOTP`, `AUTH_CODE`, `OTHER`), `timestamp` (UTC time of the last successful prompt for that factor; minimum `yyyy-MM-ddThh:mmZ`, seconds and milliseconds optional; must contain `T`, 24-hour clock; the colons are percent-encoded: `2021-11-21T13%3A23Z`), `unique-reference` (identifies a single factor, e.g. salted hash of a phone number or an id linked to a TOTP secret, never the secret; same hash function each time). Separators `=`, `&`, `,` are not encoded.
- Verbatim example: `type=AUTH_CODE&timestamp=2021-11-21T13%3A23Z&unique-reference=fc4b5fd6816f75a7c81fc8eaa9499d6a299bd803397166e8c4cf9280b801d62c,type=TOTP&timestamp=2021-11-21T13%3A20Z&unique-reference=0283da60063abfb3a87f1aed845d17fe2d9ba8c780b478dc4ae048f5ee97a6d5`
- Missing: "If you authenticate with username and password only, you will not be able to collect a value" (go through the missing data process, section 5).

### Gov-Client-Public-IP
- Public IPv4 or IPv6 address the originating device made the request from (as seen by the first server you control). Examples `198.51.100.0`, `ABCD:EF01:2345:6789:ABCD:EF01:2345:6789`. "Some popular load balancers do not" support collecting it: check your stack.
- Missing: client-server connection over a private network.

### Gov-Client-Public-IP-Timestamp
- Same format as Local-IPs-Timestamp. Collected at the same time as the public IP, usually when the backend receives the request (WAF, load balancer, reverse proxy or server process). Via-server methods only. Example `2020-09-21T14:30:05.123Z`.

### Gov-Client-Public-Port
- TCP source port of the client connection. Integer 1..65535. Must not be a server port such as 80 or 443. Example `12345`. Check load balancers can expose it. Missing: private-network connection.

### Gov-Client-Screens
- List of key-value structures, one per screen, keys `width`, `height`, `scaling-factor`, `colour-depth`. `width`, `height`: pixels, positive whole numbers. `scaling-factor`: e.g. 2 for high-density, 1 for standard (decimal allowed: `1.25`). `colour-depth`: bits.
- Examples: `width=1920&height=1080&scaling-factor=1&colour-depth=16,width=3000&height=2000&scaling-factor=1.25&colour-depth=16` ; mobile `width=375&height=812&scaling-factor=2&colour-depth=32`.
- Test API error text seen: "At least 1 screen is missing a value for scaling factor", "At least 1 screen is missing a value for colour depth".

### Gov-Client-Timezone
- `UTC±<hh>:<mm>` with `+` or `-`, a recognised timezone offset. Examples `UTC+00:00`, `UTC+01:00`, `UTC-01:15`. Test API message: "Value must be a recognised timezone in UTC format, submitted as UTC±<hh>:<mm>".

### Gov-Client-User-Agent (desktop, mobile, batch, other)
- List of key-value structures with `os-family`, `os-version`, `device-manufacturer`, `device-model`. Percent-encode keys and values; separators `=`, `&`, `,` are NOT encoded (3.3). Note a comma inside a value is encoded: `iPhone12%2C3`.
- Examples: `os-family=Windows&os-version=Server%202012&device-manufacturer=Dell%20Inc.&device-model=OptiPlex%20980` ; `os-family=iOS&os-version=13.3.1&device-manufacturer=Apple&device-model=iPhone12%2C3`. On other-direct page, field hints: os-family e.g. Windows, MacOS; os-version e.g. 10, 10.15.7; device-manufacturer e.g. Dell, Apple; device-model e.g. XPS13, MacBookPro15,2 (the last must be encoded as `MacBookPro15%2C2`).
- Not sent by WEB_APP_VIA_SERVER.

### Gov-Client-Browser-JS-User-Agent (web app via server only)
- The user agent string as reported by JavaScript on the originating browser, passed as the browser reports it. Example: `Mozilla/5.0 (iPad; U; CPU OS 3_2_1 like Mac OS X; en-us) AppleWebKit/531.21.10 (KHTML, like Gecko) Mobile/7B405`. The value is US-ASCII with other characters percent encoded (space and parentheses/semicolons would need encoding by the general rule; the page example is shown raw, UNCONFIRMED whether HMRC expects the raw or encoded form for such characters).

### Gov-Client-User-IDs
- Key-value structure: keys name the accounts the user holds, values are the user's identifiers (sign-in identifier such as username, email, phone, plus any internal identifier). `os` key = identifier of the user signed in on the device (desktop, batch, other; not needed for web and mobile since 3.2). Percent-encode keys and values, not `=` or `&`.
- Examples: `my-application=alice123` ; `os=domain%5Calice&my-application=alice123` ; `os=domain%5Calice&my-application=alice123&my-secondary-application=alice_secondary` ; other-via-server `os=alice&my-application=alice123`.
- Test API warning for web: "Check you are using the correct Gov-Client-Connection-Method. Web applications do not usually provide the os field as browsers do not expose this information." (code POTENTIALLY_INVALID_HEADER on gov-client-user-ids).

### Gov-Client-Window-Size
- Key-value `width` and `height`, pixels, positive whole numbers. Example `width=1256&height=803` ; mobile `width=375&height=812`.

### Gov-Vendor-Forwarded
- List of key-value structures `by` and `for`, one per internet hop between TLS-terminating services. `by` = public IP the server received the request on; first hop: equals Gov-Vendor-Public-IP. `for` = public IP of the sender; first hop: equals Gov-Client-Public-IP; later hops: the intermediate server's IP. Percent-encode keys and values (IPv6 colons become `%3A`), not `=`, `&`, `,`. Do not include hops within a private network.
- Examples: `by=203.0.113.6&for=198.51.100.0`; multi-hop in section 3.1.
- Cross-validation (Test API): "At least 1 pair of IPs in Gov-Vendor-Forwarded must include Gov-Client-Public-IP in the 'for' field and Gov-Vendor-Public-IP in the 'by' field. Check all 3 headers are consistent."
- Open question from issue 465 (taxeaseuk): second hop semantics for multi-proxy setups, no HMRC answer found.

### Gov-Vendor-License-IDs
- Key-value: `<software-name>=<hashed-license-value>&...`. Same hash function every time (example is 64 uppercase hex chars, SHA-256 shaped; HMRC does not name the algorithm, UNCONFIRMED). Percent-encode keys and values, not `=`/`&`. Example `my-licensed-software=8D7963490527D33716835EE7C195516D5E562E03B224E9B359836466EE40CDE1`. Missing: no licences on the originating device (see section 5). The Test API example uses an encoded key: `my%20licensed%20software=...`.

### Gov-Vendor-Product-Name
- Percent-encoded product name as marketed to end users; for internal-only or white-labelled products, the company name. Examples `Product%20Name`, `Company%20Name`.

### Gov-Vendor-Public-IP
- Public IP of the servers the originating device sent its requests to (WAF, DDoS protection, or load balancer the vendor DNS resolves to). Example `203.0.113.6`. Missing: private network.

### Gov-Vendor-Version
- Key-value `<software-name>=<version-number>&...`, software involved in handling the request; percent-encode keys and values, not `=`/`&`. Via-server methods: at least two pairs (one for client application, one for server). Direct methods: examples show one pair. Examples: `my-web-app=2.2.2` (web), `my-desktop-app=2.2.2&my-serverside-code=v3.8`, `my-mobile-app=2.2.2&my-serverside-code=v3.8`, `my-frontend-app=2.2.2&my-serverside-code=v3.8`, `my-application=1.6.0` (direct).
- Test API warning: "For client server architectures, submit a version for the client and the server. For all other architectures, submit at least 1 version." (POTENTIALLY_INVALID_HEADER). Note the web-app page example has only one pair; the "at least two" statement is on the desktop-via-server, mobile-via-server and other-via-server pages only.

### Removed / absent in v3.3
- Gov-Client-Browser-Plugins, Gov-Client-Browser-Do-Not-Track: not on any v3.3 page (see 1.1).

## 5. Missing data rules (getting-it-right, "Missing header data")

- "You are required by law to submit all header data for your connection method."
- Some values may be uncollectable "due to restrictions beyond your reasonable control" (examples: operating system or platform restrictions, security measures).
- If you cannot submit a header, contact HMRC with full details (softwaredevelopersupport@service.hmrc.gov.uk).
- Only after discussing the missing header with HMRC can you "omit the header or submit it with an empty value".
- "You must not include a placeholder value", such as `null` or `undefined`.
- If you use third-party software or libraries, make sure they can still collect header data.
- Per-header conditions that the method pages name as legitimately uncollectable (still go through the HMRC process): Multi-Factor (username and password only), Gov-Vendor-License-IDs (no licences on device), Gov-Client-Public-IP, Gov-Client-Public-Port, Gov-Vendor-Public-IP (client-server connection over a private network).
- Builder implication: never emit placeholders; omitted vs empty is a decision to be agreed with HMRC per header. The Test API distinguishes MISSING_HEADER (absent) from EMPTY_HEADER (present but empty), both reported as errors.
- Lists must not contain empty values; a key-value pair with no value may be omitted or sent as key with empty value.

## 6. Test Fraud Prevention Headers API (txm-fph-validator-api, version 1.0 beta)

- Sandbox base URL: `https://test-api.service.hmrc.gov.uk`. Production base (per overview page): `https://api.service.hmrc.gov.uk`. The OAS lists only the sandbox server.
- Auth: application-restricted endpoint. OAuth 2.0 client credentials; token URL `https://api.service.hmrc.gov.uk/oauth/token`. Send `Authorization: Bearer <token>` (OAS example `Bearer 59fc92c1cdf0b8ef1f138a702effdbd2`). (The token request body details, grant_type=client_credentials with client_id/client_secret, follow HMRC's application-restricted guide, UNCONFIRMED here.)
- Required request header `Accept: application/vnd.hmrc.1.0+json`.
- Both endpoints are `GET`.

### 6.1 GET /test/fraud-prevention-headers/validate
- Validates the Gov-* headers on this very request. Immediate feedback on one request. Headers sent: Accept, Authorization, all Gov-* headers.
- Response 200 JSON: `specVersion` (string: version of the spec validated against, changes on major releases), `code` (overall: `VALID_HEADERS`, `INVALID_HEADERS`, `POTENTIALLY_INVALID_HEADERS`), `message`, optional `errors[]` and `warnings[]` (each item `{code, message, headers[]}` with `headers` min 1 item, lowercase header names).
- Note: OAS examples show `specVersion: '3.1'`. Whether the live service returns '3.3' is UNCONFIRMED.
- Verbatim examples (from OAS):

No headers:
```json
{
  "specVersion": "3.1",
  "code": "INVALID_HEADERS",
  "message": "No fraud prevention headers submitted. These are required by law. Check the specification."
}
```
All valid:
```json
{
  "specVersion": "3.1",
  "code": "VALID_HEADERS",
  "message": "All headers required for your connection method have been supplied and all appear to be valid. Validation is based on a single request. We have access to all requests and can draw additional conclusions."
}
```
Advisories only:
```json
{
  "specVersion": "3.1",
  "code": "POTENTIALLY_INVALID_HEADERS",
  "message": "At least 1 header is potentially invalid",
  "warnings": [
    {
      "code": "POTENTIALLY_INVALID_HEADER",
      "message": "Check you are using the correct Gov-Client-Connection-Method. Web applications do not usually provide the os field as browsers do not expose this information.",
      "headers": ["gov-client-user-ids"]
    }
  ]
}
```
Invalid:
```json
{
  "specVersion": "3.1",
  "code": "INVALID_HEADERS",
  "message": "At least 1 header is invalid",
  "errors": [
    {"code": "INVALID_HEADER", "message": "Value must be a recognised timezone in UTC format, submitted as UTC±<hh>:<mm>", "headers": ["gov-client-timezone"]},
    {"code": "MISSING_HEADER", "message": "Header required", "headers": ["gov-vendor-version"]},
    {"code": "INVALID_HEADERS", "message": "At least 1 pair of IPs in Gov-Vendor-Forwarded must include Gov-Client-Public-IP in the 'for' field and Gov-Vendor-Public-IP in the 'by' field. Check all 3 headers are consistent.", "headers": ["gov-vendor-forwarded", "gov-vendor-public-ip", "gov-client-public-ip"]}
  ],
  "warnings": [
    {"code": "POTENTIALLY_INVALID_HEADER", "message": "Check you are using the correct Gov-Client-Connection-Method. Web applications do not usually provide the os field as browsers do not expose this information.", "headers": ["gov-client-user-ids"]}
  ]
}
```
(Layout compacted for readability; values verbatim.) The validate endpoint infers the connection method from the Gov-Client-Connection-Method header (UNCONFIRMED; the OAS does not state how it picks the required set, but MISSING_HEADER "required for the connection method" implies it).

### 6.2 GET /test/fraud-prevention-headers/{api}/validation-feedback
- Feedback on the latest request your application made to each endpoint of a supported API in sandbox. Use after running tests.
- Path `api` enum (32): business-details-mtd, business-income-source-summary-mtd, business-source-adjustable-summary-mtd, cis-deductions-mtd, individual-calculations-mtd, individual-losses-mtd, individuals-business-end-of-period-statement-mtd, individuals-charges-mtd, individuals-disclosures-mtd, individuals-expenses-mtd, individuals-income-received-mtd, individuals-reliefs-mtd, individuals-state-benefits-mtd, obligations-mtd, other-deductions-mtd, property-business-mtd, self-assessment-mtd, self-assessment-accounts-mtd, self-assessment-assist-mtd, self-employment-business-mtd, vat-mtd, individuals-capital-gains-income-mtd, individuals-dividends-income-mtd, individuals-employments-income-mtd, individuals-foreign-income-mtd, individuals-insurance-policies-income-mtd, individuals-other-income-mtd, individuals-pensions-income-mtd, individuals-savings-income-mtd, self-assessment-individual-details-mtd, individuals-partner-income-mtd, individuals-tax-liability-adjustments-mtd.
- Optional query `connectionMethod` (the 8 values of section 3) to filter.
- Response: `{ "requests": [ { path, method, requestTimestamp, code, headers: [ {header, value?, code, errors[], warnings[]} ], crossValidation: [ {headers[], code, errors[]} ] } ] }`.
- Verbatim example (abridged: full OAS example lists all 20 headers; shown here are the interesting ones):
```json
{
  "requests": [
    {
      "path": "/organisations/vat/107794340/liabilities",
      "method": "GET",
      "requestTimestamp": "2020-09-21T10:30:05.962Z",
      "code": "INVALID_HEADERS",
      "headers": [
        {"header": "gov-client-connection-method", "value": "DESKTOP_APP_VIA_SERVER", "code": "VALID_HEADER", "errors": [], "warnings": []},
        {"header": "gov-client-mac-addresses", "code": "MISSING_HEADER", "errors": ["Header required"], "warnings": []},
        {"header": "gov-client-screens", "value": "width=1920&height=1080", "code": "INVALID_HEADER",
         "errors": ["At least 1 screen is missing a value for scaling factor", "At least 1 screen is missing a value for colour depth"], "warnings": []},
        {"header": "gov-vendor-version", "value": "my-desktop-app=2.2.2", "code": "POTENTIALLY_INVALID_HEADER", "errors": [],
         "warnings": ["For client server architectures, submit a version for the client and the server. For all other architectures, submit at least 1 version."]}
      ],
      "crossValidation": [
        {"headers": ["gov-vendor-forwarded", "gov-vendor-public-ip", "gov-client-public-ip"], "code": "VALID_HEADERS", "errors": []}
      ]
    }
  ]
}
```
- Interesting: the example's `gov-client-multi-factor` value `type=AUTH_CODE&timestamp=2017-04-21T13%3A23Z&unique-reference=c672b8d1ef56ed28,type=TOTP&timestamp=2017-05-19T13%3A10Z&unique-reference=ac73430ffdfd9` shows hashes need not be 64 hex chars, and `gov-client-user-ids` `os=user123`.

### 6.3 Complete code list (from the OAS schemas)

Overall result of /validate (`code` at top level):
- `VALID_HEADERS`: basic checks show that the header value supplied appears to be valid.
- `INVALID_HEADERS`: basic checks show that at least 1 of the header values supplied is not valid.
- `POTENTIALLY_INVALID_HEADERS`: at least 1 of the header values supplied is potentially invalid as per the current specification.

Items in `errors[]` of /validate:
- `INVALID_HEADER`: the header value supplied is not valid.
- `INVALID_HEADERS`: at least 1 of the header values supplied is not valid (used for cross-header errors).
- `MISSING_HEADER`: header required for the connection method is not supplied.
- `EMPTY_HEADER`: header required for the connection method is empty.

Items in `warnings[]` of /validate:
- `POTENTIALLY_INVALID_HEADER`: the header value supplied is potentially invalid as per the current specification.
- `UNEXPECTED_HEADER`: header value supplied is not a fraud prevention header, or the fraud prevention header is not spelt correctly.

Per request in validation-feedback (`requests[].code`):
- `VALID_HEADERS`: the header values supplied appear to be valid.
- `INVALID_HEADERS`: at least 1 of the header values supplied is not valid, check errors and warnings.
- `POTENTIALLY_INVALID_HEADERS`: at least 1 of the header values supplied is potentially invalid, check warnings.
- `NO_HEADERS`: the request did not have any fraud prevention headers.

Per header in validation-feedback (`headers[].code`):
- `VALID_HEADER`: the header value supplied is valid.
- `INVALID_HEADER`: not valid, check errors and warnings.
- `POTENTIALLY_INVALID_HEADER`: potentially invalid, check warnings.
- `MISSING_HEADER`: header required for the connection method is not supplied.
- `UNEXPECTED_HEADER`: header is not needed for the connection method, is not a fraud prevention header, or is not spelt correctly.
- `TEST_SCENARIO_HEADER`: header is used in sandbox testing to trigger different test scenarios.
(EMPTY_HEADER is defined in the schema for /validate errors but not in the per-header oneOf; the issue 465 thread reports EMPTY_HEADER being returned for an empty Local-IPs, so it does occur in practice.)

Cross validation (`crossValidation[].code`):
- `VALID_HEADERS`: cross checks identified no problems with the headers.
- `INVALID_HEADERS`: cross checks identified one or more problems with the headers, check errors.

Other: the overview page lists general HTTP classes 2xx success (202 accepted), 4xx client error, 5xx server error. Exact error body for 4xx (e.g. bad Accept) is a `{code}` object (`errorResponse` schema) with no enumerated values (UNCONFIRMED). The full per-header message catalogue (every error/warning text per header) is NOT published in the OAS; only the messages quoted above are confirmed. POTENTIALLY_INVALID_HEADERS means HMRC may still reject manually.

## 7. GitHub issue hmrc/income-tax-mtd-changelog #465

- Opened 30 Jun 2026 by 786infinite. Subject: MOBILE_APP_VIA_SERVER iOS app on serverless hosting cannot fully populate two headers:
  - Gov-Client-Public-Port: serverless platforms do not expose the client source port, validator returns MISSING_HEADER.
  - Gov-Client-Local-IPs: on cellular, iOS gives a sandboxed app no usable local IP, header sent empty, validator returns EMPTY_HEADER.
  - Question: is sending an empty value plus an explanation to SDST acceptable under the "restrictions beyond your reasonable control" exception?
- Other comments: MartyMcD-Tech (30 Jun 2026): same port problem on Vercel; added a small separate server that captures the port and forwards it, needed on every API endpoint. 786infinite (3 Jul 2026): still seeking an official ruling. ncarthy (27 Jul 2026): cannot get screen colour depth on mobile, used fixed value 32, emailed HMRC, no reply. taxeaseuk (26 Aug 2026): solved the port with a Caddy reverse proxy on a small VPS; pitfalls: proxy IP becomes the client IP unless the real one is forwarded, Gov-Vendor-Public-IP becomes the proxy IP, cookie domains need adjusting; unresolved Gov-Vendor-Forwarded second-hop question.
- HMRC answers: NONE found in the thread as read. The only HMRC text quoted is a general production-access email asking that "fraud prevention headers must be included and compliance evidenced" (not a ruling on these values), and the guidance's exception wording. Status: open. UNCONFIRMED: any later HMRC reply (the page was read through a summarizer and may have missed comments).
- Practical reading: until HMRC rules, treat Public-Port and Local-IPs on serverless/mobile-cellular as "collect via your own edge server, else report to HMRC (section 5) and do not send placeholders".

## 8. Implementation checklist for a validator (derived, not HMRC text)

- Select required set from section 3 matrix by Gov-Client-Connection-Method; flag MISSING_HEADER for absent, EMPTY_HEADER for empty, UNEXPECTED_HEADER for others.
- Check: UUID for Device-ID; timestamps by regex `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$` (Multi-Factor: minimum `yyyy-MM-ddThh:mmZ`, colons `%3A`-encoded); timezone `^UTC[+-]\d{2}:\d{2}$`; port integer 1..65535 and not 80/443; Public-IP valid public (non-private) IPv4/IPv6; positive whole numbers for width/height; scaling-factor and colour-depth present; MFA type in {TOTP, AUTH_CODE, OTHER}; User-Agent keys all four; no `null`/`undefined` placeholders; US-ASCII only.
- Cross check: Vendor-Forwarded contains a pair with `for` = Gov-Client-Public-IP and `by` = Gov-Vendor-Public-IP (compare after percent-decoding IPv6).
- Vendor-Version: warn when via-server and fewer than two pairs.
