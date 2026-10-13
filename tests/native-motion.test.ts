import {describe,it,expect} from 'vitest';
import {RESIDENTS} from '../src/residents/population';
// @ts-expect-error Native mesh authoring modules are exercised directly.
import {Mesh} from '../src/world/mesh-kit.js';
// @ts-expect-error Native mesh authoring modules are exercised directly.
import {residentModel} from '../src/world/resident-models.js';
// @ts-expect-error Native route sampling is shared by both rendering and verification.
import {sampleLife,lifePopulation} from '../src/world/khanate/life.js';
// @ts-expect-error Native mesh authoring modules are exercised directly.
import {lifeTemplate} from '../src/world/khanate/life-models.js';
// @ts-expect-error Native batch upload policy is exercised directly.
import {createKhanateMotion} from '../src/world/khanate/motion.js';

type Actor={id:string;behavior:string;period:number;offset:number;angle:number;position:number[]};
const actors=lifePopulation as Actor[];
const at=(id:string,t:number)=>(sampleLife(t) as Actor[]).find(p=>p.id===id)!;
const turn=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
function body(activity:string,time:number,resident=RESIDENTS[0]!){const mesh=new Mesh();residentModel(mesh,resident,[0,0,0],0,time,activity,true);return new DataView(mesh.pack());}
function displacement(a:DataView,b:DataView){expect(a.byteLength).toBe(b.byteLength);let max=0;for(let i=0;i<a.byteLength;i+=20)for(let j=0;j<3;j++)max=Math.max(max,Math.abs(a.getFloat32(i+j*4,true)-b.getFloat32(i+j*4,true)));return max;}

describe('native motion continuity',()=>{
 it('keeps gesture zero crossings and work-cycle boundaries continuous without extra geometry',()=>{
  for(const activity of ['talk','use','wave','walk'])for(const t of [0,3,Math.PI,12])expect(displacement(body(activity,t-.0001),body(activity,t+.0001))).toBeLessThan(.000001);
  for(const activity of ['idle','point'])expect(displacement(body(activity,0),body(activity,100))).toBe(0);
 });
 it('keeps wheelchair feet planted during travel',()=>{
  const resident=RESIDENTS.find(r=>r.visual.mobility==='wheelchair')!;
  expect(displacement(body('walk',0,resident),body('walk',2,resident))).toBe(0);
 });
 it('turns errands while stopped and eases into route endpoints',()=>{
  for(const actor of actors.filter(a=>a.behavior==='errand'))for(const boundary of [.38,.52,.90,1]){
   const time=actor.period*(1+boundary)-actor.offset,before=at(actor.id,time-.01),after=at(actor.id,time+.01);
   expect(turn(before.angle,after.angle)).toBeLessThan(.001);
   expect(Math.hypot(...after.position.map((p,i)=>p-before.position[i]!))).toBeLessThan(.0000001);
  }
 });
 it('refreshes close detail once when zoom changes during reduced motion',()=>{
  const resident=RESIDENTS[0]!,motion=createKhanateMotion({courts:[{id:'motion-test',district:resident.home,route:[[0,0],[.001,0]],offset:0,period:100}],residents:[resident]});
  const view={seconds:0,zoom:54,rotation:[1,0,0,0,1,0,0,0,1],center:[0,0,0],aspect:1.5,reducedMotion:true};
  expect(motion.update(view)?.byteLength).toBeGreaterThan(0);
  expect(motion.update({...view,seconds:10})).toBeNull();
  expect(motion.update({...view,zoom:56})?.byteLength).toBeGreaterThan(0);
  expect(motion.update({...view,zoom:56,seconds:20})).toBeNull();
 });
 it('freezes reduced motion and night while allowing grazing detail to move in normal time',()=>{
  expect(sampleLife(0,{reducedMotion:true})).toEqual(sampleLife(500,{reducedMotion:true}));
  expect(sampleLife(0,{night:true})).toEqual(sampleLife(500,{night:true}));
  expect(displacement(new DataView(lifeTemplate('horse',0,0,'graze')),new DataView(lifeTemplate('horse',Math.PI/2,0,'graze')))).toBeGreaterThan(.01);
 });
});
