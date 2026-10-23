import {describe,it,expect} from 'vitest';
import {Mesh} from '../src/world/mesh-kit.js';
import {residentModel} from '../src/world/resident-models.js';
import {residents} from '../src/modes/khanate/residents';
import {projectMesh,placements,projectFocusBounds,projectPreviewFrame} from '../src/world/khanate/projects.js';
import {meshBounds} from '../src/world/khanate/scale.js';
import {closePose,eventPose} from '../src/world/khanate/choreography.js';

const sites=Object.values(placements).filter(site=>site.id==='M11');
const contains=(view,bounds)=>{for(const axis of [0,1,2]){expect(bounds.min[axis]).toBeGreaterThanOrEqual(view.min[axis]-1e-8);expect(bounds.max[axis]).toBeLessThanOrEqual(view.max[axis]+1e-8);}};
describe('family crossing primary place',()=>{
 it('keeps both banks in the real full model while framing the existing west guides and people',()=>{
  expect(sites).toHaveLength(5);
  for(const site of sites){
   const packed=projectMesh([{...site,proposal:false}],false,{seconds:4}),full=meshBounds(packed),view=site.view.focus,data=new DataView(packed),near=[];
   expect(full.min).toEqual(site.view.min);expect(full.max).toEqual(site.view.max);
   expect(full.extent[0]).toBeGreaterThan(.01599);expect(view.extent[0]).toBeLessThan(.00201);
   for(let at=0;at<data.byteLength;at+=20)if(data.getUint8(at+18)===8&&data.getFloat32(at,true)<site.origin[0]-.0065)near.push([0,1,2].map(axis=>data.getFloat32(at+axis*4,true)));
   expect(near).toHaveLength(120);
   contains(view,{min:[0,1,2].map(axis=>Math.min(...near.map(p=>p[axis]))),max:[0,1,2].map(axis=>Math.max(...near.map(p=>p[axis])))});
   for(const spot of site.peopleSpots.slice(0,3))contains(view,{min:spot.position,max:spot.position});
   expect(site.peopleSpots.slice(3).every(spot=>spot.position[0]>view.max[0]+.01)).toBe(true);
   expect(projectPreviewFrame(site)).toBe(view);expect(projectFocusBounds(site)).toHaveLength(8);
   for(const axis of [0,1,2]){expect(Math.min(...projectFocusBounds(site).map(p=>p[axis]))).toBe(view.min[axis]);expect(Math.max(...projectFocusBounds(site).map(p=>p[axis]))).toBe(view.max[axis]);}
   const pose=closePose(site);expect(pose.x).toBe(view.center[0]);expect(pose.y).toBe(view.center[1]);expect(pose.zoom).toBe(280);expect(eventPose(site)).toEqual(pose);
  }
 });
 it('fits the native selected resident and nearby cast during their actual use and conversation poses',()=>{
  for(const site of sites){
   const cast=['M11','M2','M10'].map(id=>residents.find(r=>r.location===site.district&&r.primary===id));
   expect(cast[0].id).toBe('khanate-story-'+site.district+'-M11');
   for(const [i,resident] of cast.entries())for(const seconds of [0,1.25,4,10])for(const activity of [i===0?'talk':'idle',i===0?'use':i%3?'idle':'walk']){
    const spot=site.peopleSpots[i],m=new Mesh();residentModel(m,resident,spot.position,spot.angle+(activity==='walk'?Math.PI/2:0),seconds,activity,true);contains(site.view.focus,meshBounds(m.pack()));
   }
  }
 });
 it('retains both crossing endpoints and the same preparation through construction',()=>{
  for(const site of sites){
   const object={...site,proposal:false},complete=projectMesh([object],false,{seconds:4}),proposal=projectMesh([{...site,proposal:true}],false,{seconds:4});
   expect(meshBounds(proposal).min).toEqual(site.view.min);expect(meshBounds(proposal).max).toEqual(site.view.max);
   for(const progress of [0,.2,.5,.9,1]){const packed=projectMesh([object],false,{seconds:4,active:{id:'M11',progress}}),data=new DataView(packed);for(let at=0;at<packed.byteLength;at+=20)for(const axis of [0,1,2])expect(Number.isFinite(data.getFloat32(at+axis*4,true))).toBe(true);if(progress===1)expect(Buffer.from(packed)).toEqual(Buffer.from(complete));}
  }
 });
});
