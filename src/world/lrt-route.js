import data from './lrt-route.json' with {type:'json'};
import {mapXY} from './city-math.js';
export const LRT_SCALE=1/12000;
const source=data.points.map(mapXY);
export const LRT_POINTS=source.map((p,i)=>{
 const a=source[Math.max(0,i-1)],b=source[Math.min(source.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
 return [p[0]+dy/length*data.trackOffsetM*LRT_SCALE,p[1]-dx/length*data.trackOffsetM*LRT_SCALE];
});
export const LRT_LENGTHS=[0];for(let i=1;i<LRT_POINTS.length;i++)LRT_LENGTHS.push(LRT_LENGTHS.at(-1)+Math.hypot(LRT_POINTS[i][0]-LRT_POINTS[i-1][0],LRT_POINTS[i][1]-LRT_POINTS[i-1][1])/LRT_SCALE);
export const LRT_LENGTH=LRT_LENGTHS.at(-1);
export function lrtAt(distance,offset=0){
 const d=Math.max(0,Math.min(LRT_LENGTH,distance));let lo=0,hi=LRT_LENGTHS.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(LRT_LENGTHS[mid]<d)lo=mid;else hi=mid;}
 const a=LRT_POINTS[lo],b=LRT_POINTS[hi],t=(d-LRT_LENGTHS[lo])/(LRT_LENGTHS[hi]-LRT_LENGTHS[lo]||1),angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
 return {point:[a[0]+(b[0]-a[0])*t-Math.sin(angle)*offset*LRT_SCALE,a[1]+(b[1]-a[1])*t+Math.cos(angle)*offset*LRT_SCALE],angle,distance:d};
}
export function lrtNearest(point){let best={distance:0,error:Infinity};for(let i=1;i<LRT_POINTS.length;i++){
 const a=LRT_POINTS[i-1],b=LRT_POINTS[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy))),q=[a[0]+t*dx,a[1]+t*dy],error=Math.hypot(q[0]-point[0],q[1]-point[1]);
 if(error<best.error)best={distance:LRT_LENGTHS[i-1]+(LRT_LENGTHS[i]-LRT_LENGTHS[i-1])*t,error};
}return best;}
export const LRT_STATIONS=data.stations.map(s=>({...s,...lrtNearest(mapXY(s.position))})).sort((a,b)=>a.distance-b.distance);
