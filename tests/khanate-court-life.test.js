import {describe,it,expect} from 'vitest';
import bootstrap from '../src/world/khanate/bootstrap.json';
import {residents} from '../src/modes/khanate/residents';
import {bindCourtResidents,sampleCourtLife,courtResidentTemplate} from '../src/world/khanate/court-life.js';
import {createKhanateMotion} from '../src/world/khanate/motion.js';
import {meshBounds} from '../src/world/khanate/scale.js';
import {makeTemplate} from '../src/world/khanate/models.js';
import {RESIDENT_HEIGHT} from '../src/world/resident-models.js';
import {river} from '../src/world/khanate/geography.js';
import {groundHeight} from '../src/world/khanate/landscape.js';
import {cameraFrame} from '../src/world/projection.js';
import {pointSegment} from '../src/world/placement-geometry.js';

const courts=bindCourtResidents(bootstrap.courtLife,residents);
describe('native daily household court activity',()=>{
 it('reuses unique actual resident identities and physical appearances without adding stories',()=>{
  expect(courts).toHaveLength(52);expect(new Set(courts.map(c=>c.resident.id)).size).toBe(courts.length);
  for(const c of courts){expect(residents).toContain(c.resident);expect(c.resident.home).toBe(c.district);}
  for(const pose of sampleCourtLife(courts,0)){const height=meshBounds(courtResidentTemplate(pose,true)).extent[2];expect(height/RESIDENT_HEIGHT).toBeGreaterThan(.8);expect(height/RESIDENT_HEIGHT).toBeLessThan(1.2);}
 });
 it('keeps short court routes grounded, outside river water and the actual homes',()=>{
  const homes=bootstrap.instances.filter(g=>g.kind==='yurt').flatMap(g=>{const b=meshBounds(makeTemplate(g.kind,g.variant)),radius=Math.hypot(Math.max(Math.abs(b.min[0]),Math.abs(b.max[0])),Math.max(Math.abs(b.min[1]),Math.abs(b.max[1])));return Array.from({length:g.transforms.length/8},(_,i)=>({x:g.transforms[i*8],y:g.transforms[i*8+1],radius:radius*g.transforms[i*8+3]}));});
  for(let t=0;t<=80;t+=.5)for(const p of sampleCourtLife(courts,t)){
   // The same exhaustive samples/strict bounds, without allocating over a
   // million assertion objects during a concurrent full-suite run.
   const z=groundHeight(...p.position)+.00006;
   if(!Number.isFinite(p.position[2])||Math.abs(p.position[2]-z)>=5e-9)throw Error(`${p.id} leaves the ground at ${t}`);
   const water=Math.min(...river.slice(1).map((b,i)=>pointSegment(p.position,river[i],b)));
   if(!(water>.00665))throw Error(`${p.id} enters river clearance at ${t}: ${water}`);
   for(const home of homes){const distance=Math.hypot(p.position[0]-home.x,p.position[1]-home.y);if(!(distance>home.radius+.0001))throw Error(`${p.id} intersects a home at ${t}: ${distance}`);}
  }
 });
 it('shows a river, occupied courts and the existing herd beside the opening sheet, and excludes selected residents',()=>{
  const pose={x:-.04075,y:-.01713,yaw:-.30,pitch:1,zoom:120},frame=cameraFrame(pose,1440,900),view={seconds:1,zoom:frame.rendererZoom,perspective:frame.perspective,rotation:frame.matrix,center:[pose.x,pose.y,0],aspect:1.6,reducedMotion:false,night:0};
  const motion=createKhanateMotion({courts:bootstrap.courtLife,residents});motion.update(view);const stats=motion.diagnostics();
  expect(stats.routedPopulation).toBe(60);expect(stats.courtPopulation).toBe(52);expect(stats.animals).toBeGreaterThanOrEqual(5);expect(stats.people).toBeGreaterThanOrEqual(5);
  const useful=point=>{const p=frame.world(point);return p.visible&&p.x>430&&p.x<1410&&p.y>160&&p.y<770;};
  expect(stats.poses.filter(p=>p.kind==='person'&&useful(p.position)).length).toBeGreaterThanOrEqual(4);
  expect(river.filter(point=>useful([...point,.0001])).length).toBeGreaterThan(0);
  const selected=stats.poses.find(p=>p.residentId);expect(selected).toBeDefined();motion.update({...view,residentIds:[selected.residentId]});expect(motion.diagnostics().poses.some(p=>p.residentId===selected.residentId)).toBe(false);
  const quiet=createKhanateMotion({courts:bootstrap.courtLife,residents});expect(quiet.update({...view,reducedMotion:true})).not.toBeNull();expect(quiet.update({...view,reducedMotion:true,seconds:100})).toBeNull();
 });
});
