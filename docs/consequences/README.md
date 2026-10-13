# Geographic consequences

The fullscreen OSM city now hosts native, depth-tested interventions and toy-like
3D residents. The numerical scenario remains unchanged: 100 units, exactly five
distinct measures, original costs/scopes/conflicts, and the same eight-quarter
calculation. No placement or animation data enters the evaluator.

## One geographic record

`src/world/placements.json` contains 70 deterministic records (14 measures × five
districts). Each includes the district, geographic and world anchor, orientation,
parcel or connected OSM route, provenance, and vetted detail positions. Runtime
records add preview/planned/outcome state, progress and scenario revision.

`scripts/alem/placements.mjs` compiles them against the complete local OSM fixture,
including buildings omitted by the low-detail renderer. It checks building
footprints, water, road buffers, district polygons, other scenario sites and an
unobstructed oblique approach. It never edits base buildings. Road routes retain
every source bend and join only at shared OSM nodes. Furniture and people have
separate checked positions beside streets. Clean fuel uses existing residential
roof surfaces, not a new building. These are educational scenario placements,
not approved parcels, addresses or proposed real transit alignments.

Regenerate with `npm run prepare:placements`; audit independently with
`node scripts/consequences/audit-placement.mjs`. Raw authoring chunks and audit dumps are excluded from the production asset
allowlist; the attributed prepared database download remains available.

## Camera and layers

`choreography.js` owns the district visit: approach, construction, people and a
held final view. Standard decisions use the shared 12-second construction clock.
Citywide measures stay in the macro view while the same clock updates all five
districts. M7/Nura uses the [10-second school delivery sequence](../hero-school/README.md).
Confirming while already near the site approaches directly instead of flying back
out first. The finished local view stays until the player chooses the next story,
a district or an overview. Manual control releases the camera while construction
continues. Inspection turns around the existing world point for at most 24 seconds;
all labels, actors and picking use that same projection frame. Reduced motion
skips flights and uses discrete turns. The other 69 placements retain their sites.
Reduced motion also freezes periodic project movement and disables event lighting.
District ground colours are stronger at overview and soften around people.
See [decision events](../decision-events/README.md) for the current release checks.

The base city, scenario meshes and evaluated outcome material states remain
separate. All physical geometry and residents share the city depth pass and
`projection.js` camera frame. Parcel previews are pale partial assemblies;
commitments are paper-toned projected places; evaluated futures use fuller
materials and the existing evidence-bound dialogue.

See [city-scale refinement](../city-impact/README.md) for the current timing, distributed
supporting spaces, persistent miniatures and verification.

Macro echoes are cartographic signals derived from those same placements. They
increase signal visibility without enlarging physical buildings, trees or people.
People cull at macro scale. The complete city is loaded once; close views use the same geometry and projection.

## Fourteen physical treatments

| Measure | Native treatment |
| --- | --- |
| M1 | Road-following lane paint, separators, vetted stops and moving buses |
| M2 | Actual junction signals, coordinated activation and resumed vehicle motion |
| M3 | Scenario guideway, supports, station and vehicle on connected OSM segments |
| M4 | Ground, paths, planting beds, growing rounded trees, fountain and benches |
| M5 | Residential rooftop heating details and a diminishing illustrative smoke beat |
| M6 | Distributed rows of dimensional windbreak planting |
| M7 | Modular school wings, entrance, courtyard and play equipment |
| M8 | Clinical volumes, entrance, service bay and visiting residents |
| M9 | Courtyard court markings, goals, bars, hoop and seating |
| M10 | Street lamps, restrained cameras, emissive fittings and actual surface illumination |
| M11 | Road-surface crossing paint, signs and bollards |
| M12 | Requests propagate from inhabited anchors to service points; temporary network recedes |
| M13 | Local street cutaway, dimensional pipes, nodes and restored ground |
| M14 | Distributed readiness hubs and service vehicles on real road routes |

## Residents

`resident-models.js` builds the original 100 synthetic identities from their
existing body, clothing, hair, palette, mobility and prop records. There is one
batched mesh kit, with smooth rounded forms, wheelchair/cane variants, carried
objects, authored signature details and restrained shared actions. Identity is
stable across reloads, results and alternatives. Background bodies are not
invented simulated people. World picking opens the existing resident interaction
with the intervention's geographic context and active calculation evidence.

## Verification

- `npm run verify`: TypeScript, 170 unit tests, production build.
- `npm run test:budget`: all 14 fixed-cost previews, treasury pressure, replacement,
  cancellation, conflicts, keyboard and touch.
- `npm run test:fullscreen`: continuous editorial journey, alternatives, revision,
  responsive conversation and independent moving-anchor projection audit.
- `node scripts/consequences/audit-placement.mjs`: full-source geometry audit.
- `node scripts/consequences/journey.mjs`: continuous production run with M4/Есиль,
  M1/Алматы, M8/Нура, M10/Сарыарка, M14/citywide; 81 spent, 19 remaining; evaluation,
  a real 3D resident click, active evidence, removal and manual interruption.
- `APP_URL=http://127.0.0.1:4174 node scripts/consequences/gallery.mjs`: isolated
  public-UI construction/macro/close captures of all 14 measures.

Fresh reports and recordings live in ignored `artifacts/consequences/`.
Set `APP_URL` for the production server and `RELEASE_OUTPUT` for another output path.
See [current release verification](../city-synthesis/city-release-verification.json) for results. They are
browser automation on this machine, not a new participant study or physical
handset test. Browser frame intervals are not GPU fence timings.
