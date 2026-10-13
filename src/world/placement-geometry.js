// Geometry in the renderer's local planar coordinates. Shared by preparation and audit.
export const distance = (a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const bounds = points=>[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
export const overlaps=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
export function pointSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return distance(p,[a[0]+t*dx,a[1]+t*dy]);}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function segmentsCross(a,b,c,d){return cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&overlaps(bounds([a,b]),bounds([c,d]));}
export function inRing(p,r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export const inPolygon=(p,rings)=>inRing(p,rings[0])&&!rings.slice(1).some(r=>inRing(p,r));
export function polygonTouches(a,b,buffer=0){
 if(a[0].some(p=>inPolygon(p,b))||b[0].some(p=>inPolygon(p,a)))return true;
 for(const ar of a)for(const br of b)for(let i=0;i<ar.length;i++)for(let j=0;j<br.length;j++){
  const p=ar[i],q=ar[(i+1)%ar.length],r=br[j],s=br[(j+1)%br.length];
  if(segmentsCross(p,q,r,s)||Math.min(pointSegment(p,r,s),pointSegment(q,r,s),pointSegment(r,p,q),pointSegment(s,p,q))<buffer)return true;
 }return false;
}
export function rectangle(p,w,h,angle=0){const c=Math.cos(angle),s=Math.sin(angle);return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>[p[0]+x*c-y*s,p[1]+x*s+y*c]);}
export function corridor(a,b,width){const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return [[a[0]-dy/l*width,a[1]+dx/l*width],[b[0]-dy/l*width,b[1]+dx/l*width],[b[0]+dy/l*width,b[1]-dx/l*width],[a[0]+dy/l*width,a[1]-dx/l*width]];}
export function spatialIndex(items,cell=.025){
 const cells=new Map();const keys=b=>{const out=[];for(let x=Math.floor(b[0]/cell);x<=Math.floor(b[2]/cell);x++)for(let y=Math.floor(b[1]/cell);y<=Math.floor(b[3]/cell);y++)out.push(`${x}/${y}`);return out;};
 for(const item of items)for(const key of keys(item.bounds)){if(!cells.has(key))cells.set(key,[]);cells.get(key).push(item);}
 return b=>[...new Set(keys(b).flatMap(k=>cells.get(k)||[]))].filter(i=>overlaps(i.bounds,b));
}
export function routeAt(route,t){const lengths=route.slice(1).map((p,i)=>distance(p,route[i])),total=lengths.reduce((a,b)=>a+b,0);let d=Math.max(0,Math.min(1,t))*total;for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1){const a=route[i],b=route[i+1],f=d/(lengths[i]||1);return {point:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],angle:Math.atan2(b[1]-a[1],b[0]-a[0])};}d-=lengths[i];}return {point:route[0],angle:0};}
