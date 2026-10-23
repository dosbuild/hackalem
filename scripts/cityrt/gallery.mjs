/** Real main-app gallery. Public UI actions only; diagnostics are read-only evidence.
 * --plan-only performs CPU planning and never launches a browser or GPU context.
 */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rename,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {cameraControls,chooseProject,confirmProject,skipDemonstration,artifactContext,navigate} from '../integration/ui.mjs';
import {cameraFrame} from '../../src/world/projection.js';
import {MAX_ZOOM} from '../../src/world/city-math.js';
import {OVERVIEW as modernOverview} from '../../src/world/choreography.js';
import {OVERVIEW as historicalOverview} from '../../src/world/khanate/choreography.js';
import {routeAt} from '../../src/world/placement-geometry.js';
import {placements as modernSites,projectMesh as modernMesh,projectFocusBounds as modernFocus} from '../../src/world/project-objects.js';
import {placements as historicalSites,projectMesh as historicalMesh,projectFocusBounds as historicalFocus} from '../../src/world/khanate/projects.js';
import {architectureFamilies} from './architecture-families.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),argv=process.argv.slice(2),flag=name=>argv.includes(name);
const option=(name,fallback)=>{const i=argv.indexOf(name);return i<0?fallback:argv[i+1];};
const origin=process.env.APP_URL??'http://127.0.0.1:5187/',out=resolve(process.env.CAPTURE_DIR??'artifacts/cityrt/gallery');
const sections=new Set(option('--sections','families,landmarks,projects').split(',')),modes=new Set(option('--modes','astana,khanate').split(','));
const ids=option('--projects',Array.from({length:14},(_,i)=>`M${i+1}`).join(',')).split(','),caseFilter=option('--cases','').split(',').filter(Boolean);
const districtOption=option('--districts','representative'),districtIds=['esil','nura','almaty','saryarka','baikonur'];
const selectedDistricts=districtOption==='all'?districtIds:districtOption==='representative'?null:districtOption.split(',');
const width=Number(option('--width','1440')),height=Number(option('--height','900')),video=!flag('--no-video');
assert([...sections].every(s=>['families','landmarks','projects'].includes(s)),'Unknown gallery section');
assert([...modes].every(m=>['astana','khanate'].includes(m)),'Unknown world');
assert(!selectedDistricts||selectedDistricts.length>0&&new Set(selectedDistricts).size===selectedDistricts.length&&selectedDistricts.every(d=>districtIds.includes(d)),'--districts must be all, representative, or a comma-separated list of district IDs');
assert(Number.isFinite(width)&&width>=800&&Number.isFinite(height)&&height>=600,'Gallery viewport is a desktop view');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const slug=value=>value.replaceAll('/','-').replace(/[^a-zA-Z0-9_-]/g,'-'),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const parse=(value,fallback=null)=>{try{return JSON.parse(value);}catch{return fallback;}};
const canonicalReceiptKey=spec=>`${spec.id}:${spec.scope==='citywide'?'city':spec.district}`;
// This is at most .002 CSS pixels of native pointer motion. Browser pointer
// coordinates are rounded; a 1e-7 radian assertion rejected a correct turn.
const rotationTolerance=1e-5;
function rotationDrag(current,wanted,point,rect){
 const dx=(wanted.yaw-current.yaw)/.005,dy=(wanted.pitch-current.pitch)/.003,pad=8;
 const horizontal=dx>0?(rect.x+rect.width-pad-point.x)/dx:dx<0?(rect.x+pad-point.x)/dx:Infinity;
 const vertical=dy>0?(rect.y+rect.height-pad-point.y)/dy:dy<0?(rect.y+pad-point.y)/dy:Infinity;
 const fraction=Math.min(1,horizontal,vertical);assert(fraction>0,'Native rotation starts inside the canvas');
 return {x:point.x+dx*fraction,y:point.y+dy*fraction,fraction};
}
const sourceFiles=['src/world/project-objects.js','src/world/project-detail.js','src/world/hero-school.js','src/world/resident-models.js','src/world/choreography.js','src/world/construction-preparation.js','src/world/architecture-models.js','src/world/astana-definition.js','src/world/city-gl.js','src/world/ink-pass.js','src/world/mesh-kit.js','src/world/render-policy.js','src/world/city-math.js','src/world/projection.js','src/world/runtime-core.js','src/world/label-layout.js','src/world/placements.json','src/world/bootstrap.json','src/world/khanate/models.js','src/world/khanate/projects.js','src/world/khanate/geography.js','src/world/khanate/scale.js','src/world/khanate/site-views.json','src/world/khanate/bootstrap.json','src/world/khanate/definition.js','src/world/khanate/choreography.js','src/world/khanate/landmark-models.js','src/design/palette.js','src/design/paper.css','src/app/App.tsx','src/app/presentation.ts','src/app/construction.ts','src/features/Planning.tsx','src/features/ProjectCatalogue.tsx','src/play/DecisionDeck.tsx','src/play/context-flow.css','scripts/integration/ui.mjs','public/alem/geometry-low.json','public/alem/landmarks.json','public/alem/coverage-source.json','public/khanate/geometry.json','scripts/cityrt/gallery.mjs'];
async function snapshot(){return Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,hash(await readFile(resolve(root,p)))])));}
function packedBounds(data){const v=new DataView(data),b=[Infinity,Infinity,-Infinity,-Infinity,Infinity,-Infinity];for(let i=0;i<v.byteLength;i+=20){const p=[0,4,8].map(k=>v.getFloat32(i+k,true));for(const [at,axis]of [[0,0],[1,1],[2,0],[3,1],[4,2],[5,2]])b[at]=[0,1,4].includes(at)?Math.min(b[at],p[axis]):Math.max(b[at],p[axis]);}assert(b.every(Number.isFinite));return b;}
function pointBounds(points){return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1])),Math.min(...points.map(p=>p[2])),Math.max(...points.map(p=>p[2]))];}
const boundsArray=b=>Array.isArray(b)?b:[b.min[0],b.min[1],b.max[0],b.max[1],b.min[2],b.max[2]];
const centerOf=b=>[(b[0]+b[2])/2,(b[1]+b[3])/2,(b[4]+b[5])/2];
const fitZoom=b=>Math.max(12,Math.min(288,1.08/Math.max(b[2]-b[0],b[3]-b[1],(b[5]-b[4])*1.7)));
const angles=[['front',0],['right',Math.PI/2],['back',Math.PI],['left',-Math.PI/2]];
const citywide=new Set(['M2','M6','M12','M14']);
const projectFrames=['02a-public-proposal-arrival','02-proposal-detail-front','03-proposal-detail-back','07-completed-detail-front','08-completed-detail-back','08a-completed-close-front','08b-completed-close-back','09-completed-overview','12-use-resident','13-return-to-accepted-place'];
function expectedFrames(spec){return spec.kind==='family'?['01-city-overview',...spec.angles.flatMap(a=>['detail-'+a,'close-'+a])]:spec.kind==='landmark'?['01-public-atlas-arrival',...spec.angles.flatMap(a=>['detail-'+a,'close-'+a])]:spec.fullFlow?[...projectFrames,'01-overview-before','04-proposal-overview','05-build-detail-front','06-build-detail-back','06b-first-overview-after-live-build','10-in-use-front','11-in-use-back','11b-in-use-overview']:projectFrames;}
async function chooseGalleryDistrict(page,spec){
 const label=page.getByRole('button',{name:spec.districtLabel,exact:true});let trialFailure=null;
 try{await label.click({trial:true,timeout:1500});}catch(error){trialFailure=String(error);}
 if(trialFailure===null){await label.click();return {path:'map-label',district:spec.district};}
 // The choices sheet can cover a world label. The existing book buttons select
 // the same district publicly, including the person for citywide proposals.
 assert.match(spec.districtLabel,/^(?:District|Quarter) .+ on the map$/);
 const name=spec.districtLabel.replace(/^(?:District|Quarter) /,'').replace(/ on the map$/,'');
 await navigate(page,'dashboard');
 await page.getByRole('navigation',{name:'Dashboard sections'}).getByRole('button',{name:/Overview/}).click();
 const details=page.locator('details.dash-full-details');
 if(await details.getAttribute('open')===null)await details.locator(':scope > summary').click();
 const button=page.locator('.dash-district').filter({has:page.getByText(name,{exact:true})});
 assert.equal(await button.count(),1,'The public book has exactly one requested district');await button.click();
 await page.waitForFunction(name=>[...document.querySelectorAll('.dash-district')].some(b=>b.querySelector(':scope > span')?.textContent?.trim()===name&&b.getAttribute('aria-pressed')==='true'),name);
 assert.equal(await button.getAttribute('aria-pressed'),'true','The public book selected the intended district');
 await navigate(page,'map');
 return {path:'dashboard-district',district:spec.district,name,trialFailure};
}
async function reusable(previous,spec,dir,plan){
 if(!previous.complete||previous.key!==spec.key||previous.mode!==spec.mode||previous.planFingerprint!==plan.planFingerprint||previous.motion?.reducedMotion!==!!spec.reducedMotion)return false;
 if(!Array.isArray(previous.frames)||previous.frames.length!==expectedFrames(spec).length||new Set(previous.frames.map(f=>f.name)).size!==previous.frames.length)return false;
 if(!expectedFrames(spec).every(name=>previous.frames.some(f=>f.name===name&&f.path===resolve(dir,name+'.png'))))return false;
 try{
  for(const frame of previous.frames){
   const [file,sidecar]=await Promise.all([stat(frame.path),readFile(frame.path+'.json','utf8')]);if(!file.isFile()||file.size===0)return false;
   const evidence=JSON.parse(sidecar);if(evidence.world!==spec.mode||evidence.sourcePlanFingerprint!==plan.planFingerprint||evidence.motion?.reducedMotion!==!!spec.reducedMotion)return false;
  }
  if(video){
   const path=resolve(dir,'continuous-ui.webm'),[file,sidecar]=await Promise.all([stat(path),readFile(path+'.json','utf8')]),evidence=JSON.parse(sidecar);
   if(previous.video!==path||!file.isFile()||file.size===0||evidence.case!==spec.key||evidence.world!==spec.mode||evidence.planFingerprint!==plan.planFingerprint||evidence.motion?.reducedMotion!==!!spec.reducedMotion)return false;
  }
  return true;
 }catch{return false;}
}

async function makePlan(){
 const [modern,historical,landmarks,modernBootstrap,historicalBootstrap]=await Promise.all([read('public/alem/geometry-low.json'),read('public/khanate/geometry.json'),read('public/alem/landmarks.json'),read('src/world/bootstrap.json'),read('src/world/khanate/bootstrap.json')]),cases=[];
 if(sections.has('families')&&modes.has('astana')){
  const families=process.env.FAMILY_GALLERY?JSON.parse(await readFile(process.env.FAMILY_GALLERY,'utf8')).gallery:await architectureFamilies(root);
  for(const f of families){const b=[...f.bounds,.00003+(f.base_m||0)/12000,.00003+f.height_m/12000];cases.push({key:'astana-family-'+f.family,kind:'family',mode:'astana',sourceId:f.id,family:f.family,source:{height_m:f.height_m,base_m:f.base_m,height_source:f.height_source,tags:f.tags,rings:f.rings},bounds:b,center:centerOf(b),zoom:Math.min(288,f.zoom),yaw:wrap(f.yaw??-.4),pitch:.65,angles:angles.map(([name])=>name)});}
 }
 if(sections.has('landmarks'))for(const mode of modes){
  if(mode==='astana')for(const model of landmarks.models){
   const publicPlace=landmarks.landmarks.find(p=>p.modelId===model.id),parent=publicPlace?.id??(model.id.startsWith('expo')?'expo':model.id.startsWith('grand-mosque')?'grand-mosque':model.id.startsWith('hazret')?'hazret':model.id.startsWith('lrt')?'lrt':'esil-bridges');
   cases.push({key:'astana-landmark-'+model.id,kind:'landmark',mode,modelId:model.id,publicPlaceId:parent,sourceIds:model.replaces,bounds:model.bounds,center:centerOf(model.bounds),zoom:fitZoom(model.bounds),yaw:wrap(publicPlace?.yaw??-.3),pitch:1,station:!!model.station,angles:['front','back']});
  }else if(mode==='khanate')for(const place of historical.landmarks){const b=boundsArray(place.bounds);cases.push({key:'khanate-landmark-'+place.id,kind:'landmark',mode,modelId:place.id,publicPlaceId:place.id,sourceIds:['authored-khanate-place:'+place.id],bounds:b,center:centerOf(b),zoom:fitZoom(b),yaw:wrap(place.yaw??-.3),pitch:1,angles:['front','back']});}
 }
 if(sections.has('projects'))for(const mode of modes)for(const id of ids){
  assert(/^M(?:[1-9]|1[0-4])$/.test(id),'Unknown initiative '+id);
  const representative=id==='M7'?(mode==='astana'?'nura':'esil'):'esil',sites=mode==='astana'?modernSites:historicalSites,builder=mode==='astana'?modernMesh:historicalMesh;
  for(const district of selectedDistricts??[representative]){
  const site=sites[`${id}:${district}`],fullFlow=district===representative&&!flag('--reduced-only');
  assert(site,'Missing intended placement '+mode+' '+id+':'+district);
  const object={...site,slot:1,proposal:false,state:'planned',progress:1,citywide:citywide.has(id)},b=packedBounds(builder([object],false,{zoom:160,preview:true,seconds:4,schoolTime:30})),focus=(mode==='astana'?modernFocus:historicalFocus)(site);
  let focusBounds=focus?.length?pointBounds(focus):b,framing='Existing projectFocusBounds primary place; full owned model bounds recorded separately';
  if(mode==='khanate'&&['M1','M3'].includes(id)){const q=routeAt(site.route,.52);focusBounds=[q.point[0]-.0025,q.point[1]-.0025,q.point[0]+.0025,q.point[1]+.0025,b[4],b[5]];framing='Existing middle route stop at parameter .52; overview shows full connection';}
  const districtName=(mode==='astana'?modernBootstrap:historicalBootstrap).districts.features.find(d=>d.id===district).properties.name;
  // A lower physical inspection pitch keeps the source apartment mass behind
  // the selected service fixture at both original opposite yaw angles.
  const serviceInspection=mode==='astana'&&['M13','M14'].includes(id),heatingInspection=mode==='astana'&&id==='M5';
  cases.push({key:`${mode}-project-${id}${fullFlow?'':'-'+district}`,kind:'project',mode,id,district,fullFlow,reducedMotion:!fullFlow,districtLabel:(mode==='astana'?'District ':'Quarter ')+districtName+' on the map',siteKey:site.key,sourceIds:[...new Set([site.source,...(site.sources||[]),...(site.roofs||[]).map(r=>r.source)].filter(Boolean))],scope:object.citywide?'citywide':'district',origin:site.origin,route:site.route,footprint:site.footprint,bounds:b,focusBounds,framing,center:centerOf(focusBounds),zoom:fitZoom(focusBounds),yaw:wrap((site.orientation||0)-.38),pitch:serviceInspection||heatingInspection?.65:1,...(serviceInspection?{inspectionPoseReason:'Fixture-centered source-building LOS: original opposite yaw angles at pitch .65; native silhouettes and canonical resident-return fitting checked separately'}:{}),...(heatingInspection?{inspectionBackOffset:Math.PI+.3,inspectionPoseReason:'Source-ray vetted second heating view at front + PI + .3 radians and pitch .65; actual unchanged household equipment is clear of source apartments at both native zooms in all five placements. CPU proxy proof; native validation required.'}:{}),phases:fullFlow?['overview','proposal','build','completed','use']:['proposal','completed','resident','return'],angles:['front','back']});
  }
 }
 for(const c of cases){assert(c.bounds.length===6&&c.bounds.every(Number.isFinite),'Finite source/model bounds: '+c.key);assert(c.center.every(Number.isFinite)&&c.zoom>=1&&c.zoom<=288,'Public camera target: '+c.key);}
 const files=await snapshot(),planFingerprint=hash(JSON.stringify({files,origin,viewport:{width,height},video,cases})),selected=caseFilter.length?cases.filter(c=>caseFilter.includes(c.key)):cases;
 if(caseFilter.length)assert(selected.length===caseFilter.length,'Every requested case must exist in the plan');
 return {version:2,method:'Real main app, public catalogue/confirmation/resident/atlas controls and native pointer/wheel/keyboard camera controls. '+(flag('--reduced-only')?'All projects use the real browser reduced-motion preference; this run does not certify normal-motion construction. ':'Representative projects use normal motion; additional placements use the real browser reduced-motion preference. ')+'No state writes, runtime API calls, clock injection or geometry-only demonstration.',origin,viewport:{width,height},districts:districtOption,planFingerprint,sourceFiles:files,worlds:{astana:{buildings:modern.buildingFeatures,asset:modern.sha256,architecture:modern.architecture?.asset},khanate:{buildings:historical.buildingFeatures,asset:historical.sha256}},cases:selected};
}

await mkdir(out,{recursive:true});const plan=await makePlan();await writeFile(resolve(out,'plan.json'),JSON.stringify(plan,null,2));
console.log(JSON.stringify({planOnly:flag('--plan-only'),cases:plan.cases.length,plannedFrames:plan.cases.reduce((sum,spec)=>sum+expectedFrames(spec).length,0),byKind:Object.fromEntries(['family','landmark','project'].map(k=>[k,plan.cases.filter(c=>c.kind===k).length])),projectFlows:{normalMotion:plan.cases.filter(c=>c.kind==='project'&&c.fullFlow).length,reducedMotion:plan.cases.filter(c=>c.kind==='project'&&!c.fullFlow).length},plan:resolve(out,'plan.json')},null,2));
if(!flag('--plan-only'))await run();

async function run(){
 const browser=await chromium.launch({executablePath,headless:!flag('--headed'),args:browserArgs}),report={version:2,origin,planFingerprint:plan.planFingerprint,complete:false,cases:[],errors:[]};
 try{
  report.browser={version:await browser.version(),executablePath,args:[...browserArgs]};
  for(const spec of plan.cases){
   const dir=resolve(out,slug(spec.key));await mkdir(dir,{recursive:true});
   if(flag('--continue')){try{const previous=JSON.parse(await readFile(resolve(dir,'review.json'),'utf8'));if(await reusable(previous,spec,dir,plan)){report.cases.push(previous);console.log('REUSED',spec.key);continue;}}catch{}}
   const record={...spec,dir,planFingerprint:plan.planFingerprint,browser:report.browser,complete:false,frames:[],actions:[],errors:[],requests:[],startedAt:new Date().toISOString()},context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:spec.reducedMotion?'reduce':'no-preference',serviceWorkers:'block',...(video?{recordVideo:{dir,size:{width,height}}}:{})}),page=await context.newPage();
   page.setDefaultTimeout(60000);page.on('pageerror',error=>record.errors.push(error.message));page.on('requestfailed',request=>record.errors.push('request failed '+request.url()+': '+request.failure()?.errorText));page.on('request',request=>{if(/\/(?:alem|khanate)\//.test(request.url()))record.requests.push(request.url());});
   const captureSession=spec.fullFlow?await context.newCDPSession(page):null;
   let livePhase=null;const pendingLiveFrames=[];
   // These bounded driver timings only observe wall time; they never supply or
   // modify the application's receipt clock, camera, or construction progress.
   const call=async(operation,fn)=>{if(!livePhase)return fn();const phase=livePhase,startedAt=Date.now();try{return await fn();}finally{const finishedAt=Date.now(),timings=record.liveCallTimings??={clock:'Unmodified driver Date.now; read-only durations, never application inputs',limit:512,calls:[],omitted:0};if(timings.calls.length<timings.limit)timings.calls.push({phase,operation,startedAt,finishedAt,durationMs:finishedAt-startedAt});else timings.omitted++;}};
   const map=page.getByTestId('city-map'),state=()=>call('state',()=>map.evaluate(el=>({...el.dataset})));
   function publishedPose(d){if(!d?.camera||!d?.target||d.camera!==d.renderCamera||d.eventCameraOwned==='true')return false;const c=parse(d.camera),t=parse(d.target);return ['x','y','yaw','pitch','zoom'].every(k=>Math.abs(c[k]-t[k])<1e-7);}
   const settled=async(expected=null,tolerance=1e-7)=>call('settled',async()=>{
    // Pointer/wheel dispatch can finish before the runtime publishes its next
    // camera dataset. Observe two real frames before comparing rendered poses.
    // A known input endpoint is a stronger acknowledgement than a fixed wait:
    // the old published pose cannot match a genuine nonzero native drag.
    if(!expected)await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.waitForFunction(({expected,tolerance})=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.camera||!d?.target||d.camera!==d.renderCamera||d.eventCameraOwned==='true')return false;const c=JSON.parse(d.camera),t=JSON.parse(d.target);return ['x','y','yaw','pitch','zoom'].every(k=>Math.abs(c[k]-t[k])<1e-7)&&(!expected||Object.entries(expected).every(([k,v])=>Math.abs(c[k]-v)<tolerance));},{expected,tolerance});
   });
   const action=async(label,fn)=>{const before=await state();await fn();record.actions.push({label,before,after:await state(),at:new Date().toISOString()});};
   async function publicCameraRequest(click,expected=null){
    const before=(await state()).cameraRequest;await click();
    // A React click may leave the old, already-settled pose visible until the
    // app boundary delivers its request. Wait for that acknowledgement first.
    await page.waitForFunction(({before,expected})=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.cameraRequest||d.cameraRequest===before)return false;if(!expected)return true;const target=JSON.parse(d.target||'{}');return Object.entries(expected).every(([key,value])=>Math.abs(target[key]-value)<1e-7);},{before,expected});
    await settled();
   }
   const overview=()=>publicCameraRequest(()=>page.locator('.camera-home').click(),spec.mode==='khanate'?historicalOverview:modernOverview);
   // Browser-side draft reading is evidence only. No init script or local-storage writes.
   async function savedPlan(){return page.evaluate(()=>{const key=document.documentElement.dataset.mode==='khanate'?'alem:khanate:akim:draft':'akim:draft';try{return JSON.parse(localStorage.getItem(key));}catch{return null;}});}
   async function controlFrame(detail=false){const observed=await call('controlFrame',()=>page.locator('.alem-city').evaluate((canvas,detail)=>{const r=canvas.getBoundingClientRect();let point=null;for(const x of detail?[.65,.5,.8,.35,.2]:[.5,.65,.8,.35,.2]){for(const y of [.46,.34,.6,.72,.25]){const p={x:r.x+r.width*x,y:r.y+r.height*y};if(document.elementFromPoint(p.x,p.y)===canvas){point=p;break;}}if(point)break;}return {data:{...canvas.closest('[data-testid=city-map]').dataset},rect:{x:r.x,y:r.y,width:r.width,height:r.height},point};},detail));assert(observed.point,'A visible canvas area is available for normal pointer control');return observed;}
   function frame(d){const pose=parse(d.camera);assert(pose,'Native camera diagnostics');return cameraFrame(pose,pose.width,pose.height,Number(d.frame),{overviewZoom:spec.mode==='khanate'?7:1});}
   async function zoomTo(zoom,{live=false}={}){zoom=Math.max(1,Math.min(MAX_ZOOM,zoom));for(let i=0;i<30;i++){const observed=await controlFrame(),d=observed.data,c=parse(d.camera),error=Math.log(zoom/c.zoom);if(Math.abs(error)<.00005){if(live&&!publishedPose(d)){await settled();continue;}return d;}const change=Math.max(-.25,Math.min(.25,error)),point=observed.point;await call('native-wheel.move',()=>page.mouse.move(point.x,point.y));await call('native-wheel.wheel',()=>page.mouse.wheel(0,-change/.002));const expectedZoom=c.zoom*Math.exp(change);await settled(live?{zoom:expectedZoom}:null,expectedZoom*5e-6);}throw Error('Public zoom did not converge');}
   async function rotateTo(yaw,pitch,{live=false}={}){
    // Public yaw clamps at ±PI; crossing the seam requires the direct delta.
    const wanted={yaw:wrap(yaw),pitch:Math.max(.35,Math.min(1,pitch))};
    for(let segment=0;segment<8;segment++){
     const observed=await controlFrame(),c=parse(observed.data.camera);if(live&&!publishedPose(observed.data)){await settled();continue;}if(Math.abs(c.yaw-wanted.yaw)<rotationTolerance&&Math.abs(c.pitch-wanted.pitch)<rotationTolerance)return;
     const {point,rect}=observed,end=rotationDrag(c,wanted,point,rect),expected={yaw:Math.max(-Math.PI,Math.min(Math.PI,c.yaw+(end.x-point.x)*.005)),pitch:Math.max(.35,Math.min(1,c.pitch+(end.y-point.y)*.003))};
     await call('native-right-drag.move-start',()=>page.mouse.move(point.x,point.y));await call('native-right-drag.down',()=>page.mouse.down({button:'right'}));await call('native-right-drag.move-end',()=>page.mouse.move(end.x,end.y,{steps:live?1:4}));await call('native-right-drag.up',()=>page.mouse.up({button:'right'}));await settled(live?expected:null,rotationTolerance);
     const actual=parse((await state()).camera);record.cameraGestures??=[];record.cameraGestures.push({kind:'native-right-drag',wanted,before:c,point,end,after:actual,angularError:{yaw:actual.yaw-wanted.yaw,pitch:actual.pitch-wanted.pitch}});
     if(Math.abs(actual.yaw-wanted.yaw)<rotationTolerance&&Math.abs(actual.pitch-wanted.pitch)<rotationTolerance)return;
    }
    const actual=parse((await state()).camera);assert(Math.abs(actual.yaw-wanted.yaw)<rotationTolerance&&Math.abs(actual.pitch-wanted.pitch)<rotationTolerance,`Public rotation reaches the intended side: requested ${JSON.stringify(wanted)}, rendered ${JSON.stringify({yaw:actual.yaw,pitch:actual.pitch})}`);
   }
   async function panTo(x,y,{live=false}={}){
    for(let i=0;i<20;i++){
     const observed=await controlFrame(),d=observed.data,c=parse(d.camera);if(live&&!publishedPose(d)){await settled();continue;}if(Math.hypot(x-c.x,y-c.y)<.0000002)return;
     const f=frame(d),{point,rect}=observed,under=f.inverseWorld(point.x-rect.x,point.y-rect.y);assert(under,'Canvas ground ray');
     const projected=f.world([under[0]-(x-c.x),under[1]-(y-c.y),0]);
     const end={x:Math.max(rect.x+24,Math.min(rect.x+rect.width-24,rect.x+projected.x)),y:Math.max(rect.y+24,Math.min(rect.y+rect.height-24,rect.y+projected.y))};
     const small=Math.hypot(end.x-point.x,end.y-point.y)<6;
     // A drag ending within five pixels is a public map click. Make a larger
     // ordinary drag first, then restore the requested ground position.
     const actualEnd=small?{x:point.x+(point.x+16<rect.x+rect.width-24?16:-16),y:point.y}:end;
     const clipped=end.x!==rect.x+projected.x||end.y!==rect.y+projected.y;
     await call('native-left-ground-drag.move-start',()=>page.mouse.move(point.x,point.y));await call('native-left-ground-drag.down',()=>page.mouse.down());await call('native-left-ground-drag.move-end',()=>page.mouse.move(actualEnd.x,actualEnd.y,{steps:live?1:3}));await call('native-left-ground-drag.up',()=>page.mouse.up());await settled(live&&!clipped&&!small?{x,y}:null,.000001);
     const actual=parse((await state()).camera);record.cameraGestures??=[];record.cameraGestures.push({kind:'native-left-ground-drag',wanted:{x,y},before:c,point,end:actualEnd,clipped:end.x!==rect.x+projected.x||end.y!==rect.y+projected.y,parked:small,after:actual,positionError:Math.hypot(x-actual.x,y-actual.y)});
     if(Math.hypot(x-actual.x,y-actual.y)<.0000002)return;
    }
    const c=parse((await state()).camera);assert(Math.hypot(x-c.x,y-c.y)<.000001,'Native pointer pan reaches requested source center');
   }
   async function place(angle=0,{live=false,close=false}={}){
    if(angle===Math.PI&&spec.inspectionBackOffset!==undefined)angle=spec.inspectionBackOffset;
    const zoom=close?Math.min(MAX_ZOOM,Math.max(288,spec.zoom*1.8)):spec.zoom,yaw=wrap(spec.yaw+angle),current=parse((await state()).camera),distance=Math.hypot(spec.center[0]-current.x,spec.center[1]-current.y);
    // Avoid a gratuitous pullback when confirmation already holds this place.
    if(distance>.03)await zoomTo(Math.min(8,spec.zoom),{live});await rotateTo(yaw,spec.pitch,{live});
    const observed=await controlFrame(true),d=observed.data,c=parse(d.camera),f=cameraFrame({...c,x:spec.center[0],y:spec.center[1],zoom,yaw,pitch:spec.pitch},c.width,c.height,0,{overviewZoom:spec.mode==='khanate'?7:1}),{point,rect}=observed,under=f.inverseWorld(point.x-rect.x,point.y-rect.y,spec.center[2]);
    await panTo(spec.center[0]+spec.center[0]-under[0],spec.center[1]+spec.center[1]-under[1],{live});const final=await zoomTo(zoom,{live});if(!live||!publishedPose(final))await settled();
   }
   async function shot(name,{live=false}={}){
    if(!live)await settled();const before=await state(),metadata=await call('metadata',()=>artifactContext(page));assert.equal(metadata.world,spec.mode,'Actual visible world');assert.equal(before.ready,'true');assert.equal(before.completeCity,'true');assert.equal(Number(before.buildingCount),plan.worlds[spec.mode].buildings);assert.equal(before.camera,before.renderCamera,'Native camera rendered before screenshot');
    const path=resolve(dir,name+'.png'),captureBackend=live&&captureSession?'native-cdp-lossless-png-fast':'playwright-page-png';let captureAt,after,finishedAt,pixels;
    if(live){
     captureAt=Date.now();
     pixels=live&&captureSession?await call('native-cdp-lossless-png-fast',()=>captureSession.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:true})):await call('playwright-page-png',()=>page.screenshot());
     // Observe the actual next state immediately after native capture, before
     // decoding PNG bytes, computing sidecars, or writing any artifact files.
     after=await state();finishedAt=new Date().toISOString();
    }
    const sourceBounds=spec.focusBounds??spec.bounds,f=frame(before),corners=[sourceBounds[0],sourceBounds[2]].flatMap(x=>[sourceBounds[1],sourceBounds[3]].flatMap(y=>[sourceBounds[4],sourceBounds[5]].map(z=>f.world([x,y,z]))));
    const inspectionBounds={left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y)),visibleCorners:corners.filter(p=>p.visible).length};
    const inspectionEvidence={source:'Recorded physical focus bounds projected with the actual shared camera; this is a framing proxy, not a measured mesh silhouette.',zoom:parse(before.camera).zoom,bounds:inspectionBounds};
    const detailName=name.startsWith('close-')?name.replace('close-','detail-'):({'08a-completed-close-front':'07-completed-detail-front','08b-completed-close-back':'08-completed-detail-back'})[name];
    if(detailName){
     const detail=record.frames.find(f=>f.name===detailName)?.inspectionEvidence;assert(detail,'A native matching detail view precedes each close inspection');
     const zoomRatio=inspectionEvidence.zoom/detail.zoom,widthRatio=(inspectionBounds.right-inspectionBounds.left)/(detail.bounds.right-detail.bounds.left),heightRatio=(inspectionBounds.bottom-inspectionBounds.top)/(detail.bounds.bottom-detail.bounds.top);
     assert(zoomRatio>=1.15&&Math.max(widthRatio,heightRatio)>=1.15,`Close inspection measurably enlarges ${detailName}: zoom ${zoomRatio}, width ${widthRatio}, height ${heightRatio}`);
     inspectionEvidence.comparedTo={name:detailName,zoomRatio,projectedWidthRatio:widthRatio,projectedHeightRatio:heightRatio};
    }
    const physicalAnnotations=!live&&spec.kind==='project'?await page.evaluate(()=>({method:'Read-only visible native project annotations before screenshot; actual sampled mesh points, not a complete silhouette.',frame:document.querySelector('[data-testid=city-map]')?.dataset.frame,camera:document.querySelector('[data-testid=city-map]')?.dataset.camera,labels:[...document.querySelectorAll('.map-project')].filter(b=>!b.hidden).map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,data:{...b.dataset},rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom}};})})):null;
    if(!live){captureAt=Date.now();await page.screenshot({path});after=await state();finishedAt=new Date().toISOString();}
    const receipt=record.receipt?.construction?.find(r=>r.key===canonicalReceiptKey(spec)),activity=parse(before.constructions,[]).find(r=>r.id===spec.id),constructionEvidence=spec.kind==='project'?{receiptKey:canonicalReceiptKey(spec),receipt:receipt??null,receiptAgeMs:receipt?captureAt-receipt.startedAt:null,activity:activity??null,phase:activity?(activity.progress>0&&activity.progress<1?'building':activity.progress>=1?'activation':'accepted-start'):parse(before.interventions,[]).some(o=>o.key===spec.siteKey&&o.state==='preview')?'proposal':receipt?'no-active-construction':'unaccepted',choreography:before.choreography}:null,evidence={name,path,captureBackend,requested:{kind:spec.kind,sourceId:spec.sourceId,sourceIds:spec.sourceIds,modelId:spec.modelId,siteKey:spec.siteKey,bounds:spec.bounds,focusBounds:spec.focusBounds,framing:spec.framing,scope:spec.scope},...metadata,motion:record.motion,sourcePlanFingerprint:plan.planFingerprint,servedSource:record.servedSource,startedAt:new Date(captureAt).toISOString(),finishedAt,frameInterval:{before:Number(before.frame),after:Number(after.frame)},constructionEvidence,physicalAnnotations,before,after};
    evidence.inspectionEvidence=inspectionEvidence;record.frames.push(evidence);
    if(live)pendingLiveFrames.push({path,pixels:captureSession?Buffer.from(pixels.data,'base64'):pixels,sidecar:JSON.stringify(evidence,null,2)});else await writeFile(path+'.json',JSON.stringify(evidence,null,2));
   }
   async function flushLiveFrames(){while(pendingLiveFrames.length){const pending=pendingLiveFrames[0];await call('write-live-png',()=>writeFile(pending.path,pending.pixels));await call('write-live-sidecar',()=>writeFile(pending.path+'.json',pending.sidecar));pendingLiveFrames.shift();}}
   const active=id=>page.waitForFunction(({id,low,high})=>{const rows=JSON.parse(document.querySelector('[data-testid=city-map]')?.dataset.constructions||'[]');return rows.some(r=>r.id===id&&r.progress>=low&&r.progress<high);},{id,low:.02,high:.88},{timeout:14000});
   try{
    const url=new URL(origin);url.searchParams.set('mode',spec.mode);if(spec.kind==='landmark')url.searchParams.set('landmark',spec.publicPlaceId);else url.searchParams.delete('landmark');
    await page.goto(url.href);await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');await skipDemonstration(page);await settled();record.build=await artifactContext(page);record.motion=await page.evaluate(()=>({reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}));assert.equal(record.motion.reducedMotion,!!spec.reducedMotion,'Actual browser motion preference matches the case');record.planBefore=await savedPlan();
    const response=await page.request.get(new URL(spec.mode==='astana'?'alem/geometry-low.json':'khanate/geometry.json',page.url()).href);assert(response.ok(),'Served runtime metadata is available');const served=await response.json();record.servedSource={sha256:served.sha256,architecture:served.architecture?.asset,buildingFeatures:served.buildingFeatures,vertices:served.vertices};assert.equal(served.sha256,plan.worlds[spec.mode].asset,'Gallery plan and served city use the same source artifact');
    if(spec.mode==='astana'){const asset=plan.worlds.astana.architecture;assert.equal(served.architecture?.asset.sha256,asset.sha256,'Served facade descriptor matches the source snapshot');assert(record.requests.some(url=>{const path=new URL(url).pathname;return path.endsWith('/'+asset.url)||path.endsWith('/'+asset.url+'.gz');}),'The actual app loaded the frozen facade asset');}
    await cameraControls(page);
    if(spec.kind==='project'){
     await action('public city overview',overview);if(spec.fullFlow)await shot('01-overview-before');
     await action('public district selection '+spec.district,async()=>{record.districtSelection=await chooseGalleryDistrict(page,spec);});
     await action('catalogue project '+spec.id,()=>chooseProject(page,spec.id));const select=page.getByTestId('held-project').locator('select');if(await select.count())await action('district '+spec.district,()=>select.selectOption(spec.district));await page.waitForFunction(id=>document.querySelector('[data-testid=city-map]')?.dataset.preview===id,spec.id);await action('public proposal arrival',()=>publicCameraRequest(()=>page.getByTestId('held-project').getByRole('button',{name:'Show the site',exact:true}).click()));
     record.proposalStory=await page.getByTestId('held-project').getAttribute('data-story-id');
     assert(parse((await state()).interventions,[]).some(o=>o.key===spec.siteKey&&o.state==='preview'),'Proposal renders this intended native site');await shot('02a-public-proposal-arrival');
     await action('proposal front via public camera',()=>place());await shot('02-proposal-detail-front');await action('proposal back via public camera',()=>place(Math.PI));await shot('03-proposal-detail-back');
     if(spec.fullFlow){await action('proposal overview',overview);await shot('04-proposal-overview');}await action('proposal front restored',()=>place());
     const proposed=await savedPlan();assert.equal(proposed?.plan?.length??0,record.planBefore?.plan?.length??0,'Preview spends no plan slot');await action('explicit public confirmation',()=>confirmProject(page));
     await page.waitForFunction(key=>JSON.parse(document.querySelector('[data-testid=city-map]')?.dataset.interventions||'[]').some(o=>o.key===key&&o.state==='planned'),spec.siteKey);
     record.receipt=await savedPlan();
     const acceptedReceipt=record.receipt?.construction?.find(r=>r.key===canonicalReceiptKey(spec));assert(acceptedReceipt,'Public confirmation creates the real canonical receipt '+canonicalReceiptKey(spec));assert(Number.isFinite(acceptedReceipt.startedAt)&&acceptedReceipt.startedAt>0&&Number.isFinite(acceptedReceipt.durationMs)&&acceptedReceipt.durationMs>0,'Canonical receipt contains its real start time and duration');
     if(spec.fullFlow){
     await page.waitForFunction(id=>JSON.parse(document.querySelector('[data-testid=city-map]')?.dataset.constructions||'[]').some(r=>r.id===id),spec.id);
     // A genuine manual-control takeover retains the construction receipt/clock.
     // It lets citywide objects be inspected without replacing their overview choreography.
     livePhase='manual-takeover';await action('manual keyboard takeover during live clock',async()=>{await call('native-keyboard.focus',()=>page.locator('.alem-city').focus());await call('native-keyboard.ArrowRight',()=>page.keyboard.press('ArrowRight'));await call('native-keyboard.ArrowLeft',()=>page.keyboard.press('ArrowLeft'));});
     livePhase='build-front-placement';await place(0,{live:true});await call('active-construction',()=>active(spec.id));livePhase='build-front-capture';await shot('05-build-detail-front',{live:true});livePhase='build-back-placement';await place(Math.PI,{live:true});livePhase='build-back-capture';await shot('06-build-detail-back',{live:true});
     const buildFrames=record.frames.filter(f=>['05-build-detail-front','06-build-detail-back'].includes(f.name));assert.equal(buildFrames.length,2,'Both native live construction sides were captured');assert(buildFrames.every(f=>[f.before,f.after].every(d=>parse(d.constructions,[]).some(r=>r.id===spec.id&&r.progress>0&&r.progress<1))),'Both construction detail angles remain live across their actual screenshot intervals');
     livePhase='live-artifact-flush';await flushLiveFrames();livePhase=null;
     // The public overview flight takes time while the native receipt keeps
     // running. Label its observed phase, rather than claiming it is live.
     await action('first overview after live construction sides',overview);await shot('06b-first-overview-after-live-build');
     }
     // Reduced motion can finish its visual geometry before the canonical
     // wall-clock receipt. Completed captures also wait for that real receipt.
     await page.waitForFunction(receipt=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return Date.now()>=receipt.startedAt+receipt.durationMs&&d?.choreography==='idle'&&JSON.parse(d.constructions||'[]').length===0;},acceptedReceipt,{timeout:25000});
     await place();await shot('07-completed-detail-front');await place(Math.PI);await shot('08-completed-detail-back');
     // Whole-place framing is retained above. These separate native close views
     // expose material and facade detail at the application's actual zoom limit.
     await action('completed native close front',()=>place(0,{close:true}));await shot('08a-completed-close-front');await action('completed native close back',()=>place(Math.PI,{close:true}));await shot('08b-completed-close-back');
     await action('completed overview',overview);await shot('09-completed-overview');
     if(spec.fullFlow){
     await place();await page.waitForTimeout(1200);await shot('10-in-use-front');await place(Math.PI);await shot('11-in-use-back');
     await action('occupied place overview',overview);await shot('11b-in-use-overview');
     }
     // Overview intentionally opens the public choices sheet. Return through
     // the book's accepted commitment, rather than assuming inspection stayed.
     await action('public book returns to the accepted place',async()=>{
      await navigate(page,'dashboard');const full=page.locator('details.dash-full-details');assert.equal(await full.count(),1,'Public book offers its full indicators and accepted plan');if(await full.getAttribute('open')===null)await full.locator(':scope > summary').click();await page.locator('.dash-plan-list').waitFor({state:'visible'});const entry=page.locator('.dash-plan-list article');assert.equal(await entry.count(),1,'One public accepted commitment is available');assert.equal(await entry.locator('.dash-project-id').innerText(),spec.id);
      await publicCameraRequest(()=>entry.getByRole('button',{name:'On the map',exact:true}).click());
     });await place();
     const meet=page.locator('.consequence-actions [data-context-action=meet]');assert.equal(await meet.count(),1,'Accepted project offers its resident');await action('meet real resident using accepted place',()=>meet.click());await page.getByTestId('resident-layer').waitFor();await page.waitForFunction(({resident,anchor})=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return d?.resident===resident&&d.anchor===anchor;},{resident:record.proposalStory,anchor:'scenario:'+spec.siteKey});assert.equal((await state()).resident,record.proposalStory,'The accepted place retains its proposal person');assert.equal((await state()).anchor,'scenario:'+spec.siteKey,'The conversation retains its intended site');await shot('12-use-resident');await action('return from resident by Escape',()=>page.keyboard.press('Escape'));await page.locator('.consequence-card').waitFor();await shot('13-return-to-accepted-place');
     record.planAfter=await savedPlan();assert.equal(record.planAfter?.plan?.length,1,'Fresh public session has one accepted project');assert.equal(record.planAfter.plan[0].initiativeId,spec.id);assert.equal(record.planAfter.plan[0].scope,spec.scope);
     if(spec.scope==='district')assert.equal(record.planAfter.plan[0].districtId,spec.district,'Accepted decision retains its intended district');
    }else{
     if(spec.kind==='landmark'){
      await page.waitForFunction(id=>document.querySelector('[data-testid=city-map]')?.dataset.landmark===id,spec.publicPlaceId);
      await shot('01-public-atlas-arrival');
     }else{await action('public city overview',overview);await shot('01-city-overview');}
     for(const name of spec.angles){const offset=angles.find(([n])=>n===name)[1];await action('native '+name+' camera',()=>place(offset));await shot('detail-'+name);await action('native close '+name+' camera',()=>place(offset,{close:true}));await shot('close-'+name);}
     record.planAfter=await savedPlan();assert.deepEqual(record.planAfter?.plan??[],record.planBefore?.plan??[],'View-only tour preserves saved decisions');
    }
    assert.deepEqual(record.frames.map(f=>f.name).sort(),[...expectedFrames(spec)].sort(),'Every required native gallery view was captured exactly once');assert.equal(record.errors.length,0,'No application or network failures');record.complete=true;console.log('CAPTURED',spec.key,record.frames.length,'frames');
   }catch(error){record.failure=String(error);report.errors.push({case:spec.key,error:String(error)});process.exitCode=1;livePhase='failure-native-capture';await shot('failure',{live:true}).catch(()=>{});console.error('FAILED',spec.key,String(error));}
   finally{
    livePhase='live-artifact-flush-finally';
    try{await flushLiveFrames();}catch(error){record.complete=false;process.exitCode=1;record.artifactFlushFailure={phase:'artifact-flush',error:String(error),pendingArtifacts:pendingLiveFrames.map(({path})=>({png:path,sidecar:path+'.json'}))};report.errors.push({case:spec.key,...record.artifactFlushFailure});}finally{livePhase=null;}
    record.finishedAt=new Date().toISOString();await context.storageState({path:resolve(dir,'storage-state.json')}).catch(()=>{});const movie=page.video();await page.close();await context.close();if(movie){const path=resolve(dir,'continuous-ui.webm');await rename(await movie.path(),path);record.video=path;await writeFile(path+'.json',JSON.stringify({...record.build,type:'continuous-main-app-ui-recording',case:spec.key,motion:record.motion,browser:record.browser,requested:{modelId:spec.modelId,sourceId:spec.sourceId,sourceIds:spec.sourceIds,siteKey:spec.siteKey,district:spec.district},frames:record.frames.map(f=>f.name),planFingerprint:plan.planFingerprint,servedSource:record.servedSource,startedAt:record.startedAt,finishedAt:record.finishedAt},null,2));}await writeFile(resolve(dir,'review.json'),JSON.stringify(record,null,2));report.cases.push(record);
   }
   if(!record.complete&&!flag('--keep-going'))break;
  }
  assert.deepEqual(await snapshot(),plan.sourceFiles,'Source snapshot remains frozen throughout actual captures');report.complete=report.cases.length===plan.cases.length&&report.cases.every(c=>c.complete)&&report.errors.length===0;
 }catch(error){report.errors.push({error:String(error)});process.exitCode=1;}
 finally{await browser.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));}
}
