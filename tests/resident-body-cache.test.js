import {afterEach,describe,it,expect,vi} from 'vitest';
import {Mesh} from '../src/world/mesh-kit.js';
import {residentModel,residentsMesh} from '../src/world/resident-models.js';
import {RESIDENTS} from '../src/residents/population';
import {residents as khanateResidents} from '../src/modes/khanate/residents';

const actor=(id,activity='idle',resident=RESIDENTS[0])=>({resident:{...resident,id},position:[.0123,-.0456,.00008],angle:1.3,activity});
const direct=(actors,seconds,zoom)=>{const m=new Mesh();for(const a of actors)residentModel(m,a.resident,a.position,a.angle,seconds,a.activity,zoom>=55);return m.pack();};
const equal=(actual,expected)=>expect(Buffer.from(actual).equals(Buffer.from(expected))).toBe(true);
afterEach(()=>vi.restoreAllMocks());

describe('bounded exact still resident bodies',()=>{
 it('reuses time-independent idle and point bodies in both worlds with exact bytes',()=>{
  for(const [i,resident] of [RESIDENTS[0],khanateResidents[0],RESIDENTS.find(r=>r.visual.mobility==='wheelchair')].filter(Boolean).entries()){
   for(const activity of ['idle','point'])for(const zoom of [18,55]){
    const a=actor(`still-${i}-${activity}-${zoom}`,activity,resident),expected=direct([a],4,zoom),shape=vi.spyOn(Mesh.prototype,'ellipsoid');
    equal(residentsMesh([a],4,zoom),expected);expect(shape).toHaveBeenCalled();shape.mockClear();
    equal(residentsMesh([a],81,zoom),expected);expect(shape).not.toHaveBeenCalled();shape.mockRestore();
   }
  }
 });
 it('invalidates changed appearance, signature, placement, angle, pose and detail',()=>{
  const a=actor('still-invalidation');residentsMesh([a],4,54.9);
  const variants=[
   {...a,resident:{...a.resident,visual:{...a.resident.visual,coat:'#843d32'}}},
   {...a,resident:{...a.resident,signature:!a.resident.signature}},
   {...a,position:[.0124,-.0456,.00009]},
   {...a,angle:-.7},
   {...a,activity:'point'},
  ];
  for(const changed of variants)equal(residentsMesh([changed],9,54.9),direct([changed],9,54.9));
  equal(residentsMesh([a],9,55),direct([a],9,55));
  expect(residentsMesh([a],9,17.9).byteLength).toBe(0);
 });
 it('preserves every animated body frame and the selected-person cue after cached neighbors',()=>{
  const still=actor('still-neighbor');residentsMesh([still],4,160);
  for(const activity of ['walk','talk','wave','use']){
   const moving=actor(`animated-${activity}`,activity,khanateResidents[0]),actors=[still,moving];
   for(const seconds of [.1,1.5,4]){
    const expected=direct(actors,seconds,160),actual=residentsMesh(actors,seconds,160);
    equal(actual.slice(0,expected.byteLength),expected);
    expect(actual.byteLength-expected.byteLength).toBe(activity==='talk'?144*20:0);
   }
   expect(Buffer.from(direct([moving],.1,160)).equals(Buffer.from(direct([moving],4,160)))).toBe(false);
  }
 });
 it('owns the returned snapshot and bounds residency while a still actor changes position',()=>{
  const a=actor('still-eviction'),expected=direct([a],4,160),returned=residentsMesh([a],4,160);
  new Uint8Array(returned).fill(0);equal(residentsMesh([a],9,160),expected);
  for(let i=1;i<=33;i++)residentsMesh([{...a,position:[a.position[0]+i*.00001,a.position[1],a.position[2]]}],4,160);
  const shape=vi.spyOn(Mesh.prototype,'ellipsoid');equal(residentsMesh([a],4,160),expected);expect(shape).toHaveBeenCalled();
 });
});
