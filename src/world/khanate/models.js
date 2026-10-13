import {residentModel} from '../resident-models.js';
import {Mesh,beat,rgb,blend} from '../mesh-kit.js';
import {PALETTE} from '../../design/palette.js';
import {YURT_HEIGHT_SCALE} from './scale.js';

const wood='#92775a',darkWood='#695743',rope='#b6a07c',felt=PALETTE.felt;
const point=(a,r,z)=>[Math.cos(a)*r,Math.sin(a)*r,z];
/** Original woven band: a quiet chain of paired angular curves, carried by a binding. */
export function wovenBand(m,r,z,width,color=PALETTE.textile,detail=true){
 const sides=48;
 for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;m.quad(point(a,r,z),point(b,r,z),point(b,r,z+width),point(a,r,z+width),color);}
 if(detail)for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=a+.07,c=a+.13;
  m.beam(point(a,r+.12,z+width*.25),point(b,r+.12,z+width*.75),.095,felt,5);
  m.beam(point(b,r+.12,z+width*.75),point(c,r+.12,z+width*.25),.095,felt,5);
 }
}
export function roofRing(m,r,z,color=wood){
 const sides=32;for(let i=0;i<sides;i++)m.beam(point(i/sides*Math.PI*2,r,z),point((i+1)/sides*Math.PI*2,r,z),.20,color,6);
 for(const axis of [0,Math.PI/2])for(const offset of [-.45,0,.45]){
  const length=Math.sqrt(Math.max(0,r*r-offset*offset));
  const a=[-length*Math.cos(axis)-offset*Math.sin(axis),-length*Math.sin(axis)+offset*Math.cos(axis),z+.07];
  const b=[length*Math.cos(axis)-offset*Math.sin(axis),length*Math.sin(axis)+offset*Math.cos(axis),z+.07];m.beam(a,b,.075,color,5);
 }
}
/** Kerege opens, the shanyrak rises, then felt and bindings enclose the frame. */
export function yurt(m,{variant=0,progress=1,detail=true,ceremonial=false,heightScale=YURT_HEIGHT_SCALE}={}){
 const radius=ceremonial?16:10,wall=(ceremonial?10:7)*heightScale,roof=(ceremonial?8:5.8)*heightScale;
 const frame=beat(progress,.02,.30),crown=beat(progress,.18,.47),cover=beat(progress,.40,.78),finish=beat(progress,.74,.96);
 const fabric=[felt,'#e7dac2','#dcd0b9'][variant%3],roofFabric=blend(fabric,'#c2b498',.075),band=[PALETTE.textile,PALETTE.indigo,PALETTE.pine][variant%3];
 if(progress<=0)return;
 const sides=48,topRadius=radius*.18,roofZ=wall+roof*crown;
 // A restrained contact patch stays under the felt; the door's packed-earth
 // threshold connects the soft volume to the trodden path without a display disc.
 if(frame>0){m.ellipsoid(0,.18,.015,radius*.98*frame,radius*.98*frame,.04,'#8e8971',24,2);m.box(0,-radius-.42,.035,4.3,1.4,.13,'#b6a084');}
 // Frame is exposed throughout the assembly and remains visible inside the open door.
 if(frame>0&&cover<.999){for(let i=0;i<32;i++){
  const a=i/32*Math.PI*2,b=(i+2)/32*Math.PI*2,c=(i-2)/32*Math.PI*2;
  if(i>22&&i<26)continue;
  if(cover>0&&(i+2)/32<cover)continue;
  m.beam(point(a,radius*frame,0),point(b,radius*frame,wall*frame),.10,wood,5);
  m.beam(point(a,radius*frame,0),point(c,radius*frame,wall*frame),.10,wood,5);
 }
 if(crown>0){if(finish===0)roofRing(m,topRadius,roofZ);for(let i=0;i<24;i++){if(cover>0&&(i+1)/24<cover)continue;const a=i/24*Math.PI*2;m.beam(point(a,radius,wall),point(a,topRadius,roofZ),.12,wood,5);}}}
 if(cover>0){
  for(let i=0;i<sides;i++){
   if((i+.5)/sides>cover)continue;const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;
   // Door faces the camera-facing southern path; no felt plane hides its opening.
   if(!(i>=34&&i<=37)){
    const points=[point(a,radius+.16,.04),point(b,radius+.16,.04),point(b,radius+.16,wall),point(a,radius+.16,wall)],normals=[[Math.cos(a),Math.sin(a),0],[Math.cos(b),Math.sin(b),0],[Math.cos(b),Math.sin(b),0],[Math.cos(a),Math.sin(a),0]];
    m.tri(points[0],points[1],points[2],fabric,normals.slice(0,3));m.tri(points[0],points[2],points[3],fabric,[normals[0],normals[2],normals[3]]);
   }
   const levels=5;
   for(let j=0;j<levels;j++){
    const t=j/levels,u=(j+1)/levels,r=radius+(topRadius-radius)*t,rr=radius+(topRadius-radius)*u;
    const h=wall+roof*(Math.sin(t*Math.PI/2)*.10+t*.90),hh=wall+roof*(Math.sin(u*Math.PI/2)*.10+u*.90);
    const normal=(angle,v)=>{const slope=roof*(Math.cos(v*Math.PI/2)*Math.PI/2*.10+.90)/(radius-topRadius),length=Math.hypot(slope,1);return [Math.cos(angle)*slope/length,Math.sin(angle)*slope/length,1/length];};
    const points=[point(a,r+.09,h),point(b,r+.09,h),point(b,rr+.09,hh),point(a,rr+.09,hh)],normals=[normal(a,t),normal(b,t),normal(b,u),normal(a,u)];
    m.tri(points[0],points[1],points[2],roofFabric,normals.slice(0,3));m.tri(points[0],points[2],points[3],roofFabric,[normals[0],normals[2],normals[3]]);
   }
  }
 }
 if(finish>0){
  // Sewn joins are narrow cloth faces with the same normals as the felt.
  // A subpixel cylinder received its own ink outline and broke into dots.
  // Fixed surface strips retain the stitch through the close view and orbit.
  if(detail)for(let i=0;i<8;i++){
   const a=i/8*Math.PI*2;
   const tangent=[-Math.sin(a)*.09,Math.cos(a)*.09,0],strip=(r,z,side)=>{const p=point(a,r,z);return p.map((v,k)=>v+tangent[k]*side);};
   if(i!==6){
    const p=[strip(radius+.18,.18,-1),strip(radius+.18,.18,1),strip(radius+.18,wall-.12,1),strip(radius+.18,wall-.12,-1)],n=[Math.cos(a),Math.sin(a),0],color=blend(fabric,'#988b74',.20);
    m.tri(p[0],p[1],p[2],color,[n,n,n]);m.tri(p[0],p[2],p[3],color,[n,n,n]);
   }
   for(let j=0;j<5;j++){
    const t=j/5,u=(j+1)/5,r=radius+(topRadius-radius)*t,rr=radius+(topRadius-radius)*u;
    const h=wall+roof*(Math.sin(t*Math.PI/2)*.10+t*.90),hh=wall+roof*(Math.sin(u*Math.PI/2)*.10+u*.90);
    const normal=v=>{const slope=roof*(Math.cos(v*Math.PI/2)*Math.PI/2*.10+.90)/(radius-topRadius),length=Math.hypot(slope,1);return [Math.cos(a)*slope/length,Math.sin(a)*slope/length,1/length];};
    const p=[strip(r+.12,h+.025,-1),strip(r+.12,h+.025,1),strip(rr+.12,hh+.025,1),strip(rr+.12,hh+.025,-1)],n=normal(t),nn=normal(u),color=blend(fabric,'#a79b84',.15);
    m.tri(p[0],p[1],p[2],color,[n,n,nn]);m.tri(p[0],p[2],p[3],color,[n,nn,nn]);
   }
  }
  wovenBand(m,radius+.45,wall*.73,.72*heightScale*finish,band,detail);
  wovenBand(m,radius+.45,.9*heightScale,.35*heightScale*finish,band,false);
  for(const x of [-1.9,1.9])m.box(x,-radius,.05,.35,.5,wall*.88*finish,wood);
  m.box(0,-radius,wall*.87*finish,4.2,.55,.35,wood);
  m.box(0,-radius+.30,.05,3.6,.10,wall*.82*finish,'#514c3e');
  if(detail){
   // Narrow opened leaves frame a dark entry rather than hiding it under felt.
   for(const x of [-1.42,1.42]){
    m.box(x,-radius-.29,.18,.9,.12,wall*.76*finish,'#a98963');
    for(const zz of [1.7,3.8]){const z=zz*heightScale;m.beam([x-.30,-radius-.38,z],[x,-radius-.38,z+.36*heightScale],.052,band,4);m.beam([x,-radius-.38,z+.36*heightScale],[x+.30,-radius-.38,z],.052,band,4);}
    m.box(x,-radius-.38,.55,.80,.035,.08,darkWood);m.box(x,-radius-.38,wall*.69,.80,.035,.08,darkWood);
   }
   for(let i=0;i<8;i++){const a=i/8*Math.PI*2;
    m.beam(point(a,radius+.50,wall*.8),point(a,radius+1.1,.06),.06,rope,5);
    const peg=point(a,radius+1.1,.04);m.beam(peg,[peg[0],peg[1],.65],.075,darkWood,5);
    m.ellipsoid(...point(a,radius+.48,wall*.79),.14,.14,.14,rope,6,3);
   }
  }
  m.cylinder(0,0,wall+roof-.08,topRadius*.92,.10,'#5f5b4b',32);
  roofRing(m,topRadius,wall+roof+.28,ceremonial?PALETTE.brass:wood);
  const mat=beat(progress,.84,1);m.box(0,-radius-2.4*mat,.015,4.2,4.8*mat,.055,band);
  if(detail&&mat>.9)for(const y of [-radius-1,-radius-3.4])m.box(0,y,.075,3.5,.12,.018,PALETTE.brass);
 }
}
export function well(m,progress=1){
 if(progress<=0)return;for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
  m.quad(point(a,2.4,0),point(b,2.4,0),point(b,2.4,2.4*progress),point(a,2.4,2.4*progress),'#b8a487');
  m.quad(point(a,2.4,2.4*progress),point(b,2.4,2.4*progress),point(b,1.7,2.4*progress),point(a,1.7,2.4*progress),'#d5c4a2');}
 m.cylinder(0,0,.1,1.7,.04,PALETTE.water,24);
 for(const x of [-3,3])m.box(x,0,0,.5,.5,6*progress,wood);
 m.beam([-3.5,0,5.7*progress],[3.5,0,5.7*progress],.45,wood,10);m.beam([0,0,5.7*progress],[0,0,2.1*progress],.11,rope,6);
 m.cylinder(3,-2,0,.9,1.4,wood,10,.8);
}
export function steppeTree(m,variant=0,progress=1){
 const p=progress;if(p<=0)return;m.cylinder(0,0,0,.45,8*p,wood,7,.23);
 for(const [x,y,z,r] of [[0,0,10,3.8],[-2.4,0,8.6,2.7],[2,1.4,9.2,3.1]]){
  m.beam([0,0,4*p],[x*p,y*p,z*p],.20,wood,6);m.ellipsoid(x*p,y*p,z*p,r*p,r*.9*p,r*1.1*p,['#89977b','#9da486','#758e76'][variant%3],10,6);
 }
}
export function lantern(m,progress=1){
 m.cylinder(0,0,0,.28,9*progress,darkWood,8,.20);m.beam([0,0,9*progress],[1.6,0,8.6*progress],.18,darkWood,6);
 m.box(1.6,0,6.9*progress,1,.85,1.6*progress,PALETTE.brass);const kind=m.kind;m.kind=11;m.box(1.6,-.45,7.2*progress,.65,.035,.8*progress,'#d9bb7f');m.kind=kind;
 m.box(1.6,0,8.5*progress,1.5,1.3,.22,darkWood);
}
export function cart(m){
 m.box(0,0,1.3,4.4,7.4,.4,wood);for(const x of [-2.2,2.2]){m.box(x,0,1.7,.25,7.4,1.5,wood);for(const y of [-2.4,2.4]){
  m.ellipsoid(x,y,1.3,.25,1.3,1.3,darkWood,12,6);m.ellipsoid(x*1.03,y,1.3,.27,.88,.88,rope,10,6);}}
 for(const x of [-1.1,1.1])m.beam([x,-3,1.7],[x,-8,.8],.17,wood,6);
 for(const [x,y] of [[-1,-1],[1,.4],[-.6,2]])m.ellipsoid(x,y,2.5,1.3,1.8,.8,'#b7a382',10,6);
}
export function animal(m,kind='horse',phase=0){
 const camel=kind==='camel',body=camel?'#ba9672':'#897362',dark='#665340';
 m.ellipsoid(0,0,4,1.1,2.8,1.4,body,12,8);
 for(const x of [-.65,.65])for(const y of [-1.8,1.8]){const step=Math.sin(phase+(x*y>0?Math.PI:0))*.6;m.beam([x,y,4],[x,y+step,.3],.22,body,6);m.ellipsoid(x,y+step-.1,.2,.25,.45,.23,dark,6,4);}
 m.beam([0,-1.7,4],[0,-2.8,camel?7:6],.6,body,8);m.ellipsoid(0,-3.1,camel?7:6,.65,1.1,.65,body,10,6);
 for(const x of [-.4,.4])m.beam([x,-2.7,6.4],[x,-2.5,7.2],.15,dark,5);
 m.beam([0,2.4,4],[.2,3.8,2],.18,dark,6);
 if(camel)for(const y of [-.9,1])m.ellipsoid(0,y,5.1,.9,1.1,1.1,body,10,6);
 m.box(0,.1,5.1,2,2.4,.24,PALETTE.textile);
}
export function makeTemplate(kind,variant=0){const m=new Mesh();m.kind=8;m.tint=rgb;
 if(kind==='keeper'){const props=['book','cart','plant','toolbox','tote','satchel','gloves'];residentModel(m,{id:`keeper-${variant}`,visual:{era:'khanate',coat:[PALETTE.indigo,PALETTE.clay,PALETTE.pine][variant%3],accent:PALETTE.brass,skin:['#d0a17b','#bd916e','#dcb89a'][variant%3],hair:'#40362f',cut:'long',head:'cap',build:'regular',mobility:'walk',prop:props[variant%7]}},[0,0,0],0,2.5,variant%2?'talk':'idle',true);}
 else if(kind==='yurt')yurt(m,{variant});else if(kind==='tree')steppeTree(m,variant);else if(kind==='cart')cart(m);else if(kind==='lantern')lantern(m);else if(kind==='well')well(m);else if(kind==='horse'||kind==='camel')animal(m,kind);
 else throw Error(`Unknown historical template: ${kind}`);
 return m.pack();
}
