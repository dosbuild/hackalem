# City-scale decisions

This refinement preserves the suspended city, fixed-cost plan, resident identities,
and eight-quarter evaluator. It changes the visual consequences and their rhythm.
The existing uncommitted renderer-residency work was retained.

## Diagnosis and selected treatment

The recorded baseline spent roughly ten seconds on an intervention, usually diving
straight to zoom 160. Two buses clustered at the middle of a route; one park patch
or one civic volume carried the whole decision. Overview silhouettes were also
losing their detail: the vertex shader assigned **every macro triangle the same
exact depth**, so a base could occlude its own trees, paths and moving vehicles.

Two live variants were recorded. The first widened shots and enlarged persistent
miniatures. Reviewing that run still showed isolated parks and clinics. The chosen
second version adds a small, staggered family of supporting spaces around the hero,
then returns promptly to the same canonical overview. A final edit softened the
supporting ground shapes, shortened nameplates, and strengthened service equipment.

- Standard district commitments take about **5.8–6.5 seconds**; construction starts
  during the last part of the approach. A stationary occupied hold lasts 1.05 seconds.
- Corridors use zoom 48, crossings 78, parks and rooftop fuel work 76, and other parcels 86.
  Manual resident/inspection views still use 160. The existing shared camera and
  projection own every frame; there is no second overlay zoom interpolation.
- The authored Nura school retains its trucks, crane, three deliveries and cast.
  Its construction clock runs faster until completion (12.94 seconds overall),
  with a wider 138/148 camera, then normal-speed persistent activity resumes.
- Citywide commitments propagate across five districts in 5.4 seconds.
- Existing local illumination gives an early district response and a compact finish.
  District identity colours stay fixed. Reduced motion skips the flight and freezes
  recurring motion; navigation cancels the optional camera sequence.

## Distinct consequences

| Direction | Physical consequence | Persistent overview |
| --- | --- | --- |
| Transport | Seven buses along the surveyed corridor, four staggered stops; original junction and LRT treatments | Road-following ribbons, stops, moving fleet |
| Environment | Twelve primary park trees plus nearby groves; two rows of windbreak trees; roof conversion traces seven surveyed buildings | Green clusters, paths, canopies and rooftop groups |
| People | Existing civic buildings with forecourt paths, planting and occupied nearby pockets | Campus silhouettes, courtyard/roof detail and planted satellites |
| Safety | Up to eighteen outward-activating lamps with broader actual surface illumination; three staggered crossings and a painted safety corridor | Warm connected light pools and crossing paint |
| Services | Larger request kiosk and secondary terminals; pipe access equipment and maintenance vehicles; three readiness hubs and six service vehicles per district route | Connected request nodes, twin network lines, distributed hubs and moving vehicles |

Thirty restrained background vehicles use existing surveyed routes at overview.
Macro detail has its own ordered depth and shaded volume. Native meshes hand over
below zoom 12, avoiding rebuilding invisible physical detail during macro events;
macro-only motion no longer invalidates city shadows.

## Geographic integrity

`src/world/context-sites.json` contains **95 supporting spaces** around 29 standard
parcel placements. `scripts/consequences/context-sites.mjs` reproduces them against
all prepared buildings, water, streets, existing vegetation, primary intervention
reservations and resident anchors. Every space stays in its district and clears
other supporting spaces. The authored Nura school uses its existing site instead.
Native trees, benches and terminals fit those checked envelopes. The smaller
service terminals are not used as new resident standing positions.

These are illustrative consequences of the existing measures, never added costs,
simulated benefits, population, facilities in the evaluator, or real parcel advice.
The overview miniatures exaggerate signal dimensions separately from physical
geometry. Primary placement records and base city meshes are unchanged by this pass.

To regenerate deliberately after geographic source changes:

```sh
npm run prepare:city
npm run prepare:alem
node scripts/consequences/context-sites.mjs
npm run test:geometry
```

The normal geometry gate runs the generator in `--check` mode and rejects drift.

## Review and reproduction

Production checks use a clean browser context and public planning controls. The
five-direction plan is M4/Есиль, M1/Алматы, M8/Нура, M10/Сарыарка and M14/citywide:
81 spent, 19 left. It evaluates through the existing calculated future and resident
conversation, then exercises removal and manual interruption.

```sh
npm run verify
npm run test:runtime
# With a built production server running:
npm run test:consequences
npm run test:fullscreen
npm run test:school
node scripts/release/surface-depth.mjs
```

This session's captures are under ignored `artifacts/city-impact/`: `before/`,
`experiment-a/`, `experiment-b/`, and `final/`. The final sequence includes the empty
overview, after one, three and five decisions, occupied district views, all fourteen
build/macro/close views, and an uninterrupted video. The depth regression uses the
actual production vertex shader and overlapping macro triangles, in addition to
physical resident/ground occlusion checks. Journey verification also checks that
no visual binary/model resources load after the city is ready.

The recordings and sampled frames were used for visual review. Browser timings
measure this local desktop run; they do not establish physical-phone performance
or new-player comprehension. No deployment was performed.

The final build and verification counts are recorded in [verification.json](verification.json).
All 179 unit tests, 560 mesh samples, fourteen intervention galleries, the full
five-decision journey, fullscreen/anchor checks, school behavior, 31 depth checks,
and production runtime checks passed. The final plan retains 19 units and scores
55.14, matching the baseline. The final local recording sampled 1,847 event frames
with an 18.2 ms p95 interval and 18.8 ms maximum.
