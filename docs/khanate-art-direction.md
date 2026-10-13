# Хандық: authored material references

The city and all of its stories are fictional. Its coordinates and civic institutions
are a game translation, not a reconstruction of eighteenth-century Astana.

The visual vocabulary uses a collapsible timber lattice, felt coverings, rope
bindings and woven structural bands. The construction sequence treats these as
connected parts: frame, roof poles and crown, coverings, door, domestic textiles.
This material reading follows [UNESCO's yurt documentation](https://ich.unesco.org/en/RL/traditional-knowledge-and-skills-in-making-kyrgyz-kazakh-and-karakalpak-yurts-turkic-nomadic-dwellings-02284)
and its [documented assembly photographs](https://ich.unesco.org/en/10-representative-list-00748?id=00998&include=slideshow_inc.php).

Felt furnishings, reed mats, woven bags and bands, restrained decorated metal,
and leather vessels inform the props. The [National Central Museum's collections](https://csmrk.kz/en/collections)
provide this material vocabulary. Most surviving objects in that collection are
later than the game's fictional setting; they are references for materials and
craft, not evidence that these exact buildings or people existed.

All game geometry, icons and ornaments are drawn for this project. No museum or
UNESCO photographs, scans or models are redistributed. Paired curves and woven
bands are original geometric interpretations, not tracings of collection objects.

The invitation is captured from the native historical renderer, using
`scripts/khanate/studio.html` and `scripts/khanate/capture-invitation.mjs` against
the development server. No separate painted promise replaces the playable world.
The existing Aya illustration is preserved pixel-for-pixel in lossless WebP:
`cwebp -lossless -z 9 -exact public/aya/guide-atlas.png -o public/aya/guide-atlas.webp`.
Self-hosted Noto Sans and Noto Serif include Cyrillic and Kazakh coverage; their
OFL licenses ship in both release packages.

Palette: warm felt, pale paper, sage vegetation, a grey turquoise river, clay,
weathered brass, indigo and small dark red textile accents. Ornaments belong on
bindings, doors, rims and edges. Leave large felt and paper surfaces quiet.

The River atlas world uses the reviewed teaching court's local object unit across
the other projects, household yurts and civic furniture. Native named residents
and the 42 landmark keepers retain their body size. Moving villagers and animals
use comparable silhouettes; geographic travel slows while walking gestures keep
their cadence. Each initiative's six use/meeting positions follow its doorway,
court, route stop or crossing, rather than an oversized shared offset.

All 188 accepted homes and 420 instances remain. Household formations gather
around the existing quarter centres, with smaller courts and narrow dirt paths.
The original accepted home identities, ordering, variants and orientations are
recorded in `src/world/khanate/settlement-layout.json`; limited placement repairs
clear the smaller structures, paths and moving cast. Quarter polygons, river,
steppe relief, project origins and route centreline coordinates remain intact.
Bridge and ferry landings retain their bank connections while their planks,
rails, shelters and boat use the common detail scale.

`prepare:khanate` derives instance bounds, landmark heights/focus and 70 project
camera bounds from the actual meshes. `node scripts/khanate/prepare.mjs --check`
validates generation without writing assets. The own-model previews must be
regenerated after these source changes. CPU scale/clearance checks establish
geometry and preservation; close visual review remains required before claiming
the complete historical world meets the current release’s visual benchmark.
