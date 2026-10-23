import {describe,expect,it} from 'vitest';
import {Mesh,rgb} from '../src/world/mesh-kit.js';

// An overridden triangle writer retains the original per-triangle path. This
// independently checks the packed path against its public primitive writer.
class TriangleMesh extends Mesh {tri(...args){super.tri(...args);}}
const exact=(a,b)=>{const left=Buffer.from(a.pack()),right=Buffer.from(b.pack());expect(left.byteLength).toBe(right.byteLength);expect(Buffer.compare(left,right)).toBe(0);};
const tessellations=[[10,2],[10,3],[10,4],[10,5],[10,6],[10,7],[11,6],[12,3],[12,4],[12,6],[12,8],[16,8],[24,12],[24,2],[5,3],[6,3],[6,4],[7,4],[8,3],[8,4],[8,5],[8,6],[9,4],[9,5],[32,24],[64,48]];

describe('exact packed ellipsoids',()=>{
 it('preserves every position, normal, colour, material and padding byte for all used tessellations',()=>{
  for(const [sides,rings] of tessellations)for(const pose of [[0,0,1],[.73,.0001,2.65],[-2.9,-3.2,.0000091]]){
   const build=Type=>{const m=new Type();new Uint8Array(m.buffer).fill(0xa7);m.at([.03,-.02,.0002],pose[0],pose[1]);m.kind=11;m.ellipsoid(1.2,-3.7,.2,pose[2],1.6,2.5,'#abc123',sides,rings);return m;};
   exact(build(Mesh),build(TriangleMesh));
  }
 });
 it('retains first-triangle tint timing and later transform changes',()=>{
  const build=Type=>{const m=new Type();let calls=0;m.at([.01,.02,.03],.37,.0001);m.tint=color=>{calls++;m.at([-.03,.04,.05],-.71,.0003);m.kind=17;return rgb(color);};m.ellipsoid(1,2,3,2.65,1.6,2.5,'#abc123',12,8);return {m,calls};};
  const a=build(Mesh),b=build(TriangleMesh);exact(a.m,b.m);expect(a.calls).toBe(1);expect(b.calls).toBe(1);
 });
 it('keeps full mutable point sharing when a prototype triangle callback replaces the writer',()=>{
  const original=Mesh.prototype.tri,counts=new WeakMap();
  try{
   Mesh.prototype.tri=function(a,b,c,...rest){const count=counts.get(this)||0;counts.set(this,count+1);if(count===0)a[0]+=7;return original.call(this,a,b,c,...rest);};
   const fast=new Mesh(),reference=new TriangleMesh();fast.ellipsoid(0,0,0,1,1,1,'#ffffff',4,2);reference.ellipsoid(0,0,0,1,1,1,'#ffffff',4,2);
   exact(fast,reference);expect(counts.get(fast)).toBe(1);expect(counts.get(reference)).toBe(16);
  }finally{Mesh.prototype.tri=original;}
 });
 it('preserves array-colour tint callbacks and nonnumeric coordinate coercion',()=>{
  const build=Type=>{const m=new Type();let calls=0;m.tint=color=>{calls++;return rgb(color);};m.ellipsoid('1.25','-2',.3,1,2,3,[190.4,-4,999],8,4);return {m,calls};};
  const a=build(Mesh),b=build(TriangleMesh);exact(a.m,b.m);expect(a.calls).toBe(64);expect(b.calls).toBe(64);
 });
 it('retains custom writers installed by the first tint callback and reused buffer padding',()=>{
  const build=Type=>{const m=new Type();new Uint8Array(m.buffer).fill(0x5b);m.ellipsoid(0,0,0,1,1,1,'#ffffff',8,4);m.bytes=0;let changed=false;m.tint=color=>{if(!changed){changed=true;const tri=m.tri;m.tri=function(a,b,c,...rest){a[1]+=.125;return tri.call(this,a,b,c,...rest);};}return rgb(color);};m.ellipsoid(1,2,3,2.1,1.7,.9,'#aabbcc',12,8);return m;};
  exact(build(Mesh),build(TriangleMesh));
 });
});
