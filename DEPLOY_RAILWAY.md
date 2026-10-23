# Deploy on Railway

[Live example](https://hackalem-alem.up.railway.app/) · [General hosting guide](docs/integration/DEPLOYMENT.md)

1. Connect your fork or upload this directory as the service root.
2. Use the included `railway.json`: Railpack, build `npm run verify && npm run test:runtime`, start `npm start`, health check `/healthz`.
3. Mount a persistent volume at `/data` and set `ALEM_DATA_DIR=/data/alem`. Use one replica per data directory.
4. Optionally set `OPENAI_API_KEY` and `OPENAI_MODEL` as server variables. The core game works without them.
5. Enable Wait for CI if using GitHub. After deployment, check `/healthz`, `/version.json`, and a complete five-decision journey in both worlds.

Railway provides `PORT`. Set `HOST=0.0.0.0` if overriding the default listener.
`RAILWAY_GIT_COMMIT_SHA` is optional revision metadata; a source upload does not
require Git history. Dependency installation belongs to Railpack, so the build
command does not run a second `npm ci`.

Back up the data volume before replacing an existing deployment. Preserve it
when rolling back the application. Do not store credentials in the repository.
