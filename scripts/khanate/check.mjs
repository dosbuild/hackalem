import assert from 'node:assert/strict';
import {contains} from '../../src/world/city-math.js';
import {districts,landmarks,placements} from '../../src/world/khanate/geography.js';
import {projectObjects,projectMesh} from '../../src/world/khanate/projects.js';
import {makeTemplate} from '../../src/world/khanate/models.js';
import {Mesh} from '../../src/world/mesh-kit.js';
import {landmarkModel} from '../../src/world/khanate/landmark-models.js';
import {createChoreography,OVERVIEW} from '../../src/world/khanate/choreography.js';
import {readFile} from 'node:fs/promises';
import {meshBounds} from '../../src/world/khanate/scale.js';
const ids=['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12','M13','M14'];
assert.equal(Object.keys(placements).length,70);assert.equal(landmarks.length,14);
function finite(buffer,label){assert.equal(buffer.byteLength%60,0,label);const view=new DataView(buffer);for(let i=0;i<buffer.byteLength;i+=20)for(let k=0;k<3;k++)assert(Number.isFinite(view.getFloat32(i+k*4,true)),label);}
for(const kind of ['yurt','tree','cart','lantern','well','horse','camel']){const data=makeTemplate(kind);assert(data.byteLength>0);finite(data,kind);}
for(const landmark of landmarks){const mesh=new Mesh();landmarkModel(mesh,landmark);const packed=mesh.pack();assert(packed.byteLength>0);finite(packed,landmark.id);}
for(const site of Object.values(placements)){
 assert(contains(districts.features.find(d=>d.id===site.district).geometry,site.position),site.key);
 const decision={initiativeId:site.id,scope:['M2','M6','M12','M14'].includes(site.id)?'citywide':'district',districtId:site.district};
 const objects=projectObjects({commitments:[decision],candidate:null,result:null,comparisonPosition:0},districts.features);
 assert.equal(objects.length,decision.scope==='citywide'?5:1);
 for(const progress of [0,.15,.4,.7,1]){const buffer=projectMesh(objects,false,{seconds:3,zoom:75,active:{id:site.id,progress}});finite(buffer,`${site.key}/${progress}`);if(progress===1)assert(buffer.byteLength>0,site.key);}
 const sequence=createChoreography({...site,citywide:decision.scope==='citywide'},1000,OVERVIEW);let previous=0;
 for(let t=1000;t<=14000;t+=100){const sample=sequence.sample(t);assert(sample.progress>=previous&&sample.progress<=1);assert(Object.values(sample.pose).every(Number.isFinite));previous=sample.progress;}
 assert(sequence.sample(14000).done);
 const measured=meshBounds(projectMesh([{...site,proposal:false}],false,{seconds:4,zoom:280}));assert.deepEqual(site.view?.min,measured.min,`Regenerate camera bounds for ${site.key}`);assert.deepEqual(site.view?.max,measured.max,`Regenerate camera bounds for ${site.key}`);
}
assert.equal(new Set(Object.values(placements).map(p=>p.id)).size,ids.length);
const bootstrap=JSON.parse(await readFile(new URL('../../src/world/khanate/bootstrap.json',import.meta.url),'utf8'));assert.equal(bootstrap.metadata.buildingFeatures,188);assert.equal(bootstrap.instances.reduce((n,g)=>n+g.transforms.length/8,0),420);
console.log('PASS historical templates, 70 measured project sites, 350 construction meshes, 188 homes/420 instances, citywide coverage and bounded timelines');
