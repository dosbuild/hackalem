# Contributing to Alem

Use Node.js 24 and the locked dependencies: `npm ci --include=dev --ignore-scripts`.
Run `npm run dev` for the application and same-origin APIs. Core play works without
an API key. See [the development guide](docs/development.md) for production setup
and [the agent integration guide](docs/agents.md) for provider changes.

## Source boundaries

- `src/domain/` owns the supplied scenario, plan validation and eight-quarter score.
  The original assignment is in `docs/scenario/source/`; preserve its data and rules.
- `src/app/` owns decisions and application state. `src/core/` owns deterministic
  review, search and council logic. Generated prose must not replace either layer.
- `src/world/` owns the geographic Astana and fictional Khanate presentation;
  `src/world/contract.ts` defines the application/world boundary. Keep visual
  events, residents and camera motion separate from numerical effects.
- `server/` owns same-origin HTTP APIs, provider adapters and durable storage.
  Keep credentials on the server and preserve local fallback behavior.
- `scripts/release/build.mjs` defines the runtime asset allowlist. Preserve required
  third-party licenses, geographic attribution and content-integrity checks.

## Working rules

Preserve existing contributors' changes. Keep edits focused and use the existing
patterns before introducing dependencies or abstractions. Do not commit, publish,
deploy or rewrite history without an explicit request.

Keep the original 100-unit budget, five distinct initiatives, maximum two per
policy area, scope conflicts and exact calculation intact. Astana and Khanate use
that same model. Do not turn fictional requests into claims about real people or
promise that a rendered construction resolves an appeal.

Run focused tests while editing, then `npm run verify` for code changes. For runtime,
API or asset changes also run `npm run test:runtime`; use `npm run test:browser` for
loading or gameplay changes. Inspect meaningful UI changes in the running game.
Use the documented preview regeneration workflow when model/rendering sources
change; do not bypass freshness or checksum failures. Report what actually passed
and any remaining limitation. Keep credentials, personal paths, local recordings,
caches and generated runtime bundles out of source control.
