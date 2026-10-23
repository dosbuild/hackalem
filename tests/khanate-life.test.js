import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {sampleLife,lifePopulation} from '../src/world/khanate/life.js';
import {groundHeight,uplands,naturePlaces,landscapeMesh} from '../src/world/khanate/landscape.js';
import {lifeTemplate,appendPose,templateCacheBytes} from '../src/world/khanate/life-models.js';
import {createKhanateMotion} from '../src/world/khanate/motion.js';
import {Mesh} from '../src/world/mesh-kit.js';
import {placements,river} from '../src/world/khanate/geography.js';
import {pointSegment} from '../src/world/placement-geometry.js';
import {makeTemplate} from '../src/world/khanate/models.js';
const identity=[1,0,0,0,1,0,0,0,1];
const view={seconds:0,zoom:2,rotation:identity,center:[0,0,0],aspect:1.6,reducedMotion:false};
function finite(buffer){const d=new DataView(buffer);expect(buffer.byteLength%60).toBe(0);for(let i=0;i<buffer.byteLength;i+=20)for(let axis=0;axis<3;axis++)if(!Number.isFinite(d.getFloat32(i+axis*4,true)))throw Error(`Non-finite vertex ${i/20}`);}
function footprintRadius(buffer){const d=new DataView(buffer);let radius=0;for(let i=0;i<buffer.byteLength;i+=20)radius=Math.max(radius,Math.hypot(d.getFloat32(i,true),d.getFloat32(i+4,true)));return radius;}
describe('The living historical world',()=>{
 it('has distinct native species, errands and six watchable places',()=>{
  expect(new Set(lifePopulation.map(p=>p.kind))).toEqual(new Set(['horse','foal','sheep','lamb','dog','camel','person','bird','eagle']));
  expect(lifePopulation.length).toBe(60);expect(naturePlaces).toHaveLength(6);
  expect(sampleLife(32).filter(p=>p.kind==='person').length).toBeGreaterThan(20);
 });
 it('keeps every civic parcel level while the surrounding ridges rise',()=>{
  for(const p of Object.values(placements))expect(groundHeight(...p.origin)).toBeLessThan(.00001);
  for(const h of uplands){expect(groundHeight(...h.center)).toBeGreaterThan(.002);expect(groundHeight(h.center[0]+h.radii[0]*1.01,h.center[1])).toBeLessThan(.000001);}
  const m=new Mesh();landscapeMesh(m);finite(m.pack());
 });
 it('keeps the complete population out of water, yurts and build parcels over several cycles',()=>{
  const {instances}=JSON.parse(readFileSync('src/world/khanate/bootstrap.json','utf8'));
  const homes=instances.filter(g=>g.kind==='yurt').flatMap(g=>{const radius=footprintRadius(makeTemplate('yurt',g.variant));return Array.from({length:g.transforms.length/8},(_,i)=>[...g.transforms.slice(i*8,i*8+8),radius]);});
  const sites=Object.values(placements).filter(p=>['M4','M7','M8','M9','M13'].includes(p.id));
  const longestPeriod=Math.max(...lifePopulation.map(p=>p.period));
  for(let t=0;t<longestPeriod*2;t+=longestPeriod/600)for(const p of sampleLife(t)){
   if(['bird','eagle'].includes(p.kind))continue;
   const water=Math.min(...river.slice(1).map((b,i)=>pointSegment(p.position,river[i],b)));
   if(water<.008)throw Error(`${p.id} enters water at ${t}`);
   // Actual yurt mesh radius plus a conservative six-unit cast radius. The
   // old fixed 0.0008 margin represented the superseded giant silhouettes.
   for(const h of homes)if(Math.hypot(p.position[0]-h[0],p.position[1]-h[1])<h[8]*h[3]+p.scale*6+.00003)throw Error(`${p.id} enters a yurt at ${t}`);
   for(const s of sites)if(Math.hypot(p.position[0]-s.origin[0],p.position[1]-s.origin[1])<.009)throw Error(`${p.id} enters ${s.key} at ${t}`);
   expect(p.position[2]).toBeCloseTo(groundHeight(...p.position)+.00006,8);
  }
 });
 it('turns and pauses without a positional jump at any cycle boundary',()=>{
  for(const a of lifePopulation){const t=a.period*3-a.offset,before=sampleLife(t-.001).find(p=>p.id===a.id),after=sampleLife(t+.001).find(p=>p.id===a.id);
   expect(Math.hypot(...after.position.map((v,i)=>v-before.position[i]))).toBeLessThan(.00005);
  }
  const period=lifePopulation.find(p=>p.id==='water-carrier').period;
  const states=new Set(Array.from({length:120},(_,t)=>sampleLife(t/120*period).find(p=>p.id==='water-carrier').activity));expect(states).toEqual(new Set(['walk','work','talk']));
 });
 it('uses finite, bounded reusable model poses',()=>{
  for(let t=0;t<64;t++){const m=new Mesh();for(const p of sampleLife(t)){const local=lifeTemplate(p.kind,p.phase,p.variant,p.activity);appendPose(m,local,p.position,p.angle,p.scale);}finite(m.pack());}
  expect(templateCacheBytes()).toBeLessThan(8_000_000);
 });
 it('freezes reduced motion and does not reupload unchanged or hidden life',()=>{
  const motion=createKhanateMotion();expect(motion.update({...view,reducedMotion:true}).byteLength).toBeGreaterThan(0);
  expect(motion.update({...view,seconds:123,reducedMotion:true})).toBeNull();
  const hidden={...view,zoom:288,center:[1,1,0]};expect(motion.update(hidden).byteLength).toBe(0);
  expect(motion.update({...hidden,seconds:123})).toBeNull();
 });
});
