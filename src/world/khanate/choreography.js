import {smooth,beat} from '../mesh-kit.js';
import {PROJECT_BUILD_MS,SCHOOL_BUILD_MS} from '../construction-clock.js';
export const OVERVIEW=Object.freeze({x:-.026,y:.03,yaw:-.24,pitch:.84,zoom:7});
export const CLOSE_ZOOM=240;
export const closePose=site=>{const view=site.view?.focus??site.view;return {...OVERVIEW,x:site.id==='M7'?site.origin[0]:view?.center?.[0]??site.origin[0],y:site.id==='M7'?site.origin[1]+.0006:view?.center?.[1]??site.origin[1]+.0004,pitch:1,zoom:site.id==='M7'?280:site.program||site.parentKey?view?.zoom??site.view?.zoom??CLOSE_ZOOM:site.route?30:site.view?.zoom??CLOSE_ZOOM};};
export const eventPose=site=>closePose(site);
export function createChoreography(record,start,from,close=eventPose(record)){
 const duration=(record.id==='M7'&&record.district==='nura'?SCHOOL_BUILD_MS:PROJECT_BUILD_MS)/1000,citywide=!!record.citywide,alreadyHere=from.zoom>40&&Math.hypot(from.x-close.x,from.y-close.y)<.02,destination=alreadyHere?{...from}:close;
 return {key:record.key,id:record.id,start,citywide,from:{...from},close:destination,duration,
  sample(now){const t=Math.max(0,(now-start)/1000)/duration,approachEnd=citywide?.26:.16,flight=smooth((t-(citywide?.09:0))/(approachEnd-(citywide?.09:0))),progress=beat(t,approachEnd,.83),origin=citywide?OVERVIEW:from;
   const pose=citywide&&t<.09?{...OVERVIEW}:t<approachEnd?{x:origin.x+(destination.x-origin.x)*flight,y:origin.y+(destination.y-origin.y)*flight,yaw:origin.yaw+(destination.yaw-origin.yaw)*flight,pitch:origin.pitch+(destination.pitch-origin.pitch)*flight,zoom:Math.exp(Math.log(origin.zoom)+(Math.log(destination.zoom)-Math.log(origin.zoom))*flight)}:{...destination};
   return {pose,stage:citywide&&t<.09?'district':t<approachEnd?'approach':t<.83?'build':t<.96?'people':t<1?'settle':'complete',progress,people:beat(t,.75,.95),arrival:1-beat(t,approachEnd,approachEnd+.12),finish:Math.sin(beat(t,.80,.96)*Math.PI),settle:beat(t,.96,1),citywide,duration,done:t>=1};
  }};
}
