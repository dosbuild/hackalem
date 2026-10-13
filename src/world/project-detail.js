// Authored project architecture. Dimensions are local toy metres at .0001 world units.
// These details do not describe surveyed buildings or change placement / scenario data.
export const DETAIL={wall:'#d8c9ad',brick:'#b58b72',stone:'#e8dec7',plinth:'#b4a68c',roof:'#657176',roofLight:'#798386',roofEdge:'#505e62',glass:'#829aa1',recess:'#52676d',frame:'#dedbc9',metal:'#677576',wood:'#b7946e',paving:'#d6c5a4',earth:'#b9a586',green:'#8ba17b',accent:'#ae775b'};

export function framedWindow(m,x,y,z,w,h,side='front'){
 const horizontal=side==='front'||side==='back',out=side==='front'||side==='left'?-1:1;
 const slab=(a,b,c,W,D,H,color)=>m.box(a,b,c,W,D,H,color);
 if(horizontal){
  slab(x,y,z,w,.18,h,DETAIL.recess);slab(x,y+out*.11,z+.10,w-.22,.06,h-.20,DETAIL.glass);
  for(const dx of [-w/2,w/2])slab(x+dx,y+out*.17,z,.13,.16,h,DETAIL.frame);
  slab(x,y+out*.17,z,w+.12,.16,.13,DETAIL.frame);slab(x,y+out*.17,z+h-.13,w+.12,.16,.13,DETAIL.frame);
  slab(x,y+out*.20,z+h*.50,w,.10,.09,DETAIL.frame);slab(x,y+out*.28,z-.10,w+.36,.48,.12,DETAIL.stone);
 }else{
  slab(x,y,z,.18,w,h,DETAIL.recess);slab(x+out*.11,y,z+.10,.06,w-.22,h-.20,DETAIL.glass);
  for(const dy of [-w/2,w/2])slab(x+out*.17,y+dy,z,.16,.13,h,DETAIL.frame);
  slab(x+out*.17,y,z,.16,w+.12,.13,DETAIL.frame);slab(x+out*.17,y,z+h-.13,.16,w+.12,.13,DETAIL.frame);
  slab(x+out*.20,y,z+h*.50,.10,w,.09,DETAIL.frame);slab(x+out*.28,y,z-.10,.48,w+.36,.12,DETAIL.stone);
 }
}

export function projectRoof(m,x,y,z,w,d,rise=2.4){
 const X=w/2+.45,Y=d/2+.45;
 m.box(x,y,z-.18,w+.9,d+.9,.30,DETAIL.stone);
 if(w>=d){
  m.quad([x-X,y-Y,z],[x+X,y-Y,z],[x+w*.32,y,z+rise],[x-w*.32,y,z+rise],DETAIL.roof);
  m.quad([x-w*.32,y,z+rise],[x+w*.32,y,z+rise],[x+X,y+Y,z],[x-X,y+Y,z],DETAIL.roofLight);
  m.tri([x-X,y+Y,z],[x-X,y-Y,z],[x-w*.32,y,z+rise],DETAIL.roofEdge);
  m.tri([x+X,y-Y,z],[x+X,y+Y,z],[x+w*.32,y,z+rise],DETAIL.roof);
  m.beam([x-w*.32,y,z+rise],[x+w*.32,y,z+rise],.12,DETAIL.roofEdge,4);
 }else{
  m.quad([x-X,y-Y,z],[x,y-d*.32,z+rise],[x,y+d*.32,z+rise],[x-X,y+Y,z],DETAIL.roof);
  m.quad([x+X,y+Y,z],[x,y+d*.32,z+rise],[x,y-d*.32,z+rise],[x+X,y-Y,z],DETAIL.roofLight);
  m.tri([x-X,y-Y,z],[x+X,y-Y,z],[x,y-d*.32,z+rise],DETAIL.roofEdge);
  m.tri([x+X,y+Y,z],[x-X,y+Y,z],[x,y+d*.32,z+rise],DETAIL.roof);
  m.beam([x,y-d*.32,z+rise],[x,y+d*.32,z+rise],.12,DETAIL.roofEdge,4);
 }
}

export function civicModule(m,{x=0,y=0,z=.8,w,d,h,growth=1,levels=3,color=DETAIL.wall,lod='close',pitched=true}){
 if(growth<=0)return;
 const top=h*growth;
 m.box(x,y,z,w,d,top,color);m.box(x,y,z,w+.24,d+.24,Math.min(top,.85),DETAIL.plinth);
 for(const dx of [-w/2+.16,w/2-.16])for(const dy of [-d/2+.16,d/2-.16])m.box(x+dx,y+dy,z,.40,.40,top,DETAIL.stone);
 for(let floor=1;floor<levels;floor++){const height=floor*h/levels;if(top>height)m.box(x,y,z+height,w+.26,d+.26,.15,DETAIL.stone);}
 m.box(x,y,z+top-.15,w+.35,d+.35,.20,DETAIL.stone);
 if(growth>.98){if(pitched)projectRoof(m,x,y,z+h,w,d,Math.min(w,d)*.11);else{m.box(x,y,z+h,w+.25,d+.25,.30,DETAIL.roof);for(const side of [-1,1]){m.box(x,y+side*d/2,z+h,w+.4,.25,.45,DETAIL.stone);m.box(x+side*w/2,y,z+h,.25,d+.4,.45,DETAIL.stone);}}}
 if(lod!=='close')return;
 for(let floor=0;floor<levels;floor++){
  const Z=z+1.25+floor*h/levels,H=Math.min(2.0,h/levels-1.6);if(Z+H>z+top-.35)continue;
  for(const side of ['front','back'])for(let at=-w/2+2.6;at<w/2-1.4;at+=4.8)framedWindow(m,x+at,y+(side==='front'?-d/2-.02:d/2+.02),Z,1.65,H,side);
  for(const side of ['left','right'])for(let at=-d/2+2.6;at<d/2-1.4;at+=4.8)framedWindow(m,x+(side==='left'?-w/2-.02:w/2+.02),y+at,Z,1.65,H,side);
 }
}

export function entry(m,x,y,z=1,growth=1,width=4.2){
 if(growth<=0)return;
 m.box(x,y,z,width,.25,3.2*growth,DETAIL.recess);
 for(const dx of [-width/2,width/2])m.box(x+dx,y-.12,z,.24,.35,3.3*growth,DETAIL.stone);
 m.box(x,y-.14,z+3.2*growth,width+.45,.42,.24,DETAIL.stone);
 for(const dx of [-width*.23,width*.23])m.box(x+dx,y-.18,z+.1,width*.39,.08,2.95*growth,DETAIL.glass);
 m.box(x,y-.26,z,.12,.18,3.1*growth,DETAIL.frame);
 m.box(x,y-1.25,z+3.55*growth,width+1.2,3.0,.24,DETAIL.roof);
 for(const dx of [-width/2-.4,width/2+.4])m.box(x+dx,y-2.1,z,.14,.14,3.55*growth,DETAIL.metal);
 for(let step=0;step<3;step++)m.box(x,y-1.2-step*.65,z-.21-step*.21,width+1.0,.72,.21,DETAIL.stone);
 // The low sloped apron joins the same forecourt instead of a detached door box.
 m.quad([x+width/2+.6,y-.4,z],[x+width/2+2.4,y-.4,z],[x+width/2+2.4,y-5.2,.95],[x+width/2+.6,y-5.2,.95],DETAIL.paving);
}

export function busShelter(m,growth=1){
 if(growth<=0)return;
 m.box(0,0,0,7.6,3.5,.20,DETAIL.paving);
 for(const x of [-3.2,3.2])m.box(x,.8,.20,.14,.14,3.1*growth,DETAIL.metal);
 m.box(0,.8,.5,6.4,.08,2.5*growth,DETAIL.glass);
 for(const x of [-3.2,0,3.2])m.box(x,.72,.4,.12,.12,2.75*growth,DETAIL.frame);
 m.box(0,0,3.3*growth,7.5,3.4,.20,DETAIL.roof);m.box(0,-1.6,3.3*growth,7.5,.15,.30,DETAIL.stone);
 m.box(0,.45,.62,2.8,.65,.15,DETAIL.wood);for(const x of [-1,1])m.box(x,.45,.20,.12,.45,.42,DETAIL.metal);
 m.box(4,-.6,0,.14,.14,2.8*growth,DETAIL.metal);m.box(4,-.6,2.0*growth,1.0,.14,.8*growth,DETAIL.stone);
 m.box(4,-.69,2.15*growth,.65,.03,.35*growth,DETAIL.glass);
}

export function utilityCabinet(m,growth=1){
 if(growth<=0)return;
 m.box(0,0,0,3.4,2.2,.18,DETAIL.plinth);m.box(0,0,.18,2.7,1.7,2.15*growth,DETAIL.metal);
 m.box(0,0,.18+2.15*growth,3.0,2.0,.18,DETAIL.roof);m.box(0,-.87,.4,2.25,.05,1.6*growth,DETAIL.wall);
 m.box(-.2,-.91,.4,.08,.05,1.6*growth,DETAIL.roofEdge);m.box(.7,-.95,1.12,.12,.08,.25,DETAIL.metal);
 for(let z=.65;z<1.05;z+=.13)m.box(-.7,-.96,z,.70,.04,.04,DETAIL.recess);
 m.box(.8,-.96,1.7*growth,.35,.03,.16,DETAIL.accent);
}

export function roofPlant(m,growth=1){
 if(growth<=0)return;
 m.box(0,0,0,2.6,2.1,.13,DETAIL.plinth);m.box(0,0,.13,2.2,1.7,1.85*growth,DETAIL.wall);
 m.box(0,0,.13+1.85*growth,2.4,1.9,.16,DETAIL.roof);m.cylinder(.65,.35,.3,.16,2.65*growth,DETAIL.metal,8);m.cylinder(.65,.35,2.8*growth,.24,.12,DETAIL.roof,8);
 for(let z=.45;z<1.45;z+=.22)m.box(-.42,-.88,z,.9,.03,.07,DETAIL.recess);
 m.box(.55,-.90,.5,.65,.07,1.10*growth,DETAIL.stone);m.box(.55,-.96,1.2,.35,.03,.12,DETAIL.glass);
 m.beam([-1.5,.55,.25],[-1.5,.55,1.7*growth],.12,DETAIL.metal,6);m.beam([-1.5,.55,1.7*growth],[-.9,.55,1.7*growth],.12,DETAIL.metal,6);
}

/** An authored open room showing household equipment, not a surveyed new home. */
export function householdHeating(m,growth=1){
 if(growth<=0)return;
 const z=value=>value*growth,pipe='#b39a6e',tube=(a,b,r=.055,color=pipe)=>m.beam(a.map((v,i)=>i===2?z(v):v),b.map((v,i)=>i===2?z(v):v),r*growth,color,8);
 // The centre stays open for the existing resident. Low cutaway walls expose
 // the radiator and pipes from either side of the shared inspection camera.
 m.quad([-1.8,-1.8,0],[1.8,-1.8,0],[1.8,1.8,0],[-1.8,1.8,0],DETAIL.paving);
 m.box(0,1.74,0,3.6,.12,z(.45),DETAIL.wall);m.box(-1.74,.3,0,.12,2.9,z(.65),DETAIL.wall);
 m.box(-.9,1.72,0,1.05,.12,z(2.05),DETAIL.wall);
 for(const x of [-1.74,1.74])m.box(x,1.74,0,.12,.12,z(2.65),DETAIL.frame);
 for(const x of [-1.1,1.1])m.box(x,-1.7,0,.12,.12,z(2.65),DETAIL.frame);
 m.box(0,-1.7,z(2.65),2.32,.12,z(.12),DETAIL.frame);
 // Compact boiler, front service door, display and flue.
 m.box(-.9,1.4,z(.08),.9,.52,z(1.55),DETAIL.metal);
 m.box(-.9,1.125,z(.16),.78,.03,z(1.38),DETAIL.stone);
 m.box(-.9,1.10,z(1.23),.27,.025,z(.13),DETAIL.recess);
 m.box(-.65,1.08,z(.9),.08,.06,z(.16),DETAIL.metal);
 tube([-.9,1.6,1.63],[-.9,1.6,2.7],.07,DETAIL.metal);
 m.cylinder(-.9,1.6,z(2.7),.105,.10*growth,DETAIL.roof,8);
 // Separate supply and return pipes join the boiler to the radiator headers.
 for(const [x,height,end] of [[-1.12,.18,.38],[-.68,.32,1.48]]){
  tube([x,1.10,.58],[x,1.10,height]);tube([x,1.10,height],[end,1.10,height]);
  tube([end,1.10,height],[end,1.4,height]);tube([end,1.4,height],[end,1.4,.39]);
 }
 for(const height of [.39,1.15])tube([.38,1.4,height],[1.48,1.4,height],.06,DETAIL.metal);
 for(let i=0;i<7;i++)tube([.38+i*1.1/6,1.4,.39],[.38+i*1.1/6,1.4,1.15],.055,DETAIL.stone);
 const valve=[-1.12,1.035,z(.38)],radius=.14*growth;
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2;m.tri(valve,[valve[0]+Math.cos(a)*radius,valve[1],valve[2]+Math.sin(a)*radius],[valve[0]+Math.cos(b)*radius,valve[1],valve[2]+Math.sin(b)*radius],DETAIL.accent);}
 m.box(valve[0],valve[1]-.015,z(.36),.20*growth,.03,z(.04),DETAIL.metal);
}

export function heatingTerminal(m,growth=1){
 if(growth<=0)return;
 m.cylinder(0,0,0,.14,.85*growth,DETAIL.metal,8);
 m.cylinder(0,0,.85*growth,.23,.12*growth,DETAIL.roof,8);
}
