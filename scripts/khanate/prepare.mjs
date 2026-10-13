import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import earcut from 'earcut';
import {Mesh} from '../../src/world/mesh-kit.js';
import {encodeMapWire} from '../../src/world/map-wire.js';
import {softenContour} from '../alem/terrain.mjs';
import {PALETTE,DISTRICT_PALETTE} from '../../src/design/palette.js';
import {quarters,districts,anchors,placements,river,apron,landmarks,toGeo} from '../../src/world/khanate/geography.js';
import {householdCourts,paths,smoothPath,courtCenter} from '../../src/world/khanate/settlement.js';
import {landscapeMesh,groundHeight} from '../../src/world/khanate/landscape.js';
import {landmarkModel} from '../../src/world/khanate/landmark-models.js';
import {makeTemplate} from '../../src/world/khanate/models.js';
import {projectMesh,crossingFamilyView} from '../../src/world/khanate/projects.js';
import {OBJECT_UNIT,OBJECT_FACTOR,ANIMAL_FACTOR,HOME_FORMATION,meshBounds} from '../../src/world/khanate/scale.js';
import {lifePopulation} from '../../src/world/khanate/life.js';
import {inPolygon,corridor,pointSegment} from '../../src/world/placement-geometry.js';

const out=new URL('../../public/khanate/',import.meta.url),write=!process.argv.includes('--check');if(write)await mkdir(out,{recursive:true});
const mesh=new Mesh();
function fill(ring,color,z,kind){mesh.at([0,0,0]);mesh.kind=kind;const ids=earcut(ring.flat());for(let i=0;i<ids.length;i+=3)mesh.tri([...ring[ids[i]],z],[...ring[ids[i+1]],z],[...ring[ids[i+2]],z],color);}
const edge=softenContour(apron,3);fill(edge,'#b5b99b',-.00005,21);
mesh.kind=20;for(let i=0;i<edge.length;i++){const a=edge[i],b=edge[(i+1)%edge.length];mesh.quad([...a,-.0017],[...b,-.0017],[...b,-.0004],[...a,-.0004],'#98a28a');mesh.quad([...a,-.0004],[...b,-.0004],[...b,-.00005],[...a,-.00005],'#bdba9c');}
for(const q of quarters)fill(q.polygon,DISTRICT_PALETTE[q.id],0,10);
const groundCount=mesh.bytes/20;
mesh.kind=0;mesh.ribbon(river,.034,'#acb596',1,.000025);mesh.ribbon(river,.022,'#a4ae99',1,.00005);mesh.kind=1;mesh.ribbon(river,.013,PALETTE.water,1,.0001);
const distanceToRiver=p=>{let best=Infinity;for(let i=1;i<river.length;i++){const a=river[i-1],b=river[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));best=Math.min(best,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));}return best;};
// Ground layers share one depth policy. Remove dirt geometry over water rather
// than attempting to hide it with a height offset that the shared pass ignores.
function landRibbon(points,width,color,z){let section=[];const flush=()=>{if(section.length>1)mesh.ribbon(section,width,color,1,z);section=[];};for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.00045);for(let j=0;j<=steps;j++){const p=[a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps];if(distanceToRiver(p)>.0065+width/2)section.push(p);else flush();}}flush();}
const roads=paths.map(p=>smoothPath(p));
for(const road of roads){mesh.kind=0;landRibbon(road,.0010,'#cbbd9f',.00007);mesh.kind=4;landRibbon(road,.00045,'#d1c3a5',.00008);}
landscapeMesh(mesh);
const measuredLandmarks=landmarks.map(landmark=>{const model=new Mesh();landmarkModel(model,landmark);const bounds=meshBounds(model.pack());landmarkModel(mesh,landmark);return {...landmark,heightM:(bounds.max[2]-.00006)*12000,focusHeight:(bounds.center[2]-.00006)*12000,focusPosition:toGeo(bounds.center),zoom:Math.min(280,Math.max(65,1.3/Math.max(...bounds.extent.slice(0,2)))),bounds};});
const siteViews=Object.fromEntries(Object.entries(placements).map(([key,site])=>{
 const object={...site,proposal:false},bounds=meshBounds(projectMesh([object],false,{seconds:4,zoom:280})),focus=site.id==='M2'?meshBounds(projectMesh([object],false,{seconds:4,zoom:280,crossingPlaceOnly:true})):site.id==='M11'?crossingFamilyView(site):null;
 // A connecting ground spur remains in the full model bounds. Only the
 // measured keeper, waiting lanes and cart determine its useful close scale.
 // The long family crossing likewise keeps both banks in its full model,
 // while its west approach and existing people determine the primary view.
 return [key,{...bounds,zoom:site.route?30:Math.min(280,Math.max(65,1.2/Math.max(...(focus??bounds).extent.slice(0,2)))),...(focus?{focus}:{})}];
}));

const groups=new Map(),clearance=landmarks.map(l=>({point:l.point,radius:['khan','grand-mosque'].includes(l.id)?.013:.010}));
const reserved=Object.values(placements).filter(p=>['M4','M7','M8','M9','M13'].includes(p.id));
function group(kind,variant,district){const key=`${kind}-${variant}-${district}`;if(!groups.has(key))groups.set(key,{id:key,kind,variant,district,transforms:[],bounds:[Infinity,Infinity,-Infinity,-Infinity,Infinity,-Infinity],buildings:0});return groups.get(key);}
const templateBounds=new Map();
function instance(kind,variant,district,x,y,scale,angle=0,{membershipPoint=[x,y]}={}){if(kind==='tree'&&Math.hypot(membershipPoint[0]+.031,membershipPoint[1]+.019)<.013)return;scale*=kind==='keeper'?1:['horse','camel'].includes(kind)?ANIMAL_FACTOR:OBJECT_FACTOR;const g=group(kind,variant,district);g.transforms.push(x,y,.00006,scale,angle,1,1,1);const key=`${kind}:${variant}`;if(!templateBounds.has(key))templateBounds.set(key,meshBounds(makeTemplate(kind,variant)));const bounds=templateBounds.get(key),c=Math.cos(angle),s=Math.sin(angle);for(const xx of [bounds.min[0],bounds.max[0]])for(const yy of [bounds.min[1],bounds.max[1]]){const px=x+(xx*c-yy*s)*scale,py=y+(xx*s+yy*c)*scale;g.bounds[0]=Math.min(g.bounds[0],px);g.bounds[1]=Math.min(g.bounds[1],py);g.bounds[2]=Math.max(g.bounds[2],px);g.bounds[3]=Math.max(g.bounds[3],py);}g.bounds[4]=Math.min(g.bounds[4],.00006+bounds.min[2]*scale);g.bounds[5]=Math.max(g.bounds[5],.00006+bounds.max[2]*scale);if(kind==='yurt')g.buildings++;}
const keeperProps={baiterek:2,khan:1,akorda:0,palace:0,expo:3,hazret:4,opera:5,arch:5,concert:5,atyrau:4,abudhabi:6,'grand-mosque':0,'esil-bridges':1,lrt:5};
for(const landmark of landmarks)for(let i=0;i<3;i++)instance('keeper',keeperProps[landmark.id],landmark.id,landmark.point[0]+(i-1)*.00055,landmark.point[1]-(landmark.id==='akorda'?.006*OBJECT_FACTOR:['atyrau','esil-bridges'].includes(landmark.id)?.012:.0035*OBJECT_FACTOR),1,i*.35);
const waterCorridors=river.slice(1).map((p,i)=>[corridor(river[i],p,.018)]);
const free=p=>groundHeight(...p)<.00012&&!waterCorridors.some(r=>inPolygon(p,r))&&!clearance.some(r=>Math.hypot(p[0]-r.point[0],p[1]-r.point[1])<r.radius)&&!reserved.some(r=>Math.hypot(p[0]-r.origin[0],p[1]-r.origin[1])<.014);
let buildings=0;
const nearestPath=point=>{let best={point:point,distance:Infinity};for(const road of roads)for(let i=1;i<road.length;i++){const a=road[i-1],b=road[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy))),p=[a[0]+t*dx,a[1]+t*dy],distance=Math.hypot(point[0]-p[0],point[1]-p[1]);if(distance<best.distance)best={point:p,distance};}return best;};
// Membership is determined at the original accepted positions above. Composition
// changes move those same homes/props; they never silently filter away a household.
const placedHomes=[],homeMembership=[],courtRecords=[];
const solidSites=Object.values(placements).filter(p=>!p.route&&p.id!=='M11').map(p=>siteViews[p.key].focus??siteViews[p.key]);
const isFreeHome=(p,q,radius)=>inPolygon(p,[q.polygon])&&groundHeight(...p)<.00012&&distanceToRiver(p)>.0065+radius&&nearestPath(p).distance>.0005+radius&&!lifePopulation.some(a=>!['bird','eagle'].includes(a.kind)&&a.route.some((point,i)=>i&&pointSegment(p,a.route[i-1],point)<radius+a.scale*4))&&!solidSites.some(b=>p[0]>b.min[0]-radius&&p[0]<b.max[0]+radius&&p[1]>b.min[1]-radius&&p[1]<b.max[1]+radius)&&!measuredLandmarks.some(l=>p[0]>l.bounds.min[0]-radius&&p[0]<l.bounds.max[0]+radius&&p[1]>l.bounds.min[1]-radius&&p[1]<l.bounds.max[1]+radius)&&!placedHomes.some(h=>Math.hypot(p[0]-h.point[0],p[1]-h.point[1])<radius+h.radius);
function placeHome(proposed,q,radius,seed){for(let i=0;i<180;i++){const distance=i===0?0:.00045*Math.sqrt(i),angle=seed*.73+i*2.399,point=[proposed[0]+Math.cos(angle)*distance,proposed[1]+Math.sin(angle)*distance];if(isFreeHome(point,q,radius)){placedHomes.push({point,radius,repaired:i>0});return point;}}throw Error(`No grounded collision-free home placement in ${q.id}`);}
for(const [qi,q] of quarters.entries()){
 for(const [cluster,[cx,cy,count,radius,turn]] of householdCourts[q.id].entries()){
  const center=courtCenter(q,[cx,cy],cluster),join=nearestPath(center).point;
  courtRecords.push({district:q.id,cluster,original:[cx,cy],center});
  mesh.at([0,0,0]);mesh.kind=4;landRibbon(smoothPath([center,[(center[0]+join[0])*.5+.00025,(center[1]+join[1])*.5],join]),.00024,'#c2b597',.00008);
  for(let home=0;home<count;home++){
   const b=(home/count)*Math.PI*1.65+turn,spread=radius*(.90+(home%3)*.08),point=[cx+Math.cos(b)*spread,cy+Math.sin(b)*spread*.8];
   if(!inPolygon(point,[q.polygon])||!free(point)||nearestPath(point).distance<.0036)continue;
   const proposed=[center[0]+(point[0]-cx)*HOME_FORMATION,center[1]+(point[1]-cy)*HOME_FORMATION],scale=.00024+(home%3)*.000022,placed=placeHome(proposed,q,scale*OBJECT_FACTOR*17.5,qi*1000+cluster*10+home);
   instance('yurt',(home+cluster+qi)%3,q.id,...placed,scale,b-Math.PI/2);buildings++;
   homeMembership.push({id:`${q.id}:${cluster}:${home}`,district:q.id,cluster,home,original:point,proposed,position:placed,orientation:b-Math.PI/2,variant:(home+cluster+qi)%3,repaired:placed[0]!==proposed[0]||placed[1]!==proposed[1]});
   mesh.at([0,0,0]);mesh.kind=4;landRibbon([placed,center],.00018,'#c1b699',.00008);
  }
  if(cluster%3===1&&free([cx,cy]))instance('well',0,q.id,...center,.00023);
  if(cluster%2===0&&q.id!=='nura'){
   for(let i=0;i<3;i++){const p=[cx-radius*.7-i*.0028,cy+radius*.8];if(free(p))instance('tree',(i+qi)%3,q.id,center[0]+(p[0]-cx)*HOME_FORMATION,center[1]+(p[1]-cy)*HOME_FORMATION,.00022+i*.000025,0,{membershipPoint:p});}
  }
  if(q.id==='almaty'&&cluster%2===0){mesh.at([...center,.00006],turn,OBJECT_UNIT);mesh.kind=8;for(const x of [-5,5]){mesh.box(x,0,0,.3,.3,5,'#92775a');mesh.box(x,5,0,.3,.3,5,'#92775a');}mesh.quad([-5,0,4.5],[5,0,4.5],[5,5,5.4],[-5,5,5.4],cluster%3?'#917569':'#657d7b');mesh.box(0,2.5,1.6,6,2.5,.22,'#92775a');mesh.box(-1.6,2.5,1.85,1.6,1.2,.16,PALETTE.textile);}
 }
}
// Small shared working places sit inside occupied courts, beside the walking
// line. These are authored ordinary objects, not additional building instances.
const courtLife=[],workingPlaces=[];
for(const court of courtRecords){
 const homes=homeMembership.filter(h=>h.district===court.district&&h.cluster===court.cluster);if(!homes.length)continue;
 const quarter=quarters.find(q=>q.id===court.district),radius=.0011;
 let workplace;
 for(let i=0;i<180;i++){const distance=i===0?0:.0004*Math.sqrt(i),angle=court.cluster*.73+i*2.399,point=[court.center[0]+Math.cos(angle)*distance,court.center[1]+Math.sin(angle)*distance];if(isFreeHome(point,quarter,radius)&&!workingPlaces.some(p=>Math.hypot(point[0]-p[0],point[1]-p[1])<radius*2)){workplace=point;break;}}
 if(!workplace)throw Error(`No grounded free work place in ${court.district}:${court.cluster}`);workingPlaces.push(workplace);
 const [x,y]=workplace,period=28+court.cluster%4*3;
 courtLife.push({id:`court-${court.district}-${court.cluster}`,district:court.district,cluster:court.cluster,workplace,route:[[x-.00055,y-.00045],[x+.00030,y-.00035],[x+.00036,y+.00024]],period,offset:court.cluster*3});
 if(court.district==='esil'&&[8,9,10].includes(court.cluster))courtLife.push({id:`court-esil-${court.cluster}-neighbour`,district:'esil',cluster:court.cluster,route:[[x-.00035,y+.00040],[x-.00044,y-.00028]],period:31,offset:court.cluster*5});
 mesh.at([0,0,0]);mesh.kind=4;landRibbon([court.center,workplace],.00018,'#c1b699',.00008);
 mesh.at([x+.00038,y+.00066,.00006],-.12,OBJECT_UNIT);mesh.kind=8;
 // Low table, woven work mat, vessels and a timber drying rail.
 mesh.box(0,-1.7,.02,8,4,.05,PALETTE.textile);for(const yy of [-3.2,-.2])mesh.box(0,yy,.08,7,.10,.025,PALETTE.brass);
 for(const xx of [-2,2])for(const yy of [0,2])mesh.box(xx,yy,0,.28,.28,2.1,'#92775a');mesh.box(0,1,2.1,5,3,.22,'#a48b67');
 mesh.cylinder(-1.2,1,2.32,.65,.85,'#bb8e68',9,.52);mesh.cylinder(1.2,1.2,2.32,.52,.7,'#92775a',9,.65);
 for(const xx of [-3.5,3.5])mesh.box(xx,4.5,0,.23,.23,5.1,'#92775a');mesh.beam([-3.7,4.5,5.1],[3.7,4.5,5.1],.20,'#695743',6);
 mesh.quad([-2.6,4.5,4.8],[1.3,4.5,4.8],[1.1,4.6,1.4],[-2.4,4.6,1.3],court.cluster%2?'#c2b18f':'#a18071');
}
// Connected riverside vegetation ties the quarters together. Clumps have clear
// silhouettes and quiet ground washes rather than isolated visual confetti.
for(let i=3;i<river.length-3;i+=5)for(const side of [-1,1]){
 const center=[river[i][0],river[i][1]+side*.012];
 for(let j=0;j<7;j++){const a=j*2.399+i,r=.003+j*.0011,p=[center[0]+Math.cos(a)*r*1.4,center[1]+Math.sin(a)*r];if(free(p)&&nearestPath(p).distance>.003)instance('tree',(i+j)%3,'esil',...p,.00026+(j%3)*.00005);}
}
// Pastoral shade and gardens use deliberately uneven, open groups.
for(const [cx,cy,rx,ry] of [[-.187,.082,.025,.026],[-.070,.106,.027,.018],[-.138,.182,.021,.017],[-.232,-.075,.010,.020],[.214,-.065,.012,.030],[.086,-.135,.014,.013]]){
 const patch=Array.from({length:22},(_,j)=>{const a=j/22*Math.PI*2;return [cx+Math.cos(a)*rx*(1+.08*Math.sin(j*2)),cy+Math.sin(a)*ry];});fill(patch,'#adb597',.00004,0);
 for(let j=0;j<14;j++){const a=j*2.399,r=Math.sqrt((j+.5)/14),p=[cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r];if(free(p)&&nearestPath(p).distance>.004)instance('tree',j%3,'saryarka',...p,.00023+(j%4)*.00003);}
}
for(let i=0;i<7;i++){instance(i%3===0?'cart':'camel',0,'baikonur',.204+i*.0054,.138+i*.0024,.00032,-1.1);}
for(const [i,p] of [[-.163,-.07],[-.179,-.113],[.154,.12],[.086,.125]].entries())instance('horse',0,i<2?'nura':'baikonur',...p,.00030,-.6);
// Sparse riverside reeds are geometry, with no texture download or transparency sort.
mesh.at([0,0,0]);mesh.kind=8;for(let i=1;i<river.length-1;i+=3)for(const side of [-1,1])for(let j=0;j<5;j++){
 const p=[river[i][0]+j*.0014,river[i][1]+side*(.008+.001*(j%2)),.00006];
 for(let k=0;k<3;k++)mesh.beam(p,[p[0]+(k-1)*.00015*OBJECT_FACTOR,p[1]+.00010*OBJECT_FACTOR,p[2]+(.0007+(k%2)*.0003)*OBJECT_FACTOR],.000024*OBJECT_FACTOR,'#9a9b72',4);
}
const packed=mesh.pack(),packedView=new DataView(packed);
for(let at=0;at<packed.byteLength;at+=20)for(let axis=0;axis<3;axis++)if(!Number.isFinite(packedView.getFloat32(at+axis*4,true)))throw Error(`Invalid historical geometry at vertex ${at/20}`);
const wire=encodeMapWire(packed),bytes=new Uint8Array(wire),sha256=createHash('sha256').update(bytes).digest('hex'),file=`map-${sha256.slice(0,20)}.bin`;
if(write)await writeFile(new URL(file,out),bytes);
const instances=[...groups.values()];if(buildings!==188||instances.reduce((n,g)=>n+g.transforms.length/8,0)!==420)throw Error('Historical household/instance membership changed');
const metadata={url:`khanate/${file}`,bytes:packed.byteLength,sha256:createHash('sha256').update(new Uint8Array(packed)).digest('hex'),transport:{file,bytes:bytes.length,sha256,vertexBytes:packed.byteLength},residentBytes:packed.byteLength,stride:20,vertices:packed.byteLength/20,groundCount,tiles:[],buildingFeatures:buildings,counts:{buildings,yurts:buildings,landmarks:14},landmarks:measuredLandmarks,projection:'Shared local planar camera; original fictional settlement',environment:{trees:instances.filter(g=>g.kind==='tree').reduce((n,g)=>n+g.transforms.length/8,0)},terrain:{edge:'authored-continuous-contour',relief:'four-native-steppe-ridges',naturalPlaces:6}};
const bootstrap={metadata,districts,anchors,instances,courtLife};
if(write){await writeFile(new URL('../../src/world/khanate/bootstrap.json',import.meta.url),JSON.stringify(bootstrap)+'\n');await writeFile(new URL('geometry.json',out),JSON.stringify(metadata,null,2));await writeFile(new URL('../../src/world/khanate/site-views.json',import.meta.url),JSON.stringify(siteViews)+'\n');await writeFile(new URL('../../src/world/khanate/settlement-layout.json',import.meta.url),JSON.stringify({courts:courtRecords,homes:homeMembership})+'\n');}
console.log(JSON.stringify({baseBytes:packed.byteLength,baseVertices:metadata.vertices,yurts:buildings,instanceGroups:instances.length,instances:instances.reduce((n,g)=>n+g.transforms.length/8,0),repairedHomes:homeMembership.filter(h=>h.repaired).length,write},null,2));
