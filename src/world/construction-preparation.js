import {beat,rgb} from './mesh-kit.js';
import {PALETTE} from '../design/palette.js';
import {inPolygon,pointSegment} from './placement-geometry.js';

export const PROPOSAL_TINT=.32;

/** Survey marks retire as the first physical part of this place takes over. */
export const preparationStrength=(progress,foundationAt=0)=>1-beat(progress,foundationAt,foundationAt+.045);

const roofFrames=new WeakMap();
/** Fit a small patch around the existing equipment on its exact source roof. */
export function roofPreparationFrame(roof){
 if(roofFrames.has(roof))return roofFrames.get(roof);
 if(!inPolygon(roof.position,roof.rings)){roofFrames.set(roof,null);return null;}
 const radius=Math.min(...roof.rings.flatMap(r=>r.map((a,i)=>pointSegment(roof.position,a,r[(i+1)%r.length]))))-.000055;
 const frame=radius>0?{center:roof.position,span:[Math.min(.0011,radius*1.3),Math.min(.0009,radius)],orientation:0}:null;roofFrames.set(roof,frame);return frame;
}

/** Actual work-site contact, never a network-sized presentation rectangle. */
export function groundPreparation(m,site,frame,strength=1,{ground=site.origin[2],wholeParcel=false}={}){
 if(!frame||strength<=.001)return;
 const saved={origin:m.origin,angle:m.angle,scale:m.scale,kind:m.kind,tint:m.tint};
 const width=Math.min(frame.span[0],wholeParcel?.009:.0022),depth=Math.min(frame.span[1],wholeParcel?.008:.0018);
 const corner=Math.min(width,depth)*.19,z=ground+.000003;
 m.at([frame.center[0],frame.center[1],z],frame.orientation||0,1);m.tint=rgb;
 for(const x of [-width/2,width/2])for(const y of [-depth/2,depth/2]){
  const dx=x<0?1:-1,dy=y<0?1:-1;
  m.kind=4;m.ribbon([[x+dx*corner,y],[x,y],[x,y+dy*corner]],.000026*strength,PALETTE.clay,1,0);
  m.kind=8;m.box(x,y,0,.000027,.000027,.00011*strength,'#80654c');
  m.box(x,y,.000075*strength,.00007,.000025,.000025*strength,PALETTE.brass);
 }
 // A few laid-out timber pieces give the first accepted frame a physical centre.
 m.kind=8;for(let i=0;i<3;i++)m.box(-width*.13,-depth*.18+i*Math.min(.000045,depth*.12),0,Math.min(.00029,width*.4),.000034,.000018*strength,'#aa8760');
 m.at(saved.origin,saved.angle,saved.scale);m.kind=saved.kind;m.tint=saved.tint;
}
