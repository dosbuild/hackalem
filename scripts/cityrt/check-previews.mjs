/** CPU audit of Alem's own-model preview provenance and published images. */
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,relative,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createNativePreviewContext,previewContextRequest} from './preview-context.mjs';
import * as astana from '../../src/world/project-objects.js';
import * as khanate from '../../src/world/khanate/projects.js';
import {Mesh} from '../../src/world/mesh-kit.js';
import {programStatic} from '../../src/world/astana-programs.js';
import {routeAt} from '../../src/world/placement-geometry.js';
import {cameraFrame} from '../../src/world/projection.js';

const projectRoot=fileURLToPath(new URL('../../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const districts=['esil','almaty','saryarka','baikonur','nura'];
export const previewPaths=['astana','khanate'].flatMap(mode=>Array.from({length:14},(_,index)=>districts.map(district=>`${mode}/M${index+1}-${district}.webp`)).flat());

function checkContext(context,request,image){
 const label=image.path;
 assert(context&&Array.isArray(context.sources)&&Number.isInteger(context.bytes)&&context.bytes>0&&context.bytes%60===0&&context.bytes<=16*1024*1024&&/^[a-f0-9]{64}$/.test(context.sha256),`Native context provenance: ${label}`);
 assert.deepEqual(context.sources,Array.isArray(request)?request:request.sources,`Exact focused context sources: ${label}`);
 if(Array.isArray(request)){
  assert(context.kind==='native-source-building'&&context.sources.length===1&&/^way\/[0-9]+$|^relation\/[0-9]+$/.test(context.sources[0]),`Exactly one original native rooftop source: ${label}`);return;
 }
 if(request.kind==='native-household-instance'){
  assert(context.kind===request.kind&&context.homeId===request.homeId&&context.variant===request.variant&&context.transform?.length===8&&context.renderTransform?.length===8&&context.transform.every(Number.isFinite)&&/^[a-f0-9]{64}$/.test(context.templateSha256),`Native existing host household: ${label}`);
  assert.deepEqual(context.transform,request.transform,`Original native household transform: ${label}`);
  assert.deepEqual(context.renderTransform,Array.from(new Float32Array(request.transform)),`Native renderer instance precision: ${label}`);return;
 }
 assert(context.kind===request.kind&&context.siteId===request.siteId&&context.authoringMesh==='alem/city.bin'&&context.triangles===context.bytes/60&&context.kinds.length>0&&context.kinds.every(kind=>request.kinds.includes(kind)),`Native focused surface triangles: ${label}`);
 assert.deepEqual(context.bounds,request.bounds,`Physical source context crop: ${label}`);
 assert(image.initiativeId==='M13'?context.kinds.some(kind=>kind===4||kind===18):context.kinds.includes(image.initiativeId==='M4'?0:4),`Actual park ground or mapped street approach: ${label}`);
 if(request.buildingSources){
  assert.deepEqual(context.buildings?.map(b=>b.source),request.buildingSources,`Actual receiving household buildings: ${label}`);
  assert(context.surfaceBytes>0&&context.surfaceBytes%60===0&&context.surfaceBytes+context.buildings.reduce((n,b)=>n+b.bytes,0)===context.bytes&&context.buildings.every(b=>b.bytes>0&&b.bytes%60===0&&/^[a-f0-9]{64}$/.test(b.sha256)),`Complete native household and neighborhood bytes: ${label}`);
 }else assert(!context.buildings,`No extra native buildings: ${label}`);
 if(request.focus){
  assert.deepEqual(context.focus,request.focus,`Authored physical neighborhood frame: ${label}`);
  const p=image.presentation;assert(p?.kind==='native-physical-neighborhood'&&p.siteId===request.siteId,`Actual focused native program presentation: ${label}`);
  assert.deepEqual(p.focus,request.focus,`Final native model frame: ${label}`);
  assert(p.exposure&&[p.exposure.left,p.exposure.right,p.exposure.top,p.exposure.bottom].every(Number.isFinite)&&p.exposure.left>=0&&p.exposure.right<=480&&p.exposure.top>=0&&p.exposure.bottom<=288,`Actual physical focus exposure: ${label}`);
  const model=p.model;assert(model&&model.bytes===image.modelBytes&&model.fullBytes>=model.bytes&&/^[a-f0-9]{64}$/.test(model.sha256)&&/^[a-f0-9]{64}$/.test(model.fullSha256),`Unchanged native final model provenance: ${label}`);
  assert.equal(model.kind,image.initiativeId==='M13'?'exact-final-program-site':'full-native-project',`Native model selection: ${label}`);
  if(image.initiativeId==='M13'){
   const box=p.modelExposure;assert(box&&box.right-box.left>=40&&box.bottom-box.top>=24&&box.left>=0&&box.right<=480&&box.top>=0&&box.bottom<=288,`Readable native household utility kit: ${label}`);
   assert.equal(context.selection,'authored-household-service',`Existing utility connection selected: ${label}`);
  }
  if(request.illumination){assert.deepEqual(context.illumination,request.illumination);assert.deepEqual(p.illumination,request.illumination,`Actual native night lamps: ${label}`);}
  else assert(!context.illumination&&!p.illumination,`No unrequested lighting override: ${label}`);
 }else assert(!image.presentation,`No new physical framing for unchanged preview: ${label}`);
}

/** Exercise the actual studio's mesh selection and camera math with an inert
 * renderer. It opens no browser, creates no GL context and exports no image. */
export async function checkPreviewContextContracts({root=projectRoot}={}){
 const studio=await readFile(resolve(root,'scripts/cityrt/preview-studio.html'),'utf8'),start=studio.indexOf('window.exportPreview='),end=studio.indexOf('\ndocument.body.dataset.ready',start);
 assert(start>0&&end>start,'Native preview studio entrypoint');
 const helpers=studio.slice(studio.indexOf('function closeFocus'),start),body=studio.slice(start+'window.exportPreview='.length,end);
 const renderer={replaceProjects(){},draw(){},prepared(){}},canvas={toDataURL(){return 'CPU contract check; no image';}};
 const exportPreview=new Function('astana','khanate','Mesh','programStatic','routeAt','cameraFrame','crypto','renderer','canvas','const previewZoomLimit=3200;'+helpers+'return '+body)(astana,khanate,Mesh,programStatic,routeAt,cameraFrame,globalThis.crypto,renderer,canvas);
 const native=await createNativePreviewContext({root});let contexts=0,bytes=0,refinements=0;
 for(const path of previewPaths){
  const [mode,name]=path.split('/'),[initiativeId,districtFile]=name.split('-'),districtId=districtFile.slice(0,-5),request=previewContextRequest(mode,initiativeId,districtId);
  if(!request)continue;
  const context=await native(request),result=await exportPreview(mode,initiativeId,districtId,context);
  assert.equal(sha(Buffer.from(context.data,'base64')),context.sha256,`Exact native context payload: ${path}`);
  checkContext(context,request,{path,mode,initiativeId,districtId,modelBytes:result.bytes,presentation:result.presentation});
  contexts++;bytes+=context.bytes;if(request.focus)refinements++;
 }
 assert.equal(contexts,35,'Exactly the existing twenty and fifteen supported new contexts');assert.equal(refinements,15,'Five districts for lighting, school crossings and household utilities');
 return {status:'PASS',contexts,refinements,bytes,browser:false,GPU:false};
}

/** Record the studio/style, exporter and every local static import they consume.
 * Walking imports makes a new model dependency part of the freshness contract.
 */
export function previewSourceFingerprint(path,bytes){
 if(path==='src/world/khanate/bootstrap.json'){
  // Delivery checksums identify this host's packed mesh, not a different scene.
  // Runtime verification checks those bytes separately. Keep every authored
  // transform, court, district and landmark in the preview freshness contract.
  const content=JSON.parse(bytes.toString('utf8'));
  const {url,sha256,transport,...metadata}=content.metadata;
  return sha(JSON.stringify({...content,metadata}));
 }
 return sha(bytes);
}

export async function previewSourceHashes(root=projectRoot){
 // Track the original database and its builders. Generated geometry contains
 // CPU-dependent floating-point hashes; using those hashes here invalidated
 // unchanged previews when a Linux deployment rebuilt a macOS export.
 const pending=['scripts/cityrt/prepare-previews.mjs','scripts/cityrt/preview-studio.html','scripts/alem/prepare.mjs','scripts/khanate/prepare.mjs','scripts/city/prepare.mjs','data/prepared/geography.tar.gz'],sources=new Map();
 while(pending.length){
  const path=pending.pop();if(sources.has(path))continue;
  const bytes=await readFile(resolve(root,path));sources.set(path,previewSourceFingerprint(path,bytes));
  if(!/\.(?:js|mjs|ts|html)$/.test(path))continue;
  const imports=bytes.toString('utf8').matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g);
  for(const [,specifier]of imports){
   if(!specifier.startsWith('.')&&!specifier.startsWith('/src/'))continue;
   const dependency=relative(root,specifier.startsWith('/src/')?resolve(root,specifier.slice(1)):resolve(root,dirname(path),specifier)).replaceAll('\\','/');
   assert(!dependency.startsWith('../')&&!dependency.startsWith('/'),`Preview source outside the implementation: ${dependency}`);
   pending.push(dependency);
  }
 }
 return Object.fromEntries([...sources].sort(([a],[b])=>a.localeCompare(b)));
}

/** The build checks freshness and sizes; the explicit CPU/runtime gates also hash images. */
export async function checkPreviews({root=projectRoot,directory=resolve(root,'public/project-previews'),verifyImageHashes=true}={}){
 const manifest=JSON.parse(await readFile(resolve(directory,'manifest.json'),'utf8'));
 assert.equal(manifest.author,'Alem implementation','Preview author must be the Alem implementation');
 assert.equal(manifest.width,480,'Preview width');assert.equal(manifest.height,288,'Preview height');
 const sources=await previewSourceHashes(root);
 assert.deepEqual(manifest.sources,sources,'Preview model, rendering or authoring source changed. Run npm run prepare:previews against the current development build.');
 assert(Array.isArray(manifest.images)&&manifest.images.length===140,'Both worlds require all 140 project/district previews');
 const listed=new Set();let bytes=0;
 for(const image of manifest.images){
  assert(previewPaths.includes(image.path)&&!listed.has(image.path),`Unexpected/duplicate preview path: ${image.path}`);listed.add(image.path);
  assert.equal(image.path,`${image.mode}/${image.initiativeId}-${image.districtId}.webp`,'Preview identity matches its path');
  assert(Number.isInteger(image.bytes)&&image.bytes>0&&/^[a-f0-9]{64}$/.test(image.sha256)&&Number.isInteger(image.modelBytes)&&image.modelBytes>0,`Preview content metadata: ${image.path}`);
  assert(image.pose&&['x','y','yaw','pitch','zoom'].every(key=>Number.isFinite(image.pose[key]))&&image.pose.zoom>0,`Preview capture pose: ${image.path}`);
  const request=previewContextRequest(image.mode,image.initiativeId,image.districtId);
  if(request){
   checkContext(image.context,request,image);
  }else assert(!image.context,`No extra context for unaffected preview: ${image.path}`);
  if(image.mode==='astana'&&image.initiativeId==='M2')assert(image.activity?.kind==='native-project-dynamic'&&image.activity.seconds===4&&Number.isInteger(image.activity.bytes)&&image.activity.bytes>0&&image.activity.bytes%60===0&&/^[a-f0-9]{64}$/.test(image.activity.sha256)&&image.activity.siteId===request.siteId,`Actual native clock-4 queue/signal layer: ${image.path}`);
  else assert(!image.activity,`No new activity layer for unaffected preview: ${image.path}`);
  const path=resolve(directory,image.path);assert.equal((await stat(path)).size,image.bytes,`Preview size: ${image.path}`);
  if(verifyImageHashes){const content=await readFile(path);assert.equal(sha(content),image.sha256,`Preview checksum: ${image.path}`);assert(content.toString('ascii',0,4)==='RIFF'&&content.toString('ascii',8,12)==='WEBP',`Preview must be WebP: ${image.path}`);}
  bytes+=image.bytes;
 }
 assert(previewPaths.every(path=>listed.has(path)),'Every initiative and district in each world has a preview');
 return {status:'PASS',images:listed.size,sourceFiles:Object.keys(sources).length,bytes,imageHashesChecked:verifyImageHashes};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await (process.argv.includes('--contexts-only')?checkPreviewContextContracts():checkPreviews()),null,2));
