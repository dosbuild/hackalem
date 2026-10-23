# Architecture and extension points

Alem is a React application with a WebGL world and an optional Node API server.
Both Astana and the fictional Khanate use the same numerical model. The renderer,
residents and assistant explain a plan; they do not determine its score.

## Numerical model and decisions

`src/domain/scenario.ts` contains the supplied district data, indicators and
initiatives. `src/domain/plan.ts` validates plans; `src/domain/evaluate.ts`
calculates eight-quarter results. Types live in `src/domain/types.ts`.
A complete plan has five distinct initiatives, costs at most 100 units, selects
at most two initiatives per policy area, and respects district scope and conflicts.
Use these validators and evaluator when integrating the model into another stack.
They are source modules in this application, not a separately published SDK.

`src/app/state.ts` owns application transitions. Previewing a project does not
spend money. Confirmation commits its fixed price; replacement refunds and charges
atomically; cancellation preserves the existing decision. Budget accounting keeps
free, allocated and committed funds equal to 100. Displayed effects never scale
with partial allocations. Each world keeps its own plan and saved state.

Results carry the canonical scoped plan and scenario version. Resident dialogue,
comparison and analysis must refer to that result. The server recomputes supplied
plans instead of accepting browser totals. The independent Python oracle reads the
[original assignment](scenario/source/goal-objective.md), imports no production
calculator, and generates the [calculation audit](scenario/calculation-audit.md).
Changing the scenario requires updating the model and explicitly documenting the
new assumptions; do not adjust coefficients to fit rounded example headlines.

## Your own assistant or agent

The game works with local explanations and no provider credentials. The included
live integration uses OpenAI; connecting another provider requires a server-side
adapter rather than a browser API key or an arbitrary endpoint setting.

- `src/explanations/explain.ts` defines `ExplanationProvider` and
  `requestExplanation`. An adapter receives validated results, evidence and authored
  statements. Its response selects statement IDs and returns matching evidence;
  validation requires every explanation section, material risk and negative effect.
- `server/explanation.ts` validates incoming plans and adapts the included provider.
  Preserve result identity, cancellation, timeouts and local fallback when replacing
  the transport. A model must not supply authoritative scores or numeric facts.
- `server/assistant/service.ts` validates conversational requests and replies.
  `src/assistant/types.ts` defines conversation context, facts and action intents.
  Keep fact references, plan validation and stale-response checks when adapting a
  new agent. An arrival or background reply must not spend the player's budget;
  changes require the existing explicit action flow.
- `server/api.ts` exposes the shared development/production HTTP handler. Keep
  request size limits, same-origin mutation checks and server-only credentials.
  Council and registry endpoints also validate their plans before storing them.

These boundaries allow a different model or agent framework while preserving the
same game rules. Generated prose is an explanation of this synthetic scenario,
not a prediction of real city outcomes.

## World and presentation

`src/world/contract.ts` is the application/world interface. Application panels pass
semantic decisions and camera requests rather than manipulating meshes. A repeated
camera request ID must not replay a flight. The shared `projection.js` camera frame
controls geometry, labels, residents, picking and overlays. Manual movement cancels
an automatic camera visit without cancelling a committed construction event.

The city owns the viewport; panels scroll within it. Measured panel occlusions feed
the shared camera rather than introducing a separate overlay zoom. Keep readable
labels, keyboard focus, dialog focus restoration and reachable controls on short
screens. Reduced motion skips flights and periodic animation while preserving
committed geometry and numerical results.

Physical projects and residents use the city's depth, lighting and shadow passes.
Overview signals may emphasize a project without changing physical building scale.
District colors identify geography and remain stable across results. Static meshes
and bounded dynamic meshes are separate; dispose of world resources when switching
worlds. Material placement stays in world/object coordinates as the camera moves.

## Geography and model authoring

The prepared OSM archive makes normal builds self-contained. Preparation tools
create city geometry, content-addressed buffers and metadata from it. Keep source
IDs, explicit landmark replacements and source attribution: these account for
buildings and support independent geometry checks. Runtime asset digests protect
integrity and support cache invalidation.

`src/world/placements.json` holds the authoritative initiative/district sites.
Derived program sites add physical illustrations; their building, vehicle and actor
counts are not numerical outcome quantities. Placement audits check source
footprints, water, roads, district boundaries, access and site separation.
Normal builds use the curated catalogue. Generate candidate placements separately:

```sh
npm run prepare:placements -- --output artifacts/placement-candidates.json
node scripts/consequences/audit-placement.mjs --catalog artifacts/placement-candidates.json
```

Regenerating the authoritative catalogue intentionally changes scene composition
and requires updating dependent program sites and camera views. Regenerate project
previews after changes to model, material, camera or preview-authoring sources.
The build checks preview freshness and only includes approved runtime assets.

## Storage and delivery

Drafts and construction receipts stay in browser storage. Restore validated
choices and recompute derived results; damaged or inaccessible storage must leave
a usable recovery path. Connected council and registry records use a file store
with atomic replacement. It supports one writer/process. Use a different storage
adapter before adding replicas; never expose the store as a static asset.

The connected build provides server APIs; the static build uses browser-local
records and explanations. Both share the evaluator and worlds. See
[development and verification](development.md), [deployment](integration/DEPLOYMENT.md),
and [source licenses](../ATTRIBUTION.md).
