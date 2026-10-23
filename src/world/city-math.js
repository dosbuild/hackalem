/** One planar coordinate system for geometry, anchors, labels and pointer picking. */
export const CENTER = [71.431, 51.139];
export const MAX_ZOOM = 576;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const mix = (a,b,t) => a+(b-a)*t;
export const mapXY = p => [(p[0]-CENTER[0])*5.8,(p[1]-CENTER[1])*9.25];
export const surfacePoint = (x,y,h=0) => [x,y,h];
export const geoPoint = (p,h=0) => surfacePoint(...mapXY(p),h);
export function normalize(v) {const l=Math.hypot(...v)||1;return v.map(x=>x/l);}
export function cross(a,b) {return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
export function rotation(yaw,pitch) {const a=Math.cos(yaw),b=Math.sin(yaw),c=Math.cos(pitch),d=Math.sin(pitch);return [a,c*b,-d*b,-b,c*a,-d*a,0,d,c];}
export function transform(m,p) {return [m[0]*p[0]+m[3]*p[1]+m[6]*p[2],m[1]*p[0]+m[4]*p[1]+m[7]*p[2],m[2]*p[0]+m[5]*p[1]+m[8]*p[2]];}
export function anchorPose(p) {const [x,y]=mapXY(p);return {x,y};}
export function boundedPose(v,maxZoom=MAX_ZOOM) {return {...v,x:clamp(v.x,-1.13,1.30),y:clamp(v.y,-1.20,1.40),yaw:clamp(v.yaw,-Math.PI,Math.PI),pitch:clamp(v.pitch,.35,1.0),zoom:clamp(v.zoom,1,maxZoom)};}
/** Intersect a view-space ray with z=0; no spherical horizon or back-face picking. */
export function inversePoint(x,y,m,center=[0,0]) {const det=m[0]*m[4]-m[3]*m[1];if(Math.abs(det)<.01)return null;return [CENTER[0]+((x*m[4]-m[3]*y)/det+center[0])/5.8,CENTER[1]+((m[0]*y-x*m[1])/det+center[1])/9.25];}
export function insideRing(p,ring) {let v=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;}
export function contains(geometry,p) {return (geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates).some(poly=>insideRing(p,poly[0])&&!poly.slice(1).some(r=>insideRing(p,r)));}
/** Keep the center on a scenario polygon, including at maximum zoom. */
export function confinePose(value,districts,maxZoom=MAX_ZOOM) {
 const pose=boundedPose(value,maxZoom),p=[CENTER[0]+pose.x/5.8,CENTER[1]+pose.y/9.25];
 if(districts.some(d=>contains(d.geometry,p)))return pose;
 let closest=null,distance=Infinity;
 for(const d of districts)for(const poly of d.geometry.type==='Polygon'?[d.geometry.coordinates]:d.geometry.coordinates)for(const ring of poly)for(let i=1;i<ring.length;i++){
  const a=mapXY(ring[i-1]),b=mapXY(ring[i]),dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((pose.x-a[0])*dx+(pose.y-a[1])*dy)/(dx*dx+dy*dy||1),0,1),q=[a[0]+dx*t,a[1]+dy*t],dist=Math.hypot(q[0]-pose.x,q[1]-pose.y);
  if(dist<distance){distance=dist;closest=q;}
 }
 return closest?{...pose,x:closest[0],y:closest[1]}:pose;
}
