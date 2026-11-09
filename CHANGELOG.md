# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-09

### Added

- Header builder for the eight connection methods of HMRC fraud prevention specification v3.3.
- Offline validator returning the codes and response shape of HMRC's Test Fraud Prevention Headers API.
- Request reader for the public IP, port, timestamp and `Gov-Vendor-Forwarded` chain, with Express, Fastify and Hono adapters.
- Browser collector for the client fields of `WEB_APP_VIA_SERVER`.
- Percent encoding, key-value and list helpers, timestamp and timezone formatting, licence key hashing.
