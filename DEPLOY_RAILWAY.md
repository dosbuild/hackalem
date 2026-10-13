# Railway deployment

Repository: [dosbuild/hackalem](https://github.com/dosbuild/hackalem), branch `main`, root `/`.

This is a standalone source package. Node 24, the locked dependencies, both worlds,
original model previews and the attributed geography fixture are included. No old
repository or sibling checkout is required.

## Deploy

1. Create or select the intended Railway service. Upload this directory with the
   Railway CLI, or connect a new GitHub repository whose root contains this file.
2. Use `railway.json`: Railpack, build
   `npm run verify && npm run test:runtime`,
   start `npm start`, health check `/healthz`.
3. Mount a durable volume at `/data`; set `ALEM_DATA_DIR=/data/alem`. Use one replica.
   The server binds to `0.0.0.0` and Railway supplies `PORT`.
4. For a CLI upload without a GitHub integration, set `RAILWAY_GIT_COMMIT_SHA` to
   the output of `git rev-parse HEAD` from this clean repository. The runtime gate
   requires a real release identity. Run `railway link` for the intended project,
   then `railway up` from this directory.
5. Optionally set `OPENAI_API_KEY` as a server variable. The core game works without
   it. Never add credentials to Git or use a `VITE_` variable for secrets.

If connecting GitHub, enable Wait for CI. The included workflow runs the browser
journeys in addition to build and runtime checks. After deployment, verify
`/healthz`, `/version.json`, both maps and a full five-decision game. This package
has not been deployed by the cleanup operation.

For an existing service, preserve its volume and back up `dashboard.json` before
replacing the running release. [Storage and rollback](docs/integration/DEPLOYMENT.md).

The CLI respects `.gitignore` and `.railwayignore` and excludes `.git` and
`node_modules`: [Railway CLI file handling](https://docs.railway.com/cli/up#file-handling).
