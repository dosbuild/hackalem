import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import bootstrap from '../src/world/khanate/bootstrap.json';
import {projectMesh,projectObjects,projectFocusBounds,projectPreviewFrame,crossingApproach,placements} from '../src/world/khanate/projects.js';
import {districts,river} from '../src/world/khanate/geography.js';
import {OBJECT_UNIT,localPoint,meshBounds} from '../src/world/khanate/scale.js';
import {decodeMapWire} from '../src/world/map-wire.js';
import {makeTemplate} from '../src/world/khanate/models.js';
import {pointSegment} from '../src/world/placement-geometry.js';
import {closePose,eventPose} from '../src/world/khanate/choreography.js';
import definition from '../src/world/khanate/definition.js';

const sites=Object.values(placements).filter(site=>site.id==='M2');
const contains=(p,a,b,c)=>{if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-16)return false;const cross=(u,v)=>(v[0]-u[0])*(p[1]-u[1])-(v[1]-u[1])*(p[0]-u[0]),s=[cross(a,b),cross(b,c),cross(c,a)];return s.every(n=>n>=-1e-12)||s.every(n=>n<=1e-12);};
describe('historical crossing keeper and connected waiting lanes',()=>{
 it('joins the already shipped settlement ground rather than a detached invented road',()=>{
  const wire=readFileSync(new URL('../public/'+bootstrap.metadata.url,import.meta.url)),raw=wire[0]===31&&wire[1]===139?gunzipSync(wire):wire,data=new DataView(decodeMapWire(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),bootstrap.metadata.bytes));
  for(const site of sites){
   const connection=crossingApproach(site),join=localPoint(site.origin,site.orientation,...connection.join),found=[];
   for(let offset=0;offset<data.byteLength;offset+=60){
    if(data.getUint8(offset+18)!==4)continue;
    const points=[0,20,40].map(at=>[data.getFloat32(offset+at,true),data.getFloat32(offset+at+4,true),data.getFloat32(offset+at+8,true)]);
    if(points.some(p=>p[2]>.00012)||!contains(join,...points))continue;found.push(offset);
   }
   expect(found.length,site.key+' joins actual baked path triangles').toBeGreaterThan(0);
   for(let step=0;step<=40;step++){
    const end=connection.route.at(-1),start=connection.route[0],p=localPoint(site.origin,site.orientation,start[0]+(end[0]-start[0])*step/40,start[1]+(end[1]-start[1])*step/40);
    expect(Math.min(...river.slice(1).map((b,i)=>pointSegment(p,river[i],b))),site.key+' spur remains on land').toBeGreaterThan(.0065+1.8*OBJECT_UNIT);
   }
  }
 });
 it('keeps every spur outside all 188 existing yurt footprints',()=>{
  const homes=bootstrap.instances.filter(g=>g.kind==='yurt').flatMap(g=>{
   const vertices=new DataView(makeTemplate('yurt',g.variant));let radius=0;for(let offset=0;offset<vertices.byteLength;offset+=20)radius=Math.max(radius,Math.hypot(vertices.getFloat32(offset,true),vertices.getFloat32(offset+4,true)));
   return Array.from({length:g.transforms.length/8},(_,index)=>({id:g.id+':'+index,position:[g.transforms[index*8],g.transforms[index*8+1]],radius:radius*g.transforms[index*8+3]}));
  });
  expect(homes).toHaveLength(188);
  for(const site of sites){const route=crossingApproach(site).route.map(p=>localPoint(site.origin,site.orientation,...p));for(const home of homes)expect(Math.min(...route.slice(1).map((b,index)=>pointSegment(home.position,route[index],b)))-home.radius-1.8*OBJECT_UNIT,site.key+' clears '+home.id).toBeGreaterThan(.000025);}
 });
 it('keeps full geometry truthful while framing the measured keeper, lanes and native loaded cart',()=>{
  const cartBytes=makeTemplate('cart').byteLength;
  for(const site of sites){
   const object={...site,proposal:false},completed=projectMesh([object],false,{seconds:4}),proposal=projectMesh([{...site,proposal:true}],false,{seconds:4}),focus=meshBounds(projectMesh([object],false,{seconds:4,crossingPlaceOnly:true}));
   expect(meshBounds(completed).min).toEqual(site.view.min);expect(meshBounds(completed).max).toEqual(site.view.max);
   expect(meshBounds(proposal).min).toEqual(site.view.min);expect(meshBounds(proposal).max).toEqual(site.view.max);
   expect(completed.byteLength-proposal.byteLength).toBe(cartBytes);
   expect(site.view.focus).toEqual(focus);expect(projectPreviewFrame(site)).toBe(site.view.focus);
   expect(projectFocusBounds(site)).toHaveLength(8);
   for(let seconds=0;seconds<=90;seconds++){
    const buffer=projectMesh([object],false,{seconds}),bounds=meshBounds(buffer),cart=meshBounds(buffer.slice(buffer.byteLength-cartBytes));
    expect(bounds.min).toEqual(site.view.min);expect(bounds.max).toEqual(site.view.max);
    for(let axis=0;axis<3;axis++){expect(cart.min[axis]).toBeGreaterThanOrEqual(focus.min[axis]);expect(cart.max[axis]).toBeLessThanOrEqual(focus.max[axis]);}
    for(const spot of site.peopleSpots){const outside=spot.position[0]<cart.min[0]-.00008||spot.position[0]>cart.max[0]+.00008||spot.position[1]<cart.min[1]-.00008||spot.position[1]>cart.max[1]+.00008;expect(outside,site.key+' cart clears actual resident positions').toBe(true);}
   }
   const before=meshBounds(projectMesh([object],false,{seconds:90-.001})),after=meshBounds(projectMesh([object],false,{seconds:90+.001}));expect(before).toEqual(after);
  }
 });
 it('retains all five citywide identities and exposes the same actual geometry to label attachment',()=>{
  const decision={initiativeId:'M2',districtId:'esil',scope:'citywide'},props={commitments:[decision],candidate:null,result:null,comparisonPosition:0},before=structuredClone(props),objects=projectObjects(props,districts.features);
  expect(objects.map(o=>o.key)).toEqual(sites.map(o=>o.key));expect(objects.every(o=>o.citywide&&o.slot===1)).toBe(true);expect(props).toEqual(before);
  const slices=[],packed=projectMesh(objects,false,{seconds:4,projectLabelGeometry(o,data){slices.push({key:o.key,data:Uint8Array.from(new Uint8Array(data.buffer,data.byteOffset,data.byteLength))});}});
  expect(slices.map(o=>o.key)).toEqual(objects.map(o=>o.key));expect(Buffer.concat(slices.map(o=>o.data)).equals(Buffer.from(packed))).toBe(true);
  const preparation=[];const prepared=projectMesh(objects,false,{active:{id:'M2',progress:0},projectLabelGeometry(o,data){preparation.push({key:o.key,bytes:data.byteLength});}});expect(preparation.map(o=>o.key)).toEqual(objects.map(o=>o.key));expect(preparation.reduce((sum,o)=>sum+o.bytes,0)).toBe(prepared.byteLength);expect(prepared.byteLength).toBeGreaterThan(0);
 });
 it('uses the measured keeper centre at every public close and construction event entry',()=>{
  for(const site of sites){const pose=closePose(site);expect(pose.x).toBe(site.view.focus.center[0]);expect(pose.y).toBe(site.view.focus.center[1]);expect(pose.zoom).toBe(site.view.zoom);expect(eventPose(site)).toEqual(pose);}
  for(const site of Object.values(placements).filter(site=>site.id!=='M2'&&site.id!=='M7')){const pose=closePose(site),view=site.view.focus??site.view;expect(pose.x).toBe(view.center[0]);expect(pose.y).toBe(view.center[1]);}
  for(const site of Object.values(placements).filter(site=>site.id==='M7')){const pose=closePose(site);expect(pose.x).toBe(site.origin[0]);expect(pose.y).toBe(site.origin[1]+.0006);expect(pose.zoom).toBe(280);}
 });
 it('continues the existing loaded cart use after construction through the normal world animation scheduler',()=>{
  expect(definition.shouldAnimateProjects([{id:'M2',proposal:true}])).toBe(false);expect(definition.shouldAnimateProjects([{id:'M2',proposal:false}])).toBe(true);
  expect(definition.shouldAnimateProjects([{id:'M1',proposal:false}])).toBe(true);expect(definition.shouldAnimateProjects([{id:'M4',proposal:false}])).toBe(true);
  for(const site of sites){const object={...site,proposal:false};expect(Buffer.from(projectMesh([object],false,{seconds:0}))).not.toEqual(Buffer.from(projectMesh([object],false,{seconds:22.5})));expect(Buffer.from(projectMesh([object],false,{seconds:0}))).toEqual(Buffer.from(projectMesh([object],false,{seconds:90})));}
 });
});
