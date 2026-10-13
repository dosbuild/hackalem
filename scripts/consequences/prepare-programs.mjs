/** Derived, source-vetted presentation data. No record participates in evaluation. */
import {writeFile} from 'node:fs/promises';
import {mapXY} from '../../src/world/city-math.js';
import {bounds,rectangle,corridor,inPolygon,distance,pointSegment,polygonTouches,spatialIndex,overlaps,routeAt} from '../../src/world/placement-geometry.js';
import {readSource,METRE as U,geographic} from './program-source.mjs';
const source=await readSource(),{features,roads,buildings,bootstrap,placements,clear}=source;
const PARKS={esil:['1196402246','1456208624'],almaty:['243930491','243930492','243930493'],saryarka:['885788799','885788800','885788801'],baikonur:['1428964223','500220321'],nura:['1526900307','1534678435']};
const records={},occupied=[],z=.00004;
const roadIndex=spatialIndex(roads.filter(r=>r.walk||r.major));
const homeIndex=spatialIndex(buildings.filter(b=>['apartments','residential','house','detached','terrace'].includes(b.tags.building)));
const feature=id=>features.get('greenway/'+id);
const free=(ring,d,options={})=>{const b=bounds(ring);return clear(ring,d,options)&&!occupied.some(item=>overlaps(b,item.bounds)&&polygonTouches([ring],[item.ring],.25*U));};
const reserve=(ring,key)=>occupied.push({ring,key,bounds:bounds(ring)});
function people(origin,angle=0,count=4){return Array.from({length:count},(_,i)=>{const x=(i%2?1:-1)*3,y=-11-Math.floor(i/2)*2,c=Math.cos(angle),s=Math.sin(angle);return {position:[origin[0]+(x*c-y*s)*U,origin[1]+(x*s+y*c)*U,z],angle};});}
function clearPeople(parent,d,point,angle=0){const found=[];for(const r of [6,9,13,18,25])for(let j=0;j<12&&found.length<4;j++){const a=angle+j*Math.PI/6,p=[point[0]+Math.cos(a)*r*U,point[1]+Math.sin(a)*r*U];if(clear(rectangle(p,.7*U,.7*U),d,{ignore:[parent.key]})&&found.every(q=>distance(q.position,p)>2*U))found.push({position:[...p,z],angle:a});}return found;}
function vettedFurniture(parent,d){const f=parent.furniture||[],used=new Set(parent.id==='M10'?Array.from({length:Math.min(18,f.length)},(_,i)=>Math.round(i/Math.max(1,Math.min(18,f.length)-1)*(f.length-1))):(parent.id==='M1'?[.18,.38,.62,.82]:parent.id==='M14'?[.16,.5,.84]:[.2,.5,.8]).map(t=>Math.round((f.length-1)*t)));return f.map((q,i)=>{if(!used.has(i))return {...q,unused:true};const width=parent.id==='M1'?12:parent.id==='M14'?10:parent.id==='M10'?4:5,height=parent.id==='M14'?6:parent.id==='M1'?5:parent.id==='M10'?1.5:3.5,offset=parent.id==='M1'?1:parent.id==='M10'?1.5:0,foot=p=>rectangle([p[0]+Math.cos(q.angle)*offset*U,p[1]+Math.sin(q.angle)*offset*U],width*U,height*U,q.angle);let point=q.point,ring=foot(point);if(!free(ring,d,{ignore:[parent.key]})){let found=null;for(const r of [3,6,9,14,20,28,36,48]){for(let j=0;j<16;j++){const a=j*Math.PI/8,p=[q.point[0]+Math.cos(a)*r*U,q.point[1]+Math.sin(a)*r*U],footprint=foot(p);if(free(footprint,d,{ignore:[parent.key]})){found={p,footprint};break;}}if(found)break;}if(!found){for(const alternative of f.slice().sort((a,b)=>distance(a.point,q.point)-distance(b.point,q.point))){const footprint=foot(alternative.point);if(free(footprint,d,{ignore:[parent.key]})){found={p:alternative.point,footprint};break;}}}if(!found)throw Error('No clear fixture '+parent.key+'/'+i);point=found.p;ring=found.footprint;}reserve(ring,parent.key);return {...q,point,footprint:ring,source:parent.source};});}
function site(parent,key,kind,origin,size,label,extra={}){return {key:parent.key+':'+key,id:parent.id,district:parent.district,parentKey:parent.key,kind,label,origin:[origin[0],origin[1],z],position:geographic(origin),orientation:0,size:size.map(n=>n*U),peopleSpots:[],...extra};}
function parkArea(parent,d,id,index){
 const f=feature(id);if(!f)throw Error('Missing park '+id);const rings=f.geometry.coordinates.map(r=>r.slice(0,-1).map(mapXY)),b=bounds(rings[0]),origin=[(b[0]+b[2])/2,(b[1]+b[3])/2],items=[];
 const area=site(parent,'area-'+id,'park-area',origin,[(b[2]-b[0])/U,(b[3]-b[1])/U],f.properties.tags?.name||'Сад и прогулочные места',{source:f.id,rings,orientation:0,focusBounds:[b[0],b[1],b[2],b[3]],items:[]});
 let i=0;
 // The regular sampling covers the complete usable polygon. Every individual
 // planting/furniture patch is checked; mapped paths, water and buildings stay.
 const step=(b[2]-b[0])*(b[3]-b[1])>.002?30:12;
 for(let x=b[0]+5*U;x<b[2];x+=step*U)for(let y=b[1]+5*U;y<b[3];y+=step*U){
  const variant=(i++*7+index*3)%12,p=[x+(i%3-1)*2*U,y+(i%5-2)*U];let kind=variant<5?'grove':variant<8?'meadow':variant<10?'garden':'seating',radius=kind==='grove'?7:kind==='seating'?5:11,ring=rectangle(p,radius*2*U,radius*2*U);
  if(!ring.every(q=>inPolygon(q,rings))||!free(ring,d)){kind=variant%3===0?'seating':variant%3===1?'garden':'meadow';radius=kind==='seating'?2:3;ring=rectangle(p,radius*2*U,radius*2*U);if(!ring.every(q=>inPolygon(q,rings))||!free(ring,d))continue;}
  items.push({key:area.key+':'+items.length,kind,point:[...p,z],radius:radius*U,variant,footprint:ring});reserve(ring,area.key);
 }
 // Existing paths are source-supported access. Add tiny entrance furniture
 // only in clear pockets beside paths; the source path itself is untouched.
 const paths=roads.filter(r=>r.walk&&r.points.some(p=>inPolygon(p,rings)));
 area.paths=paths.map(r=>({source:r.id,points:r.points.filter(p=>inPolygon(p,rings))})).filter(r=>r.points.length>1);
 for(const r of paths){for(const p of r.points.filter(p=>inPolygon(p,rings))){if(area.entrances?.length>=6)break;const q=[p[0]+6*U,p[1]],ring=rectangle(q,5*U,4*U);if(!ring.every(v=>inPolygon(v,rings))||!free(ring,d))continue;(area.entrances??=[]).push({key:area.key+':entrance-'+area.entrances.length,kind:'entrance',point:[...q,z],source:r.id,footprint:ring});reserve(ring,area.key);}}
 area.items=items;area.peopleSpots=items.filter(q=>q.kind==='seating'||q.kind==='meadow').map(q=>({position:[q.point[0],q.point[1]-(q.kind==='seating'?1.5*U:0),z],angle:0})).filter(q=>clear(rectangle(q.position,.7*U,.7*U),d)).slice(0,8);
 return area;
}
function closestPath(point,max=140*U){let best=null;for(const r of roadIndex([point[0]-max,point[1]-max,point[0]+max,point[1]+max]))for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1))),q=[a[0]+t*dx,a[1]+t*dy],dist=distance(point,q);if(dist<max&&(!best||dist<best.distance))best={point:q,source:r.id,distance:dist,segment:[a,b],walk:r.walk};}return best;}
function neighborhoodCandidates(parent,d,w=40,h=36){
 const candidates=[],clusters=new Set(),homes=buildings.filter(b=>['apartments','residential','house','detached','terrace'].includes(b.tags.building)).filter(b=>{const c=[(b.bounds[0]+b.bounds[2])/2,(b.bounds[1]+b.bounds[3])/2],key=Math.floor(c[0]/(100*U))+'/'+Math.floor(c[1]/(100*U));if(clusters.has(key))return false;clusters.add(key);return true;});
 for(const home of homes){const hb=home.bounds,c=[(hb[0]+hb[2])/2,(hb[1]+hb[3])/2];if(!clear(rectangle(c,1*U,1*U),d,{ignore:[home.id],vegetationToo:false,reservationsToo:false}))continue;
  for(const metres of [65,95,130])for(let j=0;j<8;j++){
   const a=j*Math.PI/4,p=[c[0]+Math.cos(a)*metres*U,c[1]+Math.sin(a)*metres*U],path=closestPath(p);if(!path||path.distance<22*U)continue;
   const angle=Math.atan2(path.point[1]-p[1],path.point[0]-p[0])+Math.PI/2,ring=rectangle(p,w*U,h*U,angle);if(!free(ring,d))continue;
   const front=[p[0]+Math.sin(angle)*h/2*U,p[1]-Math.cos(angle)*h/2*U],tailDistance=path.walk?3:9,dist=distance(front,path.point),end=[path.point[0]+(front[0]-path.point[0])*tailDistance*U/dist,path.point[1]+(front[1]-path.point[1])*tailDistance*U/dist],connector=corridor(front,end,1.1*U);
   if(!free(connector,d,{ignore:[]})||!free(corridor(front,path.point,1.1*U),d,{ignore:[path.source]}))continue;
   const residents=people(p,angle);if(residents.some(person=>!free(rectangle(person.position,.7*U,.7*U),d)))continue;
   candidates.push({p,angle,ring,connector,approach:[front,end,path.point],path,residentialSource:home.id,residents});break;
  }
 }
 // Keep one stable representative per small residential cluster.
 candidates.sort((a,b)=>a.residentialSource.localeCompare(b.residentialSource)||a.p[0]-b.p[0]||a.p[1]-b.p[1]);
 return candidates.filter((c,i)=>!candidates.slice(0,i).some(q=>distance(q.p,c.p)<100*U));
}
function distributedFacilities(parent,d,count,kind,w,h){
 const candidates=neighborhoodCandidates(parent,d,w,h),chosen=[];
 for(let i=0;i<count;i++){
  const prior=[parent.origin,...chosen.map(q=>q.p)],available=candidates.filter(c=>!chosen.includes(c)&&free(c.ring,d)&&free(c.connector,d));
  for(const c of available)c.separation=Math.min(...prior.map(p=>distance(c.p,p)/U));
  const preferred=available.filter(c=>c.separation>=800),fallback=available.filter(c=>c.separation>=400),pool=preferred.length?preferred:fallback;
  pool.sort((a,b)=>b.separation-a.separation||a.residentialSource.localeCompare(b.residentialSource));const c=pool[0];if(!c)throw Error('No separated '+kind+' '+parent.key+' '+i+' candidates '+candidates.length);
  chosen.push(c);reserve(c.ring,parent.key);reserve(c.connector,parent.key);
 }
 return chosen.map((c,i)=>site(parent,kind+'-'+(i+1),kind,c.p,[w,h],kind==='clinic-satellite'?'Медпункт '+(i+1):kind==='sports-court'?'Двор спорта '+(i+1):'Детский сад',{orientation:c.angle,source:c.residentialSource,residentialSource:c.residentialSource,footprint:c.ring,approach:{points:c.approach,source:c.path.source,sourceSegment:c.path.segment,checkedFootprint:c.connector},peopleSpots:c.residents,separationMetres:c.separation,buildingSize:kind==='clinic-satellite'?[24,18]:kind==='kindergarten'?[18,12]:null}));
}
function kindergartenCampus(parent,d){
 for(const metres of [65,85,110,145,185,230,290])for(let j=0;j<32;j++){
  const a=j*Math.PI/16,p=[parent.origin[0]+Math.cos(a)*metres*U,parent.origin[1]+Math.sin(a)*metres*U],path=closestPath(p);if(!path||path.distance<17*U)continue;
  const angle=Math.atan2(path.point[1]-p[1],path.point[0]-p[0])+Math.PI/2,ring=rectangle(p,32*U,28*U,angle);if(!free(ring,d))continue;
  const front=[p[0]+Math.sin(angle)*14*U,p[1]-Math.cos(angle)*14*U],dist=distance(front,path.point),tail=(path.walk?3:9)*U,end=[path.point[0]+(front[0]-path.point[0])*tail/dist,path.point[1]+(front[1]-path.point[1])*tail/dist],connector=corridor(front,end,1.1*U);
  if(!free(connector,d)||!free(corridor(front,path.point,1.1*U),d,{ignore:[path.source]}))continue;
  const residents=people(p,angle);if(residents.some(q=>!clear(rectangle(q.position,.7*U,.7*U),d)))continue;
  reserve(ring,parent.key);reserve(connector,parent.key);return [site(parent,'kindergarten-campus','kindergarten',p,[32,28],'Детский сад школьного кампуса',{orientation:angle,source:parent.source||path.source,schoolSource:parent.key,footprint:ring,buildingSize:[18,12],campusDistanceMetres:metres,approach:{points:[front,end,path.point],source:path.source,sourceSegment:path.segment,checkedFootprint:connector},peopleSpots:residents})];
 }
 throw Error('No nearby checked kindergarten campus '+parent.key);
}
function householdServices(parent,d){
 const rb=bounds(parent.route),near=[...new Set([...(placements['M5:'+parent.district].roofs||[]).map(roof=>buildings.find(b=>b.id===roof.source)).filter(Boolean),...homeIndex([rb[0]-500*U,rb[1]-500*U,rb[2]+500*U,rb[3]+500*U])])],connections=[];
 const closest=point=>{const q=closestPath(point,220*U);return q?{p:q.point,dist:q.distance,source:q.source,segment:q.segment}:{p:point,dist:Infinity};};
 const candidates=near.map(home=>({home,q:closest([(home.bounds[0]+home.bounds[2])/2,(home.bounds[1]+home.bounds[3])/2])})).sort((a,b)=>a.q.dist-b.q.dist||a.home.id.localeCompare(b.home.id));
 for(const {home} of candidates){if(connections.length>=3)break;for(let i=0;i<home.rings[0].length;i++){const a=home.rings[0][i],b=home.rings[0][(i+1)%home.rings[0].length],wall=[(a[0]+b[0])/2,(a[1]+b[1])/2],angle=Math.atan2(b[1]-a[1],b[0]-a[0]);let chosen=null;for(const sign of [-1,1]){const p=[wall[0]-Math.sin(angle)*6*U*sign,wall[1]+Math.cos(angle)*6*U*sign],ring=rectangle(p,5*U,4*U,angle);if(!free(ring,d,{ignore:[parent.key]})||connections.some(s=>distance(s.origin,p)<20*U))continue;const q=closest(p),connector=corridor(q.p,p,.45*U);if(q.dist>180*U||!clear(connector,d,{ignore:[parent.key,...roads.map(r=>r.id)],vegetationToo:false,reservationsToo:false}))continue;chosen={p,ring,q,connector};break;}if(!chosen)continue;reserve(chosen.ring,parent.key);const child=site(parent,'household-'+connections.length,'household-service',chosen.p,[5,4],'Подключение жилого дома '+(connections.length+1),{source:home.id,householdSource:home.id,orientation:angle,footprint:chosen.ring,connection:{kind:'buried-service',points:[chosen.q.p,chosen.p],checkedFootprint:chosen.connector,sources:[chosen.q.source],sourceSegment:chosen.q.segment},wallPoint:wall,peopleSpots:clearPeople(parent,d,chosen.p,angle)});connections.push(child);break;}}
 if(connections.length<3)throw Error('No three checked household service connections '+parent.key+' got '+connections.length);return connections;
}
const nodeKey=p=>p.map(n=>n.toFixed(6)).join('/'),graph=new Map();
for(const r of roads.filter(r=>r.major&&r.tags.bridge!=='yes'))for(let i=1;i<r.points.length;i++)for(const [p,q]of[[r.points[i-1],r.points[i]],[r.points[i],r.points[i-1]]]){const k=nodeKey(p);if(!graph.has(k))graph.set(k,{point:p,arms:new Map()});graph.get(k).arms.set(nodeKey(q),{point:q,source:r.id});}
function junctionSites(parent,d){
 const candidates=[];
 for(const node of graph.values()){
  const arms=[...node.arms.values()];if(arms.length<3||!clear(rectangle(node.point,2*U,2*U),d,{ignore:arms.map(a=>a.source),vegetationToo:false,reservationsToo:false}))continue;
  const directions=arms.map(a=>Math.atan2(a.point[1]-node.point[1],a.point[0]-node.point[0]));
  if(!directions.some((a,i)=>directions.some((b,j)=>i!==j&&Math.abs(Math.sin(a-b))>.7)))continue;
  const fixtures=[];for(let j=0;j<24&&fixtures.length<4;j++){const a=j*Math.PI/12,r=(12+Math.floor(j/8)*3)*U,p=[node.point[0]+Math.cos(a)*r,node.point[1]+Math.sin(a)*r],ring=rectangle(p,.9*U,.9*U);if(free(ring,d)&&fixtures.every(f=>distance(f.point,p)>8*U))fixtures.push({point:[...p,z],angle:a,footprint:ring});}
  if(fixtures.length<3)continue;
  // Follow each actual source branch away from the junction to queue vehicles.
  const routes=arms.map(a=>{let p=a.point,previous=node.point,chain=[node.point,p],sources=[a.source],length=distance(previous,p);for(let step=0;step<15&&length<100*U;step++){const next=graph.get(nodeKey(p));if(!next)break;const options=[...next.arms.values()].filter(q=>nodeKey(q.point)!==nodeKey(previous));options.sort((q,r)=>pointSegment(q.point,previous,p)-pointSegment(r.point,previous,p)||q.source.localeCompare(r.source));const q=options[0];if(!q)break;previous=p;p=q.point;chain.push(p);sources.push(q.source);length+=distance(previous,p);}return {points:chain,sources};}).filter(r=>r.points.reduce((s,p,i)=>s+(i?distance(p,r.points[i-1]):0),0)>=28*U);
  if(routes.length<3)continue;
  candidates.push({node,fixtures,routes,score:distance(node.point,parent.origin)});
 }
 candidates.sort((a,b)=>a.score-b.score||nodeKey(a.node.point).localeCompare(nodeKey(b.node.point)));const chosen=[];
 // Preserve the authored encounter and original junction as the first camera
 // location when it has enough individually clear signal corners.
 for(const candidate of candidates){if(chosen.some(c=>distance(c.node.point,candidate.node.point)<300*U))continue;chosen.push(candidate);if(chosen.length===3)break;}
 if(chosen.length!==3)throw Error('Need three junctions '+parent.key+' got '+chosen.length);
 return chosen.map((c,i)=>{for(const f of c.fixtures)reserve(f.footprint,parent.key);return site(parent,'junction-'+(i+1),'junction',c.node.point,[54,54],'Перекрёсток '+(i+1),{source:c.routes[0].sources[0],sources:[...new Set(c.routes.flatMap(r=>r.sources))],arms:c.routes,signals:c.fixtures,coordinationOffset:i*6,peopleSpots:c.fixtures.map(f=>({position:[f.point[0]+1.2*U,f.point[1],z],angle:f.angle})).filter(p=>clear(rectangle(p.position,.7*U,.7*U),d))});});
}
// Area landscape is reserved first so all later building programs honor it.
for(const d of bootstrap.districts.features){const parent=placements['M4:'+d.id];records[parent.key]={sites:PARKS[d.id].map((id,i)=>parkArea(parent,d,id,i)),kind:'landscape-program'};}
for(const d of bootstrap.districts.features){
 for(const parent of Object.values(placements).filter(p=>p.district===d.id)){
  if(records[parent.key])continue;
  let sites=[],furniture=['M1','M10','M13','M14'].includes(parent.id)?vettedFurniture(parent,d):null;
  if(parent.id==='M8')sites=distributedFacilities(parent,d,3,'clinic-satellite',40,36);
  if(parent.id==='M9')sites=distributedFacilities(parent,d,2,'sports-court',40,32);
  if(parent.id==='M7'&&d.id!=='nura')sites=kindergartenCampus(parent,d);
  if(parent.id==='M2')sites=junctionSites(parent,d);
  if(parent.id==='M11')sites=[.28,.5,.72].map((t,i)=>{const q=routeAt(parent.route,t),signs=[];for(let j=0;j<32&&signs.length<4;j++){const a=q.angle+j*Math.PI/16,p=[q.point[0]+Math.cos(a)*13*U,q.point[1]+Math.sin(a)*13*U],ring=rectangle(p,1.2*U,1.2*U);if(free(ring,d,{ignore:[parent.key]})&&signs.every(s=>distance(s.point,p)>8*U))signs.push({point:[...p,z],angle:q.angle,footprint:ring});}return site(parent,'crossing-'+i,'protected-crossing',q.point,[34,30],'Школьный переход '+(i+1),{source:parent.source,orientation:q.angle,signs,peopleSpots:clearPeople(parent,d,q.point,q.angle)});});
  if(parent.id==='M6'){const items=[];for(let row=0;row<2;row++)for(let i=0;i<8;i++){const p=[parent.origin[0]+(i-3.5)*14*U,parent.origin[1]+(row?7:-7)*U],ring=rectangle(p,10*U,10*U);if(clear(ring,d,{ignore:[parent.key]}))items.push({point:[...p,z],footprint:ring,variant:i+row});}sites=[site(parent,'main-belt','greening-belt-core',parent.origin,[132,36],'Ветрозащитный пояс',{source:parent.source,items,footprint:parent.footprint,peopleSpots:clearPeople(parent,d,parent.origin)}),...(source.context[parent.key]||[]).map((q,i)=>site(parent,'belt-'+i,'greening-belt',q.point,[q.radius*2/U,q.radius*2/U],'Питомник '+(i+1),{source:parent.source,footprint:rectangle(q.point,q.radius*2,q.radius*2),peopleSpots:[{position:[q.point[0],q.point[1],z],angle:0}]}))];}
  if(parent.id==='M12')sites=(source.context[parent.key]||[]).map((q,i)=>site(parent,'intake-'+i,'intake-point',q.point,[7,7],'Приём обращений '+(i+1),{source:parent.source,footprint:rectangle(q.point,7*U,7*U),peopleSpots:[{position:[q.point[0]+3*U,q.point[1]-2*U,z],angle:0}]}));
  if(parent.id==='M13')sites=householdServices(parent,d);
  if(['M1','M3','M10','M11','M12','M13','M14'].includes(parent.id)&&!sites.length){
   const fixtures=parent.id==='M10'?(furniture||parent.furniture||[]).filter(q=>!q.unused):furniture||parent.furniture||[],ts=parent.id==='M10'?[.12,.38,.62,.88]:parent.id==='M1'?[.18,.38,.62,.82]:parent.id==='M14'?[.16,.5,.84]:[.2,.5,.8];
   sites=ts.map((t,i)=>fixtures[Math.round((fixtures.length-1)*t)]).filter(Boolean).map((q,i)=>site(parent,'working-'+i,parent.id==='M14'?'emergency-base':parent.id==='M13'?'utility-connection':parent.id==='M1'?'boarding-stop':parent.id==='M10'?'light-route':parent.id==='M12'?'intake-point':'access-point',q.point,[9,5],'Участок '+(i+1),{source:parent.source,orientation:q.angle,peopleSpots:clearPeople(parent,d,q.point,q.angle)}));
  }
  records[parent.key]={sites,kind:'connected-program',...(furniture?{furniture}:{}),...(parent.roofs?{convertedHomes:parent.roofs.map(r=>r.source)}:{})};
 }
}
const data={version:1,source:'Derived presentation geometry checked against complete prepared OpenStreetMap city, environment and resident reservations. Illustrative facilities, not approved construction sites.',metre:U,records};
await writeFile('src/world/astana-programs.json',JSON.stringify(data)+'\n');
console.log(JSON.stringify({programs:Object.keys(records).length,sites:Object.values(records).flatMap(r=>r.sites).length,parkPockets:Object.values(records).flatMap(r=>r.sites).filter(s=>s.kind==='park-area').flatMap(s=>s.items||[]).length,clinicSatellites:Object.values(records).flatMap(r=>r.sites).filter(s=>s.kind==='clinic-satellite').length,junctions:Object.values(records).flatMap(r=>r.sites).filter(s=>s.kind==='junction').length}));
