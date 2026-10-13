# Current release

The current source includes the Astana and Хандық worlds, refined native movement,
reduced-motion behavior, clearer place framing and polished dialogue and decision
panels. The educational calculations and game rules are unchanged.

The design pass passed 631 tests in 74 files, type checking, asset/model/geographic
audits, the production build and the isolated runtime checks. Browser evidence
covered both worlds, desktop and phone layouts, all six historical nature scenes,
reduced motion, storage recovery and complete five-decision journeys. These checks
were local; they are not physical-phone, live-provider or deployed-service checks.

This source package was exported without the old Git database, dependency caches,
private local records or browser captures. It retains reproducible build tools,
meaningful tests, attribution and prepared geography. The clean-copy verification
record is in `release-verification.json`. No production deployment was performed.

Linux CI exposed two expensive byte-array assertions and platform-dependent
placement serialization. The assertions now use exact native byte comparison.
Placement verification keeps identities and topology exact, allows only tiny
continuous-coordinate drift, and still runs the full geometric clearance audit.
The corrected Linux run must finish before enabling Wait for CI deployment.

## Reproduce

Use Node 24. Run `npm ci --include=dev --ignore-scripts`, `npm run verify` and
`npm run test:runtime`. See the root README for browser checks. After model,
material, projection or preview-authoring changes, run `npm run dev` and export
fresh previews with `APP_URL=http://127.0.0.1:5174 npm run prepare:previews`.
Playwright Chromium can be installed with `npx playwright install chromium`, or
use an installed Chromium-family browser via `BROWSER_PATH`.

[Railway setup](../DEPLOY_RAILWAY.md) · [Provenance](source-provenance.md).
