import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {Mesh} from '../src/world/mesh-kit.js';
import {lrtStation,cachedLrtStation} from '../src/world/lrt-model.js';

const shellColors=['#d9e2dd','#cbd7d4','#d2ddd7'];
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalized=a=>a.map(v=>v/Math.hypot(...a));
function insideTriangle(p,[a,b,c]){
 const u=subtract(b,a),v=subtract(c,a),w=subtract(p,a),uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),wu=dot(w,u),wv=dot(w,v),den=uu*vv-uv*uv;
 const x=(vv*wu-uv*wv)/den,y=(uu*wv-uv*wu)/den;
 return x>=-1e-10&&y>=-1e-10&&x+y<=1+1e-10;
}
function geometry(mesh){
 const packed=mesh.pack(),view=new DataView(packed),bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],roof=[];
 for(let at=0;at<view.byteLength;at+=60){
  const color=[15,16,17].map(i=>view.getUint8(at+i)).join(',');
  if(['217,226,221','203,215,212','210,221,215'].includes(color))roof.push(Buffer.from(packed,at,60));
  for(let vertex=0;vertex<3;vertex++)for(let axis=0;axis<3;axis++){
   const value=view.getFloat32(at+vertex*20+axis*4,true);
   bounds[axis]=Math.min(bounds[axis],value);bounds[axis+3]=Math.max(bounds[axis+3],value);
  }
 }
 return {bounds,roofSHA256:createHash('sha256').update(Buffer.concat(roof)).digest('hex')};
}

describe('LRT shell seams',()=>{
 it('keeps the diamond pattern on its owning shell planes, with matching packed normals',()=>{
  class Inspect extends Mesh {
   roof=[];seams=new Map();
   tri(a,b,c,color,normals){
    const at=this.bytes;super.tri(a,b,c,color,normals);
    const packed=[12,13,14].map(i=>this.view.getInt8(at+i));
    if(shellColors.includes(color))this.roof.push({points:[a,b,c],packed});
    if(color==='#9eb6b9'){
     const panel=this.roof.length/2-1;
     if(!this.seams.has(panel))this.seams.set(panel,[]);
     this.seams.get(panel).push({points:[a,b,c],packed,kind:this.view.getUint8(at+18)});
    }
   }
  }
  const m=new Inspect();lrtStation(m,{length:90,width:23,platformHeight:10.1});
  expect(m.roof).toHaveLength(1008);expect(m.seams.size).toBe(252);
  for(const [panel,triangles] of m.seams){
   expect(panel%18%2).toBe(0);expect(triangles).toHaveLength(4);
   const first=m.roof[panel*2],second=m.roof[panel*2+1],[p,q,r]=first.points;
   const normal=normalized(cross(subtract(q,p),subtract(r,p))),across=normalized(cross(normal,normalized(subtract(r,p))));
   expect(second.packed).toEqual(first.packed);
   const points=triangles.flatMap(triangle=>triangle.points),offsets=[];
   for(const triangle of triangles){
    expect(triangle.packed).toEqual(first.packed);expect(triangle.kind).toBe(8);
    expect(Math.hypot(...cross(subtract(triangle.points[1],triangle.points[0]),subtract(triangle.points[2],triangle.points[0])))).toBeGreaterThan(1e-6);
   }
   for(const point of points){
    expect(dot(subtract(point,p),normal)).toBeCloseTo(.025,10);
    const onRoof=point.map((v,i)=>v-normal[i]*.025);
    expect(insideTriangle(onRoof,first.points)||insideTriangle(onRoof,second.points)).toBe(true);
    offsets.push(dot(subtract(onRoof,p),across));
   }
   expect(Math.min(...offsets)).toBeCloseTo(-.07,10);expect(Math.max(...offsets)).toBeCloseTo(.07,10);
   for(const endpoint of [p,r])expect(points.some(point=>Math.hypot(...point.map((v,i)=>v-endpoint[i]-normal[i]*.025))<1e-10)).toBe(true);
  }
 });
 it('preserves the original shell bytes and exact station bounds for runtime and preview callers',()=>{
  const originals=[
   {options:{},bounds:[-49.150001525878906,-15.800000190734863,0,49.154998779296875,14.239999771118164,28.006811141967773],roofSHA256:'707b48c5e8c0f8a9397ed9cd35d0bf94ad64238893852c9c7b730dfadfdd1d1f'},
   {options:{length:90,width:23,platformHeight:10.1},bounds:[-49.150001525878906,-16.299999237060547,0,49.154998779296875,14.739999771118164,27.106822967529297],roofSHA256:'70c5e1129e1923cddb7b185eec2f1e2bdecbf910e58a4509e0a11d81d03a72a0'},
   {options:{length:90,width:25},bounds:[-49.150001525878906,-17.299999237060547,0,49.154998779296875,15.739999771118164,28.0068416595459],roofSHA256:'4230a9ad460b8d8ca020197d95ecb16cea2ebcedfcfe4e5a420ac1980f04a1f7'},
  ];
  for(const original of originals){
   const local=new Mesh();lrtStation(local,original.options);expect(geometry(local)).toEqual({bounds:original.bounds,roofSHA256:original.roofSHA256});
   const cached=new Mesh();cachedLrtStation(cached,original.options);expect(geometry(cached)).toEqual(geometry(local));
  }
 });
});
