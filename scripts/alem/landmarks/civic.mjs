import {Mesh, palette as P, TAU} from './kit.mjs';

/**
 * Original architectural studies, in metres. Front elevations face local -Y.
 * Forms follow the reference photographs; relief is deliberately legible at map
 * distance, with real openings, layered cornices, and restrained material color.
 * No source photographs or texture reproductions are included in these meshes.
 */
const C={...P,white:'#f7efdb',porcelain:'#e9e6dc',marble:'#e7dfcd',recess:'#8e918d',
  blue:'#298da9',blueLight:'#51b0c2',blueDark:'#27677f',bronze:'#917546'};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const add=(a,b)=>a.map((v,i)=>v+b[i]);

function edge(m,a,b,r=.16,color=C.cream){m.beam(a,b,r,color,5);}
function steps(m,x,y,w,d,h,n=6){for(let i=0;i<n;i++)m.box(x,y+i*d/n/2,i*h/n,w,d-i*d/n,h/n,C.stone);}
function trim(m,x,y,z,w,d,h=.5){m.box(x,y,z,w,d,h,C.edge);m.box(x,y,z+h,w+.45,d+.45,h*.5,C.cream);}
function dome(m,x,y,z,r,h,color=C.porcelain,{ribs=16,gold=false,kind=8,sides=40,rows=10}={}){
 const profile=Array.from({length:rows+1},(_,j)=>{const a=j/rows*Math.PI/2;return [r*Math.cos(a),z+h*Math.sin(a)];});
 m.material(gold?24:kind,()=>m.lathe(x,y,profile,color,sides));
 if(ribs)for(let i=0;i<ribs;i++){const a=i/ribs*TAU,ps=profile.map(([rr,zz])=>[x+(rr+.04)*Math.cos(a),y+(rr+.04)*Math.sin(a),zz+.04]);m.path(ps,r*.009,gold?C.goldLight:C.cream,4);}
 m.ring(x,y,z,r,.22,C.cream,sides,4);
}
function finial(m,x,y,z,h=4,{crescent=false}={}){
 m.material(24,()=>{m.lathe(x,y,[[.5,z],[.8,z+.3],[.44,z+.75],[.2,z+h*.64],[0,z+h]],C.gold,20);
  if(crescent){const r=h*.2,c=z+h*.78;const ps=Array.from({length:17},(_,i)=>{const a=(-.3+i/16*1.6)*Math.PI;return [x+Math.sin(a)*r,y,c+Math.cos(a)*r];});m.path(ps,r*.22,C.goldLight,6);}
 });
}
function column(m,x,y,z,r,h,{ornate=false,color=C.cream}={}){
 const pf=[[r*1.42,z],[r*1.42,z+.35],[r*1.18,z+.5],[r*1.16,z+.9],[r,z+1.15],[r*.83,z+h-1.4],[r*.95,z+h-1.1],[r*1.38,z+h-.5],[r*1.38,z+h]];
 m.lathe(x,y,pf,color,20,{smooth:true});m.box(x,y,z,3*r,3*r,.34,color);m.box(x,y,z+h-.23,3*r,3*r,.35,color);
 if(ornate)for(let i=0;i<8;i++){const a=i/8*TAU;m.ellipsoid(x+Math.cos(a)*r,y+Math.sin(a)*r,z+h-.9,r*.36,r*.36,.6,C.stone,6,4);}
}
// Flat front-facing window, framed in solid stone. x is horizontal; the visible
// side is -Y. A small physical reveal gives stable silhouettes and real shadows.
function window(m,x,y,z,w,h,{arched=false,frame=true,color=C.glassDark,pointed=false,kind=23,mullions=true}={}){
 const r=w/2,archH=pointed?w*.65:r,spring=h-(arched?archH:0);
 const top=t=>{const xx=Math.cos(t)*r,c=(archH*archH-r*r)/(2*r);return [x+xx,y,z+spring+(pointed?Math.sqrt(Math.max(0,(r+c)**2-(Math.abs(xx)+c)**2)):archH*Math.sin(t))];};
 m.material(kind,()=>{
  m.quad([x-r,y,z],[x+r,y,z],[x+r,y,z+spring],[x-r,y,z+spring],color);
  if(arched)for(let i=0;i<12;i++)m.tri([x,y,z+spring],top(i/12*Math.PI),top((i+1)/12*Math.PI),color);
 });
 if(frame){for(const s of [-1,1])m.box(x+s*(r+.15),y-.12,z,.3,.35,spring+.15,C.cream);m.box(x,y-.16,z-.17,w+.8,.65,.28,C.cream);
  if(arched){const ps=Array.from({length:13},(_,i)=>add(top(i/12*Math.PI),[0,-.15,0]));m.path(ps,.17,C.cream,4);}else m.box(x,y-.12,z+h-.12,w+.55,.35,.25,C.cream);
 }
 if(mullions){m.box(x,y-.05,z,.14,.16,spring,C.frame);m.box(x,y-.06,z+spring*.53,w,.14,.13,C.frame);}
}
function windowsOnSide(m,origin,angle,positions,z,w,h,opts={}){m.component(origin,angle,()=>{for(const x of positions)window(m,x,0,z,w,h,opts);});}
function roof(m,x,y,z,w,d,rise,color=C.stone){
 const p=[[x-w/2,y-d/2,z],[x+w/2,y-d/2,z],[x+w/2,y+d/2,z],[x-w/2,y+d/2,z]],a=[x,y-d*.23,z+rise],b=[x,y+d*.23,z+rise];
 m.tri(p[0],p[1],a,color);m.quad(p[1],p[2],b,a,color);m.tri(p[2],p[3],b,color);m.quad(p[3],p[0],a,b,color);
}
function pediment(m,x,y,z,w,d,h){
 m.box(x,y,z,w+.8,d,1,C.cream);const a=[x-w/2,y-d/2,z+1],b=[x+w/2,y-d/2,z+1],c=[x,y-d/2,z+h],a2=add(a,[0,d,0]),b2=add(b,[0,d,0]),c2=add(c,[0,d,0]);
 m.tri(a,b,c,C.stone);m.tri(b2,a2,c2,C.stone);m.quad(a,c,c2,a2,C.cream);m.quad(c,b,b2,c2,C.cream);edge(m,a,c,.45);edge(m,c,b,.45);edge(m,a,b,.4);
}
// A source-footprint calibration, including inverse-transpose normal correction.
// This keeps architectural metre dimensions explicit without using map exaggeration.
function calibrate(m,sx=1,sy=1,sz=1){
 const v=m.view;for(let at=0;at<m.bytes;at+=20){v.setFloat32(at,v.getFloat32(at,true)*sx,true);v.setFloat32(at+4,v.getFloat32(at+4,true)*sy,true);v.setFloat32(at+8,v.getFloat32(at+8,true)*sz,true);const n=[v.getInt8(at+12)/sx,v.getInt8(at+13)/sy,v.getInt8(at+14)/sz],len=Math.hypot(...n)||1;for(let k=0;k<3;k++)v.setInt8(at+12+k,Math.round(n[k]/len*127));}return m;
}
// An actual vaulted passage: masonry only occupies the area outside its opening.
function archBlock(m,x,y,z,w,d,h,r,spring,color=C.stone,archHeight=r){
 const pier=(w/2-r);for(const s of [-1,1])m.box(x+s*(r+pier/2),y,z,pier,d,h,color);
 const c=(archHeight**2-r*r)/(2*r),top=t=>{const xx=r*Math.cos(t);return [x+xx,z+spring+Math.sqrt(Math.max(0,(r+c)**2-(Math.abs(xx)+c)**2))];};
 const n=32;for(let i=0;i<n;i++){const p=top(i/n*Math.PI),q=top((i+1)/n*Math.PI);
  m.quad([q[0],y-d/2,q[1]],[p[0],y-d/2,p[1]],[p[0],y-d/2,z+h],[q[0],y-d/2,z+h],color);
  m.quad([p[0],y+d/2,p[1]],[q[0],y+d/2,q[1]],[q[0],y+d/2,z+h],[p[0],y+d/2,z+h],color);
  m.quad([p[0],y-d/2,p[1]],[p[0],y+d/2,p[1]],[q[0],y+d/2,q[1]],[q[0],y-d/2,q[1]],C.marble);
 }
}

export function palace(){
 const m=new Mesh(),base=62,z0=1.5,height=62;
 m.box(0,0,0,68,68,.7,C.edge);m.box(0,0,.7,65,65,.8,C.stone);
 const corners=[[-base/2,-base/2,z0],[base/2,-base/2,z0],[base/2,base/2,z0],[-base/2,base/2,z0]],peak=[0,0,z0+height],n=8;
 for(let s=0;s<4;s++){
  const a=corners[s],b=corners[(s+1)%4],normal=[(a[0]+b[0])/base,(a[1]+b[1])/base,.5],out=p=>add(p,normal.map(v=>v*.08));
  const pt=(i,j)=>add(mix(a,b,i/n),peak.map((v,k)=>(v-a[k])*j/n));
  for(let j=0;j<n;j++)for(let i=0;i<n-j;i++){
   const A=pt(i,j),B=pt(i+1,j),D=pt(i,j+1),glass=j>=5;
   const tint=glass?([C.glass,C.blue,C.glassLight,C.blueDark][(i+2*j+s)%4]):(['#b8c0b9','#ced2c7','#adb7b4','#c1c8c0'][(i+j+s)%4]);
   m.material(glass?23:8,()=>m.tri(A,B,D,tint));
   if(i<n-j-1){const E=pt(i+1,j+1);m.material(glass?23:8,()=>m.tri(B,E,D,glass?C.glassLight:['#c4cbbf','#b6c1bc','#cdd0c6'][(i+j)%3]));}
  }
  // Three true triangular lattice directions, a quiet metal seam on every panel.
  for(let j=0;j<n;j++)for(let i=0;i<n-j;i++){const A=out(pt(i,j)),B=out(pt(i+1,j)),D=out(pt(i,j+1));edge(m,A,B,.12,C.steel);edge(m,A,D,.12,C.steel);edge(m,B,D,.12,C.steel);}
  edge(m,a,peak,.24,C.frame);
 }
 // The low, broad entrance is set into the plinth; it does not flatten the pyramid.
 m.box(0,-32.8,.8,12,4,2.7,C.shadow);m.material(23,()=>m.box(0,-34.84,1,10,.08,2.2,C.glassDark));
 for(const x of [-4,-2,0,2,4])m.box(x,-34.96,1,.13,.12,2.25,C.frame);
 m.box(0,-33,3.4,13,4.8,.25,C.stone);steps(m,0,-37,16,5,.85,4);
 return m;
}

export function akorda(){
 const m=new Mesh();
 // Five storeys, broad symmetrical wings, deep ceremonial portico, blue dome.
 m.box(0,0,0,118,92,1.8,C.edge);m.box(0,0,1.8,114,88,5,C.stone);
 m.box(0,0,6.8,108,82,29,C.white);
 for(const s of [-1,1]){m.box(s*45,0,6.8,25,84,29,C.white);m.box(s*46,0,35.8,27,85,.9,C.cream);m.box(s*46,0,36.7,28,85,.4,C.marble);}
 m.box(0,2,35.8,56,64,7.2,C.white);trim(m,0,2,42.4,59,67,.6);m.box(0,4,43.4,58,60,.6,C.marble);
 for(const s of [-1,1]){for(let y=-38;y<=38;y+=3)m.box(s*58,y,37.1,.55,.65,2,C.cream);m.box(s*58,0,39,1,80,.35,C.cream);for(let x=34;x<=55;x+=3)m.box(s*x,-43,37.1,.65,.55,2,C.cream);m.box(s*44.5,-43,39,24,1,.35,C.cream);}
 for(const z of [7,17.5,28.6,35.7])trim(m,0,0,z,116,90,z===35.7?.6:.32);
 const xs=Array.from({length:13},(_,i)=>-48+i*8);
 for(const z of [9,20,30]){
  windowsOnSide(m,[0,-45.05,0],0,xs,z,3.4,z===30?4.2:6.3);
  windowsOnSide(m,[0,45.05,0],Math.PI,xs,z,3.4,z===30?4.2:6.3);
  for(const s of [-1,1])windowsOnSide(m,[s*58.05,0,0],s*Math.PI/2,[-32,-24,-16,-8,0,8,16,24,32],z,3.2,z===30?4.2:6.3);
 }
 for(const x of [-54,-46,-38,38,46,54]){m.box(x,-45.38,8.5,.65,.65,20,C.cream);m.box(x,-45.38,28.2,1.35,.8,.65,C.stone);}
 // The front central wall sits behind a curved line of eight freestanding columns.
 m.box(0,-44,7,47,6,28,C.white);
 for(const x of [-18,-12,-6,0,6,12,18])window(m,x,-47.06,11,3.8,17,{color:C.glass});
 for(const x of [-25,-18,-11,-4,4,11,18,25]){const y=-48-4*(1-(x/28)**2);column(m,x,y,7,1.25,25,{ornate:true});}
 // A semicircular two-storey drum projects above the colonnade, the defining
 // detail of Ak Orda's front elevation (it is not a temple pediment).
 for(let i=0;i<32;i++){const a=Math.PI+i/32*Math.PI,b=Math.PI+(i+1)/32*Math.PI,pt=(t,z,r=28)=>[Math.cos(t)*r,-28+Math.sin(t)*r,z];
  m.quad(pt(a,32),pt(b,32),pt(b,43),pt(a,43),C.white);
  for(const z of [32,37,42.8])m.quad(pt(a,z,28.45),pt(b,z,28.45),pt(b,z+.55,28.45),pt(a,z+.55,28.45),C.cream);
  m.tri([0,-28,43],pt(a,43),pt(b,43),C.cream);
 }
 for(let i=0;i<13;i++){const a=Math.PI+.13+(Math.PI-.26)*i/12;m.component([Math.cos(a)*28.06,-28+Math.sin(a)*28.06,0],a+Math.PI/2,()=>{window(m,0,0,33.4,2.7,2.8,{color:C.glass});window(m,0,0,38.7,2.7,2.8,{color:C.glass});});}
 steps(m,0,-56,60,15,7,14);
 m.material(24,()=>{m.box(0,-47.25,8,6,.3,9,C.gold);m.box(0,-47.44,8,.24,.13,9,C.bronze);});
 // Source footprint calibration applies to the rectilinear body; the circular
 // dome is authored afterward so it keeps an honest circular ground section.
 calibrate(m,.89,.615,1);
 const domeY=-4.92,domeR=16.38;
 m.lathe(0,domeY,[[17.4,43],[17.4,44],[15.84,44.8],[15.84,49],[16.82,49.4],[16.82,50.5]],C.cream,48);
 for(let i=0;i<20;i++){const a=i/20*TAU;m.component([Math.cos(a)*15.9,domeY+Math.sin(a)*15.9,0],a+Math.PI/2,()=>window(m,0,0,45.1,1.8,3.4,{color:C.glass}));}
 dome(m,0,domeY,50.5,domeR,20,C.blue,{ribs:0,kind:23,sides:64,rows:16});
 m.material(24,()=>{
  const n=16;for(let i=0;i<n;i++){const a=i/n*TAU,ps=Array.from({length:15},(_,j)=>{const t=j/14*Math.PI/2;return [(domeR+.07)*Math.cos(t)*Math.cos(a),domeY+(domeR+.07)*Math.cos(t)*Math.sin(a),50.5+20.05*Math.sin(t)];});m.path(ps,.14,C.goldLight,4);}
  m.ring(0,domeY,51,domeR,.3,C.gold,48,5);
  m.lathe(0,domeY,[[1.2,70],[1.4,71],[1.1,73],[.45,74],[.29,82],[0,86]],C.gold,24);
  m.ellipsoid(0,domeY,85.4,.65,.65,.65,C.goldLight,16,8);
 });
 for(const x of [-28,28]){m.cylinder(x,-37,0,.16,22,C.steel,8);m.material(23,()=>m.quad([x,-37,20],[x+4,-36.7,19.6],[x+4,-36.7,16.8],[x,-37,17],C.blueLight));}
 return m;
}

function minaret(m,x,y){
 // 77 m minarets: tapered octagonal base, slender fluted shaft, two balconies.
 m.box(x,y,1.8,9.6,9.6,3,C.stone);
 m.lathe(x,y,[[5,4.8],[4.6,5.5],[4.3,11],[3.4,14],[3.25,43],[3.1,45],[3.1,62],[2.4,64],[2.4,68]],C.white,24);
 for(const z of [23,43,61]){m.lathe(x,y,[[3.2,z],[3.5,z+.35],[3.7,z+.7],[3.9,z+1.05],[4.15,z+1.4],[4.3,z+1.75],[4.3,z+2.2],[3.5,z+2.4]],C.cream,20);m.ring(x,y,z+2.55,4.05,.22,C.cream,24,4);for(let i=0;i<12;i++){const a=i/12*TAU;m.beam([x+Math.cos(a)*4,y+Math.sin(a)*4,z+1.8],[x+Math.cos(a)*4,y+Math.sin(a)*4,z+2.55],.11,C.cream,4);}}
 for(let i=0;i<8;i++){const a=i/8*TAU;m.component([x+Math.cos(a)*3.25,y+Math.sin(a)*3.25,0],a+Math.PI/2,()=>{window(m,0,0,30,.8,8,{arched:true,frame:false});window(m,0,0,52,.7,5,{arched:true,frame:false});});}
 m.lathe(x,y,[[2.45,68],[2.8,69],[2.9,70],[2.5,71],[1.5,72.1],[.35,73.3],[.2,74]],C.porcelain,24);finial(m,x,y,74,3,{crescent:true});
}
function mosqueDome(m,x,y,z,r,h){
 const major=r>12,sides=major?48:28,rows=major?12:8;
 m.lathe(x,y,[[r*.94,z],[r,z+.6],[r*.96,z+1.5],[r*.96,z+4.8]],C.cream,sides);
 const windows=major?20:10;for(let i=0;i<windows;i++){const a=i/windows*TAU;m.component([x+Math.cos(a)*r*.965,y+Math.sin(a)*r*.965,0],a+Math.PI/2,()=>window(m,0,0,z+1.2,r*.16,2.7,{arched:true,frame:false,color:C.glass}));}
 dome(m,x,y,z+4.8,r,h,C.porcelain,{ribs:0,sides,rows});
 // Fine crossing gold-grey ribs reproduce the recognisable diamond net on the
 // ivory domes. The seams follow the curved surface, never float above it.
 const ribs=major?20:12;
 for(const direction of [-1,1])for(let i=0;i<ribs;i++){const ps=Array.from({length:rows+1},(_,j)=>{const t=j/rows*Math.PI/2,a=i/ribs*TAU+direction*t*.8,rr=(r+.035)*Math.cos(t);return [x+rr*Math.cos(a),y+rr*Math.sin(a),z+4.8+(h+.04)*Math.sin(t)];});m.path(ps,major?.072:.055,C.edge,3);}
 finial(m,x,y,z+4.8+h,2.2,{crescent:true});
}
export function hazret(){
 const m=new Mesh();
 m.box(0,0,0,141,83,1.8,C.edge);
 // The mapped 141 m extent includes a lower annex on the left. The principal
 // four-minaret mosque occupies the eastern 78 m of the site, with its dome
 // offset +24 m from the compound centre, matching the source footprint.
 m.component([24,0,0],0,()=>{
  m.box(0,0,1.8,82,77,5,C.stone);m.box(0,1,6.8,74,65,15.3,C.white);
  m.box(0,1,22,65,54,5,C.white);trim(m,0,1,26.6,67,56,.5);trim(m,0,1,21.7,77,68,.5);
  for(const x of [-23,23])for(const y of [-20,23])mosqueDome(m,x,y,22.5,7.2,7.2);
  for(const [x,y] of [[0,-24],[0,26],[-25,1],[25,1]])mosqueDome(m,x,y,25,5.5,5.7);
  mosqueDome(m,0,1,28,15.5,16.5);
  for(const x of [-35.5,35.5])for(const y of [-31,31])minaret(m,x,y);
  // Tall pointed portal, inset ornamental spandrels and glazed entry doors.
  m.box(0,-35,6.8,24,13,25,C.cream);m.box(0,-41.57,9.5,21,.25,19,C.blueDark);
  for(const x of [-11.25,11.25])m.box(x,-41.8,8,.8,.65,24,C.stone);
  for(const z of [8.2,29.5])m.box(0,-41.8,z,24,.65,1,C.stone);
  for(const x of [-6,0,6])window(m,x,-41.85,8.5,4.9,18,{arched:true,pointed:true,frame:true,color:C.marble,kind:8,mullions:false});
  for(const x of [-6,0,6])window(m,x,-42.05,8.5,3.1,5,{arched:true,pointed:true,color:C.glassDark});
  for(const sx of [-1,1])for(let j=0;j<11;j++){const x=sx*10.15,z=10+j*1.65,r=.26;m.quad([x,-42,z+r],[x+r,-42,z],[x,-42,z-r],[x-r,-42,z],j%2?C.goldLight:C.cream);}
  for(let x=-10;x<=10;x+=2.5){const z=30.1;m.quad([x,-42,z+.34],[x+.34,-42,z],[x,-42,z-.34],[x-.34,-42,z],C.blue);}
  for(const x of [-29,-23,-17,17,23,29]){
   window(m,x,-31.58,8.6,4.8,12.5,{arched:true,pointed:true,color:C.marble,kind:8,mullions:false});
   m.ellipsoid(x,-31.8,18.15,1,.14,1,C.edge,10,6);
   window(m,x,-31.98,9,1.55,6.6,{arched:true,pointed:true,color:C.glass});
  }
  for(const s of [-1,1])windowsOnSide(m,[s*37.06,1,0],s*Math.PI/2,[-24,-16,-8,0,8,16,24],9,3.6,10.8,{arched:true,pointed:true});
  windowsOnSide(m,[0,33.56,0],Math.PI,[-27,-18,-9,0,9,18,27],9,4.4,11,{arched:true,pointed:true});
  for(let x=-30;x<=30;x+=5)m.box(x,34,21.8,.8,1,1.4,C.cream);
  steps(m,0,-44.5,65,13,6.8,12);
 });
 // Low annex with a tenth, smaller dome and its separate end portal.
 m.box(-40,1,1.8,47,64,3.5,C.stone);m.box(-40,1,5.3,47,62,13.5,C.white);trim(m,-40,1,18.3,49,64,.6);
 m.box(-40,1,19,30,36,2,C.cream);mosqueDome(m,-40,1,21,8,7);
 for(const y of [-1,1])windowsOnSide(m,[-40,y<0?-30.08:32.08,0],y<0?0:Math.PI,[-18,-9,0,9,18],7,5,10.5,{arched:true,pointed:true});
 m.component([-65,1,0],-Math.PI/2,()=>{m.box(0,0,5.3,21,9,21,C.cream);window(m,0,-4.56,7.2,12,16.5,{arched:true,pointed:true,color:C.glassDark});trim(m,0,0,26,23,11,.6);});
 return m;
}

function horse(m,x,y,z,scale=1){
 // A compact original sculptural silhouette, including four separate legs,
 // arched neck, head, and tail. The roof quadriga reads beyond an anonymous lump.
 m.component([x,y,z],0,()=>{const s=scale;m.ellipsoid(0,0,1.8*s,.52*s,1.15*s,.58*s,C.bronze,10,6);m.beam([0,-.68*s,1.8*s],[0,-1.05*s,3.05*s],.3*s,C.bronze,8);m.ellipsoid(0,-1.25*s,3.03*s,.28*s,.63*s,.33*s,C.bronze,8,5);for(const xx of [-.32,.32])for(const yy of [-.68,.68])m.beam([xx*s,yy*s,1.55*s],[xx*s,(yy+.15)*s,0],.12*s,C.bronze,5);m.path([[0,.85*s,2*s],[0,1.6*s,1.7*s],[0,1.65*s,.7*s]],.11*s,C.bronze,5);});
}
function copperCap(m,x,y,z,w,d,h){
 const shoulder=Math.min(h,w*.2),profile=[];
 for(let i=0;i<=8;i++){const a=Math.PI-i/8*Math.PI/2;profile.push([x-w/2+shoulder+Math.cos(a)*shoulder,z+Math.sin(a)*h]);}
 profile.push([x+w/2-shoulder,z+h]);
 for(let i=1;i<=8;i++){const a=Math.PI/2-i/8*Math.PI/2;profile.push([x+w/2-shoulder+Math.cos(a)*shoulder,z+Math.sin(a)*h]);}
 for(let i=0;i<profile.length-1;i++){const [ax,az]=profile[i],[bx,bz]=profile[i+1];m.quad([ax,y-d/2,az],[bx,y-d/2,bz],[bx,y+d/2,bz],[ax,y+d/2,az],i%3===0?'#987361':'#8b6655');}
 for(const s of [-1,1])for(let i=0;i<profile.length-1;i++){const [ax,az]=profile[i],[bx,bz]=profile[i+1];if(s<0)m.quad([ax,y+s*d/2,z],[bx,y+s*d/2,z],[bx,y+s*d/2,bz],[ax,y+s*d/2,az],'#977260');else m.quad([bx,y+s*d/2,z],[ax,y+s*d/2,z],[ax,y+s*d/2,az],[bx,y+s*d/2,bz],'#977260');}
 for(let yy=y-d/2;yy<=y+d/2;yy+=2)m.path(profile.map(([xx,zz])=>[xx,yy,zz+.035]),.045,'#bb9478',3);
 for(const s of [-1,1])for(const xx of [-w*.33,-w*.11,w*.11,w*.33]){
  m.ellipsoid(x+xx,y+s*(d/2+.02),z+h*.47,1.55,.18,1.65,C.glassDark,12,8);
  const ps=Array.from({length:25},(_,i)=>[x+xx+Math.cos(i/24*TAU)*1.7,y+s*(d/2+.08),z+h*.47+Math.sin(i/24*TAU)*1.8]);m.path(ps,.17,'#674d3c',5);
 }
}
export function opera(){
 const m=new Mesh(),w=90,d=139;
 m.box(0,0,0,w+9,d+8,2.1,C.edge);m.box(0,0,2.1,w+3,d+2,3.4,C.stone);m.box(0,0,5.5,w,d,25.5,C.white);
 trim(m,0,0,13,w+1,d+1,.36);trim(m,0,0,28.7,w+2,d+2,.6);trim(m,0,0,31,w+4,d+4,.7);
 // The front is a classical long gabled hall. Its rear fly tower has the copper
 // rounded cap and black oculi visible in the contractor's aerial photographs.
 m.quad([-45,-69.5,32.2],[0,-69.5,43],[0,26,43],[-45,26,32.2],'#657579');
 m.quad([0,-69.5,43],[45,-69.5,32.2],[45,26,32.2],[0,26,43],'#718084');
 roof(m,0,47,31.9,90,45,3.2,'#657579');
 m.box(0,36,32,65,44,12,C.white);trim(m,0,36,43.7,67,46,.7);copperCap(m,0,36,44.6,65,44,9.5);
 m.box(0,36,54.1,33,17,.8,C.cream);
 for(const s of [-1,1]){m.box(s*37,43,31.8,22,31,5,C.white);trim(m,s*37,43,36.5,24,33,.5);copperCap(m,s*37,43,37.5,23,32,4);}
 for(const s of [-1,1])for(let y=-59;y<=8;y+=13)m.box(s*7,y,40.9,5.4,3,1.1,'#526568');
 for(const s of [-1,1]){
  for(const z of [7,18])windowsOnSide(m,[s*45.06,0,0],s*Math.PI/2,Array.from({length:13},(_,i)=>-60+i*10),z,4.6,z===7?8.3:8.8,{color:C.glassDark});
  for(let y=-62;y<=62;y+=10)m.box(s*45.4,y,6.2,.9,1.3,22,C.cream);
  for(const y of [-60,-50,-40,-30,-20,-10])column(m,s*49,y,5.6,1.3,22.5,{ornate:true});
  m.box(s*47.4,-35,28.2,7,65,3.9,C.cream);trim(m,s*47.4,-35,32.1,8,66,.4);
 }
 for(const y of [-1,1])windowsOnSide(m,[0,y*69.56,0],y===1?Math.PI:0,[-41,41],8,4.6,16,{color:C.glassDark});
 // Eight Corinthian columns; white entablature and a deep shadow behind them.
 m.box(0,-69.8,5.5,72,1.1,22.9,C.shadow);
 for(const x of [-29,-20,-11,0,11,20,29]){window(m,x,-70.45,7,4.8,16,{color:C.glassDark});m.material(24,()=>m.box(x,-70.65,7,3.5,.18,7,C.gold));}
 for(const x of [-34,-24.3,-14.6,-4.9,4.9,14.6,24.3,34])column(m,x,-80.5,5.6,1.45,22.5,{ornate:true});
 m.box(0,-77.5,28.2,77,12,3.9,C.cream);m.box(0,-83.62,29.2,72,.16,1.4,C.stone);
 for(let x=-35;x<=35;x+=2.65)m.box(x,-83.9,31.55,.64,.72,.75,C.cream);
 pediment(m,0,-77.5,32.4,78,13,11);
 // Pediment relief uses a shallow wreath and radiating foliate figures.
 m.material(24,()=>{for(let i=0;i<24;i++){const a=i/24*TAU;const x=Math.cos(a)*3.1,z=36.9+Math.sin(a)*2.1;m.ellipsoid(x,-84.15,z,.65,.24,.44,C.goldLight,6,4);}});
 for(const s of [-1,1])for(let i=0;i<5;i++){const x=s*(6+i*4.6),z=35.2+(4-i)*.64;m.ellipsoid(x,-84.13,z,1.6,.28,.7,C.stone,8,4);edge(m,[x,-84.2,z],[x-s*3,-84.2,z+.8],.2,C.cream);}
 steps(m,0,-85,83,18,5.6,12);
 // Roof sculpture group: quadriga, chariot and central driver.
 m.box(0,-76.5,43.5,12,7,.8,C.bronze);
 for(const x of [-4.1,-1.35,1.35,4.1])horse(m,x,-78,44.3,1.28);
 m.material(24,()=>{m.box(0,-72.8,44.3,3.3,2.2,2,C.bronze);m.ellipsoid(0,-72.8,48.05,.68,.52,1.2,C.bronze,10,6);m.ellipsoid(0,-72.8,49.4,.43,.43,.48,C.bronze,10,6);m.beam([-.5,-73,48.4],[-2,-75,48.6],.16,C.bronze,5);m.beam([.5,-73,48.4],[2,-75,48.6],.16,C.bronze,5);});
 return m;
}

function reliefFigure(m,x,y,z){
 const bronze='#4e574d';
 m.ellipsoid(x,y,z+4.8,.46,.32,.56,bronze,10,6);m.ellipsoid(x,y,z+3,.78,.42,1.2,bronze,10,6);
 for(const s of [-1,1]){m.beam([x+s*.31,y,z+2.5],[x+s*.34,y-.04,z+.3],.28,bronze,6);m.beam([x+s*.64,y,z+3.5],[x+s*.86,y-.12,z+2],.22,bronze,6);}
 m.box(x,y,z,1.5,1,.3,bronze);m.lathe(x,y,[[.47,z+5.05],[.34,z+5.65],[0,z+6.1]],bronze,10);
}
export function arch(){
 const m=new Mesh(),w=18.7,d=14.9;
 for(const s of [-1,1]){m.box(s*6.91,0,0,5.7,16.4,.55,C.edge);m.box(s*6.91,0,.55,5.3,15.6,.65,C.cream);}
 archBlock(m,0,0,1.2,w,d,18.2,4.4,9.3,C.stone,5.2);
 // Bas-relief niches and statues are modeled on both of the public elevations.
 for(const face of [-1,1])m.component([0,face*(d/2+.04),0],face===1?Math.PI:0,()=>{
  for(const x of [-6.87,6.87]){
   m.box(x,-.02,2.3,3.4,.18,11.8,C.edge);m.box(x,-.13,2.7,3,.2,10.8,C.marble);
   window(m,x,-.25,3.7,2.9,6.9,{arched:true,pointed:true,color:C.shadow,kind:8,mullions:false});
   m.box(x,-.28,3.1,2.8,.5,.6,C.stone);m.material(24,()=>reliefFigure(m,x,-.65,3.7));
   for(const xx of [-1.75,1.75])m.box(x+xx,-.18,1.8,.4,.38,14.6,C.cream);
   m.box(x,-.28,13.7,3.8,.55,.45,C.cream);
   m.material(24,()=>{m.ellipsoid(x,-.34,12.4,1.06,.23,1.06,'#4e574d',16,8);for(let i=0;i<16;i++){const a=i/16*TAU;m.beam([x+Math.cos(a)*.42,-.6,12.4+Math.sin(a)*.42],[x+Math.cos(a)*.96,-.6,12.4+Math.sin(a)*.96],.045,C.bronze,3);}});
  }
  const r=4.57,spring=10.5,top=(t,dr=0)=>{const xx=(r+dr)*Math.cos(t),h=5.2+dr,c=(h*h-(r+dr)**2)/(2*(r+dr));return [xx,-.25,spring+Math.sqrt(Math.max(0,(r+dr+c)**2-(Math.abs(xx)+c)**2))];};
  for(const dr of [0,.4])m.path(Array.from({length:33},(_,i)=>top(i/32*Math.PI,dr)),.13,C.cream,5);
  for(let i=0;i<17;i++)m.beam(top(i/16*Math.PI),top(i/16*Math.PI,.47),.045,C.edge,4);
  // Gold lettering is abstracted as an incised frieze rhythm, never gibberish.
  m.box(0,-.19,17.75,14,.25,.55,C.edge);for(let i=0;i<19;i++)m.box(-6.5+i*.72,-.35,17.86,.28,.13,.28,C.gold);
 });
 trim(m,0,0,16.8,w+.4,d+.4,.45);trim(m,0,0,18.65,w+.75,d+.75,.5);
 m.box(0,0,19.4,w+.35,d+.35,.6,C.cream);
 // Curved central crown and recessed rooftop terrace, visible from city orbit.
 for(const y of [-7.6,7.6]){
  for(let i=0;i<32;i++){const x1=-9.5+i*19/32,x2=-9.5+(i+1)*19/32,h=x=>20.05+(Math.abs(x)<3.5?1.05*Math.cos(x/3.5*Math.PI/2):0);m.quad([x1,y,19.8],[x2,y,19.8],[x2,y,h(x2)],[x1,y,h(x1)],C.stone);m.beam([x1,y,h(x1)],[x2,y,h(x2)],.16,C.cream,5);}
 }
 for(const s of [-1,1])m.box(s*9.45,0,20,.3,15.2,.5,C.stone);
 m.material(23,()=>{m.box(0,0,20,6.5,9.2,.25,C.glass);});
 for(let x=-3;x<=3;x+=1)m.box(x,0,20.27,.06,9.2,.08,C.frame);
 return m;
}

export function concert(){
 const m=new Mesh();
 m.box(0,0,0,123,112,1.4,C.edge);m.box(0,0,1.4,119,108,1.4,C.stone);
 // The concert hall is a closed, folded envelope. Each blue petal joins the
 // auditorium roof and exposes a glazed cut face beside its neighbour; the
 // highest blade rises at the main entrance, rather than at the back of a bowl.
 const core=[0,10,29];
 m.box(0,10,2.8,56,60,24,C.glassDark);
 const shells=[
  {cx:-5,cy:4,rx:48,ry:43,a:-4.15,b:-1.96,low:21,high:57,lean:-10},
  {cx:10,cy:3,rx:48,ry:45,a:-1.1,b:1.45,low:39,high:27,lean:-12},
  {cx:6,cy:-6,rx:58,ry:42,a:-1.25,b:.65,low:29,high:16,lean:-17},
  {cx:-20,cy:-10,rx:33,ry:29,a:-3.35,b:-1.95,low:14,high:29,lean:-10},
 ];
 const ends=[];
 for(let s=0;s<shells.length;s++){
  const q=shells[s],cols=36,rows=24;
  const height=u=>q.low+(q.high-q.low)*u;
  const pt=(u,z)=>{const a=q.a+(q.b-q.a)*u,v=z/height(u),lean=q.lean*v;return [q.cx+(q.rx+lean)*Math.cos(a),q.cy+(q.ry+lean)*Math.sin(a),2.8+z];};
  const colors=['#388da8','#449bb0','#348da6','#4ba4b5'];
  m.material(23,()=>{
   for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
    const u=i/cols,v=(i+1)/cols,z=j/rows*60,z2=(j+1)/rows*60;
    if(z>=height(u)&&z>=height(v))continue;
    const a=pt(u,Math.min(z,height(u))),b=pt(v,Math.min(z,height(v))),c=pt(v,Math.min(z2,height(v))),d=pt(u,Math.min(z2,height(u)));
    m.quad(a,b,c,d,colors[s]);
   }
  });
  // Shallow horizontal courses are the building's signature close-up detail.
  for(let z=2;z<60;z+=1.65)for(let i=0;i<cols;i++){
   const u=i/cols,v=(i+1)/cols;if(z+.06>=Math.min(height(u),height(v)))continue;
   m.quad(pt(u,z),pt(v,z),pt(v,z+.07),pt(u,z+.07),'#8cbfc8');
  }
  for(let i=0;i<=cols;i+=3){const u=i/cols;m.path(Array.from({length:9},(_,j)=>pt(u,height(u)*j/8)),.042,'#317b91',3);}
  // Every petal is roofed into the common core, eliminating floating walls and
  // creating the broad sloping blue planes visible in oblique photographs.
  for(let i=0;i<cols;i++){
   const a=pt(i/cols,height(i/cols)),b=pt((i+1)/cols,height((i+1)/cols));
   m.material(23,()=>m.tri(a,b,core,s%2?'#418eaa':'#357f9e'));
   m.beam(a,b,.14,C.frame,4);
  }
  for(const u of [0,1]){
   const foot=pt(u,0),crown=pt(u,height(u));
   // The folded edge has true thickness. It is a narrow blue blade, not a tube.
   const inward=[(core[0]-foot[0])*.08,(core[1]-foot[1])*.08,0];
   m.quad(foot,crown,add(crown,inward),add(foot,inward),'#226b8b');
   m.material(23,()=>m.quad(add(foot,inward),add(crown,inward),core,[core[0],core[1],2.8],C.glassDark));
   m.beam(foot,crown,.16,'#6cabc0',4);
   ends.push({foot,crown});
  }
 }
 // Three glazed slots in the entry facade; the central one is the tall sloping
 // trapezoid between the spear-like blade and the large curved right-hand petal.
 const entrance=(x,y,width,topWidth,h)=>{
  const a=[x-width/2,y,2.8],b=[x+width/2,y,2.8],c=[x+topWidth/2,y+10,2.8+h],d=[x-topWidth/2,y+10,2.8+h];
  m.material(23,()=>m.quad(a,b,c,d,'#528fa1'));
  for(let j=0;j<=12;j++){const t=j/12;m.beam(mix(a,d,t),mix(b,c,t),.08,C.steel,4);}
  for(let i=0;i<=8;i++){const t=i/8;m.beam(mix(a,b,t),mix(d,c,t),.075,C.steel,4);}
  for(let i=0;i<7;i++){const xx=x-width*.42+i*width*.14;m.box(xx,y-.12,2.9,.12,.22,3.4,C.frame);}
 };
 entrance(-.5,-42,36,16,34);entrance(-40,-37,16,10,19);entrance(35,-34,17,10,17);
 m.box(0,-42.1,6.5,37,.3,.22,C.frame);m.box(0,-45,6.7,38,6,.35,C.frame);
 steps(m,0,-53,77,18,2.8,7);
 return calibrate(m,.87,1.5,.67);
}

export const CIVIC_MODEL_INFO=Object.freeze({
 palace:{front:'-Y',width:62,depth:62,height:63.5,notes:'62 m pyramid above a low stone plinth; upper three triangular courses are glazing.'},
 akorda:{front:'-Y',width:106.8,depth:67.4,height:86.05,notes:'Five-storey white residence, eight-column curved portico, round blue dome and gilded spire. Source-footprint body calibration preserves circular dome.'},
 hazret:{front:'-Y',width:141,depth:92.5,height:77.1,notes:'Main hall centred local X+24; parent annex centred X-40. Four minarets, nine main domes plus one annex dome; main finial reaches 51.5 m. Separate neighbouring annex way/1373017401 is not included.'},
 opera:{front:'-Y',width:104,depth:167.5,height:54.9,notes:'Eight-column Corinthian portico, long side colonnades, original quadriga sculpture, slate roof and copper fly tower with oculi.'},
 arch:{front:'-Y',width:19.9,depth:16.6,height:21.3,notes:'True pointed vaulted opening, paired front/rear bronze relief niches, curved crown and inset glazed rooftop.'},
 concert:{front:'-Y',width:111,depth:180,height:40.1,notes:'Four closed asymmetric curved blue petals, horizontal cladding courses, tall front blade and glazed sloping entrance slots. Source-ground footprint calibrated.'},
});
