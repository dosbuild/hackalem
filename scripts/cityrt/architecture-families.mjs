import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mapXY} from '../../src/world/city-math.js';
import {FAMILY_NAMES} from '../alem/architecture.mjs';

/** Select real, source-owned buildings from this checkout for visual inspection. */
export async function architectureFamilies(root){
 const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
 const coverage=await read('public/alem/coverage-source.json');
 const owners=new Map(coverage.filter(record=>!record.landmark).map(record=>[record.id,record]));
 const manifest=await read('public/city/data/manifest.json'),selected=new Map();
 for(const chunk of manifest.chunks.filter(chunk=>chunk.layer==='buildings')){
  for(const feature of (await read('public/city/'+chunk.url)).features){
   const owner=owners.get(feature.id);if(!owner)continue;
   const geometry=feature.geometry;
   const polygons=(geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[]).map(polygon=>polygon.map(ring=>ring.slice(0,-1).map(mapXY)));
   const points=polygons.flat(2);if(!points.length)continue;
   const bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
   const span=Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1]);
   if(span<=0)continue;
   // A compact, readable real footprint; ties follow stable archive order.
   const score=Math.abs(Math.log(span/.006));
   if(selected.has(owner.family)&&selected.get(owner.family).score<=score)continue;
   selected.set(owner.family,{id:feature.id,family:owner.family,score,bounds,height_m:owner.height_m,base_m:owner.base_m,height_source:owner.height_source,tags:feature.properties.tags,rings:polygons.map(polygon=>polygon.map(ring=>ring.length)),zoom:Math.min(288,1.08/span),yaw:-.4});
  }
 }
 assert(FAMILY_NAMES.every(family=>selected.has(family)),'Prepared source contains every authored architectural family');
 return FAMILY_NAMES.map(family=>selected.get(family));
}
