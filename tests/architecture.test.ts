import {describe,it,expect} from 'vitest';
// @ts-expect-error Generation grammar is a CPU JavaScript module.
import {classifyBuilding,rectangleFrame,sourceHeight,roofForm,emitBuilding,createFacadeInstances,METRE,GROUND} from '../scripts/alem/architecture.mjs';
// @ts-expect-error Source placement migration is a CPU JavaScript module.
import {rebaseRoofPlacements,rebaseGroundPlacements} from '../scripts/alem/rebase-roofs.mjs';

const ring=(w=12,d=8)=>[[0,0],[w*METRE,0],[w*METRE,d*METRE],[0,d*METRE]];
const props=(height=6,base=0,tags={})=>({osm_id:'way/7',height_m:height,base_m:base,tags});
describe('source architecture',()=>{
 it('uses one physical conversion, preserves a raised base, and does not clamp small houses',()=>{
  expect(sourceHeight(props(3)).top-GROUND).toBeCloseTo(3/12000,12);
  expect(sourceHeight(props(48,3)).bottom-GROUND).toBeCloseTo(3/12000,12);
  expect(sourceHeight(props(48,3)).top-GROUND).toBeCloseTo(48/12000,12);
  expect(()=>sourceHeight(props(3,4))).toThrow();
 });
 it('requires an actual near-rectangle before adding a pitched roof, including reversed winding',()=>{
  expect(rectangleFrame(ring())).not.toBeNull();expect(rectangleFrame(ring().reverse())).not.toBeNull();
  expect(rectangleFrame([[0,0],[12*METRE,0],[8*METRE,8*METRE],[0,8*METRE]])).toBeNull();
  const courtyard=[ring(),ring(3,2)];
  expect(roofForm(props(),courtyard,'garden-home').shape).toBe('flat');
  expect(roofForm(props(),[ring()],'garden-home',true).shape).toBe('flat');
 });
 it('lets explicit source use choose a family before conservative geometry fallbacks',()=>{
  for(const [tags,h,w,expected] of [
   [{building:'house'},6,12,'garden-home'],[{building:'school'},15,32,'civic-house'],
   [{building:'industrial'},8,32,'service-hall'],[{building:'apartments'},18,32,'residential-slab'],
   [{building:'office'},60,32,'modern-tower'],[{building:'yes'},12,24,'street-block'],
  ] as const)expect(classifyBuilding(props(h,0,tags),[[ring(w,12)]])).toBe(expected);
 });
 it('keeps every native wall at source base and every hip peak within source height',()=>{
  const coordinates:number[][]=[];const tri=(...args:unknown[])=>coordinates.push(...args.slice(0,3) as number[][]),quad=(...args:unknown[])=>coordinates.push(...args.slice(0,4) as number[][]);
  const p=props(6),roof=emitBuilding({rings:[ring()],props:p,family:'garden-home',material:{wall:[210,205,190],roof:[100,110,120]},tri,quad,fill:()=>{}});
  expect(roof.shape).toBe('hipped');
  expect(Math.min(...coordinates.map(p=>p[2]!))).toBeCloseTo(sourceHeight(p).bottom,12);
  expect(Math.max(...coordinates.map(p=>p[2]!))).toBeCloseTo(sourceHeight(p).top,12);
  for(const q of ring())expect(coordinates.some(p=>p[0]===q[0]&&p[1]===q[1]&&p[2]===sourceHeight(props()).bottom)).toBe(true);
 });
 it('owns façade instances by source and fits them beneath the source eaves',()=>{
  const builder=createFacadeInstances(),f={id:'way/7',props:props(6),polys:[[ring()]]};builder.building(f,{});
  const result=builder.finish();expect(result.count).toBeGreaterThan(5);expect(result.sources[0].id).toBe(f.id);
  for(const group of result.groups){expect(group.buildings).toBe(0);expect(result.association.find((g:{id:string})=>g.id===group.id).sources.every((id:string)=>id===f.id)).toBe(true);}
 });
 it('rebases M5 Z without choosing new roof IDs, moving XY, or touching resident paths',()=>{
  const catalog={records:{site:{key:'M5:nura',origin:[.1,.2,.01],peopleSpots:[{position:[.3,.4,.00004]}],roofs:[{source:'way/7',position:[.1,.2,.01],rings:[ring()]}]}}};
  const xy=JSON.stringify(catalog.records.site.roofs.map(r=>({source:r.source,xy:r.position.slice(0,2),rings:r.rings}))),people=JSON.stringify(catalog.records.site.peopleSpots);
  rebaseRoofPlacements(catalog,[{id:'way/7',props:props(12)}]);
  expect(JSON.stringify(catalog.records.site.roofs.map(r=>({source:r.source,xy:r.position.slice(0,2),rings:r.rings})))).toBe(xy);expect(JSON.stringify(catalog.records.site.peopleSpots)).toBe(people);
  expect(catalog.records.site.roofs[0]!.position[2]).toBeCloseTo(sourceHeight(props(12)).top+.00004,12);
  expect(rebaseRoofPlacements(catalog,[{id:'way/7',props:props(12)}]).changed).toBe(0);
 });
 it('migrates cartographic contact elevations while retaining all plan geometry and hero choreography',()=>{
  const site={key:'M1:nura',type:'corridor',origin:[.1,.2,.00088],route:[[.1,.2],[.3,.4]],sources:['way/7'],furniture:[{point:[.2,.3],ground:.00038}],peopleSpots:[{position:[.3,.4,.0004]}]},hero={key:'M7:nura',type:'parcel',origin:[.5,.6,.00004]};
  const plan=JSON.stringify({route:site.route,sources:site.sources,origin:site.origin.slice(0,2),furniture:site.furniture.map(f=>f.point),people:site.peopleSpots.map(p=>p.position.slice(0,2)),hero});
  rebaseGroundPlacements({records:{site,hero}});
  expect(JSON.stringify({route:site.route,sources:site.sources,origin:site.origin.slice(0,2),furniture:site.furniture.map(f=>f.point),people:site.peopleSpots.map(p=>p.position.slice(0,2)),hero})).toBe(plan);
  expect(site.origin[2]).toBe(.000035);expect(site.peopleSpots[0]!.position[2]).toBe(.00004);expect(site.furniture[0]!.ground).toBe(.00004);
 });
});
