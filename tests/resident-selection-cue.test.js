import {describe,it,expect} from 'vitest';
import {Mesh} from '../src/world/mesh-kit.js';
import {residentModel,residentsMesh,RESIDENT_HEIGHT} from '../src/world/resident-models.js';
import {cameraFrame} from '../src/world/projection.js';

const resident={id:'selected-native',signature:false,visual:{era:'astana',build:'regular',mobility:'walk',coat:'#944632',accent:'#e3c59e',skin:'#c99c7d',hair:'#303434',cut:'long',head:'bob',prop:'book'}};
const position=[-.022058736095072314,-.5210918441807739,.00004];
const actor=(activity='idle',overrides={})=>({resident,position,angle:1.3,activity,...overrides});
const sameBytes=(actual,expected)=>expect(Buffer.from(actual).equals(Buffer.from(expected))).toBe(true);
const bodies=(actors,seconds,zoom)=>{const mesh=new Mesh();for(const a of actors)residentModel(mesh,a.resident,a.position,a.angle,seconds,a.activity,zoom>=55);return mesh.pack();};
function ring(actors,seconds=4,zoom=160){const unchanged=bodies(actors,seconds,zoom),actual=residentsMesh(actors,seconds,zoom);sameBytes(actual.slice(0,unchanged.byteLength),unchanged);return actual.slice(unchanged.byteLength);}
function vertices(buffer){const view=new DataView(buffer);return Array.from({length:buffer.byteLength/20},(_,i)=>[view.getFloat32(i*20,true),view.getFloat32(i*20+4,true),view.getFloat32(i*20+8,true)]);}
function containsOrigin(triangle,origin){const signs=triangle.map((a,i)=>{const b=triangle[(i+1)%3];return Math.sign((b[0]-a[0])*(origin[1]-a[1])-(b[1]-a[1])*(origin[0]-a[0]));});return signs.every(s=>s>=0)||signs.every(s=>s<=0);}

describe('selected native resident ground cue',()=>{
 it('leaves every unselected actor byte unchanged across the existing detail threshold',()=>{
  const actors=[actor(),actor('walk',{position:[-.023,-.521,.00005],angle:-.4}),actor('use',{resident:{...resident,id:'neighbor'}})];
  for(const zoom of [18,54.9,55,576,2304])for(const seconds of [0,4,13])sameBytes(residentsMesh(actors,seconds,zoom),bodies(actors,seconds,zoom));
  expect(residentsMesh([actor('talk')],4,17.9).byteLength).toBe(0);
 });
 it('appends a bounded cue after the exact selected and neighboring body geometry',()=>{
  for(const zoom of [18,160,2304]){
   const actors=[actor('idle',{position:[-.023,-.521,.00005]}),actor('talk'),actor('walk',{position:[-.021,-.52,.00004]})],cue=ring(actors,4,zoom);
   expect(cue.byteLength).toBe(144*20);
   for(const p of vertices(cue)){expect(Math.hypot(p[0]-position[0],p[1]-position[1])).toBeGreaterThan(RESIDENT_HEIGHT*.13);expect(Math.hypot(p[0]-position[0],p[1]-position[1])).toBeLessThan(RESIDENT_HEIGHT*.181);expect(p[2]).toBeCloseTo(position[2]+.000001,10);}
  }
 });
 it('keeps the cue hollow and grounded in the same depth-tested physical mesh',()=>{
  const cue=ring([actor('talk')]),points=vertices(cue),view=new DataView(cue);
  for(let i=0;i<points.length;i+=3)expect(containsOrigin(points.slice(i,i+3),position)).toBe(false);
  for(let i=0;i<points.length;i++){expect(view.getInt8(i*20+14)).toBe(127);expect(view.getUint8(i*20+18)).toBe(8);}
 });
 it('uses the actual clicked actor position, independent of body angle, animation and build',()=>{
  const selected=actor('talk',{position:[.07,-.13,.00008]}),first=ring([selected],0),later=ring([{...selected,angle:-2.4,resident:{...resident,visual:{...resident.visual,build:'tall'}}}],13);
  sameBytes(later,first);
  for(const p of vertices(first))expect(p[2]).toBeCloseTo(selected.position[2]+.000001,10);
 });
 it('adds at most one cue even if a malformed runtime cast contains two talk poses',()=>{
  expect(ring([actor('talk'),actor('talk',{position:[.07,-.13,.00008]})]).byteLength).toBe(144*20);
 });
 it('stays quiet at the actual native 32px phone encounter scale',()=>{
  const pose={x:-.022272663214151927,y:-.5221575473011493,yaw:-.12,pitch:.78,zoom:1640.0086463694017},frame=cameraFrame(pose,390,667),points=vertices(ring([actor('talk')])).map(frame.world),diameter=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x));
  expect(diameter).toBeGreaterThanOrEqual(12);expect(diameter).toBeLessThanOrEqual(16);expect(points.every(p=>p.visible)).toBe(true);
 });
});
