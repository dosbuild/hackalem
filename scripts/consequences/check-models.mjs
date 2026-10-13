/** Exercise every district placement and construction phase without a GPU. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {placements,projectObjects,projectMesh} from '../../src/world/project-objects.js';
import {createChoreography,OVERVIEW,closePose} from '../../src/world/choreography.js';
import {cameraFrame} from '../../src/world/projection.js';
import {contains,boundedPose} from '../../src/world/city-math.js';
import {isHeroSchool,world} from '../../src/world/hero-school.js';

const bootstrap=JSON.parse(await readFile(new URL('../../src/world/bootstrap.json',import.meta.url)));
const before=JSON.stringify(placements),districts=bootstrap.districts.features;
assert.equal(Object.keys(placements).length,70);
let meshes=0;
for(const site of Object.values(placements)){
 const district=districts.find(d=>d.id===site.district);
 assert(district&&contains(district.geometry,site.position),`${site.key}: location belongs to district`);
 const decision={initiativeId:site.id,scope:'district',districtId:site.district};
 const props={commitments:[decision],candidate:null,scenarioRevision:1,result:null,comparisonPosition:0};
 const objects=projectObjects(props,districts);
 assert.equal(objects.length,1);
 for(const zoom of [1,160])for(const progress of [0,.25,.6,1]){
  const buffer=projectMesh(objects,false,{zoom,scale:324*zoom,seconds:3,active:{id:site.id,progress},anchors:bootstrap.anchors});
  assert.equal(buffer.byteLength%60,0,`${site.key}: complete packed triangles`);
  if(progress===1)assert(buffer.byteLength>0,`${site.key}: completed geometry`);
  const view=new DataView(buffer);
  for(let offset=0;offset<buffer.byteLength;offset+=20)for(let axis=0;axis<3;axis++)assert(Number.isFinite(view.getFloat32(offset+axis*4,true)),`${site.key}: finite vertex`);
  meshes++;
 }
 const close=closePose(site),focus=isHeroSchool(site)?world(site,[0,-9,3]):site.origin,center=cameraFrame(close,1440,900).world(focus);
 assert.deepEqual(boundedPose(close),close,`${site.key}: cinematic remains within navigation bounds`);
 assert(Math.hypot(center.x-720,center.y-450)<.002,`${site.key}: camera centers elevated geometry`);
 for(const citywide of [false,true]){
  const sequence=createChoreography({...site,citywide},1000,{...OVERVIEW,zoom:24});
  let last=0;
  for(let ms=0;ms<=sequence.duration*1000+100;ms+=100){
   const sample=sequence.sample(1000+ms);
   assert(sample.progress>=last&&sample.progress<=1&&sample.people>=0&&sample.people<=1,`${site.key}: bounded, monotonic construction`);
   assert(Object.values(sample.pose).every(Number.isFinite));last=sample.progress;
  }
  const end=sequence.sample(1000+sequence.duration*1000+100);assert(end.done);assert.deepEqual(end.pose,sequence.sample(1000+sequence.duration*1000-100).pose,`${site.key}: holds the finished place for inspection`);assert(end.pose.zoom>OVERVIEW.zoom,`${site.key}: completion holds a representative working place`);if(citywide&&!isHeroSchool(site))assert.equal(sequence.sample(2000).pose.zoom,OVERVIEW.zoom,`${site.key}: citywide delivery first establishes its full footprint`);assert.equal(end.progress,1);
 }
}
for(const id of ['M2','M6','M12','M14']){
 const objects=projectObjects({commitments:[{initiativeId:id,scope:'citywide'}],candidate:null,scenarioRevision:1,result:null,comparisonPosition:0},districts);
 assert.equal(objects.length,5);assert.equal(new Set(objects.map(o=>o.district)).size,5);
 for(const progress of [.25,.6,1])assert(projectMesh(objects,false,{zoom:1,scale:324,active:{id,progress},anchors:bootstrap.anchors}).byteLength>0);
}
assert.equal(JSON.stringify(placements),before,'rendering never mutates source placements');
console.log(`PASS 70 placements, ${meshes} meshes, district/citywide timelines and elevated camera focus`);
