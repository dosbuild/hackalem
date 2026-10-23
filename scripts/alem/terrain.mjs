/** The source footprint determines coverage; only its buffered apron is rounded. */
import {bounds,spatialIndex,inPolygon,corridor} from '../../src/world/placement-geometry.js';
import {PALETTE} from '../../src/design/palette.js';
import {rgb} from './city-style.mjs';
const key=(x,y)=>x+'/'+y;
const area=ring=>ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;

/** Trace the exterior, not a rectangle or convex hull across unmapped land. */
export function cellContours(cells,cell) {
 const edges=new Map();
 for(const k of cells){const [x,y]=k.split('/').map(Number),p=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
  for(const [i,dx,dy] of [[0,0,-1],[1,1,0],[2,0,1],[3,-1,0]])if(!cells.has(key(x+dx,y+dy))){
   const a=p[i],b=p[(i+1)%4],id=key(...a);if(!edges.has(id))edges.set(id,[]);edges.get(id).push(b);
  }
 }
 const loops=[];
 while(edges.size){const first=edges.keys().next().value,start=first.split('/').map(Number),ring=[];let p=start,previous=[start[0]-1,start[1]],steps=0;
  do {ring.push(p.map(v=>v*cell));const id=key(...p),next=edges.get(id);if(!next?.length)throw Error('Open terrain contour');
   const direction=[p[0]-previous[0],p[1]-previous[1]];
   next.sort((a,b)=>turn(direction,p,a)-turn(direction,p,b));
   const q=next.shift();if(!next.length)edges.delete(id);previous=p;p=q;
   if(++steps>cells.size*4)throw Error('Terrain contour did not close');
  }while(key(...p)!==first);
  if(ring.length>=4)loops.push(ring);
 }
 return loops;
}
function turn(d,p,q){const a=Math.atan2(d[0]*(q[1]-p[1])-d[1]*(q[0]-p[0]),d[0]*(q[0]-p[0])+d[1]*(q[1]-p[1]));return a<0?a+Math.PI*2:a;}
export function softenContour(ring,passes=2){
 for(let n=0;n<passes;n++){const out=[];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];out.push(a.map((v,k)=>v*.75+b[k]*.25),a.map((v,k)=>v*.25+b[k]*.75));}ring=out;}
 return ring;
}
const segmentDistance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
function simplifyLine(points,tolerance){
 let distance=0,index=0;for(let i=1;i<points.length-1;i++){const d=segmentDistance(points[i],points[0],points.at(-1));if(d>distance){distance=d;index=i;}}
 if(distance<=tolerance)return [points[0],points.at(-1)];
 return [...simplifyLine(points.slice(0,index+1),tolerance).slice(0,-1),...simplifyLine(points.slice(index),tolerance)];
}
/** Split a closed line at its farthest point; identical endpoints break ordinary RDP. */
export function simplifyContour(ring,tolerance){
 let opposite=1;for(let i=2;i<ring.length;i++)if(Math.hypot(...ring[i].map((v,k)=>v-ring[0][k]))>Math.hypot(...ring[opposite].map((v,k)=>v-ring[0][k])))opposite=i;
 return [...simplifyLine(ring.slice(0,opposite+1),tolerance).slice(0,-1),...simplifyLine([...ring.slice(opposite),ring[0]],tolerance).slice(0,-1)];
}
/** The apron absorbs simplification. Every source cell corner must remain on land. */
export function terrainContours(occupied,cell){
 const points=[...occupied].flatMap(k=>{const [x,y]=k.split('/').map(Number);return [[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(p=>p.map(v=>v*cell));});
 for(let radius=2;radius<=5;radius++){
  const cover=new Set();for(const k of occupied){const [x,y]=k.split('/').map(Number);for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++)if(dx*dx+dy*dy<=radius*radius)cover.add(key(x+dx,y+dy));}
  const loops=cellContours(cover,cell).filter(ring=>area(ring)>0).map(ring=>softenContour(simplifyContour(ring,cell*1.35),4));
  if(points.every(p=>loops.some(ring=>inPolygon(p,[ring]))))return {loops,cells:cover.size,buffer:radius*cell};
 }
 throw Error('Smoothed terrain must contain every source cell');
}
export function buildTerrain({features,districtAt,quad,fill}){
 const cell=.035,items=[];
 for(const f of features){for(const rings of f.polys)items.push({bounds:bounds(rings[0]),rings});if(f.layer==='streets')for(const line of f.lines)for(let i=1;i<line.length;i++){const rings=[corridor(line[i-1],line[i],.003)];items.push({bounds:bounds(rings[0]),rings});}}
 const index=spatialIndex(items,.07),occupied=new Set();
 for(let x=-41;x<=43;x++)for(let y=-34;y<=48;y++){const p=[(x+.5)*cell,(y+.5)*cell],b=[x*cell,y*cell,(x+1)*cell,(y+1)*cell];if(districtAt(p)||index(b).some(o=>o.rings[0].some(q=>q[0]>=b[0]&&q[0]<=b[2]&&q[1]>=b[1]&&q[1]<=b[3])||inPolygon(p,o.rings)))occupied.add(key(x,y));}
 const {loops,cells,buffer}=terrainContours(occupied,cell);
 for(const ring of loops)fill([ring],rgb(PALETTE.land),-.00006,21);
 for(const ring of loops){
  const center=ring.reduce((p,q)=>[p[0]+q[0]/ring.length,p[1]+q[1]/ring.length],[0,0]);
  const lower=p=>[center[0]+(p[0]-center[0])*.998,center[1]+(p[1]-center[1])*.998,-.014];
  const normal=i=>{const a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length],x=b[1]-a[1],y=a[0]-b[0],l=Math.hypot(x,y);return [x/l,y/l,0];};
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];
   const normals=[normal(i),normal((i+1)%ring.length),normal((i+1)%ring.length),normal(i)];
   quad(lower(a),lower(b),[...b,-.0022],[...a,-.0022],rgb(PALETTE.landEdge),20,0,normals);
   quad([...a,-.0022],[...b,-.0022],[...b,-.00006],[...a,-.00006],rgb(PALETTE.landRim),20,0,normals);
  }
 }
 return {cells,cellSize:cell,buffer,contours:loops.length,edge:'continuous-buffered-contour'};
}
