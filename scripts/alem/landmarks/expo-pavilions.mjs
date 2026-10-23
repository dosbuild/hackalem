import {Mesh,blend} from './kit.mjs';
import earcut from 'earcut';
import source from './expo-pavilions-source.json' with {type:'json'};

// Immediate EXPO ensemble, anchored at the sphere, in unrotated East/North metres.
// Original mesh derived from mapped footprints and inspected reference photographs.
// Height estimates: inner thematic pavilions ~13 m; outer international halls ~22 m.
export const expoPavilionSources=Object.freeze(source.pavilions.map(p=>p.source));
export const expoPavilionOrigin=Object.freeze(source.origin);
export const expoPavilionNotes={source:'OpenStreetMap contributors, local snapshot2026-09-27, ODbL1.0',references:['https://www.smithgill.com/work/expo-2017/','https://www.ldpinternational.com/projects/astanaworldexpo','https://skymaxinnovations.kz/project/vystavochnyy-kompleks-ekspo-2017-6/'],notes:'Seven surveyed shapes with real courtyard voids; roof slopes, facade bay rhythm and skylight positions are authored photographic estimates. Current built photos take precedence over the early architect render. Does not include the sphere or its attached base.'};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const area=r=>r.reduce((n,a,i)=>{const b=r[(i+1)%r.length];return n+a[0]*b[1]-b[0]*a[1];},0);
const oriented=(r,ccw=true)=>(area(r)>0)===ccw?r:[...r].reverse();
function roofHeight(x,y,outer){
 const r=Math.hypot(x,y),t=Math.max(0,Math.min(1,(r-(outer?145:60))/(outer?135:65)));
 return (outer?18.0:10.6)+(outer?3.7:2.2)*Math.sin(t*Math.PI)+.20*Math.sin(Math.atan2(y,x)*2);
}
function roofPoint(p,outer,offset=0){return [p[0],p[1],roofHeight(...p,outer)+offset];}
function roofNormal(p,outer){const d=.05,n=[(roofHeight(p[0]-d,p[1],outer)-roofHeight(p[0]+d,p[1],outer))/(2*d),(roofHeight(p[0],p[1]-d,outer)-roofHeight(p[0],p[1]+d,outer))/(2*d),1],l=Math.hypot(...n);return n.map(v=>v/l);}
function cap(m,r,outer,color,offset=0){
 const ring=oriented(r),idx=earcut(ring.flat());
 for(let i=0;i<idx.length;i+=3){const p=idx.slice(i,i+3).map(k=>ring[k]);m.tri(...p.map(v=>roofPoint(v,outer,offset)),color,p.map(v=>roofNormal(v,outer)));}
}
function roofStrip(m,a,b,width,outer,color,offset=.12){
 const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),wx=-dy/len*width/2,wy=dx/len*width/2,n=Math.ceil(len/5);
 for(let i=0;i<n;i++){const p=mix(a,b,i/n),q=mix(a,b,(i+1)/n);m.quad(...[[p[0]-wx,p[1]-wy],[q[0]-wx,q[1]-wy],[q[0]+wx,q[1]+wy],[p[0]+wx,p[1]+wy]].map(v=>roofPoint(v,outer,offset)),color);}
}
function facade(m,ring,outer){
 const levels=outer?3:2,paint=outer?'#426e7d':'#356777';
 for(let j=0;j<ring.length;j++){
  const a=ring[j],b=ring[(j+1)%ring.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(l/(outer?3.7:3.0))),nx=(b[1]-a[1])/l,ny=-(b[0]-a[0])/l;
  const at=(p,z,offset=0)=>[p[0]+nx*offset,p[1]+ny*offset,z];
  for(let k=0;k<n;k++){
   const p=mix(a,b,k/n),q=mix(a,b,(k+1)/n),hp=roofHeight(...p,outer),hq=roofHeight(...q,outer),co=blend(paint,'#99c9c9',.12+.10*((j*7+k*3)%8)/8);
   for(let f=0;f<levels;f++){
    const z0=.65+f*(hp-1.45)/levels,z1=.65+(f+1)*(hp-1.45)/levels,w0=.65+f*(hq-1.45)/levels,w1=.65+(f+1)*(hq-1.45)/levels;
    m.material(23,()=>m.quad(at(p,z0),at(q,w0),at(q,w1),at(p,z1),co));
    // Deliberate continuous horizontal ribbons; pane grid is visually subordinate.
    m.quad(at(p,z1-.22,.035),at(q,w1-.22,.035),at(q,w1+.18,.035),at(p,z1+.18,.035),f===levels-1?'#e4e7d6':'#bbc9bf');
   }
   const w=.11,tx=(b[0]-a[0])/l*w,ty=(b[1]-a[1])/l*w;
   m.quad([p[0]-tx+nx*.06,p[1]-ty+ny*.06,.62],[p[0]+tx+nx*.06,p[1]+ty+ny*.06,.62],[p[0]+tx+nx*.06,p[1]+ty+ny*.06,hp-.65],[p[0]-tx+nx*.06,p[1]-ty+ny*.06,hp-.65],'#adc6c6');
  }
  const ha=roofHeight(...a,outer),hb=roofHeight(...b,outer);
  m.quad(at(a,0),at(b,0),at(b,.65),at(a,.65),'#ded9c4');
  m.quad(at(a,ha-.85,.1),at(b,hb-.85,.1),at(b,hb+.1,.1),at(a,ha+.1,.1),'#dce5da');
  m.beam(at(a,ha+.12,.07),at(b,hb+.12,.07),.17,'#eef0df',4);
  // A slim turquoise eave light, visible only at night, follows the same roof.
  m.material(25,()=>m.quad(at(a,ha-.48,.13),at(b,hb-.48,.13),at(b,hb-.40,.13),at(a,ha-.40,.13),'#b5e2d9'));
 }
}
export function expoPavilions(){
 const m=new Mesh();
 for(const p of source.pavilions){
  const outer=p.source.startsWith('relation/');
  // Subdivided roof cells bend gently while retaining the exact outer contour.
  for(let i=0;i<p.roofCells.length;i++)cap(m,p.roofCells[i],outer,blend(outer?'#8ea5ad':'#9cafb2','#bacac8',(i%5)*.018));
  for(const poly of p.polygons){facade(m,oriented(poly.outer),outer);for(const hole of poly.holes)facade(m,oriented(hole,false),outer);}
  for(const line of p.ribs)for(let i=0;i<line.length-1;i++)roofStrip(m,line[i],line[i+1],.15,outer,'#c5d3ce',.045);
  for(const light of p.skylights){
   m.material(23,()=>cap(m,light,outer,'#a4cdd1',.10));
   for(let i=0;i<light.length;i++)roofStrip(m,light[i],light[(i+1)%light.length],.16,outer,'#e5ebdf',.15);
   // Repeated panes across the long glass strip are kept thin at close range.
   const pts=light,a=pts[0],b=pts[1];
   if(pts.length===4){const c=pts[2],d=pts[3],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(2,Math.ceil(len/3));for(let j=1;j<n;j++)roofStrip(m,mix(a,b,j/n),mix(d,c,j/n),.10,outer,'#e3e9db',.155);}
  }
 }
 return m;
}
