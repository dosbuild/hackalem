import catalog from './astana-programs.json' with {type:'json'};
import {Mesh,beat,rgb} from './mesh-kit.js';
import {DETAIL,civicModule,utilityCabinet} from './project-detail.js';
import {bounds,routeAt,distance} from './placement-geometry.js';
import {lrtCar} from './lrt-model.js';
export const PROGRAM_METRE=1/12000;
export const astanaPrograms=catalog.records;
export function programSites(parent){
 return (parent.program?.sites||astanaPrograms[parent.parentKey||parent.key]?.sites||[]).map(site=>({...site,proposal:parent.proposal,state:parent.state,phase:parent.phase,evidence:parent.evidence,resultId:parent.resultId,slot:parent.slot,citywide:parent.citywide,revision:parent.revision}));
}
export function programFrame(site){
 const area=site.kind==='park-area',b=site.focusBounds;
 return {center:area?[(b[0]+b[2])/2,(b[1]+b[3])/2,site.origin[2]+.00045]:[site.origin[0],site.origin[1],site.origin[2]+.0004],span:site.size,orientation:site.orientation||0};
}
const palettes=['#81a675','#689584','#98b37e','#779b69'];
function roundedTree(m,x,y,variant=0){const h=variant%3===0?8.7:6.8;m.cylinder(x,y,0,.28,h,DETAIL.wood,6);m.ellipsoid(x,y,h,3.5,3.1,3.5,palettes[variant%4],8,4);m.ellipsoid(x-2,y-1,h-.6,2.8,2.4,2.6,palettes[(variant+1)%4],8,4);m.ellipsoid(x+2,y+.7,h+.2,2.4,2.2,2.5,'#abc38b',8,4);}
function seat(m,x,y){m.box(x,y,.45,2.8,.7,.16,DETAIL.wood);m.box(x,y+.38,.6,2.8,.13,.72,DETAIL.wood);for(const dx of [-1,1])m.box(x+dx,y,0,.15,.7,.5,DETAIL.metal);}
function visitor(m,x,y,variant=0,action=0){m.cylinder(x,y,.12,.23,.95,variant%2?'#9f805b':'#688b8b',6);m.ellipsoid(x,y,1.32,.24,.23,.27,'#d8b394',7,4);for(const side of [-1,1])m.beam([x+side*.12,y,.2],[x+side*.17,y+side*action*.18,0],.07,DETAIL.roofEdge,4);}
function siteNear(site,options){if(!options.center||options.zoom<24)return true;const b=site.focusBounds||bounds([site.origin]),r=options.zoom>75?.1:.23;return options.center[0]>=b[0]-r&&options.center[0]<=b[2]+r&&options.center[1]>=b[1]-r&&options.center[1]<=b[3]+r;}
function areaStatic(m,site,parts=null){
 m.at([0,0,0]);m.ribbon([...site.rings[0],site.rings[0][0]],.6*PROGRAM_METRE,'#b8bc90',1,site.origin[2]+.000005);
 if(parts)parts.push(m.bytes);
 for(const item of site.items){m.at(item.point,0,PROGRAM_METRE);const r=item.radius/PROGRAM_METRE;
  if(item.kind==='grove'){m.ellipsoid(0,0,.02,6.7,6.5,.08,'#88a579',9,3);roundedTree(m,-1.5,-1,item.variant);roundedTree(m,2,1.5,item.variant+1);}
  else if(item.kind==='meadow'){m.ellipsoid(0,0,.015,r*.97,r*.97,.08,item.variant%2?'#aabb86':'#b7bd89',12,3);for(let i=0;i<6;i++)m.ellipsoid((i%3-1)*r*.4,(Math.floor(i/3)-.5)*r*.65,.22,r*.12,r*.11,.23,'#c9bc85',6,3);}
  else if(item.kind==='garden'){m.ellipsoid(0,0,.03,r*.95,r*.86,.12,'#c4b58c',12,3);for(let i=0;i<9;i++){const x=(i%3-1)*r*.45,y=(Math.floor(i/3)-1)*r*.45;m.ellipsoid(x,y,.4,r*.2,r*.19,.6,palettes[(i+item.variant)%4],7,3);m.ellipsoid(x,y,1.05,r*.065,r*.065,.22,i%2?'#dfc281':'#c79e82',6,3);}}
  else{m.box(0,0,.02,r*1.96,r*1.96,.08,DETAIL.paving);if(r<3)seat(m,0,0);else{seat(m,-2,-2);seat(m,2,2);m.box(0,0,.1,1.2,1.2,.65,DETAIL.stone);}}
  if(parts)parts.push(m.bytes);
 }
 for(const node of site.entrances||[]){m.at(node.point,0,PROGRAM_METRE);m.cylinder(0,0,0,.11,2.2,DETAIL.metal,6);m.box(0,0,1.4,1.9,.12,.6,DETAIL.stone);m.box(0,-.07,1.6,1.5,.04,.13,'#789889');}
}
function approach(m,site){const p=site.approach?.points;if(!p)return;m.at([0,0,0]);m.ribbon(p,2.1*PROGRAM_METRE,DETAIL.paving,1,site.origin[2]+.00001);}
function facilityStatic(m,site){
 approach(m,site);m.at(site.origin,site.orientation,PROGRAM_METRE);
 const clinic=site.kind==='clinic-satellite',school=site.kind==='kindergarten',[w,d]=site.buildingSize||[24,18];
 m.box(0,0,0,site.size[0]/PROGRAM_METRE,site.size[1]/PROGRAM_METRE,.12,'#bcb99b');
 civicModule(m,{x:0,y:3,z:.12,w,d,h:clinic?7.2:school?5.6:4.8,levels:clinic?2:1,color:clinic?DETAIL.wall:DETAIL.brick,lod:'close',pitched:school});
 const door=3-d/2-.15;m.box(0,door,.16,3.6,.14,3.2,DETAIL.recess);m.box(0,door-.1,.22,3.2,.06,3.0,DETAIL.glass);m.box(0,door-.15,.16,.10,.10,3.2,DETAIL.frame);
 for(const x of [-1.9,1.9])m.box(x,door-.1,.16,.16,.18,3.25,DETAIL.stone);
 m.box(0,door-1.5,3.46,5,3,.18,DETAIL.roof);for(const x of [-2.1,2.1])m.box(x,door-2.65,.12,.12,.12,3.34,DETAIL.metal);m.box(0,door-1.55,.12,4.4,3.1,.04,DETAIL.paving);
 // A broad level approach and gentle ramp give every neighborhood facility an
 // accessible entrance; they sit inside the separately checked 40 × 36 m lot.
 const front=-Math.min(15,site.size[1]/PROGRAM_METRE/2-1),rampEnd=-Math.min(8,d/2+2);
 m.box(0,(front+rampEnd)/2,.12,4.6,rampEnd-front,.04,DETAIL.paving);m.quad([-2.3,front,.14],[2.3,front,.14],[2.3,rampEnd,.16],[-2.3,rampEnd,.16],DETAIL.stone);
 for(const x of [-2.35,2.35])m.beam([x,front,.95],[x,rampEnd,.97],.05,DETAIL.metal,4);
 seat(m,-9,-12);seat(m,9,-12);m.box(-14,-12,.12,2,2,.62,'#9caa80');m.box(14,-12,.12,2,2,.62,'#9caa80');
 if(clinic){m.box(-7,3-d/2-.2,5.1,3,.12,.55,DETAIL.accent);m.box(-7,3-d/2-.22,4.1,.55,.12,2.55,DETAIL.accent);m.box(8,-6.3,1,3.2,.1,1.2,DETAIL.glass);}
 if(school){m.box(9,-8,.12,5,4,.18,'#baa176');m.beam([7,-8,.4],[11,-8,2.4],.16,DETAIL.wood);}
}
function courtStatic(m,site){approach(m,site);m.at(site.origin,site.orientation,PROGRAM_METRE);m.box(0,0,0,38,30,.14,'#9eb2a2');m.box(0,2,.16,28,18,.06,'#c19779');m.ribbon([[-14,-7],[14,-7],[14,11],[-14,11],[-14,-7]],.18,DETAIL.stone,1,.24);m.ribbon([[0,-7],[0,11]],.18,DETAIL.stone,1,.25);if(site.key.endsWith('-1')){for(const x of [-13,13]){m.cylinder(x,2,.2,.1,4.2,DETAIL.metal,6);m.box(x,2,3.3,.15,2.5,1.3,DETAIL.stone);m.ellipsoid(x+(x<0?.5:-.5),2,3.35,.55,.55,.06,DETAIL.accent,10,3);}}else for(const x of [-14,14]){m.beam([x,-.5,.2],[x,-.5,2.8],.09,DETAIL.stone);m.beam([x,4.5,.2],[x,4.5,2.8],.09,DETAIL.stone);m.beam([x,-.5,2.8],[x,4.5,2.8],.09,DETAIL.stone);}for(const x of [-12,-6,0]){m.beam([x,-11,0],[x,-11,2.6],.1,DETAIL.metal);m.beam([x,-11,2.6],[x+3,-11,2.6],.1,DETAIL.metal);}seat(m,10,-12);}
function signalStatic(m,site){
 for(const f of site.signals){m.at(f.point,f.angle,PROGRAM_METRE);m.cylinder(0,0,0,.12,4.8,DETAIL.metal,6);m.box(0,0,3.2,.6,.4,1.25,DETAIL.roofEdge);for(let i=0;i<3;i++)m.ellipsoid(0,-.25,3.42+i*.36,.13,.07,.13,DETAIL.recess,6,3);m.box(0,0,1.3,.24,.28,.6,DETAIL.roofEdge);}
 for(const arm of site.arms){const q=routeAt(arm.points,Math.min(.9,15*PROGRAM_METRE/routeLength(arm.points)));m.at([...q.point,site.origin[2]+.00002],q.angle,PROGRAM_METRE);m.box(7,0,0,.2,6,.045,DETAIL.stone);for(let i=0;i<6;i++)m.box(0,(i-2.5)*1.1,0,2.4,.6,.045,'#e8dbc0');}
}
function beltStatic(m,site){m.at(site.origin,site.orientation,PROGRAM_METRE);const r=Math.min(site.size[0],site.size[1])/PROGRAM_METRE/2;for(let i=0;i<5;i++)roundedTree(m,Math.cos(i*2.4)*(r-5),Math.sin(i*2.4)*(r-5),i);}
const staticCache=new Map();let staticBytes=0;const STATIC_LIMIT=32*1024*1024;
function append(m,data,bytes=data.byteLength){const length=m.bytes+bytes;if(length>m.buffer.byteLength){let size=m.buffer.byteLength;while(size<length)size*=2;const next=new ArrayBuffer(size);new Uint8Array(next).set(new Uint8Array(m.buffer));m.buffer=next;m.view=new DataView(next);}new Uint8Array(m.buffer,m.bytes,bytes).set(new Uint8Array(data,0,bytes));m.bytes=length;m.lastColor=null;m.lastTint=null;}
export function programStatic(m,parent,options={}){
 if(!parent.program||parent.phase==='baseline'||(options.programProgress??1)<=0)return;
 for(const site of programSites(parent)){if(!siteNear(site,options))continue;const cacheKey=site.key+'/'+(parent.proposal?'preview':parent.state)+'/'+!!parent.blocked+'/'+(options.zoom<15?'district':'close');let cached=staticCache.get(cacheKey);
  const progress=options.programProgress??1;if(progress<.6&&site.kind!=='park-area')continue;
  if(!cached){const kit=new Mesh(),parts=[];kit.kind=8;kit.tint=m.tint;
   if(site.kind==='park-area')areaStatic(kit,site,parts);
   else if(['clinic-satellite','kindergarten'].includes(site.kind))facilityStatic(kit,site);
   else if(site.kind==='sports-court')courtStatic(kit,site);
   else if(site.kind==='junction')signalStatic(kit,site);
   else if(site.kind==='protected-crossing'){for(const sign of site.signs){kit.at(sign.point,sign.angle,PROGRAM_METRE);kit.cylinder(0,0,0,.11,3.4,DETAIL.metal,6);kit.box(0,0,2.2,1,.16,1,DETAIL.metal);kit.box(0,-.09,2.4,.7,.04,.6,DETAIL.stone);}}
   else if(site.kind==='greening-belt')beltStatic(kit,site);
   else if(site.kind==='greening-belt-core'){for(const item of site.items){kit.at(item.point,0,PROGRAM_METRE);roundedTree(kit,0,0,item.variant);}}
   else if(site.kind==='intake-point'){kit.at(site.origin,site.orientation,PROGRAM_METRE);kit.box(0,0,0,7,7,.08,DETAIL.paving);utilityCabinet(kit,1);}
   else if(site.kind==='household-service'){kit.at([0,0,0]);kit.kind=13;for(let i=1;i<site.connection.points.length;i++)kit.beam([...site.connection.points[i-1],site.origin[2]-.0002],[...site.connection.points[i],site.origin[2]-.0002],.12*PROGRAM_METRE,'#8cabad',6);kit.kind=8;kit.at(site.origin,site.orientation,PROGRAM_METRE);utilityCabinet(kit,1);kit.box(0,0,.02,5,4,.06,DETAIL.paving);}
   cached={data:kit.pack(),parts};if(cached.data.byteLength<STATIC_LIMIT){while(staticCache.size&&staticBytes+cached.data.byteLength>STATIC_LIMIT){const key=staticCache.keys().next().value;staticBytes-=staticCache.get(key).data.byteLength;staticCache.delete(key);}staticCache.set(cacheKey,cached);staticBytes+=cached.data.byteLength;}
  }
  append(m,cached.data,progress<1&&cached.parts.length?cached.parts[Math.min(cached.parts.length-1,Math.ceil(site.items.length*progress))]:cached.data.byteLength);
 }
}
export function programOverview(m,parent,p,options={}){
 if(!parent.program||parent.phase==='baseline'||options.zoom>=18)return;
 const pixel=1/(options.scale||324);m.kind=14;m.tint=rgb;
 for(const site of programSites(parent)){
  if(site.kind==='park-area'){m.at([0,0,0]);m.ribbon([...site.rings[0],site.rings[0][0]],Math.max(1*PROGRAM_METRE,pixel*1.3),'#709c78',p,.001);}
  else {m.at(site.origin,site.orientation,pixel);m.ellipsoid(0,0,.08,3.2,3,.08,parent.id==='M8'?'#92b8b0':parent.id==='M2'?'#d0b975':'#94ae81',8,3);}
 }
 m.kind=8;
}
const routeLength=route=>route.reduce((n,p,i)=>n+(i?distance(p,route[i-1]):0),0);
export function trafficPhase(seconds,offset=0){const t=((seconds-offset)%40+40)%40;return {cycle:t,axis:t<12?'east-west':t<16?'clearance':t<28?'north-south':t<32?'clearance':t<39?'pedestrian':'clearance',amber:t>=12&&t<14||t>=28&&t<30,departingAxis:t>=12&&t<16?'east-west':t>=28&&t<32?'north-south':null,greenSeconds:t<12?t:t>=16&&t<28?t-16:0};}
export function junctionSnapshot(site,seconds=0){
 const phase=trafficPhase(seconds,site.coordinationOffset||0),vehicles=[];
 for(const [index,arm] of site.arms.entries()){
  const origin=arm.points[0],direction=Math.atan2(arm.points[1][1]-origin[1],arm.points[1][0]-origin[0]),axis=Math.abs(Math.cos(direction))>=Math.abs(Math.sin(direction))?'east-west':'north-south',green=phase.axis===axis;
  const opposite=site.arms.filter(a=>a!==arm).sort((a,b)=>{const score=a=>Math.cos(Math.atan2(a.points[1][1]-origin[1],a.points[1][0]-origin[0])-direction);return score(a)-score(b);})[0];
  const count=Math.min(3,Math.max(1,Math.floor((routeLength(arm.points)/PROGRAM_METRE-26)/12)+1));
  for(let queue=0;queue<count;queue++){
   const wait=26+queue*12,travel=green?phase.greenSeconds*7:0,metres=wait-travel,route=metres<0&&opposite?opposite.points:arm.points,length=routeLength(route),q=routeAt(route,Math.min(.94,Math.abs(metres)*PROGRAM_METRE/length));
   // Vehicles clear the middle before the pedestrian interval. Every red phase
   // has a stable queue and opposing axes never receive green together.
   vehicles.push({point:q.point,angle:q.angle+(metres<0?0:Math.PI),queue,index,axis,stopped:!green||phase.greenSeconds<queue*.6,insideJunction:Math.abs(metres)<10,metres,green});
  }
 }
 return {...phase,vehicles};
}
/** Baseline illustrates hesitant, independent approach release. It remains
 * collision-free but never borrows the funded network's synchronized rhythm. */
export function baselineJunctionSnapshot(site,seconds=0){const span=18,total=site.arms.length*span,clock=((seconds%total)+total)%total,index=Math.floor(clock/span),release=clock%span,vehicles=[];
 for(const [armIndex,arm] of site.arms.entries())for(let queue=0;queue<Math.min(3,Math.max(1,Math.floor((routeLength(arm.points)/PROGRAM_METRE-26)/12)+1));queue++){const wait=26+queue*12,green=armIndex===index&&release<9,metres=wait-(green?release*3:0),q=routeAt(arm.points,Math.min(.94,Math.abs(metres)*PROGRAM_METRE/routeLength(arm.points)));vehicles.push({point:q.point,angle:q.angle+Math.PI,queue,index:armIndex,axis:'approach-'+armIndex,stopped:!green,insideJunction:Math.abs(metres)<10,metres,green});}
 return {cycle:clock,axis:'independent',amber:false,vehicles};
}
export function crossingSnapshot(seconds=0,planned=true){const t=(seconds%18+18)%18,pedestrian=planned&&t>=5&&t<11;return {pedestrian,stopped:pedestrian,speed:planned?(pedestrian?0:4):9,position:pedestrian?-9:t<5?-29+t*4:planned?-9+(t-11)*4:-45+t*9};}
function car(m,color='#b9c3ac',bus=false){const length=bus?10.8:4.8;m.box(0,0,.45,length,bus?2.5:2.0,bus?2.7:1.5,color);m.box(0,0,bus?2.1:1.2,length*.65,2.02,.8,DETAIL.glass);m.box(0,0,bus?3.15:1.94,length*.92,2.08,.12,DETAIL.roof);for(const x of [-length*.3,length*.3])for(const y of [-1,1])m.ellipsoid(x,y,.5,.43,.2,.43,DETAIL.roofEdge,6,3);}
export function routeParameter(route,point){const length=routeLength(route);let walked=0,best={distance:Infinity,t:0};for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],dx=b[0]-a[0],dy=b[1]-a[1],span=Math.hypot(dx,dy),u=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(span*span||1))),d=distance(point,[a[0]+dx*u,a[1]+dy*u]);if(d<best.distance)best={distance:d,t:(walked+span*u)/length};walked+=span;}return best.t;}
export function boardingSnapshot(parent,seconds=0){const snapshots=[],route=parent.route,length=routeLength(route),f=parent.furniture||parent.program?.furniture||[];for(const side of [-1,1])for(const [i,ratio]of [.18,.38,.62,.82].entries()){const fixture=f[Math.round((f.length-1)*ratio)],stop=fixture?routeParameter(route,fixture.point):ratio,clock=(seconds+i*7)%28,t=clock<4?stop:((stop+side*(clock-4)*8*PROGRAM_METRE/length)%1+1)%1,q=routeAt(route,t);snapshots.push({point:q.point,angle:q.angle+(side<0?Math.PI:0),side,stop,stopIndex:i,clock,stopped:clock<4});}return snapshots;}
function routeVehicles(m,parent,options,bus=false){
 const route=parent.route;if(!route)return;const seconds=options.reducedMotion?0:options.seconds||0,length=routeLength(route),count=bus?4:2;
 if(bus){for(const q of boardingSnapshot(parent,seconds)){const tangent=q.angle+(q.side<0?Math.PI:0),offset=1.7*PROGRAM_METRE;m.at([q.point[0]-Math.sin(tangent)*offset*q.side,q.point[1]+Math.cos(tangent)*offset*q.side,parent.origin[2]+.00001],q.angle,PROGRAM_METRE);car(m,q.side>0?'#d5bd98':'#aac1ae',true);}return;}
 for(const side of [-1,1])for(let i=0;i<count;i++){const clock=(seconds+(i*7))%28,stop=bus?[.18,.38,.62,.82][i]:.5,travel=clock<4?stop:(stop+(clock-4)*8*PROGRAM_METRE/length)%1,q=routeAt(route,side===1?travel:1-travel),offset=(bus?1.7:2.1)*PROGRAM_METRE;
  if(bus){m.at([q.point[0]-Math.sin(q.angle)*offset*side,q.point[1]+Math.cos(q.angle)*offset*side,parent.origin[2]+.00001],q.angle+(side<0?Math.PI:0),PROGRAM_METRE);car(m,side>0?'#d5bd98':'#aac1ae',true);}
  else for(let coach=0;coach<3;coach++){const c=routeAt(route,Math.max(.01,Math.min(.99,(side===1?travel:1-travel)+(coach-1)*15.1*PROGRAM_METRE/length)));m.at([c.point[0]-Math.sin(c.angle)*offset*side,c.point[1]+Math.cos(c.angle)*offset*side,parent.origin[2]+10.22*PROGRAM_METRE],c.angle+(side<0?Math.PI:0),PROGRAM_METRE);lrtCar(m,{cab:coach===0||coach===2,flip:coach===0});}
 }
}
function junctionDynamic(m,site,options,baseline){
 const seconds=options.reducedMotion?0:options.seconds||0,snapshot=baseline?baselineJunctionSnapshot(site,seconds):junctionSnapshot(site,seconds);
 if(!baseline)for(const f of site.signals){m.at(f.point,f.angle,PROGRAM_METRE);const axis=Math.abs(Math.cos(f.angle))>=Math.abs(Math.sin(f.angle))?'east-west':'north-south',green=snapshot.axis===axis,amber=snapshot.amber&&snapshot.departingAxis===axis,index=green?2:amber?1:0;m.kind=11;m.ellipsoid(0,-.27,3.42+index*.36,.13,.07,.13,green?'#9ec093':amber?'#ebc587':'#d38f77',6,3);m.ellipsoid(0,-.2,1.65,.1,.04,.1,snapshot.axis==='pedestrian'?'#b8d393':'#cb927f',6,3);m.kind=8;}
 for(const v of snapshot.vehicles){const q=v.point,offset=1.6*PROGRAM_METRE;m.at([q[0]-Math.sin(v.angle)*offset,q[1]+Math.cos(v.angle)*offset,site.origin[2]+.00002],v.angle,PROGRAM_METRE);car(m,v.queue%2?'#c5b993':'#abb8ab');}
 if(!baseline&&snapshot.axis==='pedestrian'){const arm=site.arms[0],q=routeAt(arm.points,15*PROGRAM_METRE/routeLength(arm.points));m.at([...q.point,site.origin[2]+.00002],q.angle,PROGRAM_METRE);for(let i=0;i<3;i++)visitor(m,(i-1)*.65,-4+((snapshot.cycle-32)/7)*8,i,.5);}
}
export function programDynamic(m,parent,options={}){
 if(!parent.program||options.zoom<12)return;const baseline=parent.phase==='baseline',seconds=options.reducedMotion?0:options.seconds||0;
 if(!parent.proposal&&['M1','M3'].includes(parent.id))routeVehicles(m,parent,options,parent.id==='M1'||baseline);
 for(const site of programSites(parent)){if(!siteNear(site,options))continue;
  if(site.kind==='junction'){junctionDynamic(m,site,options,baseline);continue;}
  if(baseline||parent.proposal)continue;
  if(['clinic-satellite','kindergarten','sports-court'].includes(site.kind)){m.at(site.origin,site.orientation,PROGRAM_METRE);for(let i=0;i<3;i++){const t=(seconds*.055+i/3)%1,walk=site.kind==='sports-court'?2+Math.sin(t*Math.PI*2)*6:-12+(1-t)*8;visitor(m,(i-1)*3,walk,i,Math.sin(t*Math.PI*2));}}
  else if(site.kind==='park-area'){for(const item of site.items.filter(q=>q.kind==='seating').slice(0,5)){m.at(item.point,0,PROGRAM_METRE);if(item.radius<3*PROGRAM_METRE)visitor(m,0,-1.5,1);else{visitor(m,-2,-2,1);visitor(m,2+Math.sin(seconds*.2),-2,0,.2);}}}
  else if(site.kind==='intake-point'){m.at(site.origin,site.orientation,PROGRAM_METRE);const t=(seconds%20)/20;visitor(m,3,-2,0,.2);m.box(t<.5?0:3,-1,.9,.55,.4,.05,t<.5?'#cfb179':'#a3bea8');}
 }
 if(parent.id==='M5'){for(const [i,roof] of parent.roofs.entries()){m.at(roof.position,0,PROGRAM_METRE);const strength=baseline?1:.13;for(let puff=0;puff<3;puff++){const t=(seconds*.11+puff/3+i*.17)%1;m.ellipsoid(t*2,0,1+t*7,.7+t*strength*2,.7+t*strength*2,.9+t*strength*3,baseline?'#a69c89':'#d8d1ba',7,3);}}}
 if(parent.id==='M11')for(const [i,t] of [.28,.5,.72].entries()){const q=routeAt(parent.route,t),flow=crossingSnapshot(seconds+i*3,!baseline);m.at([...q.point,parent.origin[2]+.00002],q.angle,PROGRAM_METRE);carAt(m,flow.position,-1.7);if(flow.pedestrian)for(let j=0;j<2;j++)visitor(m,0,-4+(seconds+i*3-5)%18*.9+j*.6,j,.4);}
 if(parent.id==='M10'&&!baseline){for(const q of (parent.peopleSpots||[]).slice(0,4)){m.at(q.position,q.angle,PROGRAM_METRE);visitor(m,Math.sin(seconds*.2),0,1,.3);}}
 if(parent.id==='M12'&&!baseline){m.at(parent.origin,parent.orientation,PROGRAM_METRE);const t=(seconds%24)/24;visitor(m,-7+t*10,-6,0,.4);m.box(t<.5?6:6-(t-.5)*22,-2,.95,.65,.45,.04,t<.5?'#d0b67c':'#a0b9a1');}
 if(parent.id==='M13'&&!baseline&&parent.route){m.at([0,0,0]);m.ribbon(parent.route,.6*PROGRAM_METRE,'#c6b791',1,parent.origin[2]+.00002);}
 if(parent.id==='M14'&&!baseline&&parent.route){const phase=(seconds%36)/36,start=.16,destination=.5,t=phase<.4?start+phase/.4*(destination-start):phase<.65?destination:destination-(phase-.65)/.35*(destination-start),q=routeAt(parent.route,t);m.at([...q.point,parent.origin[2]+.00002],q.angle+(phase>.65?Math.PI:0),PROGRAM_METRE);car(m,'#d3b07f');if(phase>=.4&&phase<.65){m.at([...q.point,parent.origin[2]+.00002],q.angle,PROGRAM_METRE);visitor(m,1,4,1,.2);visitor(m,-1,4,0);m.box(0,3,.2,1.5,1,.6,DETAIL.wood);}}
}
function carAt(m,x,y){const origin=m.origin.slice(),angle=m.angle;m.at(m.point([x,y,0]),angle,PROGRAM_METRE);car(m);m.at(origin,angle,PROGRAM_METRE);}
