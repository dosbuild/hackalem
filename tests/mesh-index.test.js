import {describe,it,expect} from 'vitest';
import {indexTriangleVertices} from '../src/world/mesh-index.js';
import {ARCHITECTURE_PARTS,makeArchitecturePart} from '../src/world/architecture-models.js';

function expand({data,vertexBytes}){
 const vertices=new Uint8Array(data,0,vertexBytes),indices=new Uint32Array(data,vertexBytes),original=new Uint8Array(indices.length*20);
 for(let i=0;i<indices.length;i++)original.set(vertices.subarray(indices[i]*20,indices[i]*20+20),i*20);
 return original;
}
describe('exact native facade indexing',()=>{
 it('reconstructs every original triangle and attribute byte for all facade families and column widths',()=>{
  for(const family of Object.keys(ARCHITECTURE_PARTS))for(const [part,columns]of [['door',1],...Array.from({length:8},(_,i)=>['window',i+1])]){
   const source=makeArchitecturePart(family,part,columns),before=new Uint8Array(source).slice(),indexed=indexTriangleVertices(source);
   expect(indexed,family+'/'+part+'/'+columns).not.toBeNull();
   expect(indexed.data.byteLength).toBeLessThan(source.byteLength);
   expect(Buffer.from(expand(indexed)).equals(Buffer.from(before))).toBe(true);expect(Buffer.from(source).equals(Buffer.from(before))).toBe(true);
  }
 });
 it('does not weld signed zero, NaN payloads, normals, colors or surface kinds',()=>{
  const rows=[[0,0,0,0x00112233,0x00084455],[0x80000000,0,0,0x00112233,0x00084455],[0x7fc00001,0,0,0x00112233,0x00084455],[0,0,0,0x00112244,0x00084455],[0,0,0,0x00112233,0x00084466],[0,0,0,0x00112233,0x00184455]],order=[0,1,2,0,2,3,0,3,4,0,4,5];
  const original=Uint32Array.from(order.flatMap(i=>rows[i])).buffer,indexed=indexTriangleVertices(original);
  expect(indexed.vertexBytes).toBe(rows.length*20);expect(expand(indexed)).toEqual(new Uint8Array(original));
 });
 it('keeps the ordinary allocation when a triangle has no reuse and rejects incomplete triangles',()=>{
  const original=new ArrayBuffer(60),words=new Uint32Array(original);words[5]=1;words[10]=2;
  expect(indexTriangleVertices(original)).toBeNull();expect(indexTriangleVertices(new ArrayBuffer(0))).toBeNull();
  expect(()=>indexTriangleVertices(new ArrayBuffer(20))).toThrow('Invalid native triangle vertices');
 });
});
