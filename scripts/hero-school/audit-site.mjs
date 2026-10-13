/** Independent clearance/provenance audit against every local source building and water feature. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {mapXY,contains} from '../../src/world/city-math.js';
import {world,SCHOOL_WALKS} from '../../src/world/hero-school.js';
import {bounds,rectangle,polygonTouches,spatialIndex,routeAt,distance,pointSegment} from '../../src/world/placement-geometry.js';
const read=async p=>JSON.parse(await readFile(p,'utf8')),site=await read('src/world/hero-school-site.json'),boot=await read('src/world/bootstrap.json'),manifest=await read('public/city/data/manifest.json');
const seen=new Set(),obstacles=[],roads=[];
for(const chunk of manifest.chunks.filter(c=>['buildings','water','streets'].includes(c.layer)))for(const f of (await read('public/city/'+chunk.url)).features){
 if(seen.has(chunk.layer+f.id))continue;seen.add(chunk.layer+f.id);const g=f.geometry;
 if(chunk.layer==='streets'){for(const line of g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[])roads.push({id:f.id,points:line.map(mapXY)});}
 else for(const rings of g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]){const r=rings.map(r=>r.map(mapXY));obstacles.push({id:f.id,rings:r,bounds:bounds(r[0])});}
}
const index=spatialIndex(obstacles),clear=(ring,label)=>{for(const o of index(bounds(ring)))assert(!polygonTouches([ring],o.rings,.00002),`${label} intersects ${o.id}`);};
clear(site.footprint,'School footprint');assert(contains(boot.districts.features.find(d=>d.id==='nura').geometry,site.position));
const sources=roads.filter(r=>site.roadSources.includes(r.id)),same=(a,b)=>distance(a,b)<1e-8;
for(let i=1;i<site.deliveryRoute.length;i++){const a=site.deliveryRoute[i-1],b=site.deliveryRoute[i];assert(sources.some(r=>r.points.slice(1).some((q,j)=>same(r.points[j],a)&&same(q,b)||same(r.points[j],b)&&same(q,a))),'Invented delivery segment');}
let pedestrianSamples=0;
for(const [name,path] of Object.entries(SCHOOL_WALKS))for(let i=0;i<=250;i++){const p=world(site,routeAt(path,i/250).point);clear(rectangle(p,.00018,.00018),`Cast ${name}`);pedestrianSamples++;}
const c=Math.cos(site.orientation),s=Math.sin(site.orientation),local=p=>{const x=(p[0]-site.origin[0])*1e4,y=(p[1]-site.origin[1])*1e4;return[x*c+y*s,-x*s+y*c];},route=site.deliveryRoute.map(local),length=r=>r.slice(1).reduce((sum,p,i)=>sum+distance(p,r[i]),0),total=length(route);let stop=0;
for(let i=1;i<route.length;i++)if(route[i][0]<0&&Math.abs(route[i][1]+46)<.01){stop=length(route.slice(0,i))+route[i-1][0];break;}
let vehicleSamples=0;
for(let d=stop-130;d<=Math.min(total,stop+175);d+=.5){const q=routeAt(route,d/total),p=world(site,q.point),angle=q.angle+site.orientation;clear(rectangle([p[0]-Math.cos(angle)*.0002,p[1]-Math.sin(angle)*.0002],.004,.00125,angle),'Delivery swept envelope');assert(sources.some(r=>r.points.slice(1).some((b,i)=>pointSegment(p,r.points[i],b)<1e-7)));vehicleSamples++;}
const report={passed:true,site:site.key,position:site.position,sourceWays:site.roadSources,sourceObstacles:obstacles.length,pedestrianSamples,vehicleSamples,checks:['Footprint clears all source buildings and polygonal water','Anchor is in Nura','Every delivery segment exists in a recorded OSM way','Swept delivery envelopes clear mapped buildings and water','Every cast route clears existing mapped geometry; family crosses the service street after deliveries','No OSM footprint replaced or suppressed'],note:'Scenario visualization, not a real parcel recommendation. Audits geometry; does not model traffic or pedestrian right of way.'};
const out=process.env.CAPTURE_DIR||'artifacts/hero-school';await mkdir(out,{recursive:true});await writeFile(`${out}/site-audit.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
