import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {boundedPose,clamp,confinePose} from '../src/world/city-math.js';
import khanate from '../src/world/khanate/definition.js';

// Execute the real handlers against the authored pose from the failing native
// 390×667 M1 proposal. Renderer/DOM timing is covered by the browser regression.
const source=readFileSync(new URL('../src/world/runtime-core.js',import.meta.url),'utf8');
const handlers=['zoom','wheel','move','touchMove','key'].map(name=>{
 const line=source.split('\n').find(s=>s.startsWith(` function ${name}(`));
 if(!line)throw Error('Missing production control '+name);
 return line;
}).join('\n')+'\nfunction rotate(x,y){'+source.match(/rotate\(x,y\)\{([\s\S]*?)\},replay/)[1]+'}';
const original={x:-.004024984089919151,y:-.26910716574876603,yaw:-.24,pitch:1,zoom:19.514769034719126};
function controls(pose=original,maxZoom=576){
 const b=khanate.cameraBounds,constrain=v=>{const p=boundedPose(v,maxZoom);return {...p,x:clamp(p.x,b[0],b[2]),y:clamp(p.y,b[1],b[3])};};
 return new Function('boundedPose','clamp','constrain','pose','maxZoom',`
  let target={...pose},directInput=false;
  const boundCamera=v=>boundedPose(v,maxZoom);
  const interruptFlight=()=>{},overview=()=>{};
  const drag={id:1,orbit:true,x:100,y:100,yaw:pose.yaw,pitch:pose.pitch};
  const pointers=new Map([[1,{x:0,y:0}],[2,{x:100,y:0}]]);
  const pinch={distance:100,angle:0,zoom:pose.zoom,yaw:pose.yaw};
  ${handlers}
  return {zoom,wheel,move,touchMove,key,rotate,pose:()=>({...target})};
 `)(boundedPose,clamp,constrain,pose,maxZoom);
}
describe('manual view controls after short-screen context fitting',()=>{
 for(const [name,action]of [
  ['wheel',c=>c.wheel({preventDefault(){},deltaY:-125})],
  ['button or keyboard zoom',c=>c.zoom(1)],
  ['native orbit drag',c=>c.move({pointerId:1,clientX:200,clientY:80})],
  ['two-finger pinch',c=>c.touchMove({pointerId:2,clientX:125,clientY:0})],
 ])it(name+' retains the existing fitted centre',()=>{
  const c=controls();action(c);const p=c.pose();
  expect([p.x,p.y]).toEqual([original.x,original.y]);
  expect(p).not.toEqual(original);
 });
 it('keeps native wheel zoom exact and obeys the established scale ceiling',()=>{
  const c=controls();c.wheel({preventDefault(){},deltaY:-125});
  expect(c.pose().zoom).toBe(25.05745944137026);
  const upper=controls({...original,zoom:570});upper.zoom(1);expect(upper.pose().zoom).toBe(576);
  const lower=controls({...original,zoom:1});lower.zoom(-1);expect(lower.pose().zoom).toBe(1);
 });
 for(const [name,action]of [
  ['wheel',c=>c.wheel({preventDefault(){},deltaY:-125})],
  ['button',c=>c.zoom(1)],
  ['public rotate',c=>c.rotate(.2,-.1)],
  ['orbit drag',c=>c.move({pointerId:1,clientX:200,clientY:80})],
  ['pinch',c=>c.touchMove({pointerId:2,clientX:125,clientY:0})],
  ['keyboard pan',c=>c.key({key:'ArrowLeft',preventDefault(){}})],
 ])it(name+' preserves the explicit encounter ceiling without broadening ordinary controls',()=>{
  const c=controls({...original,zoom:1700},2304);action(c);expect(c.pose().zoom).toBeGreaterThan(576);expect(c.pose().zoom).toBeLessThanOrEqual(2304);
  const upper=controls({...original,zoom:2300},2304);upper.zoom(1);expect(upper.pose().zoom).toBe(2304);
 });
 it('forwards an explicit encounter ceiling through geographic confinement',()=>{
  const pose={...original,zoom:1800},districts=khanate.bootstrap.districts.features;
  expect(confinePose(pose,districts,2304).zoom).toBe(1800);expect(confinePose(pose,districts).zoom).toBe(576);
 });
 it('continues to confine actual keyboard panning to the world',()=>{
  const c=controls();c.key({key:'ArrowDown',preventDefault(){}});
  expect(c.pose().y).toBe(khanate.cameraBounds[1]);
  expect(c.pose().zoom).toBe(original.zoom);
 });
});
