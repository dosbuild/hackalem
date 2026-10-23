import {yurt,steppeTree,well,cart,animal,wovenBand} from './models.js';
import {PALETTE} from '../../design/palette.js';
import {OBJECT_UNIT} from './scale.js';
const wood='#92775a',dark='#695743',clay='#b59275';
function canopy(m,x,y,w=22,d=16,h=13,color=PALETTE.textile){
 for(const dx of [-w*.48,w*.48])for(const dy of [-d*.48,d*.48])m.box(x+dx,y+dy,0,.55,.55,h,wood);
 m.quad([x-w/2,y-d/2,h],[x+w/2,y-d/2,h],[x+w/2,y,h+3],[x-w/2,y,h+3],color);
 m.quad([x-w/2,y,h+3],[x+w/2,y,h+3],[x+w/2,y+d/2,h],[x-w/2,y+d/2,h],color);
}
function tower(m,x,y,h=42){
 for(const a of [-1,1])for(const b of [-1,1]){m.beam([x+a*5,y+b*5,0],[x+a*3.5,y+b*3.5,h],.6,wood,7);}
 for(const z of [5,15,25])for(const side of [-1,1]){m.beam([x-4,y+side*4,z],[x+4,y+side*4,z+10],.32,wood,6);m.beam([x+side*4,y-4,z],[x+side*4,y+4,z+10],.32,wood,6);}
 m.box(x,y,h,12,12,.8,wood);for(const side of [-1,1]){m.box(x+side*5.8,y,h,0.4,12,4,clay);m.box(x,y+side*5.8,h,12,.4,4,clay);}
 m.quad([x-8,y-8,h+7],[x+8,y-8,h+7],[x+8,y,h+12],[x-8,y,h+12],dark);m.quad([x-8,y,h+12],[x+8,y,h+12],[x+8,y+8,h+7],[x-8,y+8,h+7],dark);
}
function courtyard(m,w=52,d=44){m.box(0,0,0,w,d,.3,'#c3b592');for(const x of [-w/2,w/2])m.box(x,0,0,1.7,d,6,clay);m.box(0,d/2,0,w,1.7,6,clay);for(const x of [-w*.32,w*.32])m.box(x,-d/2,0,w*.36,1.7,6,clay);}
function bridge(m){
 // The original 17 mm world span crosses the same banks. Local width, rails
 // and planks now use the shared object unit; shortening the river is forbidden.
 const length=.017/OBJECT_UNIT,count=Math.ceil(length/2),step=length/count;
 for(let i=0;i<count;i++)m.box(0,(i-(count-1)/2)*step,2.2,13,step*.94,.35,wood);
 for(const x of [-7,7]){for(let i=0;i<=12;i++)m.box(x,-length/2+i*length/12,0,.35,.35,4.6,dark);for(const z of [3.3,4.3])m.beam([x,-length/2,z],[x,length/2,z],.09,wood,6);
  for(let i=0;i<count;i++){const a=-length/2+i*step;m.beam([x,a,3.3],[x,a+step,4.3],.055,clay,4);}}
}
export function landmarkModel(mesh,landmark){
 const origin=[...landmark.point,.00006],scale=OBJECT_UNIT;mesh.at(origin,landmark.id==='atyrau'?-.55:0,scale);mesh.kind=8;
 const at=(x=0,y=0,angle=0,factor=1)=>mesh.at([origin[0]+x*scale,origin[1]+y*scale,origin[2]],angle,scale*factor);
 switch(landmark.id){
  case 'baiterek':
   steppeTree(mesh,2,2.7);for(let i=0;i<12;i++){const a=i*Math.PI/6;mesh.box(Math.cos(a)*12,Math.sin(a)*12,.1,4,2,1.2,wood);}mesh.cylinder(0,0,0,17,.12,'#c4b393',48);break;
  case 'akorda':
   mesh.box(0,-7,.02,72,66,.06,'#c2b498');for(const x of [-36,36]){at(x,18);steppeTree(mesh,1,1.45);}at();
   yurt(mesh,{ceremonial:true});for(const x of [-25,25]){at(x,4,0,.60);yurt(mesh,{variant:x<0?1:2});}at(0,-28);canopy(mesh,0,0,20,11,9,PALETTE.indigo);mesh.box(0,1,0,9,4,3,wood);for(const x of [-22,22]){at(x,-19);mesh.beam([0,0,0],[0,0,28],.25,wood,6);mesh.quad([0,0,27],[7,0,25],[7,0,19],[0,0,20],PALETTE.pine);}break;
  case 'khan':
   courtyard(mesh,76,62);for(const x of [-28,28])for(const y of [-16,15]){at(x,y,0,.85);yurt(mesh,{variant:x<0?1:2});}at(0,17);canopy(mesh,0,0,24,13,10,PALETTE.indigo);at(0,-5);well(mesh);for(const x of [-12,10]){at(x,-23);cart(mesh);}break;
  case 'palace':
   for(let i=0;i<4;i++)mesh.cylinder(0,0,i*2.3,27-i*5,2.3,['#9da084','#b2a88b','#bdae90','#cec09e'][i],48);mesh.cylinder(0,0,9.2,8,.2,PALETTE.textile,32);for(let i=0;i<9;i++){const a=i/9*Math.PI*2;mesh.box(Math.cos(a)*11,Math.sin(a)*11,7,2.7,2.7,.4,PALETTE.felt);}break;
  case 'expo':
   yurt(mesh,{ceremonial:true,variant:1});for(const [x,y] of [[-25,-6],[25,-6],[-15,-30],[15,-30]]){at(x,y);canopy(mesh,0,0,15,12,9,PALETTE.indigo);mesh.box(0,0,0,8,4,3,wood);for(let i=0;i<3;i++)mesh.cylinder((i-1)*2.3,0,3,1,2,clay,12,.7);}break;
  case 'hazret':case 'grand-mosque':{
   const grand=landmark.id==='grand-mosque';courtyard(mesh,grand?70:46,grand?57:38);mesh.box(0,12,0,grand?34:24,19,12,clay);mesh.ellipsoid(0,12,12,grand?12:8,8,6,'#c4ad8e',24,12);
   for(const x of grand?[-25,25]:[17]){mesh.cylinder(x,13,0,2.6,grand?28:18,clay,16,2.0);mesh.cylinder(x,13,grand?28:18,3,.8,PALETTE.felt,16);mesh.ellipsoid(x,13,grand?30:20,2.2,2.2,1.6,wood,16,8);}
   if(grand)for(const x of [-25,25]){at(x,-16,0,.60);yurt(mesh,{variant:1});}else{at(-12,-9);well(mesh);}break;
  }
  case 'opera':
   canopy(mesh,0,8,38,18,12,PALETTE.textile);for(let i=0;i<3;i++)for(let j=0;j<7;j++){const a=Math.PI+(j/6)*Math.PI,r=11+i*6;mesh.box(Math.cos(a)*r,Math.sin(a)*r,.1,4,2.7,.15,i%2?PALETTE.indigo:PALETTE.felt);}mesh.box(0,9,.2,15,8,.8,wood);break;
  case 'arch':
   for(const x of [-12,12]){mesh.box(x,0,0,4,7,28,wood);mesh.box(x,0,27,6,9,1,clay);}mesh.box(0,0,24,30,5,3,wood);mesh.box(0,-2.6,25,27,.3,.6,PALETTE.textile);for(const x of [-6.5,6.5]){mesh.box(x,4,0,9,.8,18,dark);for(const z of [4,14])mesh.box(x,3.5,z,9,.2,.6,ropeColor());}break;
  case 'concert':
   mesh.cylinder(0,0,0,27,.3,'#c2b090',48);canopy(mesh,0,8,30,18,14,PALETTE.indigo);mesh.box(0,6,.3,24,12,1,wood);for(let i=0;i<10;i++){const a=Math.PI+i/9*Math.PI;mesh.box(Math.cos(a)*18,Math.sin(a)*18,.4,4,3,.12,i%2?PALETTE.textile:PALETTE.felt);}break;
  case 'atyrau':bridge(mesh);break;
  case 'abudhabi':
   tower(mesh,0,8);for(const x of [-19,19]){mesh.box(x,-6,0,17,25,9,clay);mesh.box(x,-6,9,19,27,.7,dark);for(let j=0;j<3;j++)mesh.box(x-5+j*5,-19,1,3,.3,6,wood);}break;
  case 'esil-bridges':
   mesh.box(0,0,.4,20,35,.8,wood);for(let i=0;i<18;i++)mesh.box(0,-17+i*2,1.2,20,1.8,.12,'#af9672');
   // Cable ends and landing centres remain at the original geographic banks.
   for(const side of [-1,1]){mesh.at([origin[0]+side*.0035,origin[1],origin[2]],0,scale);mesh.beam([0,-.00875/scale,4],[0,.00875/scale,4],.08,dark,5);}
   at(0,-4);cart(mesh);for(const side of [-1,1]){mesh.at([origin[0],origin[1]+side*.009,origin[2]],0,scale);canopy(mesh,0,0,19,10,10,PALETTE.felt);}break;
  case 'lrt':
   yurt(mesh,{variant:2});at(21,3);canopy(mesh,0,0,18,12,12,PALETTE.felt);for(const x of [14,23]){at(x,-13,0,.9);animal(mesh,'horse');}at(-16,-6);mesh.box(0,0,0,1.3,1.3,22,wood);mesh.box(0,0,15,9,1,4,PALETTE.textile);break;
 }
 mesh.at([0,0,0]);
}
function ropeColor(){return '#b6a07c';}
