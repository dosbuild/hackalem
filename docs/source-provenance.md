# Production source and provenance

The River atlas production source is exported from the active Alem implementation.
It includes the game, API, meaningful tests, local preparation tools, source-vetted
geographic data, original procedural models and licensed fonts. The supplied
educational specification remains in `docs/scenario/source/`; it is executable
model evidence and remains required by the independent calculation oracle.

The imported CityRT/Little Borough package was a visual study, never an executable
application dependency. It has been removed. Active application source, assets
and the runtime allowlist have no dependency on that workspace package. The
standalone export includes only the retained sources listed below.

Retained art and data:

- Original building/project/people geometry, shader materials, code-native brand
  and portraits, and 140 previews exported from the native meshes.
- The original ImageGen Aya atlas and its [authoring record](play-art-provenance.md).
- Shantell Sans and Noto fonts with their official licenses and local provenance.
- The attributed prepared OSM archive, explicit footprint IDs, source digests and
  the derived database published with the release under ODbL.
- Original synthetic resident content and genuine synthetic legacy-save fixtures;
  no private citizen submissions or provider credentials.

The export contains only current source. Earlier commits, retired visual studies,
remote configuration and local execution records are excluded.

`.env*`, `.data/`, dependency caches, generated map/audit buffers, browser captures,
local execution records and Git internals do not enter the export. The runtime
allowlist separately restricts both connected and static packages. License and
attribution files remain required assets.

The final source inventory belongs to `SOURCE-MANIFEST.json`, refreshed after the
last implementation and documentation edits. [Release verification](release-verification.json)
identifies which build each acceptance report actually tested. Generated captures
and local evidence are reproducible working records; they do not enter production
source or establish a public deployment.
