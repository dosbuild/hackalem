import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {projectObjects,projectMesh,projectStaticMesh,projectDynamicMesh,programSites,placements,lampPositions,projectStaticCacheKey} from '../src/world/khanate/projects.js';
import {programSource,programFor,programCrossingCycle,programCrossingCartPose,programRoutePose,generateKhanateProgramData} from '../src/world/khanate/programs.js';
import {auditKhanateProgramMeshes} from '../src/world/khanate/program-audit.js';
import {programEvidenceState,programWitnesses,programSiteVisible} from '../src/world/khanate/program-models.js';
import {Mesh} from '../src/world/mesh-kit.js';
import {villager} from '../src/world/khanate/life-models.js';
import {OBJECT_UNIT,meshBounds} from '../src/world/khanate/scale.js';
import {districts,quarters} from '../src/world/khanate/geography.js';
import {distance,pointSegment} from '../src/world/placement-geometry.js';
import {evaluatePlan} from '../src/domain/evaluate';
import {closePose} from '../src/world/khanate/choreography.js';
import {collectProgramSites} from '../src/world/program-runtime.js';
import {assertProgramPlacements} from '../scripts/khanate/compare-programs.mjs';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const objectsFor=(id,district='esil')=>projectObjects({commitments:[{initiativeId:id,districtId:district,scope:['M2','M6','M12','M14'].includes(id)?'citywide':'district'}],scenarioRevision:0},districts.features);

describe('connected occupied Khanate programs',()=>{
 it('holds a loading yard and caravan stop at their authored working scale after the network footprint',()=>{
  for(const id of ['M1','M3']){
   const parent=objectsFor(id)[0],working=parent.view.focus;
   expect(closePose(parent).zoom).toBe(working.zoom);
   const child=collectProgramSites([parent],programSites).find(s=>s.isChild);
   expect(child.route).toBe(parent.route);
   expect(closePose(child).zoom).toBe(child.view.zoom);
   expect(closePose(child).zoom).toBeGreaterThan(150);
   expect(closePose(placements[parent.key]).zoom).toBe(30);
  }
 });
 it('invalidates static architecture at every shared visibility boundary while retaining reversible bytes',()=>{
  const objects=objectsFor('M8'),site=programSites(objects[0]).find(s=>s.key==='M8:esil@1'),center=[.03,-.05];
  expect(programSiteVisible(site,{center,zoom:26})).toBe(true);expect(programSiteVisible(site,{center,zoom:50})).toBe(false);
  for(const [a,b]of [[24,26],[26,50],[60,80]])expect(projectStaticCacheKey({zoom:a})).not.toBe(projectStaticCacheKey({zoom:b}));
  const close=projectStaticMesh(objects,{center,zoom:50}),wider=projectStaticMesh(objects,{center,zoom:26}),returned=projectStaticMesh(objects,{center,zoom:50});
  expect(wider.byteLength).toBeGreaterThan(close.byteLength);expect(Buffer.from(returned).equals(Buffer.from(close))).toBe(true);
 });
 it('keeps every parent identity and original household membership while expanding all14 programs',()=>{
  expect(programSource.homes).toHaveLength(188);expect(programSource.courtCount).toBe(55);
  for(let i=1;i<=14;i++){
   const id=`M${i}`,objects=objectsFor(id);expect(objects).toHaveLength(['M2','M6','M12','M14'].includes(id)?5:1);
   for(const object of objects){expect(object.origin).toEqual(placements[object.key].origin);expect(object.peopleSpots).toEqual(placements[object.key].peopleSpots);expect(object.program.illustrative).toBe(true);
    const sites=programSites(object);expect(sites.length).toBeGreaterThanOrEqual(3);expect(new Set(sites.map(s=>s.key)).size).toBe(sites.length);expect(sites.every(s=>s.id===id&&s.district===object.district&&s.parentKey===object.key)).toBe(true);
    expect(sites.slice(1).every(s=>s.source.startsWith('household-court:')||s.source.startsWith('quarter-edge:')||s.source.startsWith('existing-household:'))).toBe(true);
   }
  }
  expect(placements['M4:esil'].origin).toEqual(placements['M7:esil'].origin);
 });
 it('is deterministic and audits full solid and ribbon triangles against all source homes',()=>{
  const stored=JSON.parse(readFileSync('src/world/khanate/program-sites.json','utf8')),generated=generateKhanateProgramData();
  assertProgramPlacements(stored,generated);expect(hash(generateKhanateProgramData())).toBe(hash(generated));
  const report=auditKhanateProgramMeshes();expect(report.issues).toEqual([]);expect(report.ok).toBe(true);expect(report.checked).toMatchObject({programs:70,sites:275,solids:175,connectors:175,homes:188,courts:55,attachedHouseholds:30});expect(report.checked.triangles).toBeGreaterThan(100000);
 },20000);
 it('provides one healers hub and exactly three distinct inhabited treatment courts with separated approaches',()=>{
  for(const q of quarters){const sites=programSites(placements[`M8:${q.id}`]),satellites=sites.slice(1);expect(sites).toHaveLength(4);expect(new Set(satellites.map(s=>s.cluster)).size).toBe(3);
   for(const s of satellites){expect(s.kind).toBe('treatment-court');expect(programSource.homes.some(h=>h.district===q.id&&h.cluster===s.cluster)).toBe(true);expect(s.approach.length).toBeGreaterThanOrEqual(2);}
   for(let i=0;i<satellites.length;i++)for(let j=i+1;j<satellites.length;j++)expect(distance(satellites[i].origin,satellites[j].origin)*12000).toBeGreaterThanOrEqual(400);
  }
 });
 it('plants distinct exposed edge belts in all five quarters and attaches heating equipment to existing homes',()=>{
  for(const object of objectsFor('M6'))for(const site of programSites(object).slice(1)){const q=quarters.find(q=>q.id===site.district),a=q.polygon[site.edge],b=q.polygon[(site.edge+1)%q.polygon.length];expect(site.source.startsWith('quarter-edge:')).toBe(true);expect(pointSegment(site.origin,a,b)).toBeLessThan(site.radius*2.5);}
  for(const q of quarters){const conversions=programSites(placements[`M5:${q.id}`]).slice(1);expect(conversions).toHaveLength(6);for(const site of conversions)expect(site.origin).toEqual(programSource.homes.find(h=>h.id===site.hostHomeId).origin);}
 });
 it('alternates actual cart and herd releases with two all-waiting phases, and returns runners without a positional jump',()=>{
  for(let seconds=0;seconds<108;seconds+=.25){const cycle=programCrossingCycle(seconds);expect(cycle.cartOpen&&cycle.herdOpen).toBe(false);if(cycle.allWaiting)expect(cycle.cartOpen||cycle.herdOpen).toBe(false);}
  expect(programCrossingCycle(14).allWaiting).toBe(true);expect(programCrossingCycle(32).allWaiting).toBe(true);expect(programCrossingCycle(4).cartOpen).toBe(true);expect(programCrossingCycle(22).herdOpen).toBe(true);
  for(const boundary of [13,17,30,36]){const a=programCrossingCartPose(boundary-.00001),b=programCrossingCartPose(boundary+.00001);expect(distance(a.point,b.point)).toBeLessThan(.0001);expect(Math.abs(Math.sin(a.angle)-Math.sin(b.angle))).toBeLessThan(.0001);expect(Math.abs(Math.cos(a.angle)-Math.cos(b.angle))).toBeLessThan(.0001);}
  const route=programSites(placements['M12:esil'])[1].approach;for(const seconds of [37,45,82,90])expect(distance(programRoutePose(route,seconds-.00001).point,programRoutePose(route,seconds+.00001).point)).toBeLessThan(.000001);
 });
 it('keeps an arriving pupil child-sized when stopping at the lesson court',()=>{
  const site=programSites(placements['M7:esil'])[1],record={...placements['M7:esil'],phase:'planned',program:{sites:[site]}},template=new Mesh();template.at([0,0,0],0,OBJECT_UNIT*.88);villager(template,0,1,'play');const packed=template.pack(),expected=meshBounds(packed).extent[2];
  for(const seconds of [0,20,30,64]){const use=programWitnesses(record,{seconds}),arrival=meshBounds(use.slice(use.byteLength-packed.byteLength));expect(arrival.extent[2]).toBeCloseTo(expected,7);}
 });
 it('shows physical baseline witnesses and delivered infrastructure from exact result evidence without changing the evaluator',()=>{
  const plan=[{initiativeId:'M4',scope:'district',districtId:'esil'},{initiativeId:'M1',scope:'district',districtId:'almaty'},{initiativeId:'M8',scope:'district',districtId:'nura'},{initiativeId:'M10',scope:'district',districtId:'saryarka'},{initiativeId:'M14',scope:'citywide'}],evaluated=evaluatePlan(plan);expect(evaluated.ok).toBe(true);const result=evaluated.result,before=JSON.stringify(result),props={commitments:plan,result:{revision:7,value:result},scenarioRevision:7};
  const baseline=projectObjects({...props,comparisonPosition:0},districts.features),after=projectObjects({...props,comparisonPosition:1},districts.features);expect(baseline.every(o=>o.phase==='baseline')).toBe(true);expect(after.every(o=>o.phase==='evaluated'&&o.evidence.length>0)).toBe(true);
  expect(projectStaticMesh(baseline,{seconds:4}).byteLength).toBe(0);expect(projectDynamicMesh(baseline,false,{seconds:4}).byteLength).toBeGreaterThan(0);expect(projectStaticMesh(after,{seconds:4}).byteLength).toBeGreaterThan(0);expect(JSON.stringify(result)).toBe(before);expect(result.summary.spent).toBe(81);
  expect(lampPositions(baseline.find(o=>o.id==='M10'))).toEqual([]);expect(lampPositions(after.find(o=>o.id==='M10')).length).toBeGreaterThan(12);
  expect(projectObjects({...props,scenarioRevision:8,comparisonPosition:0},districts.features).every(o=>o.phase==='planned')).toBe(true);
  const conversion=objectsFor('M5')[0],clean=programEvidenceState({...conversion,phase:'evaluated',evidence:[{measureEffects:[{initiativeIds:['M5'],indicatorId:'E2',amount:10}]}]}),missing=programEvidenceState({...conversion,phase:'evaluated',evidence:[]});expect(clean.cleaner).toBe(true);expect(missing.cleaner).toBe(false);
 },20000);
 it('keeps architecture clock-invariant, separates use, and bounds animation with a shared actor budget',()=>{
  const objects=objectsFor('M2'),a=projectStaticMesh(objects,{seconds:4}),b=projectStaticMesh(objects,{seconds:22});expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  const first=projectDynamicMesh(objects,false,{seconds:4}),later=projectDynamicMesh(objects,false,{seconds:22});expect(Buffer.from(first).equals(Buffer.from(later))).toBe(false);expect(first.byteLength).toBeLessThan(3000000);
  const preview=objects.map(o=>({...o,proposal:true,phase:'preview'}));expect(projectDynamicMesh(preview,false,{seconds:22}).byteLength).toBe(0);
  const assembling={active:{id:'M2',progress:.4},seconds:4};expect(projectStaticMesh(objects,assembling).byteLength).toBe(0);expect(projectDynamicMesh(objects,false,assembling).byteLength).toBeGreaterThan(0);
  expect(projectMesh(objects,false,{seconds:4}).byteLength).toBe(a.byteLength+first.byteLength);
  const densePlan=[{initiativeId:'M2',scope:'citywide'},{initiativeId:'M6',scope:'citywide'},{initiativeId:'M12',scope:'citywide'},{initiativeId:'M14',scope:'citywide'},{initiativeId:'M10',scope:'district',districtId:'esil'}],dense=projectObjects({commitments:densePlan},districts.features),slices=[];
  const populated=projectDynamicMesh(dense,false,{seconds:22,projectLabelGeometry(o,data){slices.push({key:o.key,bytes:data.byteLength});}});expect(slices.every(s=>s.bytes>0)).toBe(true);expect(populated.byteLength).toBeLessThan(6500000);
 },20000);
});
