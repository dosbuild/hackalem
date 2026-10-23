import {Mesh, TAU, blend, tree, bench, lamp} from './kit.mjs';

/**
 * Original architectural studies in east/north/up metres. Geometry is deliberately
 * authored at real scale: the compiler owns geographic placement, never the mesh.
 * Fine mullions are actual surfaces, so the silhouettes survive close inspection.
 */
const P = {
  chalk:'#f0efdd', white:'#f6f3e4', silver:'#b6ced1', darkSteel:'#54727b',
  glass:'#387fa1', darkGlass:'#244c63', paving:'#d3c6ab', edge:'#ac9b80',
  gold:'#deb34a', darkGold:'#a98233', grass:'#819b66', flower:'#dc9a62',
};
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=p=>{const l=Math.hypot(...p)||1;return p.map(v=>v/l);};
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const polar=(r,a,z=0)=>[r*Math.cos(a),r*Math.sin(a),z];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const mat=(m,k,fn)=>m.material(k,fn);

// A continuous patch, with true differential normals instead of a faceted cone.
function patch(m,point,us,vs,color,{u0=0,u1=1,v0=0,v1=1,flip=false,smooth=true,normal:normalAt}={}){
  const normal=normalAt||((u,v)=>{
    const d=.00005,du=sub(point(u+d,v),point(u-d,v)),dv=sub(point(u,v+d),point(u,v-d));
    const n=norm(cross(du,dv));return flip?n.map(x=>-x):n;
  });
  for(let j=0;j<vs;j++)for(let i=0;i<us;i++){
    const a=u0+(u1-u0)*i/us,b=u0+(u1-u0)*(i+1)/us,c=v0+(v1-v0)*j/vs,d=v0+(v1-v0)*(j+1)/vs;
    const uv=[[a,c],[b,c],[b,d],[a,d]],ps=uv.map(p=>point(...p));
    const ns=smooth?uv.map(p=>normal(...p)):null,co=typeof color==='function'?color(i,j,(a+b)/2,(c+d)/2):color;
    if(flip){m.tri(ps[0],ps[2],ps[1],co,ns&&[ns[0],ns[2],ns[1]]);m.tri(ps[0],ps[3],ps[2],co,ns&&[ns[0],ns[3],ns[2]]);}
    else {m.tri(ps[0],ps[1],ps[2],co,ns&&ns.slice(0,3));m.tri(ps[0],ps[2],ps[3],co,ns&&[ns[0],ns[2],ns[3]]);}
  }
}

function annulus(m,inner,outer,z,color,n=96,start=0,end=TAU){
  for(let i=0;i<n;i++){const a=start+(end-start)*i/n,b=start+(end-start)*(i+1)/n;m.quad(polar(inner,a,z),polar(outer,a,z),polar(outer,b,z),polar(inner,b,z),color);}
}
function curve(m,fn,steps,r,color,sides=5){m.path(Array.from({length:steps+1},(_,i)=>fn(i/steps)),r,color,sides);}

export function expo(){
  const m=new Mesh();
  // The plinth and swept glass apron merge into the globe; this is not a ball
  // perched on a cylinder. Westward broadening corresponds to the main approach.
  m.cylinder(0,0,0,57,.55,P.edge,96);
  m.disk(0,0,.56,56.6,P.paving,96);
  for(const r of [43,48,54])annulus(m,r,r+.22,.59,'#b6bba8');
  const outer=a=>48+4*Math.cos(2*a)+10*Math.exp(-Math.pow(wrap(a-Math.PI)/.45,2));
  const apron=(u,v,offset=0)=>{
    const a=u*TAU,r=23+(outer(a)-23)*v;
    return [r*Math.cos(a),r*Math.sin(a),7.2+25*Math.pow(Math.max(0,1-v),1.7)+2*Math.sin(a*2)*v+offset];
  };
  mat(m,23,()=>{
    patch(m,(u,v)=>apron(u,v),96,12,(i,j)=>blend('#32667c','#7296a1',j/14),{flip:true});
    patch(m,(u,v)=>{const p=apron(u,1);return [p[0],p[1],.8+(p[2]-.8)*v];},96,1,'#264b5d');
  });
  curve(m,t=>apron(t,1,.16),96,.3,'#e5e5d7',6);
  for(let i=0;i<64;i++)curve(m,t=>apron(i/64,t,.085),12,.072,'#a8c6c8',3);
  for(const v of [.26,.50,.73])curve(m,t=>apron(t,v,.09),96,.09,'#bdd2cf',3);
  for(let i=0;i<96;i++){
    const a=i/96*TAU,r=outer(a),z=apron(i/96,1)[2];
    m.beam(polar(r+.035,a,.85),polar(r+.035,a,z),.09,'#bdd2cf',4);
  }
  // Precision curved-glass panels. 80 m clear sphere; its top is 100 m above
  // grade. The shallow north-facing wind scoop modifies the upper latitude.
  const sphere=(u,v,inflate=0)=>{
    const a=u*TAU+(v-.5)*.82,b=-Math.PI/2+v*Math.PI,r=40+inflate;
    const scoop=Math.exp(-Math.pow(wrap(a-Math.PI/2)/.36,4))*Math.exp(-Math.pow((v-.90)/.067,4));
    return [Math.cos(a)*Math.cos(b)*r,Math.sin(a)*Math.cos(b)*r,60+Math.sin(b)*r-3.6*scoop];
  };
  mat(m,23,()=>patch(m,(u,v)=>sphere(u,v),64,32,(i,j,u,v)=>{
    const latitude=.25+.52*Math.sin(v*Math.PI/2);
    const panel=((i*7+j*3)%13-6)*.008;
    return blend('#285b80','#6cb9cb',Math.max(0,Math.min(1,latitude+panel)));
  }));
  // Flat ribbons sit barely proud of the curved glass, keeping the framing fine.
  for(let i=0;i<64;i++)patch(m,(u,v)=>sphere(i/64+(u-.5)*.00062,v,.105),1,32,'#82b6c3',{v0:.025,v1:.975});
  for(let j=1;j<32;j++)patch(m,(u,v)=>sphere(u,j/32+(v-.5)*.0015,.11),128,1,'#7aabb9');
  // Structural meridians are legible on approach without obscuring the glass.
  for(let i=0;i<16;i++)curve(m,t=>sphere(i/16,.075+t*.85,.15),28,.115,'#abd0d4',4);
  // The dark scoop is recessed, with its two horizontal-axis wind generators.
  m.component([0,9,94.1],0,()=>{
    m.box(0,0,0,12,8,.65,'#355c71');
    for(const x of [-3.15,3.15]){
      m.beam([x,0,.7],[x,2,.7],.32,'#9dbbc6',8);
      for(let b=0;b<3;b++){
        const a=b/3*TAU;
        m.tri([x,1.1,.7],[x+Math.cos(a)*2.7,1.1,.7+Math.sin(a)*2.7],[x+Math.cos(a+.24)*1.2,1.1,.7+Math.sin(a+.24)*1.2],'#d3dedc');
      }
    }
  });
  // A broad western entrance, silver canopy and human-scale door bays.
  m.component([-51.4,0,.6],-Math.PI/2,()=>{
    mat(m,23,()=>m.box(0,0,0,23,10.4,7.8,'#244c60'));
    for(let i=-5;i<=5;i++)m.box(i*1.95,-5.23,.2,.10,.11,6.2,'#e3e7dc');
    m.box(0,-.7,7.8,27,12.5,.7,'#e7e9dc');
    for(const x of [-11.5,11.5])m.cylinder(x,-5.1,.1,.24,7.7,'#ecebdc',8);
    for(let i=0;i<4;i++)m.box(0,-7.3-i*.8,.03,27.5+i*.5,.8,.6-i*.15,'#ddcfb3');
    mat(m,25,()=>m.box(0,-7,7.68,24,.12,.09,'#dcefd7'));
  });
  // Adjacent pavilion shells are modelled from their actual mapped outlines
  // in expo-pavilions.mjs; avoid a second conceptual canopy in their footprint.
  for(const a of [.20,.47,2.66,2.94,3.35,3.63,5.80,6.08]){
    const p=polar(61,a);m.cylinder(p[0],p[1],.05,2.5,.55,'#d8cbb0',16);tree(m,p[0],p[1],5.5,1.9);
  }
  for(const a of [1.2,1.65,4.34,4.85]){const p=polar(54,a);bench(m,p[0],p[1],a+Math.PI/2);}
  return m;
}

export function baiterek(){
  const m=new Mesh();
  // A restrained, concentric plaza gives the long white trunk a firm base.
  m.cylinder(0,0,0,28,.30,P.edge,96);
  m.disk(0,0,.31,27.7,'#dbcfb2',96);
  for(const [r,w,c] of [[10.8,1.4,'#eee5cd'],[13.4,.35,'#9c917d'],[17.4,.3,'#a6997d'],[23,.4,'#a6997d']])annulus(m,r,r+w,.34,c);
  for(let i=0;i<32;i++){
    const a=i/32*TAU;m.quad(polar(12,a,.355),polar(27.6,a,.355),polar(27.6,a+.005,.355),polar(12,a+.005,.355),'#bbb194');
  }
  m.lathe(0,0,[[10.4,.3],[10.4,.7],[9.9,.8],[9.9,1.05],[9.3,1.2],[9.3,1.5],[8.8,1.6]],'#eddfc1',96);
  m.disk(0,0,1.61,8.8,'#e7d8b8',64);
  mat(m,23,()=>m.cylinder(0,0,1.6,2.60,78,'#465958',32));
  // Core glazing and the three elevator spines remain visible through the cage.
  for(let i=0;i<3;i++){
    const a=i/3*TAU+.18;m.beam(polar(1.85,a,1.6),polar(1.85,a,80.6),.53,'#e5e5d7',10);
  }
  for(let i=0;i<12;i++)curve(m,t=>polar(2.68,i/12*TAU,2+t*77),1,.12,'#c4d2c7',5);
  const profile=z=>{
    const t=(z-1.6)/96;
    return 4.8-1.25*Math.sin(Math.min(1,t/.57)*Math.PI/2)+14.4*Math.pow(Math.max(0,(t-.36)/.64),2.1);
  };
  // The branching basket is the architectural identity: long continuous ribs,
  // outward-reaching tips, with open diamond bracing beneath the gold sphere.
  for(let i=0;i<24;i++){
    const a=i/24*TAU;
    curve(m,t=>{const z=1.6+t*96;return polar(profile(z),a,z);},32,.31,'#efefe0',7);
    const collar=polar(4.8,a,2);m.cylinder(collar[0],collar[1],1.5,.48,1.2,'#d9d7c2',8);
  }
  for(const z of [47,57,65,72,78,83,88,93])m.ring(0,0,z,profile(z),.135,'#d9e0d3',72,4);
  const levels=[43,54,64,73,81,88,94];
  for(let j=0;j<levels.length-1;j++)for(let i=0;i<24;i++){
    const a=i/24*TAU,b=(i+1)/24*TAU,z=levels[j],h=levels[j+1];
    m.beam(polar(profile(z),a,z),polar(profile(h),b,h),.135,'#e3e6d8',5);
    if(j>1)m.beam(polar(profile(z),b,z),polar(profile(h),a,h),.10,'#d3ded4',4);
  }
  // Observation sphere: a 22 m diameter gold-glazed volume, with a readable
  // curtain-wall pattern. Fine honey-colored frames preserve the jewel effect.
  const sphere=(u,v,r=11)=>{const a=u*TAU,b=-Math.PI/2+v*Math.PI;return [Math.cos(a)*Math.cos(b)*r,Math.sin(a)*Math.cos(b)*r,94+Math.sin(b)*r];};
  mat(m,24,()=>patch(m,(u,v)=>sphere(u,v),48,24,(i,j,u,v)=>{
    const tone=.23+.49*v+((i*5+j)%7-3)*.018;return blend('#ac802e','#f4d97f',tone);
  }));
  for(let i=0;i<24;i++)patch(m,(u,v)=>sphere(i/24+(u-.5)*.0015,v,11.04),1,24,'#b49850',{v0:.035,v1:.965});
  for(let j=2;j<16;j++)patch(m,(u,v)=>sphere(u,j/17+(v-.5)*.0025,11.045),72,1,'#b39445');
  mat(m,24,()=>{
    m.lathe(0,0,[[1.9,104.84],[1.4,105.2],[.20,105.45]],'#efcf71',32);
    m.cylinder(0,0,105.4,.115,2.9,'#d9c98b',8,.035);
  });
  // Entry pavilion and delicate entrance canopy under the tower's west side.
  mat(m,23,()=>m.box(-5.5,0,1.5,3.5,6,3.2,'#3e6973'));
  m.box(-6.3,0,4.7,4.7,7.8,.22,'#f0e6cb');
  for(const y of [-2.45,-.82,.82,2.45])m.box(-7.28,y,1.7,.1,.10,2.6,'#d5dccb');
  for(let i=0;i<8;i++){
    const a=i/8*TAU+Math.PI/8,p=polar(21.5,a);
    annularFlower(m,p[0],p[1],2.1);
    const q=polar(25.5,a);bench(m,q[0],q[1],a+Math.PI/2);
  }
  for(const a of [.2,1.8,3.35,4.9]){const p=polar(25.6,a);lamp(m,p[0],p[1],4);}
  return m;
}

function annularFlower(m,x,y,r){
  m.cylinder(x,y,.31,r,.28,'#c8b698',24);
  m.disk(x,y,.60,r-.16,'#81965f',24);
  for(let j=0;j<8;j++){const a=j/8*TAU;m.ellipsoid(x+(r-.55)*Math.cos(a),y+(r-.55)*Math.sin(a),.76,.38,.38,.18,j%2?'#dcaa6a':'#c18365',7,4);}
}

export function khan(){
  const m=new Mesh(),rx=100,ry=97.5,top=[-22,16,94];
  const eave=a=>[76*Math.cos(a),69*Math.sin(a),20.8+1.6*Math.cos(a)];
  const tent=(u,v,offset=0)=>{
    const a=u*TAU,b=eave(a),r=Math.pow(Math.max(0,1-v),1.26),tip=[top[0]+10.2*Math.cos(a),top[1]+10.2*Math.sin(a)];
    return [tip[0]*(1-r)+b[0]*r,tip[1]*(1-r)+b[1]*r,b[2]+(top[2]-b[2])*v+offset];
  };
  // Layered stone plinth follows the true elliptical footprint.
  patch(m,(u,v)=>{const a=u*TAU;return [102.8*Math.cos(a),100.3*Math.sin(a),.15+v*.8];},96,1,'#b6ad98');
  patch(m,(u,v)=>{const a=u*TAU;return [(100+v*2.8)*Math.cos(a),(97.5+v*2.8)*Math.sin(a),.96];},96,1,'#ded7bf',{flip:true});
  mat(m,23,()=>patch(m,(u,v)=>{const a=u*TAU;return [rx*Math.cos(a),ry*Math.sin(a),1+6.2*v];},96,2,(i,j)=>j===1?'#4d7880':'#42656e'));
  for(const h of [1,4.2,7.2])curve(m,t=>{const a=t*TAU;return [rx*Math.cos(a),ry*Math.sin(a),h];},128,.21,'#d8ddd0',5);
  for(let i=0;i<96;i++){
    const a=i/96*TAU;m.beam([rx*Math.cos(a),ry*Math.sin(a),1],[rx*Math.cos(a),ry*Math.sin(a),7.2],.10,'#bdccc8',4);
  }
  // Broad opaque apron, clearly separate from the translucent inner tent.
  // The ring of raised teardrop skylights is unmistakable in the operator's
  // aerial photographs, and gives the footprint its characteristic scalloping.
  const skirt=(u,v)=>{
    const a=u*TAU,p=eave(a),outer=[rx*Math.cos(a),ry*Math.sin(a),7.2];
    const q=mix(p,outer,v);q[2]+=1.3*Math.sin(v*Math.PI);return q;
  };
  patch(m,skirt,128,8,'#e0decc',{flip:true});
  curve(m,t=>skirt(t,1),128,.46,'#eae8d5',6);
  for(let i=0;i<40;i++){
    const a=(i+.5)/40*TAU,p=skirt((i+.5)/40,.64),angle=a;
    const skylight=(u,v,inflate=0)=>{
      const th=u*TAU,ph=v*Math.PI/2;
      const x=(3.6+inflate)*Math.cos(th)*Math.cos(ph),y=(1.85+inflate)*Math.sin(th)*Math.cos(ph),z=1.65*Math.sin(ph)-x*.48;
      return [p[0]+x*Math.cos(angle)-y*Math.sin(angle),p[1]+x*Math.sin(angle)+y*Math.cos(angle),p[2]+z+.08];
    };
    const skylightNormal=(u,v)=>{
      const th=u*TAU,ph=v*Math.PI/2,z=Math.sin(ph)/1.65,x=Math.cos(th)*Math.cos(ph)/3.6+z*.48,y=Math.sin(th)*Math.cos(ph)/1.85;
      return norm([x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),z]);
    };
    mat(m,23,()=>patch(m,(u,v)=>skylight(u,v),12,4,'#74a5ad',{normal:skylightNormal}));
    curve(m,t=>skylight(t,0,.14),16,.13,'#f0efe0',4);
    curve(m,t=>skylight(.25,t),4,.055,'#c9d9d0',4);
    curve(m,t=>skylight(.75,t),4,.055,'#c9d9d0',4);
  }
  // Pearl ETFE cushions retain a cold blue cast and visible radial cable rhythm.
  // The mast offset and concave catenary profile distinguish Khan Shatyr from
  // an ordinary cone, including when viewed from the opposite bank.
  mat(m,23,()=>patch(m,(u,v)=>tent(u,v),80,28,(i,j,u,v)=>{
    const panel=((i+j*2)%9-4)*.01,band=(i%5===0?-.045:0);
    return blend('#b5c7ca','#edf0dc',Math.min(.91,.48+v*.32+panel+band));
  }));
  for(let i=0;i<80;i++)patch(m,(u,v)=>tent(i/80+(u-.5)*.00057,v,.09),1,28,i%5===0?'#8ea9b0':'#b1c3c4',{v1:.985});
  for(let j=1;j<28;j++)patch(m,(u,v)=>tent(u,j/28+(v-.5)*.00115,.095),160,1,'#b2c3c1');
  // Heavy primary cables read at city distance; secondary seams reward zooming.
  for(let i=0;i<16;i++)curve(m,t=>tent(i/16,t*.983,.14),28,.14,'#91a7ad',5);
  curve(m,t=>tent(t,0,.1),160,.55,'#e0e2d2',6);
  // Slightly leaning exposed mast, with a ring beam, inspection ladder and
  // three high-level tie arms. Overall height is the documented 150 m.
  mat(m,24,()=>{
    m.lathe(top[0],top[1],[[10.5,93.7],[10.3,95.2],[7.5,106.4],[5.7,109.2]],'#b3a780',64);
    m.disk(top[0],top[1],109.23,5.7,'#dbd6bd',48);
    for(let z=95;z<109;z+=1.15){const r=10.4-(z-95)*.323;m.lathe(top[0],top[1],[[r+.05,z-.06],[r+.05,z+.08]],'#d2c7a5',64);}
    m.beam([-22,16,108.9],[-27.0,19.2,149.7],.62,'#e2e3cf',12);
    m.ellipsoid(-27,19.2,149.72,.28,.28,.28,'#e6e8d9',12,8);
  });
  for(const a of [0,TAU/3,TAU*2/3])m.beam([top[0]+Math.cos(a)*3.2,top[1]+Math.sin(a)*3.2,109.3],[-23.1,16.7,119.1],.10,'#cbd7d0',5);
  // Broad eastern porte-cochère on the civic axis, with glazed retail entry
  // bays and shallow stairs; nothing here changes the tent's external volume.
  m.component([96.5,0,.9],Math.PI/2,()=>{
    mat(m,23,()=>m.box(0,0,0,41,9.5,8.1,'#33596c'));
    m.box(0,-3.4,8.1,46,15,.48,'#e8e4d1');
    for(const x of [-20,-10,10,20])m.cylinder(x,-9.1,.1,.27,8,'#ebe8d3',8);
    for(let i=-10;i<=10;i++)m.box(i*1.8,-4.84,.2,.1,.1,7.6,'#bacfcd');
    for(const z of [3.1,5.8])m.box(0,-4.86,z,40,.11,.14,'#a6c0c1');
    for(let i=0;i<5;i++)m.box(0,-12-i*.9,.03,47+i*.4,.91,.85-i*.17,'#d7cbb0');
    mat(m,25,()=>m.box(0,-10.7,7.95,42,.12,.12,'#f7dfa6'));
  });
  for(const a of [-.78,-.60,.60,.78]){
    const x=109*Math.cos(a),y=107*Math.sin(a);m.cylinder(x,y,.02,3.1,.55,'#d1c1a3',24);tree(m,x,y,6.3,2.3);
  }
  return m;
}

// OSM way/1239177394, resampled in metres around the manifest's bridge anchor.
// The asymmetric S sweep is retained, including the western landing turn.
const ATYRAU_PATH=[[-134.975,-49.048],[-131.379,-41.333],[-118.142,-22.809],[-103.368,-7.67],[-85.452,5.021],[-61.434,15.418],[-26.664,20.038],[12.449,17.811],[44.217,15.908],[64.318,20.795],[75.971,27.017],[84.007,33.841],[89.893,38.506],[105.092,42.947],[123.022,46.61],[134.975,49.003]];

export function atyrau(){
  const m=new Mesh(),points=[],lengths=[0];
  // Interpolate the supplied surveyed route gently, retaining every source
  // point while avoiding visible mitres in the long flowing aluminium shell.
  for(let i=0;i<ATYRAU_PATH.length-1;i++)for(let j=0;j<12;j++){
    const t=j/12,t2=t*t,t3=t2*t,a=ATYRAU_PATH[Math.max(0,i-1)],b=ATYRAU_PATH[i],c=ATYRAU_PATH[i+1],d=ATYRAU_PATH[Math.min(ATYRAU_PATH.length-1,i+2)];
    points.push(b.map((x,k)=>.5*((2*x)+(-a[k]+c[k])*t+(2*a[k]-5*x+4*c[k]-d[k])*t2+(-a[k]+3*x-3*c[k]+d[k])*t3)));
  }
  points.push(ATYRAU_PATH.at(-1));
  const tangents=points.map((p,i)=>norm(sub(points[Math.min(points.length-1,i+1)],points[Math.max(0,i-1)])));
  for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(...sub(points[i],points[i-1])));
  const total=lengths.at(-1);
  const at=s=>{
    const d=Math.max(0,Math.min(1,s))*total;let i=lengths.findIndex(x=>x>=d);if(i<1)i=1;
    const t=(d-lengths[i-1])/(lengths[i]-lengths[i-1]),a=points[i-1],b=points[i],n=norm(mix(tangents[i-1],tangents[i],t));
    const p=mix(a,b,t);return {p:[p[0],p[1],5.5+3.1*Math.sin(s*Math.PI)],n:[-n[1],n[0],0]};
  };
  const deck=(s,w,z=0)=>{const {p,n}=at(s);return [p[0]+n[0]*w,p[1]+n[1]*w,p[2]+z];};
  const steps=112;
  for(let i=0;i<steps;i++){
    const a=i/steps,b=(i+1)/steps;
    m.quad(deck(a,-5.25),deck(b,-5.25),deck(b,5.25),deck(a,5.25),'#c9c6b7');
    // The red bicycle lane is a real part of the bridge's visual identity.
    m.quad(deck(a,-5.0,.02),deck(b,-5.0,.02),deck(b,-2.15,.02),deck(a,-2.15,.02),'#bd7c6c');
    for(const w of [-2.17,-1.98])m.quad(deck(a,w,.025),deck(b,w,.025),deck(b,w+.085,.025),deck(a,w+.085,.025),'#eae4cb');
    for(const w of [-5.25,5.25]){
      m.quad(deck(a,w,-.75),deck(b,w,-.75),deck(b,w,.15),deck(a,w,.15),'#9aaeb0');
      m.beam(deck(a,w,1.12),deck(b,w,1.12),.07,'#d4dcd4',5);
      m.beam(deck(a,w,.40),deck(b,w,.40),.045,'#b6c6c0',4);
      if(i%2===0)m.beam(deck(a,w,0),deck(a,w,1.17),.065,'#b4c5c0',5);
    }
    if(i%8===0)mat(m,25,()=>{for(const w of [-5.20,5.20])m.beam(deck(a,w,.16),deck(b,w,.16),.065,'#ffe0a7',4);});
  }
  // Two tapered piers support the real span. Their crowns meet the slab.
  for(const s of [.30,.67]){
    const {p,n}=at(s),angle=Math.atan2(n[1],n[0]);
    m.component([p[0],p[1],0],angle,()=>{
      m.box(0,0,-1.1,6.5,2.6,1.6,'#93a4a0');
      m.box(0,0,.5,3.8,1.8,p[2]-.8,'#c6ccbf');
      m.box(0,0,p[2]-.9,8,2.5,.5,'#d0d6c9');
    });
  }
  // The flowing shell is an open field of raised aluminium petals rather than
  // a solid tunnel. Each diamond is slightly folded, making fish-scale shadows.
  const shell=(s,t,out=0)=>{
    const {p,n}=at(s),v=Math.max(0,Math.sin(Math.PI*(s-.08)/.87));
    const r=6.25+2.5*Math.pow(v,.7),h=3.0+8.7*Math.pow(v,.82),a=t*Math.PI;
    const lean=1.8*Math.sin(s*TAU);
    return [p[0]+n[0]*(Math.cos(a)*(r+out)+lean*Math.sin(a)),p[1]+n[1]*(Math.cos(a)*(r+out)+lean*Math.sin(a)),p[2]+1.05+Math.sin(a)*(h+out)];
  };
  const rows=88,cols=14,s0=.07,s1=.965;
  mat(m,24,()=>{
    for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
      const s=s0+(s1-s0)*(i+.5)/rows,t=(j+.5+(i%2)*.45)/cols;
      if(t>.995)continue;
      const ds=(s1-s0)/rows*.485,dt=1/cols*.465;
      const a=shell(s-ds,t),b=shell(s,t-dt),c=shell(s+ds,t),d=shell(s,t+dt),mid=shell(s,t,.16);
      const shade=(i+2*j)%9,col=blend('#9fb5b6','#e4e8db',.44+shade*.043);
      // Windward half petals overlap a little; the clear corners admit light.
      m.tri(a,mid,b,col);m.tri(b,mid,c,blend(col,'#f0eee0',.12));m.tri(c,mid,d,col);m.tri(d,mid,a,blend(col,'#879ea5',.14));
    }
  });
  for(let i=0;i<=rows;i+=5){const s=s0+(s1-s0)*i/rows;curve(m,t=>shell(s,t,-.1),24,.11,'#8fa9af',5);}
  for(let j=0;j<=cols;j+=2)curve(m,s=>shell(s0+s*(s1-s0),j/cols,-.14),rows,.09,'#a3bbc0',4);
  for(const t of [0,1])curve(m,s=>shell(s0+s*(s1-s0),t),rows,.19,'#dce2d6',6);
  return m;
}

export const signatureMetadata={
  expo:{height:100,diameter:80,front:'west',cameraYaw:-.72,notes:'80 m curved-glass globe, wind scoop, swept podium and radial canopy context'},
  baiterek:{height:108.3,sphereDiameter:22,front:'west',cameraYaw:-.55,notes:'105 m observation volume plus slender mast; branching white lattice, gold curtain wall'},
  khan:{height:150,footprint:[200,195],front:'east',cameraYaw:2.5,notes:'Offset mast [-22,16], concave ETFE roof, eastern entrance'},
  atyrau:{anchor:[71.4250862,51.156424],width:10.5,length:305,front:'south',cameraYaw:.55,notes:'OSM centerline retained; 1,200 folded petals suggest the 2,450-piece real shell'},
};
