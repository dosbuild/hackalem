import {describe,it,expect} from 'vitest';
import {projectZoomChanged} from '../src/world/runtime-core.js';
import {projectMesh,placements} from '../src/world/project-objects.js';
import {projectMesh as khanateMesh,placements as khanatePlacements} from '../src/world/khanate/projects.js';

const equal=(actual,expected)=>expect(Buffer.from(actual).equals(Buffer.from(expected))).toBe(true);
describe('project geometry zoom invalidation',()=>{
 it('retains continuously pixel-scaled macro geometry and exact representation crossings',()=>{
  expect(projectZoomChanged(3,3.1)).toBe(true);
  expect(projectZoomChanged(3,3.001)).toBe(false);
  for(const [before,after] of [[11.9999,12],[14,14.0001],[14.9999,15],[17.9999,18],[18,18.0001]]){
   expect(projectZoomChanged(before,after)).toBe(true);expect(projectZoomChanged(after,before)).toBe(true);
  }
 });
 it('keeps close physical bytes invariant across zoom and projection scale in both worlds',()=>{
  const keys=['M4:esil','M1:almaty','M8:nura','M10:saryarka',...['esil','almaty','saryarka','baikonur','nura'].map(d=>`M14:${d}`)];
  for(const [build,sites] of [[projectMesh,placements],[khanateMesh,khanatePlacements]]){
   const objects=keys.map(key=>({...sites[key],proposal:false,state:'planned',progress:1}));
   const expected=build(objects,false,{zoom:19,scale:6156,seconds:4});
   for(const zoom of [23,24.001,160]){
    expect(projectZoomChanged(19,zoom)).toBe(false);equal(build(objects,false,{zoom,scale:324*zoom,seconds:4}),expected);
   }
  }
 });
 it('updates the genuine hero-school close threshold even for tiny zoom changes',()=>{
  const school={...placements['M7:nura'],proposal:false,state:'planned',progress:1};
  const at=zoom=>projectMesh([school],false,{zoom,seconds:4,schoolTime:30,preview:true});
  expect(projectZoomChanged(24,24.0001,true)).toBe(true);expect(projectZoomChanged(24.0001,24,true)).toBe(true);
  expect(projectZoomChanged(24,24.0001,false)).toBe(false);
  expect(Buffer.from(at(24)).equals(Buffer.from(at(24.0001)))).toBe(false);
  equal(at(24.0001),at(160));
 });
 it('still emits changed construction and live motion at a stable close zoom',()=>{
  const object={...placements['M4:esil'],proposal:false,state:'planned',progress:1};
  const at=(progress,seconds)=>projectMesh([object],false,{zoom:160,seconds,activities:progress<1?{M4:{id:'M4',key:object.key,progress}}:{}});
  expect(Buffer.from(at(.2,4)).equals(Buffer.from(at(.8,4)))).toBe(false);
  expect(Buffer.from(at(1,4)).equals(Buffer.from(at(1,5)))).toBe(false);
 });
});
