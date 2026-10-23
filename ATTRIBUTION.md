# Sources and licenses

This document identifies the third-party material used by Alem. Its source data,
fonts, and dependencies retain the terms listed below.

## Geographic data

© OpenStreetMap contributors. The prepared geographic database and its derived
map data use the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Source: [Geofabrik's Kazakhstan extract, 24 September 2026](https://download.geofabrik.de/asia/kazakhstan-260924.osm.pbf).
The [prepared database](data/prepared/geography.tar.gz) includes source object
identifiers and attribution. The [LRT dataset](public/alem/lrt-route.json) is
also OSM-derived and distributed under ODbL.

Retain the on-map credit and [OpenStreetMap attribution](https://www.openstreetmap.org/copyright)
when distributing the geographic game. Buildings and boundaries are community
map data; heights and fallback boundaries may be approximate. The five districts
used by the educational model are not a claim about current administrative limits.

## Fonts and dependencies

Noto Sans, Noto Serif, and Shantell Sans retain the SIL Open Font License 1.1.
Shantell's license is included in `src/design/assets/SHANTELL-OFL.txt`; the Noto
licenses are distributed with their installed packages. Builds copy all font
notices into `/licenses/`.

React and React DOM use MIT; Earcut uses ISC. Their license texts are included
in the runtime package. Other development dependencies retain their own licenses
as distributed through the lockfile.

## Artwork and residents

Alem's building, project, and resident models are procedural originals. Aya's
illustrated guide atlas was created for this project with AI assistance. See
[artwork sources](docs/play-art-provenance.md) and [landmark references](docs/landmarks/current-package.md).
Reference photographs are not bundled.

Residents, names, and circumstances are fictional. Public city and eOtinish
materials informed the themes; the game does not contain private submissions.
The [resident source notes](docs/integration/PROVENANCE.md) identify those references.

## Hackathon assignment

The “Mayor for 5 Hours” brief and supplied numerical scenario are third-party
assignment material retained for reference. Their inclusion does not claim
ownership of the organizer's text. The game uses synthetic indicators, not current
municipal statistics or predictions.
