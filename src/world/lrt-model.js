import {Mesh} from './mesh-kit.js';
import {cross,normalize} from './city-math.js';
// Metre-scale interpretation of the Astana CRRC train and silver station shell.
// These components are shared by the real city line and the M3 scenario works.
const C={body:'#29a9cf',teal:'#51cbd2',deep:'#203f55',glass:'#214d61',frame:'#c6dfdf',roof:'#587078',concrete:'#c5bda8',edge:'#e4dac2',dark:'#455b65',gold:'#efd25e'};
function material(m,kind,fn){const before=m.kind;m.kind=kind;fn();m.kind=before;}
function component(m,p,angle,fn){const o=m.origin,a=m.angle,s=m.scale;m.at(m.point(p),a+angle,s);fn();m.at(o,a,s);}
function path(m,points,r,color,sides=5){for(let i=1;i<points.length;i++)m.beam(points[i-1],points[i],r,color,sides);}
function roofSeam(m,p,q,r,s){
 const normal=normalize(cross(q.map((v,i)=>v-p[i]),r.map((v,i)=>v-p[i]))),across=normalize(cross(normal,normalize(r.map((v,i)=>v-p[i]))));
 // A seam follows this planar shell panel. Clip its band at the panel edges;
 // round beams centred in the shell exposed subpixel faces with strong ink.
 let polygon=[p,q,r,s];
 for(const side of [-1,1]){
  const input=polygon;polygon=[];
  const distance=a=>.07-side*a.reduce((sum,v,i)=>sum+(v-p[i])*across[i],0);
  for(let i=0;i<input.length;i++){
   const a=input[i],b=input[(i+1)%input.length],d=distance(a),e=distance(b);
   if(d>=0)polygon.push(a);
   if(d*e<0)polygon.push(a.map((v,j)=>v+(b[j]-v)*d/(d-e)));
  }
 }
 polygon=polygon.map(a=>a.map((v,i)=>v+normal[i]*.025));
 const normals=[normal,normal,normal];
 for(let i=1;i<polygon.length-1;i++)m.tri(polygon[0],polygon[i],polygon[i+1],'#9eb6b9',normals);
}

export function lrtCar(m,{cab=false,flip=false,length=14.7}={}){
 if(flip){component(m,[0,0,0],Math.PI,()=>lrtCar(m,{cab,length}));return;}
 const half=length/2,sections=cab?[[-half,1,0],[-half+1.1,1,0],[half-2.25,1,0],[half-1.25,.94,-.05],[half-.42,.72,-.18],[half,.45,-.34]]:[[-half,1,0],[half,1,0]];
 // Rounded shoulders, a low undercarriage, and a tapered driver's cab.
 const cross=[[-1.22,.65],[-1.4,.95],[-1.4,2.83],[-1.22,3.2],[-.85,3.4],[.85,3.4],[1.22,3.2],[1.4,2.83],[1.4,.95],[1.22,.65]];
 for(let s=1;s<sections.length;s++)for(let j=0;j<cross.length;j++){
  const k=(j+1)%cross.length,p=(v,i)=>[v[0],cross[i][0]*v[1],cross[i][1]+v[2]],a=sections[s-1],b=sections[s];
  const color=j>=3&&j<=5?C.roof:j===9?C.dark:C.body;m.quad(p(a,j),p(b,j),p(b,k),p(a,k),color);
 }
 for(const end of [sections[0],sections.at(-1)])for(let j=1;j<cross.length-1;j++)m.tri([end[0],cross[0][0]*end[1],cross[0][1]+end[2]],[end[0],cross[j][0]*end[1],cross[j][1]+end[2]],[end[0],cross[j+1][0]*end[1],cross[j+1][1]+end[2]],cab&&end===sections.at(-1)?C.teal:C.body);
 const stop=cab?half-2.1:half-.3;
 for(const side of [-1,1]){
  const y=side*1.412;
  m.box((stop-half+.3)/2,y,1.33,stop+half-.3,.035,1.48,C.deep);
  for(let x=-half+1.3;x<stop-.8;x+=2.65){material(m,23,()=>m.box(x,y+side*.02,1.52,1.72,.025,1.08,C.glass));m.box(x,y+side*.045,2.60,1.72,.015,.035,'#8dc7ca');}
  // Twin leaves, visible gaskets and a slender gold lower stripe.
  for(const x of [-half+3,half-4.6]){m.box(x,y+side*.055,.84,1.4,.05,2.15,C.body);for(const dx of [-.35,.35])material(m,23,()=>m.box(x+dx,y+side*.09,1.65,.47,.023,1.05,C.glass));m.box(x,y+side*.09,.92,.045,.03,2.01,C.dark);}
  m.box((stop-half+.3)/2,y+side*.1,.97,stop+half-.3,.045,.14,C.teal);
  for(const x of [-half+1.2,-.7,half-3.5]){const yy=y+side*.12,zz=1.09,r=.27;path(m,[[x,yy,zz-r],[x+r,yy,zz],[x,yy,zz+r],[x-r,yy,zz],[x,yy,zz-r]],.045,C.gold,4);}
  for(const x of [-half+3.2,2.8]){const yy=y+side*.115;m.quad([x-.6,yy,1.32],[x+.4,yy,.67],[x+.7,yy,.67],[x-.3,yy,1.32],'#237bb4');}
  m.box((stop-half+.3)/2,y+side*.07,2.92,stop+half-.3,.04,.15,C.teal);
 }
 if(cab){
  // The black wrap-around face sits in a turquoise mask with pale cheek lines.
  for(const side of [-1,1]){
   material(m,23,()=>m.quad([half-2.05,side*1.40,1.42],[half-.25,side*.73,1.4],[half-.64,side*.91,2.72],[half-2.05,side*1.35,2.88],C.deep));
   m.beam([half-2.05,side*1.42,1.30],[half-.16,side*.70,1.23],.065,C.teal,5);
   m.beam([half-.10,side*.56,1.12],[half-.36,side*.95,1.10],.10,'#e5eee2',6);
   material(m,25,()=>m.beam([half-.04,side*.50,1.14],[half-.23,side*.81,1.12],.035,'#fff3c4',6));
  }
  material(m,23,()=>m.quad([half+.012,-.61,1.23],[half+.012,.61,1.23],[half-.62,1.00,2.68],[half-.62,-1.00,2.68],C.deep));
  m.beam([half+.026,-.25,1.35],[half-.33,.35,2.24],.027,'#7e9898',4);
  m.box(half-.47,0,2.72,.10,1.03,.17,C.dark);material(m,25,()=>m.box(half-.409,0,2.76,.025,.56,.05,'#e4bb70'));
 }
 for(const x of [-half+2.1,half-3.5]){
  m.box(x,0,.34,2.8,2.3,.45,C.dark);
  for(const dx of [-.77,.77])for(const side of [-1,1])m.beam([x+dx,side*.96,.45],[x+dx,side*1.26,.45],.38,'#384f52',10);
 }
 // Roof equipment is low and quiet at map scale, fully dimensional close up.
 m.box(-1,0,3.38,4.5,1.6,.25,'#96aba8');for(let x=-3;x<1;x+=.38)m.box(x,0,3.64,.10,1.5,.035,'#6b8585');
}

export function lrtTrain(m,{cars=4}={}){
 for(let i=0;i<cars;i++){
  const x=(i-(cars-1)/2)*15.1;component(m,[x,0,0],0,()=>lrtCar(m,{cab:i===0||i===cars-1,flip:i===0}));
  if(i<cars-1){const a=x+7.55;m.box(a,0,.8,.6,2.35,2.3,C.dark);for(let j=-2;j<=2;j++)m.box(a+j*.10,0,.87,.04,2.43,2.2,'#748b88');}
 }
}

export function lrtPier(m,height=10){
 m.box(0,0,0,3.5,3.6,.6,C.concrete);
 const ring=(w,d,z)=>[[-w/2,-d/2,z],[w/2,-d/2,z],[w/2,d/2,z],[-w/2,d/2,z]],lo=ring(1.65,2.1,.6),hi=ring(2.8,6.5,height-.7);
 for(let i=0;i<4;i++)m.quad(lo[i],lo[(i+1)%4],hi[(i+1)%4],hi[i],C.concrete);
 m.box(0,0,height-.7,3.4,7.2,.7,C.edge);m.box(0,0,.6,1.7,2.2,.15,'#9b9e90');
}

export function lrtStation(m,{length=90,width=22,platformHeight=11}={}){
 const h=platformHeight,half=length/2,w=width/2,n=28,facets=18;
 const roof=(x,a)=>{const t=x/half;const edge=h+1.6+5.7*Math.pow(Math.abs(t),1.6);return [x,Math.sin(a)*(w+1.3),edge+9.2*Math.cos(a)];};
 m.box(0,0,0,length+6,width+5,.65,C.edge);
 // Level ground concourse and elevated platform deck, visible through portals.
 m.box(0,0,.65,length-7,width-2,1.1,C.concrete);m.box(0,0,h-1.5,length,width,1.15,C.concrete);
 for(const y of [-7.5,7.5]){m.box(0,y,h+.45,length-5,5.3,.45,C.edge);m.box(0,y-Math.sign(y)*2.45,h+.91,length-6,.24,.045,C.gold);}
 // The silver shell forms a continuous double-curved ribbon with diamond seams.
 for(let i=0;i<n;i++)for(let j=0;j<facets;j++){
  const x=-half+i/n*length,X=-half+(i+1)/n*length,a=-Math.PI/2+j/facets*Math.PI,b=-Math.PI/2+(j+1)/facets*Math.PI;
  const p=roof(x,a),q=roof(X,a),r=roof(X,b),s=roof(x,b),color=(i+j)%4===0?'#d9e2dd':(i+j)%4===1?'#cbd7d4':'#d2ddd7';
  m.tri(p,q,r,color);m.tri(p,r,s,color);
  if(j%2===0)roofSeam(m,p,q,r,s);
  if(j===0||j===facets-1)m.beam(j===0?p:s,j===0?q:r,.33,C.frame,6);
 }
 for(const x of [-half,half]){const points=Array.from({length:49},(_,i)=>roof(x,-Math.PI/2+i/48*Math.PI));path(m,points,.52,'#edf0df',7);}
 // Glass side walls follow the roof edge. Mullions and floor bands are geometry.
 for(const side of [-1,1]){
  const y=side*(w+.04);
  for(let i=0;i<n;i++){const x=-half+i/n*length,X=-half+(i+1)/n*length,top=roof(x,side*Math.PI/2)[2]-.4,Top=roof(X,side*Math.PI/2)[2]-.4;
   material(m,23,()=>m.quad([x,y,1.76],[X,y,1.76],[X,y,Top],[x,y,top],i%4===0?'#4b8f9d':'#3b7588'));
   m.beam([x,y+side*.09,1.7],[x,y+side*.09,top],.085,C.frame,4);
  }
  for(const z of [5.0,8.2,h+1.1])m.box(0,y+side*.13,z,length,.17,.14,C.frame);
  // The diagonal steel braces are the defining facade rhythm in the CTS photos.
  const bays=Math.round(length/12);for(let bay=0;bay<bays;bay++){
   const x=-half+bay/bays*length,X=-half+(bay+1)/bays*length,yy=y+side*.23,top=roof((x+X)/2,side*Math.PI/2)[2]-.7;
   m.beam([x,yy,1.8],[X,yy,top],.13,'#deebe4',5);
   m.beam([X,yy,1.8],[x,yy,top],.13,'#deebe4',5);
  }
  material(m,25,()=>m.box(0,y+side*.19,h+1.4,length-.8,.09,.055,'#e4e6c4'));

  // Recessed entrances and a white floating canopy along the concourse.
  for(const x of [-half+8,half-8]){m.box(x,y+side*.35,1.7,7,.5,4.3,C.deep);for(let k=-2;k<=2;k++)m.box(x+k*1.24,y+side*.63,1.8,.065,.065,4,C.frame);m.box(x,y+side*1.4,6.1,8.5,3.6,.22,C.frame);for(let step=0;step<4;step++)m.box(x,y+side*(2.8-step*.45),step*.4,9,.6,.4,C.edge);}
 }
 // The arched ends have a real opening for both tracks; the train never clips a wall.
 for(const side of [-1,1]){const x=side*half;for(const y of [-w+2.4,w-2.4]){m.box(x,y,1.8,.32,4.5,h+6,C.deep);for(let z=5;z<h+7;z+=3)m.box(x+side*.19,y,z,.10,4.5,.12,C.frame);}for(const y of [-5.1,5.1])m.box(x,y,h-.2,.7,.65,9,C.frame);m.box(x,0,h+7.8,.45,10.2,.4,C.frame);}
 for(const x of [-half+11,0,half-11])for(const y of [-w+2,w-2])m.cylinder(x,y,1.7,.45,h-1.7,C.concrete,10);
 // Slender station signs at both approaches, without invented brand lettering.
 for(const x of [-half-4,half+4]){m.box(x,-w-3,0,.3,.3,5,C.dark);m.box(x,-w-3,4.2,.24,3.6,1.3,C.teal);m.box(x+.14,-w-3,4.55,.03,2.3,.12,C.body);}
}

// Static station topology is reused during scenario animation. Only its transform
// and the proposal tint change; no roof/facade tessellation runs on each frame.
const stationTemplates=new Map();
export function cachedLrtStation(m,options={}){
 const key=JSON.stringify(options);let source=stationTemplates.get(key);
 if(!source){const model=new Mesh();lrtStation(model,options);source=model.pack();stationTemplates.set(key,source);}
 const required=m.bytes+source.byteLength;
 if(required>m.buffer.byteLength){const next=new ArrayBuffer(Math.max(required,m.buffer.byteLength*2));new Uint8Array(next).set(new Uint8Array(m.buffer,0,m.bytes));m.buffer=next;m.view=new DataView(next);}
 const input=new DataView(source),out=m.view,start=m.bytes,c=Math.cos(m.angle),s=Math.sin(m.angle),k=m.scale,o=m.origin,colors=new Map();
 new Uint8Array(m.buffer,start,source.byteLength).set(new Uint8Array(source));
 for(let at=0;at<source.byteLength;at+=20){const i=start+at,x=input.getFloat32(at,true),y=input.getFloat32(at+4,true),z=input.getFloat32(at+8,true),nx=input.getInt8(at+12),ny=input.getInt8(at+13);
  out.setFloat32(i,o[0]+(x*c-y*s)*k,true);out.setFloat32(i+4,o[1]+(x*s+y*c)*k,true);out.setFloat32(i+8,o[2]+z*k,true);out.setInt8(i+12,Math.max(-127,Math.min(127,Math.round(nx*c-ny*s))));out.setInt8(i+13,Math.max(-127,Math.min(127,Math.round(nx*s+ny*c))));
  const r=input.getUint8(at+15),g=input.getUint8(at+16),b=input.getUint8(at+17),color=(r<<16)|(g<<8)|b;let paint=colors.get(color);if(!paint){paint=m.tint([r,g,b]).map(n=>Math.max(0,Math.min(255,Math.round(n))));colors.set(color,paint);}out.setUint8(i+15,paint[0]);out.setUint8(i+16,paint[1]);out.setUint8(i+17,paint[2]);
 }m.bytes=required;
}
