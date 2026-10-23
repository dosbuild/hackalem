import {describe,it,expect} from 'vitest';
import {createChoreography,OVERVIEW} from '../src/world/choreography';
import site from '../src/world/hero-school-site.json';
// @ts-expect-error The native school camera helper is exercised directly.
import {schoolPose} from '../src/world/hero-school';
// @ts-expect-error Native batched mesh module, exercised like the renderer.
import {projectMesh} from '../src/world/project-objects';

describe('directed school scene',()=>{
 it('holds the chosen preview view through confirmation without replaying the wide arrival',()=>{
  const from={...schoolPose(site),yaw:1.67,pitch:.74},c=createChoreography(site,0,from),overview=createChoreography(site,0,OVERVIEW);
  for(let t=0;t<=12000;t+=50){
   const sample=c.sample(t),control=overview.sample(t);
   expect(sample.pose).toEqual(from);expect(sample.progress).toBe(control.progress);expect(sample.done).toBe(control.done);
  }
 });
 it('keeps the camera still for deliveries, holds occupation, and keeps the finished school in view',()=>{
  const c=createChoreography(site,0,OVERVIEW),construction: typeof OVERVIEW[]=[];
  for(let t=0;t<=23000;t+=50){const s=c.sample(t);expect(Object.values(s.pose).every(Number.isFinite)).toBe(true);expect(s.progress).toBeGreaterThanOrEqual(0);expect(s.progress).toBeLessThanOrEqual(1);if(['arrival','build'].includes(s.stage))construction.push(s.pose);}
  expect(construction.length*50).toBeGreaterThanOrEqual(3500);expect(construction.every(p=>JSON.stringify(p)===JSON.stringify(construction[0]))).toBe(true);
  expect(c.sample(2000).progress).toBe(0);expect(c.sample(7000).stage).toBe('people');expect(c.sample(8000).stage).toBe('people');expect(c.sample(10000).pose.zoom).toBeGreaterThan(100);expect(c.sample(10000).pose).toEqual(c.sample(8000).pose);expect(c.sample(10000).done).toBe(true);
 });
 it('produces finite geometry through each lift, landing, exit and settled state at all scales',()=>{
  for(const zoom of [1,8,232])for(const t of [0,3.9,5.2,6.08,6.8,7.5,8.58,9.2,10,11.08,12,12.5,13.5,15,17.9,22,37]){
   const data=projectMesh([{...site,state:'planned'}],false,{zoom,scale:324*zoom,active:{id:'M7',key:site.key,elapsed:t,progress:Math.min(1,t/13)},schoolTime:t,seconds:t});
   expect(data.byteLength,`${zoom}/${t}`).toBeGreaterThan(0);const view=new DataView(data);let valid=true;for(let i=0;i<data.byteLength;i+=20)for(let j=0;j<3;j++)valid&&=Number.isFinite(view.getFloat32(i+j*4,true));expect(valid,`${zoom}/${t}`).toBe(true);
  }
 });
});
