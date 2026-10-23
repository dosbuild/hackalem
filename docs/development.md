# Run and customize Alem

## Requirements

- Node.js 24 and npm.
- Python 3 for the independent calculation check.
- Playwright Chromium for browser tests and regenerating model previews.

Download the repository or clone it, then run these commands from its root:

```sh
npm ci --include=dev --ignore-scripts
npm run dev
```

Open http://localhost:5174. The development server runs the interface and APIs
together. Prepared map data is included, so no map-provider account, external
checkout, or geographic download is needed. The core game works without API keys.

## Build and host

```sh
npm run build
npm start
```

Open http://localhost:4174. Set `HOST` and `PORT` in the environment for your host.
Building from a downloaded source archive works without Git. A deployment may
optionally supply `RAILWAY_GIT_COMMIT_SHA` or `GITHUB_SHA` to identify its revision.

For a static site with browser-local state and local explanations:

```sh
npm run build:static
node scripts/khanate/static-server.mjs
```

Open http://localhost:4198. Publish `dist-static/` to a static HTTPS host. It works
at a domain root or a subdirectory. Serve `.js` as JavaScript and map `.gz` files
as unchanged binary payloads without `Content-Encoding`: the application handles
their decompression. Use an HTTP server rather than opening `index.html` directly.

## Optional AI and storage

Copy `.env.example` to `.env`, or set environment variables on your host:

| Variable | Purpose | Default |
| --- | --- | --- |
| `OPENAI_API_KEY` | Enables provider-backed Aya dialogue and analysis | Unset; local explanations |
| `OPENAI_MODEL` | Provider model | `gpt-4.1-mini` |
| `PORT` | Production HTTP port | `4174` |
| `HOST` | Network interface | Host-dependent; set explicitly when deploying |
| `ALEM_DATA_DIR` | Council and shared registry storage | `.data` |

Keep credentials on the server. Never put a key in a `VITE_` variable or browser
source. Provider requests are optional; the calculator and five-decision journey
remain usable without them. Static hosting uses local explanations and storage.

For connected deployments, mount persistent storage at `ALEM_DATA_DIR` and run
one application process per data directory. Browser drafts remain on the user's
device. See [hosting and storage](integration/DEPLOYMENT.md), or the optional
[Railway example](../DEPLOY_RAILWAY.md).

## Work with your own agents

Any editor or coding agent can work with this repository. [AGENTS.md](../AGENTS.md)
contains the project boundaries and checks, without requiring a particular tool.
[Agent integration](agents.md) explains the runtime provider boundary and API
contracts. [Architecture](architecture.md) shows where the calculator, interface,
renderer, and server fit together.

## Test changes

Install the browser once:

```sh
npx playwright install chromium
```

Then run:

```sh
python3 scripts/scenario/oracle.py
npm run verify
npm run test:runtime
npm run test:browser
```

The Python oracle independently reads the supplied specification. Its generated
fixture and calculation audit should stay unchanged unless the scenario itself
changes. `verify` checks types, tests, previews, models, geometry, and the production
build. Runtime checks isolate the built package; browser checks play the game and
exercise loading, storage, and recovery.

On a fresh source copy, run `npm run verify` before focused tests: it prepares
the generated map metadata and binary assets. To prepare assets without the full
check, run `npm run prepare:city`, `npm run prepare:alem`, and
`npm run prepare:khanate` in that order.

Use `npm run test:dev` for development-server changes. After building the static
package and starting its server, `npm run test:static` completes both worlds without
API requests. `npm run test:provider` is an optional real-provider check against a
configured server; it makes paid API requests. Other focused checks are listed in
`package.json`. Browser tests use installed Playwright Chromium by default; an
explicit `BROWSER_PATH` selects another Chromium-compatible executable.

Tests write disposable captures and reports to ignored `artifacts/`. Use a separate
application instance and data directory for browser checks that create council or
registry entries. Automated browser checks do not establish live-provider quality
or performance on every device.

## Change models and assets

After changing native model, material, camera, or preview-export source, start
`npm run dev` and regenerate the project images:

```sh
npm run prepare:previews
```

The exporter uses the local development server. Set `APP_URL` if your server uses
another address. The preview manifest checks that images match their model sources;
map checksums validate downloaded geometry.

Keep [source and license notices](../ATTRIBUTION.md) when reusing assets. Generated
runtime geometry, build output, and local records are excluded from Git.
