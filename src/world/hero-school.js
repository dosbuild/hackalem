import {SCHOOL_BUILD_MS} from './construction-clock.js';
import {beat,blend,rgb,smooth} from './mesh-kit.js';
import {routeAt} from './placement-geometry.js';
import {PROPOSAL_TINT} from './construction-preparation.js';

// One authored event. All distances below are local toy metres, in the city depth pass.
export const isHeroSchool=o=>o?.key==='M7:nura';
export const SCHOOL_DURATION=SCHOOL_BUILD_MS/1000;
export const schoolClock=seconds=>seconds<SCHOOL_DURATION?seconds*22/SCHOOL_DURATION:22+seconds-SCHOOL_DURATION;
export function schoolPose(site,zoom=232,pitch=.82){
 const yaw=Math.PI*2-site.orientation-.28,focus=world(site,[0,-9,3]);
 return {x:focus[0]+Math.sin(yaw)*Math.tan(pitch)*focus[2],y:focus[1]+Math.cos(yaw)*Math.tan(pitch)*focus[2],yaw,pitch,zoom};
}
export function schoolChoreography(record,start,from,fly,overview,close){
 const alreadyHere=from.zoom>18&&Math.hypot(from.x-close.x,from.y-close.y)<.1,wide=schoolPose(record,72,.68),life=alreadyHere?{...from}:schoolPose(record,148,.82),district={...overview,x:record.origin[0],y:record.origin[1],zoom:3.4};
 const held=alreadyHere?{...from}:close;
 return {key:record.key,id:record.id,start,from:{...from},close:held,citywide:false,cancelled:false,duration:SCHOOL_DURATION,
  sample(now){const elapsed=Math.max(0,(now-start)/1000),t=schoolClock(elapsed);let pose,stage;
   // A confirmed preview is already a useful architectural view. Keep its
   // framing through delivery, occupation and return instead of replaying entry.
   if(alreadyHere){pose=held;stage=t<3.65?'approach':t<4.4?'anticipation':t<5.8?'arrival':t<12.8?'build':t<14.1?'activation':t<21.4?'people':t<22?'settle':'complete';}
   else if(t<.35){pose=fly(from,overview,t/.35,true);stage='overview';}
   else if(t<1.3){pose=fly(overview,district,(t-.35)/.95);stage='district';}
   else if(t<3.65){pose=fly(district,wide,(t-1.3)/2.35);stage='approach';}
   else if(t<4.4){pose=fly(wide,close,(t-3.65)/.75);stage='anticipation';}
   else if(t<5.8){pose=close;stage='arrival';}
   else if(t<12.8){pose=close;stage='build';}
   else if(t<14.1){pose=fly(close,life,(t-12.8)/1.3);stage='activation';}
   else if(t<18.5){pose=life;stage='people';}
   else if(t<21.4){pose=life;stage='people';}
   else{pose=life;stage=t<22?'settle':'complete';}
   return {pose,stage,progress:beat(t,5.6,13.7),people:beat(t,13.5,15.5),arrival:Math.sin(beat(t,3.9,5.1)*Math.PI)*.4,finish:Math.sin(beat(t,12.7,14.2)*Math.PI),settle:beat(t,21.4,22),citywide:false,duration:SCHOOL_DURATION,done:elapsed>=SCHOOL_DURATION};
  }};
}
export const world=(o,p)=>{const c=Math.cos(o.orientation),s=Math.sin(o.orientation);return [o.origin[0]+(p[0]*c-p[1]*s)*.0001,o.origin[1]+(p[0]*s+p[1]*c)*.0001,o.origin[2]+(p[2]||0)*.0001];};
const local=(o,p)=>{const x=(p[0]-o.origin[0])*1e4,y=(p[1]-o.origin[1])*1e4,c=Math.cos(o.orientation),s=Math.sin(o.orientation);return [x*c+y*s,-x*s+y*c];};
const mix=(a,b,t)=>a+(b-a)*t;
const at=(m,o,p=[0,0,0],a=0,k=1)=>m.at(world(o,p),o.orientation+a,.0001*k);
const ink='#493c34',cream='#e9deca',teal='#64888b',gold='#c39a61',dark='#39454c';
export const SCHOOL_WALKS={
 pavement:[[-41,-36],[41,-36]],
 workerWest:[[-30,-38],[-31,-27],[-29,-9]],workerEast:[[27,-38],[29,-28],[29,-8]],
 workerWestExit:[[-29,-9],[-31,-27],[-34,-37],[-64,-37]],workerEastExit:[[29,-8],[29,-29],[4,-37],[-62,-37]],
 family:[[-32,-62],[-32,-36],[-7,-36],[-2,-25],[-2,12]],
 play:[[34,-36],[9,-36],[7,-24],[16,-16]],bench:[[37,-36],[12,-36],[10,-24],[20,-24]]
};
const modules=[
 {x:-19,y:8,w:12,d:28,h:10,color:'#b78065',roof:'#58616a',start:5.8,end:7.5,angle:Math.PI/2},
 {x:19,y:8,w:12,d:28,h:10,color:'#b98066',roof:'#596571',start:8.3,end:10,angle:Math.PI/2},
 {x:0,y:16,w:26,d:12,h:13,color:'#d9ccb5',roof:'#5b6570',start:10.8,end:12.5,angle:0}
];
function roof(m,w,d,h,color){
 // A shallow hip keeps the original roof envelope; the cornice, ridge and seams
 // read as separate materials without a mesh of dark tile edges at distance.
 m.box(0,0,h-.20,w+.5,d+.5,.22,'#c7bca7');
 m.box(0,0,h+.02,w+1.2,d+1.2,.55,cream);
 const y=d/2+.9,x=w/2+.9,eave=h+.7,peak=h+2.7,hip=2.5;
 const front=[[-x,-y,eave],[x,-y,eave]],back=[[-x,y,eave],[x,y,eave]];
 const ridge=d>w?[[0,-y+hip,peak],[0,y-hip,peak]]:[[-x+hip,0,peak],[x-hip,0,peak]];
 if(d>w){
  m.quad(front[0],ridge[0],ridge[1],back[0],color);m.quad(ridge[0],front[1],back[1],ridge[1],color);
  m.tri(front[0],front[1],ridge[0],color);m.tri(back[1],back[0],ridge[1],color);
  for(let yy=-y+hip+2;yy<y-hip;yy+=4.5)for(const side of [-1,1]){
   const n=[side*(peak-eave)/x,0,1],length=Math.hypot(...n),normal=n.map(v=>v/length),a=[side*x,yy-.07,eave+.006],b=[0,yy-.07,peak+.006],c=[0,yy+.07,peak+.006],d=[side*x,yy+.07,eave+.006];
   m.tri(a,b,c,'#73808a',[normal,normal,normal]);m.tri(a,c,d,'#73808a',[normal,normal,normal]);
  }
 }else{
  m.quad(front[0],front[1],ridge[1],ridge[0],color);m.quad(ridge[0],ridge[1],back[1],back[0],color);
  m.tri(front[0],ridge[0],back[0],color);m.tri(front[1],back[1],ridge[1],color);
  for(let xx=-x+hip+2;xx<x-hip;xx+=4.5)for(const side of [-1,1]){
   const n=[0,side*(peak-eave)/y,1],length=Math.hypot(...n),normal=n.map(v=>v/length),a=[xx-.07,side*y,eave+.006],b=[xx-.07,0,peak+.006],c=[xx+.07,0,peak+.006],d=[xx+.07,side*y,eave+.006];
   m.tri(a,b,c,'#73808a',[normal,normal,normal]);m.tri(a,c,d,'#73808a',[normal,normal,normal]);
  }
 }
 // The ridge is a folded metal cap seated on both roof slopes. A half-buried
 // cylinder exposes alternating subpixel sides and produces a dotted highlight.
 const cap=.14,slope=(peak-eave)/(d>w?x:y),length=Math.hypot(slope,1),colorCap='#859099';
 for(const side of [-1,1]){
  const points=d>w?[[side*cap,ridge[0][1],peak-cap*slope+.012],[0,ridge[0][1],peak+.012],[0,ridge[1][1],peak+.012],[side*cap,ridge[1][1],peak-cap*slope+.012]]:[[ridge[0][0],side*cap,peak-cap*slope+.012],[ridge[0][0],0,peak+.012],[ridge[1][0],0,peak+.012],[ridge[1][0],side*cap,peak-cap*slope+.012]],normal=d>w?[side*slope/length,0,1/length]:[0,side*slope/length,1/length];
  m.tri(points[0],points[1],points[2],colorCap,[normal,normal,normal]);m.tri(points[0],points[2],points[3],colorCap,[normal,normal,normal]);
 }
 // Each hip is the same folded flashing, seated on the two adjacent planes.
 // Matching their normals keeps the small metal joint out of the ink pass.
 for(const sx of [-1,1])for(const sy of [-1,1]){
  const corner=[sx*x,sy*y,eave],end=d>w?ridge[sy<0?0:1]:ridge[sx<0?0:1],delta=end.map((v,i)=>v-corner[i]),span=Math.hypot(...delta),tangent=delta.map(v=>v/span),start=corner.map((v,i)=>v+tangent[i]*.35);
  const faces=d>w?[[[sx*slope,0,1],[sx*x,0,eave]],[[0,sy*(peak-eave)/hip,1],[-sx*x,sy*y,eave]]]:[[[0,sy*slope,1],[0,sy*y,eave]],[[sx*(peak-eave)/hip,0,1],[sx*x,-sy*y,eave]]];
  for(const [face,inside] of faces){
   const size=Math.hypot(...face),normal=face.map(v=>v/size),across=[normal[1]*tangent[2]-normal[2]*tangent[1],normal[2]*tangent[0]-normal[0]*tangent[2],normal[0]*tangent[1]-normal[1]*tangent[0]],width=Math.hypot(...across),direction=across.reduce((sum,v,i)=>sum+v*(inside[i]-start[i]),0)<0?-1:1;
   const offset=across.map(v=>v/width*cap*direction),a=start.map((v,i)=>v+(i===2?.012:0)),b=end.map((v,i)=>v+(i===2?.012:0)),c=b.map((v,i)=>v+offset[i]),d=a.map((v,i)=>v+offset[i]);
   m.tri(a,b,c,colorCap,[normal,normal,normal]);m.tri(a,c,d,colorCap,[normal,normal,normal]);
  }
 }
 for(const side of [-1,1]){m.box(side*x,0,eave-.12,.13,d+1.9,.18,'#5d6468');m.box(0,side*y,eave-.12,w+1.9,.13,.18,'#5d6468');}
 const chimneyX=d>w?w*.22:w*.32,chimneyY=d>w?d*.27:d*.18;
 m.box(chimneyX,chimneyY,h+.55,1.1,1.25,1.9,'#a8755d');m.box(chimneyX,chimneyY,h+2.4,1.35,1.5,.22,'#d7c8ae');
}
function facadeWindow(m,u,face,z,width,height,axis,side,glass){
 const put=(du,depth,bottom,ww,dd,hh,color)=>axis==='y'?m.box(u+du,face+side*depth,bottom,ww,dd,hh,color):m.box(face+side*depth,u+du,bottom,dd,ww,hh,color);
 put(0,.035,z-.16,width+.46,.12,height+.40,'#746e65');
 put(0,.13,z,width,.12,height,glass);
 for(const offset of [-width/2-.08,width/2+.08])put(offset,.25,z-.09,.16,.19,height+.21,cream);
 put(0,.25,z+height,width+.35,.21,.18,cream);
 put(0,.35,z-.24,width+.65,.55,.25,'#ddd0b7');
 put(0,.25,z+height*.46,width,.16,.13,cream);
 put(0,.25,z,.105,.16,height,cream);
 put(-width*.2,.20,z+height*.64,width*.22,.035,height*.28,'#b2c3c4');
}
function classroom(m,w,d,h,color,roofColor,lit=0){
 m.box(0,0,0,w,d,h,color);
 m.box(0,0,.06,w+.20,d+.20,.72,'#8d8d7c');m.box(0,0,.78,w+.28,d+.28,.18,'#b6ac94');
 // Every elevation receives the same bay rhythm, stone sills and quiet belt.
 m.box(0,0,2.26,w+.15,d+.15,.14,'#d9c9ab');m.box(0,0,8.18,w+.18,d+.18,.19,cream);
 for(const x of [-w/2,w/2])for(const y of [-d/2,d/2]){
  m.box(x,y,.80,.40,.40,h-.86,cream);
  for(let z=1.1;z<h-.7;z+=1.4)m.box(x,y,z,.63,.63,.36,'#d8c8ae');
 }
 const glass=blend('#7c959f','#d8bc83',lit*.22),bays=Math.max(2,Math.floor(w/4.8)),sideBays=Math.max(2,Math.floor(d/5.2));
 for(let i=0;i<bays;i++)for(const side of [-1,1]){
  const x=(i-(bays-1)/2)*w/bays;if(h>12&&side===-1&&Math.abs(x)<4)continue;
  facadeWindow(m,x,side*d/2,3,Math.min(3.05,w/bays-1.25),4.35,'y',side,glass);
 }
 for(let i=0;i<sideBays;i++)for(const side of [-1,1])facadeWindow(m,(i-(sideBays-1)/2)*d/sideBays,side*w/2,3,Math.min(3.2,d/sideBays-1.5),4.35,'x',side,glass);
 if(h>12){
  m.box(0,0,h-.55,w+.32,d+.32,.22,cream);
  for(const side of [-1,1])for(const x of [-8.5,8.5])facadeWindow(m,x,side*d/2,9.1,2.8,1.35,'y',side,glass);
 }
 roof(m,w,d,h,roofColor);
}
function shadow(m,x,y,w,d){m.ellipsoid(x,y,.08,w,d,.045,'#788772',10,2);}
function puff(m,o,x,y,t,seed=0){if(t<0||t>1)return;at(m,o);for(let i=0;i<6;i++){const a=i*Math.PI/3+seed,r=2+t*5,k=Math.sin(t*Math.PI)*(1.2+(i%2)*.8);m.box(x+Math.cos(a)*r,y+Math.sin(a)*r,.4+t*2,k,k,k,blend('#ddcda5','#b8bf9b',t));}}
function truck(m,o,pos,cargo,index,t){
 at(m,o,[...pos.point,.6],pos.angle);m.kind=8;
 // +x is the direction of travel. Cab and trailer share the surveyed route tangent.
 shadow(m,-3,0,19,4.4);m.box(-5,0,2.1,30,6.3,1.1,'#667974');m.box(13,0,1.9,7,6.3,5.7,index===1?'#dfba75':'#ca8a56');
 m.box(13,0,7.6,7.3,6.6,.5,cream);m.box(15.8,0,4.5,.3,5.5,2.1,'#3e6872');
 for(const s of [-1,1]){m.box(12.8,s*3.2,4.5,3.6,.15,2.1,'#426d76');m.box(13,s*3.32,2.7,3.8,.15,.3,cream);for(const x of [-16,-11,12]){m.ellipsoid(x,s*3.1,1.9,1.65,.72,1.65,dark,10,4);m.ellipsoid(x,s*3.73,1.9,.72,.1,.72,'#b9c1ae',8,4);}}
 m.box(12.6,-3.32,5,1,.16,1.15,'#c69770');m.box(12.6,-3.33,6.1,1.1,.17,.35,dark);m.box(16.5,0,2,1,6.7,.7,'#d9d8bc');for(const s of [-1,1]){m.kind=11;m.box(16.65,s*2,3.5,.2,1.2,.7,'#ffe1a0');}m.kind=8;
 if(cargo){at(m,o,[pos.point[0]+Math.cos(pos.angle)*-5,pos.point[1]+Math.sin(pos.angle)*-5,3.9],pos.angle);const origin=m.origin; m.at(origin,m.angle+(cargo.angle?Math.PI/2:0),m.scale);classroom(m,cargo.w,cargo.d,cargo.h,cargo.color,cargo.roof);m.at(origin,m.angle-(cargo.angle?Math.PI/2:0),m.scale);for(const x of [-10,10])m.box(x,0,cargo.h+3,1,12,.16,'#f1cc7e');}
}
const routeDistance=route=>route.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-route[i][0],p[1]-route[i][1]),0);
function along(route,d){return routeAt(route,d/routeDistance(route));}
function cranes(m,o,t,lift){
 if(t>=17.8)return;
 const out=beat(t,14.3,17.8),arrival=beat(t,3.85,5.3),base=t<5.3?[-34,mix(-46,-8,arrival)]:out<.52?[-34,mix(-8,-46,smooth(out/.52))]:[mix(-34,-105,smooth((out-.52)/.48)),-46];
 at(m,o,[...base,.4]);shadow(m,0,0,7,5);m.box(0,0,1.2,12,7,2.5,'#d8a55a');
 for(const x of [-4,4])for(const s of [-1,1])m.ellipsoid(x,s*3.5,1.6,1.4,.6,1.4,dark,8,4);
 const fold=Math.max(1-arrival,beat(t,12.9,14.3)),mast=mix(24,6,fold);m.box(0,0,3,3.5,3.5,mast,'#d4a45e');m.box(3,-1,3,4.5,4.8,5,'#dfa95b');m.box(3,-3.5,5.5,3.5,.2,2,'#416d76');
 if(out<.05&&arrival>.96)for(const s of [-1,1]){m.beam([0,s*2,2],[0,s*7,.5],.5,cream);m.box(0,s*7,0,3,3,.5,ink);}
 const tip=lift?[lift.x,lift.y,44]:[mix(-8,base[0]-10,fold),mix(-18,base[1],fold),mix(40,8,fold)];
 const a=[base[0],base[1],3+mast],b=tip;at(m,o);
 for(const z of [0,-1.8])m.beam([a[0],a[1],a[2]+z],[b[0],b[1],b[2]+z],.38,'#eac179',6);
 for(let i=0;i<9;i++){const f=i/9,g=(i+1)/9;m.beam([mix(a[0],b[0],f),mix(a[1],b[1],f),mix(a[2],b[2],f)-1.8],[mix(a[0],b[0],g),mix(a[1],b[1],g),mix(a[2],b[2],g)],.14,'#a47f4d',4);}
 const bottom=lift?lift.z+lift.h+3:tip[2]-4;m.beam(tip,[tip[0],tip[1],bottom],.1,dark,5);
 if(lift&&!lift.empty){for(const s of [-1,1])m.beam([tip[0],tip[1],bottom],[lift.x+s*5,lift.y,lift.z+lift.h+2],.1,dark,5);}else m.beam([tip[0],tip[1],bottom],[tip[0]+.9,tip[1],bottom+.8],.18,dark,5);
}
function tree(m,x,y,growth=1){if(!growth)return;m.cylinder(x,y,.5,.4,5*growth,'#8f7755',6);m.ellipsoid(x,y,8*growth,3.9*growth,3.6*growth,4.4*growth,'#91b481',8,4);m.ellipsoid(x-1.8,y-.6,7*growth,2.6*growth,2.5*growth,3.1*growth,'#b4c997',8,4);}
function bench(m,x,y){for(const dx of [-2,2])m.box(x+dx,y,.4,.4,1.6,1.4,ink);for(let i=0;i<3;i++)m.box(x,y+(i-1)*.65,1.8,6,.45,.3,'#bc915d');m.box(x,y+1,2.1,6,.35,1.4,'#d6b17b');}
const glyphs={М:['10001','11011','10101','10001','10001'],Е:['111','100','110','100','111'],К:['101','110','100','110','101'],Т:['111','010','010','010','010'],П:['111','101','101','101','101']};
function sign(m){m.box(0,9.64,10.45,19,.35,3.4,'#326c72');let x=-7.7;for(const c of 'МЕКТЕП'){const g=glyphs[c];g.forEach((row,y)=>[...row].forEach((v,i)=>{if(v==='1')m.box(x+i*.52,9.42,10.8+(4-y)*.52,.44,.18,.44,cream);}));x+=(g[0].length+1)*.52;}}
function finish(m,o,t){const q=beat(t,12.4,13.5),live=beat(t,13,14);if(q<=0)return;at(m,o);
 // Paving, threshold and a quiet rear boundary make the school a street place.
 m.box(0,-13,.715,17,43,.065,'#d9d0b8');
 // Joints are coplanar color, not tiny raised bars whose side normals produce
 // dark broken contours when the whole school is shown in a catalogue card.
 for(let y=-29;y<7;y+=7.6)m.quad([-8.4,y-.045,.782],[8.4,y-.045,.782],[8.4,y+.045,.782],[-8.4,y+.045,.782],'#c8bea7');
 for(const x of [-5.6,5.6])m.quad([x-.045,-34,.782],[x+.045,-34,.782],[x+.045,8,.782],[x-.045,8,.782],'#c8bea7');
 for(let i=0;i<3;i++)m.box(0,8.15+i*.53,.78+i*.07,7.4,1.45-i*.3,.09,'#e5d9c1');
 m.quad([5,5,.80],[8,5,.80],[8,10,1.01],[5,10,1.01],'#d5cbb5');
 for(const x of [-4.1,4.1])m.box(x,9.9,.8,.72,.85,7.05,cream);
 for(const x of [-32.5,32.5]){
  for(let y=-26;y<=28;y+=9)m.box(x,y,.7,.36,.36,2.2,ink);
  for(const z of [1.3,2.5])m.beam([x,-26,z],[x,28,z],.075,'#6e7464',5);
 }
 for(let x=-32.5;x<=33;x+=8.2)m.box(x,28,.7,.36,.36,2.2,ink);
 for(const z of [1.3,2.5])m.beam([-32.5,28,z],[32.5,28,z],.075,'#6e7464',5);
 // The entrance is physically open; sliding leaves clear a central path.
 m.box(0,10,1,7,.35,6.7,'#46565c');for(const side of [-1,1]){m.box(side*(1.65+live*1.8),9.72,1,3.1,.25,6.5,'#92aeb4');m.box(side*(1.65+live*1.8),9.52,1,.12,.1,6.5,cream);}
 m.box(0,7.3,7.8,12,7.7,.55,cream);for(const x of [-5.3,5.3])m.box(x,4.1,.7,.32,.32,7.1,'#d7b171');
 m.kind=11;m.box(0,4.05,7.7,10.3,.22,.22,blend('#c8b182','#ffe0a0',live));m.kind=8;sign(m);
 // Clock, welcoming warm panes and a small flag give a recognisable civic silhouette.
 m.ellipsoid(0,9.65,15.1,1.35,.18,1.35,cream,12,4);m.beam([0,9.43,15.1],[0,9.43,16.05],.1,ink);m.beam([0,9.42,15.1],[.65,9.42,14.8],.1,ink);
 m.cylinder(8,16,16,.15,8*q,cream,6);m.quad([8,16,24*q],[12,16+Math.sin(t*2)*.35,23.7*q],[12,16+Math.sin(t*2)*.35,21.3*q],[8,16,21.5*q],'#65b9bc');
 for(const [x,y] of [[-28,-23],[28,-23]]){m.box(x,y,.7,7,6,.16,'#897f64');m.box(x,y,.75,7.5,6.5,.12,'#c2b398');tree(m,x,y,q);}
 bench(m,-21,-22);bench(m,20,-22);
 for(const [x,col] of [[14,'#dca35f'],[18,'#7faeac'],[22,'#c18464']])m.box(x,-14,.6,3,3,(1.6+(x%3)*.5)*q,col);
 // Inlaid stepping stones and a tiny play arch, contained within the forecourt.
 for(let i=0;i<6;i++)m.box(-7+(i%2)*1.6,-27+i*4,.72,2.2,2,.08,i%2?cream:'#c0a978');
 for(const x of [13,25])m.beam([x,-11,.7],[x,-11,7*q],.28,teal);m.beam([13,-11,7*q],[25,-11,7*q],.3,gold);
 for(const x of [18,20])m.beam([x,-11,7*q],[x,-11,2.5],.07,ink);m.box(19,-11,2.3,3,2,.35,'#dbac6e');
 // One brief roof-edge light, not a permanent finishing halo.
 const flash=Math.sin(beat(t,12.65,13.65)*Math.PI);if(flash>.001){m.kind=11;for(const a of modules){m.ribbon([[a.x-a.w/2,a.y-a.d/2],[a.x+a.w/2,a.y-a.d/2],[a.x+a.w/2,a.y+a.d/2]],.12+.3*flash,'#ffe9b2',1,a.h+1.45);}m.kind=8;}
}
function walk(path,t,start,end){const q=routeAt(path,Math.max(0,Math.min(1,(t-start)/(end-start))));return {...q,moving:t>start&&t<end};}
// A dedicated cast with roles and routes. They do not enter the evaluator or resident registry.
function person(m,o,x,y,angle,t,{coat='#bc855a',skin='#c79671',hair='#4c443c',child=false,worker=false,bag=false,gesture=0,moving=false}={}){
 const k=child?.272:.4,step=moving?Math.sin(t*10+x*.1):0;at(m,o,[x,y,.8],angle,k);shadow(m,0,0,1.3,.9);
 for(const s of [-1,1]){m.beam([s*.55,0,2.4],[s*.55,s*step*.58,.5],.35,'#455d64',5);m.box(s*.55,-.3+s*step*.58,.1,.7,1.1,.55,dark);}
 m.box(0,0,2.15,2,1.15,1.95,coat);m.box(0,0,4.12,.5,.5,.3,skin);m.box(0,0,4.4,1.65,1.35,1.45,skin);m.box(0,.2,5.6,1.8,1.3,.5,hair);m.box(0,.58,4.85,1.8,.4,1.1,hair);
 for(const s of [-1,1]){m.beam([s*1.05,0,3.8],[s*1.3,-s*step*.55-(gesture&&s===1?.9:0),2.4+(gesture&&s===1?1.4:0)],.34,coat,5);m.box(s*1.3,-s*step*.55-(gesture&&s===1?.9:0),2.25+(gesture&&s===1?1.4:0),.5,.5,.5,skin);m.box(s*.35,-.7,5.1,.19,.08,.23,dark);}
 if(worker){m.box(0,0,5.87,1.9,1.65,.5,'#f5c46b');m.box(0,-.28,5.82,2.1,2,.17,'#e0a64e');for(const x of [-.65,.65])m.box(x,-.6,2.4,.25,.15,1.45,cream);m.box(0,-.65,2.75,2.1,.15,.24,cream);}
 if(bag){m.box(0,.85,2.6,1.65,.75,1.45,child?'#e2b461':'#648d86');m.box(-.8,.85,2.9,.3,.8,.7,cream);}
}
function cast(m,o,t,detail){if(!detail)return;
 const life=t<22?t:13.8+((t-22)%16);
 const draw=(path,a,b,look,style,until=Infinity,clock=t)=>{if(clock<a||clock>until)return;const p=walk(path,clock,a,b);person(m,o,...p.point,p.moving?p.angle+Math.PI/2:look,t,{...style,moving:p.moving});};
 // Ordinary life is already on the sidewalk before construction begins.
 const stroll=t<14?t:14+((t-14)%22);
 draw(SCHOOL_WALKS.pavement,0,13,-Math.PI/2,{coat:'#8b9faa',bag:true},13.4);
 if(t<14){const p=walk([[40,-36],[-38,-36]],t,1.5,14);person(m,o,...p.point,p.angle+Math.PI/2,t,{coat:'#c99479',moving:p.moving});}
 if(t<16.6){
  const w1=t<12.9?walk(SCHOOL_WALKS.workerWest,t,4.8,6.2):walk(SCHOOL_WALKS.workerWestExit,t,12.9,16.6);
  if(t>4.8)person(m,o,...w1.point,w1.moving?w1.angle+Math.PI/2:-.7,t,{coat:'#da984e',worker:true,moving:w1.moving,gesture:!w1.moving});
  const w2=t<12.8?walk(SCHOOL_WALKS.workerEast,t,5,6.7):walk(SCHOOL_WALKS.workerEastExit,t,12.8,16.2);
  if(t>5)person(m,o,...w2.point,w2.moving?w2.angle+Math.PI/2:.7,t,{coat:'#d9b05a',skin:'#a8775a',worker:true,moving:w2.moving,gesture:!w2.moving&&Math.sin(t*4)>.2});
 }
 // After the first handoff, the same routes repeat slowly so revisiting is inhabited.

 if(life>=13.7&&life<18.05){
  const a=walk(SCHOOL_WALKS.family,life,13.7,17.95);
  person(m,o,...a.point,a.moving?a.angle+Math.PI/2:0,t,{coat:'#b77259',bag:true,moving:a.moving});
  person(m,o,a.point[0]+2.5,a.point[1]-.4,a.angle+Math.PI/2,t,{coat:'#6d9da8',child:true,bag:true,moving:a.moving,skin:'#bb8968'});
 }
 if(life>=14.1){draw(SCHOOL_WALKS.play,14.1,17.2,.35,{coat:'#84a084',child:true,bag:true},28,life);}
 if(life>=14.35){const p=walk(SCHOOL_WALKS.bench,life,14.35,18.1);person(m,o,...p.point,p.moving?p.angle+Math.PI/2:0,t,{coat:'#d4bb8e',skin:'#b47e5d',moving:p.moving});}
 if(life>13.6){person(m,o,5,5,-.6,t,{coat:'#7b9b94',hair:'#6e5a47',gesture:life<17.7});}
 if(t>18.7){const p=walk([[-44,-36],[40,-36]],stroll,18.7,35.5);person(m,o,...p.point,p.angle+Math.PI/2,t,{coat:'#7e929d',bag:true,moving:true});}
}
export function schoolScene(m,o,options){
 const active=options.active?.key===o.key,preview=o.proposal;
 let t=preview?0:schoolClock(active?options.active.elapsed:(options.schoolTime??30));
 if(!Number.isFinite(t))t=30;
 const close=(options.zoom||1)>24;
 m.kind=8;m.tint=c=>preview?blend(c,'#e9e3c7',PROPOSAL_TINT):rgb(c);at(m,o);
 // A street-facing pavement belongs to the existing neighbourhood before the first load.
 m.box(0,-36,.04,84,5.5,.35,'#c9c5aa');
 if(preview){
  m.ribbon([[-39,-31],[39,-31],[39,31],[-39,31],[-39,-31]],.5,'#c7a577',1,.45);
  m.box(0,0,0,66,59,.7,'#c9bf9d');
  for(const a of modules){at(m,o,[a.x,a.y,.8]);classroom(m,a.w,a.d,a.h,a.color,a.roof);}
  finish(m,o,30);m.kind=8;m.tint=rgb;return;
 }
 const foundation=beat(t,5.2,5.8);
 if(foundation>0){m.box(0,0,0,66,59,.7*foundation,'#c9bf9d');m.box(0,-29,.15,66,1,.6,'#efdbb0');m.box(0,-32,.08,9,7,.2,'#d6c9a4');}
 if(t>4.65&&t<13.5){
  // Survey corners, stacked materials and barriers disappear with the crew.
  for(const x of [-32,32])for(const y of [-29,29]){if(t<4.65+(x+32)/160+(y+29)/160)continue;m.cylinder(x,y,.3,.17,3,cream,6);m.box(x,y,2.4,1,.3,.5,gold);}
  for(const x of [-18,18]){m.box(x,-30,1.2,11,.6,1.1,'#d9ad66');for(const dx of [-4,4])m.box(x+dx,-30,.3,.4,2,1.2,ink);for(const dx of [-3,0,3])m.box(x+dx,-30,1.2,1.3,.7,1.1,cream);}
  for(let i=0;i<3;i++)m.box(31,-9+i*4,.7,4,3,1.3,'#c2a575');
 }
 const route=o.deliveryRoute.map(p=>local(o,p)),total=routeDistance(route);
 // Stop is on the straight source road, with the load aligned in front of the crane.
 let stop=0;for(let i=1;i<route.length;i++){if(route[i][0]<0&&Math.abs(route[i][1]+46)<.01){stop=routeDistance(route.slice(0,i))+route[i-1][0]-0;break;}}
 let lift=null;
 modules.forEach((a,i)=>{
  const begin=a.start-1.6,pick=a.start+.28,depart=a.start+.72;
  if(close&&t>begin&&t<depart+2.25){const distance=t<a.start?mix(stop-130,stop,beat(t,begin,a.start)):mix(stop,Math.min(total,stop+175),beat(t,depart,depart+2.25)),pos=along(route,distance);truck(m,o,pos,t<pick?a:null,i,t);}
  if(t<a.start+.28)return;
  let p=[a.x,a.y,.8],angle=0;
  if(t<a.end){const q=beat(t,a.start+.28,a.end),swing=beat(q,.12,.72),lower=beat(q,.65,1);p=[mix(5,a.x,swing),mix(-46,a.y,swing),mix(3.9,20,beat(q,0,.25))*(1-lower)+.8*lower];angle=mix(a.angle?Math.PI/2:Math.PI,0,swing);lift={x:p[0],y:p[1],z:p[2],h:a.h};}
  // Cargo rotates ninety degrees to become a wing. Finished modules have the same envelope.
  if(t<a.end){at(m,o,p,angle);classroom(m,a.w,a.d,a.h,a.color,a.roof);}
  else{at(m,o,p);classroom(m,a.w,a.d,a.h,a.color,a.roof,beat(t,13,14));}
  if(close)for(const side of [-1,1])puff(m,o,a.x+side*a.w*.47,a.y-a.d*.47,(t-a.end)/.65,i);
 });
 if(!lift&&t>5.05&&t<12.95){
  const next=modules.findIndex(a=>t<a.start+.28),previous=modules[next<0?2:next-1];
  if(next>=0){const a=modules[next],q=beat(t,previous?.end??5.05,a.start+.28),bottom=mix((previous?.h??21)+3.8,a.h+6.9,q)+Math.sin(q*Math.PI)*9;lift={x:mix(previous?.x??-8,5,q),y:mix(previous?.y??-18,-46,q),z:bottom-3,h:0,empty:true};}
  else{const q=beat(t,12.5,12.95);lift={x:0,y:16,z:mix(13.8,34,q),h:0,empty:true};}
 }
 if(close&&t>3.85)cranes(m,o,t,lift);
 finish(m,o,t);
 if(close)cast(m,o,t,true);
 m.kind=8;m.tint=rgb;
}
