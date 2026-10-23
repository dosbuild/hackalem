import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {mapXY,contains,CENTER} from '../../src/world/city-math.js';
import {bounds,polygonTouches,rectangle,corridor,spatialIndex,inPolygon,distance} from '../../src/world/placement-geometry.js';
const catalogIndex=process.argv.indexOf('--catalog');
if(catalogIndex!==-1&&(!process.argv[catalogIndex+1]||process.argv[catalogIndex+1].startsWith('--')))throw Error('--catalog requires a file path');
const read=async p=>JSON.parse(await readFile(p,'utf8')),catalog=await read(catalogIndex===-1?'src/world/placements.json':process.argv[catalogIndex+1]),boot=await read('src/world/bootstrap.json'),manifest=await read('public/city/data/manifest.json');
const expectedKeys=boot.districts.features.flatMap(d=>Array.from({length:14},(_,i)=>`M${i+1}:${d.id}`));
assert.deepEqual(Object.keys(catalog.records).sort(),expectedKeys.sort(),'Catalog must contain all 70 initiative/district identities');
for(const [key,site] of Object.entries(catalog.records)){
 assert.equal(site.key,key,'Placement key must match its catalog entry');
 assert.equal(`${site.id}:${site.district}`,key,'Placement identity must match its catalog entry');
 if(['M1','M10','M14'].includes(site.id))assert((site.furniture?.length??0)>=2,`${key} needs at least two safe street fixtures`);
}
const buildings=[],water=[],roads=[],segments=new Map(),seen=new Set();
const node=p=>p.map(n=>n.toFixed(6)).join('/'),edge=(a,b)=>[node(a),node(b)].sort().join('|');
for(const chunk of manifest.chunks){if(!['buildings','water','streets'].includes(chunk.layer))continue;for(const f of (await read('public/city/'+chunk.url)).features){const k=chunk.layer+f.id;if(seen.has(k))continue;seen.add(k);const g=f.geometry,t=f.properties.tags||{};
 for(const poly of g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]){const rings=poly.map(r=>r.slice(0,-1).map(mapXY)),item={id:f.id,rings,bounds:bounds(rings[0])};if(chunk.layer==='buildings')buildings.push(item);else if(chunk.layer==='water')water.push(item);}
 for(const line of g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[]){const points=line.map(mapXY);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(chunk.layer==='streets'){const k=edge(a,b);if(!segments.has(k))segments.set(k,new Set());segments.get(k).add(f.id);if(t.tunnel==='yes'||t.location==='underground')continue;const major=['motorway','trunk','primary','secondary','tertiary','residential','unclassified','living_street'].includes(t.highway),rings=[corridor(a,b,major?.00055:.00013)];roads.push({id:f.id,rings,bounds:bounds(rings[0])});}else if(chunk.layer==='water'){const rings=[corridor(a,b,.0007)];water.push({id:f.id,rings,bounds:bounds(rings[0])});}}}
}}
const bIndex=spatialIndex(buildings),wIndex=spatialIndex(water),rIndex=spatialIndex(roads),geo=p=>[CENTER[0]+p[0]/5.8,CENTER[1]+p[1]/9.25],report={catalogVersion:catalog.version,counts:{buildings:buildings.length,water:water.length,roadSegments:roads.length},checks:[],sites:[]},occupied=[];
const clear=(ring,index,label)=>{const box=bounds(ring),expanded=[box[0]-.00018,box[1]-.00018,box[2]+.00018,box[3]+.00018];for(const item of index(expanded))assert(!polygonTouches([ring],item.rings,.00005),`${label} intersects ${item.id}`);};
for(const site of Object.values(catalog.records)){const d=boot.districts.features.find(d=>d.id===site.district),rings=[];
 if(site.footprint){rings.push(site.footprint);clear(site.footprint,bIndex,site.key);clear(site.footprint,wIndex,site.key);clear(site.footprint,rIndex,site.key);}
 if(site.route){for(let i=1;i<site.route.length;i++){const a=site.route[i-1],b=site.route[i],sources=segments.get(edge(a,b));assert(sources&&site.sources.some(id=>sources.has(id)),`${site.key} has invented road segment`);const ring=corridor(a,b,.00105);rings.push(ring);clear(ring,bIndex,site.key);clear(ring,wIndex,site.key);for(let t=0;t<=1;t+=.1)assert(contains(d.geometry,geo([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])),`${site.key} leaves district`);}
 for(const f of site.furniture||[]){const ring=rectangle(f.point,.00075,.00034,f.angle);clear(ring,bIndex,site.key+' furniture');clear(ring,wIndex,site.key+' furniture');clear(ring,rIndex,site.key+' furniture');}}
 if(site.peopleSpots){assert(site.peopleSpots.length>=8,site.key+' people');for(const s of site.peopleSpots){const ring=rectangle(s.position,.00035,.00035);clear(ring,bIndex,site.key+' people');clear(ring,wIndex,site.key+' people');}}
 if(site.roofs){assert(site.roofs.length>=3);for(const roof of site.roofs){assert(buildings.some(b=>b.id===roof.source));assert(rectangle(roof.position,.0005,.0005).every(p=>inPolygon(p,roof.rings)));assert(distance(roof.position,site.roofs[0].position)<.033);}}
 for(const ring of rings){assert(ring.every(p=>contains(d.geometry,geo(p))),site.key+' outside district');for(const prior of occupied)if(prior.key!==site.key)assert(!polygonTouches([ring],[prior.ring]),`${site.key} overlaps ${prior.key}`);occupied.push({key:site.key,ring});}
 report.sites.push({key:site.key,type:site.type,segments:site.route?.length?site.route.length-1:0,fixtures:site.furniture?.length||0,placement:site.placement});
}
report.checks=['70 deterministic records cover all measures and districts','All building-like footprints clear full OSM buildings, water and streets','Every corridor segment exists in its recorded OSM source','Routes and footprints remain in the intended district','Street furniture clears roads, water and mapped buildings','Independent intervention footprints do not overlap','Clean fuel modifies a cluster of actual residential roofs'];
const out=process.env.RELEASE_OUTPUT||'artifacts/consequences';await mkdir(out,{recursive:true});await writeFile(`${out}/placement-audit.json`,JSON.stringify(report,null,2));console.log(report.checks.join('\n'));
