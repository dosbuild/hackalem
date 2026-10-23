/** One complete city, at every scale. Geographic volumes + a batched authored environment. */
import {readFile,writeFile,mkdir,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import earcut from 'earcut';
import {mapXY,normalize,cross,contains,CENTER} from '../../src/world/city-math.js';
import {DISTRICT_COLORS} from '../../src/world/district-colors.js';
import {PALETTE} from '../../src/design/palette.js';
import {rgb,material} from './city-style.mjs';
import {buildTerrain} from './terrain.mjs';
import {buildEnvironment} from './environment.mjs';
import {writeResidentCity} from './resident.mjs';
import {prepareLandmarks,publicLandmarks} from './landmarks/catalog.mjs';
import {emitBuilding,createFacadeInstances,sourceDigest,roofForm,FACADE_CELL} from './architecture.mjs';
import {rebaseRoofPlacements,rebaseGroundPlacements} from './rebase-roofs.mjs';
const base=new URL('../../public/city/',import.meta.url),out=new URL('../../public/alem/',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,base),'utf8'));
const manifest=await read('data/manifest.json'),districts=await read('data/districts.geojson');
const buffers=[];let bytes=Buffer.allocUnsafe(20*400000),cursor=0,total=0;
const buildingCoverage=[];
const counts={},seen=new Set(),features=[],ranges=[],replacementRanges={};
const landmarkModels=prepareLandmarks(),landmarks=publicLandmarks(landmarkModels);
const replacementIds=new Set(landmarkModels.flatMap(model=>model.replaces));
const districtAt=p=>districts.features.find(d=>contains(d.geometry,[CENTER[0]+p[0]/5.8,CENTER[1]+p[1]/9.25]))?.id;
function vertex(p,n,c,kind,style=0){if(cursor+20>bytes.length){buffers.push(bytes.subarray(0,cursor));bytes=Buffer.allocUnsafe(20*400000);cursor=0;}for(let i=0;i<3;i++)bytes.writeFloatLE(p[i],cursor+i*4);for(let i=0;i<3;i++)bytes.writeInt8(Math.round(n[i]*127),cursor+12+i);for(let i=0;i<3;i++)bytes[cursor+15+i]=Math.round(c[i]);bytes[cursor+18]=kind;bytes[cursor+19]=style;cursor+=20;total++;}
function tri(a,b,c,col,kind=0,normal,style=0){const n=normal||normalize(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])));if(Array.isArray(n[0])){vertex(a,n[0],col,kind,style);vertex(b,n[1],col,kind,style);vertex(c,n[2],col,kind,style);}else{vertex(a,n,col,kind,style);vertex(b,n,col,kind,style);vertex(c,n,col,kind,style);}}
function quad(a,b,c,d,col,kind=0,style=0,normals){tri(a,b,c,col,kind,normals?[normals[0],normals[1],normals[2]]:undefined,style);tri(a,c,d,col,kind,normals?[normals[0],normals[2],normals[3]]:undefined,style);}
function surface(a,b,c,col,h,kind){tri([...a,h],[...b,h],[...c,h],col,kind,[0,0,1]);}
function fill(rings,col,h,kind){const flat=rings.flat(),holes=[];let n=rings[0].length;for(const r of rings.slice(1)){holes.push(n);n+=r.length;}const ids=earcut(flat.flat(),holes,2);for(let i=0;i<ids.length;i+=3)surface(flat[ids[i]],flat[ids[i+1]],flat[ids[i+2]],col,h,kind);}
function ribbon(line,width,col,h,kind){for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!l)continue;const dx=-(b[1]-a[1])/l*width,dy=(b[0]-a[0])/l*width;quad([a[0]+dx,a[1]+dy,h],[a[0]-dx,a[1]-dy,h],[b[0]-dx,b[1]-dy,h],[b[0]+dx,b[1]+dy,h],col,kind);}}
for(const chunk of manifest.chunks){const data=await read(chunk.url);for(const f of data.features){const key=chunk.layer+f.id;if(seen.has(key))continue;seen.add(key);if(chunk.layer==='buildings'&&f.properties.render_as_outline)continue;counts[chunk.layer]=(counts[chunk.layer]||0)+1;const g=f.geometry;
 const polys=(g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]).map(poly=>poly.map(r=>r.slice(0,-1).map(mapXY)).filter(r=>r.length>=3)).filter(p=>p.length);
 const lines=(g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[]).map(l=>l.map(mapXY));
 features.push({id:f.id,props:f.properties,layer:chunk.layer,polys,lines,...(chunk.layer==='buildings'?{sourceDigest:sourceDigest(f)}:{})});
}}
const terrain=buildTerrain({features,districtAt,quad,fill});
const districtRanges={};
for(const d of districts.features){const start=total,col=rgb(DISTRICT_COLORS[d.id]);for(const poly of d.geometry.type==='Polygon'?[d.geometry.coordinates]:d.geometry.coordinates)fill(poly.map(r=>r.slice(0,-1).map(mapXY)),col,0,10);districtRanges[d.id]={start,count:total-start,color:DISTRICT_COLORS[d.id]};}
const groundCount=total;
const terrainCount=total;
const placementUrl=new URL('../../src/world/placements.json',import.meta.url),placements=JSON.parse(await readFile(placementUrl,'utf8'));
const roofRebase=rebaseRoofPlacements(placements,features.filter(f=>f.layer==='buildings'));
const groundRebase=rebaseGroundPlacements(placements);
if(roofRebase.changed||groundRebase.changed)await writeFile(placementUrl,JSON.stringify(placements)+'\n');
const roofReservations=new Set(Object.values(placements.records).flatMap(r=>(r.roofs||[]).map(x=>x.source)));
const facades=createFacadeInstances();
const emitRoofDescription=(f,rings,family)=>roofForm(f.props,rings,family,roofReservations.has(f.id)).shape;
function polygon(rings,props,layer){const t=props.tags||{};
 const h=layer==='water'?.000010:.000006;
 const col=layer==='water'?rgb(PALETTE.water):rgb(t.leisure==='park'||t.landuse==='grass'?'9aa58a':t.natural==='wetland'?'91a397':t.landuse==='forest'||t.natural==='wood'?'82977e':'a2ac91');
 fill(rings,col,h,layer==='water'?1:0);
}
function road(line,props,layer){const tags=props.tags||{},water=layer==='water',major=['motorway','trunk','primary','secondary'].includes(tags.highway),walking=['path','footway','cycleway','steps','track','pedestrian'].includes(tags.highway);if(tags.tunnel==='yes'||tags.location==='underground')return;
 const width=water?.00055:major?.00036:walking?.00007:.00017;
 if(!water&&!walking)ribbon(line,width+.00012,rgb(PALETTE.paving),.000018,18);
 ribbon(line,width,rgb(water?PALETTE.water:walking?PALETTE.path:major?PALETTE.road:'a1a699'),water?.000010:.000023,water?1:4);
 if(major){for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let at=.0006;at<len-.0005;at+=.0016){const p=[a[0]+(b[0]-a[0])*at/len,a[1]+(b[1]-a[1])*at/len],q=[a[0]+(b[0]-a[0])*(at+.00055)/len,a[1]+(b[1]-a[1])*(at+.00055)/len];ribbon([p,q],.000022,rgb('d4cfad'),.000025,22);}}}
}
// Spatial batches retain every volume; the camera can reject invisible batches at close range.
const groups=new Map();for(const f of features){const p=f.polys[0]?.[0]?.[0]||f.lines[0]?.[0]||[0,0],key=f.layer+'/'+Math.floor(p[0]/.12)+'/'+Math.floor(p[1]/.12);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);}
for(const group of groups.values()){const start=total,b=[Infinity,Infinity,-Infinity,-Infinity];for(const f of group){if(f.layer==='buildings'&&replacementIds.has(f.id))continue;const from=total,family=f.layer==='buildings'?facades.building(f,material(f.props,districtAt(f.polys[0][0][0])),roofReservations.has(f.id)):null;for(const p of f.polys){if(family)emitBuilding({rings:p,props:f.props,family,material:material(f.props,districtAt(p[0][0]),family),reserved:roofReservations.has(f.id),tri,quad,fill});else polygon(p,f.props,f.layer);}for(const l of f.lines)road(l,f.props,f.layer);for(const p of [...f.polys.flat(2),...f.lines.flat()]){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}if(f.layer==='buildings')buildingCoverage.push({id:f.id,start:from,count:total-from,family,height_m:f.props.height_m,base_m:f.props.base_m||0,height_source:f.props.height_source,sourceDigest:f.sourceDigest,polygons:f.polys.length,rings:f.polys.map(p=>p.length),roof:f.polys.map(p=>emitRoofDescription(f,p,family))});}if(total>start)ranges.push({start,count:total-start,bounds:b,buildings:group.filter(f=>f.layer==='buildings'&&!replacementIds.has(f.id)).length});}
// Authored architecture replaces the corresponding survey volumes exactly once.
// Source coverage remains explicit even when one model represents many parts.
const presentBuildings=new Set(features.filter(f=>f.layer==='buildings').map(f=>f.id));
for(const model of landmarkModels){
 const start=total,replaces=model.replaces.filter(id=>presentBuildings.has(id));
 buffers.push(bytes.subarray(0,cursor),model.buffer);bytes=Buffer.allocUnsafe(20*400000);cursor=0;total+=model.vertices;
 ranges.push({start,count:model.vertices,bounds:model.bounds,buildings:replaces.length,landmark:model.id});
 for(const id of replaces){buildingCoverage.push({id,start,count:model.vertices,landmark:model.id});replacementRanges[id]={start,count:model.vertices,landmark:model.id};}
}
const baseCount=total;
const anchors=JSON.parse(await readFile(new URL('../../public/residents/geographic-anchors.json',import.meta.url),'utf8'));

const environment=buildEnvironment({features,anchors,placements:placements.records,landmarkReservations:landmarkModels.filter(m=>!m.transit||m.station).map(m=>{const margin=(m.landscapeClearanceM||0)/12000;return m.bounds.map((v,i)=>i<4?v+(i<2?-margin:margin):v);}),districtAt,tri,quad,fill,ribbon,total:()=>total,ranges});
const environmentObjects=environment.objects;delete environment.objects;
buffers.push(bytes.subarray(0,cursor));await mkdir(out,{recursive:true});const packed=Buffer.concat(buffers);await writeFile(new URL('environment-source.json',out),JSON.stringify(environmentObjects));
const facadeData=facades.finish(),facadeHash=createHash('sha256').update(facadeData.buffer).digest('hex'),facadeFile=`facades-${facadeHash.slice(0,20)}.bin`;
for(const name of await readdir(out))if(/^facades-[a-f0-9]{20}\.bin$/.test(name)&&name!==facadeFile)await unlink(new URL(name,out));
await writeFile(new URL(facadeFile,out),facadeData.buffer);
await writeFile(new URL('architecture-source.json',out),JSON.stringify({version:1,metreScale:1/12000,sourceAssociations:facadeData.association,buildings:facadeData.sources,roofRebase,groundRebase}));
const groupsBytes=Buffer.from(JSON.stringify(facadeData.groups)),groupsHash=createHash('sha256').update(groupsBytes).digest('hex'),groupsFile=`facade-groups-${groupsHash.slice(0,20)}.json`;
for(const name of await readdir(out))if(/^facade-groups-[a-f0-9]{20}\.json$/.test(name)&&name!==groupsFile)await unlink(new URL(name,out));
await writeFile(new URL(groupsFile,out),groupsBytes);
const groupsAsset={url:'alem/'+groupsFile,bytes:groupsBytes.length,sha256:groupsHash,gzip:true};
const architecture={version:1,metreScale:1/12000,cellSize:FACADE_CELL,asset:{url:'alem/'+facadeFile,bytes:facadeData.buffer.length,sha256:facadeHash,gzip:true},groups:facadeData.groups,groupsAsset,groupCount:facadeData.groups.length,instances:facadeData.count,windows:facadeData.windowCount,families:facadeData.families,templateVertices:facadeData.templateVertices,source:'Original parts placed on attributed source facade edges; no added building count.'};
const metadata={vertices:total,groundCount,terrainCount,baseCount,districtRanges,stride:20,low:false,replacementRanges,counts,drawRanges:ranges,environment,architecture,landmarks,landmarkModels:landmarkModels.length,landmarkVertices:landmarkModels.reduce((n,m)=>n+m.vertices,0),source:manifest.source,projection:'Local planar city; center 71.431,51.139; x 5.8, y 9.25 per degree; source height_m and base_m at uniform 1/12000 metre scale, without artificial height relief',completeCity:true,terrain,buildingFeatures:counts.buildings,buildingsDrawn:buildingCoverage.filter(b=>b.count>0).length};
if(metadata.buildingsDrawn!==counts.buildings)throw Error('A building was lost during compilation');await writeFile(new URL('coverage-source.json',out),JSON.stringify(buildingCoverage));
await writeFile(new URL('city.bin',out),packed);
const overview=await writeResidentCity({out,packed,metadata});
await writeFile(new URL('city-low.bin',out),await readFile(new URL(overview.url.slice(5),out)));
await writeFile(new URL('geometry.json',out),JSON.stringify(metadata,null,2));
await writeFile(new URL('geometry-low.json',out),JSON.stringify(overview,null,2));
await writeFile(new URL('landmarks.json',out),JSON.stringify({version:1,landmarks,models:landmarkModels.map(({id,replaces,bounds,vertices,station})=>({id,replaces,bounds,vertices,station:!!station})),referencePolicy:'Original geometry derived from photographs and attributed survey data. Reference photos are not runtime textures.'},null,2));
// Publish the narrow derived rail database alongside its ODbL attribution.
await writeFile(new URL('lrt-route.json',out),await readFile(new URL('../../src/world/lrt-route.json',import.meta.url)));
const inputs={metadata:'alem/geometry-low.json',districts:'city/data/districts.geojson',anchors:'residents/geographic-anchors.json'};
const bootstrap=Object.fromEntries(await Promise.all(Object.entries(inputs).map(async([key,path])=>[key,JSON.parse(await readFile(new URL('../../public/'+path,import.meta.url),'utf8'))])));
// Preserve full placement records in authoring metadata, but stream them outside JavaScript.
delete bootstrap.metadata.architecture.groups;
const englishDistrictNames={esil:'Esil',almaty:'Almaty',saryarka:'Saryarka',baikonur:'Baikonur',nura:'Nura'};
for(const district of bootstrap.districts.features){district.properties.name=englishDistrictNames[district.id];district.properties.identity=englishDistrictNames[district.id];district.properties.boundary_label='OSM boundary · within this view';}
for(const anchor of Object.values(bootstrap.anchors))anchor.note='Illustrative location on pedestrian geometry; not an address or a verified entrance, stop or crossing.';
await writeFile(new URL('../../src/world/bootstrap.json',import.meta.url),JSON.stringify(bootstrap)+'\n');
// The interactive loading map needs only the exact source district boundaries.
// Importing the full bootstrap made it wait for every facade placement group.
await writeFile(new URL('../../src/world/preview-districts.json',import.meta.url),JSON.stringify(bootstrap.districts)+'\n');
console.log(JSON.stringify({vertices:total,megabytes:total*20/1e6,counts,environment},null,2));
