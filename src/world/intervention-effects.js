import {beat,blend} from './mesh-kit.js';
import {routeAt} from './placement-geometry.js';

export const FAMILY={M1:'transport',M2:'transport',M3:'transport',M4:'environment',M5:'environment',M6:'environment',M7:'people',M8:'people',M9:'people',M10:'safety',M11:'safety',M12:'services',M13:'services',M14:'services'};
export const ACCENT={transport:'#91d5cc',environment:'#b5d78c',people:'#e6c48d',safety:'#f4ce88',services:'#97d3da'};
export const pop=(p,a,b)=>{const t=beat(p,a,b);return t+Math.sin(t*Math.PI)*.12;};
export function routeSection(route,from,to){const lengths=route.slice(1).map((p,i)=>Math.hypot(p[0]-route[i][0],p[1]-route[i][1])),total=lengths.reduce((a,b)=>a+b,0),points=[routeAt(route,from).point];let at=0;for(let i=0;i<lengths.length;i++){at+=lengths[i];if(at>from*total&&at<to*total)points.push(route[i+1]);}points.push(routeAt(route,to).point);return points;}
export function groundRing(m,w,d,t,width,color,z=.00012){const r=.5*Math.max(.01,t),points=Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*2;return [Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**.45*w*r,Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**.45*d*r];});m.ribbon(points,width,color,1,z);}
/** Native geometry and the renderer's existing local illumination punctuate the event. */
export function arrivalMark(m,o,p,options){const a=options.active;if(!a||a.id!==o.id||o.proposal)return;const pulse=a.finish??Math.sin(beat(p,.72,1)*Math.PI),anticipate=a.arrival??(1-beat(p,.03,.23))*beat(p,0,.03),strength=Math.max(anticipate,pulse*.8,a.stage==='settle'?Math.sin((a.settle||0)*Math.PI)*.8:0);if(strength<=.005)return;
 const color=ACCENT[FAMILY[o.id]],macro=(options.zoom||1)<12,px=1/(options.scale||324);m.tint=c=>blend(c,c,0);m.kind=macro?14:11;m.at(o.origin,0,1);
 if(macro){groundRing(m,30*px,25*px,.65+.35*(a.settle??pulse),Math.max(.03,strength)*1.2*px,color,.001);}
 else if(o.size){groundRing(m,o.size[0]*.97,o.size[1]*.95,.25+.75*beat(p,0,.8),.000025+.00005*strength,color,.00012);}
 else if(o.route){const span=.002+beat(p,0,.8)*.01;for(const side of [-1,1]){const q=routeAt(o.route,.5+side*span/Math.max(.03,o.route.reduce((l,v,i)=>i?l+Math.hypot(v[0]-o.route[i-1][0],v[1]-o.route[i-1][1]):0,0)));m.at([...q.point,.00096],q.angle,1);m.ribbon([[0,-.00038],[0,.00038]],.00005*strength,color);}}
 m.kind=8;
}
export function eventLight(objects,active){
 if(!active||active.citywide||!['overview','district','approach','anticipation','build','activation','people'].includes(active.stage))return null;
 const o=objects.find(o=>o.key===active.key);if(!o)return null;
 const establishing=['overview','district','approach'].includes(active.stage),elapsed=active.elapsed||0;
 const strength=establishing?Math.sin(Math.min(1,elapsed/1.55)*Math.PI)*.26:(active.arrival||0)*.27+(active.finish||0)*.46;
 return {origin:o.origin,radius:establishing?.08+elapsed*.17:o.size?Math.max(...o.size)*1.7:.023,strength,color:ACCENT[FAMILY[o.id]]};
}
