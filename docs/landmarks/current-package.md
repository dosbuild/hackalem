# Astana landmarks — current planar map

This is the active October 3, 2026 implementation. The earlier files in this directory document a retired spherical-map pass; their assets, camera code and build commands are not used by the current application.

Open **Места Астаны** on the city map or use `?landmark=expo`. Previous/next steps through fourteen places. **К решениям** returns to the plan without changing the budget or decisions. Drag, zoom and the inspection control use the existing city camera. Deep links also support `baiterek`, `khan`, `palace`, `akorda`, `hazret`, `opera`, `arch`, `concert`, `atyrau`, `abudhabi`, `grand-mosque`, `esil-bridges` and `lrt`.

## Delivered geometry

| Place | Distinguishing details |
| --- | --- |
| Nur Alem / EXPO | 80 m glazed sphere, curved base, wind scoop, panel lattice; seven surrounding pavilions follow their mapped footprints and courtyard openings. |
| Baiterek | Gold sphere, open branching support lattice, stepped circular plaza and small street furniture. |
| Khan Shatyr | Asymmetric 150 m mast, concave tent membrane, cable rhythm, glazed perimeter and teardrop rooflights. |
| Palace of Peace and Reconciliation | 63 m pyramid, triangular stone panels and glazed crown. |
| Akorda | White colonnades, blue dome, golden spire and layered portico. |
| Hazret Sultan | Four slender minarets, domes, asymmetric prayer hall and side wing; adjoining U-shaped annex follows its exact footprint. |
| Astana Opera | Columned entrance, pediment relief and quadriga, copper fly-tower roof and side colonnades. |
| Mangilik El | Open pointed arch, niches, bronze reliefs and projecting cornices. |
| Qazaqstan Concert Hall | Joined blue petal walls, tiled facade and enclosed roof, aligned to the surveyed long axis. |
| Atyrau Bridge | Curved mapped deck and open fish-scale canopy. |
| Abu Dhabi Plaza | 311 m stepped main tower and geographically placed companion blocks. |
| Grand Mosque | 62 m blue dome, four 130 m minarets, open arcaded courtyard, small domes and 31 open flower shade structures. |
| Esil crossings | Lower 155 m LRT arch and distinct taller road arches alongside it; river span has no generic intermediate rail piers. |
| Tarlan Astana LRT | Mapped elevated corridor, paired rails, 18 stations with silver curved roofs and steel bracing, articulated four-car turquoise trains with roof equipment and bogies. |

There are 79 compiled model pieces, 305 explicitly identified source replacements and 3,415,362 landmark vertices. Every one of the 60,978 source building features remains accounted for. Replacements use exact source IDs; neighbouring buildings are not erased by proximity. Native landmarks use uniform physical scale of 1/12000 per metre. Ordinary city buildings retain the established cartographic height relief.

## References and accuracy

Builders retain their official architectural source URLs, documented dimensional estimates and explicit footprint IDs. The source-vetted model audit checks those dimensions independently. Research photographs are not runtime textures or production-source dependencies.

Source footprints and explicit replacement IDs are in `scripts/alem/landmarks/geography.json`, the pavilion/grounds/annex source extracts, and `src/world/lrt-route.json`. Their small extraction scripts reproduce the source selection from the existing attributed snapshots. Normal builds do not need Python or GIS tools.

These are original stylized architectural models, not engineering reconstructions. Verified headline dimensions anchor the silhouettes; facade subdivisions, bridge arch rise, secondary tower heights, pavilion heights and small ornament are visual interpretations documented in model source comments. The LRT corridor is the mapped local extract, not a claim that every operational kilometre is represented. Train movement is illustrative, with station dwell and acceleration; it is not a live timetable. Terminal turnback changes running tracks during a dwell rather than simulating a depot movement.

## Implementation and repeatable verification

`scripts/alem/landmarks/catalog.mjs` owns placement, heading, replacement IDs and arrival cameras. Builders in that directory emit metre-space geometry. `scripts/alem/prepare.mjs` compiles the models into the same resident city geometry and spatial index as the surrounding map. Materials share the world depth, lighting and shadows. Exact zero-area triangles are excluded in the landmark-only mesh helper.

`src/world/lrt-model.js` is shared by the real corridor and the existing M3 scenario treatment. Scenario routes remain separate and retain their scenario label. `lrt-motion.js` caches train parts, articulates each car along the route, limits visible trains and respects reduced motion. `landmark-explorer.js` only controls exploration and does not alter game state.

Run from the repository root:

```sh
npm run verify
node scripts/alem/landmarks/check-models.mjs
node scripts/alem/landmarks/check-motion.mjs
APP_URL=http://127.0.0.1:4175 node scripts/alem/landmarks/verify-browser.mjs
```

The model audit checks source uniqueness, finite positions and normals, heights, station alignment and actual train/structure clearance. Browser QA tours all fourteen places in the real city, tests the deep link, unrestricted landmark zoom, unchanged saved plan, return controls, zero additional city-geometry requests and phone layouts. Reproducible screenshots and reports are in `artifacts/landmarks/map-qa`; isolated multi-angle authoring views are in `artifacts/landmarks/civic-qa` and `studio`.

Production packaging is allowlisted. Photo references, authoring studios, source meshes and QA screenshots are not runtime dependencies. The narrow attributed rail database is published at `/alem/lrt-route.json` alongside the existing prepared geographic database.

Current verification and the tested build are recorded in [release status](../release.md).
