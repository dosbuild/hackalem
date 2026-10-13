import {routeAt} from '../placement-geometry.js';
import {smooth} from '../mesh-kit.js';
import {smoothPath} from './settlement.js';
import {groundHeight} from './landscape.js';
import {LIFE_FACTOR,ROUTE_DURATION_FACTOR} from './scale.js';

const TAU=Math.PI*2,loop=(center,rx,ry,n=32)=>Array.from({length:n+1},(_,i)=>[center[0]+Math.cos(i/n*TAU)*rx,center[1]+Math.sin(i/n*TAU)*ry]);
const groups=[];
function add(id,kind,route,period,offset=0,scale=.00033,variant=0,behavior='walk'){groups.push({id,kind,route:smoothPath(route,1),period:period*ROUTE_DURATION_FACTOR,offset:offset*ROUTE_DURATION_FACTOR,scale:scale*LIFE_FACTOR,variant,behavior});}
// Every route closes or turns while standing. Nobody teleports at the cycle edge.
for(let i=0;i<7;i++)add(`herd-${i}`,i===6?'foal':'horse',loop([-.031+(i%3-1)*.0047,-.014-Math.floor(i/3)*.004],.0023,.0019),54+i*7,i*11,i===6?.00027:.00036,i,'graze');
for(let i=0;i<12;i++)add(`flock-${i}`,i>8?'lamb':'sheep',loop([-.247+(i%4)*.0036,-.115+Math.floor(i/4)*.0032],.0015,.0013),40+i*3,i*7,i>8?.00026:.00032,i,'graze');
add('flock-dog','dog',loop([-.243,-.112],.009,.008),43,6,.00028,0);
add('shepherd','person',loop([-.244,-.111],.011,.010),150,3,.00029,2);
// Guide and camels follow a narrow oval along the caravan road.
const caravan=[[.126,.118],[.145,.122],[.172,.121],[.198,.123],[.207,.127],[.197,.128],[.173,.127],[.145,.128],[.126,.122],[.122,.12],[.126,.118]];
for(let i=0;i<5;i++)add(`caravan-${i}`,'camel',caravan,215,i*13,.00037,i);
add('caravan-guide','person',caravan,215,9,.00031,3);
// Daily errands use existing land paths; the river is crossed only by its bridge.
const errands=[
 [[-.067,-.078],[-.045,-.072],[-.034,-.071]],
 [[-.156,.031],[-.131,.033],[-.108,.036]],
 [[.126,-.067],[.145,-.044],[.174,-.022]],
 [[.017,-.130],[.036,-.121],[.059,-.109]],
 [[-.113,.092],[-.088,.089],[-.080,.095]],
 [[.10,.153],[.115,.166],[.131,.176]],
 [[-.206,-.137],[-.19,-.129],[-.175,-.122]],
 [[.078,.191],[.093,.193],[.115,.192]],
];
for(let i=0;i<errands.length;i++)for(let j=0;j<2;j++)add(`errand-${i}-${j}`,'person',errands[i],83+i*9,j*43+i*7,.00028,i+j,'errand');
add('water-carrier','person',[[-.252,-.176],[-.246,-.173],[-.240,-.1693]],58,5,.00032,0,'errand');
add('water-neighbour','person',[[-.258,-.172],[-.252,-.169],[-.247,-.165]],72,28,.00030,4,'errand');
for(let i=0;i<3;i++)add(`children-${i}`,'person',loop([-.143,.205],.006,.0032),21+i*1.1,i*5,.00027,i+1,'play');
add('willow-elder','person',[[-.150,.208],[-.149,.209]],90,50,.00030,2,'rest');
add('horse-keeper','person',[[-.046,-.025],[-.039,-.022],[-.032,-.023]],94,18,.00030,2,'errand');
// Circling wings are large enough to read from the city; they don't fill the sky.
for(let i=0;i<5;i++)add(`river-bird-${i}`,'bird',loop([-.054,.002],.033+i*.001,.014),29+i*.6,i*.8,.00033,i,'fly');
for(let i=0;i<2;i++)add(`ridge-eagle-${i}`,'eagle',loop([-.077,.273],.048,.026),59+i*9,i*24,.00055,i,'soar');
for(let i=0;i<3;i++)add(`spring-bird-${i}`,'bird',loop([-.241,-.164],.011,.008),18+i*2,i*4,.00023,i,'visit-water');
export const lifePopulation=Object.freeze(groups);
export function sampleLife(seconds,{reducedMotion=false,night=false}={}){
 const t=reducedMotion||night?32:seconds;
 return groups.map(a=>{
  let f=((t+a.offset)%a.period)/a.period,progress=f,activity=a.behavior,speed=1,turn=0;
  if(a.behavior==='errand'){
   if(f<.38){progress=smooth(f/.38);activity='walk';}else if(f<.52){progress=1;activity='work';speed=0;}else if(f<.90){progress=1-smooth((f-.52)/.38);activity='walk';}else{progress=0;activity='talk';speed=0;}
   // Turn during the pause, arriving at the next direction before setting off.
   turn=f<.43?0:f<.52?Math.PI*smooth((f-.43)/.09):f<.90?Math.PI:Math.PI+Math.PI*smooth((f-.90)/.10);
  }else if(a.behavior==='graze'){
   const stage=f*4,k=Math.floor(stage),local=stage-k;progress=(k+smooth(local/.3))/4;
   activity=local<.3?'walk':a.kind==='horse'&&a.id==='herd-0'?'drink':'graze';speed=local<.3?1:0;
  }else if(a.behavior==='visit-water'){progress=Math.min(1,f/.65);activity=f<.65?'fly':'perch';speed=f<.65?1:0;}else if(a.behavior==='rest'){progress=.5;activity='talk';speed=0;}
  const p=routeAt(a.route,progress);let angle=p.angle+Math.PI/2+turn;
  // Look slightly ahead/behind to avoid a hard heading change at path vertices.
  const closed=a.route[0].every((v,i)=>Math.abs(v-a.route.at(-1)[i])<1e-8),wrap=q=>closed?(q+1)%1:Math.max(0,Math.min(1,q));
  const before=routeAt(a.route,wrap(progress-.008)).point,after=routeAt(a.route,wrap(progress+.008)).point;
  if(Math.hypot(after[0]-before[0],after[1]-before[1])>1e-10)angle=Math.atan2(after[1]-before[1],after[0]-before[0])+Math.PI/2+turn;
  let z=groundHeight(...p.point)+.00006;
  if(a.behavior==='visit-water'){z+=.00013*LIFE_FACTOR+(f<.65?Math.sin(f/.65*Math.PI)**2*.011*LIFE_FACTOR:0);}
  if(a.behavior==='fly'||a.behavior==='soar'){z+=(a.kind==='eagle'?.055:.012+Math.sin((t+a.offset)*.35)*.002)*LIFE_FACTOR;}
  const phase=speed?(t+a.offset)*(a.kind==='person'?5:a.kind==='bird'?8:a.kind==='eagle'?1.1:4):activity==='work'||activity==='talk'?(t+a.offset)*1.5:activity==='graze'||activity==='drink'?(t+a.offset)*.8:0;
  return {...a,position:[...p.point,z],angle,phase,activity};
 });
}
