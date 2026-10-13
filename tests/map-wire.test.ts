import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {encodeMapWire,decodeMapWire} from '../src/world/map-wire';
import {fetchMapAsset} from '../src/world/map-assets';
describe('lossless complete-city transport',()=>{
 it('roundtrips arbitrary float bits, materials and indices without any precision loss',()=>{
  const original=new Uint8Array(20*150+4*300);for(let i=0;i<original.length;i++)original[i]=(i*31+(i>>8)*17)%256;
  expect(new Uint8Array(decodeMapWire(encodeMapWire(original.buffer,3000),3000))).toEqual(original);
 });
 it('validates the transmitted hash and restores exactly the GPU payload',async()=>{
  const original=new Uint8Array(120);for(let i=0;i<120;i++)original[i]=i;
  const wire=encodeMapWire(original.buffer),sha256=createHash('sha256').update(new Uint8Array(wire)).digest('hex');let requested='';
  const output=await fetchMapAsset({url:'/alem/original.bin',bytes:120,sha256:'original',transport:{file:'wire.bin',bytes:120,sha256,vertexBytes:120}},{attempts:1,fetchImpl:async(url)=>{requested=String(url);return new Response(wire);}});
  expect(requested).toBe('/alem/wire.bin');expect(new Uint8Array(output)).toEqual(original);
  await expect(fetchMapAsset({url:'/alem/original.bin',bytes:120,sha256:'original',transport:{file:'wire.bin',bytes:120,sha256,vertexBytes:120}},{attempts:1,fetchImpl:async()=>new Response(new Uint8Array(120))})).rejects.toThrow('checksum');
 });
 it('rejects invalid stride boundaries',()=>{expect(()=>decodeMapWire(new ArrayBuffer(40),60)).toThrow();expect(()=>encodeMapWire(new ArrayBuffer(41))).toThrow();});
});
