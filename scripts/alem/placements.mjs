/** Deterministically vet scenario sites against the complete attributed OSM fixture.
 * This produces visual anchors only; none of these lengths/areas enter the model. */
import {readFile,writeFile} from 'node:fs/promises';
import {mapXY,contains,CENTER} from '../../src/world/city-math.js';
import {bounds,overlaps,distance,inPolygon,polygonTouches,rectangle,corridor,spatialIndex,routeAt} from '../../src/world/placement-geometry.js';
import {sourceHeight} from './architecture.mjs';
import {SCENARIO_GROUND} from './rebase-roofs.mjs';
import {Mesh} from '../../src/world/mesh-kit.js';
import {lrtStation} from '../../src/world/lrt-model.js';
const outputIndex=process.argv.indexOf('--output');
if(outputIndex!==-1&&(!process.argv[outputIndex+1]||process.argv[outputIndex+1].startsWith('--')))throw Error('--output requires a file path');
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const manifest=await read('../../public/city/data/manifest.json'),bootstrap=await read('../../src/world/bootstrap.json');
const buildings=[],water=[],roads=[],greens=[],seen=new Set();
for(const chunk of manifest.chunks){const data=await read('../../public/city/'+chunk.url);for(const f of data.features){const key=chunk.layer+f.id;if(seen.has(key))continue;seen.add(key);const g=f.geometry,t=f.properties.tags||{};
 const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
 for(const poly of polys){const rings=poly.map(r=>r.slice(0,-1).map(mapXY));if(rings[0].length<3)continue;const item={id:f.id,rings,bounds:bounds(rings[0]),tags:t,height:chunk.layer==='buildings'?sourceHeight(f.properties).top:0};
  if(chunk.layer==='buildings')buildings.push(item);if(chunk.layer==='water')water.push(item);if(chunk.layer==='green'&&!['forest','wood'].includes(t.landuse||t.natural))greens.push(item);
 }
 for(const line of g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[]){const points=line.map(mapXY);if(t.tunnel==='yes'||t.location==='underground')continue;
  const major=['motorway','trunk','primary','secondary','tertiary','residential','unclassified','living_street'].includes(t.highway);
  if(chunk.layer==='streets')roads.push({id:f.id,points,bounds:bounds(points),tags:t,major});
  if(chunk.layer==='water')for(let i=1;i<points.length;i++){const rings=[corridor(points[i-1],points[i],.0007)];water.push({id:f.id,rings,bounds:bounds(rings[0])});}
 }
}}
const bIndex=spatialIndex(buildings),wIndex=spatialIndex(water),roadPolys=roads.flatMap(r=>r.points.slice(1).map((p,i)=>{const rings=[corridor(r.points[i],p,r.major?.00055:.00013)];return {id:r.id,rings,bounds:bounds(rings[0])};})),rIndex=spatialIndex(roadPolys);
const geographic=p=>[CENTER[0]+p[0]/5.8,CENTER[1]+p[1]/9.25];
const reserved=[],records={};
const schoolHero=await read('../../src/world/hero-school-site.json');
const expanded=(b,r)=>[b[0]-r,b[1]-r,b[2]+r,b[3]+r];
// Residents must clear the authored station as well as the source city. Derive
// its full footprint once, including the plinth, entrance steps and signs.
const stationMesh=new Mesh();lrtStation(stationMesh,{length:90,width:23,platformHeight:10.1});
const stationPoints=[];for(let at=0;at<stationMesh.bytes;at+=20)stationPoints.push([stationMesh.view.getFloat32(at,true),stationMesh.view.getFloat32(at+4,true)]);
const stationBounds=bounds(stationPoints),stationUnit=1/12000;
function stationFootprint(route){const q=routeAt(route,.5),[x,y,X,Y]=stationBounds,c=Math.cos(q.angle),s=Math.sin(q.angle),dx=(x+X)*stationUnit/2,dy=(y+Y)*stationUnit/2;return rectangle([q.point[0]+dx*c-dy*s,q.point[1]+dx*s+dy*c],(X-x)*stationUnit,(Y-y)*stationUnit,q.angle);}
function routePeopleSpots(id,d,route,mid){
 const station=id==='M3'?stationFootprint(route):null;
 const peopleSpots=[],length=route.slice(1).reduce((sum,p,i)=>sum+distance(p,route[i]),0),tryPerson=(point,angle)=>{const ring=rectangle(point,.00035,.00035),b=expanded(bounds(ring),.00002);if((!station||!polygonTouches([ring],[station],.00001))&&![...bIndex(b),...wIndex(b),...rIndex(b)].some(x=>polygonTouches([ring],x.rings,.00001))&&ring.every(p=>contains(d.geometry,geographic(p)))&&peopleSpots.every(s=>distance(s.position,point)>.0004))peopleSpots.push({position:[...point,SCENARIO_GROUND.foot],angle});};
 const samples=Array.from({length:40},(_,i)=>i).sort((a,b)=>Math.abs(a-19.5)-Math.abs(b-19.5));for(const i of samples){const q=routeAt(route,.5+(i-19.5)*.00022/length);for(const offset of [.00085,-.00085,.0013,-.0013,.0018,-.0018])tryPerson([q.point[0]-Math.sin(q.angle)*offset,q.point[1]+Math.cos(q.angle)*offset],q.angle);}
 if(peopleSpots.length<8){const grid=[];for(let x=-7;x<=7;x++)for(let y=-7;y<=7;y++)grid.push([mid.point[0]+x*.0006,mid.point[1]+y*.0006]);grid.sort((a,b)=>distance(a,mid.point)-distance(b,mid.point));for(const point of grid)tryPerson(point,mid.angle);}
 peopleSpots.sort((a,b)=>distance(a.position,mid.point)-distance(b.position,mid.point));if(peopleSpots.length<8)throw Error('No safe residents '+id+'/'+d.id);
 return peopleSpots.slice(0,8);
}
function clear(ring,d,roadsToo=true){const b=expanded(bounds(ring),.00025);return ring.every(p=>contains(d.geometry,geographic(p)))&&![...bIndex(b),...wIndex(b),...(roadsToo?rIndex(b):[]),...reserved.filter(x=>overlaps(x.bounds,b))].some(x=>polygonTouches([ring],x.rings,.00018));}
function viewSafe(p,w){ // Orthographic line of sight at the shared .78 pitch / -.12 yaw.
 return !bIndex([p[0]-.024,p[1]-.065,p[0]+.024,p[1]+.008]).some(b=>{
  const c=[(b.bounds[0]+b.bounds[2])/2,(b.bounds[1]+b.bounds[3])/2],dx=c[0]-p[0],dy=c[1]-p[1],right=dx*.9928+dy*.1197,forward=dx*.1197-dy*.9928;
  const r=Math.hypot(b.bounds[2]-b.bounds[0],b.bounds[3]-b.bounds[1])/2;
  return forward>0&&Math.abs(right)<w*.6+r&&b.height>(forward-r)*1.01+.001;
 });
}
function openSite(id,d){
 const kind={M4:'garden',M6:'garden',M7:'school',M8:'clinic',M9:'garden',M12:'service'}[id],base=mapXY(bootstrap.anchors[`${d.id}:${kind}`].position),size=id==='M4'?[.009,.006]:id==='M6'?[.011,.003]:id==='M9'?[.0055,.004]:id==='M12'?[.003,.003]:[.006,.0048];
 const candidates=[];
 for(const green of greens.filter(g=>distance([(g.bounds[0]+g.bounds[2])/2,(g.bounds[1]+g.bounds[3])/2],base)<.32)){
  for(let x=green.bounds[0]+size[0]/2;x<green.bounds[2];x+=size[0]*.7)for(let y=green.bounds[1]+size[1]/2;y<green.bounds[3];y+=size[1]*.7){const p=[x,y],ring=rectangle(p,...size);if(ring.every(q=>inPolygon(q,green.rings)))candidates.push({p,source:green.id,score:distance(p,base)});}
 }
 // Existing inhabited anchors bias the fallback toward courtyards, not empty outskirts.
 for(let x=-65;x<=65;x++)for(let y=-65;y<=65;y++){const p=[base[0]+x*.0025,base[1]+y*.0025];candidates.push({p,source:null,score:distance(p,base)+.04});}
 candidates.sort((a,b)=>a.score-b.score||a.p[0]-b.p[0]||a.p[1]-b.p[1]);
 const found=candidates.find(c=>clear(rectangle(c.p,...size),d)&&viewSafe(c.p,size[0]));if(!found)throw Error(`No clear site: ${id}/${d.id}`);
 const footprint=rectangle(found.p,...size);reserved.push({rings:[footprint],bounds:bounds(footprint)});
 return {type:'parcel',origin:[...found.p,SCENARIO_GROUND.parcel],position:geographic(found.p),orientation:0,footprint,size,source:found.source,placement:found.source?'vetted-open-space':'vetted-courtyard',clearance:.00018};
}
const roadGraph=new Map(),nodeKey=p=>p.map(n=>n.toFixed(6)).join('/');for(const r of roads.filter(r=>r.major&&r.tags.bridge!=='yes'))for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i];for(const [p,q] of [[a,b],[b,a]]){const k=nodeKey(p);if(!roadGraph.has(k))roadGraph.set(k,[]);roadGraph.get(k).push({point:q,source:r.id});}}
const degrees=new Map();for(const r of roads.filter(r=>r.major))for(const p of r.points){const k=p.map(n=>n.toFixed(6)).join('/');degrees.set(k,(degrees.get(k)||0)+1);}
function streetFurniture(route,d){ const furniture=[];for(let i=0;i<40;i++){const q=routeAt(route,.03+i*.024),side=i%2?-1:1,point=[q.point[0]-Math.sin(q.angle)*.00094*side,q.point[1]+Math.cos(q.angle)*.00094*side],ring=rectangle(point,.00075,.00034,q.angle),b=expanded(bounds(ring),.00006);if(![...bIndex(b),...wIndex(b),...rIndex(b)].some(x=>polygonTouches([ring],x.rings,.00005))&&ring.every(p=>contains(d.geometry,geographic(p)))&&furniture.every(f=>distance(f.point,point)>.002))furniture.push({point,angle:q.angle,ground:SCENARIO_GROUND.foot});}
 return furniture;
}
function routeSite(id,d){const kind=id==='M11'?'crossing':id==='M10'?'crossing':'service',base=mapXY(bootstrap.anchors[`${d.id}:${kind}`].position),options=[];
 for(const r of roads.filter(r=>r.major&&r.tags.bridge!=='yes')){
  let chain=[];
  const emit=()=>{if(chain.length>1){const length=chain.slice(1).reduce((s,p,i)=>s+distance(p,chain[i]),0);if(length>=.006){const mid=routeAt(chain,.5);if(viewSafe(mid.point,.009))options.push({route:chain,source:r.id,tags:r.tags,length,score:distance(mid.point,base),mid});}}chain=[];};
  for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i];if(clear(corridor(a,b,.00105),d,false)){if(!chain.length)chain.push(a);chain.push(b);if(chain.slice(1).reduce((s,p,i)=>s+distance(p,chain[i]),0)>.023)emit();}else emit();}emit();
 }
 options.sort((a,b)=>a.score-b.score||a.source.localeCompare(b.source));let selected=options[0];
 if(id==='M2')selected=options.find(o=>o.route.some(p=>new Set((roadGraph.get(nodeKey(p))||[]).map(e=>nodeKey(e.point))).size>=3))||selected;
 if(!selected)throw Error(`No safe street: ${id}/${d.id}`);
 // Extend through shared OSM nodes, preserving every bend and segment's provenance.
 const grow=o=>{const route=o.route.map(p=>[...p]),sources=new Set([o.source]),visited=new Set(route.map(nodeKey));let length=o.length;
  for(let end=0;end<2;end++){if(end)route.reverse();for(let step=0;step<100&&length<.12;step++){const a=route.at(-2),b=route.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],next=(roadGraph.get(nodeKey(b))||[]).filter(e=>!visited.has(nodeKey(e.point))).sort((u,v)=>{const angle=q=>Math.abs(Math.atan2(dx*(q[1]-b[1])-dy*(q[0]-b[0]),dx*(q[0]-b[0])+dy*(q[1]-b[1])));return angle(u.point)-angle(v.point)||u.source.localeCompare(v.source);}).find(e=>clear(corridor(b,e.point,.00105),d,false));if(!next)break;route.push(next.point);visited.add(nodeKey(next.point));sources.add(next.source);length+=distance(b,next.point);}if(end)route.reverse();}
  return {...o,route,sources:[...sources],length,mid:routeAt(route,.5)};
 };
 if(id!=='M11'&&id!=='M2'){
  const extended=options.slice(0,30).map(grow).filter(o=>viewSafe(o.mid.point,.009));
  // A clear road does not guarantee usable verge space (for example on paired
  // carriageways). Keep the original route priority, but vet required fixtures
  // before choosing the road instead of aborting after its selection.
  const ranked=[...extended.filter(o=>o.length>=.06),...extended.filter(o=>o.length<.06).sort((a,b)=>b.length-a.length),selected];
  selected=ranked.find(o=>{o.furniture=streetFurniture(o.route,d);return !['M1','M10','M14'].includes(id)||o.furniture.length>=2;});
  if(!selected)throw Error('No safe street furniture '+id+'/'+d.id+' among '+ranked.length+' candidate routes');
 }
 const {route,source,tags}=selected;let mid=selected.mid;
 if(id==='M2'){const junction=route.find(p=>new Set((roadGraph.get(nodeKey(p))||[]).map(e=>nodeKey(e.point))).size>=3);if(!junction)throw Error('No true junction '+d.id);mid={...mid,point:junction};}
 const furniture=selected.furniture??streetFurniture(route,d);
 if(['M1','M10','M14'].includes(id)&&furniture.length<2)throw Error('No safe street furniture '+id+'/'+d.id);
 const peopleSpots=routePeopleSpots(id,d,route,mid);
 // Parallel initiatives reserve distinct street corridors. No visual collision bonuses.
 route.slice(1).forEach((p,i)=>{const ring=corridor(route[i],p,.00108);reserved.push({rings:[ring],bounds:bounds(ring)});});
 return {type:'corridor',origin:[...mid.point,SCENARIO_GROUND.corridor],position:geographic(mid.point),orientation:mid.angle,route,furniture,peopleSpots:peopleSpots.slice(0,8),source,sources:selected.sources||[source],roadClass:tags.highway,roadName:tags.name||null,clearance:.00105,placement:'connected-osm-way'};
}
function fuelSite(d){const base=mapXY(bootstrap.anchors[`${d.id}:entrance`].position),homes=buildings.filter(b=>['apartments','residential','house','detached','terrace'].includes(b.tags.building));homes.sort((a,b)=>distance([(a.bounds[0]+a.bounds[2])/2,(a.bounds[1]+a.bounds[3])/2],base)-distance([(b.bounds[0]+b.bounds[2])/2,(b.bounds[1]+b.bounds[3])/2],base));
 const candidates=[];for(const b of homes){if(!b.rings[0].every(p=>contains(d.geometry,geographic(p))))continue;const points=[];for(let x=1;x<10;x++)for(let y=1;y<10;y++){const q=[b.bounds[0]+(b.bounds[2]-b.bounds[0])*x/10,b.bounds[1]+(b.bounds[3]-b.bounds[1])*y/10];if(rectangle(q,.0005,.0005).every(v=>inPolygon(v,b.rings)))points.push(q);}points.sort((a,b)=>distance(a,base)-distance(b,base));if(points[0])candidates.push({source:b.id,position:[...points[0],b.height+.00004],rings:b.rings});if(candidates.length>=45)break;}
 candidates.sort((a,b)=>distance(a.position,base)-distance(b.position,base));let selected=[];for(const c of candidates){const cluster=candidates.filter(b=>distance(c.position,b.position)<.016).slice(0,7);if(cluster.length>=3){selected=cluster;break;}}if(selected.length<3)throw Error('No residential cluster: '+d.id);const p=selected[0].position;
 const peopleSpots=[],groundCandidates=[];for(let x=-22;x<=22;x++)for(let y=-22;y<=22;y++)groundCandidates.push([p[0]+x*.0005,p[1]+y*.0005]);
 groundCandidates.sort((a,b)=>distance(a,p)-distance(b,p));for(const point of groundCandidates){if(peopleSpots.length===8)break;if(clear(rectangle(point,.0004,.0004),d)&&viewSafe(point,.0005)&&peopleSpots.every(s=>distance(s.position,point)>.0006))peopleSpots.push({position:[...point,SCENARIO_GROUND.foot],angle:0});}
 if(peopleSpots.length<8)throw Error('No safe residential gathering '+d.id);
 return {type:'roofs',origin:[p[0],p[1],p[2]],position:geographic(p),orientation:0,roofs:selected,peopleSpots,placement:'existing-residential-roof-cluster'};
}
let catalog;
if(process.argv.includes('--lrt-people-only')){
 // Re-vet interaction points on the existing canonical routes without selecting
 // new project sites, furniture or reservations for unrelated initiatives.
 catalog=await read('../../src/world/placements.json');
 for(const site of Object.values(catalog.records).filter(s=>s.id==='M3')){const d=bootstrap.districts.features.find(d=>d.id===site.district);site.peopleSpots=routePeopleSpots(site.id,d,site.route,routeAt(site.route,.5));}
}else{
 for(const d of bootstrap.districts.features){for(const id of ['M4','M7','M8','M9','M6','M12','M1','M3','M10','M11','M13','M2','M14','M5']){const site=id==='M7'&&d.id==='nura'?schoolHero:id==='M5'?fuelSite(d):['M4','M6','M7','M8','M9','M12'].includes(id)?openSite(id,d):routeSite(id,d);if(site===schoolHero)reserved.push({rings:[site.footprint],bounds:bounds(site.footprint)});records[`${id}:${d.id}`]={key:`${id}:${d.id}`,id,district:d.id,...site};}}
 catalog={version:1,note:'Illustrative scenario placements; not proposed real construction or transit alignments.',source:'OpenStreetMap / Geofabrik prepared fixture',checked:{buildings:buildings.length,water:water.length,roadSegments:roadPolys.length},records};
}
await writeFile(outputIndex===-1?new URL('../../src/world/placements.json',import.meta.url):process.argv[outputIndex+1],JSON.stringify(catalog)+'\n');
console.log(JSON.stringify({sites:Object.keys(catalog.records).length,checked:catalog.checked,parcels:Object.values(catalog.records).filter(r=>r.type==='parcel').map(r=>({key:r.key,placement:r.placement,position:r.position}))},null,2));
