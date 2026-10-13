import {readFile} from 'node:fs/promises';
import {mapXY,contains,CENTER} from '../../src/world/city-math.js';
import {bounds,corridor,rectangle,spatialIndex,polygonTouches} from '../../src/world/placement-geometry.js';
export const METRE=1/12000;
export const geographic=p=>[CENTER[0]+p[0]/5.8,CENTER[1]+p[1]/9.25];
export async function readSource(){
 const read=async p=>JSON.parse(await readFile(p,'utf8'));
 const [manifest,bootstrap,placements,environment,context]=await Promise.all(['public/city/data/manifest.json','src/world/bootstrap.json','src/world/placements.json','public/alem/environment-source.json','src/world/context-sites.json'].map(read));
 const features=new Map(),obstacles=[],roads=[],buildings=[],vegetation=[],reservations=[];
 const add=(target,id,rings,kind,extra={})=>target.push({id,rings,bounds:bounds(rings[0]),kind,...extra});
 for(const chunk of manifest.chunks)for(const feature of (await read('public/city/'+chunk.url)).features){
  const key=chunk.layer+feature.id;if(features.has(key))continue;features.set(key,feature);
  const g=feature.geometry,tags=feature.properties.tags||{};
  for(const poly of g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]){
   const rings=poly.map(r=>r.slice(0,-1).map(mapXY));
   if(['buildings','water'].includes(chunk.layer))add(obstacles,feature.id,rings,chunk.layer,{tags});
   if(chunk.layer==='buildings')add(buildings,feature.id,rings,'buildings',{tags});
  }
  if(tags.tunnel==='yes'||tags.location==='underground')continue;
  for(const line of g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[]){
   const points=line.map(mapXY),walk=['path','footway','cycleway','steps'].includes(tags.highway),major=['motorway','trunk','primary','secondary','tertiary','residential','unclassified','living_street'].includes(tags.highway);
   if(chunk.layer==='streets')roads.push({id:feature.id,points,tags,walk,major,bounds:bounds(points)});
   if(['streets','water'].includes(chunk.layer))for(let i=1;i<points.length;i++)add(obstacles,feature.id,[corridor(points[i-1],points[i],chunk.layer==='water'?.0007:walk?.00016:.0006)],chunk.layer,{walk});
  }
 }
 for(const [i,item] of environment.entries())add(vegetation,'vegetation/'+i,[rectangle(item.point,item.radius*2,item.radius*2)],'vegetation');
 for(const site of Object.values(placements.records)){
  if(site.footprint)add(reservations,site.key,[site.footprint],'program');
  if(site.route)for(let i=1;i<site.route.length;i++)add(reservations,site.key,[corridor(site.route[i-1],site.route[i],.0011)],'program-route');
  for(const q of [...(site.peopleSpots||[]),...(site.furniture||[])])add(reservations,site.key,[rectangle(q.position||q.point,.0004,.0004)],'resident');
  for(const q of context.records[site.key]||[])add(reservations,site.key,[rectangle(q.point,q.radius*2,q.radius*2)],'program');
 }
 for(const [id,item] of Object.entries(bootstrap.anchors))add(reservations,id,[rectangle(mapXY(item.position),.0005,.0005)],'encounter');
 const indexes={source:spatialIndex(obstacles),vegetation:spatialIndex(vegetation),reservations:spatialIndex(reservations)};
 const clear=(ring,district,{ignore=[],vegetationToo=true,reservationsToo=true,buffer=.2*METRE}={})=>{
  const raw=bounds(ring),b=[raw[0]-buffer,raw[1]-buffer,raw[2]+buffer,raw[3]+buffer],near=[...indexes.source(b),...(vegetationToo?indexes.vegetation(b):[]),...(reservationsToo?indexes.reservations(b):[])];
  return ring.every(p=>contains(district.geometry,geographic(p)))&&!near.some(item=>!ignore.includes(item.id)&&polygonTouches([ring],item.rings,buffer));
 };
 return {features,obstacles,roads,buildings,vegetation,reservations,bootstrap,placements:placements.records,context:context.records,indexes,clear};
}
