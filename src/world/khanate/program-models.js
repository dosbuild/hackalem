import {Mesh,beat,blend} from '../mesh-kit.js';
import {PALETTE} from '../../design/palette.js';
import {yurt,well,steppeTree,lantern,cart,animal} from './models.js';
import {villager,creature} from './life-models.js';
import {OBJECT_UNIT,localPoint} from './scale.js';
import {routeAt} from '../placement-geometry.js';
import {programSites,programCrossingCycle,programCrossingCartPose,programRoutePose} from './programs.js';
import {PROPOSAL_TINT} from '../construction-preparation.js';

const timber='#92775a',dark='#695743',earth='#d3c4a4';
export function joinProgramMeshes(buffers){const size=buffers.reduce((n,b)=>n+b.byteLength,0),out=new Uint8Array(size);let offset=0;for(const buffer of buffers){out.set(new Uint8Array(buffer),offset);offset+=buffer.byteLength;}return out.buffer;}
const cache=new Map();
let cachedBytes=0;
function boundedCache(key,build){if(cache.has(key))return cache.get(key);const value=build();while(cache.size&&(cache.size>=240||cachedBytes+value.byteLength>32*1024*1024)){const oldest=cache.keys().next().value;cachedBytes-=cache.get(oldest).byteLength;cache.delete(oldest);}if(value.byteLength<=32*1024*1024){cache.set(key,value);cachedBytes+=value.byteLength;}return value;}
function growingTree(m,variant,p){if(p<=0)return;m.cylinder(0,0,0,.4,8*p,timber,6,.2);m.ellipsoid(0,0,10*p,4.1*p,3.6*p,3.6*p,['#89977b','#9da486','#758e76'][variant%3],8,4);}
function shade(m,x,y,p=1){for(const dx of [-9,9])for(const dy of [-6,6])m.box(x+dx,y+dy,0,.35,.35,9*p,timber);m.quad([x-10,y-7,9*p],[x+10,y-7,9*p],[x+10,y+7,10*p],[x-10,y+7,10*p],PALETTE.felt);}
function bench(m,x,y,p=1){m.box(x,y,1.7*p,7,2,.35,timber);for(const dx of [-2.5,2.5])m.box(x+dx,y,0,.35,1.8,1.7*p,dark);}
function table(m,x,y,p=1){for(const dx of [-2.5,2.5])for(const dy of [-1,1])m.box(x+dx,y+dy,0,.3,.3,2.5*p,dark);m.box(x,y,2.5*p,7,3.5,.3,timber);}
function vessel(m,x,y,z=0){m.ellipsoid(x,y,z+1,.8,.8,1.1,'#b38d69',8,4);m.cylinder(x,y,z+1.9,.4,.15,dark,8);}
function ground(m,r,p){m.kind=4;const n=18,points=Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2,k=.81+.055*Math.sin(i*2.3);return[Math.cos(a)*r*k*p,Math.sin(a)*r*k*p,.03];});for(let i=0;i<n;i++)m.tri([0,0,.03],points[i],points[(i+1)%n],earth,[[0,0,1],[0,0,1],[0,0,1]]);m.kind=8;}
function paths(m,lines,p=1,width=2.5){m.kind=4;for(const line of lines)m.ribbon(line,width,'#bcaa88',p,.055);m.kind=8;}
function herbs(m,x,y,p=1){m.box(x,y,.1,14,9,.28,'#a8ac86');for(let i=0;i<8;i++){const xx=x+(i%4-1.5)*3,yy=y+(Math.floor(i/4)-.5)*3;m.ellipsoid(xx,yy,.6*p,1,1,.65*p,['#899c78','#a2a881','#7f9575'][i%3],7,3);if(i%3===0)m.ellipsoid(xx,yy,1.2*p,.35,.35,.2,'#c2ad74',6,3);}}
function sign(m,x,y,color=PALETTE.indigo,p=1){m.box(x,y,0,.4,.4,9*p,timber);m.box(x,y,6*p,5,.6,2.8*p,color);for(let i=0;i<3;i++)m.box(x-1+i,y-.32,6.7*p,.45,.02,1.1,PALETTE.felt);}
function orchard(m,site,p,tree=steppeTree){const r=site.radius/OBJECT_UNIT;ground(m,r,p);paths(m,[[[-r*.7,0],[0,0],[r*.7,0]],[[0,-r*.8],[0,0],[0,r*.7]],[[-r*.55,-r*.5],[-r*.55,r*.4]],[[r*.55,-r*.5],[r*.55,r*.4]]],beat(p,.05,.5),3.4);
 m.at(site.origin,site.orientation,OBJECT_UNIT);well(m,beat(p,.1,.5));
 for(let i=0;i<28;i++){const a=i*2.399963,rr=r*(.42+.29*(i%5)/4),x=Math.cos(a)*rr,y=Math.sin(a)*rr;if(Math.abs(x)<7||Math.abs(y)<7)continue;m.at(localPoint(site.origin,site.orientation,x,y),site.orientation,OBJECT_UNIT);tree(m,i,beat(p,.25,.85)*(i%4===0?.8:1.1));}
 for(let i=0;i<9;i++){const x=(i%3-1)*r*.28+r*.18,y=(Math.floor(i/3)-1)*r*.22-r*.1;m.at(localPoint(site.origin,site.orientation,x,y),site.orientation,OBJECT_UNIT);tree(m,i+1,beat(p,.35,.9)*.65);if(p>.9)for(const dx of [-1.4,1.4])m.ellipsoid(dx,0,6,.24,.24,.24,'#be9066',6,3);}
 m.at(site.origin,site.orientation,OBJECT_UNIT);for(const [x,y] of [[-r*.45,-r*.53],[r*.45,r*.53],[-r*.56,r*.16]]){bench(m,x,y,beat(p,.72,1));}
 shade(m,-r*.43,r*.48,beat(p,.65,1));herbs(m,r*.48,-r*.47,beat(p,.5,1));
}
function buildSite(site,record,p=1,light=false){
 const m=new Mesh();m.at(site.origin,site.orientation,OBJECT_UNIT);m.kind=8;
 if(record.proposal)m.tint=c=>blend(c,PALETTE.paper,PROPOSAL_TINT);
 if(site.kind==='converted-hearth'){
  // Equipment belongs to an existing household. Its attachment is explicit in
  // the audit; a purchased conversion never creates another home.
  const home=site.home;m.at(home.origin,home.orientation,OBJECT_UNIT);m.box(0,0,7.7*p,1.2,1.2,4*p,'#a78668');m.box(0,0,11.7*p,1.8,1.8,.25,dark);m.box(2,-10,.04,3,2,2.6*p,'#ba9c78');m.cylinder(2,-10,2.6*p,.75,.16,dark,10);return m.pack();
 }
 const r=site.radius/OBJECT_UNIT,early=beat(p,.03,.38);ground(m,r,early);
 const tree=light?growingTree:steppeTree;
 if(site.kind==='well-garden'){orchard(m,site,p,tree);return m.pack();}
 paths(m,[[[0,-r*.78],[0,-12],[0,0]],[[0,-12],[-18,-8]],[[0,-12],[18,-8]]],early,2.4);
 const build=beat(p,.16,.8),finish=beat(p,.65,1);
 switch(site.kind){
  case 'cart-yard':
   paths(m,[[[-8,-r*.7],[-8,r*.7]],[[8,-r*.7],[8,r*.7]]],early,4);shade(m,20,10,build);table(m,20,10,finish);for(const x of [16,22])m.box(x,9,2.8,4,3,2.4*finish,'#b7a382');sign(m,-19,-8,PALETTE.textile,finish);bench(m,20,-10,finish);break;
  case 'crossing-keeper':case 'child-crossing':
   paths(m,[[[0,-r*.72],[0,r*.72]],[[-r*.72,4],[r*.72,4]]],early,5);
   shade(m,20,-16,build);sign(m,14,11,PALETTE.indigo,finish);sign(m,-14,-11,PALETTE.indigo,finish);
   for(const x of [-8,8])for(const y of [-22,-12,13,23])m.box(x,y,0,.32,.32,2.8*finish,timber);
   for(const x of [-8,8])for(const [a,b] of [[-22,-12],[13,23]])m.beam([x,a,2.3*finish],[x,b,2.3*finish],.08,PALETTE.felt,5);
   if(site.kind==='child-crossing')for(const x of [-17,-11,-5,1,7,13,19])m.box(x,4,.09,3,5,.05,PALETTE.felt);
   bench(m,20,-16,finish);break;
  case 'caravan-yard':
   m.at(localPoint(site.origin,site.orientation,-20,13),site.orientation,OBJECT_UNIT*.88);yurt(m,{variant:site.index,progress:build});m.at(site.origin,site.orientation,OBJECT_UNIT);
   shade(m,19,10,build);m.box(19,10,0,12,9,4*finish,timber);for(const x of [15,22])m.ellipsoid(x,10,4*finish,2,2.5,1.8,'#b7a382',8,4);
   m.box(0,24,0,14,4,2.2*finish,timber);m.kind=1;m.box(0,24,2*finish,12,3,.07,PALETTE.water);m.kind=8;
   for(const x of [-20,-8,8,20])m.box(x,-19,0,.4,.4,4*finish,timber);m.beam([-21,-19,3.3*finish],[21,-19,3.3*finish],.12,timber,6);bench(m,24,-10,finish);sign(m,-28,-4,PALETTE.textile,finish);
   if(finish>.9)for(const x of [-22,22]){m.at(localPoint(site.origin,site.orientation,x,-25),site.orientation,OBJECT_UNIT);animal(m,'horse',0);m.at(site.origin,site.orientation,OBJECT_UNIT);m.beam([x,-28.1,6],[x*.84,-19,3.5],.045,'#b6a07c',5);}break;
  case 'windbreak':
   for(let i=0;i<34;i++){const x=(i%17-8)*8.3,y=(Math.floor(i/17)-.5)*13;m.at(localPoint(site.origin,site.orientation,x,y),site.orientation,OBJECT_UNIT);tree(m,i,beat(p,.15+(i%8)*.035,.6+(i%8)*.035)*(i%5===0?.8:1));}
   m.at(site.origin,site.orientation,OBJECT_UNIT);herbs(m,-10,-26,finish);herbs(m,10,-26,finish);paths(m,[[[-r*.75,-22],[r*.75,-22]]],early,2.4);bench(m,r*.65,-27,finish);break;
  case 'lesson-court':
   for(const [i,x] of [-18,18].entries()){m.at(localPoint(site.origin,site.orientation,x,16),site.orientation,OBJECT_UNIT*.82);yurt(m,{variant:i,progress:build});}m.at(site.origin,site.orientation,OBJECT_UNIT);
   for(const [i,x] of [-12,0,12].entries()){m.box(x,-12,.08,9,12*finish,.08,[PALETTE.textile,PALETTE.indigo,PALETTE.pine][i]);for(const y of [-16,-8])m.box(x,y,.18,7,.17,.025,PALETTE.brass);}
   for(const x of [-4,4])m.box(x,1,0,.3,.3,6*finish,timber);m.box(0,1,2.8*finish,8,.3,3*finish,PALETTE.indigo);for(const y of [3.6,4.5])for(const x of [-2,1])m.box(x,.82,y*finish,1.5,.03,.1,PALETTE.felt);
   shade(m,-30,-15,build);table(m,-30,-15,finish);m.box(-30,-15,2.8,3,2,.3,PALETTE.felt);for(const x of [-30,30])bench(m,x,5,finish);break;
  case 'treatment-court':
   m.at(localPoint(site.origin,site.orientation,0,13),site.orientation,OBJECT_UNIT*.9);yurt(m,{variant:1,progress:build});m.at(site.origin,site.orientation,OBJECT_UNIT);
   shade(m,-19,-10,build);for(const x of [-24,-14])bench(m,x,-10,finish);table(m,20,-2,finish);vessel(m,19,-2,2.8);m.box(22,-2,2.8,2.5,2,.3,PALETTE.felt);herbs(m,19,17,finish);herbs(m,-19,18,finish);sign(m,12,-20,PALETTE.pine,finish);break;
  case 'contest-yard':{
   const variant=site.index%3;m.cylinder(0,0,.08,22,.08,'#bcaa88',32);
   if(variant===0){for(let i=0;i<24;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12;m.beam([Math.cos(a)*18,Math.sin(a)*18,.2],[Math.cos(b)*18,Math.sin(b)*18,.2],.13,PALETTE.felt,5);}for(const x of [-5,0,5])m.ellipsoid(x,0,.6,.4,.4,.4,PALETTE.brass,6,3);}
   if(variant===1){for(const x of [-18,18])m.box(x,10,0,.5,.5,6*finish,timber);m.beam([-18,10,5.5*finish],[18,10,5.5*finish],.13,PALETTE.textile,6);m.box(0,0,.12,25,1,.06,PALETTE.felt);}
   if(variant===2){for(let i=0;i<6;i++)m.cylinder((i-2.5)*5,0,0,.7,2.5*finish,timber,7);for(const x of [-16,16])m.box(x,12,0,.5,.5,5*finish,timber);m.beam([-16,12,4.5*finish],[16,12,4.5*finish],.13,timber,5);}
   for(const x of [-29,29])bench(m,x,0,finish);shade(m,0,30,build);break;}
  case 'watch-post':
   shade(m,0,6,build);bench(m,0,6,finish);for(const x of [-17,17]){m.at(localPoint(site.origin,site.orientation,x,-8),site.orientation,OBJECT_UNIT);lantern(m,finish);}m.at(site.origin,site.orientation,OBJECT_UNIT);sign(m,11,7,PALETTE.indigo,finish);break;
  case 'petition-court':
   m.at(localPoint(site.origin,site.orientation,0,11),site.orientation,OBJECT_UNIT*.78);yurt(m,{variant:2,progress:build});m.at(site.origin,site.orientation,OBJECT_UNIT);shade(m,0,-17,build);table(m,0,-17,finish);m.box(-1,-17,2.8,3,2,.08,PALETTE.felt);m.box(14,-7,0,4,3,7*finish,PALETTE.indigo);m.box(14,-8.55,5*finish,2,.05,.35,dark);for(const x of [-14,14])bench(m,x,-23,finish);sign(m,-15,6,PALETTE.indigo,finish);break;
  case 'water-court':
   paths(m,[[[0,-12],[25,-10],[25,3]],[[0,-12],[-25,-10],[-25,3]]],early,3);
   well(m,build);for(const [i,x] of [-25,25].entries()){m.box(x,14,0,18,21,7*build,'#b09270');m.box(x,14,7*build,20,23,.4,PALETTE.felt);m.box(x,3.35,0,3.6,.3,5.5*build,dark);m.box(x+4,14,7*build,1,1,3*finish,timber);}table(m,-20,-17,finish);for(const x of [-5,5,11])vessel(m,x,-12);m.box(23,-17,0,9,5,2*finish,timber);break;
  case 'aid-base':
   m.at(localPoint(site.origin,site.orientation,0,10),site.orientation,OBJECT_UNIT*.9);yurt(m,{variant:1,progress:build});m.at(site.origin,site.orientation,OBJECT_UNIT);shade(m,-19,-12,build);table(m,-19,-12,finish);for(const x of [-22,-19,-16]){m.beam([x,-13,2.8],[x,-10,2.8],.12,dark,5);m.box(x,-10,2.8,1.5,.25,.35,dark);}m.box(20,-12,0,9,5,3.5*finish,timber);m.box(19,9,0,.65,.65,19*build,timber);m.box(19,9,14*build,7,.7,3*finish,PALETTE.textile);break;
 }
 return m.pack();
}
export const programSiteArchitecture=(site,record,progress=1)=>buildSite(site,record,progress);
function connectorMesh(site,record,p){if(!site.approach||site.hostHomeId)return new ArrayBuffer(0);const m=new Mesh();m.kind=4;if(record.proposal)m.tint=c=>blend(c,PALETTE.paper,PROPOSAL_TINT);const route=site.approach;const width=['M1','M3'].includes(record.id)?.00048:.00018;
 if(record.id==='M1')for(const side of [-1,1]){const lane=route.map((point,i)=>{const a=route[Math.max(0,i-1)],b=route[Math.min(route.length-1,i+1)],angle=Math.atan2(b[1]-a[1],b[0]-a[0]);return [point[0]-Math.sin(angle)*.00016*side,point[1]+Math.cos(angle)*.00016*side];});m.ribbon(lane,.00020,side<0?'#c4b491':'#cfbe9c',beat(p,.02,.4),.000095);}
 else m.ribbon(route,width,'#c4b491',beat(p,.02,.4),.000095);
 if(record.id==='M10')for(let i=0;i<4;i++){const q=routeAt(route,(i+.5)/4),side=i%2?-1:1;m.at([q.point[0]-Math.sin(q.angle)*.00018*side,q.point[1]+Math.cos(q.angle)*.00018*side,.00006],q.angle,OBJECT_UNIT);lantern(m,beat(p,.35,.95));}
 return m.pack();}
export const programConnectorArchitecture=(site,record,progress=1)=>connectorMesh(site,record,progress);
export function programVisibilityBand(zoom=7){return zoom<25?0:Math.max(25,Math.floor(zoom/35)*35);}
export function programSiteVisible(site,shared){const band=programVisibilityBand(shared.zoom);if(!band||!shared.center)return true;const reach=1.8/band+.025;return Math.hypot(site.origin[0]-shared.center[0],site.origin[1]-shared.center[1])<reach+site.radius;}
export function programArchitecture(record,shared={},progress=1){const buffers=[];for(const site of programSites(record)){
 if(!programSiteVisible(site,shared))continue;
 if(site.legacy&&record.id!=='M4')continue;
 const key=`${site.key}:${record.proposal?'preview':'delivered'}`;
 buffers.push(progress===1?boundedCache(key,()=>buildSite(site,record)):buildSite(site,record,progress,(shared.zoom??7)<25));
 if(!site.legacy)buffers.push(progress===1?boundedCache(`${key}:access`,()=>connectorMesh(site,record,1)):connectorMesh(site,record,progress));
 }return joinProgramMeshes(buffers);}
export function programEvidenceState(record){
 const effects=(record.evidence??[]).flatMap(row=>row.measureEffects??[]).filter(effect=>effect.initiativeIds?.includes(record.id));
 return {baseline:record.phase==='baseline',benefit:record.phase==='evaluated'?effects.some(e=>e.amount>0):record.phase!=='baseline',slowdown:record.id==='M11'&&(record.phase!=='evaluated'||effects.some(e=>e.indicatorId==='T1'&&e.amount<0)),cleaner:record.id==='M5'&&(record.phase!=='evaluated'||effects.some(e=>e.indicatorId==='E2'&&e.amount>0))};
}
export function programWitnesses(record,shared={},budget={remaining:160}){
 const m=new Mesh(),seconds=shared.reducedMotion?4:shared.seconds??0,state=programEvidenceState(record),baseline=state.baseline;
 const person=(site,x,y,activity='talk',variant=0)=>{if(budget.remaining--<=0)return;m.at(localPoint(site.origin,site.orientation,x,y),site.orientation,OBJECT_UNIT*.88);villager(m,seconds*.75,variant,activity);};
 for(const site of programSites(record)){
  if(!programSiteVisible(site,shared)||budget.remaining<=0)continue;
  m.kind=8;
  if(site.hostHomeId){
   const clean=!baseline&&state.cleaner,home=site.home;m.at(home.origin,home.orientation,OBJECT_UNIT);m.kind=9;for(let i=0;i<(clean?1:4);i++){const drift=Math.sin(seconds*.12+i)*.6;m.ellipsoid(drift,0,12+i*(clean?1.2:1.7),clean?.35:1.4,clean?.35:1.1,clean?.4:.6,clean?'#aaa694':'#8d8a7c',7,4);}m.kind=8;continue;
  }
  if(site.legacy&&['M1','M3','M6','M11'].includes(record.id))continue;
  if(baseline){
   // Baseline witnesses use ordinary work and unmet queues on the same land.
   // There are no purchased yurts, orchards, lamps, guides or wells here.
   if(['M1','M2','M3','M11'].includes(record.id)){m.at(localPoint(site.origin,site.orientation,-5,-22),site.orientation,OBJECT_UNIT);cart(m);person(site,13,-20,'idle',2);}
   else if(record.id==='M13'){person(site,-8,-9,'work',0);person(site,9,-10,'idle',0);}
   else if(['M7','M8','M12','M14'].includes(record.id)){person(site,-10,-14,'idle',1);person(site,10,-14,'talk',2);}
   else person(site,-10,-12,'talk',site.index);continue;
  }
  switch(record.id){
   case 'M1':case 'M3':{
    if(site.approach&&budget.remaining-->0){const q=programRoutePose(site.approach,seconds,{period:record.id==='M3'?130:78,offset:site.index*17}),laneOffset=record.id==='M1'?Math.cos(q.turn)*.00016:0,point=[q.point[0]-Math.sin(q.routeAngle)*laneOffset,q.point[1]+Math.cos(q.routeAngle)*laneOffset];m.at([...point,.00006],q.angle,OBJECT_UNIT);if(record.id==='M3'){
      animal(m,'camel',q.waiting?0:seconds*.7);const length=site.approach.slice(1).reduce((total,b,i)=>total+Math.hypot(b[0]-site.approach[i][0],b[1]-site.approach[i][1]),0);for(let i=1;i<=2;i++){if(budget.remaining--<=0)break;const progress=q.progress+(q.returning?1:-1)*i*.00065/Math.max(.0001,length);if(progress<0||progress>1)continue;const a=routeAt(site.approach,progress);m.at([...a.point,.00006],q.angle,OBJECT_UNIT);animal(m,'camel',q.waiting?0:seconds*.7+i);}
     }else cart(m);}
    if(record.id==='M3'){
     if(budget.remaining-->0){const exchange=programRoutePose([[-12,-28],[0,-32],[12,-28]],seconds,{period:62,offset:site.index*7,wait:9});m.at(localPoint(site.origin,site.orientation,...exchange.point),site.orientation+exchange.angle,OBJECT_UNIT);animal(m,'horse',exchange.waiting?0:seconds*.7);}
     person(site,18,-30,'work',0);
    }
    person(site,16,-5,'work',3);break;
   }
   case 'M2':case 'M11':{
    if(site.legacy&&record.id==='M2'){person(site,14,0,'work',3);if(budget.remaining-->0){m.at(localPoint(site.origin,site.orientation,5,23+Math.sin(seconds*Math.PI/45)),site.orientation,OBJECT_UNIT);cart(m);}break;}
    const crossingSeconds=seconds*(record.id==='M11'&&state.slowdown?.68:1),cycle=programCrossingCycle(crossingSeconds,site.index*3),pose=programCrossingCartPose(crossingSeconds,site.index*3);
    if(budget.remaining-->0){m.at(localPoint(site.origin,site.orientation,...pose.point),site.orientation+pose.angle,OBJECT_UNIT);cart(m);}
    person(site,18,-15,'work',3);
    m.at(localPoint(site.origin,site.orientation,18,-15),site.orientation,OBJECT_UNIT);m.box(1.2,-.5,4.3,1.5,.12,.8,cycle.cartOpen?PALETTE.felt:cycle.herdOpen?PALETTE.textile:PALETTE.indigo);
    if(record.id==='M2')for(let i=0;i<3;i++){if(budget.remaining--<=0)break;const x=cycle.herdOpen?-28+56*cycle.herdProgress-i*4:-28-i*4;m.at(localPoint(site.origin,site.orientation,x,4),site.orientation+Math.PI/2,OBJECT_UNIT);creature(m,'sheep',cycle.herdOpen?seconds*.8:0,i,cycle.herdOpen?0:1);}
    else {const x=cycle.herdOpen?-22+44*cycle.herdProgress:-22;person(site,x,4,cycle.herdOpen?'play':'talk',1);person(site,x-4,4,cycle.herdOpen?'play':'talk',3);}
    break;
   }
   case 'M4':person(site,-site.radius/OBJECT_UNIT*.43,site.radius/OBJECT_UNIT*.42,'talk',2);person(site,11,-12,'work',0);break;
   case 'M6':person(site,-8,-25,'work',2);person(site,11,-26,'work',3);break;
   case 'M7':{
    person(site,5,-2,'talk',2);person(site,-8,-14,'play',1);person(site,8,-14,'play',3);
    if(budget.remaining-->0){const arrival=programRoutePose([[0,-45],[0,-30],[0,-21]],seconds,{period:75,offset:site.index*11,wait:12});m.at(localPoint(site.origin,site.orientation,...arrival.point),site.orientation+arrival.angle,OBJECT_UNIT*.88);villager(m,arrival.waiting?0:seconds*.9,1,'play');}break;
   }
   case 'M8':person(site,-19,-12.2,'talk',0);person(site,18,-4,'work',3);break;
   case 'M9':person(site,-6+Math.sin(seconds*.6)*6,-3,'play',1);person(site,6-Math.sin(seconds*.6)*6,5,'play',3);break;
   case 'M10':{
    const q=site.approach?programRoutePose(site.approach,seconds,{period:95,offset:site.index*11}):null;if(q&&budget.remaining-->0){m.at([...q.point,.00006],q.angle,OBJECT_UNIT*.88);villager(m,seconds*.7,3,q.waiting?'talk':'walk');}person(site,-6,6,'talk',2);break;
   }
   case 'M12':{
    person(site,-5,-17,'work',1);const q=site.approach?programRoutePose(site.approach,seconds,{period:70,offset:site.index*13}):null;if(q&&budget.remaining-->0){m.at([...q.point,.00006],q.angle,OBJECT_UNIT*.88);villager(m,seconds*.8,1,q.waiting?'work':'walk');m.box(1,-.6,3,.15,1,1.2,q.returning?PALETTE.felt:PALETTE.textile);}break;
   }
   case 'M13':person(site,4,-8,'work',0);person(site,-20,-14,'work',3);break;
   case 'M14':{
    person(site,site.legacy?-13:-24,site.legacy?-4:-12,'work',3);if(site.approach&&budget.remaining-->0){const q=programRoutePose(site.approach,seconds,{period:110,offset:site.index*19,wait:14});m.at([...q.point,.00006],q.angle,OBJECT_UNIT*.88);villager(m,seconds*.75,3,q.waiting?'work':'walk');m.box(1.5,-.2,1.8,1.2,1.5,1.2,timber);}break;
   }
  }
 }return m.pack();
}
