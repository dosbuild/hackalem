import {Mesh} from './kit.mjs';

// Survey: OSM rail way/1245183398, opposite rail way/1484667032;
// adjacent Arys carriageways way/24844148 and way/165802523.
// CSCEC, 25 September 2023: 155 m LRT arch span, 13.4 m bridge width.
// https://ru.cscec.com/xwzx_ru/gsxw_ru/202309/3716499.html
// Arch rises and member sections are photo-derived interpretation, not survey.
export const ESIL_BRIDGE_ANCHOR=[71.44606424986284,51.12092414137719];
export const ESIL_BRIDGE_ANGLE=-.25795354673664317;
export const ESIL_LRT_SPAN=[14801.08946853039,14956.08946853039];
const white='#e9eee3',edge='#cadbd7',cable='#a2b8b9',concrete='#c4c4b1',steel='#7c9594';

// A continuous rectangular steel rib, with its depth normal to the curve.
function rib(m,points,width,depth,color){
 const loops=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz)||1,n=[-dz/length*depth/2,0,dx/length*depth/2];return [[p[0]-n[0],p[1]-width/2,p[2]-n[2]],[p[0]-n[0],p[1]+width/2,p[2]-n[2]],[p[0]+n[0],p[1]+width/2,p[2]+n[2]],[p[0]+n[0],p[1]-width/2,p[2]+n[2]]];});
 for(let i=1;i<loops.length;i++)for(let j=0;j<4;j++)m.quad(loops[i-1][j],loops[i][j],loops[i][(j+1)%4],loops[i-1][(j+1)%4],j===0?edge:color);
 m.quad(...loops[0].slice().reverse(),color);m.quad(...loops.at(-1),color);
}
const archZ=(x,half,rise,base)=>base+rise*(1-(x/half)**2);
function parapet(m,half,width,z){
 for(const side of [-1,1]){
  m.box(0,side*width/2,z,half*2,.30,.44,concrete);
  for(const h of [.55,1.05])m.beam([-half,side*width/2,z+h],[half,side*width/2,z+h],.055,white,5);
  for(let x=-half;x<=half+.01;x+=2.5)m.beam([x,side*width/2,z+.25],[x,side*width/2,z+1.08],.045,steel,4);
 }
}

function lrtArch(m){
 const half=77.5,rise=25.4,base=10.10,width=13.4;
 // Extend the existing 8.8 m track girder out to the documented width. These
 // side strips sit below railhead; the route compiler retains both running rails.
 for(const side of [-1,1]){
  m.box(0,side*5.55,8.58,155,2.3,1.40,concrete);
  m.box(0,side*6.46,8.65,155,.38,1.6,white);
  const points=Array.from({length:65},(_,i)=>{const x=-half+i/64*half*2;return [x,side*5.78,archZ(x,half,rise,base)];});
  rib(m,points,.72,1.08,white);
  for(let x=-half+7.75;x<half-1;x+=7.75){
   const top=archZ(x,half,rise,base)-.50;
   m.beam([x,side*5.78,10.1],[x,side*5.78,top],.060,cable,5);
   // The network hangers visible in CSCEC's construction elevation.
   const X=Math.max(-half+3,Math.min(half-3,x+(x<0?7.75:-7.75)));
   m.beam([X,side*5.78,10.1],[x,side*5.78,top],.040,cable,4);
  }
 }
 // Cross frames remain comfortably above the 13.8 m train roof.
 for(let x=-62;x<=62;x+=15.5){const z=archZ(x,half,rise,base);m.beam([x,-5.78,z],[x,5.78,z],.22,edge,5);}
 for(const x of [-half,half]){m.box(x,0,.1,4.2,14.5,1.5,concrete);m.box(x,0,1.6,2.9,12.3,6.98,concrete);m.box(x,0,7.9,4.0,13.4,.68,edge);}
 parapet(m,half,width,10);
}

function roadBridge(m){
 // The mean axis of the surveyed two four-lane carriageways is about 42 m
 // south of the railway. Its heading differs by 0.9 degrees.
 m.component([-2.8,-42.1,0],.016,()=>{
  const half=77.5,deckZ=8.7,rise=39.5;
  m.box(0,0,7.4,155,44,1.28,concrete);
  // The central suspended span plus compact approach transitions. Their outer
  // ends meet the mapped ground roads rather than ending in vertical cliffs.
  const roadHeight=x=>deckZ*(Math.min(1,(207-Math.abs(x))/100));
  for(let x=-207;x<207;x+=4.5){const X=Math.min(207,x+4.5),z=Math.max(.10,roadHeight(x)),Z=Math.max(.10,roadHeight(X));
   m.quad([x,-22,z],[X,-22,Z],[X,22,Z],[x,22,z],'#939e98');
   m.quad([x,-16.8,z+.025],[X,-16.8,Z+.025],[X,16.8,Z+.025],[x,16.8,z+.025],'#758583');
   for(const side of [-1,1]){
    m.quad([x,side*22,z-1],[X,side*22,Z-1],[X,side*22,Z],[x,side*22,z],concrete);
    m.beam([x,side*22,z+.80],[X,side*22,Z+.80],.09,white,5);
    m.beam([x,side*16.9,z+.2],[X,side*16.9,Z+.2],.08,edge,5);
   }
  }
  for(let x=-200;x<=200;x+=5){const z=Math.max(.10,roadHeight(x));for(const side of [-1,1])m.beam([x,side*22,z],[x,side*22,z+.84],.048,steel,4);}
  // Eight marked lanes and a restrained central safety divider.
  for(const y of [-12.6,-8.4,-4.2,4.2,8.4,12.6])for(let x=-202;x<202;x+=10){const X=x+4,z=Math.max(.10,roadHeight(x)),Z=Math.max(.10,roadHeight(X));m.quad([x,y-.075,z+.04],[X,y-.075,Z+.04],[X,y+.075,Z+.04],[x,y+.075,z+.04],'#e8e4cb');}
  for(let x=-203;x<203;x+=6){const X=Math.min(x+6,203);m.beam([x,0,Math.max(.1,roadHeight(x))+.36],[X,0,Math.max(.1,roadHeight(X))+.36],.14,'#c3c8b7',5);}
  for(const side of [-1,1]){
   // Each tall white arch is two inclined ribs, joined at the crown. The
   // opening between those ribs is a defining feature in the CRRC photograph.
   const arch=(x,branch)=>[x,side*19.6+branch*(3.6-3.1*(1-(x/half)**2)),archZ(x,half,rise,deckZ)];
   for(const branch of [-1,1])rib(m,Array.from({length:73},(_,i)=>arch(-half+i/72*155,branch)),1.15,1.55,white);
   for(let x=-67.5;x<=67.5;x+=7.5){const a=arch(x,-1),b=arch(x,1);m.beam(a,b,.18,edge,5);for(const branch of [-1,1]){const top=arch(x,branch);m.beam([x,side*18.9,deckZ+.25],top,.065,cable,5);}}
   for(const x of [-half,half]){m.box(x,side*19.6,.1,8.6,10,1.5,concrete);m.box(x,side*19.6,1.6,5.8,8,deckZ-1.6,concrete);m.box(x,side*19.6,deckZ-.35,7.2,9,.5,edge);}
  }
  // Piers on the dry approaches, no generic columns in the river itself.
  for(const x of [-167,-127,127,167])for(const side of [-1,1]){const z=roadHeight(x);m.box(x,side*11,.1,2.8,3.4,z-.7,concrete);m.box(x,side*11,z-.85,4.5,12,.75,edge);}
  for(let x=-180;x<=180;x+=30)for(const side of [-1,1]){const z=Math.max(.1,roadHeight(x));m.cylinder(x,side*19,z,.10,6.6,'#526f71',7);m.beam([x,side*19,z+6.6],[x,side*17.5,z+6.8],.10,'#526f71',5);m.material(25,()=>m.box(x,side*17.35,z+6.72,.8,.38,.12,'#f2dfae'));}
 });
}

export function esilBridges(){const m=new Mesh();lrtArch(m);roadBridge(m);return m;}
export function esilBridgeModels(){return [{id:'esil-bridges',name:'Есіл · LRT & Arys bridges',position:ESIL_BRIDGE_ANCHOR,angle:ESIL_BRIDGE_ANGLE,mesh:esilBridges(),replaces:[],transit:true,hidden:true,focusHeight:22,zoom:50,yaw:.6,sourceIds:['way/1245183398','way/1484667032','way/24844148','way/165802523']}];}
export const esilBridgeReference={lrtSpanM:155,lrtWidthM:13.4,lrtRiseEstimateM:25.4,roadRiseEstimateM:39.5,waterCrossingDistancesM:[14808.984952613288,14949.298288942433],source:'https://ru.cscec.com/xwzx_ru/gsxw_ru/202309/3716499.html',notes:'Surveyed geographic alignment; arch rises, road structure and member sections interpreted from photographs. Heights are visual model estimates, not engineering measurements.'};
