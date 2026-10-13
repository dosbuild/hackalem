/** Independently re-read source city; never import or execute the selector. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {mapXY,contains} from '../../src/world/city-math.js';
import {bounds,rectangle,inPolygon,distance,pointSegment,polygonTouches,spatialIndex,corridor} from '../../src/world/placement-geometry.js';
import {readSource,METRE as U,geographic} from './program-source.mjs';
import {junctionSnapshot,crossingSnapshot,programStatic} from '../../src/world/astana-programs.js';
import {Mesh} from '../../src/world/mesh-kit.js';
const source=await readSource(),data=JSON.parse(await readFile('src/world/astana-programs.json','utf8')),report={version:data.version,checks:[],sites:[],solids:0},solids=[];
assert.equal(Object.keys(data.records).length,70);
const expectedParks={esil:['1196402246','1456208624'],almaty:['243930491','243930492','243930493'],saryarka:['885788799','885788800','885788801'],baikonur:['1428964223','500220321'],nura:['1526900307','1534678435']};
function audited(ring,district,label,options={}){assert(source.clear(ring,district,options),label+' collides with source city, vegetation, program or resident reservation');solids.push({id:label,rings:[ring],bounds:bounds(ring)});report.solids++;}
function sourceSegmentExists(a,b,sources){return source.roads.some(r=>sources.includes(r.id)&&r.points.some((q,i)=>i&&distance(q,b)<1e-9&&distance(r.points[i-1],a)<1e-9||i&&distance(q,a)<1e-9&&distance(r.points[i-1],b)<1e-9));}
for(const [key,program] of Object.entries(data.records)){
 const parent=source.placements[key],district=source.bootstrap.districts.features.find(d=>d.id===parent.district);assert(parent);assert(program.sites.every(s=>s.id===parent.id&&s.district===parent.district&&s.parentKey===parent.key));
 const sites=program.sites;
 for(const [i,fixture]of (program.furniture||[]).entries())if(fixture.footprint)audited(fixture.footprint,district,key+':fixture-'+i,{ignore:[parent.key]});
 if(parent.id==='M4')assert.deepEqual(sites.map(s=>s.source.split('/')[1]),expectedParks[parent.district]);
 if(parent.id==='M8')assert.equal(sites.filter(s=>s.kind==='clinic-satellite').length,3);
 if(parent.id==='M2')assert.equal(sites.filter(s=>s.kind==='junction').length,3);
 for(const site of sites){
  assert(contains(district.geometry,site.position),site.key+' leaves district');assert(site.origin.every(Number.isFinite));assert.equal(site.origin[2],.00004,site.key+' physical base floats above city ground');
  if(site.kind==='park-area'){
   const feature=source.features.get('green'+site.source);assert(feature);assert.deepEqual(site.rings,feature.geometry.coordinates.map(r=>r.slice(0,-1).map(mapXY)),site.key+' must use complete source polygon');assert(site.items.length>=2,site.key+' must landscape usable area');
   for(const item of site.items){assert.equal(item.point[2],.00004,item.key+' ground');assert(item.footprint.every(q=>inPolygon(q,site.rings)),item.key+' leaves park');audited(item.footprint,district,item.key);}
   for(const entrance of site.entrances||[]){assert(entrance.footprint.every(q=>inPolygon(q,site.rings)));audited(entrance.footprint,district,entrance.key);assert(source.roads.some(r=>r.id===entrance.source&&r.walk));}
   for(const path of site.paths||[])assert(source.roads.some(r=>r.id===path.source&&r.walk&&path.points.every(p=>r.points.some(q=>distance(q,p)<1e-9))),site.key+' invented path');
  }
  if(['clinic-satellite','kindergarten','sports-court'].includes(site.kind)){
   audited(site.footprint,district,site.key);if(site.kind==='kindergarten'){assert.equal(site.schoolSource,parent.key);assert(distance(site.origin,parent.origin)<300*U,site.key+' must belong to nearby school campus');}else{const home=source.buildings.find(b=>b.id===site.residentialSource);assert(home&&['apartments','residential','house','detached','terrace'].includes(home.tags.building),site.key+' lacks inhabited residential source');assert(Math.min(...home.rings[0].map(p=>distance(p,site.origin)))<180*U);}
   const approach=site.approach;assert(approach?.source);assert(sourceSegmentExists(...approach.sourceSegment,[approach.source]),site.key+' invented approach source');assert(pointSegment(approach.points.at(-1),...approach.sourceSegment)<1e-9,site.key+' approach does not reach source path');
   audited(approach.checkedFootprint,district,site.key+':approach');assert(source.clear(corridor(approach.points[0],approach.points.at(-1),1.1*U),district,{ignore:[approach.source]}),site.key+' full connector collides');
   if(site.kind==='clinic-satellite'){assert.deepEqual(site.buildingSize,[24,18]);assert.deepEqual(site.size,[40*U,36*U]);assert(site.separationMetres>=400);}
   // Audit actual emitted architecture vertices too, including eaves, handrails,
   // entry, waiting seats and planters. The approach owns a separate checked ring.
   const kit=new Mesh();programStatic(kit,{...parent,key:site.key,program:{sites:[{...site,approach:null}]},state:'audited'},{});const view=new DataView(kit.pack());let base=Infinity;for(let at=0;at<view.byteLength;at+=20){const p=[view.getFloat32(at,true),view.getFloat32(at+4,true)];base=Math.min(base,view.getFloat32(at+8,true));assert(inPolygon(p,[site.footprint])||site.footprint.some(q=>distance(p,q)<.02*U),site.key+' emitted solid exceeds audited envelope');}assert(Math.abs(base-site.origin[2])<.001*U,site.key+' emitted pad is not grounded');
  }
  if(site.kind==='junction'){
   assert(site.arms.length>=3&&site.signals.length>=3);
   for(const arm of site.arms)for(let i=1;i<arm.points.length;i++)assert(sourceSegmentExists(arm.points[i-1],arm.points[i],arm.sources),site.key+' invented traffic arm');
   for(const [i,signal] of site.signals.entries())audited(signal.footprint,district,site.key+':signal-'+i);
   let stopped=false,moved=false,pedestrian=false;
   for(let second=0;second<80;second+=.25){const frame=junctionSnapshot(site,second);stopped ||=frame.vehicles.some(v=>v.stopped);moved ||=frame.vehicles.some(v=>!v.stopped);if(frame.axis==='pedestrian'){pedestrian=true;assert(frame.vehicles.every(v=>v.stopped&&!v.insideJunction),site.key+' pedestrian phase has crossing traffic');}assert(new Set(frame.vehicles.filter(v=>v.green).map(v=>v.axis)).size<=1,site.key+' opposing conflicting release');}
   assert(stopped&&moved&&pedestrian);
  }
  if(site.kind==='protected-crossing')for(const [i,sign]of site.signs.entries())audited(sign.footprint,district,site.key+':sign-'+i,{ignore:[parent.key]});
  if(site.kind==='greening-belt-core')for(const [i,item]of site.items.entries())audited(item.footprint,district,site.key+':tree-'+i,{ignore:[parent.key]});
  if(site.kind==='household-service'){audited(site.footprint,district,site.key,{ignore:[parent.key]});assert(source.buildings.some(b=>b.id===site.householdSource));assert.equal(site.connection.kind,'buried-service');assert(sourceSegmentExists(...site.connection.sourceSegment,site.connection.sources));assert(pointSegment(site.connection.points[0],...site.connection.sourceSegment)<1e-9);assert(source.clear(site.connection.checkedFootprint,district,{ignore:[parent.key,...source.roads.map(r=>r.id)],vegetationToo:false,reservationsToo:false}),site.key+' buried connection hits building or water');}
  for(const [i,person] of site.peopleSpots.entries()){assert.equal(person.position[2],.00004,site.key+' actor floats');assert(source.clear(rectangle(person.position,.7*U,.7*U),district,{ignore:[parent.key]}),site.key+' unchecked person '+i);}
  report.sites.push({key:site.key,kind:site.kind,source:site.source,solids:site.items?.length||site.signals?.length||1,people:site.peopleSpots.length});
 }
 if(parent.id==='M8'){const points=[parent.origin,...sites.map(s=>s.origin)];for(let i=0;i<points.length;i++)for(let j=0;j<i;j++)assert(distance(points[i],points[j])>=400*U,key+' facilities are insufficiently separated');}
}
const index=spatialIndex(solids);
for(const item of solids)for(const other of index(item.bounds))if(item.id<other.id){const ownApproach=item.id+':approach'===other.id||other.id+':approach'===item.id;if(!ownApproach)assert(!polygonTouches(item.rings,other.rings),item.id+' overlaps '+other.id);}
const before=crossingSnapshot(8,false),after=crossingSnapshot(8,true);assert.equal(after.speed,0);assert(after.stopped&&after.pedestrian&&before.speed>0);assert(crossingSnapshot(2,true).speed<crossingSnapshot(2,false).speed);
report.checks=['70 authoritative parents retain their original placements','All twelve full mapped park polygons and all neighboring program parts retained','Every landscape solid checked against full source geometry and vegetation','Fifteen 24 × 18 m satellites with 40 × 36 m checked envelopes and source-path access','All clinic sites linked to inhabited residential sources and at least 400 m apart','Fifteen actual three-arm junctions with individually vetted signal fixtures','Opposing releases are mutually exclusive and pedestrian phases stop every queue','Safe crossings stop for people and show slower approach speed','No generated program solids overlap'];
await mkdir('artifacts/consequences',{recursive:true});await writeFile('artifacts/consequences/program-audit.json',JSON.stringify(report,null,2)+'\n');console.log('PASS '+report.solids+' individual solids and '+report.sites.length+' program sites');
