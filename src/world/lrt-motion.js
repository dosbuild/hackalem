import {Mesh} from './mesh-kit.js';
import {lrtCar} from './lrt-model.js';
import {LRT_LENGTH,LRT_SCALE,LRT_STATIONS,lrtAt} from './lrt-route.js';
import {visibleBounds} from './render-policy.js';

const STRIDE=20,CAR_LENGTH=14.7,CAR_SPACING=15.1,CAR_OFFSETS=[-22.65,-7.55,7.55,22.65];
// The decagonal wheel has a flat lower facet, not a vertex at its circle nadir.
const RAIL_METRES=10.22,WHEEL_BOTTOM=.45-.38*Math.cos(Math.PI/10),TRAIN_BASE_METRES=RAIL_METRES-WHEEL_BOTTOM;
const DEFAULT_GROUND=.00006,MIN_ZOOM=18;
let sharedTemplates;

function template(mesh){
 const packed=mesh.pack(),view=new DataView(packed),count=packed.byteLength/STRIDE;
 const positions=new Float32Array(count*3),normals=new Int8Array(count*3);
 for(let i=0;i<count;i++)for(let axis=0;axis<3;axis++){
  positions[i*3+axis]=view.getFloat32(i*STRIDE+axis*4,true);
  normals[i*3+axis]=view.getInt8(i*STRIDE+12+axis);
 }
 return {bytes:new Uint8Array(packed),positions,normals,count};
}

function templates(){
 if(sharedTemplates)return sharedTemplates;
 const car=options=>{const mesh=new Mesh();mesh.kind=8;lrtCar(mesh,options);return template(mesh);};
 const joint=new Mesh();joint.kind=8;
 joint.box(0,0,.82,1,2.32,2.3,'#354c53');
 for(const x of [-.42,-.21,0,.21,.42])joint.box(x,0,.87,.035,2.41,2.2,'#728b8a');
 const rear=car({cab:true,flip:true}),middle=car({}),front=car({cab:true});
 sharedTemplates={cars:[rear,middle,middle,front],joint:template(joint)};
 sharedTemplates.bytes=sharedTemplates.cars.reduce((sum,t)=>sum+t.bytes.length,0)+sharedTemplates.joint.bytes.length*3;
 return sharedTemplates;
}

/** Four rigid cars on the actual route, with a flexible joint between each.
 * Route distance is metres; points and bounds use the shared city frame.
 */
export function sampleLrtTrainPose(distance,direction=1,ground=DEFAULT_GROUND){
 const sign=direction<0?-1:1,offset=-sign*2.1,base=ground+TRAIN_BASE_METRES*LRT_SCALE;
 const cars=CAR_OFFSETS.map(local=>{
  const d=Math.max(CAR_LENGTH/2,Math.min(LRT_LENGTH-CAR_LENGTH/2,distance+sign*local));
  const sample=lrtAt(d,offset),a=lrtAt(d-CAR_LENGTH*.5,offset).point,b=lrtAt(d+CAR_LENGTH*.5,offset).point;
  // A wheelbase chord smooths the surveyed polyline's vertex tangents while
  // retaining the car centre exactly on its running rail.
  const angle=Math.atan2(b[1]-a[1],b[0]-a[0])+(sign<0?Math.PI:0);
  return {distance:d,point:[sample.point[0],sample.point[1],base],angle,cos:Math.cos(angle),sin:Math.sin(angle)};
 });
 const joints=cars.slice(0,-1).map((a,i)=>{
  const b=cars[i+1],half=CAR_LENGTH/2*LRT_SCALE;
  const p=[a.point[0]+a.cos*half,a.point[1]+a.sin*half],q=[b.point[0]-b.cos*half,b.point[1]-b.sin*half];
  const dx=q[0]-p[0],dy=q[1]-p[1],angle=Math.atan2(dy,dx);
  return {point:[(p[0]+q[0])/2,(p[1]+q[1])/2,base],angle,cos:Math.cos(angle),sin:Math.sin(angle),stretch:Math.hypot(dx,dy)/LRT_SCALE+.10};
 });
 const bounds=[Infinity,Infinity,-Infinity,-Infinity,ground+RAIL_METRES*LRT_SCALE,base+3.68*LRT_SCALE];
 for(const car of cars)for(const x of [-7.4,7.4])for(const y of [-1.65,1.65]){
  const px=car.point[0]+(x*car.cos-y*car.sin)*LRT_SCALE,py=car.point[1]+(x*car.sin+y*car.cos)*LRT_SCALE;
  bounds[0]=Math.min(bounds[0],px);bounds[1]=Math.min(bounds[1],py);bounds[2]=Math.max(bounds[2],px);bounds[3]=Math.max(bounds[3],py);
 }
 return {distance,direction:sign,offset,cars,joints,bounds};
}

// Trapezoidal speed profile: accelerate and brake over four seconds, then dwell
// at each mapped station. Terminal dwell reverses the service.
function service(speed=12,dwell=12){
 const stations=LRT_STATIONS.filter(s=>s.distance>31&&s.distance<LRT_LENGTH-31);
 const stops=stations.length>1?stations:[{distance:33,name:'start'},{distance:LRT_LENGTH-33,name:'end'}];
 const legs=[],visits=[];let duration=0;
 const wait=(station,direction)=>{visits.push({station,direction,start:duration});legs.push({start:duration,end:duration+dwell,from:station.distance,to:station.distance,direction,dwell:true});duration+=dwell;};
 const travel=(a,b,direction)=>{
  const length=Math.abs(b.distance-a.distance),ramp=Math.min(4,Math.sqrt(length/speed)),seconds=length/speed+ramp;
  legs.push({start:duration,end:duration+seconds,from:a.distance,to:b.distance,direction,ramp,speed,length});duration+=seconds;
 };
 wait(stops[0],1);
 for(let i=1;i<stops.length;i++){travel(stops[i-1],stops[i],1);wait(stops[i],i===stops.length-1?-1:1);}
 for(let i=stops.length-2;i>=0;i--){travel(stops[i+1],stops[i],-1);if(i>0)wait(stops[i],-1);}
 const named=visits.filter(v=>v.station.name?.includes('Baiterek'));
 const forward=named.find(v=>v.direction===1),backward=named.find(v=>v.direction===-1);
 // A departing train is already emerging from the Baiterek portal at t=0.
 const seed=(forward?.start??duration*.34)+dwell+6;
 const phases=[seed,(backward?.start??seed+duration/2)-7,...[.12,.38,.63,.88].map(t=>seed+t*duration)];
 function state(seconds,phase){
  const t=((seconds+phase)%duration+duration)%duration;
  const leg=legs.find(l=>t<l.end)||legs.at(-1);
  if(leg.dwell)return {distance:leg.from,direction:leg.direction,stopped:true};
  const elapsed=t-leg.start,total=leg.end-leg.start,r=leg.ramp,s=leg.speed;
  const travelled=elapsed<r?.5*s/r*elapsed*elapsed:elapsed>total-r?leg.length-.5*s/r*(total-elapsed)**2:s*(elapsed-r/2);
  return {distance:leg.from+leg.direction*travelled,direction:leg.direction,stopped:false};
 }
 return {duration,phases,state};
}

function writeTemplate(out,byteOffset,source,pose,stretch=1){
 const positions=source.positions,normals=source.normals,c=pose.cos,s=pose.sin,p=pose.point;
 for(let i=0;i<source.count;i++){
  const at=byteOffset+i*STRIDE,j=i*3,x=positions[j]*stretch,y=positions[j+1];
  out.setFloat32(at,p[0]+(x*c-y*s)*LRT_SCALE,true);
  out.setFloat32(at+4,p[1]+(x*s+y*c)*LRT_SCALE,true);
  out.setFloat32(at+8,p[2]+positions[j+2]*LRT_SCALE,true);
  // Coupler faces are axis aligned; stretching only their longitudinal axis
  // leaves these normals valid. Car normals need a pure geographic rotation.
  const nx=normals[j],ny=normals[j+1];
  out.setInt8(at+12,Math.max(-127,Math.min(127,Math.round(nx*c-ny*s))));out.setInt8(at+13,Math.max(-127,Math.min(127,Math.round(nx*s+ny*c))));out.setInt8(at+14,normals[j+2]);
 }
 return byteOffset+source.bytes.length;
}

/**
 * A separate vehicle layer; it does not modify residents, scenario state or camera.
 *
 * update({seconds,zoom,rotation,center,aspect,reducedMotion}) -> ArrayBuffer|null
 *   ArrayBuffer: upload to the vehicle mesh (zero bytes clears the layer).
 *   null: previous vehicle data remains valid; no GPU upload is needed.
 *
 * `seconds` is elapsed scene time. Reduced motion freezes the authored t=0 scene.
 * Returned buffers are borrowed from a two-buffer pool and may be reused after
 * two subsequent updates. Upload/consume them synchronously, as renderer meshes do.
 */
export function createLrtMotion({ground=DEFAULT_GROUND,maxVisibleTrains=2,speedMps=12}={}){
 const geometry=templates(),schedule=service(Number.isFinite(speedMps)?Math.max(4,Math.min(22,speedMps)):12),limit=Math.max(1,Math.min(6,Math.floor(maxVisibleTrains)||2));
 let lastKey='',lastCount=0,pool=[],slot=0,updates=0;
 let report={active:false,visibleTrains:0,visibleCars:0,vertices:0,updates:0,totalTrains:schedule.phases.length,cycleSeconds:schedule.duration,trains:[]};
 const empty=new ArrayBuffer(0);
 function update({seconds=0,zoom,rotation,center,aspect=1,reducedMotion=false}){
  if(!Number.isFinite(zoom)||zoom<MIN_ZOOM){
   report={...report,active:false,visibleTrains:0,visibleCars:0,vertices:0,trains:[]};lastKey='';
   if(lastCount){lastCount=0;updates++;report.updates=updates;return empty;}return null;
  }
  const rate=zoom>=80?60:30,time=reducedMotion?0:Math.floor(Math.max(0,Number.isFinite(seconds)?seconds:0)*rate)/rate;
  const view={zoom,rotation,center,aspect};
  const candidates=schedule.phases.map((phase,id)=>{
   const state=schedule.state(time,phase),pose=sampleLrtTrainPose(state.distance,state.direction,ground);
   const x=(pose.bounds[0]+pose.bounds[2])*.5-center[0],y=(pose.bounds[1]+pose.bounds[3])*.5-center[1],z=(pose.bounds[4]+pose.bounds[5])*.5-(center[2]||0);
   const sx=(rotation[0]*x+rotation[3]*y+rotation[6]*z)/aspect,sy=rotation[1]*x+rotation[4]*y+rotation[7]*z;
   return {id,...state,pose,visible:visibleBounds(pose.bounds,view,.00015),rank:sx*sx+sy*sy};
  });
  const visible=candidates.filter(t=>t.visible).sort((a,b)=>a.rank-b.rank||a.id-b.id).slice(0,limit).sort((a,b)=>a.id-b.id);
  const key=visible.map(t=>`${t.id}:${t.direction}:${t.distance.toFixed(5)}`).join('|');
  report={active:true,visibleTrains:visible.length,visibleCars:visible.length*4,vertices:visible.length*geometry.bytes/STRIDE,updates,totalTrains:schedule.phases.length,cycleSeconds:schedule.duration,reducedMotion:!!reducedMotion,seconds:time,
   trains:candidates.map(({id,distance,direction,stopped,pose})=>({id,distance,direction,stopped,offset:pose.offset,visible:visible.some(v=>v.id===id),cars:pose.cars.map(c=>({distance:c.distance,point:c.point,angle:c.angle})),bounds:pose.bounds}))};
  if(key===lastKey)return null;
  lastKey=key;
  if(!visible.length){if(!lastCount)return null;lastCount=0;updates++;report.updates=updates;return empty;}
  if(lastCount!==visible.length||!pool.length){
   const bytes=geometry.bytes*visible.length;
   pool=Array.from({length:2},()=>{
    const buffer=new ArrayBuffer(bytes),out=new Uint8Array(buffer);let at=0;
    for(let train=0;train<visible.length;train++){
     for(const car of geometry.cars){out.set(car.bytes,at);at+=car.bytes.length;}
     for(let joint=0;joint<3;joint++){out.set(geometry.joint.bytes,at);at+=geometry.joint.bytes.length;}
    }
    return buffer;
   });slot=0;
  }
  const buffer=pool[slot++%2],out=new DataView(buffer);let at=0;
  for(const train of visible){
   for(let i=0;i<4;i++)at=writeTemplate(out,at,geometry.cars[i],train.pose.cars[i]);
   for(const joint of train.pose.joints)at=writeTemplate(out,at,geometry.joint,joint,joint.stretch);
  }
  lastCount=visible.length;updates++;report.updates=updates;return buffer;
 }
 return {update,diagnostics:()=>report};
}

export const LRT_MOTION_DIMENSIONS=Object.freeze({cars:4,carLengthM:CAR_LENGTH,carSpacingM:CAR_SPACING,trainLengthM:60,railHeightM:RAIL_METRES,wheelBottomM:WHEEL_BOTTOM,modelBaseM:TRAIN_BASE_METRES,minZoom:MIN_ZOOM});
