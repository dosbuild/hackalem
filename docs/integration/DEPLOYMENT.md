# Connected Alem deployment and rollback

Configure the intended service using the root `DEPLOY_RAILWAY.md`. A GitHub-connected service can deploy `main` after successful CI. The release record in `docs/release.md` distinguishes source validation from a verified public deployment. Local checks use the production server at `http://127.0.0.1:4174`.

## Release prerequisites

1. Review the source changes against the preserved baseline and run `npm run verify`, `npm run test:runtime`, and the browser gates in the root README. Preserve their reports and the source fingerprint. Do not present a dirty build's commit SHA alone as its exact source identity.
2. Configure a [persistent Railway volume](https://docs.railway.com/volumes) and set `ALEM_DATA_DIR` to its writable mount path, for example `/data/alem`. Council protocols and registry entries are in `dashboard.json`. Use one writer/process/replica. Ephemeral `.data` storage is suitable only for a local preview.
3. To enable optional live AI, configure `OPENAI_API_KEY` and, optionally, `OPENAI_MODEL` as server-only variables. Verify an actual free-text Aya response and dashboard analysis before claiming live AI. Deterministic continuation must still work with the provider unavailable. Do not put credentials in the repository, screenshots, client variables or archives.
4. Retain Node 24, the build/start commands from `railway.json`, `/healthz`, and the chosen PR/CI merge process. The HTTP server defaults to `0.0.0.0`; Railway supplies `PORT`. Do not expose `.data`, `.env`, source files or the internal asset manifest.
5. Before release, record the *currently successful deployed* commit/build and deployment identifier. Old SHAs in the historical release notes are evidence of earlier deployments, not proof of today's rollback target. Back up the durable `dashboard.json` before changing the running version.

## Static delivery

If Railway CDN is enabled, preserve the origin cache headers. Hashed city buffers and application bundles use one-year immutable caching; APIs use `no-store`, and HTML/version responses revalidate. Keep those boundaries when adjusting the edge configuration. Verify a repeated immutable asset returns `X-Cache: HIT` and the health/dashboard APIs remain uncached. [Railway CDN and cache headers](https://docs.railway.com/guides/cache-headers-cdn).

The public smoke observes requests passively: Playwright routing disables the normal HTTP cache and would turn every return visit into an artificial cold download. Council writes are opt-in; isolated integration/runtime tests own durable-write and process-restart verification.

## After an authorized release

Check `/healthz` and `/version.json` against the approved source. Run a fresh connected journey and API/storage restart check against the deployed service. Use an explicitly identified test team for registry verification; submission creates a durable record. Confirm the entire map, the isolated demo, saved draft restoration and a real provider response. Measure public first-visit timing independently; local 25 Mbps/80 ms emulation does not prove internet performance.

The public registry contains visitor-entered team names and the supplied scenario plan, not eOtinish submissions. The server rejects cross-origin mutations, malformed/oversized inputs and invalid plans. File storage uses flushed temporary writes followed by atomic replacement, and rejects corrupt snapshots instead of silently creating an empty registry. Backups and retention belong to the deployment operator.

## Rollback

Redeploy the previously recorded successful deployment, or revert the approved integration commit(s) through the repository's normal review process. Do not force-push. Keep the current durable file as a backup before rollback. The database version is `1`; a prior application without dashboard support will not use these records, so retain the volume for a later forward deployment. Never erase it to make an old build healthy.

For local source recovery, check out the recorded release commit in a separate directory and run the locked install and verification commands. Do not overwrite an existing workspace or restore credentials, browser drafts or runtime records from source archives.

After rollback, verify health, version, map readiness and a complete manual plan. Report rollback and provider/storage status separately from source or CI success.
