/** Verify the actual build in isolation, without source, dependencies or credentials. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cp, mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {decodeMapWire} from '../../src/world/map-wire.js';
import {checkPreviews,previewPaths} from '../cityrt/check-previews.mjs';
import {facadeAsset,checkFacadeBytes} from './facade-assets.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const staticBuild=process.argv.includes('--static');
const isolated = await mkdtemp(path.join(tmpdir(), 'alem-runtime-'));
let server;
let exited;
let output = '';
const check = (name, value) => { assert(value, name); console.log('PASS', name); };
const delay = ms => new Promise(resolve => { setTimeout(resolve, ms).unref(); });

async function startServer() {
  output='';
  server = spawn(process.execPath, ['.server/server.mjs'], {
    cwd: isolated,
    env: {NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '0'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  exited = new Promise(resolve => {
    server.once('exit', (code, signal) => resolve({code, signal}));
    server.once('error', error => resolve({error}));
  });
  server.stderr.on('data', chunk => { output = (output + chunk).slice(-8000); });
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Runtime did not start: ${output}`)), 10000);
    server.stdout.on('data', chunk => {
      output = (output + chunk).slice(-8000);
      const match = output.match(/listening on 127\.0\.0\.1:(\d+);/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    exited.then(result => { clearTimeout(timer); reject(new Error(`Runtime exited before readiness: ${JSON.stringify(result)} ${output}`)); });
  });
}

try {
  await cp(path.join(root, staticBuild?'dist-static':'dist'), path.join(isolated, 'dist'), {recursive: true});
  if(!staticBuild)await cp(path.join(root, '.server'), path.join(isolated, '.server'), {recursive: true});
  const manifest = JSON.parse(await readFile(path.join(isolated, 'dist/asset-manifest.json'), 'utf8'));
  const allowed = /^(?:index\.html|version\.json|geography\.tar\.gz|assets\/[^/]+\.(?:js|css|woff2)|alem\/(?:(?:map|facades)-[a-f0-9]{20}\.bin|facade-groups-[a-f0-9]{20}\.json|geometry-low\.json|brand\.svg|landmarks\.json|lrt-route\.json)|khanate\/(?:map-[a-f0-9]{20}\.bin|geometry\.json|invitation\.png|ATTRIBUTION\.md)|aya\/guide-(?:atlas|idle)\.webp|project-previews\/(?:manifest\.json|(?:astana|khanate)\/M(?:[1-9]|1[0-4])-(?:esil|almaty|saryarka|baikonur|nura)\.webp)|residents\/geographic-anchors\.json|city\/(?:data\/districts\.geojson|ATTRIBUTION\.md)|sources\/(?:play-art-provenance|PROVENANCE|current-package)\.md|licenses\/(?:(?:react|react-dom|earcut|@fontsource-variable-noto-(?:sans|serif)|shantell-sans-OFL)\.txt|shantell-sans-attribution\.md))$/;
  for (const [name, asset] of Object.entries(manifest)) {
    const intrinsic=staticBuild&&name.endsWith('.gz')&&allowed.test(name.slice(0,-3));
    assert((allowed.test(name)||intrinsic)&&!(staticBuild&&name.endsWith('.bin'))&&!name.endsWith('-source.json'), `Unexpected runtime asset: ${name}`);
    const bytes = await readFile(path.join(isolated, 'dist', name));
    assert.equal(bytes.length, asset.bytes, `Asset size: ${name}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `Asset checksum: ${name}`);
  }
  check('runtime asset allowlist and checksums', Object.keys(manifest).length > 0);
  for (const name of ['index.html', 'version.json', 'alem/geometry-low.json', 'alem/brand.svg', 'aya/guide-atlas.webp', 'aya/guide-idle.webp', 'khanate/geometry.json', 'khanate/invitation.png', 'khanate/ATTRIBUTION.md', 'geography.tar.gz', 'licenses/react.txt', 'licenses/react-dom.txt', 'licenses/earcut.txt', 'licenses/@fontsource-variable-noto-sans.txt', 'licenses/@fontsource-variable-noto-serif.txt', 'licenses/shantell-sans-OFL.txt', 'licenses/shantell-sans-attribution.md', 'project-previews/manifest.json', 'sources/play-art-provenance.md', 'sources/PROVENANCE.md', 'sources/current-package.md', ...previewPaths.map(name=>'project-previews/'+name)]) {
    assert(manifest[name], `Required runtime asset: ${name}`);
  }
  check('required city, resident companion, attribution and license assets', Boolean(manifest['city/ATTRIBUTION.md']));
  const cityAttribution=await readFile(path.join(isolated,'dist/city/ATTRIBUTION.md'),'utf8');
  const attributionLinks=[...cityAttribution.matchAll(/\]\(([^)]+)\)/g)].map(match=>match[1]);
  for(const [relative,published]of [['../geography.tar.gz','geography.tar.gz'],['../alem/lrt-route.json','alem/lrt-route.json']]){
    assert(attributionLinks.includes(relative),`Published attribution links to ${relative}`);
    const resolved=new URL(relative,'https://alem.invalid/city/ATTRIBUTION.md').pathname.slice(1);
    assert.equal(resolved,published,'Attribution link resolves from its published location');
    assert(manifest[resolved],`Attributed resource is verified by the runtime manifest: ${resolved}`);
  }
  for(const name of ['play-art-provenance','PROVENANCE','current-package'])assert(attributionLinks.includes(`../sources/${name}.md`),`Published attribution links to packaged ${name}`);
  for(const link of attributionLinks)assert(!/^(?:\.?\.?\/)*(?:docs|data|public)\//.test(link),`No repository-only attribution path in runtime: ${link}`);
  for(const name of ['city/ATTRIBUTION.md','khanate/ATTRIBUTION.md','sources/play-art-provenance.md','sources/PROVENANCE.md','sources/current-package.md']){
    const content=await readFile(path.join(isolated,'dist',name),'utf8');
    for(const [,link]of content.matchAll(/\]\(([^)]+)\)/g)){
      if(/^(?:https?:|mailto:|#)/.test(link))continue;
      const resolved=new URL(link,`https://alem.invalid/${name}`).pathname.slice(1);
      assert(manifest[resolved],`Packaged attribution link: ${name} -> ${link}`);
    }
  }
  check('attribution links resolve within the standalone package',true);
  const version=JSON.parse(await readFile(path.join(isolated,'dist/version.json'),'utf8'));
  const packageVersion=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
  check('standalone release identity',version.application==='alem'&&version.version===packageVersion&&version.model==='astana-education-1'&&version.delivery===(staticBuild?'static':'connected')&&JSON.stringify(version.worlds)==='["astana","khanate"]');
  assert(version.commit===undefined||/^[a-f0-9]{40}$/.test(version.commit),'Optional deployment revision is valid');
  assert(!('dirty' in version)&&!('builtAt' in version),'No developer checkout metadata');
  await checkPreviews({root,directory:path.join(isolated,'dist/project-previews')});
  check('all 140 own-model previews have current source provenance and exact published bytes',true);
  for(const [published,source]of [['licenses/shantell-sans-OFL.txt','src/design/assets/SHANTELL-OFL.txt'],['licenses/shantell-sans-attribution.md','src/design/assets/SHANTELL-ATTRIBUTION.md']])assert.deepEqual(await readFile(path.join(isolated,'dist',published)),await readFile(path.join(root,source)),`Published font license/attribution: ${published}`);
  check('official Shantell license and attribution are preserved',true);
  const shantellHash=createHash('sha256').update(await readFile(path.join(root,'src/design/assets/shantell-sans-ui-variable.woff2'))).digest('hex');
  const shantellAsset=Object.keys(manifest).find(name=>/^assets\/.+\.woff2$/.test(name)&&manifest[name].sha256===shantellHash);
  check('the optimized licensed local Shantell UI font is in the published build',Boolean(shantellAsset));
  const overview=JSON.parse(await readFile(path.join(isolated,'dist/alem/geometry-low.json'),'utf8'));
  const readBinary=async(name,descriptor)=>{
    const published=staticBuild?name+'.gz':name;
    assert(manifest[published],`Required runtime binary: ${published}`);
    const bytes=await readFile(path.join(isolated,'dist',published)),raw=staticBuild?gunzipSync(bytes):bytes;
    assert.equal(raw.length,descriptor.bytes,'Runtime binary raw byte length');
    assert.equal(createHash('sha256').update(raw).digest('hex'),descriptor.sha256,'Runtime binary raw checksum');
    if(!staticBuild){assert.equal(manifest[name].sha256,descriptor.sha256,'Descriptor checksum in release');assert.equal(manifest[name].bytes,descriptor.bytes,'Descriptor bytes in release');}
    return raw;
  };
  const mapFiles=new Set();
  const facade=facadeAsset(overview);mapFiles.add(facade.url);
  checkFacadeBytes(facade,await readBinary(facade.url,facade));
  check('source-owned façade placements are published as exact raw Float32 transforms',true);
  const groups=overview.architecture.groupsAsset;
  assert(groups,'Required facade group descriptor');
  const groupBytes=await readBinary(groups.url,groups);
  assert.equal(groupBytes.toString('utf8'),JSON.stringify(overview.architecture.groups),'All facade group records retain exact JSON representation');
  check('external facade metadata preserves every group and numeric value',JSON.parse(groupBytes).length===overview.architecture.groupCount);
  for(const asset of [overview,...overview.tiles]){
    const name=asset.url.replace(/[^/]+$/,asset.transport.file);mapFiles.add(name);
    const wire=await readBinary(name,asset.transport);
    const decoded=Buffer.from(decodeMapWire(wire.buffer.slice(wire.byteOffset,wire.byteOffset+wire.byteLength),asset.transport.vertexBytes));
    assert.equal(decoded.length,asset.bytes,'Decoded size');
    assert.equal(createHash('sha256').update(decoded).digest('hex'),asset.sha256,'Lossless geometry checksum');
  }
  check('complete resident asset manifest and lossless reconstruction',overview.resident&&overview.residentBytes===[overview,...overview.tiles].reduce((n,a)=>n+a.bytes,0));
  const historical=JSON.parse(await readFile(path.join(isolated,'dist/khanate/geometry.json'),'utf8'));
  const historicalPath='khanate/'+historical.transport.file;mapFiles.add(historicalPath);
  const historicalWire=await readBinary(historicalPath,historical.transport);
  const historicalDecoded=Buffer.from(decodeMapWire(historicalWire.buffer.slice(historicalWire.byteOffset,historicalWire.byteOffset+historicalWire.byteLength),historical.transport.vertexBytes));
  assert.equal(createHash('sha256').update(historicalDecoded).digest('hex'),historical.sha256);
  check('historical map belongs to the allowlist and decodes losslessly',true);
  check('no unused or duplicate city meshes ship',Object.keys(manifest).filter(name=>/\.bin(?:\.gz)?$/.test(name)).every(name=>mapFiles.has(staticBuild?name.slice(0,-3):name)));

  if(staticBuild){check('static map and raw façade files are intrinsic gzip with exact decompressed identity',true);}else{
  let origin = await startServer();
  const request = (pathname, options = {}) => fetch(origin + pathname, {...options, signal: AbortSignal.timeout(10000)});
  const health = await request('/healthz');
  check('isolated production server and healthcheck', health.status === 200 && (await health.json()).status === 'ok');
  assert.deepEqual(await (await request('/version.json')).json(),version,'Served identity matches the standalone package');
  const html = await request('/');
  check('application entry and browser security policy', html.status === 200 && (await html.text()).includes('id="root"') && html.headers.get('content-security-policy')?.includes("connect-src 'self'"));
  for(const name of ['project-previews/astana/M7-nura.webp','project-previews/khanate/M7-esil.webp',shantellAsset]){
    const asset=await request('/'+name);
    assert.equal(asset.status,200,`Published preview/font HTTP path: ${name}`);
    assert.equal(createHash('sha256').update(Buffer.from(await asset.arrayBuffer())).digest('hex'),manifest[name].sha256,`Served preview/font belongs to the tested build: ${name}`);
  }
  check('both school previews and the local handwritten font are served from the actual release',true);
  for (const pathname of ['/.env', '/package.json', '/src/main.tsx', '/server/main.ts', '/docs/scenario/source/goal-objective.md', '/archive/', '/landmarks/manifest.json', '/landmarks/baiterek-low.bin', '/alem/city.bin', '/alem/city-low.bin', '/alem/geometry.json', '/asset-manifest.json', '/missing.js']) {
    assert.equal((await request(pathname)).status, 404, `Private or missing path: ${pathname}`);
  }
  check('private files and unknown paths return 404', true);
  const meshPath = '/alem/'+overview.transport.file;
  const scriptPath = '/' + Object.keys(manifest).find(name => /^assets\/.+\.js$/.test(name));
  for (const [pathname, encoding] of [[meshPath, 'gzip'], ['/'+facade.url, 'gzip'], [scriptPath, 'br']]) {
    const mesh = await request(pathname, {headers: {'Accept-Encoding': encoding}});
    assert.equal(mesh.status, 200);
    assert.equal(mesh.headers.get('content-encoding'), encoding);
    const bytes = Buffer.from(await mesh.arrayBuffer()); // fetch decompresses the served representation.
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest[pathname.slice(1)].sha256);
    assert.equal((await request(pathname, {headers: {'Accept-Encoding': encoding, 'If-None-Match': mesh.headers.get('etag')}})).status, 304);
  }
  check('Brotli, gzip, mesh integrity and conditional requests', true);
  const head = await request(meshPath, {method: 'HEAD', headers: {'Accept-Encoding': 'identity'}});
  check('HEAD serves asset metadata without a body', head.status === 200 && Number(head.headers.get('content-length')) === manifest[meshPath.slice(1)].bytes && (await head.text()) === '');
  const cachedMap=await request(meshPath,{method:'HEAD',headers:{'Accept-Encoding':'br'}});
  check('content-addressed city is immutable and compressed',cachedMap.headers.get('cache-control')==='public, max-age=31536000, immutable'&&cachedMap.headers.get('content-encoding')==='br');
  const cachedFacade=await request('/'+facade.url,{method:'HEAD',headers:{'Accept-Encoding':'gzip'}});
  check('content-addressed façade transforms are immutable and compressed',cachedFacade.headers.get('cache-control')==='public, max-age=31536000, immutable'&&cachedFacade.headers.get('content-encoding')==='gzip');
  for(const name of [historicalPath,groups.url]){
    const response=await request('/'+name,{method:'HEAD'});
    check('immutable world asset: '+name,response.status===200&&response.headers.get('cache-control')==='public, max-age=31536000, immutable');
  }
  const input = {
    modelVersion: 'astana-education-1',
    plan: [
      {initiativeId: 'M4', scope: 'district', districtId: 'esil'},
      {initiativeId: 'M8', scope: 'district', districtId: 'nura'},
      {initiativeId: 'M11', scope: 'district', districtId: 'almaty'},
      {initiativeId: 'M12', scope: 'citywide'},
      {initiativeId: 'M14', scope: 'citywide'},
    ],
  };
  const post = (body, headers = {}) => request('/api/explanation', {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)});
  const explanation = await post(input);
  const result = await explanation.json();
  check('real explanation API works without a provider key', explanation.status === 200 && result.mode === 'local' && result.reason === 'unavailable' && typeof result.resultId === 'string');
  assert.equal((await post({...input, plan: []})).status, 400);
  assert.equal((await post(input, {Origin: 'https://other.example'})).status, 403);
  check('invalid plans and cross-origin requests are rejected', true);
  const dashboardPost=(route,body)=>request('/api/dashboard/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const council=await(await dashboardPost('council',{plan:input.plan})).json();
  const registered=await(await dashboardPost('registry',{plan:input.plan,team:'Isolated runtime check',confirmed:true,sessionId:council.id})).json();
  check('isolated built dashboard records a council and explicit registry submission',!!council.id&&!!registered.id);
  server.kill('SIGTERM');
  const stopped = await Promise.race([exited, delay(5000).then(() => null)]);
  check('production process handles SIGTERM', stopped?.code === 0);
  origin=await startServer();
  const restored=await(await request('/api/dashboard/council/'+council.id)).json();
  const registry=await(await request('/api/dashboard/registry')).json();
  check('real process restart preserves full council and registry records',JSON.stringify(restored.events)===JSON.stringify(council.events)&&registry.entries.some(e=>e.id===registered.id));
  const duplicate=await(await dashboardPost('registry',{plan:input.plan,team:'isolated runtime check',confirmed:true,sessionId:council.id})).json();
  check('repeated explicit submission after restart is idempotent',duplicate.id===registered.id&&(await(await request('/api/dashboard/registry')).json()).entries.length===1);
  server.kill('SIGTERM');await exited;
  }
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill('SIGKILL');
    await exited;
  }
  await rm(isolated, {recursive: true, force: true});
}
