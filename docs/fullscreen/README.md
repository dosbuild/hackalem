# The map is the application

Run `npm run build && npm start` from the repository root, then open
[the local app](http://127.0.0.1:4174). See [current release verification](../release.md)
for the prepared branch and deployment baseline.

## Structural diagnosis and changes

The earlier page grid resized the map and introduced document scrolling. Projects
were fixed-pixel Canvas drawings, while residents used a separately clamped zoom
multiplier. Their anchor points followed the camera, but their bodies did not.

- `App.tsx` mounts one viewport-sized `WorldHost` for the entire journey. The left
  resident drawer, right treasury drawer, help, conversation and result overlay it.
  Drawers have their own scrolling; the document does not scroll.
- `projection.js` produces one immutable frame after each camera update. WebGL,
  physical resident models, project annotations, conversation placement and picking
  all consume that frame. No annotation position has a CSS transition.
- `project-objects.js` writes the existing packed primitive format. Proposals and
  commitments participate in the existing city depth and shadow passes. Funding
  changes the provisional object's construction, never the calculated effect.
- Residents use modular world geometry in the city depth pass. Stable appearance
  comes from the existing registry; their positions and project annotations share
  the same matrix and scale. Portraits use the same registry identities through the new SVG portrait system.
- All 14 initiatives have five vetted visual sites. Parcels avoid source buildings,
  water and streets; routes follow prepared OSM ways. Confirmation closes the drawer,
  shows construction and nearby residents, and holds the completed local site.
  Citywide projects retain an overview; the player chooses when to move on.
  Reduced motion skips the tour. These are illustrative draft objects, not real
  engineering proposals or additional numerical effects.
- Measured viewport overlays feed `revealFocus`. It adjusts the authoritative
  camera only if a focus would be obscured. Mobile conversation sheets join that
  calculation. Closing a readable drawer does not recenter the map.
- Three feasible resident needs start each turn; the resident space offers all
  seventy authored encounters in the same native city.
  Aya owns arrival and system help. A resident owns the encounter. Inspecting a
  project preserves the close view when already in that district.
- Numbered, named commitments remain in the city with drawers closed. Citywide
  initiatives have anchors in all five districts. Clicking a provisional label
  focuses it without committing it.
- The five-decision count and evaluation action remain outside the planning drawer.
  The result starts with a supported improvement and an unresolved need. Each
  project can be revisited at its exact site, then followed to its resident. Revision, alternatives and restart
  retain the same reducer and evaluator. Revision preserves comparable daylight.

The old sphere and standalone landmark showcase remain excluded. Current authored
landmarks belong to their geographic sites in the shared native world.
Ordinary base buildings and the five scenario polygons are retained. The 100-unit
budget, 14 fixed costs, five distinct decisions, area caps, scoped incompatibilities,
synergies, eight-quarter calculation, persistence and alternative-plan rules are
unchanged.

## District identity baseline

The current building, ground and planting treatment is documented in
[city synthesis](../city-synthesis/README.md). The navigation colours below retain
the earlier district identity.

Three material sets were compared on the actual low-detail city geometry, using
identical camera, water, buildings and lighting at `.16`, `.75` and `1.16`.
The **mineral** set has clearer territory separation than linen and less saturation
than garden. It is shared by mesh generation, labels and navigation:

| District | Identity |
| --- | --- |
| Есиль | `#90b4ac` |
| Алматы | `#cfaaa0` |
| Сарыарка | `#aab98e` |
| Байконур | `#aaa9bd` |
| Нура | `#cdbb92` |

The existing material fade now reduces territorial emphasis smoothly from district
scale to encounter scale. Identity colours never depend on scores. District names
and restrained boundaries supplement colour. Pale paper means proposal/commitment;
interaction emphasis remains distinct.

## Verification

Use `npm run test:fullscreen` against `npm start`. The continuous unseeded journey
covers the choice deck, priced preview, cancellation, exact commitments,
construction, inspection, right-drag/keyboard control, result-to-project-to-person
visits, citywide scope, and reload. Budget, alternatives, restoration, council and
assistant recovery have their own documented integration checks.
It runs at 1440×900, 1366×768 and 390×844, including reduced motion. Navigation and close encounters use the supported camera bounds in
`src/world/city-math.js`; every annotation follows the same rendered frame.

The independent anchor audit reconstructs GPU clip projection from sampled camera
poses, checked-in project placements and physical actor positions. It compares
project labels and resident feet in the same frame. Its subpixel error measures
projection arithmetic, not GPU raster accuracy. `test:world` exercises all 70 sites
and 560 meshes across construction stages, including elevated roof focus.

Fresh reports, screenshots and recordings go to ignored `artifacts/fullscreen/`;
set `RELEASE_OUTPUT` to override. The palette harness is an optional authoring study.
[Current release evidence](../release.md) records the checked results.
Touch uses emulation; no physical handset, new participant or native Kazakh review
is claimed.
