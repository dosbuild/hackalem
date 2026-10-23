# Prepared geography

`geography.tar.gz` is the attributed, prepared OSM runtime database: 584 spatial
chunks, five scenario district geometries, manifest, and attribution. SHA-256:
`94f7558127967bd4fb22085e529e3f7ccb46fbd808610e50e7e58a9e6ea077dd`.

Source: Geofabrik Kazakhstan 2026-09-24, OpenStreetMap contributors, ODbL 1.0.
The enclosed manifest records the extract fingerprint and study bounds. These
five scenario districts are not a statement of current administrative divisions.
Missing boundaries are explicitly marked approximations. Heights retain source tags.

`npm run prepare:city` verifies the archive before extraction; `prepare:alem`
compiles it through Earcut into the Alem renderer's geometry format.
Builds need neither another checkout nor network access to geographic services.
The compressed database is included for reproducibility and ODbL access; research
screenshots and the national raw extract are not included or published.
