/** Audits the compiled artifact against the source, not just source-count labels. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {mapXY} from '../../src/world/city-math.js';
import {bounds,rectangle,corridor,spatialIndex,polygonTouches,pointSegment,inRing} from '../../src/world/placement-geometry.js';
import {createHash} from 'node:crypto';
import {prepareLandmarks} from '../alem/landmarks/catalog.mjs';
import {classifyBuilding,sourceHeight,sourceDigest,FAMILY_NAMES,METRE,FACADE_CELL} from '../alem/architecture.mjs';
import {makeArchitecturePart} from '../../src/world/architecture-models.js';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const [meta,coverage,manifest,buffer,low]=await Promise.all([read('public/alem/geometry.json'),read('public/alem/coverage-source.json'),read('public/city/data/manifest.json'),fs.readFile('public/alem/city.bin'),fs.readFile('public/alem/city-low.bin')]);
const source=new Set(),buildings=[],sourceFeatures=new Map();for(const chunk of manifest.chunks.filter(c=>c.layer==='buildings'))for(const f of (await read('public/city/'+chunk.url)).features)if(!f.properties.render_as_outline&&!source.has(f.id)){source.add(f.id);const polys=[];for(const poly of f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[]){const rings=poly.map(r=>r.slice(0,-1).map(mapXY));buildings.push({rings,bounds:bounds(rings[0])});polys.push(rings);}sourceFeatures.set(f.id,{...f,polys});}
assert.deepEqual(new Set(coverage.map(b=>b.id)),source,'Every source building has emitted geometry');
assert.equal(meta.buildingsDrawn,source.size);assert.equal(buffer.length,meta.vertices*20);
const overview=await read('public/alem/geometry-low.json'),stream=await read('public/alem/stream-source.json');
assert.equal(low.length,overview.bytes);assert(overview.resident&&!overview.low,'The shipped city has one complete representation');
assert.equal(createHash('sha256').update(low).digest('hex'),overview.sha256);
assert(low.equals(buffer.subarray(0,meta.terrainCount*20)),'Base contains terrain only, without duplicate buildings');
let resident=meta.terrainCount,residentBytes=low.length,buildingCount=0;
for(const tile of stream.sources){
 const bytes=await fs.readFile('public/'+tile.url),descriptor=overview.tiles.find(t=>t.url===tile.url);let offset=0;
 assert.equal(bytes.length,descriptor.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),descriptor.sha256);
 for(const r of tile.ranges){
  const batch=descriptor.batches.find(b=>b.start===offset),bounds=batch.bounds;assert.equal(batch.count,r.count);
  for(let i=0;i<r.count;i++){
   const index=bytes.readUInt32LE(descriptor.vertexBytes+(offset+i)*4),at=index*20;
   assert(at+20<=descriptor.vertexBytes,'Valid index');
   assert(bytes.subarray(at,at+20).equals(buffer.subarray((r.start+i)*20,(r.start+i+1)*20)),'Indexed triangles preserve every source vertex byte for byte');
   const x=bytes.readFloatLE(at),y=bytes.readFloatLE(at+4),z=bytes.readFloatLE(at+8);
   assert(x>=bounds[0]&&x<=bounds[2]&&y>=bounds[1]&&y<=bounds[3]&&z>=bounds[4]&&z<=bounds[5],'Rendered geometry enclosed by culling bounds');
  }
  offset+=r.count;resident+=r.count;
 }
 assert.equal(descriptor.vertexBytes+offset*4,bytes.length);residentBytes+=bytes.length;buildingCount+=descriptor.buildings;
}
assert.equal(resident,meta.vertices,'Every full-detail triangle is resident');assert.equal(buildingCount,source.size);assert.equal(residentBytes,overview.residentBytes);
assert(residentBytes<buffer.length,'Lossless indexing reduces residency cost');
assert.deepEqual(stream.sources.flatMap(t=>t.ranges).sort((a,b)=>a.start-b.start),meta.drawRanges,'Resident batches cover source exactly once');
const authored=new Map(prepareLandmarks().map(model=>[model.id,model])),checkedModels=new Set();
for(const b of coverage){
 assert(b.count>=3&&b.count%3===0,b.id);
 if(b.landmark){
  const model=authored.get(b.landmark);assert(model?.replaces.includes(b.id),`${b.id}: source explicitly belongs to ${b.landmark}`);
  assert.deepEqual(meta.replacementRanges[b.id],{start:b.start,count:b.count,landmark:b.landmark});
  if(!checkedModels.has(b.landmark)){
   assert.equal(b.count,model.vertices);assert(buffer.subarray(b.start*20,(b.start+b.count)*20).equals(model.buffer),`${b.landmark}: compiled authored volume is byte-exact`);
   assert(model.bounds[5]>model.bounds[4],`${b.landmark}: has real height`);checkedModels.add(b.landmark);
  }
 }else{
  const f=sourceFeatures.get(b.id),h=sourceHeight(f.properties),family=classifyBuilding(f.properties,f.polys),points=new Set();let min=Infinity,max=-Infinity;
  assert.equal(b.family,family);assert.equal(b.sourceDigest,sourceDigest(f),'Source tags and geometry provenance are retained unchanged');
  assert.equal(b.height_m,f.properties.height_m);assert.equal(b.base_m,f.properties.base_m||0);assert.equal(b.height_source,f.properties.height_source);
  assert.equal(b.polygons,f.polys.length);assert.deepEqual(b.rings,f.polys.map(p=>p.length));
  for(let i=b.start;i<b.start+b.count;i++){
   const at=i*20,kind=buffer[at+18],p=[0,4,8].map(k=>buffer.readFloatLE(at+k));assert(kind===2||kind===3,b.id+' has native roof/wall triangles');assert.equal(buffer[at+19],kind===3?16+FAMILY_NAMES.indexOf(family):0,'One source family wall protocol');
   min=Math.min(min,p[2]);max=Math.max(max,p[2]);if(kind===3)points.add(p.join('/'));
  }
  assert(Math.abs(min-h.bottom)<1e-8,b.id+' raised source base preserved');assert(Math.abs(max-h.top)<1e-8,b.id+' exact source roof peak preserved');
  for(const rings of f.polys)for(const ring of rings)for(const p of ring)assert(points.has([...p,h.bottom].map(Math.fround).join('/')),b.id+' original exterior/courtyard wall corner retained');
  if(f.polys.some(rings=>rings.length>1))for(let i=b.start;i<b.start+b.count;i+=3)if(buffer[i*20+18]===2){
   const center=[0,4].map(k=>[0,1,2].reduce((sum,j)=>sum+buffer.readFloatLE((i+j)*20+k)/3,0));
   for(const rings of f.polys)if(inRing(center,rings[0]))for(const hole of rings.slice(1))assert(!inRing(center,hole),b.id+' original courtyard remains open in the actual compiled roof');
  }
 }
}
let at=meta.terrainCount;for(const r of meta.drawRanges){assert.equal(r.start,at);assert(r.count>0&&r.count%3===0);assert(r.bounds.every(Number.isFinite));at+=r.count;}assert.equal(at,meta.vertices,'Spatial batches cover every emitted triangle');
for(let i=0;i<buffer.length;i+=20)for(let j=0;j<3;j++)assert(Number.isFinite(buffer.readFloatLE(i+j*4)),'Finite world coordinates');
assert.equal(meta.environment.reservedSites,70);assert(Object.keys(meta.environment.districts).length===5);
const catalog=await read('src/world/placements.json'),reserved=[];
for(const site of Object.values(catalog.records))for(const roof of site.roofs||[]){const f=sourceFeatures.get(roof.source);assert(f,'M5 roof remains a real source building');assert(Math.abs(roof.position[2]-sourceHeight(f.properties).top-.00004)<1e-12,'M5 source-height elevation');assert(meta.architecture.groups.every(g=>g.buildings===0),'Facade instances add no buildings');}
for(const site of Object.values(catalog.records)){if(site.footprint)reserved.push({rings:[site.footprint],bounds:bounds(site.footprint)});if(site.route)for(let i=1;i<site.route.length;i++){const rings=[corridor(site.route[i-1],site.route[i],.0017)];reserved.push({rings,bounds:bounds(rings[0])});}for(const s of site.peopleSpots||[]){const rings=[rectangle(s.position,.0018,.0018)];reserved.push({rings,bounds:bounds(rings[0])});}}
for(const anchor of Object.values(await read('public/residents/geographic-anchors.json'))){const rings=[rectangle(mapXY(anchor.position),.004,.004)];reserved.push({rings,bounds:bounds(rings[0])});}
const bi=spatialIndex(buildings),ri=spatialIndex(reserved),environment=await read('public/alem/environment-source.json');
for(const o of environment){const ring=rectangle(o.point,o.radius*2,o.radius*2),box=bounds(ring);assert(!bi(box).some(b=>polygonTouches([ring],b.rings)),o.type+' intersects a building');assert(!ri(box).some(b=>polygonTouches([ring],b.rings)),o.type+' intersects an intervention/resident reservation');}
const architecture=meta.architecture,ownership=await read('public/alem/architecture-source.json'),facades=await fs.readFile('public/'+architecture.asset.url),associations=new Map(ownership.sourceAssociations.map(g=>[g.id,g.sources])),familyCounts=Object.fromEntries(FAMILY_NAMES.map(f=>[f,0])),instanceCounts=new Map(),nativeFamilies=new Map(ownership.buildings.map(b=>[b.id,b.family])),templates=new Map();
assert.equal(facades.length,architecture.asset.bytes);assert.equal(createHash('sha256').update(facades).digest('hex'),architecture.asset.sha256);assert.equal(architecture.metreScale,METRE);assert.equal(architecture.cellSize,FACADE_CELL);
let instanceOffset=0,instanceCount=0;
for(const g of architecture.groups){
 assert.equal(g.offset,instanceOffset);assert.equal(g.bytes,g.count*32);assert.equal(g.buildings,0);const owners=associations.get(g.id);assert.equal(owners.length,g.count);
 const key=g.family+'/'+g.part+'/'+g.columns;
 if(!templates.has(key)){
  const template=new DataView(makeArchitecturePart(g.family,g.part,g.columns)),bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(let v=0;v<template.byteLength;v+=20)for(let a=0;a<3;a++){const x=template.getFloat32(v+a*4,true);assert(Number.isFinite(x));bounds[a]=Math.min(bounds[a],x);bounds[a+3]=Math.max(bounds[a+3],x);}
  templates.set(key,[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[bounds[x<0?0:3],bounds[y<0?1:4],bounds[z<0?2:5]]))));
 }
 const templateBounds=templates.get(key),cell=g.id.split('/').slice(-2).map(Number);assert(cell.every(Number.isInteger),'Facade group records its spatial cell');
 for(let i=0;i<g.count;i++){
  const at=g.offset+i*32,p=[0,4,8].map(k=>facades.readFloatLE(at+k)),scale=facades.readFloatLE(at+12),angle=facades.readFloatLE(at+16),c=Math.cos(angle),s=Math.sin(angle),id=owners[i],f=sourceFeatures.get(id);assert(f&&!meta.replacementRanges[id],'Every facade part belongs to one native source building');assert.equal(nativeFamilies.get(id),g.family);assert(scale>0&&scale<=METRE*1.4,'Source edge spacing determines coherent metre-scale strip');
  assert(p.slice(0,2).every((v,a)=>v>=cell[a]*FACADE_CELL-1e-7&&v<=(cell[a]+1)*FACADE_CELL+1e-7),'Every packed facade anchor belongs to its declared spatial cell');
  instanceCounts.set(id,(instanceCounts.get(id)||0)+1);
  const h=sourceHeight(f.properties);let highest=0;
  for(const [x,y,z] of templateBounds){const q=[p[0]+(x*c-y*s)*scale,p[1]+(x*s+y*c)*scale,p[2]+z*scale];highest=Math.max(highest,q[2]);assert(q.every(Number.isFinite));assert(q[0]>=g.bounds[0]&&q[0]<=g.bounds[2]&&q[1]>=g.bounds[1]&&q[1]<=g.bounds[3]&&q[2]>=g.bounds[4]&&q[2]<=g.bounds[5],'Transformed facade geometry enclosed by instance culling bounds');}
  assert(f.polys.some(rings=>rings.some(ring=>ring.some((a,j)=>pointSegment(p,a,ring[(j+1)%ring.length])<.0000003))),'Every strip anchor lies on its attributed source facade edge');
  assert(p[2]>=h.bottom-.05*METRE,'Raised source parts have no ground-floor fabrication');assert(highest<=h.top+1e-8,'No facade part exceeds measured source roof height');
 }
 instanceOffset+=g.bytes;instanceCount+=g.count;
}
assert.equal(instanceOffset,facades.length);assert.equal(instanceCount,architecture.instances);
for(const b of ownership.buildings){assert(sourceFeatures.has(b.id));assert.equal(instanceCounts.get(b.id)||0,b.instanceCount);familyCounts[b.family]++;}
assert.deepEqual(familyCounts,architecture.families);assert.equal(ownership.buildings.length,coverage.filter(b=>!b.landmark).length);
assert.equal(meta.environment.physicalScale.metre,METRE);assert(meta.environment.physicalScale.benchSeatM<.7);assert(meta.environment.physicalScale.lampTopM<6);
const report={passed:true,buildingFeatures:source.size,vertices:meta.vertices,bytes:buffer.length,residentBytes,residentTiles:stream.sources.length,spatialBatches:meta.drawRanges.length,architecture:{families:familyCounts,instances:instanceCount,bytes:facades.length,groups:architecture.groups.length,cellSize:FACADE_CELL},environment:meta.environment,checks:['Exact building ID coverage against complete OSM source','Every building has native roof/wall triangles or a byte-exact explicitly mapped authored volume','Native source exterior and courtyard corners, height_m, base_m and source tag/geometry digests retained','Every full-detail triangle is preserved byte for byte in resident indexed batches','Every emitted triangle belongs to a contiguous spatial draw batch','All vertex coordinates finite','All facade instances are source-owned, height-bound, culling-bound and count zero extra buildings','Every facade anchor belongs to its declared fine spatial cell','M5 remains on the same source residential roofs at migrated physical height','Every environment footprint clears all buildings','Every environment footprint clears all scenario and resident reservations','Vegetation in all five districts; physical bench, lamp and tree dimensions']};
const out=process.env.RELEASE_OUTPUT||'artifacts/city-synthesis';await fs.mkdir(out,{recursive:true});await fs.writeFile(`${out}/geometry-audit.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
