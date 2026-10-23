import {Mesh, palette as P, TAU, blend} from './kit.mjs';
import earcut from 'earcut';

// Original geometry in local metres. Grand Mosque fronts -Y. Abu Dhabi Plaza
// uses unrotated local EAST/NORTH coordinates around the mapped complex origin.
// Dimension sources and authored estimates: docs/landmarks/current-package.md.
// Current built form takes precedence over the earlier 382 m Abu Dhabi concept.
export const skylineNotes = Object.freeze({
  abudhabi: {widthM:225,depthM:208,heightM:311,source:'way/762780007',geographicAxes:true,notes:'Tower anchors, block rectangles and concave podium follow mapped source polygons (parts1373723360–1373723370); main architectural height is verified311m. Lower south/east office tops130/125m, west apartments60m and Sheraton50/40m are photo-calibrated estimates because source3m/floor heights underestimate the completed proportions. Side shoulders63/138m retain source estimates. Frontage silver fins, open crown and mechanical bands follow current operator photos.'},
  grandMosque: {widthM:165,depthM:258,heightM:130,source:'relation/18901938',notes:'Four 130 m minarets, blue main dome 62 m diameter / approximately 83 m overall, open courtyard and nested roof domes. Overall proportions follow the mapped extent; local ornament and arcade distribution are authored reductions.'},
});

function planeWindow(m,x,y,z,w,h,color=P.glassDark){
  m.material(23,()=>m.quad([x-w/2,y,z],[x+w/2,y,z],[x+w/2,y,z+h],[x-w/2,y,z+h],color));
}
function pointedCurve(radius,rise,segments=16){
  return Array.from({length:segments+1},(_,i)=>{const x=radius*(1-2*i/segments),u=Math.abs(x)/radius;return [x,rise*Math.sqrt(Math.max(0,4-(u+1)**2))/Math.sqrt(3)];});
}
function pointedInset(m,x,y,z,width,height,{rim=.30,color=P.cream,fill='#294b52',depth=.18,segments=12}={}){
  const r=width/2,rise=Math.min(height*.44,r*1.58),spring=z+height-rise,curve=pointedCurve(r,rise,segments);
  const points=[[x-r,y,z],[x+r,y,z],...curve.map(([a,b])=>[x+a,y,spring+b])],centre=[x,y,z+height*.45];
  m.material(23,()=>{for(let i=0;i<points.length;i++)m.tri(centre,points[i],points[(i+1)%points.length],fill);});
  m.box(x-r-rim*.5,y-depth*.4,z,rim,depth,height-rise,color);m.box(x+r+rim*.5,y-depth*.4,z,rim,depth,height-rise,color);
  const inner=curve,outer=pointedCurve(r+rim,rise+rim,segments);
  for(let i=0;i<segments;i++)m.quad([x+inner[i][0],y-depth,spring+inner[i][1]],[x+inner[i+1][0],y-depth,spring+inner[i+1][1]],[x+outer[i+1][0],y-depth,spring+outer[i+1][1]],[x+outer[i][0],y-depth,spring+outer[i][1]],color);
  m.box(x,y-depth*.4,z-.13,width+rim*2,depth,.18,color);
}
function arcade(m,length,depth,base=3,height=16,bay=7.2){
  const count=Math.round(length/bay),step=length/count,opening=step-1.45,r=opening/2,rise=opening*.65,spring=base+height-rise;
  for(let i=0;i<=count;i++)m.box(-length/2+i*step,0,base,1.45,depth,height,P.cream);
  m.box(0,0,base+height,length+1.45,depth,1.0,P.stone);
  m.box(0,0,base+height+1.0,length+2.1,depth+.8,.6,P.cream);
  const profile=pointedCurve(r,rise,12);
  for(let i=0;i<count;i++){
    const x=-length/2+(i+.5)*step;
    for(let j=0;j<profile.length-1;j++){
      const [ax,az]=profile[j],[bx,bz]=profile[j+1],a=[x+ax,-depth/2,spring+az],b=[x+bx,-depth/2,spring+bz],c=[x+bx,-depth/2,base+height],d=[x+ax,-depth/2,base+height];
      m.quad(a,b,c,d,P.cream);m.quad([d[0],depth/2,d[2]],[c[0],depth/2,c[2]],[b[0],depth/2,b[2]],[a[0],depth/2,a[2]],P.cream);
      m.quad([a[0],-depth/2,a[2]],[a[0],depth/2,a[2]],[b[0],depth/2,b[2]],[b[0],-depth/2,b[2]],P.stone);
    }
    // Interior gallery columns provide a second layer of shadow behind the arch.
    for(const sx of [-1,1])m.cylinder(x+sx*(r+.12),depth*.20,base,.27,height-rise,P.stone,8);
  }
}
function crescent(m,x,y,z,size=1.0){
  m.material(24,()=>{
    m.cylinder(x,y,z,.11*size,1.15*size,P.gold,8);
    m.ellipsoid(x,y,z+1.30*size,.28*size,.28*size,.28*size,P.goldLight,10,6);
    const points=[];for(let i=0;i<=20;i++){const a=(-.36+i/20*1.72)*Math.PI;points.push([x+Math.cos(a)*.72*size,y,z+2.25*size+Math.sin(a)*.72*size]);}
    m.path(points,.12*size,P.gold,5);
  });
}
function dome(m,x,y,z,r,h,{small=false,ornament=false,color='#369fc1',finial=true}={}){
  const sides=small?12:ornament?64:28,rings=small?5:ornament?18:8;
  const profile=[];for(let j=0;j<=rings;j++){const a=j/rings*Math.PI/2;profile.push([r*Math.cos(a),z+h*Math.sin(a)]);}
  m.material(8,()=>m.lathe(x,y,profile,(i,j)=>blend(color,'#a4d3d0',Math.pow((Math.sin(i/sides*TAU*18)+1)/2,6)*(small?.03:.11)),sides));
  m.lathe(x,y,[[r*1.016,z-.6],[r*1.016,z+.2],[r,z+.42]],P.cream,sides,{smooth:false});
  if(ornament){
    // Fine raised meridians read as fluting at an approach without changing the dome.
    const n=32;
    for(let i=0;i<n;i++){const a=i/n*TAU,pts=[];for(let j=0;j<=12;j++){const t=j/12*Math.PI*.487;pts.push([x+(r+.07)*Math.cos(t)*Math.cos(a),y+(r+.07)*Math.cos(t)*Math.sin(a),z+h*Math.sin(t)]);}m.path(pts,.075,blend(color,'#b6d4d3',.28),4);}
  }
  if(ornament)m.material(24,()=>{
    for(const t of [.27,.49,.69])for(let i=0;i<24;i++){
      const a=i/24*TAU,dt=.067,da=.040,pt=(angle,lat)=>[x+(r+.11)*Math.cos(lat)*Math.cos(angle),y+(r+.11)*Math.cos(lat)*Math.sin(angle),z+h*Math.sin(lat)];
      const pts=[pt(a,t-dt),pt(a+da,t),pt(a,t+dt),pt(a-da,t),pt(a,t-dt)];m.path(pts,.14,P.goldLight,4);
    }
  });
  if(finial)crescent(m,x,y,z+h,small?.30:ornament?1.35:.66);
}
function minaret(m,x,y){
  const profile=[[6.1,3],[6.1,21],[4.4,25],[3.55,28],[3.38,47],[4.6,47],[5.3,50],[5.3,52],[3.2,54],[3.04,76],[4.3,76],[4.9,79],[4.9,81],[2.94,83],[2.80,102],[4.00,102],[4.6,105],[4.6,107],[2.65,109],[2.65,122]];
  m.lathe(x,y,profile,(i,j)=>i%2?P.cream:'#e5dfca',12,{smooth:false,phase:Math.PI/12});
  // Ashlar joints and carved balcony rims remain geometric, not photo textures.
  for(let z=29;z<102;z+=2.9){const r=z<47?3.49:z<76?3.13:2.90;m.lathe(x,y,[[r,z],[r,z+.075]],'#c2baa4',12,{smooth:false,phase:Math.PI/12});}
  for(const [z,r] of [[51,5.3],[80,4.9],[106,4.6]]){
    for(let i=0;i<12;i++){const a=i/12*TAU+Math.PI/12;m.component([x+r*Math.cos(a),y+r*Math.sin(a),z],a,()=>m.box(0,0,0,.55,.50,1.1,P.cream));}
    m.lathe(x,y,[[r+.12,z-1.0],[r+.12,z-.75]],P.cream,12,{smooth:false});
  }
  for(let i=0;i<8;i++){const a=i/8*TAU;m.component([x+2.67*Math.sin(a),y-2.67*Math.cos(a),112],a,()=>pointedInset(m,0,0,0,1.0,7.5,{rim:.14,fill:'#284a50',depth:.10,segments:8}));}
  // The caps are small blue hemispheres, followed by the slender gold crescent.
  dome(m,x,y,122,2.78,2.65,{color:'#258eb1',small:true,finial:false});crescent(m,x,y,124.65,1.735);
  for(let side=0;side<4;side++)m.component([x,y,0],side*Math.PI/2,()=>{
    m.box(0,-6.13,6,2.55,.14,12,'#c8c5b6');
    for(let j=0;j<7;j++)m.box(0,-6.23,6.5+j*1.55,2.20,.10,.10,P.cream);
  });
}
function gate(m,x,y,z=3,scale=1){
  m.component([x,y,z],0,()=>{
    const w=17*scale,d=13*scale,h=26*scale;
    m.box(0,0,0,w,d,h,P.stone);m.box(0,-d/2-.16,1.2*scale,w-2*scale,.36,h-2*scale,P.cream);
    pointedInset(m,0,-d/2-.38,0.6*scale,9*scale,21*scale,{rim:.56*scale,depth:.3*scale,fill:'#264b56'});
    m.box(0,-d/2-.62,h-1.8*scale,w+.6*scale,.8*scale,1.0*scale,P.cream);
    m.box(0,0,h,w+1.0*scale,d+1.0*scale,1.2*scale,P.cream);
    dome(m,0,0,h+1.25*scale,8.0*scale,6.0*scale,{color:'#379fc1'});
  });
}

export function grandMosque(){
  const m=new Mesh();
  // Width 165 m, length 258 m. Front/courtyard occupies negative Y.
  m.box(0,0,0,165,258,2.2,'#cbbfa6');m.box(0,0,2.2,164,257,.8,P.cream);
  m.box(0,-59,3,127,113,.08,'#e7dfcd');
  // Quiet paving grid in the courtyard; the centre remains a true open void.
  for(let x=-56;x<=56;x+=14)m.box(x,-59,3.095,.16,102,.025,'#c3bdad');
  for(let y=-108;y<=-8;y+=14)m.box(0,y,3.095,116,.16,.025,'#c3bdad');
  // Rectangular prayer hall, stepped shoulders and central octagonal dome drum.
  m.box(0,62.5,3,156,125,25,P.cream);m.box(0,63,28,132,110,3.0,P.stone);
  m.box(0,65,31,98,89,7.0,P.cream);
  m.lathe(0,66,[[42,35],[42,40],[39.5,43],[38,43],[38,49]],P.cream,8,{smooth:false,phase:Math.PI/8});
  m.lathe(0,66,[[32.0,48],[32.0,49.2]],P.stone,64,{smooth:false});
  // Octagonal upper windows and large arched wall bays.
  for(let i=0;i<8;i++){
    const a=i/8*TAU;
    m.component([Math.sin(a)*38.05,66-Math.cos(a)*38.05,0],a,()=>{
      for(let j=-3;j<=3;j++)planeWindow(m,j*2.6,-.02,43.7,1.0,4.5,'#3f6263');
      m.box(0,-.2,48.35,20,.34,.5,P.cream);
    });
  }
  dome(m,0,66,49.2,31,30,{ornament:true,color:'#248ead'});
  const secondary=[[-42,28,12.5],[0,22,14],[42,28,12.5],[-52,62,12.3],[52,62,12.3],[-40,104,12],[0,112,13.5],[40,104,12]];
  for(const [x,y,r] of secondary){
    m.lathe(x,y,[[r+1.0,28],[r+1.0,32.2],[r+.6,33.0]],P.cream,36,{smooth:false});
    for(let i=0;i<20;i++){const a=i/20*TAU;m.component([x+(r+1.025)*Math.sin(a),y-(r+1.025)*Math.cos(a),0],a,()=>planeWindow(m,0,0,28.8,1.0,2.65,'#48676a'));}
    dome(m,x,y,33.0,r,r*.82,{color:'#359fb9'});
  }
  // Perimeter arcade galleries: open arches, roof bands and a second row of columns.
  m.component([0,-118,0],0,()=>arcade(m,144,13,3,15,7.2));
  for(const x of [-73,73])m.component([x,-56,0],Math.PI/2,()=>arcade(m,124,13,3,15,7.3));
  // White roof dome rhythm: sixty small domes, with four blue gate domes.
  for(const y of [-121.3,-114.7])for(let i=0;i<12;i++)dome(m,-65.4+i*11.9,y,19.65,3.7,3.1,{small:true,color:'#f2ead7',finial:false});
  for(const x of [-76.3,-69.7,69.7,76.3])for(let i=0;i<9;i++)dome(m,x,-100+i*11.25,19.65,3.7,3.1,{small:true,color:'#f2ead7',finial:false});
  gate(m,0,-118,3,1);gate(m,0,-2.0,3,1.1);
  for(const x of [-73,73])m.component([x,-55,0],x<0?-Math.PI/2:Math.PI/2,()=>gate(m,0,0,3,.85));
  // Side/rear wall bays are shallow stone relief framing real dark openings.
  for(const side of [-1,1])m.component([side*78.05,63,0],side<0?-Math.PI/2:Math.PI/2,()=>{
    m.box(0,0,24.8,122,.48,1.0,P.stone);
    for(let i=-6;i<=6;i++)pointedInset(m,i*8.8,-.17,6,5.8,16.4,{rim:.35,depth:.25,fill:'#5f7775'});
  });
  m.component([0,125.05,0],Math.PI,()=>{for(let i=-7;i<=7;i++)pointedInset(m,i*9.1,-.12,5.5,5.9,17.0,{rim:.34,fill:'#5d7472'});});
  // Hall frontage behind the courtyard: shadowed arched bays, paired relief piers
  // and a teal frieze continue the rhythm visible in the operator aerial.
  for(const side of [-1,1])for(let i=0;i<5;i++){const x=side*(22+i*10.5);pointedInset(m,x,-.14,6,6.7,17.8,{rim:.46,depth:.34,fill:'#456a6a'});m.box(x-4.05,-.30,3,.7,.64,23.3,P.stone);}
  m.box(0,-.12,26.1,152,.34,.72,'#3b929f');m.box(0,-.35,27.1,153,.7,.6,P.cream);
  // Four extremely slender minarets frame the courtyard rather than the dome block.
  for(const x of [-72,72])for(const y of [-111.5,8.5])minaret(m,x,y);
  // Entry stairs sit within the mapped limit.
  for(let i=0;i<5;i++)m.box(0,-127.2+i*.46,.45*i,29,2.6-i*.27,.45,P.cream);
  return m;
}

function glassBlock(m,x,y,z,w,d,h,{vertical=13,horizontal=26,finSide=true,baseColor='#398796',crown=true}={}){
  // Pane variation is authored local color, not pasted photographic reflection.
  const face=(width,height,cols,rows)=>{
    for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
      const shade=.5+.22*Math.sin(i*1.72+j*.29)+.13*Math.sin(j*.7+i*.18),color=blend(baseColor,'#a2ccd0',Math.max(0,shade)*.28);
      m.material(23,()=>m.quad([-width/2+i*width/cols,0,j*height/rows],[-width/2+(i+1)*width/cols,0,j*height/rows],[-width/2+(i+1)*width/cols,0,(j+1)*height/rows],[-width/2+i*width/cols,0,(j+1)*height/rows],color));
    }
    for(let i=0;i<=cols;i++){const x=-width/2+i*width/cols;m.quad([x-.065,-.12,0],[x+.065,-.12,0],[x+.065,-.12,height],[x-.065,-.12,height],'#6a979a');}
    for(let j=1;j<rows;j++){const z=j*height/rows;m.quad([-width/2,-.13,z],[width/2,-.13,z],[width/2,-.13,z+.12],[-width/2,-.13,z+.12],'#759fa0');}
  };
  m.component([x,y,z],0,()=>{
    m.box(0,0,0,w,d,h,'#53888d');
    m.component([0,-d/2-.06,0],0,()=>face(w,h,vertical,horizontal));
    m.component([w/2+.06,0,0],Math.PI/2,()=>face(d,h,Math.max(6,Math.round(vertical*d/w)),horizontal));
    m.component([0,d/2+.06,0],Math.PI,()=>face(w,h,vertical,horizontal));
    m.component([-w/2-.06,0,0],-Math.PI/2,()=>face(d,h,Math.max(6,Math.round(vertical*d/w)),horizontal));
    if(finSide)for(const side of [-1,1])for(let i=0;i<7;i++)m.box(side*(w/2+.25),-d/2+2+i*(d-4)/6,0,.5,.30,h+1.8,'#bcbfaf');
    if(crown){
      m.box(0,0,h+.05,w,d,1.0,'#b9beb0');
      m.box(0,0,h+1.05,w-2.5,d-2.5,4.6,'#4c6566');
      for(let i=0;i<vertical;i++)m.box(-w/2+(i+.5)*w/vertical,-d/2+1.10,h+1.05,.42,.5,5.6,'#c4c7b8');
    }
  });
}
function mechanicalBand(m,x,y,z,w,d,height=5.5){
  m.box(x,y,z,w+.3,d+.3,height,'#6c7771');
  for(let i=0;i<20;i++)for(const side of [-1,1])m.box(x-w/2+(i+.5)*w/20,y+side*(d/2+.21),z,.28,.42,height,'#c0b99f');
}
// Polygon is the podium outline in local East/North metres, including the
// surveyed notches occupied by the separately mapped tower bases.
const abuPodium=[[-106.571,-21.003],[-44.406,-37.056],[-52.106,-66.878],[-38.041,-72.901],[-23.913,-77.120],[-9.212,-80.148],[5.182,-81.673],[7.655,-72.088],[9.304,-65.709],[11.778,-56.125],[73.391,-72.043],[91.502,-1.923],[71.483,3.253],[51.458,8.419],[68.164,73.096],[53.114,76.981],[35.017,81.656],[31.642,68.598],[24.900,42.471],[21.525,29.414],[-14.284,38.664],[-10.909,51.722],[-4.167,77.838],[-.792,90.896],[-43.721,101.983],[-60.504,36.260],[-71.705,-6.977],[-101.247,-.120]];
function podium(m){
  const flat=abuPodium.flat(),indices=earcut(flat);
  for(let i=0;i<indices.length;i+=3)m.tri(...indices.slice(i,i+3).map(n=>[...abuPodium[n],14.3]),'#d7d3bc');
  for(let i=0;i<abuPodium.length;i++){
    const a=abuPodium[i],b=abuPodium[(i+1)%abuPodium.length],w=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
    m.component([(a[0]+b[0])/2,(a[1]+b[1])/2,0],angle,()=>{
      m.box(0,0,0,w,.62,14.3,'#d3c9b4');
      const n=Math.max(1,Math.round(w/5.8));
      for(let j=0;j<n;j++)planeWindow(m,-w/2+(j+.5)*w/n,-.34,1.0,w/n-.7,9.3,'#3d6470');
      m.box(0,-.4,10.4,w,.55,2.6,'#c6bea9');m.box(0,-.65,13.3,w,.80,1.0,'#e4d9c1');
    });
  }
}
const abuParts=[
  // x,y,width,depth,rotation,total height,glazing columns,rows
  [-66.819,72.778,30.519,67.832,-.234865,50,11,13],
  [-80.910,18.131,30.327,44.664,-.228083,40,11,10],
  [-79.338,-43.941,64.204,30.801,-.252702,60,21,15],
  [39.286,-76.858,63.636,6.588,-.252838,130,20,31],
  [37.225,-84.840,63.636,9.899,-.252838,119,20,28],
  [41.348,-68.876,63.636,9.899,-.252838,111,20,26],
  [69.723,38.199,20.681,66.797,-.252435,125,8,29],
  [89.743,33.029,20.677,66.798,-.253040,121,8,28],
  [5.308,40.568,36.985,13.487,-.252805,63,14,15],
  [15.425,79.747,36.982,13.487,-.252514,138,14,33],
];
function hotelBlock(m,w,d,h,cols,rows){
  // Sheraton's pale stone uprights distinguish it from the glazed towers.
  glassBlock(m,0,0,1,w,d,h-7.6,{vertical:cols,horizontal:rows,baseColor:'#456d78',finSide:false});
  for(const side of [-1,1])for(let i=0;i<=Math.round(d/3.2);i++)m.box(side*(w/2+.22),-d/2+i*d/Math.round(d/3.2),1,.48,.72,h-1,'#d1cabb');
  for(const side of [-1,1])m.box(0,side*(d/2+.18),h-5.5,w,.50,5.5,'#d2ccbb');
}
export function abudhabi(){
  const m=new Mesh();podium(m);
  for(let i=0;i<abuParts.length;i++){
    const [x,y,w,d,angle,h,cols,rows]=abuParts[i];
    m.component([x,y,0],angle,()=>{
      if(i<2){hotelBlock(m,w,d,h,cols,rows);return;}
      glassBlock(m,0,0,1,w,d,h-7.65,{vertical:cols,horizontal:rows,baseColor:i===2?'#357f92':'#408698',finSide:false});
      // Full-height narrow silver fins on the smaller facade are a key silhouette.
      for(const side of [-1,1])for(let j=0;j<6;j++)m.box(side*(w/2+.20),-d/2+.6+j*(d-1.2)/5,1,.46,.38,h-1,'#b9bfb4');
      if(i===2)mechanicalBand(m,0,0,h-5.4,w,d,4.2);
    });
  }
  // The tall, narrow centre slab, anchored to surveyed part1373723368.
  m.component([10.367,60.157,0],-.252805,()=>{
    const w=36.985,d=26.983;
    glassBlock(m,0,0,1,w,d,300.4,{vertical:18,horizontal:74,baseColor:'#438f9f',crown:false,finSide:false});
    for(const z of [108,204.5,281.5])mechanicalBand(m,0,0,z,w,d,z===281.5?7:6.0);
    // Side fins are uninterrupted silver strips; no exaggerated external frame.
    for(const side of [-1,1])for(let j=0;j<9;j++)m.box(side*(w/2+.26),-d/2+.45+j*(d-.9)/8,1,.5,.32,304.7+(j%3)*.45,'#b6c2b8');
    m.box(0,0,301.4,w+1,d+1,.7,'#bfc5b7');
    for(const side of [-1,1])m.box(side*(w/2-.6),0,302.1,1.2,d+1,7.7,'#c9cbbc');
    m.box(0,0,309.8,w+1,d+1,1.2,'#d4cfbb');
    m.box(0,d/2-.8,302.1,w-2,1,7.7,'#516976');
    for(const x of [-9,0,9])m.box(x,-d/2,302.1,.24,.28,7.7,'#b7c5bd');
  });
  // The commercial roof has shallow skylights and raised mechanical pavilions.
  m.component([-15,-28,0],-.252805,()=>{
    for(const x of [-22,12]){m.box(x,0,14.4,23,23,1.8,'#c2c4b2');m.material(23,()=>m.box(x,0,16.2,19.5,19.5,.30,'#8eaba8'));for(let i=-3;i<=3;i++)m.box(x+i*2.6,0,16.5,.10,19.6,.13,'#dee2cc');}
    m.box(5,38,14.4,38,13,3.5,'#c4c4af');for(let i=0;i<6;i++)m.box(-10+i*6,38,17.9,3.5,9,.9,'#9aa69f');
  });
  // Recessed main entrance faces the linear park at the southern curve.
  m.component([-21.5,-76,0],-.252805,()=>{
    m.material(23,()=>m.box(0,0,8.3,27,9,.36,'#87ada9'));
    for(const x of [-12.5,12.5])m.box(x,-3.3,0,.44,.44,8.3,'#c2c6b6');
    m.box(0,1.2,11.2,29,.3,1.0,'#ece7cf');
  });
  return m;
}
