# Contributing

Thanks for helping keep these headers right for everyone submitting to HMRC.

## Setup

```sh
npm ci
npm test          # builds, then runs the unit, golden and parity suites
npm run lint      # Biome
npm run typecheck
node scripts/run-examples.mjs
```

`npm run test:contract` runs the live checks against HMRC's published pages (and the sandbox
validator when `HMRC_CLIENT_ID` and `HMRC_CLIENT_SECRET` are set). The ordinary CI does not run
them; a weekly workflow does.

## Rules for a change

- A behaviour change starts with a failing test. A change to what a header looks like cites the
  HMRC page (or Test API response) it follows, in the test and in `docs/SPEC.md`.
- No runtime dependencies, and nothing Node-only under `src/` (the package runs on Deno, Bun,
  edge runtimes and browsers).
- Never invent a value for a header the caller did not provide: missing data is reported, not
  filled.

## Spec updates

When HMRC publishes a new version, update `docs/SPEC.md`, `src/spec.ts` (`SPEC_VERSION` and the
per-method lists), the golden fixtures in `test/fixtures/`, and the changelog, in one pull request.
