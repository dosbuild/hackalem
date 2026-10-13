# Latest assemble: a school arrives in Nura

This scene is part of the normal production application. Choose the school story on the first screen, or open the full catalogue and choose
**Модульная школа и детский сад** in **Нура**, then **Построить школу · 24 ед.**.
An optional isolated demonstration remains under **Новая попытка и обучение**.
The real commitment spends 24 units; it requires no debug route or query parameter.

The 10-second sequence follows three module deliveries along existing source roads,
holds the camera for crane lifts, assembles a courtyard school and opens its entrance.
Children and parents arrive after the deliveries. The crew and crane leave before
the camera settles on the completed school and stays for inspection. Revisit the school through its map label:
the completed object, trees, benches, play corner and everyday movement persist.

The scene depicts a commitment. Its completion does not itself apply future indicator values; the application calculates automatically when the fifth valid decision is committed. The catalogue, cost, lag, effects, incompatibilities and eight-quarter model
remain unchanged. The cast is illustrative staging, separate from the resident
registry; existing resident conversations still use calculation evidence.

## Repository and deployment

- `src/world/hero-school.js` owns this event's camera, procedural geometry and cast.
- `src/world/hero-school-site.json` records the checked parcel and two OSM ways.
- Choreography and project rendering dispatch to it only for `M7:nura`.
- `scripts/alem/placements.mjs` reproduces the new site; the other 69 records stay.
- Existing city generation reserves the school footprint. All 60,978 source buildings
  remain. No separate asset loader or external service is introduced.
- Manual navigation releases the flight while construction continues. Reduced motion
  shows settled geometry. A saved receipt restores an unfinished build at its actual
  elapsed time and never replays a completed school. Removal clears it.

The integration preserves Node 24, the production runtime allowlist, old draft
migration and the released reduced-motion guard. Browser scripts save reproducible
captures under ignored `artifacts/hero-school`, not the production package.

## Reproduce

```sh
npm ci --include=dev --ignore-scripts
npm run verify
npm run test:runtime
python3 scripts/scenario/oracle.py
npm run prepare:placements
npm start
```

In another terminal:

```sh
npm run test:school
npm run test:release
npm run test:fullscreen
npm run test:consequences
npm run test:budget
APP_URL=http://127.0.0.1:4174 node scripts/release/public-smoke.mjs
```

`verify` includes the school site audit against the full prepared source fixture.
It checks 2,008 pedestrian samples and 611 delivery envelopes against 61,714
building/water polygons, and requires every delivery segment to exist in a recorded
source road. The same audit runs in GitHub CI and the Railway build.

`test:school` records an uninterrupted real-UI commitment and ordinary revisit,
checks every scene beat and shared render camera, then checks interruption, reduced
motion, reload, removal and narrow touch layout. `APP_URL` selects another server;
`CAPTURE_DIR` redirects school capture/audit outputs. Current test counts, source
hashes and build measurements are in `release-verification.json`.

After the owner merges, the existing Railway service builds this code from the
repository. Verify the deployed merge hash at `/version.json`, then run the public
smoke and school tests using the public `APP_URL`.

Current cold-load transport is approximately 18.2 MB compressed for the full entry;
indexed GPU geometry is approximately 155 MB.
Measurements use local production desktop and touch emulation. No physical handset,
new participant study, paid AI call or mobile-network benchmark is claimed.
