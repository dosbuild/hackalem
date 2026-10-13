import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {placements,projectMesh} from '../src/world/project-objects.js';
import {routeAt} from '../src/world/placement-geometry.js';
import {astanaPrograms} from '../src/world/astana-programs.js';

const sites=Object.values(placements).filter(site=>site.id==='M11');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// Preparation uses shared material colors. Its physical footprint, normals and
// surface kinds must stay exact while the intentional palette can change.
const geometryHash=bytes=>{const packed=Buffer.from(bytes);for(let at=0;at<packed.length;at+=20)packed.fill(0,at+15,at+18);return hash(packed);};
const options={preview:true,zoom:288,seconds:4,schoolTime:30};
const preserved={
 esil:['c612ae72c62b6ec2100a3d90c694e8b50ce8c75c142b16b18317c04155a935ad','4d23f54cbff4addbaa891f40cedebf6d78827cf5745ba713753827dd727e4559'],
 almaty:['9c7b0f3f785883d2125789062b1142075d48895d676a95c8f3f39195d5ba9631','f785aa5b77bf206f59c693d5df2a8a248e6369a3e60c92d0e6052663e2175e74'],
 saryarka:['ce9780cc5a0a15f7438b4aafe73cd25da43cb2058d04264c0e6d7cbf6f700b43','88e72be5c50e8eacde68531cb3bc5a92980eaf2957199eba55c2a483672d2c67'],
 baikonur:['7a9dcb176cecc4aef976a8cee57ceddf4847c90b138c16341609e7881fe1dafe','2f625485d4764f9510ab3431363fe54473c99d7e99ee9be4512772ebbf9cc8c9'],
 nura:['8abb9e023ebdde213cb5c68f698eae33c868cbd3a0e5467d0137332302843567','06dd2392e9f9fde57cb9527e3c737166d26363125a000ae91a5505e9c29d1705'],
};
function mesh(site,extra={}){return Buffer.from(projectMesh([{...site,proposal:false,state:'planned',progress:1}],false,{...options,...extra}));}
function vertices(bytes){
 const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),result=[];
 for(let offset=0;offset<bytes.length;offset+=20)result.push({point:[0,4,8].map(i=>data.getFloat32(offset+i,true)),color:bytes.subarray(offset+15,offset+18).join(','),bytes:bytes.subarray(offset,offset+20)});
 return result;
}
function crossingRows(site,paint){
 const rows=[.28,.5,.72].map(t=>({q:routeAt(site.route,t),points:[]}));
 for(const vertex of paint){
  const row=rows.reduce((nearest,row)=>Math.hypot(vertex.point[0]-row.q.point[0],vertex.point[1]-row.q.point[1])<Math.hypot(vertex.point[0]-nearest.q.point[0],vertex.point[1]-nearest.q.point[1])?row:nearest);
  const [x,y]=vertex.point.map((value,i)=>value-row.q.point[i]),c=Math.cos(row.q.angle),s=Math.sin(row.q.angle);
  row.points.push([x*c+y*s,-x*s+y*c]);
 }
 return rows;
}
describe('crossings on the existing modern street',()=>{
 it('paints all three crossings across the actual roadway, without an added route surface',()=>{
  const before=JSON.stringify(placements);
  for(const site of sites){
   const all=vertices(mesh(site)),paint=all.filter(vertex=>vertex.color==='238,229,197');
   expect(all.some(vertex=>vertex.color==='154,167,159'),site.key+' extra roadway').toBe(false);
   expect(paint.length,site.key).toBe(24*30);
   for(const row of crossingRows(site,paint)){
    expect(row.points.length,site.key+' crossing at '+row.q.point).toBe(8*30);
    const transverse=row.points.map(point=>point[1]),longitudinal=row.points.map(point=>point[0]);
    expect(Math.min(...transverse)).toBeCloseTo(-.00017,7);
    expect(Math.max(...transverse)).toBeCloseTo(.00017,7);
    expect(Math.min(...longitudinal)).toBeCloseTo(-.0004975,7);
    expect(Math.max(...longitudinal)).toBeCloseTo(.0004975,7);
   }
  }
  expect(JSON.stringify(placements)).toBe(before);
 });
 it('retains initial preparation geometry and replaces roadside furniture with individually vetted signs',()=>{
  for(const site of sites){
   const decorations=vertices(mesh({...site,program:astanaPrograms[site.key]})).filter(vertex=>vertex.color!=='238,229,197');
   const signs=astanaPrograms[site.key].sites.flatMap(s=>s.signs);
   expect(signs.length,site.key).toBeGreaterThanOrEqual(6);
   for(const sign of signs)expect(decorations.some(vertex=>Math.hypot(vertex.point[0]-sign.point[0],vertex.point[1]-sign.point[1])<.00011&&vertex.point[2]>sign.point[2]+.0002),site.key+' vetted sign is visible').toBe(true);
   const prepared=mesh(site,{active:{id:site.id,key:site.key,progress:0}});
   expect(prepared.length,site.key).toBe(7560);
   expect(geometryHash(prepared),site.key).toBe(preserved[site.district][1]);
  }
 });
 it('keeps growing paint on the same street and completes the original build sequence',()=>{
  for(const site of sites){
   for(const progress of [.04,.35,.55,.8,.97,1]){
    const all=vertices(mesh(site,{active:{id:site.id,key:site.key,progress}}));
    expect(all.some(vertex=>vertex.color==='154,167,159'),site.key+' progress '+progress).toBe(false);
    const paint=all.filter(vertex=>vertex.color==='238,229,197');
    for(const row of crossingRows(site,paint))for(const point of row.points)expect(Math.abs(point[1])).toBeLessThan(.00017005);
   }
   expect(mesh(site,{active:{id:site.id,key:site.key,progress:1}})).toEqual(mesh(site));
   const proposal=projectMesh([{...site,proposal:true,state:'preview'}],false,options),completed=mesh(site);
   const points=bytes=>vertices(Buffer.from(bytes)).map(vertex=>vertex.point);
   expect(points(proposal),site.key+' proposal silhouette').toEqual(points(completed));
  }
 });
});
