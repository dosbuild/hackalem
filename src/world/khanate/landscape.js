import {toGeo} from './geography.js';
import {OBJECT_FACTOR} from './scale.js';

// Fictional steppe geography. Civic parcels remain on the river plain; relief
// belongs to the surrounding ridges, so existing construction stays grounded.
export const uplands=[
 {id:'north',center:[-.054,.281],radii:[.206,.085],height:.046,seed:2,peaks:[[-.48,-.02,1],[-.05,.18,.89],[.37,.05,.72]]},
 {id:'east',center:[.272,.224],radii:[.068,.098],height:.026,seed:5,peaks:[[-.1,.3,1],[.16,-.35,.7]]},
 {id:'west',center:[-.276,.080],radii:[.040,.092],height:.017,seed:8,peaks:[[.05,-.25,1],[-.1,.34,.82]]},
 {id:'south',center:[-.087,-.204],radii:[.153,.040],height:.010,seed:11,peaks:[[-.5,0,.8],[.04,.12,1],[.57,-.08,.7]]},
];
export function hillHeight(h,x,y){
 const u=(x-h.center[0])/h.radii[0],v=(y-h.center[1])/h.radii[1],r=Math.hypot(u,v);if(r>=1)return 0;
 const edge=(1-r*r)**2;
 const ridge=Math.max(...h.peaks.map(([a,b,k])=>k*Math.exp(-((u-a)**2*9+(v-b)**2*5))));
 const folds=1+.14*Math.sin(u*17+v*9+h.seed)+.08*Math.sin(v*23-u*7);
 return h.height*edge*(.22+.78*ridge)*folds;
}
export const groundHeight=(x,y)=>Math.max(0,...uplands.map(h=>hillHeight(h,x,y)));
export const naturePlaces=[
 ['steppe-herd','Табун у тихой воды',[-.031,-.018],220,0,'Лошади пасутся на речном лугу, жеребёнок держится рядом. Конюх обходит табун, а над водой пролетает стайка птиц.'],
 ['steppe-flock','Отара на степном лугу',[-.242,-.112],210,0,'Овцы и ягнята расходятся по траве, останавливаясь попастись. Пастух обходит стадо, а собака бежит по краю луга.'],
 ['steppe-caravan','Дорога каравана',[.1645,.123],52,0,'Верблюды идут цепочкой, следуя за проводником. На повороте поклажа покачивается, и весь караван ненадолго растягивается.'],
 ['steppe-spring','Родник среди камней',[-.245,-.167],180,7,'Вода собирается в неглубокой чаше. Женщина наполняет кувшин; птицы возвращаются на край, когда шаги затихают.'],
 ['steppe-ridge','Складки Сарыарки',[-.077,.278],24,170,'Тёплый камень, седая трава и длинные складки холмов. Орлы держатся над грядой, почти не двигая крыльями.'],
 ['steppe-willow','Старая ива',[-.145,.210],125,20,'Ствол давно лёг на землю, но ветви снова тянутся вверх. Рядом дети затеяли догонялки, а старик остановился передохнуть.'],
].map(([id,name,point,zoom,focusHeight,description])=>({id,name,shortName:name,point,position:toGeo(point),zoom,heightM:focusHeight,focusHeight,yaw:-.28,pitch:.95,description,nature:true}));

export function rock(m,x,y,z,rx,ry,h,seed=0){
 const n=7,ring=(k)=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2+.12*k,r=(.86+.15*Math.sin(i*3.71+seed))*(k===2?.46:k===1?.95:1);return [x+Math.cos(a)*rx*r,y+Math.sin(a)*ry*r,z+(k===2?h:k===1?h*.57:0)*(1+.13*Math.sin(i*2.8+seed))];});
 const rings=[ring(0),ring(1),ring(2)],colors=['#a59b85','#b9ae95','#968f7c','#c1b399'];
 for(let k=0;k<2;k++)for(let i=0;i<n;i++)m.quad(rings[k][i],rings[k][(i+1)%n],rings[k+1][(i+1)%n],rings[k+1][i],colors[(i+seed+k)%4]);
 for(let i=1;i<n-1;i++)m.tri(rings[2][0],rings[2][i],rings[2][i+1],colors[(seed+1)%4]);
}
export function landscapeMesh(m){
 m.at([0,0,0]);m.kind=26;
 for(const h of uplands){
  const rings=32,sides=112,points=[],normals=[];
  for(let j=0;j<=rings;j++){points[j]=[];normals[j]=[];for(let i=0;i<=sides;i++){
   const a=i/sides*Math.PI*2,r=j/rings,x=h.center[0]+Math.cos(a)*h.radii[0]*r,y=h.center[1]+Math.sin(a)*h.radii[1]*r,z=hillHeight(h,x,y),d=.00015;
   const n=[-(hillHeight(h,x+d,y)-hillHeight(h,x-d,y))/(2*d),-(hillHeight(h,x,y+d)-hillHeight(h,x,y-d))/(2*d),1],l=Math.hypot(...n);
   points[j][i]=[x,y,z+.000025];normals[j][i]=n.map(v=>v/l);
  }}
  for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){
   const a=points[j][i],b=points[j+1][i],c=points[j+1][i+1],d=points[j][i+1];
   const color='#b2a184';
   m.tri(a,b,c,color,[normals[j][i],normals[j+1][i],normals[j+1][i+1]]);if(j)m.tri(a,c,d,color,[normals[j][i],normals[j+1][i+1],normals[j][i+1]]);
  }
  // Weathered outcrops follow the same analytic height as their slopes.
  m.kind=8;for(let i=0;i<18;i++){const a=i*2.399+h.seed,r=.12+(i%7)*.072,x=h.center[0]+Math.cos(a)*h.radii[0]*r,y=h.center[1]+Math.sin(a)*h.radii[1]*r,z=hillHeight(h,x,y);rock(m,x,y,z-.00035,.002+(i%3)*.0009,.0014+(i%4)*.0005,.0015+(i%5)*.001,i+h.seed);}
  m.kind=26;
 }
 // A split wind-worn stone above the western path.
 m.kind=8;rock(m,-.259,.114,groundHeight(-.259,.114),.0034,.0028,.009,4);rock(m,-.254,.115,groundHeight(-.254,.115),.0018,.002,.006,6);
 // Spring: a shallow mineral bowl with a wet inner shelf, not a bright blue icon.
 const [sx,sy]=[-.241,-.164];
 const shoreline=(a,r=1)=>{const lobes=1+.13*Math.sin(a*3+.7)+.08*Math.sin(a*5);return[sx+Math.cos(a)*.0063*lobes*r,sy+Math.sin(a)*.0042*lobes*r];};
 m.kind=8;for(let i=0;i<48;i++){const a=i/48*Math.PI*2,b=(i+1)/48*Math.PI*2;m.quad([...shoreline(a),.00010],[...shoreline(a,1.4),.00002],[...shoreline(b,1.4),.00002],[...shoreline(b),.00010],'#a7ae90');}
 m.kind=1;for(let i=0;i<48;i++)m.tri([sx,sy,.00014],[...shoreline(i/48*Math.PI*2),.00014],[...shoreline((i+1)/48*Math.PI*2),.00014],'#719797');
 m.kind=8;for(const [x,y,rx,ry,h,k] of [[-.007,.003,.0025,.0017,.0021,2],[-.004,.005,.0019,.0014,.0033,3],[.001,.0058,.0022,.0015,.0018,4],[.004,.005,.0011,.0013,.0014,5],[.007,.001,.0017,.0013,.0011,6],[-.009,0,.0013,.0014,.0013,7],[.007,-.003,.001,.001,.0007,8],[-.005,-.004,.0018,.0011,.0008,9]])rock(m,sx+x,sy+y,0,rx,ry,h,k);
 // Reeds follow the wetter bank, leaving a clear place to kneel for water.
 for(let i=0;i<18;i++){const a=.2+i/18*2.3,[x,y]=shoreline(a,1.13);for(let j=0;j<3;j++)m.beam([x+j*.0001*OBJECT_FACTOR,y,0],[x+.0002*OBJECT_FACTOR,y,(.0010+(i%4)*.0002)*OBJECT_FACTOR],.000025*OBJECT_FACTOR,'#9d9e79',4);}
 // Fallen willow: exposed roots, a silver trunk, living branches and a resting stone.
 const [wx,wy]=[-.144,.214];m.kind=8;
 m.beam([wx-.006,wy,.0006],[wx+.001,wy+.001,.001],.00085,'#968a6c',11);m.beam([wx+.001,wy+.001,.001],[wx+.007,wy+.003,.0005],.00063,'#a29473',9);
 for(let i=0;i<6;i++){const a=i*1.1;m.beam([wx-.006,wy,.0006],[wx-.009+Math.cos(a)*.002,wy+Math.sin(a)*.003,.00025],.00024,'#8b8065',5);}
 for(const [x,y,z] of [[.001,.001,.006],[.004,.002,.0055],[-.002,-.001,.004]]){
  const cx=wx+x-.001,cy=wy+y;
  m.beam([wx+x,wy+y,.0007],[cx,cy,z],.00028,'#92876c',6);
  m.ellipsoid(cx,cy,z,.0023,.0021,.0009,'#8d9e7c',11,6);
  // Fine curved sprays taper toward the ground; overlapping leaf blades keep
  // the silhouette light instead of making each hanging branch a solid tube.
  for(let j=0;j<15;j++){
   const a=j/15*Math.PI*2,dx=Math.cos(a),dy=Math.sin(a),length=.0021+(j%4)*.0003;
   let previous=[cx+dx*.0011,cy+dy*.0011,z+.0001];
   for(let k=0;k<7;k++){
    const f=(k+1)/7,r=.0011+.0015*Math.sin(f*Math.PI*.62),point=[cx+dx*r,cy+dy*r,z-length*f];
    m.beam(previous,point,.000025,'#8b8d68',4);
    for(const side of [-1,1]){
     const width=.00027*(1-f*.65),tip=[point[0]-dy*side*width,point[1]+dx*side*width,point[2]-.00045];
     m.tri([point[0]-dx*.00006,point[1]-dy*.00006,point[2]+.0001],[point[0]+dx*.00006,point[1]+dy*.00006,point[2]+.0001],tip,k%2?'#819574':'#92a27e');
    }
    previous=point;
   }
  }
 }
 rock(m,wx-.006,wy-.006,0,.002,.0015,.001,2);
 // Feather-grass islands, low sage and tiny ochre flowers gather around
 // water and shelter. Every blade is physical geometry with native occlusion.
 for(const [cx,cy,rx,ry] of [[-.030,-.014,.018,.014],[-.243,-.111,.019,.014],[-.241,-.164,.018,.014],[-.144,.214,.017,.012]]){
  for(let i=0;i<72;i++){const a=i*2.399,r=Math.sqrt((i+.5)/72),x=cx+Math.cos(a)*rx*r,y=cy+Math.sin(a)*ry*r;
   if(Math.hypot((x+.241)/.0072,(y+.164)/.0049)<1.2)continue;
   const z=groundHeight(x,y)+.00003;
   for(let j=0;j<4;j++){const b=a+j*1.7,dx=Math.cos(b)*.00034*OBJECT_FACTOR,dy=Math.sin(b)*.00034*OBJECT_FACTOR,h=(.00043+(i%4)*.00011)*OBJECT_FACTOR;m.tri([x-.000035*OBJECT_FACTOR,y,z],[x+.000035*OBJECT_FACTOR,y,z],[x+dx,y+dy,z+h],i%3?'#9ca383':'#c1b28b');}
   if(i%11===0){m.ellipsoid(x,y,z+.00023*OBJECT_FACTOR,.00058*OBJECT_FACTOR,.00048*OBJECT_FACTOR,.00039*OBJECT_FACTOR,'#95a081',7,4);for(let j=0;j<3;j++)m.ellipsoid(x+(j-1)*.00020*OBJECT_FACTOR,y,z+.00063*OBJECT_FACTOR,.00010*OBJECT_FACTOR,.00010*OBJECT_FACTOR,.00008*OBJECT_FACTOR,'#c2ab74',5,3);}
  }
 }
 // Drifts and a few large river stones create readable clusters, not confetti.
 for(const [cx,cy] of [[-.080,-.006],[.004,.027],[.145,.106]])for(let i=0;i<7;i++){const a=i*2.399,r=.001+i*.00075;rock(m,cx+Math.cos(a)*r,cy+Math.sin(a)*r,0,(.0007+(i%3)*.0004)*OBJECT_FACTOR,.0006*OBJECT_FACTOR,(.0005+(i%2)*.0004)*OBJECT_FACTOR,i);}
}
