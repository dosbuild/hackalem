/** Small supporting spaces around the existing intervention. Full-source clearance,
 * including the already resident vegetation. Never changes a simulation input. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {mapXY,contains,CENTER} from '../../src/world/city-math.js';
import {bounds,rectangle,corridor,spatialIndex,polygonTouches} from '../../src/world/placement-geometry.js';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const [catalog,boot,manifest,environment]=await Promise.all([read('src/world/placements.json'),read('src/world/bootstrap.json'),read('public/city/data/manifest.json'),read('public/alem/environment-source.json')]);
const obstacles=[],seen=new Set(),add=rings=>obstacles.push({rings,bounds:bounds(rings[0])});
for(const chunk of manifest.chunks.filter(c=>['buildings','water','streets'].includes(c.layer)))for(const f of (await read('public/city/'+chunk.url)).features){
 const key=chunk.layer+f.id;if(seen.has(key))continue;seen.add(key);const g=f.geometry,t=f.properties.tags||{};
 for(const poly of g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[])add(poly.map(r=>r.map(mapXY)));
 if(t.tunnel==='yes'||t.location==='underground')continue;
 for(const line of g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[]){const p=line.map(mapXY);for(let i=1;i<p.length;i++)add([corridor(p[i-1],p[i],chunk.layer==='water'?.0007:['path','footway','cycleway','steps'].includes(t.highway)?.00016:.0006)]);}
}
for(const o of environment)add([rectangle(o.point,o.radius*2,o.radius*2)]);
for(const s of Object.values(catalog.records)){if(s.footprint)add([s.footprint]);if(s.route)for(let i=1;i<s.route.length;i++)add([corridor(s.route[i-1],s.route[i],.0018)]);for(const q of [...(s.peopleSpots||[]),...(s.furniture||[])])add([rectangle(q.position||q.point,.0018,.0018)]);}
for(const a of Object.values(boot.anchors))add([rectangle(mapXY(a.position),.004,.004)]);
const index=spatialIndex(obstacles),occupied=[],records={},geo=p=>[CENTER[0]+p[0]/5.8,CENTER[1]+p[1]/9.25];
for(const site of Object.values(catalog.records).filter(s=>['M4','M6','M7','M8','M9','M12'].includes(s.id)&&s.key!=='M7:nura')){
 const district=boot.districts.features.find(d=>d.id===site.district),nodes=[],radius=site.id==='M12'?.00065:.00125,desired=site.id==='M4'?5:3;
 // A deterministic spiral tries nearby open pockets; opposite sectors read as a
 // family around the hero, while the source geometry decides actual positions.
 for(let i=0;i<960&&nodes.length<desired;i++){
  const angle=i*2.399963229728653,range=.0055+(i%96)/95*.0135,p=[site.origin[0]+Math.cos(angle)*range,site.origin[1]+Math.sin(angle)*range],ring=rectangle(p,radius*2,radius*2),box=bounds(ring);
  if(!ring.every(q=>contains(district.geometry,geo(q)))||index(box).some(o=>polygonTouches([ring],o.rings,.00015))||occupied.some(o=>polygonTouches([ring],[o],.00025))||nodes.some(n=>Math.hypot(p[0]-n.point[0],p[1]-n.point[1])<.005))continue;
  nodes.push({point:[...p,.0004],radius});occupied.push(ring);
 }
 records[site.key]=nodes;
}
const result={version:1,source:'Existing prepared OSM geometry and resident environment; illustrative supporting spaces only.',records},file='src/world/context-sites.json';
if(process.argv.includes('--check'))assert.deepEqual(await read(file),result,'Supporting sites reproduce against full source clearance');else await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');
assert(Object.values(records).every(a=>a.length>=1),'Every standard parcel has distributed supporting spaces');
console.log(`PASS ${Object.values(records).flat().length} supporting spaces: district, buildings, water, streets, vegetation, interventions and resident clearance`);
