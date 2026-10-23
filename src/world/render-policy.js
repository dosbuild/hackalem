import {normalize,cross,transform} from './city-math.js';
/** Conservative projected 3D bounds; culling never controls data ownership. */
export function frustumPlanes({rotation:m,zoom,aspect,perspective=0}){
 if(!perspective)return null;
 const px=zoom*.83/aspect,py=zoom*.83;
 return [[px,0,-perspective],[-px,0,-perspective],[0,py,-perspective],[0,-py,-perspective],[0,0,-perspective-.25],[0,0,-perspective+.25]].map(([a,b,c])=>[a*m[0]+b*m[1]+c*m[2],a*m[3]+b*m[4]+c*m[5],a*m[6]+b*m[7]+c*m[8]]);
}
export function visibleBounds(bounds,{rotation:m,zoom,center,aspect,perspective=0,clipPlanes},pad=.000001){
  const x=(bounds[0]+bounds[2])*.5-center[0],y=(bounds[1]+bounds[3])*.5-center[1];
  const z=((bounds[4]||0)+(bounds[5]||0))*.5-(center[2]||0);
  const dx=(bounds[2]-bounds[0])*.5,dy=(bounds[3]-bounds[1])*.5,dz=((bounds[5]||0)-(bounds[4]||0))*.5;
  if(clipPlanes){
   for(let i=0;i<clipPlanes.length;i++){const p=clipPlanes[i],a=p[0],b=p[1],c=p[2];if(!(1+a*x+b*y+c*z+Math.abs(a)*dx+Math.abs(b)*dy+Math.abs(c)*dz>=-pad))return false;}
   return true;
  }
  if(perspective){
   const q=transform(m,[x,y,z]);
   // Test the six homogeneous clip planes. Dividing only the center by W
   // incorrectly culled buildings that straddle the architectural near plane.
   const inside=(a,b,c)=>1+a*q[0]+b*q[1]+c*q[2]+Math.abs(a*m[0]+b*m[1]+c*m[2])*dx+Math.abs(a*m[3]+b*m[4]+c*m[5])*dy+Math.abs(a*m[6]+b*m[7]+c*m[8])*dz>=-pad;
   const px=zoom*.83/aspect,py=zoom*.83;
   return inside(px,0,-perspective)&&inside(-px,0,-perspective)&&inside(0,py,-perspective)&&inside(0,-py,-perspective)&&inside(0,0,-perspective-.25)&&inside(0,0,-perspective+.25);
  }
  return Math.abs(m[0]*x+m[3]*y+m[6]*z)<=aspect/(zoom*.83)+Math.abs(m[0])*dx+Math.abs(m[3])*dy+Math.abs(m[6])*dz+pad
    &&Math.abs(m[1]*x+m[4]*y+m[7]*z)<=1/(zoom*.83)+Math.abs(m[1])*dx+Math.abs(m[4])*dy+Math.abs(m[7])*dz+pad;
}


/** Fixed world-space grids; zoom does not participate in either the projection or cache key. */
export function shadowFrame(time,_zoom,focusPoint,size=2048){
 const angle=Math.round(time*240)/240*Math.PI*2,sun=normalize([-Math.cos(angle),.55,Math.sin(angle)]),right=normalize(cross([0,1,0],sun)),up=cross(sun,right);
 const basis=[right[0],up[0],sun[0],right[1],up[1],sun[1],right[2],up[2],sun[2]],focus=transform(basis,focusPoint);
 const frames=[2.8,.5,.0625].map((extent,i)=>{
  const block=extent*2/size*256,light=i?focus.map((v,j)=>j===2?0:Math.round(v/block)*block):[0,0,0];
  const origin=[right[0]*light[0]+up[0]*light[1],right[1]*light[0]+up[1]*light[1],right[2]*light[0]+up[2]*light[1]];
  return {extent,origin,key:JSON.stringify([basis,extent,light])};
 });
 return {sun,basis,frames,key:frames.map(f=>f.key).join(':')};
}
