import {Mesh,rgb} from './mesh-kit.js';
// Fifteen character units form a 2.4-metre authored silhouette, including headwear.
export const RESIDENT_SCALE=.000016;
export const RESIDENT_HEIGHT=15*RESIDENT_SCALE;
export const identitySeed=id=>[...id].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,17);
export function residentSignature(r){return JSON.stringify([r.id,r.visual,identitySeed(r.id)%7]);}
/** Expressive modular city characters; appearance comes from the existing stable registry. */
export function residentModel(m,r,origin,angle,seconds,activity='idle',detail=true){
 const v=r.visual,seed=identitySeed(r.id),height={small:.88,tall:1.12,regular:1,broad:1}[v.build],width=v.build==='broad'?1.22:1;
 m.at(origin,angle,RESIDENT_SCALE*height);m.kind=8;m.tint=c=>rgb(c);
 const seated=v.mobility==='wheelchair',walking=activity==='walk'&&!seated,phase=seconds*6+seed,walk=walking?Math.sin(phase)*1.3:0,hip=seated?4:5;
 // Continuous, identity-offset gestures keep hands from snapping up at zero crossings.
 const cadence=seconds*2+(seed%23)*.27,pulse=.5-.5*Math.cos(cadence);
 const gesture=activity==='wave'?.85+.12*Math.sin(seconds*5):activity==='point'?.82:activity==='talk'?.12+.33*pulse*pulse:activity==='use'?.08+.56*pulse:0;
 const carrying=v.prop&&!['headphones','scarf'].includes(v.prop);
 const coat=v.coat,accent=v.accent,skin=v.skin,hair=v.hair,shoe='#343e47',trouser='#465c68';
 for(const side of [-1,1]){const x=side*1.05*width,lift=walking?Math.max(0,Math.cos(phase)*side)*.34:0;m.beam([x,0,hip],[x,walk*side,1.1+lift],.75,trouser);m.ellipsoid(x,-.45+walk*side,.7+lift,1,1.5,.65,shoe,8,4);}
 m.ellipsoid(0,0,hip+1.9,2.65*width,v.cut==='wide'?2:1.6,v.cut==='long'?3.2:2.5,coat);
 if(v.cut==='vest')m.box(0,-1.5,hip+.9,1,.25,3.9,accent);
 if(v.cut==='long')m.cylinder(0,0,hip-1,2.3*width,3.6,coat,10,2.1*width);
 m.cylinder(0,0,hip+3.8,.9,1.1,skin);const head=hip+6.1;
 m.ellipsoid(0,0,head,2.65,2.1,2.7,skin,12,8);m.ellipsoid(0,.45,head+1.5,2.75,2.1,1.35,hair,12,6);
 if(v.head==='bob')m.ellipsoid(0,1.15,head-.2,2.8,1.7,2.55,hair);
 if(v.head==='bun')m.ellipsoid(.6,1.25,head+2.3,1.15,1.05,1.05,hair);
 if(v.head==='hood'){m.ellipsoid(0,1.1,head-.1,2.95,2,3,coat);m.ellipsoid(0,-.65,head,2.35,1.65,2.3,skin);}
 if(v.head==='cap'){m.ellipsoid(0,0,head+2,2.8,2.2,v.era==='khanate'?1.5:.95,accent);if(v.era==='khanate'){m.cylinder(0,0,head+1.5,2.7,.6,coat,16);if(detail)for(let i=0;i<12;i++){const a=i*Math.PI/6;m.ellipsoid(Math.cos(a)*2.73,Math.sin(a)*2.73,head+1.8,.17,.17,.2,accent,6,4);}}else m.box(0,-2.15,head+1.5,4.2,2,.3,accent);}
 if(v.era==='khanate'){m.cylinder(0,0,hip+.9,2.4*width,.55,accent,12);m.box(0,-2.4*width,hip+1,1,.35,.65,'#bea16a');m.beam([-1.5,-1.3,hip+4],[.7,-1.8,hip+1.5],.17,accent);}
 for(const side of [-1,1]){const shoulder=[side*2.15*width,0,hip+3.7],hand=side<0?[side*(2.65+.95*gesture),-.3-walk*side*.6-.5*gesture,hip+.7+5.6*gesture]:[side*2.65,carrying?-1.05:-.3-walk*side*.6,hip+.7];m.beam(shoulder,hand,.78,coat);m.ellipsoid(...hand,.78,.72,.82,skin,8,4);if(detail){m.ellipsoid(side*.9,-2,head+.2,.3,.22,.43,'#303738',8,4);m.ellipsoid(side*2.6,0,head,.42,.65,.75,skin,8,4);}}
 if(detail){m.ellipsoid(0,-2.16,head-.4,.43,.38,.48,skin,8,4);m.beam([-.6,-2.01,head-1.05],[0,-2.1,head-1.2],.12,'#995f51',5);m.beam([0,-2.1,head-1.2],[.6,-2.01,head-1.05],.12,'#995f51',5);for(const side of [-1,1])m.ellipsoid(side*1.55,-1.8,head-.6,.45,.15,.25,'#c78b79',8,4);m.box(0,-1.5,hip+3.9,1.1,.3,.5,accent);}
 if(seated){for(const side of [-1,1]){m.ellipsoid(side*2.8,.5,2.4,.36,2.3,2.3,shoe,10,6);m.ellipsoid(side*2.81,.5,2.4,.4,1.65,1.65,'#b5c2c1',10,6);}m.box(0,1,3.2,5,4,1,accent);m.box(0,2.4,4,4.7,.6,3.5,shoe);}
 if(v.mobility==='cane')m.beam([3,-1,.4],[3,-1,hip+1.1],.22,'#b7c2bb');
 const x=3,y=-1.2,z=hip+.9;
 switch(v.prop){
 case 'plant':case 'watering-can':m.cylinder(x,y,z-1,1.2,1.8,v.prop==='watering-can'?'#6fa59a':'#be7952',8,.95);if(v.prop==='watering-can')m.beam([x+.8,y,z],[x+2.1,y,z+1],.35,accent);else{m.beam([x,y,z],[x,y,z+3],.14,'#58875a');m.ellipsoid(x+.6,y,z+2.3,1,.35,.5,'#83a56d',8,4);}break;
 case 'gloves':for(const side of [-1,1]){m.ellipsoid(x+side*.45,y,z,.48,.3,1.1,accent,8,4);m.ellipsoid(x+side*.8,y,z+.1,.25,.3,.5,accent,6,4);}break;
 case 'ball':m.ellipsoid(x,y,z,1.45,1.45,1.45,'#dba454',10,6);break;
 case 'racket':m.beam([x,y,z-1],[x,y,z+1],.2,accent);m.ellipsoid(x,y,z+2,1.2,.25,1.7,'#a7c3b2',8,6);break;
 case 'umbrella':m.beam([x,y,1],[x,y,12],.17,shoe);m.ellipsoid(x,y,12,3.5,3.5,1,accent,10,4);break;
 case 'broom':m.beam([x,y,1],[x,y,8],.22,'#b79564');m.box(x,y,.2,2.2,.7,1.2,accent);break;
 case 'stroller':case 'cart':m.box(4,-3,2,3.2,4,2.1,coat);m.ellipsoid(4,-2,5,2,2.3,1.6,accent);for(const a of [2.7,5.3])for(const b of [-4.5,-1.5])m.ellipsoid(a,b,1,.5,.75,.75,shoe,8,4);break;
 case 'headphones':for(const a of [-2.7,2.7])m.ellipsoid(a,0,head,.45,.8,1,accent);break;
 case 'scarf':m.box(.8,-1.65,hip+1.2,.8,.3,4.6,accent);break;
 case 'thermos':m.cylinder(x,y,z,.6,2.2,'#c4d2d1',8);break;
 case 'camera':m.box(0,-2,hip+2.5,2.4,1.1,1.5,shoe);m.ellipsoid(0,-2.7,hip+3.2,.6,.4,.6,'#a4c4c0',8,4);break;
 default:{const books=['book','clipboard','folder'].includes(v.prop);m.box(x,y,z-1,books?2.1:2.4,books?.55:1.3,books?2.8:2.2,accent);if(!books)m.beam([x-.6,y,z+1.2],[x+.6,y,z+1.2],.16,shoe);}
 }
 if(r.signature)m.ellipsoid(-.7,-1.6,hip+3.3,.45,.2,.45,accent,8,4);
}
// Idle and pointing poses are independent of the visual clock. Keep only
// bounded exact world-space bodies; moving people retain every animation frame.
const stillBodies=new Map(),STILL_BODY_ENTRIES=32,STILL_BODY_BYTES=2*1024*1024;
let stillBodyBytes=0;
function residentBody(m,actor,seconds,detail){
 const {resident,position,angle,activity}=actor;
 const cacheable=(activity==='idle'||activity==='point')&&
  Array.isArray(position)&&position.length===3&&position.every(Number.isFinite)&&Number.isFinite(angle);
 const key=cacheable?JSON.stringify([residentSignature(resident),!!resident.signature,position,angle,detail,activity]):null;
 const cached=key&&stillBodies.get(key);
 if(cached){
  const end=m.bytes+cached.byteLength;
  if(end>m.buffer.byteLength){let capacity=m.buffer.byteLength;while(capacity<end)capacity*=2;const buffer=new ArrayBuffer(capacity);new Uint8Array(buffer).set(new Uint8Array(m.buffer));m.buffer=buffer;m.view=new DataView(buffer);}
  new Uint8Array(m.buffer,m.bytes,cached.byteLength).set(new Uint8Array(cached));m.bytes=end;
  stillBodies.delete(key);stillBodies.set(key,cached);return;
 }
 const start=m.bytes;residentModel(m,resident,position,angle,seconds,activity,detail);
 const bytes=m.bytes-start;
 if(key&&bytes&&bytes<=STILL_BODY_BYTES){
  while(stillBodies.size>=STILL_BODY_ENTRIES||stillBodyBytes+bytes>STILL_BODY_BYTES){const oldest=stillBodies.keys().next().value;stillBodyBytes-=stillBodies.get(oldest).byteLength;stillBodies.delete(oldest);}
  const data=m.buffer.slice(start,m.bytes);stillBodies.set(key,data);stillBodyBytes+=bytes;
 }
}
export function residentsMesh(actors,seconds,zoom){
 const m=new Mesh();if(zoom<18)return m.pack();
 for(const a of actors)residentBody(m,a,seconds,zoom>=55);
 // Only the runtime encounter cast receives a cue. Authored background people
 // also use talk poses through residentModel and retain their exact geometry.
 const selected=actors.find(a=>a.activity==='talk');
 if(selected){
  const outer=RESIDENT_HEIGHT*.18,inner=outer*.78,z=.000001;
  m.at(selected.position,0,1);m.kind=8;
  for(let i=0;i<24;i++){
   const a=i*Math.PI/12,b=(i+1)*Math.PI/12;
   m.quad([Math.cos(a)*outer,Math.sin(a)*outer,z],[Math.cos(b)*outer,Math.sin(b)*outer,z],[Math.cos(b)*inner,Math.sin(b)*inner,z],[Math.cos(a)*inner,Math.sin(a)*inner,z],'#92513c');
  }
 }
 return m.pack();
}
