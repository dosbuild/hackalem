import assert from 'node:assert/strict';
import {open,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as astana from '../../src/world/project-objects.js';
import * as khanate from '../../src/world/khanate/projects.js';
import {makeTemplate} from '../../src/world/khanate/models.js';
import {programSource} from '../../src/world/khanate/programs.js';
import {PROGRAM_METRE} from '../../src/world/astana-programs.js';

const surfaceKinds=[0,1,4,18,22],maxContextBytes=16*1024*1024;
const hash=data=>createHash('sha256').update(data).digest('hex');
const encoded=(data,provenance)=>({...provenance,bytes:data.byteLength,sha256:hash(data),data:data.toString('base64')});

function focusPoints(focus){
 const c=Math.cos(focus.orientation),s=Math.sin(focus.orientation),[x,y]=focus.center,[w,d]=focus.span;
 return [focus.bottom,focus.top].flatMap(z=>[-1,1].flatMap(X=>[-1,1].map(Y=>[x+X*w/2*c-Y*d/2*s,y+X*w/2*s+Y*d/2*c,z])));
}
/** A catalogue frame may visit an existing authored child without changing the
 * public parent/encounter. All measurements stay in native world coordinates. */
function refinementFocus(parent){
 const sites=astana.programSites(parent),U=PROGRAM_METRE;
 if(parent.id==='M10'){
  const lamps=astana.lampPositions(parent),pairs=lamps.slice(1).map((b,i)=>({lamps:[lamps[i],b],distance:Math.hypot(b[0]-lamps[i][0],b[1]-lamps[i][1]),index:i})).sort((a,b)=>a.distance-b.distance||a.index-b.index),pair=pairs[0];
  assert(pair,'Native route requires a connected pair of existing lamps');
  const [a,b]=pair.lamps,orientation=Math.atan2(b[1]-a[1],b[0]-a[0]),ground=a[2]-.0011;
  const focus={center:[(a[0]+b[0])/2,(a[1]+b[1])/2,ground+6*U],span:[pair.distance+20*U,36*U],orientation,bottom:ground,top:ground+13*U};
  return {siteId:parent.key,focus,illumination:{kind:'native-project-lamps',time:.63,lamps:pair.lamps},sources:[parent.source]};
 }
 if(parent.id==='M11'){
  const site=sites.find(s=>s.key.endsWith('crossing-1'));assert(site,'Native middle school crossing required');
  return {siteId:site.key,focus:{center:[...site.origin.slice(0,2),site.origin[2]+3*U],span:[60*U,38*U],orientation:site.orientation,bottom:site.origin[2],top:site.origin[2]+6*U},sources:[site.source]};
 }
 const site=sites.filter(s=>s.kind==='household-service').sort((a,b)=>Math.hypot(a.connection.points[1][0]-a.connection.points[0][0],a.connection.points[1][1]-a.connection.points[0][1])-Math.hypot(b.connection.points[1][0]-b.connection.points[0][0],b.connection.points[1][1]-b.connection.points[0][1])||a.key.localeCompare(b.key))[0];
 assert(site,'Real authored household utility connection required');
 const points=[...site.connection.points,site.wallPoint,...site.footprint],c=Math.cos(site.orientation),s=Math.sin(site.orientation);
 const local=points.map(p=>[(p[0]-site.origin[0])*c+(p[1]-site.origin[1])*s,-(p[0]-site.origin[0])*s+(p[1]-site.origin[1])*c]);
 const min=[0,1].map(i=>Math.min(...local.map(p=>p[i]))-5*U),max=[0,1].map(i=>Math.max(...local.map(p=>p[i]))+5*U),middle=[0,1].map(i=>(min[i]+max[i])/2);
 const focus={center:[site.origin[0]+middle[0]*c-middle[1]*s,site.origin[1]+middle[0]*s+middle[1]*c,site.origin[2]+4*U],span:[0,1].map(i=>Math.max(22*U,max[i]-min[i])),orientation:site.orientation,bottom:site.origin[2],top:site.origin[2]+8*U,cameraYaw:Math.atan2(site.wallPoint[0]-site.origin[0],site.wallPoint[1]-site.origin[1])};
 return {siteId:site.key,focus,buildingSources:[site.householdSource],selection:'authored-household-service',sources:[site.householdSource,...site.connection.sources]};
}

/** Only these supported previews acquire new context; the rooftop contract
 * remains exactly one original source building. */
export function previewContextRequest(mode,id,district){
 if(mode==='astana'&&id==='M5')return astana.projectPreviewFrame(astana.placements[`${id}:${district}`]).contextSources;
 if(!((mode==='astana'&&['M4','M2','M10','M11','M13'].includes(id))||(mode==='khanate'&&id==='M5')))return undefined;
 const projects=mode==='astana'?astana:khanate,scope=id==='M2'?'citywide':'district';
 const parent=projects.projectObjects({commitments:[{initiativeId:id,scope,...(scope==='district'?{districtId:district}:{})}]},[{id:district}])[0];
 if(mode==='khanate'){
  const host=projects.programSites(parent).find(site=>site.hostHomeId);
  assert(host,'Existing converted household required');
  return {kind:'native-household-instance',sources:[host.source],homeId:host.hostHomeId,variant:host.home.variant,transform:[...host.home.origin,host.home.scale,host.home.orientation,1,1,1]};
 }
 if(['M10','M11','M13'].includes(id)){
  const refinement=refinementFocus(parent),points=focusPoints(refinement.focus);
  return {kind:'native-surface-focus',...refinement,kinds:surfaceKinds,bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]};
 }
 const site=projects.programSites(parent)[0],points=projects.projectFocusBounds(parent);
 return {kind:'native-surface-focus',sources:[...new Set(site.sources??[site.source])],siteId:site.key,kinds:surfaceKinds,
  bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]};
}

function intersects(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];}
/** Complete native triangles retain their exact bytes. SAT rejects triangles
 * whose broad bounding box overlaps the focus but whose actual surface does not. */
function triangleTouches(points,bounds){
 if(!intersects([Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))],bounds))return false;
 const center=[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2],half=[(bounds[2]-bounds[0])/2,(bounds[3]-bounds[1])/2];
 for(let i=0;i<3;i++){const a=points[i],b=points[(i+1)%3],axis=[a[1]-b[1],b[0]-a[0]],values=points.map(p=>p[0]*axis[0]+p[1]*axis[1]),middle=center[0]*axis[0]+center[1]*axis[1],radius=Math.abs(axis[0])*half[0]+Math.abs(axis[1])*half[1];if(Math.max(...values)<middle-radius||Math.min(...values)>middle+radius)return false;}
 return true;
}

/** Replay an existing native yurt template at its shipped instance transform.
 * Appearance and variant come from bootstrap, never from a new preview design. */
function householdContext(request){
 const home=programSource.homes.find(h=>h.id===request.homeId);assert(home,'Unknown native host household');
 const template=Buffer.from(makeTemplate('yurt',home.variant)),data=Buffer.from(template);
 const transform=[...home.origin,home.scale,home.orientation,1,1,1],renderTransform=Array.from(new Float32Array(transform)),[x,y,z,scale,angle]=renderTransform,c=Math.cos(angle),s=Math.sin(angle);
 for(let at=0;at<data.length;at+=20){const X=template.readFloatLE(at),Y=template.readFloatLE(at+4),Z=template.readFloatLE(at+8),nx=template.readInt8(at+12),ny=template.readInt8(at+13);data.writeFloatLE(x+(X*c-Y*s)*scale,at);data.writeFloatLE(y+(X*s+Y*c)*scale,at+4);data.writeFloatLE(z+Z*scale,at+8);data.writeInt8(Math.max(-127,Math.min(127,Math.round(nx*c-ny*s))),at+12);data.writeInt8(Math.max(-127,Math.min(127,Math.round(nx*s+ny*c))),at+13);}
 return encoded(data,{kind:request.kind,sources:request.sources,homeId:home.id,variant:home.variant,transform,renderTransform,templateSha256:hash(template),method:'Shipped yurt template and bootstrap household instance; positions and normals follow the native instance shader.'});
}

/** Read only the selected native building triangles from the authoring mesh. */
export async function createNativePreviewContext({root=fileURLToPath(new URL('../../',import.meta.url))}={}){
 const coverage=JSON.parse(await readFile(resolve(root,'public/alem/coverage-source.json'),'utf8'));
 const metadata=JSON.parse(await readFile(resolve(root,'public/alem/geometry.json'),'utf8'));
 assert.equal(metadata.stride,20,'Native preview vertex stride');
 const bySource=new Map(coverage.map(record=>[record.id,record]));
 return async request=>{
  if(request?.kind==='native-household-instance')return householdContext(request);
  if(request?.kind==='native-surface-focus'){
   assert.deepEqual(request.kinds,surfaceKinds);assert(request.bounds.length===4&&request.bounds.every(Number.isFinite));
   const selected=metadata.drawRanges.filter(range=>intersects(range.bounds,request.bounds)),file=await open(resolve(root,'public/alem/city.bin'),'r');
   try{
    const pieces=[],output=Buffer.alloc(60*16384),chunk=Buffer.alloc(60*16384),kinds=new Set();let cursor=0,total=0,triangles=0;
    const flush=()=>{if(cursor){pieces.push(Buffer.from(output.subarray(0,cursor)));cursor=0;}};
    for(const range of selected){assert(range.start%3===0&&range.count%3===0,'Native surface triangle range');
     for(let vertex=range.start;vertex<range.start+range.count;){const length=Math.min(chunk.length,(range.start+range.count-vertex)*20),{bytesRead}=await file.read(chunk,0,length,vertex*20);assert.equal(bytesRead,length,'Complete native surface range');
      for(let at=0;at<length;at+=60){const kind=chunk[at+18];if(!surfaceKinds.includes(kind))continue;
       const points=[0,20,40].map(offset=>[chunk.readFloatLE(at+offset),chunk.readFloatLE(at+offset+4)]);
       if(!triangleTouches(points,request.bounds))continue;
       assert(total+60<=maxContextBytes,'Native preview context exceeds bounded 16 MiB crop');if(cursor+60>output.length)flush();chunk.copy(output,cursor,at,at+60);cursor+=60;total+=60;triangles++;kinds.add(kind);
      }vertex+=length/20;
     }
    }flush();assert(total>0,'Native source surfaces are required within the project focus');
    const surfaceBytes=total,buildings=[];
    for(const source of request.buildingSources||[]){
     const record=bySource.get(source);assert(record&&!record.landmark&&Number.isInteger(record.count)&&record.count>0,`Native connected household source: ${source}`);
     const piece=Buffer.alloc(record.count*metadata.stride);assert(total+piece.length<=maxContextBytes,'Native neighborhood exceeds bounded 16 MiB crop');
     const {bytesRead}=await file.read(piece,0,piece.length,record.start*metadata.stride);assert.equal(bytesRead,piece.length,'Complete native connected household');
     pieces.push(piece);total+=piece.length;triangles+=piece.length/60;buildings.push({source,bytes:piece.length,sha256:hash(piece)});
    }
    return encoded(Buffer.concat(pieces,total),{kind:request.kind,sources:request.sources,siteId:request.siteId,bounds:request.bounds,kinds:[...kinds].sort((a,b)=>a-b),triangles,authoringMesh:'alem/city.bin',...(request.focus?{focus:request.focus}:{}),...(request.illumination?{illumination:request.illumination}:{}),...(request.selection?{selection:request.selection}:{}),...(buildings.length?{surfaceBytes,buildings}:{}),method:'Exact complete native ground, water and street triangles intersecting the measured project focus; spatial authoring ranges streamed in 960 KiB chunks. Any connected household retains its exact complete original source-building range.'});
   }finally{await file.close();}
  }
  const sources=request;
  assert(Array.isArray(sources)&&sources.length>0&&new Set(sources).size===sources.length,'Exact native context sources');
  const file=await open(resolve(root,'public/alem/city.bin'),'r');
  try{
   const pieces=[];
   for(const source of sources){
    const record=bySource.get(source);
    assert(record&&!record.landmark&&Number.isInteger(record.start)&&record.start>=0&&Number.isInteger(record.count)&&record.count>0,`Native rooftop context source: ${source}`);
    const piece=Buffer.alloc(record.count*metadata.stride),{bytesRead}=await file.read(piece,0,piece.length,record.start*metadata.stride);
    assert.equal(bytesRead,piece.length,`Native rooftop context is complete: ${source}`);pieces.push(piece);
   }
   const data=Buffer.concat(pieces);
   return encoded(data,{kind:'native-source-building',sources});
  }finally{await file.close();}
 };
}
