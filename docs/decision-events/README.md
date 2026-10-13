# Decision events

The release makes an explicit project commitment visible as construction in its
existing geographic location. Parks grow paths and rounded canopies; road and
utility works spread from the route centre while preserving every mapped bend;
schools and clinics assemble in floors. Restrained arrival and finish illumination
uses the city renderer. Projects have distinct persistent marks at overview.

`choreography.js` controls camera visits; the saved construction clock controls
visual progress. Standard commitments last 12 seconds, and the Nura school lasts
10 seconds. Local projects end in a held close view; citywide measures show all
five districts. The next-choice action returns to the overview, even while a
previous construction continues. No waiting is required to make another decision.
Manual navigation cancels camera ownership without cancelling construction.
Inspection uses the same camera frame, stops on manual input and lasts at most
24 seconds. Reduced motion substitutes a discrete camera turn.

Labels clear the construction view; secondary controls dim briefly but remain
available. Reduced motion skips the camera tour, disables event illumination and
freezes periodic vehicle/tree/project movement. The committed geometry stays.
The released reduced-motion guard and all existing draft migration fixes remain.

The five existing district colours now contribute 88% of ground colour at overview,
fading to 28% in close views. The surrounding apron stays neutral. Project visuals
do not change district identity, calculation, costs, placements or resident identity.
The complete 60,978-building city and runtime asset allowlist are unchanged.

## Reproduce

```sh
npm ci --include=dev --ignore-scripts
npm run verify
npm run test:runtime
python3 scripts/scenario/oracle.py
npm start
```

In another terminal, against the production server:

```sh
npm run test:release
npm run test:fullscreen
npm run test:consequences
npm run test:budget
APP_URL=http://127.0.0.1:4174 node scripts/release/public-smoke.mjs
```

The gallery waits for the actual construction stage for each of the 14 measures;
fixed delays no longer confuse the return flight with construction. Unit regressions
check route bends, duplicate preview suppression, event lighting scope and a real
stationary people hold. Browser checks cover reduced-motion camera stability.
Current results and build hashes are in `release-verification.json`.
Raw recordings and screenshots are reproducible under ignored `artifacts/`.

## Deployment and limits

The PR targets main after merged PR #4 (`26154d4`). The owner merges; Railway builds
from the root using the existing config and verification gates. No new environment
variables, provider key, migration or external service are required. After deployment,
compare `/version.json` with the merge commit and run the public smoke test.

Initial compressed transfer remains about 35 MB, with a 176.2 MB raw city buffer.
Desktop and touch-emulated browser checks do not establish physical-phone performance
or new-player comprehension. The real API check uses the labelled local explanation.
