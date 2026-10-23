import assert from 'node:assert/strict';
import {prepareLandmarks} from './catalog.mjs';
import {mapXY} from '../../../src/world/city-math.js';
import {LRT_STATIONS,lrtAt} from '../../../src/world/lrt-route.js';
import {sampleLrtTrainPose} from '../../../src/world/lrt-motion.js';

// Numerical targets come from the reference authorities, not model metadata:
// Lindner: EXPO 80 m sphere / 100 m overall; a-vm.kz: Baiterek 22 m / 105 m;
// Khan Shatyr operator: 150 m; HKR/CTBUH: Abu Dhabi approximately 311 m;
// Hill International: Grand Mosque four 130 m minarets.
// https://www.lindner-group.com/en/references/the-sphere-expo-2017
// https://a-vm.kz/en/objects/bayterek/  https://site.khanshatyr.com/en/about
// https://hkrarchitects.com/journals/abu-dhabi-plaza/
// https://www.hillintl.com/project/grand-astana-mosque/
const models=prepareLandmarks(),byId=new Map(),owners=new Map(),local=new Map();
const measured=new Set(['expo','baiterek','khan','abudhabi','grand-mosque']);
const near=(value,target,tolerance,label)=>assert.ok(Math.abs(value-target)<=tolerance,`${label}: ${value.toFixed(3)} m; expected ${target} ± ${tolerance}`);
let vertices=0;
for(const model of models){
 assert.ok(!byId.has(model.id),`duplicate model ${model.id}`);byId.set(model.id,model);
 assert.ok(model.buffer.length>0&&model.buffer.length%60===0,`${model.id}: incomplete packed triangles`);
 const origin=mapXY(model.position),c=Math.cos(model.angle||0),s=Math.sin(model.angle||0),points=[];
 for(const source of model.replaces||[]){assert.match(source,/^(way|relation)\/\d+$/);assert.ok(!owners.has(source),`${source} is claimed by both ${owners.get(source)} and ${model.id}`);owners.set(source,model.id);}
 for(let at=0;at<model.buffer.length;at+=20){
  const v=[0,4,8].map(a=>model.buffer.readFloatLE(at+a));assert.ok(v.every(Number.isFinite),`${model.id}: non-finite vertex`);
  const normal=Math.hypot(...[12,13,14].map(a=>model.buffer.readInt8(at+a)));assert.ok(normal>=124&&normal<=130,`${model.id}: zero or invalid packed normal (${normal})`);
  const kind=model.buffer.readUInt8(at+18);assert.ok(![2,3].includes(kind),`${model.id}: generic building relief would distort physical scale`);
  const x=(v[0]-origin[0])*12000,y=(v[1]-origin[1])*12000;
  if(measured.has(model.id))points.push([x*c+y*s,-x*s+y*c,(v[2]-.00006)*12000,kind]);vertices++;
 }
 local.set(model.id,points);
}
for(const id of ['expo','baiterek','khan','abudhabi','grand-mosque','expo-pavilions','esil-bridges'])assert.ok(byId.has(id),`${id} missing from the compiled catalog`);
const bounds=points=>{assert.ok(points.length);const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const p of points)for(let a=0;a<3;a++){b[a]=Math.min(b[a],p[a]);b[a+3]=Math.max(b[a+3],p[a]);}return b;};
const height=id=>bounds(local.get(id))[5];
const expo=bounds(local.get('expo').filter(p=>p[3]===23&&p[2]>45));
near(expo[3]-expo[0],80,.5,'EXPO glass diameter east-west');near(expo[4]-expo[1],80,.5,'EXPO glass diameter north-south');near(height('expo'),100,.5,'EXPO overall height');
const gold=local.get('baiterek').filter(p=>p[3]===24&&p[2]>=82.9&&p[2]<=105.01),globe=bounds(gold);
near(globe[3]-globe[0],22,.2,'Baiterek gold sphere diameter');near(globe[5],105,.2,'Baiterek architectural crown');
assert.ok(local.get('baiterek').filter(p=>p[2]>105.5).every(p=>Math.hypot(p[0],p[1])<.3),'Baiterek: only the documented slender antenna may exceed the crown');
assert.ok(height('baiterek')<=108.5,'Baiterek antenna exceeds the documented 108.3 m model');
near(height('khan'),150,.5,'Khan Shatyr mast');near(height('abudhabi'),311,1,'Abu Dhabi Plaza');
const minarets=[];
for(const p of local.get('grand-mosque').filter(p=>p[2]>120)){let group=minarets.find(g=>Math.hypot(g.x-p[0],g.y-p[1])<12);if(!group){group={x:p[0],y:p[1],top:0};minarets.push(group);}group.top=Math.max(group.top,p[2]);}
assert.equal(minarets.length,4,'Grand Mosque must have four separately positioned tall minarets');for(const minaret of minarets)near(minaret.top,130,.7,'Grand Mosque minaret');
assert.equal(byId.get('expo-pavilions').replaces.length,7,'seven surveyed EXPO pavilions must be replaced');

// Triangle/box separating-axis test checks real packed station/bridge surfaces
// against the conservative carriage envelope, including vertical portal walls.
function intersects(triangle,half){
 for(let a=0;a<3;a++)if(Math.min(...triangle.map(p=>p[a]))>half[a]||Math.max(...triangle.map(p=>p[a]))<-half[a])return false;
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const edges=triangle.map((p,i)=>triangle[(i+1)%3].map((x,a)=>x-p[a]));
 const axes=[cross(edges[0],edges[1]),...edges.flatMap(e=>[[0,e[2],-e[1]],[-e[2],0,e[0]],[e[1],-e[0],0]])];
 for(const axis of axes){const projected=triangle.map(p=>p.reduce((sum,x,a)=>sum+x*axis[a],0)),radius=half.reduce((sum,h,a)=>sum+h*Math.abs(axis[a]),0);if(Math.min(...projected)>radius+1e-7||Math.max(...projected)<-radius-1e-7)return false;}
 return true;
}
function clearTrain(model,distance,direction){
 const mesh=model.buffer,pose=sampleLrtTrainPose(distance,direction);
 for(const car of pose.cars){
  const half=[7.30,1.60,1.72],middleZ=1.94;
  for(let at=0;at<mesh.length;at+=60){
   const triangle=[];
   for(let j=0;j<3;j++){const i=at+j*20,x=(mesh.readFloatLE(i)-car.point[0])*12000,y=(mesh.readFloatLE(i+4)-car.point[1])*12000,z=(mesh.readFloatLE(i+8)-car.point[2])*12000;triangle.push([x*car.cos+y*car.sin,-x*car.sin+y*car.cos,z-middleZ]);}
   assert.ok(!intersects(triangle,half),`${model.id}: carriage intersects triangle ${at/60} at route ${distance.toFixed(1)} m, direction ${direction}`);
  }
 }
}
const stations=models.filter(m=>m.station);assert.equal(LRT_STATIONS.length,18,'survey must contain 18 stations');assert.equal(stations.length,18,'catalog must contain all 18 stations');
for(const station of LRT_STATIONS){
 const model=byId.get(station.id);assert.ok(model,`missing station ${station.name}`);
 assert.ok(model.replaces.includes(station.source),`${station.name}: surveyed generic building not replaced`);
 const q=lrtAt(station.distance).point,p=mapXY(model.position);near(Math.hypot(q[0]-p[0],q[1]-p[1])*12000,0,.03,`${station.name} route centring`);
 for(const direction of [-1,1])for(const offset of [-station.lengthM/2,0,station.lengthM/2])clearTrain(model,station.distance+offset,direction);
}
const bridge=byId.get('esil-bridges');for(const direction of [-1,1])for(const distance of [14810,14878.6,14947])clearTrain(bridge,distance,direction);
console.log(`Static landmark contracts pass: ${models.length} models, ${owners.size} unique source replacements, ${vertices.toLocaleString()} finite vertices, verified landmark dimensions, 18 clear stations, and clear Esil bridge.`);
