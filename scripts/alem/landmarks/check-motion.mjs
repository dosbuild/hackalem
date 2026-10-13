import assert from 'node:assert/strict';
import {createLrtMotion,sampleLrtTrainPose,LRT_MOTION_DIMENSIONS as dimensions} from '../../../src/world/lrt-motion.js';
import {lrtAt,LRT_SCALE,LRT_STATIONS} from '../../../src/world/lrt-route.js';

const near=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const rotation=[1,0,0,0,1,0,0,0,1];
const station=LRT_STATIONS.find(s=>s.name.includes('Байтерек'));
assert.ok(station,'Baiterek station exists in surveyed route');
const center=[...lrtAt(station.distance).point,0],view={zoom:90,rotation,center,aspect:1.5};

// Route placement is geographic, the two directions use opposite actual rails,
// and the four car centres retain their 15.1 m longitudinal spacing.
for(const direction of [-1,1]){
 const pose=sampleLrtTrainPose(20750,direction);
 assert.equal(pose.cars.length,4);assert.equal(pose.joints.length,3);
 near(pose.offset,-direction*2.1);
 for(let i=0;i<pose.cars.length;i++){
  const car=pose.cars[i],track=lrtAt(car.distance,pose.offset);
  near(car.point[0],track.point[0]);near(car.point[1],track.point[1]);
  near(car.point[2]+dimensions.wheelBottomM*LRT_SCALE,.00006+dimensions.railHeightM*LRT_SCALE);
  if(i)near((car.distance-pose.cars[i-1].distance)*direction,dimensions.carSpacingM,1e-8);
 }
 const angles=pose.cars.map(c=>c.angle);
 assert.ok(Math.max(...angles)-Math.min(...angles)>.05,'cars articulate independently on route bend');
 for(const joint of pose.joints){assert.ok(Number.isFinite(joint.angle));assert.ok(joint.stretch>.1&&joint.stretch<1.5,'bellows fills the inter-car gap');}
}

const motion=createLrtMotion();
assert.equal(motion.update({...view,zoom:17,seconds:0}),null,'distant camera does not allocate upload');
let data=motion.update({...view,seconds:0});assert.ok(data instanceof ArrayBuffer&&data.byteLength>0);
const initial=new Uint8Array(data.slice(0)),report=motion.diagnostics();
assert.equal(report.visibleTrains,2);assert.equal(report.visibleCars,8);
assert.deepEqual(report.trains.filter(t=>t.visible).map(t=>t.direction).sort(),[-1,1]);
assert.equal(report.vertices,data.byteLength/20);assert.equal(report.vertices/3,8576);
let low=Infinity,high=-Infinity;
const packed=new DataView(data);
for(let at=0;at<data.byteLength;at+=20){
 for(let axis=0;axis<3;axis++)assert.ok(Number.isFinite(packed.getFloat32(at+axis*4,true)));
 const z=packed.getFloat32(at+8,true);low=Math.min(low,z);high=Math.max(high,z);
 const normal=Math.hypot(...[0,1,2].map(axis=>packed.getInt8(at+12+axis)));
 assert.ok(normal>125&&normal<129,'rotated byte normals retain unit length');
 assert.ok([8,23,25].includes(packed.getUint8(at+18)),'train uses the intended physical-scale materials');
}
near(low,.00006+dimensions.railHeightM*LRT_SCALE,1e-9);
assert.ok(high>low+3.5*LRT_SCALE&&high<low+3.7*LRT_SCALE);
assert.equal(motion.update({...view,seconds:0}),null,'same pose does not re-upload');
assert.equal(motion.update({...view,seconds:.001}),null,'sub-tick pose does not re-upload');
data=motion.update({...view,seconds:.2});assert.ok(data?.byteLength);assert.notDeepEqual(new Uint8Array(data),initial,'running trains change packed positions');
assert.equal(motion.update({...view,center:[50,50,0],seconds:.3}).byteLength,0,'leaving viewport clears layer');
assert.equal(motion.update({...view,center:[50,50,0],seconds:.4}),null,'empty viewport remains cached');
assert.ok(motion.update({...view,seconds:.5})?.byteLength);
assert.equal(motion.update({...view,zoom:17,seconds:.6}).byteLength,0,'zooming out clears layer');
assert.equal(motion.update({...view,zoom:17,seconds:.7}),null);

const still=createLrtMotion();
assert.ok(still.update({...view,seconds:123,reducedMotion:true})?.byteLength);
assert.equal(still.diagnostics().seconds,0);
assert.equal(still.update({...view,seconds:987,reducedMotion:true}),null,'reduced motion freezes without repeated uploads');
const limited=createLrtMotion({maxVisibleTrains:1});assert.ok(limited.update({...view,seconds:0})?.byteLength);assert.equal(limited.diagnostics().visibleTrains,1);
console.log('LRT motion contracts pass: physical rail contact, articulated cars, finite packed geometry, both directions, culling, frame reuse, reduced motion.');
