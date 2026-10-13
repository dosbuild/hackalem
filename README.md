# Әлем · Астана и Хандық

Alem is a small decision game set in a geographic Astana. Hear a resident’s need, choose a project, watch it become part of the city, then see who benefited and what still needs attention.

**Хандық — Город у Есиля** is a second, deliberately fictional world inspired by the late eighteenth-century Kazakh steppe. The permanent world selector opens it directly. Teaching yurts, caravan paths, gardens, healers, a petition book and a council at the khan’s court translate the same fourteen initiatives into another time. Each world keeps its own five decisions, treasury, residents, chronicle and camera. [Materials and provenance](docs/khanate-art-direction.md).

The visual identity is **River atlas / Есильский атлас**: a mineral palette, graphite contours, drawn shadows and quiet paper surfaces. Both worlds share the same camera, physical depth, native people and original procedural architecture. Headings use Noto Serif; body text and calculations use Noto Sans, with Shantell Sans reserved for small handwritten time notes. The catalogue’s 140 images are exported from Alem’s own playable models. [Visual direction](docs/river-atlas.md) and [current release evidence](docs/release.md) describe the shipped sources and the checks actually completed.

The first screen offers three priced stories. Five visible plan slots remember the player’s choices. A proposal visits its actual site and shows one benefit, the important limitation and the confirmation. The full fourteen-project catalogue, calculations and appeal archive remain available when wanted. No demonstration or assistant action spends money automatically on arrival.

**Город · Жители · Итог** share one city, one plan and one budget. The educational model remains 100 units, five distinct initiatives, at most two per policy area, all scoped conflicts and exactly eight quarters. Its figures are scenario assumptions, not current municipal statistics. Every offered card leaves a valid five-decision completion; the player can still inspect blocked catalogue choices and see why they do not fit.

The fifth decision calculates automatically. The result starts with the score, a resident helped and an unresolved need. Full district indicators, exact plan ranking, contributions, replacements, the optimum comparison, council amendments and a durable registry remain secondary tools. Restarting or adopting an alternative retains the previous plan and its original construction history.

## Run

Use Node **24.x** from the repository root.

```sh
npm ci --include=dev --ignore-scripts
npm run dev
```

Open **http://localhost:5174**. One process serves the city, hot-reloaded interface and the same APIs used in production. Server changes reload through Vite. Geography is prepared from the checked-in source archive; the development server compresses and caches immutable map batches so a remote preview does not transfer raw geometry.

For development entirely in a browser, use **Code → Codespaces → Create codespace** on your branch. The checked-in dev container installs Node 24 and locked dependencies. Run `npm run dev` in its terminal and open forwarded port **5174**. Keep the preview port private. Edit, commit and push the branch from that browser, then open a PR into `main`. [GitHub's Codespaces setup](https://docs.github.com/en/codespaces/setting-up-your-project-for-codespaces/adding-a-dev-container-configuration/setting-up-your-nodejs-project-for-codespaces).

To run the production package locally:

The build requires current own-model previews. After changes to models, materials,
projection or preview authoring, export them against the running development
server before building:

```sh
APP_URL=http://127.0.0.1:5174 npm run prepare:previews
```

The exporter requires Playwright Chromium or a compatible installed browser;
see [preparation and verification](docs/release.md). Then:

```sh
npm run build
npm start
```

Open **http://127.0.0.1:4174**. The release HTTP server serves the application and APIs from an explicit asset allowlist. `HOST` and `PORT` configure its listener; Railway supplies `PORT`. Use `npm start` to check the connected product.

To run the **complete core game without a server API**:

```sh
npm run build:static
node scripts/khanate/static-server.mjs
```

Open **http://127.0.0.1:4198** or **http://127.0.0.1:4198/khanate-preview/?mode=khanate**. Deploy the contents of `dist-static/` to any HTTPS static host, at its root or a subdirectory. Serve `.js` as JavaScript and `.gz` as binary if the host requires MIME configuration; no rewrite to an API is needed. Map and raw façade `.bin.gz` files are intrinsically compressed payloads and decompressed in workers; map payloads then decode losslessly. Ordinary hosts should serve them unchanged, without a `Content-Encoding` header. Do not open `index.html` through `file://`.

Static play includes exact completion and repair, local Aya explanations and commands, plan ranking, alternatives, council amendments, and a browser-local book. It makes no `/api/*` requests. Records stay on that device; denied browser storage keeps the current session usable until the page closes. The connected build retains optional live AI and explicit shared registry publication.

No key is needed for the model, guided project actions or labelled local explanations. To enable actual open-ended Aya dialogue and AI analysis, configure `OPENAI_API_KEY` in this application's ignored `.env` or the server environment. `OPENAI_MODEL` defaults to `gpt-4.1-mini`. Never use a `VITE_` variable for credentials. The current verification record explicitly distinguishes mocked provider tests, local fallback and actual provider calls.

Council protocols and registry entries are stored in `.data/dashboard.json` by default. Set **`ALEM_DATA_DIR` to a durable volume** for deployment. The storage contract supports one application process; do not run multiple replicas writing the same file. Browser drafts, construction receipts and Aya history are local to that browser. Runtime failures explain what could not be saved without inventing success.

## Product and data

- The geographic scene prepares all 60,978 mapped buildings before revealing the complete first frame. Indexed geographic batches remain resident; navigation changes drawing, not geometry ownership. Lossless transport reconstructs the original vertex and index bytes. Current size and performance measurements are in the verification artifacts; authored landmark work can change the geometry budget.
- Residents inhabit the same native city as the projects. Procedural portraits match their clothing, hair and accessories; the camera visits the actual project site. Four nearby stories are offered at a time, with all seventy people reachable. It contains 240 formal authored appeals, 48 per district. Seventy have interactive resident stories covering every initiative in every district. They are explicitly scenarios based on verified public themes, not private eOtinish submissions. [Sources and content boundaries](docs/integration/PROVENANCE.md).
- Aya uses a generated six-expression illustrated guide atlas. Its expressions supplement text status; a missing image never disables the assistant. Open text is sent only through the same-origin server. Numerical facts and executable changes come from validated application logic. Stop, retry and undo protect manual work; public registry submission always requires the visitor's explicit action.
- All 14 initiative treatments persist with the plan. A shared saved clock owns visual progress; animation does not change the eight-quarter effect delays. Reduced motion settles visuals quietly. Moving the camera releases its guided flight while construction continues. Finished local projects remain in view until the player advances. Inspection slowly turns around the same world point; manual input stops it. Reduced motion uses an immediate turn instead. Right-drag or Shift-drag rotates the map, and a two-finger gesture combines zoom and rotation.
- The council has seven participants and a chair. Its recorded speeches and votes are rule-based and labelled accordingly. Sector proposals can improve one dimension while lowering the aggregate score. Applying an amendment changes the shared plan; the earlier protocol remains attached to its original fingerprint.

The checked-in `data/prepared/geography.tar.gz` provides the attributed OSM snapshot. Build verifies its checksum and regenerates city assets without another checkout, remote imagery or a map-provider key. The geographic fallback remains usable during slow loading or unavailable WebGL. Resource hashes, retry limits, context restoration and the runtime allowlist protect complete-city readiness.

[Current release and checks](docs/release.md) · [Attribution](ATTRIBUTION.md) · [Calculation audit](docs/scenario/calculation-audit.md) · [Source provenance](docs/source-provenance.md).

## Verify

```sh
python3 scripts/scenario/oracle.py
npm run verify
npm run test:runtime
```

`verify` runs types, unit/integration tests, local font and own-preview audits, model and geometry audits, and the production build. `test:dev` checks the real development server and compressed map transport. `test:browser` starts an isolated production process and plays a complete five-decision journey at desktop and phone sizes, including map failure and recovery. CI is configured to run both; this pass has not been executed on Linux CI. `test:runtime` copies only `dist/` and `.server/` into an isolated temporary directory, validates assets and compression, starts the production API, checks private-path rejection and stops the process cleanly. Git identity (or `RAILWAY_GIT_COMMIT_SHA`) is required during build.

Run browser checks against a separate production process with an isolated `ALEM_DATA_DIR`, because council and registry tests create records. For example, start `HOST=127.0.0.1 PORT=4185 ALEM_DATA_DIR=/tmp/alem-browser-checks npm start`, then:

```sh
export APP_URL=http://127.0.0.1:4185
export ALEM_URL=http://127.0.0.1:4185
npm run test:release
npm run test:fullscreen
npm run test:integration
npm run test:refinement
npm run test:budget
npm run test:map-loading
npm run test:renderer
npm run test:zoom
npm run test:materials
npm run test:school
npm run test:consequences
```

Browser scripts accept `APP_URL` and `RELEASE_OUTPUT` or `CAPTURE_DIR`; the connected journey and assistant suite also accept `ALEM_URL` for compatibility. They require Playwright Chromium or an installed Chromium-family browser via `BROWSER_PATH`. Run performance and cold-network measurements sequentially, without concurrent GPU tests. Reports and full recordings are in ignored `artifacts/`; [the current release](docs/release.md) records the complete both-world flow and verification commands. The budget regression exercises priced choices, scoped-conflict recovery, exact replacement credit, refunds and touch confirmation. The former allocation lab is removed from the player flow; its domain accounting remains compatible with saved drafts. The fullscreen and release suites follow the current first-choice flow; fullscreen also independently audits projected anchors while the camera moves. Renderer, placement, school, budget and runtime gates remain independently runnable. Use `npm run test:provider` only against a server with an authorized key; it fails unless both actual model responses pass validation.

These are local agent walkthroughs and automated checks, not human usability testing or physical-phone measurements. A build is separate from a published release.

## Deployment and rollback

Use this directory as the root of the Railway service. It can be uploaded with the Railway CLI or connected to a new GitHub repository. Follow [the Railway setup](DEPLOY_RAILWAY.md), including the durable volume and release identity for direct uploads.

[Deployment preparation and rollback](docs/integration/DEPLOYMENT.md) covers the durable volume, server-only AI configuration, verification and recovery. The checked-in `railway.json` keeps the existing build (`npm ci --include=dev --ignore-scripts && npm run verify && npm run test:runtime`), start (`npm start`) and `/healthz` gate. Confirm the service's actual settings at release time.

## Repository contents

`src/` and `server/` contain the active game and APIs. `data/prepared/`, the landmark builders and attribution remain the reproducible sources of the city. `scripts/` and `tests/` own the current checks. Generated builds, local records, credentials and browser captures are ignored.

The standalone production source starts from one clean root commit. Retired prototypes, imported style studies, captures, credentials and their Git objects do not enter that repository; no previous Git objects are required. The release contains lossless map batches, shared raw Float32 façade transforms and own-model previews; large monolithic and duplicate raw meshes remain local geometry-audit outputs. See [production cleanup and verification](docs/production-cleanup.md).
