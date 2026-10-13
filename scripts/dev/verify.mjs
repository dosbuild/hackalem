/** Exercise the real Vite middleware without a prebuilt or separately running API. */
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';

const directory=await mkdtemp(path.join(tmpdir(),'alem-dev-'));
process.env.ALEM_DATA_DIR=directory;
process.env.OPENAI_API_KEY='';
process.env.CODESPACE_NAME='alem-development-check';
process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN='app.github.dev';
const server=await createServer({server:{host:'127.0.0.1',port:0},clearScreen:false});
try {
  await server.listen();
  const address=server.httpServer.address(),origin=`http://127.0.0.1:${address.port}`;
  const request=(pathname,options={})=>fetch(origin+pathname,{...options,signal:AbortSignal.timeout(15000)});
  assert.match(await (await request('/')).text(),/\/src\/main.tsx/);
  assert.equal((await request('/healthz')).status,200);
  const input={modelVersion:'astana-education-1',plan:[
    {initiativeId:'M4',scope:'district',districtId:'esil'},
    {initiativeId:'M8',scope:'district',districtId:'nura'},
    {initiativeId:'M11',scope:'district',districtId:'almaty'},
    {initiativeId:'M12',scope:'citywide'}, {initiativeId:'M14',scope:'citywide'},
  ]};
  const post=(url,body,headers={})=>request(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify(body)});
  const explanation=await post('/api/explanation',input);
  assert.equal(explanation.status,200);assert.equal((await explanation.json()).mode,'local');
  assert.equal((await post('/api/dashboard/review',{plan:input.plan})).status,200);
  assert.equal((await post('/api/explanation',input,{Origin:'https://other.example'})).status,403);
  assert.equal((await post('/api/explanation',input,{Origin:'https://alem-development-check-5174.app.github.dev'})).status,200);
  assert.equal((await post('/api/explanation',input,{Origin:'https://unrelated-5174.app.github.dev'})).status,403);
  assert.equal((await request('/api/missing')).status,404);
  console.log('PASS development UI and same-origin APIs share one server; foreign origins are rejected');
  const {transport}=JSON.parse(await readFile('public/alem/geometry-low.json','utf8'));
  const mesh=await request('/alem/'+transport.file,{headers:{'Accept-Encoding':'gzip'}});
  assert.equal(mesh.headers.get('content-encoding'),'gzip');
  assert.equal(createHash('sha256').update(Buffer.from(await mesh.arrayBuffer())).digest('hex'),transport.sha256);
  assert.equal((await request('/alem/'+transport.file,{headers:{'Accept-Encoding':'gzip','If-None-Match':mesh.headers.get('etag')}})).status,304);
  console.log('PASS development map transport is compressed, lossless and cacheable');
}finally {
  await server.close();
  await rm(directory,{recursive:true,force:true});
}
