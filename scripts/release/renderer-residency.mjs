import {skipDemonstration,confirmProject,chooseProject,chooseDistrict,cameraControls,artifactContext,captureFrame} from '../integration/ui.mjs';
/** Production regression: complete first frame, fixed views, residency, and existing layers. */
import {chromium} from 'playwright';
import {executablePath,browserArgs} from './browser-options.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import os from 'node:os';
import {MAX_ZOOM} from '../../src/world/city-math.js';
const origin=process.env.APP_URL||'http://127.0.0.1:4174',out=process.env.CAPTURE_DIR||process.env.RELEASE_OUTPUT||'artifacts/renderer';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
const report={checks:[],errors:[],views:[],cycles:[],environment:{cpu:os.cpus()[0]?.model,browser:await browser.version(),node:process.version,platform:os.platform(),arch:os.arch(),viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'reduce'},limitations:['Local desktop production server; not a Railway or physical-phone measurement.','Buffer/shadow/ink memory is exact allocated storage, excluding driver/MSAA/browser overhead.','CPU memory is Chromium JS heap after GC; frame intervals follow the browser display cadence.']};
const requests=[];context.on('request',r=>{if(/^\/alem\/(?:map|facades)-[a-f0-9]{20}\.bin(?:\.gz)?$/.test(new URL(r.url()).pathname))requests.push(r.url());});page.on('pageerror',e=>report.errors.push(e.message));
page.setDefaultTimeout(60000);const map=page.getByTestId('city-map');
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS',name);};
await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
await context.addInitScript(()=>{
 window.__cityFrames=[];let lastCount=0,lastTime=0;
 const collect=t=>{const d=document.querySelector('[data-testid=city-map]')?.dataset,count=+d?.drawCount;if(d?.ready==='true'&&count!==lastCount){if(lastTime)window.__cityFrames.push({ms:t-lastTime,zoom:+d.zoom,submit:+d.drawSubmitMs});lastTime=t;lastCount=count;}requestAnimationFrame(collect);};requestAnimationFrame(collect);
 const observer=new MutationObserver(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(d?.ready==='true'&&!window.__firstResidentFrame){window.__firstResidentFrame={...d};observer.disconnect();}});observer.observe(document,{subtree:true,attributes:true,attributeFilter:['data-ready']});
});
const data=()=>map.evaluate(e=>({...e.dataset}));
const settle=async()=>{await page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.camera||!d.target||d.camera!==d.renderCamera)return false;const a=JSON.parse(d.camera),b=JSON.parse(d.target);return ['x','y','zoom','yaw','pitch'].every(k=>Math.abs(a[k]-b[k])<.000001);});await page.waitForTimeout(80);};
const publicCameraRequest=async action=>{const before=(await data()).cameraRequest;await action();await page.waitForFunction(before=>document.querySelector('[data-testid=city-map]').dataset.cameraRequest!==before,before);};
const home=async()=>{await publicCameraRequest(()=>page.locator('.camera-home').click());await page.waitForFunction(()=>Math.abs(JSON.parse(document.querySelector('[data-testid=city-map]').dataset.camera).zoom-1)<.000001);await settle();};
const zoomIn=()=>page.locator('.camera-main .camera-primary-zoom[aria-label="Zoom in on map"]').click();
const zoomOut=()=>page.locator('.camera-main .camera-primary-zoom[aria-label="Zoom out on map"]').click();
const districts=[['esil','Esil'],['almaty','Almaty'],['saryarka','Saryarka'],['baikonur','Baikonur'],['nura','Nura']];
async function pose(id,close=0){await home();if(id!=='overview'){await publicCameraRequest(()=>page.getByRole('button',{name:'District '+districts.find(d=>d[0]===id)[1]+' on the map',exact:true}).click());await page.waitForFunction(()=>Math.abs(JSON.parse(document.querySelector('[data-testid=city-map]').dataset.camera).zoom-3.1)<.000001);await settle();for(let i=0;i<close;i++)await zoomIn();await page.waitForFunction(z=>Math.abs(JSON.parse(document.querySelector('[data-testid=city-map]').dataset.camera).zoom-z)<.000001,3.1*1.4**close);await settle();}}
const signature=async()=>createHash('sha256').update(await page.locator('.alem-city').evaluate(c=>c.toDataURL())).digest('hex');
async function capture(name,phase){const state=await data(),hash=await signature(),path=`${out}/${phase}-${name}.png`,metadata=await artifactContext(page);await page.locator('.alem-city').screenshot({path});await writeFile(path+'.json',JSON.stringify({...metadata,capture:'city-canvas',camera:JSON.parse(state.camera),time:+state.time},null,2)+'\n');report.views.push({name,phase,hash,data:state,...metadata});return hash;}
const memory=async()=>{await page.evaluate(()=>window.__cityFrames=[]);await cdp.send('HeapProfiler.collectGarbage');return {heap:await cdp.send('Runtime.getHeapUsage'),dom:await cdp.send('Memory.getDOMCounters'),data:await data()};};
try{
 const started=Date.now();await page.goto(origin+'/?mode=astana');await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');await settle();
 report.build=await artifactContext(page);check('actual production Astana build is identified',report.build.world==='astana'&&['connected','static'].includes(report.build.build));
 const metadata=await(await page.request.get(origin+'/alem/geometry-low.json')).json();report.assets={residentBytes:metadata.residentBytes,tiles:metadata.tiles.length,architecture:{asset:metadata.architecture.asset,groups:metadata.architecture.groups.length,instances:metadata.architecture.instances,templateVertices:metadata.architecture.templateVertices}};
 report.coldMs=Date.now()-started;report.firstFrame=await page.evaluate(()=>window.__firstResidentFrame);
 const first=report.firstFrame,loadedRequests=requests.length;
 check('first revealed frame contains every batch and every building',+first.drawCount>0&&+first.residentTiles===+first.expectedTiles&&+first.residentBuildings===60978&&first.completeCity==='true');
 const readyState=await data(),templates=new Set(metadata.architecture.groups.map(g=>g.family+'/'+g.part+'/'+g.columns));
 check('first ready city contains every facade group with one placement upload and shared native templates',+readyState.instanceBatches===metadata.architecture.groups.length&&+readyState.gpuPlacementBuffers===1&&+readyState.gpuTemplates===templates.size);
 check('ink targets are complete in the actual production frame',readyState.inkEnabled==='true'&&+readyState.gpuInkBytes>0);
 report.network=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/\/alem\/(?:map|facades)-/.test(r.name)).map(r=>({url:r.name,encoded:r.encodedBodySize,decoded:r.decodedBodySize,ms:r.duration})));
 report.gpu=await page.locator('.alem-city').evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';});
 await skipDemonstration(page);await cameraControls(page);
 const views=[['overview',0],...districts.map(d=>[d[0],0]),['esil',11]],hashes=new Map();
 for(const [id,close] of views){await pose(id,close);const name=close?'dense-close':id;hashes.set(name,await capture(name,'cold'));}
 report.before=await memory();
 for(let cycle=0;cycle<Number(process.env.RENDERER_CYCLES||3);cycle++){
  for(const [id] of districts){
   await pose(id,7);const before=await data();
   await page.getByRole('button',{name:'Rotate map right',exact:true}).click();
   await page.getByRole('button',{name:'Increase tilt',exact:true}).click();
   const canvas=page.locator('.alem-city');await canvas.focus();for(const key of ['ArrowRight','ArrowRight','ArrowDown','ArrowLeft'])await canvas.press(key);
   await settle();check(`cycle ${cycle+1} ${id}: all buildings remain resident`,+(await data()).residentBuildings===60978);
   report.cycles.push({cycle,id,before,after:await data()});
  }
  await home();report.cycles.push({cycle,memory:await memory()});
 }
 // Exercise the supported limits, where ground-only culling used to be unsafe.
 await cameraControls(page);await pose('esil',11);for(let i=0;i<10;i++)await zoomIn();
 await page.waitForFunction(max=>+document.querySelector('[data-testid=city-map]').dataset.zoom===max,MAX_ZOOM);
 for(let i=0;i<8;i++)await page.getByRole('button',{name:'Decrease tilt',exact:true}).click();
 for(let i=0;i<24;i++)await page.getByRole('button',{name:'Rotate map right',exact:true}).click();await settle();
 check('maximum zoom and low-angle rotation retain the whole resident city',+(await data()).residentBuildings===60978);await capture('maximum-zoom-low-angle','stress');
 for(let i=0;i<8;i++)await page.getByRole('button',{name:'Increase tilt',exact:true}).click();await settle();await capture('maximum-zoom-high-angle','stress');
 // Rapid changes interrupt flights; a complete city must still be available immediately.
 await home();await page.emulateMedia({reducedMotion:'no-preference'});
 for(let i=0;i<12;i++){await page.locator('.camera-home').click();await page.getByRole('button',{name:'District '+districts[i%5][1]+' on the map',exact:true}).click();if(i%2)await zoomIn();else await zoomOut();}
 await home();await page.emulateMedia({reducedMotion:'reduce'});
 for(const [id,close] of views){await pose(id,close);const name=close?'dense-close':id;check(`fixed ${name} is pixel-identical after navigation`,await capture(name,'return')===hashes.get(name));}
 report.after=await memory();
 check('navigation makes zero city requests after readiness',requests.length===loadedRequests);
 check('navigation retains exactly one copy of each city/facade batch and ink target',report.before.data.gpuBufferBytes===report.after.data.gpuBufferBytes&&report.before.data.gpuBuffers===report.after.data.gpuBuffers&&report.before.data.gpuMeshes===report.after.data.gpuMeshes&&report.before.data.gpuTemplates===report.after.data.gpuTemplates&&report.before.data.gpuPlacementBuffers===report.after.data.gpuPlacementBuffers&&report.before.data.gpuInkBytes===report.after.data.gpuInkBytes);
 // Existing preview and committed intervention, through normal planning controls.
 await home();await chooseProject(page,'M7');await chooseDistrict(page,'nura');await settle();
 check('proposal has anchored geometry after base readiness',+(await data()).projectVertices>0&&(await data()).preview==='M7');
 await confirmProject(page);await home();await page.locator('.map-project[data-initiative=M7][data-proposal=false][data-child=false]').click();await page.getByTestId('program-inspection').waitFor();check('committed school picking opens read-only inspection',await page.getByTestId('held-project').count()===0&&(await data()).preview==='');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await settle();await capture('school','committed');
 const committed=JSON.parse((await data()).interventions);await pose('almaty',7);await home();await page.locator('.map-project[data-initiative=M7][data-proposal=false][data-child=false]').click();await page.getByTestId('program-inspection').waitFor();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await settle();
 check('committed school keeps exact world anchors without duplication',JSON.stringify(JSON.parse((await data()).interventions))===JSON.stringify(committed));
 await capture('school','return');check('school camera return is pixel-identical',report.views.at(-1).hash===report.views.at(-2).hash);
 check('scenario navigation makes no city requests',requests.length===loadedRequests);
 // Continuous movement in normal animation mode; sample actual submitted map frames.
 await page.emulateMedia({reducedMotion:'no-preference'});
 report.performance={};
 for(const [name,id,close] of [['overview','overview',0],['close','esil',7]]){
  await pose(id,close);check(`performance ${name} uses the intended scale`,Math.abs(+(await data()).zoom-(close?3.1*1.4**close:1))<.001);await page.evaluate(()=>window.__cityFrames=[]);
  for(let i=0;i<12;i++){await page.getByRole('button',{name:i%2?'Rotate map left':'Rotate map right',exact:true}).click();await page.waitForTimeout(130);}
  await settle();const frames=await page.evaluate(()=>window.__cityFrames),moving=frames.slice(1).map(f=>f.ms).sort((a,b)=>a-b);
  report.performance[name]={samples:moving.length,medianMs:moving[Math.floor(moving.length*.5)],p95Ms:moving[Math.floor(moving.length*.95)],data:await data()};
  check(`performance ${name} uses the intended lens and ink`,(await data()).cameraLens===(name==='overview'?'orthographic':'architectural')&&(await data()).inkEnabled==='true');
 }
 // Quiet mode must freeze people as well as buildings and release idle GPU work.
 await page.emulateMedia({reducedMotion:'reduce'});await home();
 await chooseProject(page,'M4');await chooseDistrict(page,'esil');await confirmProject(page);
 await home();await page.locator('.map-project[data-initiative=M4][data-proposal=false][data-child=false]').click();await page.getByTestId('program-inspection').waitFor();await page.getByTestId('program-inspection').getByRole('button',{name:'Meet residents',exact:true}).click();await page.locator('.resident-encounter').waitFor();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await settle();
 await page.waitForFunction(()=>+document.querySelector('[data-testid=city-map]').dataset.actorVertices>0);
 await page.waitForTimeout(400);const quiet=await data(),quietPixels=await signature();await page.waitForTimeout(600);
 const quietAfter=await data();
 check('reduced-motion residents retain identical positions and pixels',quiet.actors===quietAfter.actors&&quietPixels===await signature());
 check('stationary reduced-motion residents do not redraw or upload every frame',quiet.drawCount===quietAfter.drawCount);
 check('no WebGL errors',await page.locator('.alem-city').evaluate(c=>c.getContext('webgl2').getError())===0);
 check('no unhandled browser exceptions',report.errors.length===0);report.completed=true;
}catch(error){report.completed=false;report.failure=String(error);console.error(error);process.exitCode=1;await captureFrame(page,out+'/failure.png',report).catch(()=>{});}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
