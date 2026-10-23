import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {Mesh} from '../src/world/mesh-kit.js';
import {householdHeating,heatingTerminal,roofPlant} from '../src/world/project-detail.js';
import {placements,projectMesh,projectPreviewFrame,projectFocusBounds} from '../src/world/project-objects.js';
import {meshBounds} from '../src/world/khanate/scale.js';

const sites=Object.values(placements).filter(site=>site.id==='M5'),options={preview:true,zoom:288,seconds:0};
function points(buffer){const data=new DataView(buffer),out=[];for(let offset=0;offset<data.byteLength;offset+=20)out.push([0,4,8].map(i=>data.getFloat32(offset+i,true)));return out;}
function distanceSegment(a,b){const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/length)):0;return Math.hypot(a[0]+t*dx,a[1]+t*dy);}
function distanceTriangle(a,b,c){
 const cross=(p,q)=>p[0]*q[1]-p[1]*q[0],area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),signs=[cross(a,b),cross(b,c),cross(c,a)];
 if(Math.abs(area)>1e-9&&(signs.every(v=>v>=-1e-8)||signs.every(v=>v<=1e-8)))return 0;
 return Math.min(distanceSegment(a,b),distanceSegment(b,c),distanceSegment(c,a));
}
describe('modern household heating witness',()=>{
 it('keeps equipment inside the vetted four-unit square and a standing resident clear of every solid face',()=>{
  for(const growth of [.01,.15,.5,1]){
   const mesh=new Mesh();householdHeating(mesh,growth);const vertices=points(mesh.pack()),bounds=meshBounds(mesh.pack());
   expect(bounds.min[0]).toBeGreaterThanOrEqual(-2);expect(bounds.min[1]).toBeGreaterThanOrEqual(-2);expect(bounds.max[0]).toBeLessThanOrEqual(2);expect(bounds.max[1]).toBeLessThanOrEqual(2);
   expect(bounds.min[2]).toBeGreaterThanOrEqual(0);expect(bounds.max[2]).toBeLessThanOrEqual(3*growth+1e-6);
   for(let i=0;i<vertices.length;i+=3){const triangle=vertices.slice(i,i+3);expect(triangle.every(p=>p.every(Number.isFinite))).toBe(true);if(triangle.every(p=>p[2]===0))continue;expect(distanceTriangle(...triangle),'room centre clearance').toBeGreaterThan(.9);}
  }
  const empty=new Mesh();householdHeating(empty,0);expect(empty.bytes).toBe(0);
 });
 it('renders the same actual ground installation and exact selected roof terminals in every canonical place',()=>{
  const before=JSON.stringify(placements);
  for(const site of sites){
   const ground=new Mesh();ground.at(site.peopleSpots[0].position,0,.0001);householdHeating(ground);
   const packed=projectMesh([{...site,proposal:false,state:'outcome'}],true,options),terminalBytes=144*20;
   expect(packed.byteLength).toBe(site.roofs.length*terminalBytes+ground.bytes);
   expect(new Uint8Array(packed.slice(-ground.bytes))).toEqual(new Uint8Array(ground.pack()));
   for(const [i,roof] of site.roofs.entries()){
    const terminal=new Mesh();terminal.at(roof.position,0,.0001);heatingTerminal(terminal);
    expect(new Uint8Array(packed.slice(i*terminalBytes,(i+1)*terminalBytes))).toEqual(new Uint8Array(terminal.pack()));
   }
   const frame=projectPreviewFrame(site),focus=projectFocusBounds(site),groundPoints=points(ground.pack());
   expect(frame.center.slice(0,2)).toEqual(site.peopleSpots[0].position.slice(0,2));expect(frame.contextSources).toEqual([site.roofs[0].source]);
   for(const p of groundPoints)for(let axis=0;axis<3;axis++){expect(p[axis]).toBeGreaterThanOrEqual(Math.min(...focus.map(q=>q[axis]))-3e-8);expect(p[axis]).toBeLessThanOrEqual(Math.max(...focus.map(q=>q[axis]))+3e-8);}
  }
  expect(JSON.stringify(placements)).toBe(before);
 });
 it('prepares the vetted ground site before construction and preserves proposal silhouettes and completed growth',()=>{
  for(const site of sites){
   const point=site.peopleSpots[0].position,prepared=projectMesh([{...site,proposal:false,state:'outcome'}],true,{...options,active:{id:'M5',progress:0}});
   expect(prepared.byteLength).toBeGreaterThan(0);
   for(const p of points(prepared)){expect(Math.abs(p[0]-point[0])).toBeLessThan(.0002);expect(Math.abs(p[1]-point[1])).toBeLessThan(.0002);expect(p[2]).toBeGreaterThan(point[2]);expect(p[2]).toBeLessThan(point[2]+.0003);}
   const completed=projectMesh([{...site,proposal:false,state:'outcome'}],true,options),finished=projectMesh([{...site,proposal:false,state:'outcome'}],true,{...options,active:{id:'M5',progress:1}});
   expect(new Uint8Array(finished)).toEqual(new Uint8Array(completed));
   for(const progress of [0,.35,1]){const proposed=projectMesh([{...site,proposal:true,progress,state:'preview'}],true,options);expect(points(proposed)).toEqual(points(completed));}
  }
 });
 it('retains the shared roofPlant model for its other callers',()=>{
  const mesh=new Mesh();roofPlant(mesh);expect(createHash('sha256').update(new Uint8Array(mesh.pack())).digest('hex')).toBe('f7292b4270239a22e38fcbd4ae556f071887d7242ccc574b5b858154c68f44b9');
 });
});
