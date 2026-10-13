# Production cleanup

The current source is a standalone production repository with one root commit.
The source manifest and local acceptance are complete in the
[release record](release-verification.json). Previous development
checkouts and remote history are not part of this package.
The imported visual reference package, retired studies, generated captures,
credentials, local records, dependency caches and old Git objects do not enter the
production export. [Source provenance](source-provenance.md) records the audit.

The release builder uses an explicit allowlist. It publishes only requested
content-addressed map transport batches, raw source-owned façade transforms,
original previews and guide artwork, local fonts/licenses, metadata and the
attributed database. Monolithic meshes, duplicate raw batches and authoring
sidecars remain local audit outputs. Runtime smoke decodes every shipped geometry
batch and verifies exact checksums and source-independent startup.

Preview freshness follows the original database, builder code, renderer/materials,
projection and exporter. Generated platform-specific geometry hashes no longer
invalidate unchanged previews during a Linux deployment. The build verifies each
preview’s actual bytes against its manifest. Source changes still require a fresh
native export.

Browser tools use this repository’s source, bundled synthetic legacy fixtures and
current explicit thresholds. Optional authoring tools locate prepared data inside
this repository; no sibling checkout, historical acceptance recording or imported
style package is required. Generated evidence stays in ignored `artifacts/` and
`.playwright-cli/`.

`scripts/release/export-source.mjs` selects application source, meaningful tests,
build/deployment tools, current documentation, the educational specification,
prepared attributed data and owned art. It rejects symbolic links and source that
changes during export. The standalone repository has no imported development Git
objects or remotes. `SOURCE-MANIFEST.json` records the selected files and hashes;
regenerate it after the final edits settle and before the single source commit.

[Current release evidence](release.md) records completed checks and practical scope.
No deployment is implied by a clean source commit or a local build.
