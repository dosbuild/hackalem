import {beat,blend,rgb} from './mesh-kit.js';
import {routeAt} from './placement-geometry.js';
import {ACCENT,FAMILY,routeSection} from './intervention-effects.js';

// Cartographic miniatures share the real placement and route. Pixel dimensions are
// deliberately separate from the physical meshes; they hand over at block scale.
const ink='#315c59',cream='#f5e2b5';
function canopy(m,x,y,r,p,i=0){if(p<=0)return;const k=r*p;m.ellipsoid(x+.8,y-.5,.3,k*1.12,k*.92,.15,'#416b58',8,3);m.ellipsoid(x,y,2.2*p,k,k*.88,k*.6,i%2?'#78b47d':'#a2ce8c',9,4);m.ellipsoid(x-k*.3,y-k*.2,2.6*p,k*.52,k*.52,k*.4,'#b7dba0',8,3);}
function node(m,x,y,r,p,color=cream){if(p<=0)return;m.ellipsoid(x,y,.3,r*p,r*p,.12,ink,10,3);m.ellipsoid(x,y,.5,r*.73*p,r*.73*p,.14,color,10,3);}
function car(m,q,px,color,length=6){m.at([...q.point,.003],q.angle,px);m.box(0,0,1,length,2.8,1.5,ink);m.box(0,0,2.5,length*.91,2.5,.3,color);m.box(length*.23,0,2.82,1.5,2.2,.1,'#547c80');}
export function macroEcho(m,o,p,options){const zoom=options.zoom||1;if(zoom>=18||p<=0)return;const px=(1-beat(zoom,10,18)*.45)/(options.scale||324),accent=ACCENT[FAMILY[o.id]],clock=options.seconds||0;
 if(o.program?.sites?.length&&['M4','M2'].includes(o.id))return;
 m.kind=14;m.tint=c=>o.proposal?blend(c,'#d7d8bb',.65):rgb(c);m.at([0,0,0]);
 if(o.route){
  const grow=beat(p,0,.65),route=routeSection(o.route,.5-grow*.5,.5+grow*.5),width=o.id==='M10'?8:o.id==='M14'?5:7;
  m.ribbon(route,(width+2)*px,ink,1,.001);m.ribbon(route,width*px,o.id==='M10'?'#b7985b':o.id==='M13'?'#6db6c3':accent,1,.0015);
  if(['M1','M3','M13','M14'].includes(o.id))m.ribbon(route,1.2*px,cream,1,.002);
  const stops=o.id==='M10'?7:4;
  for(let i=0;i<stops;i++){const t=.08+i/(stops-1)*.84,q=routeAt(o.route,t),live=beat(p,.25+i*.065,.47+i*.065);m.at([...q.point,.003],q.angle,px);
   if(o.id==='M10'){m.ellipsoid(0,0,.1,4.6*live,4.6*live,.12,'#c6b57b',10,3);node(m,0,0,2.3,live,'#ffe9b2');}
   else if(o.id==='M14'){m.box(0,5,0,5*live,5*live,2.4*live,'#518986');m.box(0,5,2.5,5.7*live,5.7*live,.3,cream);m.box(0,5,2.9,1.2,3.5*live,.1,'#daab5c');}
   else node(m,0,0,o.id==='M3'?3.5:2.8,live);
  }
  if(o.id==='M11'){const q=routeAt(o.route,.5);m.at([...q.point,.004],q.angle,px);m.box(0,0,0,15,13,.1,ink);for(const x of [-5,-2,1,4])m.box(x,0,.2,1.8,11,.1,cream);}
  if(o.id==='M2'){const q=routeAt(o.route,.5);m.at([...q.point,.004],q.angle,px);m.ribbon([[-9,0],[9,0]],5,ink,p,.1);m.ribbon([[0,-9],[0,9]],5,ink,p,.11);for(const [x,y] of [[-6,-5],[6,5],[-5,6],[5,-6]])node(m,x,y,3,beat(p,.3,.8),accent);}
  if(!o.proposal&&p>.72&&['M1','M2','M3','M14'].includes(o.id)){const count=o.id==='M3'?2:3;for(let i=0;i<count;i++){const t=(clock*.055+i/count+(o.slot||1)*.13)%1;car(m,routeAt(o.route,t),px,o.id==='M14'?'#efc879':cream,o.id==='M3'?10:6);}}
 }else{
  m.at(o.origin,o.orientation||0,px);
  // Nearby checked spaces retain their bearing. Overview exaggeration belongs
  // only to this miniature; the depth-tested spaces keep their real coordinates.
  if(!o.proposal)for(const [i,n] of (o.context||[]).entries()){
   const dx=n.point[0]-o.origin[0],dy=n.point[1]-o.origin[1],length=Math.hypot(dx,dy)||1,k=(o.id==='M4'?31:27)/length;
   const x=dx*k,y=dy*k,grow=beat(p,.32+i*.075,.62+i*.075);
   if(o.id==='M12'){m.ribbon([[0,0],[x,y]],1.2,accent,grow,.05);node(m,x,y,3,grow,accent);}
   else {m.box(x,y,.08,11*grow,9*grow,.15,'#659575');canopy(m,x-2,y,3.7,grow,i);canopy(m,x+3,y+1,3,grow,i+1);}
  }
  if(o.id==='M4'){
   const w=Math.max(42,o.size[0]/px),d=w*o.size[1]/o.size[0],base=beat(p,0,.2);
   m.box(0,0,0,w*base,d*base,.25,ink);m.box(0,0,.3,(w-2)*base,(d-2)*base,.18,'#75ab7f');
   m.ribbon([[-w*.47,0],[w*.47,0]],2.8,cream,beat(p,.12,.4),.6);m.ribbon([[0,-d*.46],[0,d*.46]],2.4,cream,beat(p,.2,.47),.65);
   for(let i=0;i<12;i++){const side=i<6?-1:1,x=((i%6)/5-.5)*w*.79,y=side*d*.32;canopy(m,x,y,3.9,beat(p,.25+i*.025,.58+i*.025),i);}
   m.ellipsoid(5,3,.9,2.8,2.2,.25,'#7acbd1',10,3);
  }else if(o.id==='M6'){
   for(let row=0;row<3;row++)for(let i=0;i<7;i++)canopy(m,(i-3)*6+(row%2)*2,(row-1)*6,3.4,beat(p,.08+i*.055+row*.055,.42+i*.055+row*.055),i+row);
  }else if(o.id==='M5'){
   for(let i=0;i<6;i++){const x=(i%3-1)*11,y=(Math.floor(i/3)-.5)*12,k=beat(p,i*.08,.45+i*.08);m.box(x,y,0,8,8,3*k,'#bdac86');m.box(x,y,3*k,9,9,.6,'#71b5a4');m.box(x,y,3*k+.7,2,2,1.2,cream);}
  }else if(o.id==='M12'){
   const points=[[-17,-10],[17,-10],[-17,11],[17,11]],grow=beat(p,0,.55);
   for(const [i,q] of points.entries()){m.ribbon([[0,0],q],2.2,ink,grow,.12);m.ribbon([[0,0],q],1,accent,grow,.2);node(m,...q,3.7,beat(p,.3+i*.08,.55+i*.08),accent);if(!o.proposal&&p>.9){const t=(clock*.24+i*.25)%1;m.ellipsoid(q[0]*(1-t),q[1]*(1-t),.8,1.1,1.1,.2,cream,8,3);}}
   m.box(0,0,0,14,13,4*grow,ink);m.box(0,0,4*grow,15,14,.4,'#96c9c1');m.box(0,-1,4.5,8,3,.2,cream);m.cylinder(4,4,4.5,.6,4*beat(p,.4,.75),cream,6);m.ellipsoid(4,4,8.5,1.4,1.4,.6,'#f6cf81',8,3);
  }else if(['M7','M8','M9'].includes(o.id)){
   const base=beat(p,0,.22),body=beat(p,.18,.7);m.box(0,0,0,38*base,30*base,.3,ink);m.box(0,0,.4,36*base,28*base,.2,'#bdc19b');m.ribbon([[0,-14],[0,7]],3,cream,beat(p,.12,.6),.7);
   if(o.id==='M9'){m.box(0,0,.8,24,17,.2,'#c7946f');m.ribbon([[-11,-7],[11,-7],[11,7],[-11,7],[-11,-7]],.8,cream,body,1.1);m.ribbon([[0,-7],[0,7]],.8,cream,body,1.15);for(const x of [-11,11])m.box(x,0,1.2,1,5,3*body,cream);}
   else {m.box(-8,5,.8,14,14,6*body,'#65a4a0');m.box(-8,5,.8+6*body,15,15,.5,cream);m.box(8,1,.8,11,22,4.5*body,'#78aaa5');m.box(8,1,.8+4.5*body,12,23,.5,cream);
    if(o.id==='M7')m.box(0,9,.8,12,8,8*body,'#e6bc76');else{m.box(-8,4,7.4,7,2,.1,'#bd745f');m.box(-8,4,7.5,2,7,.1,'#bd745f');}}
   for(const [i,[x,y]] of [[-15,-10],[15,-10],[-15,10]].entries())canopy(m,x,y,3,beat(p,.5+i*.06,.76+i*.06),i);
   if(!o.proposal&&p>.8)for(let i=0;i<4;i++){const y=-9+(i%2)*3,x=(i-1.5)*3+Math.sin(clock*.5+i)*.5;m.ellipsoid(x,y,1,1,1,1.8,i%2?'#e5b172':'#537f85',6,3);}
  }
 }
 m.kind=8;
}

// Restrained background traffic, on already surveyed streets, gives the opening
// overview a living rhythm. It does not represent an additional funded service.
export function ambientTraffic(m,sites,options){const zoom=options.zoom||1;if(zoom>18)return;const px=1/(options.scale||324);m.kind=14;m.tint=rgb;
 for(const [j,o] of sites.entries())for(let i=0;i<3;i++){const q=routeAt(o.route,((options.seconds||0)*.018+i/3+j*.13)%1);m.at([...q.point,.0018],q.angle,px);m.box(0,0,0,2.5,1.25,.1,i%2?'#d6d4b4':'#a0bcb3');}
 m.kind=8;
}
