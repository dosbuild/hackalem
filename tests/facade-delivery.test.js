import {describe,it,expect,vi,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {facadeAsset,checkFacadeBytes,facadeGroupsAsset,checkFacadeGroups} from '../scripts/release/facade-assets.mjs';
import {fetchMapAsset,fetchMapJsonAsset} from '../src/world/map-assets.js';
import {createNativePreviewContext} from '../scripts/cityrt/preview-context.mjs';
import {placements,projectPreviewFrame} from '../src/world/project-objects.js';

const bytes=Buffer.from(new Float32Array([.1,.2,.00004,.00008,.3,1,1,1,.2,.3,.00004,.00008,.4,1,1,1]).buffer);
const sha256=createHash('sha256').update(bytes).digest('hex'),asset={url:`alem/facades-${sha256.slice(0,20)}.bin`,bytes:bytes.length,sha256,gzip:true};
afterEach(()=>vi.unstubAllEnvs());
describe('raw façade release delivery',()=>{
 it('requires content identity, complete 32-byte transforms and raw representation',()=>{
  expect(facadeAsset({architecture:{asset}})).toBe(asset);checkFacadeBytes(asset,bytes);
  for(const change of [{url:'alem/architecture-source.json'},{sha256:'a'.repeat(64)},{bytes:63},{gzip:false},{transport:{file:'wire.bin'}}])expect(()=>facadeAsset({architecture:{asset:{...asset,...change}}})).toThrow();
  expect(()=>checkFacadeBytes(asset,bytes.subarray(4))).toThrow();expect(()=>checkFacadeBytes(asset,Buffer.alloc(bytes.length))).toThrow();
 });
 it('keeps connected/development raw and preserves every Float32 byte',async()=>{
  vi.stubEnv('VITE_ALEM_STATIC','false');const fetchImpl=vi.fn(async()=>new Response(bytes));
  expect(new Uint8Array(await fetchMapAsset(asset,{attempts:1,fetchImpl}))).toEqual(new Uint8Array(bytes));
  expect(fetchImpl.mock.calls[0][0]).toBe(asset.url);
 });
 it('fetches intrinsic static gzip and verifies decompressed raw bytes without map-wire decoding',async()=>{
  vi.stubEnv('VITE_ALEM_STATIC','true');const fetchImpl=vi.fn(async()=>new Response(gzipSync(bytes)));
  expect(new Uint8Array(await fetchMapAsset(asset,{attempts:1,fetchImpl}))).toEqual(new Uint8Array(bytes));
  expect(fetchImpl.mock.calls[0][0]).toBe(asset.url+'.gz');
  await expect(fetchMapAsset(asset,{attempts:1,fetchImpl:async()=>new Response(gzipSync(bytes.subarray(4)))})).rejects.toThrow('truncated');
  await expect(fetchMapAsset(asset,{attempts:1,fetchImpl:async()=>new Response(gzipSync(Buffer.alloc(bytes.length)))})).rejects.toThrow('checksum');
 });
 it('accepts static hosting that already decodes a Content-Encoding gzip representation',async()=>{
  vi.stubEnv('VITE_ALEM_STATIC','true');
  expect(new Uint8Array(await fetchMapAsset(asset,{attempts:1,fetchImpl:async()=>new Response(bytes,{headers:{'Content-Encoding':'gzip'}})}))).toEqual(new Uint8Array(bytes));
 });
 it('reads native source building geometry beneath each of the five modern roof previews',async()=>{
  const context=await createNativePreviewContext();
  for(const district of ['esil','almaty','saryarka','baikonur','nura']){
   const site=placements[`M5:${district}`],sources=projectPreviewFrame(site).contextSources,result=await context(sources),geometry=Buffer.from(result.data,'base64');
   expect(result.sources).toEqual([site.roofs[0].source]);expect(geometry.length).toBe(result.bytes);
   expect(createHash('sha256').update(geometry).digest('hex')).toBe(result.sha256);
   const kinds=new Set();for(let at=0;at<geometry.length;at+=20)kinds.add(geometry[at+18]);expect(kinds).toEqual(new Set([2,3]));
  }
  await expect(context(['invented/source'])).rejects.toThrow('Native rooftop context source');
 });
});


describe('external façade group metadata',()=>{
 const groups=[{id:'first',family:'brick',part:'window',columns:3,offset:0,bytes:64,bounds:[-.001234567890123456,.5,2e-12,1.2],count:2},{id:'second',offset:64,bytes:32,count:1}];
 const data=Buffer.from(JSON.stringify(groups)),hash=createHash('sha256').update(data).digest('hex');
 const groupsAsset={url:`alem/facade-groups-${hash.slice(0,20)}.json`,bytes:data.length,sha256:hash,gzip:true};
 const city={architecture:{groups,groupsAsset,groupCount:groups.length}};
 it('requires byte-exact records, ordering, content hash and count at release',()=>{
  expect(facadeGroupsAsset(city)).toBe(groupsAsset);checkFacadeGroups(city,data);
  for(const change of [{url:'alem/groups.json'},{sha256:'a'.repeat(64)},{bytes:0},{gzip:false},{transport:{file:'wire.bin'}}])expect(()=>facadeGroupsAsset({architecture:{...city.architecture,groupsAsset:{...groupsAsset,...change}}})).toThrow();
  expect(()=>checkFacadeGroups({...city,architecture:{...city.architecture,groups:[...groups].reverse()}},data)).toThrow('records');
  expect(()=>checkFacadeGroups({...city,architecture:{...city.architecture,groupCount:1}},data)).toThrow('count');
 });
 it.each([false,true])('parses exact JSON records after verification (static=%s)',async(staticBuild)=>{
  vi.stubEnv('VITE_ALEM_STATIC',String(staticBuild));
  const fetchImpl=vi.fn(async()=>new Response(staticBuild?gzipSync(data):data));
  expect(await fetchMapJsonAsset(groupsAsset,{fetchImpl,attempts:1})).toEqual(groups);
  expect(fetchImpl.mock.calls[0][0]).toBe(groupsAsset.url+(staticBuild?'.gz':''));
  const corrupt=Buffer.from(data);corrupt[10]^=1;
  await expect(fetchMapJsonAsset(groupsAsset,{attempts:1,fetchImpl:async()=>new Response(staticBuild?gzipSync(corrupt):corrupt)})).rejects.toThrow('checksum');
 });
 it('rejects invalid JSON even when its bytes and checksum are valid',async()=>{
  vi.stubEnv('VITE_ALEM_STATIC','false');const invalid=Buffer.from('[bad JSON]');
  await expect(fetchMapJsonAsset({...groupsAsset,bytes:invalid.length,sha256:createHash('sha256').update(invalid).digest('hex')},{attempts:1,fetchImpl:async()=>new Response(invalid)})).rejects.toThrow();
 });
 it('ships a small bootstrap reference and the complete original audit records separately',async()=>{
  const bootstrap=JSON.parse(await readFile('src/world/bootstrap.json','utf8')),city=JSON.parse(await readFile('public/alem/geometry-low.json','utf8'));
  expect(bootstrap.metadata.architecture).not.toHaveProperty('groups');
  const {groups,...runtimeArchitecture}=city.architecture;
  expect(bootstrap.metadata.architecture).toEqual(runtimeArchitecture);
  checkFacadeGroups(city,await readFile('public/'+city.architecture.groupsAsset.url));
  expect(JSON.stringify(runtimeArchitecture).length).toBeLessThan(5000);
 });
});
