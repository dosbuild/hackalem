// A single batched mesh vocabulary, sharing the base city's depth and lighting passes.
// Cache only the raw components of short string colours. Public rgb() still
// owns a fresh mutable array; array inputs retain their original identity.
const stringColors=new Map();
const parseStringColor=hex=>hex.replace('#','').match(/../g).map(s=>parseInt(s,16));
function stringColor(hex){
 const cached=stringColors.get(hex);if(cached)return cached;
 const color=parseStringColor(hex);if(hex.length<=64)remember(stringColors,hex,color,64);return color;
}
export const rgb=hex=>{
 if(typeof hex!=='string')return hex;
 return stringColor(hex).slice();
};
export const blend=(a,b,t)=>{
 const left=rgb(a);
 // Other inputs can run getters, custom map or coercion callbacks between
 // components; those keep the original per-component right-colour lookup.
 if(typeof a!=='string'||typeof b!=='string'||typeof t!=='number')return left.map((v,i)=>v*(1-t)+rgb(b)[i]*t);
 const right=stringColor(b);return left.map((v,i)=>v*(1-t)+right[i]*t);
};
export const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export const beat=(p,start,end)=>smooth((p-start)/(end-start));
// Immutable topology and exact-radius gradients are shared by residents/props.
// Large or continuously changing shapes are still generated exactly; only a
// bounded set is retained. Radii are never rounded or reduced to aspect ratios.
const spheres=new Map(),gradients=new Map(),paddingMask=new Uint32Array(Uint8Array.of(0,0,0,255).buffer)[0];
const boxFaces=[[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],boxTriangles=boxFaces.flatMap(([a,b,c,d])=>[[a,b,c],[a,c,d]]);
// Scratch is acquired after tri/tint callbacks finish. It is shared by boxes
// and ellipsoids only within this Mesh; large one-off shapes are not retained.
function packedScratch(mesh,bytes){
 if(bytes>10240){const buffer=new ArrayBuffer(bytes);return {view:new DataView(buffer),words:new Uint32Array(buffer)};}
 if(!mesh.scratch||mesh.scratch.words.byteLength<bytes){let capacity=128;while(capacity<bytes)capacity*=2;const buffer=new ArrayBuffer(Math.min(10240,capacity));mesh.scratch={view:new DataView(buffer),words:new Uint32Array(buffer)};}
 return mesh.scratch;
}
function packedTarget(mesh){if(mesh.words?.buffer!==mesh.buffer)mesh.words=new Uint32Array(mesh.buffer);return mesh.words;}
function remember(cache,key,value,limit){if(cache.size>=limit)cache.delete(cache.keys().next().value);cache.set(key,value);return value;}
function sphere(sides,rings){
 const key=`${sides}/${rings}`;if(spheres.has(key))return spheres.get(key);
 const points=[],triangles=[],stride=sides+1;
 for(let j=0;j<=rings;j++)for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2,b=-Math.PI/2+j/rings*Math.PI;points.push(Object.freeze([Math.cos(a)*Math.cos(b),Math.sin(a)*Math.cos(b),Math.sin(b)]));}
 for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=j*stride+i,b=a+1,d=(j+1)*stride+i,c=d+1;triangles.push(Object.freeze([a,b,c]),Object.freeze([a,c,d]));}
 const basis=Float64Array.from(points.flat()),offsets=Uint32Array.from(triangles.flat(),index=>index*5);
 const topology=Object.freeze({points:Object.freeze(points),triangles:Object.freeze(triangles),basis,offsets});
 return points.length<=512?remember(spheres,key,topology,32):topology;
}
function ellipsoidNormals(topology,rx,ry,rz,sides,rings){
 const key=`${sides}/${rings}/${rx}/${ry}/${rz}`;if(gradients.has(key))return gradients.get(key);
 const normals=topology.points.map(p=>{const n=[p[0]/rx,p[1]/ry,p[2]/rz],length=Math.hypot(...n);return Object.freeze(n.map(v=>v/length));});
 const triangles=Object.freeze(topology.triangles.map(indices=>Object.freeze(indices.map(index=>normals[index]))));
 const basis=Float64Array.from(normals.flat());
 const gradientsForShape=Object.freeze({points:Object.freeze(normals),triangles,basis});
 return normals.length<=256?remember(gradients,key,gradientsForShape,64):gradientsForShape;
}
export class Mesh {
 constructor(){this.buffer=new ArrayBuffer(16384);this.view=new DataView(this.buffer);this.scratch=null;this.words=null;this.bytes=0;this.origin=[0,0,0];this.angle=0;this.rotationAngle=0;this.cosine=1;this.sine=0;this.scale=1;this.kind=8;this.tint=c=>rgb(c);this.lastColor=null;this.lastTint=null;this.paint=null;}
 rotation(){if(!Object.is(this.angle,this.rotationAngle)){this.rotationAngle=this.angle;this.cosine=Math.cos(this.angle);this.sine=Math.sin(this.angle);}}
 at(origin,angle=0,scale=1){this.origin=origin;this.angle=angle;this.scale=scale;this.rotation();return this;}
 point(p){this.rotation();const c=this.cosine,s=this.sine,k=this.scale;return [this.origin[0]+(p[0]*c-p[1]*s)*k,this.origin[1]+(p[0]*s+p[1]*c)*k,this.origin[2]+p[2]*k];}
 vertex(x,y,z,nx,ny,nz){const out=this.view,at=this.bytes,paint=this.paint;out.setFloat32(at,x,true);out.setFloat32(at+4,y,true);out.setFloat32(at+8,z,true);out.setInt8(at+12,Math.round(nx*127));out.setInt8(at+13,Math.round(ny*127));out.setInt8(at+14,Math.round(nz*127));out.setUint8(at+15,paint[0]);out.setUint8(at+16,paint[1]);out.setUint8(at+17,paint[2]);out.setUint8(at+18,this.kind);this.bytes+=20;}
 tri(a,b,c,color,normals){
  this.rotation();const co=this.cosine,si=this.sine,k=this.scale,o=this.origin;
  const ax=o[0]+(a[0]*co-a[1]*si)*k,ay=o[1]+(a[0]*si+a[1]*co)*k,az=o[2]+a[2]*k;
  const bx=o[0]+(b[0]*co-b[1]*si)*k,by=o[1]+(b[0]*si+b[1]*co)*k,bz=o[2]+b[2]*k;
  const cx=o[0]+(c[0]*co-c[1]*si)*k,cy=o[1]+(c[0]*si+c[1]*co)*k,cz=o[2]+c[2]*k;
  if(this.bytes+60>this.buffer.byteLength){const next=new ArrayBuffer(this.buffer.byteLength*2);new Uint8Array(next).set(new Uint8Array(this.buffer));this.buffer=next;this.view=new DataView(next);}
  if(typeof color!=='string'||color!==this.lastColor||this.tint!==this.lastTint){this.lastColor=color;this.lastTint=this.tint;this.paint=this.tint(color).map(x=>Math.max(0,Math.min(255,Math.round(x))));}
  if(normals){const [p,q,r]=normals;this.vertex(ax,ay,az,p[0]*co-p[1]*si,p[0]*si+p[1]*co,p[2]);this.vertex(bx,by,bz,q[0]*co-q[1]*si,q[0]*si+q[1]*co,q[2]);this.vertex(cx,cy,cz,r[0]*co-r[1]*si,r[0]*si+r[1]*co,r[2]);}
  else{const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const length=Math.hypot(nx,ny,nz)||1;nx/=length;ny/=length;nz/=length;this.vertex(ax,ay,az,nx,ny,nz);this.vertex(bx,by,bz,nx,ny,nz);this.vertex(cx,cy,cz,nx,ny,nz);}
 }
 quad(a,b,c,d,color){this.tri(a,b,c,color);this.tri(a,c,d,color);}
 box(x,y,z,w,d,h,color){
  if(h<=0||w<=0||d<=0)return;
  const p=[[x-w/2,y-d/2,z],[x+w/2,y-d/2,z],[x+w/2,y+d/2,z],[x-w/2,y+d/2,z],[x-w/2,y-d/2,z+h],[x+w/2,y-d/2,z+h],[x+w/2,y+d/2,z+h],[x-w/2,y+d/2,z+h]];
  if(this.quad!==Mesh.prototype.quad){for(const f of boxFaces)this.quad(...f.map(i=>p[i]),color);return;}
  // Tint may change the transform; the first triangle keeps its original call
  // boundary. Array colors and custom writers keep the full triangle path.
  this.tri(p[4],p[5],p[6],color);
  if(typeof color!=='string'||this.lastColor!==color||this.lastTint!==this.tint||this.quad!==Mesh.prototype.quad||this.tri!==Mesh.prototype.tri||this.vertex!==Mesh.prototype.vertex||this.rotation!==Mesh.prototype.rotation||this.bytes%4||this.buffer.byteLength%4){
   this.tri(p[4],p[6],p[7],color);for(let i=1;i<boxFaces.length;i++)this.quad(...boxFaces[i].map(index=>p[index]),color);return;
  }
  this.rotation();const co=this.cosine,si=this.sine,k=this.scale,o=this.origin,paint=this.paint;
  const {view,words}=packedScratch(this,104);
  // Position words are shared, but normals still come from each transformed
  // triangle: floating-point cross products need not be exact axis normals.
  for(let i=0;i<p.length;i++){
   const q=p[i],px=q[0],py=q[1];q[0]=o[0]+(px*co-py*si)*k;q[1]=o[1]+(px*si+py*co)*k;q[2]=o[2]+q[2]*k;
   const at=i*12;view.setFloat32(at,q[0],true);view.setFloat32(at+4,q[1],true);view.setFloat32(at+8,q[2],true);
  }
  view.setUint8(99,paint[0]);view.setUint8(100,paint[1]);view.setUint8(101,paint[2]);view.setUint8(102,this.kind);
  const end=this.bytes+540;
  if(end>this.buffer.byteLength){let capacity=this.buffer.byteLength;while(capacity<end)capacity*=2;const next=new ArrayBuffer(capacity);new Uint8Array(next).set(new Uint8Array(this.buffer));this.buffer=next;this.view=new DataView(next);}
  const target=packedTarget(this);let at=this.bytes/4;
  for(let i=1;i<boxTriangles.length;i++){
   const indices=boxTriangles[i],a=p[indices[0]],b=p[indices[1]],c=p[indices[2]],ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
   let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const length=Math.hypot(nx,ny,nz)||1;nx/=length;ny/=length;nz/=length;
   view.setInt8(96,Math.round(nx*127));view.setInt8(97,Math.round(ny*127));view.setInt8(98,Math.round(nz*127));
   for(const index of indices){const source=index*3;target[at]=words[source];target[at+1]=words[source+1];target[at+2]=words[source+2];target[at+3]=words[24];target[at+4]=(words[25]&~paddingMask)|(target[at+4]&paddingMask);at+=5;}
  }
  this.bytes=end;
 }
 ellipsoid(x,y,z,rx,ry,rz,color,sides=10,rings=6){
  if(rx<=0||ry<=0||rz<=0)return;
  const topology=sphere(sides,rings),normals=ellipsoidNormals(topology,rx,ry,rz,sides,rings);
  const direct=typeof color==='string'&&this.tri===standardTri&&this.vertex===standardVertex&&typeof x==='number'&&typeof y==='number'&&typeof z==='number'&&typeof rx==='number'&&typeof ry==='number'&&typeof rz==='number';
  let points=direct?null:topology.points.map(p=>[x+p[0]*rx,y+p[1]*ry,z+p[2]*rz]);
  if(!topology.triangles.length)return;
  // Keep the first tint call at its existing boundary: tri transforms before
  // tinting. Array colors and custom triangle/vertex writers retain that path.
  const first=topology.triangles[0],point=index=>{const p=topology.points[index];return [x+p[0]*rx,y+p[1]*ry,z+p[2]*rz];};this.tri(points?points[first[0]]:point(first[0]),points?points[first[1]]:point(first[1]),points?points[first[2]]:point(first[2]),color,normals.triangles[0]);
  if(typeof color!=='string'||this.lastColor!==color||this.lastTint!==this.tint||this.tri!==Mesh.prototype.tri||this.vertex!==Mesh.prototype.vertex||this.bytes%4||this.buffer.byteLength%4){
   points??=topology.points.map(p=>[x+p[0]*rx,y+p[1]*ry,z+p[2]*rz]);
   for(let i=1;i<topology.triangles.length;i++){const [a,b,c]=topology.triangles[i];this.tri(points[a],points[b],points[c],color,normals.triangles[i]);}return;
  }
  this.rotation();const co=this.cosine,si=this.sine,k=this.scale,o=this.origin,paint=this.paint;
  // Packed points avoid repeating transforms and normal/color packing
  // at every triangle corner. The original triangle order stays unchanged.
  const {view,words}=packedScratch(this,topology.points.length*20),basis=topology.basis,gradient=normals.basis;
  for(let i=0;i<topology.points.length;i++){
   const j=i*3,at=i*20,px=points?points[i][0]:x+basis[j]*rx,py=points?points[i][1]:y+basis[j+1]*ry,pz=points?points[i][2]:z+basis[j+2]*rz,nx=gradient[j],ny=gradient[j+1],nz=gradient[j+2];
   view.setFloat32(at,o[0]+(px*co-py*si)*k,true);view.setFloat32(at+4,o[1]+(px*si+py*co)*k,true);view.setFloat32(at+8,o[2]+pz*k,true);
   view.setInt8(at+12,Math.round((nx*co-ny*si)*127));view.setInt8(at+13,Math.round((nx*si+ny*co)*127));view.setInt8(at+14,Math.round(nz*127));
   view.setUint8(at+15,paint[0]);view.setUint8(at+16,paint[1]);view.setUint8(at+17,paint[2]);view.setUint8(at+18,this.kind);
  }
  const end=this.bytes+(topology.triangles.length-1)*60;
  if(end>this.buffer.byteLength){let capacity=this.buffer.byteLength;while(capacity<end)capacity*=2;const next=new ArrayBuffer(capacity);new Uint8Array(next).set(new Uint8Array(this.buffer));this.buffer=next;this.view=new DataView(next);}
  const target=packedTarget(this);let at=this.bytes/4;
  for(let i=3;i<topology.offsets.length;i++){
   const source=topology.offsets[i];target[at]=words[source];target[at+1]=words[source+1];target[at+2]=words[source+2];target[at+3]=words[source+3];
   // vertex() leaves byte 19 untouched, including previously populated buffers.
   target[at+4]=(words[source+4]&~paddingMask)|(target[at+4]&paddingMask);at+=5;
  }
  this.bytes=end;
 }
 cylinder(x,y,z,r,h,color,sides=10,top=r){if(h<=0)return;for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2,p=[x+Math.cos(a)*r,y+Math.sin(a)*r,z],q=[x+Math.cos(b)*r,y+Math.sin(b)*r,z],u=[x+Math.cos(b)*top,y+Math.sin(b)*top,z+h],v=[x+Math.cos(a)*top,y+Math.sin(a)*top,z+h];this.quad(p,q,u,v,color);this.tri([x,y,z+h],v,u,color);}}
 beam(a,b,r,color,sides=7){const d=b.map((v,i)=>v-a[i]),l=Math.hypot(...d);if(l<1e-9)return;const n=d.map(v=>v/l),c=Math.abs(n[2])<.9?[0,0,1]:[0,1,0],u=[n[1]*c[2]-n[2]*c[1],n[2]*c[0]-n[0]*c[2],n[0]*c[1]-n[1]*c[0]],ul=Math.hypot(...u);u.forEach((v,i)=>u[i]=v/ul);const v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]],p=(base,i)=>base.map((q,j)=>q+r*(u[j]*Math.cos(i/sides*Math.PI*2)+v[j]*Math.sin(i/sides*Math.PI*2)));for(let i=0;i<sides;i++)this.quad(p(a,i),p(a,i+1),p(b,i+1),p(b,i),color);}
 ribbon(points,width,color,progress=1,z=0){
  if(points.length<2||width<=0||progress<=0)return;
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  let remaining=lengths.reduce((a,b)=>a+b,0)*Math.min(1,progress);const line=[points[0]];
  for(let i=0;i<lengths.length&&remaining>0;i++){if(lengths[i]<1e-12)continue;const t=Math.min(1,remaining/lengths[i]);line.push([points[i][0]+(points[i+1][0]-points[i][0])*t,points[i][1]+(points[i+1][1]-points[i][1])*t]);remaining-=lengths[i];}
  if(line.length<2)return;const closed=progress>=1&&Math.hypot(line[0][0]-line.at(-1)[0],line[0][1]-line.at(-1)[1])<1e-10;
  const normal=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;return [-dy/length,dx/length];};
  const edges=line.map((p,i)=>{
   const before=i?normal(line[i-1],p):closed?normal(line.at(-2),p):normal(p,line[1]);
   const after=i<line.length-1?normal(p,line[i+1]):closed?normal(p,line[1]):before;
   const x=before[0]+after[0],y=before[1]+after[1],length=Math.hypot(x,y),n=length>.0001?[x/length,y/length]:after;
   const distance=Math.min(width, width*.5/Math.max(.01,n[0]*after[0]+n[1]*after[1]));
   return [[p[0]+n[0]*distance,p[1]+n[1]*distance,z],[p[0]-n[0]*distance,p[1]-n[1]*distance,z]];
  });
  for(let i=1;i<edges.length;i++)this.quad(edges[i-1][0],edges[i-1][1],edges[i][1],edges[i][0],color);
 }

 pack(){return this.buffer.slice(0,this.bytes);}
}

// Prototype replacements keep their shared, mutable per-call point arrays.
const standardTri=Mesh.prototype.tri,standardVertex=Mesh.prototype.vertex;
