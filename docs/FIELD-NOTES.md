# Field notes: what hand-rolled builders learned from HMRC

The specification (docs/SPEC.md) says what to send. These notes record what public, hand-rolled
implementations wrote down after HMRC's validator or HMRC's fraud headers team pushed back. Each
note links the source file it comes from, read on 2026-11-09. The library's validator turns the
ones that can be checked offline into errors or warnings.

| Lesson | Where it was written down | What this library does |
|---|---|---|
| Placeholder values ("Unknown" browser, fixed window and screen sizes, a fixed port) are read by HMRC as an unimplemented header; an absent value beats an invented one. | MileClear `fraudPreventionHeaders.ts` (HairyGair/MileClear@2391d8e) | The builder never fills a value. A header with no data throws `MissingFraudDataError` unless `unavailable` records how HMRC agreed to handle it. The validator rejects `null`, `undefined`, `unknown`, `n/a`, `none`. |
| `Gov-Client-Browser-JS-User-Agent` is refused when percent encoded: send it as the browser reports it. | Sentrello `mtd-headers.ts` (Sentrello/Sentrello@e0bbd16) | The builder passes the user agent through, encoding only non-ASCII bytes. The validator warns on an encoded user agent. |
| `os=` in `Gov-Client-User-IDs` draws a warning for web apps. | Sentrello, and HMRC's own Test API example (SPEC.md 6.1) | Warning with HMRC's exact message. |
| A plaintext licence key is refused ("at least 1 value for license is not hashed"). | Sentrello | `hashLicenseKey()`; the validator warns on a value that does not look hashed. |
| The spec's example port `12345` must never be sent. | Mytaxdiary `hmrc-fraud-headers.builder.ts` (Mytaxdiary/MTD-Backend@145132b) | Warning "Value is an example from the specification", also for documentation-range IPs. |
| The window must not be larger than the primary screen (an HMRC cross check). | Mytaxdiary | Cross warning on `Gov-Client-Window-Size` against `Gov-Client-Screens`. |
| Behind a proxy or a serverless platform the client's TCP source port is lost; vendors put a small edge proxy in front that forwards it. | hmrc/income-tax-mtd-changelog issue 465 (comments of 2026-06-30 to 2026-08-26) | `requestFraudData({ clientPortHeader })` reads the port your edge forwards; without it the port is reported missing, never guessed. |
| A sandboxed iOS app on cellular has no usable local IP; HMRC has not ruled on it publicly. | issue 465 | Use `unavailable: { "Gov-Client-Local-IPs": "empty" }` only once HMRC agreed it (SPEC.md section 5). |
