import {describe,it,expect} from 'vitest';
import {createChoreography,OVERVIEW,CLOSE_ZOOM,closePose,eventPose} from '../src/world/choreography';
import catalog from '../src/world/placements.json';
import {contains} from '../src/world/city-math';
import bootstrap from '../src/world/bootstrap.json';
import {RESIDENTS} from '../src/residents/population';
import {createHash} from 'node:crypto';
// Native JS mesh modules are exercised directly, as Vite loads them in the product.
// @ts-expect-error JavaScript mesh builder
import {projectMesh,projectObjects} from '../src/world/project-objects';
// @ts-expect-error JavaScript character builder
import {residentSignature,residentsMesh} from '../src/world/resident-models';
// @ts-expect-error Native route geometry helper
import {routeSection,eventLight} from '../src/world/intervention-effects';

describe('geographic consequence contract',()=>{
 it('partial construction preserves road bends instead of cutting across blocks',()=>{
  const route=[[0,0],[2,0],[2,2],[4,2]],before=JSON.stringify(route);
  expect(routeSection(route,.25,.75)).toEqual([[1.5,0],[2,0],[2,2],[2.5,2]]);
  expect(routeSection(route,0,1)).toEqual(route);
  expect(JSON.stringify(route)).toBe(before);
 });
 it('committed projects do not also render the same provisional geometry',()=>{
  for(const decision of [{initiativeId:'M4',scope:'district',districtId:'esil'},{initiativeId:'M12',scope:'citywide'}]){
   const objects=projectObjects({commitments:[decision],candidate:{decision},scenarioRevision:1},bootstrap.districts.features);
   expect(objects).toHaveLength(decision.scope==='citywide'?5:1);
   expect(objects.every((o:{proposal:boolean})=>!o.proposal)).toBe(true);
  }
 });
 it('event lighting is scoped to the active geographic project and ends with the sequence',()=>{
  const site=catalog.records['M4:esil'],active={id:'M4',key:site.key,stage:'people',finish:1};
  expect(eventLight([site],active).origin).toEqual(site.origin);
  expect(eventLight([site],{...active,key:'M4:nura'})).toBeNull();
  expect(eventLight([site],{...active,citywide:true})).toBeNull();
  expect(eventLight([site],{...active,stage:'complete'})).toBeNull();
  expect(eventLight([site],null)).toBeNull();
 });
 it('catalog covers fourteen measures in all five districts with source provenance',()=>{
  expect(Object.keys(catalog.records)).toHaveLength(70);
  for(const site of Object.values(catalog.records)){
   const d=bootstrap.districts.features.find(d=>d.id===site.district)!;
   expect(contains(d.geometry,site.position),site.key).toBe(true);
   expect(site.placement).toMatch(/vetted|connected|existing/);
   expect(site.origin.every(Number.isFinite),site.key).toBe(true);
  }
 });
 it('commitments hold a wider block view, preserve manual close views and stay at the consequence',()=>{
  for(const site of Object.values(catalog.records).filter(site=>site.key!=='M7:nura')){
   const c=createChoreography({...site,citywide:false},1000,{...OVERVIEW,zoom:3});
   expect(c.sample(6000).pose).toEqual(eventPose(site));
   expect(eventPose(site).zoom).toBeLessThan(CLOSE_ZOOM);
   expect(closePose(site).zoom).toBe(CLOSE_ZOOM);
   const held=Array.from({length:120},(_,i)=>c.sample(1000+i*100)).filter(s=>s.stage==='people');
   expect(held.length).toBeGreaterThanOrEqual(10);
   for(const sample of held)expect(sample.pose).toEqual(eventPose(site));
   expect(c.duration).toBe(12);
   expect(c.sample(6000).done).toBe(false);
   expect(c.sample(14000).pose).toEqual(eventPose(site));
   expect(c.sample(14000).done).toBe(true);
   for(let t=0;t<=13000;t+=100){const s=c.sample(t+1000);expect(s.pose.pitch).toBeGreaterThan(0);expect(s.pose.zoom).toBeGreaterThanOrEqual(1);expect(s.progress).toBeGreaterThanOrEqual(0);expect(s.progress).toBeLessThanOrEqual(1);}
  }
 });
 it('citywide sequences establish the full footprint then hold a representative working site',()=>{
  const c=createChoreography({...catalog.records['M2:esil'],citywide:true},0,OVERVIEW);
  expect(c.sample(500).pose).toEqual(OVERVIEW);
  expect(c.sample(7000).pose).toEqual(eventPose(catalog.records['M2:esil']));
  expect(c.sample(7000).done).toBe(false);
  expect(c.sample(13000).done).toBe(true);
 });
 it('preview, commitment and outcome retain exactly one geographic placement and revision',()=>{
  const decision={initiativeId:'M4',scope:'district',districtId:'esil'},base={commitments:[],candidate:{decision},budgetPreview:{progress:.7},scenarioRevision:4};
  const preview=projectObjects(base,bootstrap.districts.features)[0],planned=projectObjects({...base,candidate:null,commitments:[decision]},bootstrap.districts.features)[0],future=projectObjects({...base,candidate:null,commitments:[decision],result:{revision:4},comparisonPosition:1},bootstrap.districts.features)[0];
  for(const p of [preview,planned,future]){expect(p.origin).toEqual(preview.origin);expect(p.footprint).toEqual(preview.footprint);expect(p.revision).toBe(4);}
  expect([preview.state,planned.state,future.state]).toEqual(['preview','planned','outcome']);
  expect(projectObjects({...base,candidate:null,commitments:[]},bootstrap.districts.features)).toEqual([]);
 });
 it('every measure builds finite dimensional geometry throughout construction and all LODs',()=>{
  for(const site of Object.values(catalog.records))for(const zoom of [1,5,160])for(const progress of [.25,.65,1]){
   const data=projectMesh([{...site,state:'planned',progress:1}],false,{zoom,scale:324*zoom,active:{id:site.id,progress},seconds:4});
   expect(data.byteLength,`${site.key}/${zoom}/${progress}`).toBeGreaterThan(0);
   const v=new DataView(data);let finite=true;for(let i=0;i<data.byteLength;i+=20)for(let j=0;j<3;j++)finite&&=Number.isFinite(v.getFloat32(i+j*4,true));expect(finite,site.key).toBe(true);
  }
 });
 it('all 100 existing identities produce reproducible distinct 3D meshes and cull at macro',()=>{
  const hashes=new Set();for(const resident of RESIDENTS){const a=[{resident,position:[0,0,0],angle:0,activity:'idle'}],one=residentsMesh(a,0,160),two=residentsMesh(a,100,160);expect(residentSignature(resident)).toContain(resident.id);expect(Buffer.from(one).equals(Buffer.from(two))).toBe(true);hashes.add(createHash('sha256').update(Buffer.from(one)).digest('hex'));expect(residentsMesh(a,0,1).byteLength).toBe(0);}
  expect(hashes.size).toBe(100);
 });
});
