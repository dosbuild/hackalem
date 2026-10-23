import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {Mesh} from '../src/world/mesh-kit.js';
import {RESIDENT_HEIGHT} from '../src/world/resident-models.js';
import {makeTemplate} from '../src/world/khanate/models.js';
import {projectMesh,projectFocusBounds,placements,cartRoutePose} from '../src/world/khanate/projects.js';
import {landmarkModel} from '../src/world/khanate/landmark-models.js';
import {landmarks} from '../src/world/khanate/geography.js';
import {sampleLife} from '../src/world/khanate/life.js';
import {lifeTemplate} from '../src/world/khanate/life-models.js';
import {meshBounds} from '../src/world/khanate/scale.js';

const bootstrap=JSON.parse(readFileSync('src/world/khanate/bootstrap.json','utf8'));
const layout=JSON.parse(readFileSync('src/world/khanate/settlement-layout.json','utf8'));
describe('coherent inhabited historical places',()=>{
 it('retains all households and instances with homes, props and life at native body scale',()=>{
  expect(layout.homes).toHaveLength(188);expect(new Set(layout.homes.map(h=>h.id)).size).toBe(188);
  const counts={};for(const g of bootstrap.instances){counts[g.kind]=(counts[g.kind]??0)+g.transforms.length/8;const height=meshBounds(makeTemplate(g.kind,g.variant)).extent[2];for(let i=0;i<g.transforms.length;i+=8){const worldHeight=height*g.transforms[i+3];if(g.kind==='keeper'){expect(g.transforms[i+3]).toBe(1);expect(worldHeight/RESIDENT_HEIGHT).toBeGreaterThan(.9);expect(worldHeight/RESIDENT_HEIGHT).toBeLessThan(1.1);}if(g.kind==='yurt'){expect(worldHeight/RESIDENT_HEIGHT).toBeGreaterThan(2);expect(worldHeight/RESIDENT_HEIGHT).toBeLessThan(3.2);}}}
  expect(counts).toEqual({keeper:42,yurt:188,tree:164,well:15,cart:3,camel:4,horse:4});
  for(const p of sampleLife(32).filter(p=>p.kind==='person')){const height=meshBounds(lifeTemplate(p.kind,p.phase,p.variant,p.activity)).extent[2]*p.scale;expect(height/RESIDENT_HEIGHT).toBeGreaterThan(.55);expect(height/RESIDENT_HEIGHT).toBeLessThan(1.25);}
 });
 it('fits every project from measured meshes and keeps its people at the physical place',()=>{
  expect(Object.keys(placements)).toHaveLength(70);
  for(const site of Object.values(placements)){
   const actual=meshBounds(projectMesh([{...site,proposal:false}],false,{seconds:4,zoom:280}));
   expect(site.view.min).toEqual(actual.min);expect(site.view.max).toEqual(actual.max);expect(site.view.zoom).toBeGreaterThanOrEqual(30);expect(site.view.zoom).toBeLessThanOrEqual(280);
   expect(projectFocusBounds(site)).toHaveLength(8);expect(site.peopleSpots).toHaveLength(6);
   for(const spot of site.peopleSpots)for(const axis of [0,1]){expect(spot.position[axis]).toBeGreaterThan(actual.min[axis]-.0005);expect(spot.position[axis]).toBeLessThan(actual.max[axis]+.0005);}
   const preview=meshBounds(projectMesh([{...site,proposal:true,progress:0}],false,{seconds:4,zoom:280}));for(const axis of [0,1,2]){expect(preview.min[axis]).toBeCloseTo(actual.min[axis],7);expect(preview.max[axis]).toBeCloseTo(actual.max[axis],7);}
  }
 });
 it('keeps the bridge span and ferry banks while using smaller physical details',()=>{
  const bridge=landmarks.find(l=>l.id==='atyrau'),m=new Mesh();landmarkModel(m,bridge);const data=new DataView(m.pack()),along=[];
  for(let i=0;i<data.byteLength;i+=20)along.push((data.getFloat32(i,true)-bridge.point[0])*Math.sin(.55)+(data.getFloat32(i+4,true)-bridge.point[1])*Math.cos(.55));
  expect(Math.max(...along)-Math.min(...along)).toBeGreaterThan(.0169);
  const ferry=landmarks.find(l=>l.id==='esil-bridges'),f=new Mesh();landmarkModel(f,ferry);const bounds=meshBounds(f.pack());expect(bounds.min[1]).toBeLessThan(ferry.point[1]-.009);expect(bounds.max[1]).toBeGreaterThan(ferry.point[1]+.009);
  for(const l of bootstrap.metadata.landmarks){const model=new Mesh();landmarkModel(model,l);const b=meshBounds(model.pack());expect(l.bounds).toEqual(b);expect(l.heightM).toBeCloseTo((b.max[2]-.00006)*12000,8);expect(l.zoom).toBeGreaterThanOrEqual(65);expect(l.zoom).toBeLessThanOrEqual(280);}
 });
 it('returns route carts along the original road without jumping at turns or wrap',()=>{
  const route=placements['M3:esil'].route;
  for(const fraction of [.44,.52,.96,1]){const seconds=(fraction-.16)*720,a=cartRoutePose(route,seconds-.001),b=cartRoutePose(route,seconds+.001);expect(Math.hypot(...a.point.map((v,i)=>v-b.point[i]))).toBeLessThan(.000001);expect(Math.abs(Math.sin(a.angle)-Math.sin(b.angle))).toBeLessThan(.0001);expect(Math.abs(Math.cos(a.angle)-Math.cos(b.angle))).toBeLessThan(.0001);}
 });
});
