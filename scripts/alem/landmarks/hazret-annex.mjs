import {Mesh} from './kit.mjs';
import earcut from 'earcut';
import source from './hazret-annex-source.json' with {type:'json'};

// Low ancillary wing beside Hazret Sultan. Preserve the exact concave source
// footprint and round end rooms, using the mosque's pale stone material family.
// Six-metre height is the source estimate. Fenestration is a restrained authored
// approximation; the reference photos do not resolve individual service bays.
const outer=source.geometry.coordinates[0][0].slice(0,-1);
const signedArea=r=>r.reduce((s,a,i)=>{const b=r[(i+1)%r.length];return s+a[0]*b[1]-b[0]*a[1];},0);
// Calculate the centroid in local metres to avoid loss of geographic precision.
const ref=outer[0],raw=outer.map(p=>[(p[0]-ref[0])*69600,(p[1]-ref[1])*111000]);
const cross=raw.map((a,i)=>{const b=raw[(i+1)%raw.length];return a[0]*b[1]-b[0]*a[1];});
const sum=cross.reduce((a,b)=>a+b,0),cen=[0,1].map(k=>raw.reduce((s,a,i)=>s+(a[k]+raw[(i+1)%raw.length][k])*cross[i],0)/(3*sum));
export const hazretAnnexOrigin=Object.freeze([ref[0]+cen[0]/69600,ref[1]+cen[1]/111000]);
export const hazretAnnexSources=Object.freeze([source.id]);
export const hazretAnnexNotes=Object.freeze({source:'OpenStreetMap contributors, existing local snapshot, ODbL 1.0',height:'Source estimate 6m',detail:'Exact mapped footprint; pale stone and low roof; individual window bays are inferred.'});
const ring=raw.map(p=>[p[0]-cen[0],p[1]-cen[1]]);if(signedArea(ring)<0)ring.reverse();
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function hazretAnnex(){
 const m=new Mesh(),ids=earcut(ring.flat()),roof=5.55;
 for(let i=0;i<ids.length;i+=3)m.tri(...ids.slice(i,i+3).map(j=>[...ring[j],roof]),'#a9b6af');
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=dy/len,ny=-dx/len;
  const at=(p,z,o=0)=>[p[0]+nx*o,p[1]+ny*o,z];
  for(const [z0,z1,col,off] of [[0,.45,'#cabfa9',0],[.45,5.25,'#eee7d3',0],[5.25,5.62,'#d2c9b5',.12],[5.62,6,'#f4edd9',.2]])m.quad(at(a,z0,off),at(b,z0,off),at(b,z1,off),at(a,z1,off),col);
  m.quad(at(a,6,-.18),at(b,6,-.18),at(b,6,.2),at(a,6,.2),'#faf1dc');
  m.quad(at(b,roof,-.18),at(a,roof,-.18),at(a,6,-.18),at(b,6,-.18),'#d7d2be');
  if(len<2.4)continue;
  const bays=Math.max(1,Math.floor(len/4.5));
  for(let j=0;j<bays;j++){
   const t=(j+.5)/bays,w=Math.min(1.9,len/bays*.49),u=mix(a,b,t-w/2/len),v=mix(a,b,t+w/2/len);
   m.material(23,()=>m.quad(at(u,1.55,.025),at(v,1.55,.025),at(v,3.65,.025),at(u,3.65,.025),'#497180'));
   m.beam(at(u,1.5,.065),at(v,1.5,.065),.075,'#fbf2dc',4);
   for(const p of [u,v])m.beam(at(p,1.55,.065),at(p,3.7,.065),.065,'#faf1dc',4);
   m.beam(at(u,3.7,.065),at(v,3.7,.065),.08,'#faf1dc',4);
   const c=mix(u,v,.5);m.beam(at(c,1.55,.065),at(c,3.65,.065),.035,'#d9e0d6',4);
  }
 }
 return m;
}
