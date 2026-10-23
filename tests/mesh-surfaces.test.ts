import {describe,expect,it} from 'vitest';
// @ts-expect-error The shared renderer's JavaScript mesh vocabulary is tested directly.
import {Mesh} from '../src/world/mesh-kit.js';
describe('surface geometry',()=>{
 it('uses the ellipsoid gradient for stretched smooth-surface normals',()=>{
  const m=new Mesh();m.ellipsoid(0,0,0,5,2,1,'#ffffff',16,12);const view=new DataView(m.pack());
  for(let i=0;i<view.byteLength;i+=20){const p=[0,1,2].map(k=>view.getFloat32(i+k*4,true)),n=[0,1,2].map(k=>view.getInt8(i+12+k)/127),g=[p[0]!/25,p[1]!/4,p[2]!],length=Math.hypot(...g),dot=g.reduce((sum,x,k)=>sum+x*n[k]!,0)/length;expect(dot).toBeGreaterThan(.987);}
 });
 it('joins a bent painted strip with shared edges and no missing corner wedge',()=>{
  const m=new Mesh();m.ribbon([[0,0],[1,0],[1,1]],.2,'#ffffff');const view=new DataView(m.pack()),points=new Set<string>();let area=0;
  for(let i=0;i<view.byteLength;i+=60){const p=[0,1,2].map(k=>[view.getFloat32(i+k*20,true),view.getFloat32(i+k*20+4,true)] as [number,number]);for(const q of p)points.add(q.map(v=>v.toFixed(4)).join(','));const [a,b,c]=p as [[number,number],[number,number],[number,number]];area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;}
  expect(points.size).toBe(6);expect(area).toBeCloseTo(.4,6);
 });
});
