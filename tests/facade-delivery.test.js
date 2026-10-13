import {describe,it,expect,vi,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {facadeAsset,checkFacadeBytes} from '../scripts/release/facade-assets.mjs';
import {fetchMapAsset} from '../src/world/map-assets.js';
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
