import {rotation,transform,geoPoint,inversePoint,clamp} from './city-math.js';

/** One immutable frame is consumed by WebGL, world sprites, annotations and picking. */
export function cameraFrame(pose,width,height,id=0,options={}) {
 const matrix=Array.from(new Float32Array(rotation(pose.yaw,pose.pitch)));
 const scale=Math.min(height*.36,width*.29)*pose.zoom;
 const overview=options.overviewZoom??1,t=clamp((pose.zoom/overview-1.2)/1.8,0,1);
 // One scale drives both lenses. Geographic overview is orthographic; a 25°
 // architectural lens grows continuously as the player comes into the streets.
 const perspective=options.perspective===false?0:t*t*(3-2*t)*scale/(height*2.2);
 const world=p=>{const q=transform(matrix,[p[0]-pose.x,p[1]-pose.y,p[2]||0]),w=1-q[2]*perspective;return {x:width/2+q[0]*scale/w,y:height/2-q[1]*scale/w,z:q[2],visible:w>.015&&Math.abs(q[2]/w)<4};};
 const inverseWorld=(x,y,altitude=0)=>{
  const sx=(x-width/2)/scale,sy=(height/2-y)/scale,m=matrix;
  const n=[m[1]*m[5]-m[2]*m[4],m[2]*m[3]-m[0]*m[5],m[0]*m[4]-m[1]*m[3]],a=n[0]*sx+n[1]*sy,den=n[2]-perspective*a;
  if(Math.abs(den)<.00001)return null;
  const z=((n[0]*m[6]+n[1]*m[7]+n[2]*m[8])*altitude-a)/den,w=1-z*perspective;if(w<=.015)return null;
  const qx=sx*w-m[6]*altitude,qy=sy*w-m[7]*altitude;
  return [pose.x+(qx*m[4]-m[3]*qy)/n[2],pose.y+(m[0]*qy-qx*m[1])/n[2],altitude];
 };
 return {id,width,height,pose:{...pose},matrix,scale,perspective,rendererZoom:scale/(height*.415),world,inverseWorld,
  project:(p,h=0)=>world(geoPoint(p,h)),
  inverse:(x,y)=>{const p=inverseWorld(x,y);return p?inversePoint(0,0,matrix,p):null;},
  /** Pixel-art coordinates are a vertical world plane, in world units, not screen pixels. */
  billboard(p,unit=.00032){const o=world(p),x=world([p[0]+unit,p[1],p[2]]),z=world([p[0],p[1],p[2]-unit]);return [x.x-o.x,x.y-o.y,z.x-o.x,z.y-o.y,o.x,o.y];},
 };
}
export function occluded(p,rects,padding=0){return rects.some(r=>p.x>=r.left-padding&&p.x<=r.right+padding&&p.y>=r.top-padding&&p.y<=r.bottom+padding);}
/** Fit a physical place into the city area left visible by its context sheet. */
export function fitContext(pose,points,width,height,rects,options={}){
 if(!points.length)return pose;
 const pad=10,left=16,right=width-16,top=width<=800?110:140,bottom=height-(width<=800?85:105);
 let region;
 if(width<=800){
  // A short atlas menu blocks only part of the width. Search the actual open
  // rectangles, so its city-side space remains usable above the bottom sheet.
  const blocked=rects.map(r=>({left:Math.max(left,r.left-pad),right:Math.min(right,r.right+pad),top:Math.max(top,r.top-pad),bottom:Math.min(bottom,r.bottom+pad)})).filter(r=>r.right>r.left&&r.bottom>r.top);
  const edges=[...new Set([left,right,...blocked.flatMap(r=>[r.left,r.right])])].sort((a,b)=>a-b);
  let area=0;
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
   const a=edges[i],b=edges[j];if(b-a<44)continue;
   const bands=blocked.filter(r=>r.left<b&&r.right>a).map(r=>[r.top,r.bottom]).sort((a,b)=>a[0]-b[0]);
   const consider=(start,end)=>{const size=(b-a)*(end-start);if(end-start>=44&&size>area){area=size;region={left:a,right:b,top:start,bottom:end};}};
   let start=top;for(const [y,z]of bands){consider(start,y);start=Math.max(start,z);}consider(start,bottom);
  }
  if(!region)return pose;
 }else{
  // Desktop/tablet context sheets occupy a side of the city. Keep the full
  // vertical view beside them instead of fitting only the focused point.
  region={left,right,top,bottom:height-145};
  const middle=(region.top+region.bottom)/2;
  for(const r of rects){
   if(r.top>=middle||r.bottom<=middle||r.right-r.left>width*.6)continue;
   if(r.left<=width*.2)region.left=Math.max(region.left,r.right+pad);
   else if(r.right>=width*.8)region.right=Math.min(region.right,r.left-pad);
  }
  if(region.right-region.left<44||region.bottom-region.top<44)return pose;
 }
 const bounds=frame=>{const p=points.map(frame.world);return {left:Math.min(...p.map(q=>q.x)),right:Math.max(...p.map(q=>q.x)),top:Math.min(...p.map(q=>q.y)),bottom:Math.max(...p.map(q=>q.y))};};
 const initial=bounds(cameraFrame(pose,width,height,0,options));
 if(initial.left>=region.left&&initial.right<=region.right&&initial.top>=region.top&&initial.bottom<=region.bottom)return pose;
 let next={...pose};const center=[0,1,2].map(i=>(Math.min(...points.map(p=>p[i]))+Math.max(...points.map(p=>p[i])))/2);
 // A district-scale volume can cross the close lens's near plane. Its
 // projected bounds then explode or reverse; a ratio from those bounds is
 // meaningless. Retreat in bounded steps before measuring the useful fit.
 for(let step=0;step<12&&next.zoom>1;step++){
  const frame=cameraFrame(next,width,height,0,options),projected=points.map(frame.world),box=bounds(frame);
  if(projected.every(p=>p.visible&&Number.isFinite(p.x)&&Number.isFinite(p.y))&&box.right-box.left<4*(region.right-region.left)&&box.bottom-box.top<4*(region.bottom-region.top))break;
  next.zoom=Math.max(1,next.zoom*.5);
 }
 for(let step=0;step<5;step++){
  let frame=cameraFrame(next,width,height,0,options),box=bounds(frame);
  if(box.left>=region.left&&box.right<=region.right&&box.top>=region.top&&box.bottom<=region.bottom)return next;
  const ratio=Math.min((region.right-region.left)/(box.right-box.left),(region.bottom-region.top)/(box.bottom-box.top),1);
  if(ratio<1)next.zoom=Math.max(1,next.zoom*ratio*.94);
  frame=cameraFrame(next,width,height,0,options);box=bounds(frame);
  // Perspective makes the visible box asymmetric around its world centre.
  // Pan by its measured screen displacement rather than recentering that one point.
  const projected=frame.world(center),dx=(region.left+region.right-box.left-box.right)/2,dy=(region.top+region.bottom-box.top-box.bottom)/2;
  const under=frame.inverseWorld(projected.x+dx,projected.y+dy,center[2]);
  if(under){next.x+=center[0]-under[0];next.y+=center[1]-under[1];}
 }
 return next;
}
/** Only move the camera when the geographic focus actually falls behind viewport UI. */
export function revealFocus(pose,point,width,height,rects,margin=44,altitude=0,options={}) {
 const f=cameraFrame(pose,width,height,0,options),p=f.project(point,altitude),bounds={left:margin,right:width-margin,top:Math.min(width<=800?140:200,height*.29),bottom:height-90};
 const legal=q=>q.x>=bounds.left&&q.x<=bounds.right&&q.y>=bounds.top&&q.y<=bounds.bottom&&!occluded(q,rects,margin);
 if(legal(p))return pose;
 const xs=[clamp(p.x,bounds.left,bounds.right),width/2,bounds.left,bounds.right,...rects.flatMap(r=>[r.left-margin-1,r.right+margin+1])];
 const ys=[clamp(p.y,bounds.top,bounds.bottom),height*.43,bounds.top,bounds.bottom,...rects.flatMap(r=>[r.top-margin-1,r.bottom+margin+1])];
 const choices=xs.flatMap(x=>ys.map(y=>({x,y}))).filter(legal).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
 if(!choices.length)return pose;
 const to=choices[0],under=f.inverseWorld(to.x,to.y,altitude),anchor=geoPoint(point,altitude);
 return under?{...pose,x:pose.x+anchor[0]-under[0],y:pose.y+anchor[1]-under[1]}:pose;
}
export function annotationPosition(anchor,size,viewport,rects=[]) {
 const {width,height}=viewport,w=size.width,h=size.height;
 if(width<=800)return {x:8,y:height-h-8};
 const candidates=[{x:anchor.x+72,y:anchor.y-h*.5},{x:anchor.x-w-72,y:anchor.y-h*.5}].map(p=>({x:clamp(p.x,16,width-w-16),y:clamp(p.y,138,height-h-82)}));
 const overlap=p=>rects.reduce((sum,r)=>sum+Math.max(0,Math.min(p.x+w,r.right)-Math.max(p.x,r.left))*Math.max(0,Math.min(p.y+h,r.bottom)-Math.max(p.y,r.top)),0);
 return candidates.sort((a,b)=>overlap(a)-overlap(b))[0];
}
