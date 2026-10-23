import {PROJECT_BUILD_MS} from './construction-clock.js';
import {isHeroSchool,schoolPose,schoolChoreography} from './hero-school.js';
import {smooth,beat} from './mesh-kit.js';
export const OVERVIEW=Object.freeze({x:.10,y:.12,yaw:-.12,pitch:.78,zoom:1});
export const CLOSE_ZOOM=160;
export function closePose(site){if(isHeroSchool(site))return schoolPose(site);return {...OVERVIEW,x:site.origin[0]+Math.sin(OVERVIEW.yaw)*Math.tan(OVERVIEW.pitch)*site.origin[2],y:site.origin[1]+Math.cos(OVERVIEW.yaw)*Math.tan(OVERVIEW.pitch)*site.origin[2],zoom:CLOSE_ZOOM};}
// Keep manual encounters close. A commitment establishes the surrounding blocks.
export function eventPose(site){return {...closePose(site),zoom:isHeroSchool(site)?138:site.id==='M11'?78:site.route?48:site.id==='M5'?76:site.id==='M4'?76:86};}
/** Logarithmic zoom retains geographic context; pan waits for altitude on the return. */
function fly(a,b,t,returning=false){if(t>=1)return {...b};if(t<=0)return {...a};const e=smooth(t),pan=returning?smooth((e-.46)/.54):e;return {x:a.x+(b.x-a.x)*pan,y:a.y+(b.y-a.y)*pan,yaw:a.yaw+(b.yaw-a.yaw)*e,pitch:a.pitch+(b.pitch-a.pitch)*e,zoom:Math.exp(Math.log(a.zoom)+(Math.log(b.zoom)-Math.log(a.zoom))*e)};}
export function createChoreography(record,start,from,close=eventPose(record)){
 if(isHeroSchool(record))return schoolChoreography(record,start,from,fly,OVERVIEW,close);
 const citywide=!!record.citywide,first=(record.slot||1)===1,alreadyHere=from.zoom>18&&Math.hypot(from.x-close.x,from.y-close.y)<.1;
 const home=first?.16:.1,districtEnd=home+.44,arrive=districtEnd+.92,buildStart=arrive-.18;
 const buildEnd=buildStart+({M1:2.25,M3:2.4,M5:2.2,M10:2.55,M11:2,M13:2.7}[record.id]||2.4);
 const holdEnd=buildEnd+1.05,returnEnd=holdEnd+1.15,originalDuration=citywide?5.4:returnEnd+.28,duration=PROJECT_BUILD_MS/1000;
 return {key:record.key,id:record.id,start,citywide,from:{...from},close,cancelled:false,duration,
  sample(now){const t=Math.max(0,(now-start)/1000)*originalDuration/duration;
   if(citywide){const progress=beat(t,1.5,3.7),settle=beat(t,4.95,5.4),pose=t<.45?fly(from,OVERVIEW,t/.45,true):t<1.65?fly(OVERVIEW,close,(t-.45)/1.2):{...close};return {pose,stage:t<.45?'district':t<1.65?'approach':t<3.7?'build':t<4.95?'people':t<5.4?'settle':'complete',progress,people:beat(t,3.2,3.9),arrival:1-beat(t,1.5,1.9),finish:Math.sin(beat(t,3.5,4.6)*Math.PI),settle,citywide,duration,done:t>=originalDuration};}
   const approach={...OVERVIEW,x:record.origin[0],y:record.origin[1],zoom:3.1};let pose,stage;
   if(alreadyHere&&t<arrive){pose=fly(from,close,t/arrive);stage='approach';}
   else if(t<home){pose=fly(from,OVERVIEW,t/home,true);stage='overview';}
   else if(t<districtEnd){pose=fly(OVERVIEW,approach,(t-home)/(districtEnd-home));stage='district';}
   else if(t<arrive){pose=fly(approach,close,(t-districtEnd)/(arrive-districtEnd));stage='approach';}
   else if(t<buildEnd){pose=close;stage='build';}
   else if(t<holdEnd){pose=close;stage='people';}
   else if(t<returnEnd){pose=close;stage='people';}
   else{pose=close;stage=t<originalDuration?'settle':'complete';}
   return {pose,stage,progress:beat(t,buildStart,buildEnd),people:beat(t,buildEnd-.4,buildEnd+.45),arrival:beat(t,arrive-.25,arrive+.1)*(1-beat(t,buildStart,buildStart+.65)),finish:Math.sin(beat(t,buildEnd-.25,buildEnd+.8)*Math.PI),settle:beat(t,returnEnd,originalDuration),citywide,duration,done:t>=originalDuration};
  }};
}
