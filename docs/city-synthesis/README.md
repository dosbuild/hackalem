# One source-owned city

Astana retains all 60,978 source building identities and geographic footprints.
Native buildings use six authored architectural families. Their roofs, walls,
façade details and conservative culling bounds derive from the attributed OSM
snapshot; explicit native landmark replacements account for their source IDs.
District color identities remain stable across plans and results.

The city is prepared before its complete first frame and retained for that world’s
session. Camera movement culls drawing without deleting or replacing the city.
The renderer shares physical depth, light and shadows with projects and people.
Landmark scale and ordinary cartographic height relief remain separate.

`npm run test:geometry` audits building-ID coverage against the original source,
roof/wall triangles, exact corner and height preservation, finite coordinates,
lossless indexed geometry, conservative bounds and owned façade transforms.
It also checks environment and initiative/resident clearances. Raw authoring
sidecars and monolithic audit meshes remain outside the runtime package.

The generator is `scripts/alem/prepare.mjs`, its architecture, terrain and
street-environment builders. The renderer is `src/world/city-gl.js`.
Run `npm run build && npm start`, then inspect every district at overview,
street and encounter scale. Native gallery family examples are selected from
this checkout’s prepared source, without another reference package.

Current payload, resource and performance results belong to [release evidence](../release.md).
Browser recordings and diagnostic media remain in ignored `artifacts/`.
Procedural planting, furniture and cartographic height relief are game
interpretations. OSM is not a legal survey, and local browser measurements do not
establish physical-phone or public-network performance.
