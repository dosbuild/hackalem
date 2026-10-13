import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {projectMesh,placements} from '../src/world/khanate/projects.js';
import {OBJECT_UNIT,meshBounds} from '../src/world/khanate/scale.js';

const sites=Object.values(placements).filter(site=>site.id==='M5'),centres=[[-15,0],[0,14],[15,0]],mouth=[72,57,45];
// Construction ownership protects positions, normals and surface kinds. RGB is
// intentionally excluded so the shared material palette can be art directed.
function geometryHash(buffer){const packed=Buffer.from(buffer);for(let at=0;at<packed.length;at+=20)packed.fill(0,at+15,at+18);return createHash('sha256').update(packed).digest('hex');}
function triangles(buffer,site){
 const data=new DataView(buffer),c=Math.cos(site.orientation),s=Math.sin(site.orientation),out=[];
 for(let offset=0;offset<data.byteLength;offset+=60){
  const points=[0,20,40].map(at=>{const x=(data.getFloat32(offset+at,true)-site.origin[0])/OBJECT_UNIT,y=(data.getFloat32(offset+at+4,true)-site.origin[1])/OBJECT_UNIT;return [x*c+y*s,-x*s+y*c,(data.getFloat32(offset+at+8,true)-site.origin[2])/OBJECT_UNIT];});
  out.push({points,color:[15,16,17].map(at=>data.getUint8(offset+at))});
 }
 return out;
}
function frontHit(mesh,x,z,start){
 const hits=[];
 for(const triangle of mesh){
  const [a,b,c]=triangle.points,u=[b[0]-a[0],b[2]-a[2]],v=[c[0]-a[0],c[2]-a[2]],q=[x-a[0],z-a[2]],det=u[0]*v[1]-u[1]*v[0];
  if(Math.abs(det)<1e-9)continue;
  const t=(q[0]*v[1]-q[1]*v[0])/det,w=(u[0]*q[1]-u[1]*q[0])/det;
  if(t<-.00001||w<-.00001||t+w>1.00001)continue;
  const y=a[1]+t*(b[1]-a[1])+w*(c[1]-a[1]);if(y>start)hits.push({y,color:triangle.color});
 }
 return hits.sort((a,b)=>a.y-b.y)[0];
}
describe('historical M5 cooking hearths',()=>{
 it('preserves the exact packed bounds of all five canonical places in completed and proposal views',()=>{
  for(const site of sites)for(const proposal of [false,true]){
   const before=structuredClone(site),bounds=meshBounds(projectMesh([{...site,proposal}],false,{seconds:0}));
   expect(bounds.min,site.key).toEqual(site.view.min);expect(bounds.max,site.key).toEqual(site.view.max);expect(site).toEqual(before);
  }
 });
 it('opens each original hearth centre through the shell to a recessed wall, with clay below and above',()=>{
  for(const site of sites){
   const mesh=triangles(projectMesh([{...site,proposal:false}]),site);
   for(const [x,y] of centres){
    const hit=frontHit(mesh,x,1,y-4);expect(hit.color,site.key+' recessed mouth').toEqual(mouth);expect(hit.y-y).toBeCloseTo(-.9,3);
    expect(frontHit(mesh,x,.1,y-4).color).toEqual([185,140,108]);expect(frontHit(mesh,x,1.9,y-4).color).toEqual([185,140,108]);
   }
  }
 });
 it('keeps the three original construction delays and adds the work surface only after its late stage',()=>{
  const site=sites[0],count=p=>triangles(projectMesh([{...site,proposal:false}],false,{active:{id:'M5',progress:p}}),site);
  for(const [progress,expected] of [[.09,0],[.12,1],[.25,2],[.4,3]]){
   const mesh=count(progress),centresWithMouth=centres.filter(([x,y])=>mesh.some(t=>t.color.join(',')===mouth.join(',')&&t.points.every(q=>Math.abs(q[0]-x)<2&&Math.abs(q[1]-y+.9)<.002&&q[2]<2.4)));
   expect(centresWithMouth).toHaveLength(expected);
  }
  expect(count(.71).some(t=>t.color.join(',')==='212,187,136')).toBe(false);
  const bread=count(1).filter(t=>t.color.join(',')==='212,187,136');expect(bread.length).toBeGreaterThan(0);
  for(const t of bread)for(const p of t.points){expect(p[0]).toBeGreaterThan(-4);expect(p[0]).toBeLessThan(4);expect(p[1]).toBeGreaterThan(-19);expect(p[1]).toBeLessThan(-15);}
  expect(Buffer.from(projectMesh([{...site,proposal:false}],false,{active:{id:'M5',progress:1}}))).toEqual(Buffer.from(projectMesh([{...site,proposal:false}])));
 });
 it('leaves the shared M13 hearth geometry unchanged through construction and completion',()=>{
  const site=placements['M13:esil'],golden=[
   [.05,'8197905f125a9d9bc6648c75c40633563fa29ad9e8f7f745b1e4a4f896610b45'],
   [.2,'5ac441f4a89ee989876fbd81168515fcfb171879eff5952b79f1dcc6a6936c53'],
   [.5,'59c3d1a826a94bdf6a11ac9740c951b01933dcbcad59f188bd1fce5143bd0845'],
   [.8,'d1881d34e0d618b360ed9c6833093d924f81b239451167ba06d1cecfb49b3a3c'],
   [1,'625f7687fc829dd19ee224e39503f3a4187bffb302713c76b7c3cef2c6a56b29']
  ];
  for(const [progress,hash] of golden){const packed=projectMesh([{...site,proposal:false,state:'outcome'}],true,progress===1?{seconds:0}:{seconds:0,active:{id:'M13',progress}});expect(geometryHash(packed)).toBe(hash);}
 });
});
