import {describe,it,expect} from 'vitest';
import bootstrap from '../src/world/bootstrap.json';
import {placements,projectObjects,programSites,projectStaticMesh,projectDynamicMesh,projectMesh,projectFocusBounds} from '../src/world/project-objects.js';
import {astanaPrograms,junctionSnapshot,baselineJunctionSnapshot,trafficPhase,crossingSnapshot,boardingSnapshot,routeParameter,PROGRAM_METRE as U} from '../src/world/astana-programs.js';
const districts=bootstrap.districts.features;
const props=(id,district='esil')=>({commitments:[{initiativeId:id,scope:['M2','M6','M12','M14'].includes(id)?'citywide':'district',districtId:district}],candidate:null,scenarioRevision:4,result:null,comparisonPosition:1});
describe('Astana complete physical programs',()=>{
 it('keeps one existing authoritative parent per funded district and stable child identities',()=>{
  const before=JSON.stringify(placements);
  for(let i=1;i<=14;i++){const objects=projectObjects(props('M'+i),districts);expect(objects).toHaveLength(['M2','M6','M12','M14'].includes('M'+i)?5:1);for(const object of objects){expect(object.origin).toEqual(placements[object.key].origin);expect(object.peopleSpots).toEqual(placements[object.key].peopleSpots);expect(object.program).toBe(astanaPrograms[object.key]);const sites=programSites(object);for(const site of sites){expect(site.parentKey).toBe(object.key);expect(site.id).toBe(object.id);expect(site.district).toBe(object.district);expect(projectFocusBounds(site).every(p=>p.every(Number.isFinite))).toBe(true);}}}
  expect(JSON.stringify(placements)).toBe(before);
 });
 it('retains complete mapped park zones and neighbors with varied landscape throughout usable areas',()=>{
  const expected={esil:['1196402246','1456208624'],almaty:['243930491','243930492','243930493'],saryarka:['885788799','885788800','885788801'],baikonur:['1428964223','500220321'],nura:['1526900307','1534678435']};
  for(const [district,ids]of Object.entries(expected)){const sites=programSites({...placements['M4:'+district],program:astanaPrograms['M4:'+district]});expect(sites.map(s=>s.source.split('/')[1])).toEqual(ids);for(const site of sites){expect(site.origin[2]).toBe(.00004);expect(site.items.every(i=>i.point[2]===.00004)).toBe(true);expect(site.items.length).toBeGreaterThan(10);expect(new Set(site.items.map(i=>i.kind)).size).toBe(4);expect(site.rings[0].length).toBeGreaterThan(3);expect(site.peopleSpots.length).toBeGreaterThan(0);}}
 });
 it('adds exactly three recognizable source-supported satellites per existing clinic',()=>{
  for(const district of districts){const parent=placements['M8:'+district.id],sites=programSites(parent);expect(sites).toHaveLength(3);for(const site of sites){expect(site.kind).toBe('clinic-satellite');expect(site.buildingSize).toEqual([24,18]);expect(site.size).toEqual([40*U,36*U]);expect(site.separationMetres).toBeGreaterThanOrEqual(400);expect(site.approach.points).toHaveLength(3);expect(site.approach.source).toMatch(/^way\//);expect(site.peopleSpots).toHaveLength(4);}expect(new Set(sites.map(s=>s.residentialSource)).size).toBe(3);}
 });
 it('has exactly three sourced junctions per district with safely phased queues',()=>{
  for(const district of districts){const sites=programSites(placements['M2:'+district.id]);expect(sites).toHaveLength(3);for(const site of sites){expect(site.arms.length).toBeGreaterThanOrEqual(3);let stopped=false,released=false,pedestrians=false;for(let time=0;time<80;time+=.5){const snapshot=junctionSnapshot(site,time);stopped||=snapshot.vehicles.some(v=>v.stopped);released||=snapshot.vehicles.some(v=>!v.stopped);expect(new Set(snapshot.vehicles.filter(v=>v.green).map(v=>v.axis)).size).toBeLessThanOrEqual(1);if(snapshot.axis==='pedestrian'){pedestrians=true;expect(snapshot.vehicles.every(v=>v.stopped&&!v.insideJunction)).toBe(true);}}expect(stopped&&released&&pedestrians).toBe(true);}}
  expect(trafficPhase(3).axis).toBe('east-west');expect(trafficPhase(19).axis).toBe('north-south');expect(trafficPhase(35).axis).toBe('pedestrian');
  expect(trafficPhase(13)).toMatchObject({amber:true,departingAxis:'east-west'});expect(trafficPhase(29)).toMatchObject({amber:true,departingAxis:'north-south'});
  const site=programSites(placements['M2:esil'])[0];expect(baselineJunctionSnapshot(site,8).vehicles.map(v=>v.point)).not.toEqual(junctionSnapshot(site,8).vehicles.map(v=>v.point));
 });
 it('slows approaches and stops traffic while people use protected crossings',()=>{expect(crossingSnapshot(2,true).speed).toBeLessThan(crossingSnapshot(2,false).speed);expect(crossingSnapshot(8,true)).toMatchObject({speed:0,stopped:true,pedestrian:true});expect(crossingSnapshot(13,true).stopped).toBe(false);});
 it('boards at the actual checked stops and moves in both directions',()=>{const parent=projectObjects(props('M1'),districts)[0],a=boardingSnapshot(parent,0),b=boardingSnapshot(parent,8),fixture=parent.furniture[Math.round((parent.furniture.length-1)*.18)];expect(new Set(a.map(bus=>bus.side))).toEqual(new Set([-1,1]));expect(a.filter(bus=>bus.stopIndex===0).every(bus=>bus.stopped&&bus.stop===routeParameter(parent.route,fixture.point))).toBe(true);expect(a.map(bus=>bus.point)).not.toEqual(b.map(bus=>bus.point));});
 it('keeps new kindergartens beside their funded school campus',()=>{for(const district of districts.filter(d=>d.id!=='nura')){const parent=placements['M7:'+district.id],site=programSites(parent)[0];expect(site.schoolSource).toBe(parent.key);expect(Math.hypot(site.origin[0]-parent.origin[0],site.origin[1]-parent.origin[1])/U).toBeLessThan(300);}});
 it('separates completed static architecture from a bounded moving layer and freezes reduced motion',()=>{
  for(const id of ['M4','M8','M2','M1','M5','M11','M14']){const objects=projectObjects(props(id),districts),options={zoom:45,preview:false,seconds:0,scale:14580};const a=projectStaticMesh(objects,options),b=projectStaticMesh(objects,{...options,seconds:7});expect(a.byteLength).toBeGreaterThan(0);expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);const dynamic=projectDynamicMesh(objects,false,options);expect(dynamic.byteLength).toBeLessThan(4*1024*1024);const freezeA=projectDynamicMesh(objects,false,{...options,reducedMotion:true}),freezeB=projectDynamicMesh(objects,false,{...options,reducedMotion:true,seconds:16});expect(Buffer.from(freezeA).equals(Buffer.from(freezeB))).toBe(true);}
 });
 it('keeps real preparation visible until citywide greening starts planting',()=>{
  const objects=projectObjects(props('M6'),districts),options={zoom:45,seconds:4,scale:14580};
  for(const progress of [.1,.2,.3,.4,.45,.55,.6,.8]){
   const active={id:'M6',key:'M6:esil',progress,elapsed:progress*12};
   expect(projectDynamicMesh(objects,false,{...options,active}).byteLength,`greening construction at ${progress}`).toBeGreaterThan(0);
  }
  const complete=projectMesh(objects,false,options);
  expect(Buffer.from(projectMesh(objects,false,{...options,active:{id:'M6',key:'M6:esil',progress:1,elapsed:12}})).equals(Buffer.from(complete))).toBe(true);
 });
 it('hides purchased infrastructure in baseline while preserving evidence and a comparison clock',()=>{
  for(const id of ['M4','M8','M2','M5','M11']){const objects=projectObjects(props(id),districts),baseline=objects.map(o=>({...o,phase:'baseline'})),options={zoom:45,seconds:8,preview:false};expect(projectStaticMesh(baseline,options).byteLength).toBe(0);expect(projectMesh(baseline,false,options).byteLength).toBeLessThan(projectMesh(objects,false,options).byteLength);expect(objects.every(o=>o.phase==='planned')).toBe(true);}
 });
});
