# Hosting and persistence

The connected application runs on a Node 24 host. Build with `npm run build`,
start with `npm start`, and configure `HOST` and `PORT` for the host's listener.
Use `/healthz` for health checks. The repository also includes an optional Railway
configuration; see [Railway setup](../../DEPLOY_RAILWAY.md).

## Persistent records

Council protocols and registry entries are stored in `dashboard.json` beneath
`ALEM_DATA_DIR`, defaulting to `.data`. Mount a writable persistent directory when
these records must survive deployment. The file store uses atomic replacement
and supports one application process; use a different storage implementation
before running multiple writers. Keep backups and define retention for visitor
entries. Do not publish the data directory or include it in source distributions.

On Railway, use a [persistent volume](https://docs.railway.com/volumes) and set
`ALEM_DATA_DIR` to its mount path, such as `/data/alem`. Keep one replica.

## Optional AI

Configure provider credentials only on the server. Core play and local explanations
work without them. A provider failure must leave the game usable. Confirm actual
provider responses when enabling live AI; a successful build does not test a
provider account. Never place credentials in browser environment variables.

## Serving and updates

Preserve the application's cache headers: content-addressed assets may be cached,
HTML must revalidate, and APIs must remain uncached. Keep source, credentials,
private records and internal manifests outside the public static directory.
Terminate HTTPS at the host or reverse proxy.

Before updating, run the documented checks and back up persistent records. Retain
a working release for rollback, including its compatible data format. After an
update or rollback, check health, map loading, a complete five-decision game and
any enabled provider/storage features. Do not erase records to make an older
application version start.

For hosting without a Node server, `npm run build:static` creates `dist-static/`.
Serve it over HTTP(S), with correct JavaScript MIME types and unchanged compressed
map payloads. Static mode uses local explanations and browser-local records;
shared publication and live AI require the connected server. See
[development and verification](../development.md) for commands.
