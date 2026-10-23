import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../../', import.meta.url);
const archive = new URL('data/prepared/geography.tar.gz', root);
const expected = '94f7558127967bd4fb22085e529e3f7ccb46fbd808610e50e7e58a9e6ea077dd';
if (createHash('sha256').update(await readFile(archive)).digest('hex') !== expected)
  throw new Error('Prepared geography checksum mismatch. Restore data/prepared/geography.tar.gz from this release.');
const destination = new URL('public/city/', root);
await mkdir(destination, {recursive:true});
execFileSync('tar', ['-xzf', fileURLToPath(archive), '-C', fileURLToPath(destination)]);
const path = new URL('data/manifest.json', destination);
const manifest = JSON.parse(await readFile(path, 'utf8'));
for (const chunk of manifest.chunks) chunk.url = chunk.url.replace(/^\//, '');
await writeFile(path, JSON.stringify(manifest));
console.log(`Verified and prepared ${manifest.chunks.length} local geographic chunks.`);
