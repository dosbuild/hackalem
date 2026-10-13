const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const closest=(p,a,b)=>{const x=b.x-a.x,y=b.y-a.y,length=x*x+y*y,t=length?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/length)):0;return {x:a.x+t*x,y:a.y+t*y};};
/** The silhouette of the projected physical bounds, leaving empty corners free. */
export function projectLabelVolume(points){
 const sorted=points.filter(p=>p.visible!==false&&Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>({x:p.x,y:p.y})).sort((a,b)=>a.x-b.x||a.y-b.y),unique=sorted.filter((p,i)=>!i||p.x!==sorted[i-1].x||p.y!==sorted[i-1].y);
 if(unique.length<3)return null;
 const chain=points=>{const out=[];for(const p of points){while(out.length>1&&cross(out[out.length-2],out[out.length-1],p)<=0)out.pop();out.push(p);}return out;};
 const lower=chain(unique),upper=chain(unique.slice().reverse()),outline=[...lower.slice(0,-1),...upper.slice(0,-1)];
 if(outline.length<3)return null;
 return {left:unique[0].x,right:unique.at(-1).x,top:Math.min(...unique.map(p=>p.y)),bottom:Math.max(...unique.map(p=>p.y)),outline};
}
/** Attach the short leader to the actual silhouette rather than its empty box. */
export function projectLabelLeader(volume,point){
 let best=null,distance=Infinity;
 for(let i=0;i<volume.outline.length;i++){const p=closest(point,volume.outline[i],volume.outline[(i+1)%volume.outline.length]),d=(p.x-point.x)**2+(p.y-point.y)**2;if(d<distance){distance=d;best=p;}}
 return best;
}
/** Real, stationary footprint vertices from one uploaded project's packed mesh.
 * Read once when its proposal/completed geometry appears; camera frames only
 * project the bounded result. A framing box is never an attachment surface. */
export function projectLabelFootprint(mesh,bounds){
 if(!bounds?.length||!mesh.byteLength)return [];
 const min=[0,1,2].map(axis=>Math.min(...bounds.map(p=>p[axis]))),max=[0,1,2].map(axis=>Math.max(...bounds.map(p=>p[axis]))),epsilon=2e-7;
 const inside=(x,y,z)=>x>=min[0]-epsilon&&x<=max[0]+epsilon&&y>=min[1]-epsilon&&y<=max[1]+epsilon&&z>=min[2]-epsilon&&z<=max[2]+epsilon;
 let ground=Infinity,body=Infinity;
 for(let at=0;at+20<=mesh.byteLength;at+=20){
  const kind=mesh.getUint8(at+18);if(kind!==4&&kind!==8)continue;
  const x=mesh.getFloat32(at,true),y=mesh.getFloat32(at+4,true),z=mesh.getFloat32(at+8,true);if(!inside(x,y,z))continue;
  if(kind===4)ground=Math.min(ground,z);else body=Math.min(body,z);
 }
 const kind=Number.isFinite(ground)?4:8,base=kind===4?ground:body;if(!Number.isFinite(base))return [];
 const cells=new Map(),w=Math.max(epsilon,max[0]-min[0]),h=Math.max(epsilon,max[1]-min[1]);
 for(let at=0;at+20<=mesh.byteLength;at+=20){
  if(mesh.getUint8(at+18)!==kind)continue;
  const x=mesh.getFloat32(at,true),y=mesh.getFloat32(at+4,true),z=mesh.getFloat32(at+8,true);if(z>base+epsilon||!inside(x,y,z))continue;
  const column=Math.min(7,Math.max(0,Math.floor((x-min[0])/w*8))),row=Math.min(3,Math.max(0,Math.floor((y-min[1])/h*4))),key=row*8+column,cx=min[0]+(column+.5)*w/8,cy=min[1]+(row+.5)*h/4,distance=(x-cx)**2+(y-cy)**2,prior=cells.get(key);
  if(!prior||distance<prior.distance||distance===prior.distance&&(x<prior.point[0]||x===prior.point[0]&&(y<prior.point[1]||y===prior.point[1]&&z<prior.point[2])))cells.set(key,{point:[x,y,z],distance});
 }
 return [...cells.entries()].sort((a,b)=>a[0]-b[0]).map(([,cell])=>cell.point);
}
function leaderCrossesVolume(a,b,volume,pad=2){
 if(Math.max(a.x,b.x)<volume.left-pad||Math.min(a.x,b.x)>volume.right+pad||Math.max(a.y,b.y)<volume.top-pad||Math.min(a.y,b.y)>volume.bottom+pad)return false;
 const outline=volume.outline||[{x:volume.left,y:volume.top},{x:volume.right,y:volume.top},{x:volume.right,y:volume.bottom},{x:volume.left,y:volume.bottom}];
 if(outline.length<3)return false;
 const inside=p=>{let sign=0;for(let i=0;i<outline.length;i++){const d=cross(outline[i],outline[(i+1)%outline.length],p);if(d&&sign&&Math.sign(d)!==sign)return false;if(d)sign=Math.sign(d);}return true;};
 if(inside(a)||inside(b))return true;
 const near=(p,x,y)=>{const q=closest(p,x,y);return (p.x-q.x)**2+(p.y-q.y)**2<=pad*pad;};
 for(let i=0;i<outline.length;i++){
  const c=outline[i],d=outline[(i+1)%outline.length];
  if(Math.max(a.x,b.x)>=Math.min(c.x,d.x)&&Math.min(a.x,b.x)<=Math.max(c.x,d.x)&&Math.max(a.y,b.y)>=Math.min(c.y,d.y)&&Math.min(a.y,b.y)<=Math.max(c.y,d.y)&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)return true;
  if(near(a,c,d)||near(b,c,d)||near(c,a,b)||near(d,a,b))return true;
 }
 return false;
}
/** Choose an actual projected mesh vertex, without bridging empty gaps or a protected resident. */
export function projectLabelPhysicalLeader(points,point,viewport,obstacles=[],protectedVolumes=[]){
 let best=null,distance=Infinity;
 for(const p of points){
  if(p.visible===false||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
  if(viewport&&(p.x<8||p.x>viewport.width-8||p.y<140||p.y>viewport.height-55||obstacles.some(r=>p.x>=r.left-10&&p.x<=r.right+10&&p.y>=r.top-10&&p.y<=r.bottom+10)))continue;
  // The canvas ends at a clamped plate edge; its center ray can miss a resident.
  const end=protectedVolumes.length&&point.box?{x:Math.min(point.box.right,Math.max(point.box.left,p.x)),y:Math.min(point.box.bottom,Math.max(point.box.top,p.y))}:point;
  if(protectedVolumes.some(volume=>leaderCrossesVolume(p,end,volume)))continue;
  const d=(p.x-point.x)**2+(p.y-point.y)**2;if(d<distance){distance=d;best=p;}
 }
 return best;
}
/** One sample per current static geometry; never retain the source mesh. */
export function createProjectLabelFootprints(){
 let current=new Map();
 return {
  reset(labels){current=new Map(labels.map(({site,bounds})=>[site,{bounds,points:undefined}]));},
  capture(site,mesh,constructing){
   const entry=current.get(site);if(!entry)return;
   if(constructing){entry.points=undefined;return;}
   if(entry.points===undefined)entry.points=projectLabelFootprint(mesh,entry.bounds);
  },
  read(site){return current.get(site)?.points;},
  clear(){current.clear();}
 };
}
/** Eligible project buttons retain integer dimensions between layout changes. */
export function createProjectLabelSizes(resizeTarget,fonts){
 let sizes=new WeakMap(),alive=true;
 const invalidate=()=>{if(alive)sizes=new WeakMap();};
 resizeTarget.addEventListener('resize',invalidate);
 fonts?.addEventListener('loadingdone',invalidate);
 fonts?.ready.then(invalidate,()=>{});
 return {
  read(button){
   const cached=alive&&sizes.get(button);if(cached)return cached;
   const size={width:button.offsetWidth,height:button.offsetHeight};
   // Hidden or partially measured buttons must be measured again when visible.
   if(alive&&size.width>0&&size.height>0)sizes.set(button,size);
   return size;
  },
  invalidate,
  destroy(){alive=false;sizes=new WeakMap();resizeTarget.removeEventListener('resize',invalidate);fonts?.removeEventListener('loadingdone',invalidate);}
 };
}
function overlap(box,obstacle,pad){
 const left=box.left-pad,right=box.right+pad,top=box.top-pad,bottom=box.bottom+pad;
 if(right<=obstacle.left||left>=obstacle.right||bottom<=obstacle.top||top>=obstacle.bottom)return false;
 const outline=obstacle.outline;if(!outline||outline.length<3)return true;
 const x=(left+right)/2,y=(top+bottom)/2,w=(right-left)/2,h=(bottom-top)/2;
 // Rectangle axes were tested above; each convex edge supplies the other SAT axis.
 for(let i=0;i<outline.length;i++){
  const a=outline[i],b=outline[(i+1)%outline.length],nx=b.y-a.y,ny=a.x-b.x;if(!nx&&!ny)continue;
  let min=Infinity,max=-Infinity;for(const p of outline){const d=p.x*nx+p.y*ny;min=Math.min(min,d);max=Math.max(max,d);}
  const center=x*nx+y*ny,radius=Math.abs(nx)*w+Math.abs(ny)*h;
  if(center+radius<=min||center-radius>=max)return false;
 }
 return true;
}
/** Keep an object's nameplate clickable even when a guidance card covers its anchor. */
export function placeProjectLabel(anchor,preferred,size,viewport,obstacles) {
 const half=size.width/2,height=size.height/2,pad=7;
 const left=half+8,right=viewport.width-half-8,top=145+height,bottom=viewport.height-85-height;
 if(left>right||top>bottom)return null;
 const candidate=(rawX,y)=>{
  const x=Math.max(left,Math.min(right,rawX));
  if(y<top||y>bottom)return null;
  const box={left:x-half,right:x+half,top:y-height,bottom:y+height};
  if(obstacles.some(r=>overlap(box,r,pad)))return null;
  return {x,y,box};
 };
 const preferredPlace=candidate(preferred.x,preferred.y);if(preferredPlace)return preferredPlace;
 // Exact obstacle edges retain narrow legal spaces beside the physical object
 // or a sheet. Choose the nearest fallback instead of the first distant row.
 const xs=[preferred.x,anchor.x,left,right,...obstacles.flatMap(r=>[r.left-half-pad-1,r.right+half+pad+1])];
 const ys=[preferred.y,anchor.y,top,bottom,...obstacles.flatMap(r=>[r.top-height-pad-1,r.bottom+height+pad+1])];
 let best=null,distance=Infinity;
 const consider=place=>{if(!place)return;const d=(place.x-anchor.x)**2+(place.y-anchor.y)**2;if(d<distance){distance=d;best=place;}};
 for(const obstacle of obstacles)if(obstacle.outline)for(let i=0;i<obstacle.outline.length;i++){
  const a=obstacle.outline[i],b=obstacle.outline[(i+1)%obstacle.outline.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)continue;
  const nx=dy/length,ny=-dx/length,q=closest(anchor,a,b),support=Math.abs(nx)*(half+pad)+Math.abs(ny)*(height+pad)+1;
  consider(candidate(q.x+nx*support,q.y+ny*support));
 }
 for(const y of ys)for(const rawX of xs){
  consider(candidate(rawX,y));
 }
 return best;
}
