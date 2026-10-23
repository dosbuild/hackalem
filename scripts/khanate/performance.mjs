/** Sequential plain-static measurements; includes worker fetches and both worlds. */
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {confirmProject,cameraControls,artifactContext,captureFrame} from '../integration/ui.mjs';

const root=resolve(process.env.STATIC_DIR||'dist-static'),out=process.env.CAPTURE_DIR||'artifacts/khanate/performance';await mkdir(out,{recursive:true});
const version=JSON.parse(await readFile(resolve(root,'version.json'),'utf8'));
const metadata={astana:JSON.parse(await readFile(resolve(root,'alem/geometry-low.json'),'utf8')),khanate:JSON.parse(await readFile(resolve(root,'khanate/geometry.json'),'utf8'))};
const requests=[],types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.gz':'application/gzip','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);if(!file.startsWith(root+sep))throw Error();const bytes=await readFile(file);requests.push({path:pathname,bytes:bytes.length});res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'public, max-age=3600','Content-Length':bytes.length});res.end(bytes);}catch{requests.push({path:req.url,bytes:0,error:true});res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const report={version,checks:[],failures:[],errors:[],loads:[],cycles:[],performance:[],environment:{cpu:os.cpus()[0]?.model,browser:await browser.version(),node:process.version,platform:os.platform(),arch:os.arch(),viewport:{width:1440,height:900},deviceScaleFactor:1},thresholds:{historicalColdBytes:4_000_000,heapGrowthBytes:8_000_000,minimumSubmittedFrames:30},limits:['Local plain HTTP hosting; no network throttle or HTTP content encoding.','Payload bytes come from the test server and include worker fetches; headers and subsequent artifact-label requests are excluded.','Frame intervals follow submitted frames at display cadence; they are not GPU execution time.','GPU allocation excludes driver/MSAA/browser overhead; heap is measured after GC.','Emulated desktop Chromium, not physical phone hardware.']};
report.assets={astana:{residentBytes:metadata.astana.residentBytes,tiles:metadata.astana.tiles.length,facade:metadata.astana.architecture.asset,facadeGroups:metadata.astana.architecture.groups.length},khanate:{residentBytes:metadata.khanate.residentBytes,buildings:metadata.khanate.buildingFeatures}};
const check=(name,ok,collect=false)=>{if(!ok&&collect){report.failures.push(name);console.log('FAIL',name);return;}assert(ok,name);report.checks.push(name);console.log('PASS',name);};
const ready=p=>p.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return d?.ready==='true'&&d.camera===d.renderCamera&&+d.drawCount>0;});
const data=p=>p.getByTestId('city-map').evaluate(e=>({...e.dataset}));
const settle=p=>p.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.target||d.camera!==d.renderCamera)return false;const camera=JSON.parse(d.camera),target=JSON.parse(d.target);return ['x','y','yaw','pitch','zoom'].every(key=>Number.isFinite(camera[key])&&Math.abs(camera[key]-target[key])<.000001);});
const samePose=(a,b)=>['x','y','yaw','pitch','zoom'].every(key=>Number.isFinite(a[key])&&Number.isFinite(b[key])&&Math.abs(a[key]-b[key])<.000001);
const home=async p=>{const before=(await data(p)).cameraRequest,zoom=await p.locator('html').getAttribute('data-mode')==='khanate'?7:1;await p.locator('.camera-home').click();await p.waitForFunction(({before,zoom})=>{const d=document.querySelector('[data-testid=city-map]').dataset;return d.cameraRequest!==before&&JSON.parse(d.camera).zoom===zoom&&d.camera===d.renderCamera;},{before,zoom});await settle(p);};
const zoomIn=p=>p.locator('.camera-main .camera-primary-zoom[aria-label="Zoom in on map"]').click();
const payloadCategory=name=>/\/map-|\/facades-/.test(name)?'world geometry':name.endsWith('.woff2')?'fonts':name.startsWith('/project-previews/')?'own-model previews':name.startsWith('/aya/')?'Aya art':name.endsWith('.js')?'application JavaScript':name.endsWith('.css')?'styles':'other';
let context,page;

async function measureFrames(mode,name){
 await ready(page);await settle(page);await page.emulateMedia({reducedMotion:'no-preference'});await cameraControls(page);
 const before=await data(page),startPose=JSON.parse(before.camera);
 await page.evaluate(()=>{window.__frames=[];let last=0,count=0;const frame=t=>{const d=document.querySelector('[data-testid=city-map]')?.dataset,n=+d?.drawCount;if(d?.ready==='true'&&n!==count){if(last)window.__frames.push({interval:t-last,submit:+d.drawSubmitMs,camera:JSON.parse(d.camera),sameFrame:d.camera===d.renderCamera,lens:d.cameraLens,inkEnabled:d.inkEnabled,inkBytes:+d.gpuInkBytes,buildings:+d.residentBuildings,tiles:+d.residentTiles,facadeBatches:+d.instanceBatches});last=t;count=n;}window.__probe=requestAnimationFrame(frame);};window.__probe=requestAnimationFrame(frame);});
 // Public inspection orbit retains the current place and lens. The interval
 // matches the original sixteen-rotation measurement, approximately two seconds.
 await page.locator('.camera-orbit[aria-pressed="false"]').waitFor();await page.locator('.camera-orbit').click();await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]').dataset.inspectionOrbit==='true');await page.waitForTimeout(2100);
 await page.locator('.camera-orbit').click();await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]').dataset.inspectionOrbit==='false');await settle(page);
 const frames=await page.evaluate(()=>{cancelAnimationFrame(window.__probe);return window.__frames.slice(1);}),quantile=(key,q)=>frames.map(f=>f[key]).sort((a,b)=>a-b)[Math.floor(frames.length*q)]??0;
 const map=await data(page),label=await artifactContext(page),measurement={mode,name,...label,startPose,samples:frames.length,medianMs:quantile('interval',.5),p95Ms:quantile('interval',.95),medianSubmitMs:quantile('submit',.5),p95SubmitMs:quantile('submit',.95),map,frames};report.performance.push(measurement);
 check(`${mode} ${name}: submitted frames remain coherent and error free`,frames.length>report.thresholds.minimumSubmittedFrames&&frames.every(f=>f.sameFrame&&f.buildings===metadata[mode].buildingFeatures&&f.inkEnabled==='true'&&f.inkBytes>0)&&await page.locator('.alem-city').evaluate(c=>c.getContext('webgl2').getError())===0);
 check(`${mode} ${name}: actual architectural place stays in perspective`,frames.every(f=>f.lens==='architectural'&&f.camera.perspective>0));
 if(mode==='astana')check(`${name}: all Astana batches and facade placements remain resident`,frames.every(f=>f.tiles===metadata.astana.tiles.length&&f.facadeBatches===metadata.astana.architecture.groups.length));
 await captureFrame(page,`${out}/${mode}-${name}.png`,report);await page.emulateMedia({reducedMotion:'reduce'});await settle(page);return measurement;
}

try{
 check('measured build is the actual static release',version.delivery==='static'&&version.worlds.includes('astana')&&version.worlds.includes('khanate'));
 for(const mode of ['astana','khanate']){
  context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce'});
  await context.addInitScript(()=>{
   window.__resources={};for(const type of ['Buffer','Texture','Framebuffer','VertexArray','Program']){
    const proto=WebGL2RenderingContext.prototype,create=proto[`create${type}`],remove=proto[`delete${type}`];window.__resources[type]=0;
    proto[`create${type}`]=function(...args){const result=create.apply(this,args);if(result)window.__resources[type]++;return result;};
    proto[`delete${type}`]=function(item){if(item)window.__resources[type]--;return remove.call(this,item);};
   }
  });
  for(const cache of ['cold','warm']){
   page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));const first=requests.length,start=Date.now();
   await page.goto(`${origin}/?mode=${mode}`);await page.getByTestId('decision-deck').waitFor();const choiceMs=Date.now()-start;await ready(page);const readyMs=Date.now()-start;
   await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete));
   const transfer=requests.slice(first),bodyBytes=transfer.reduce((sum,r)=>sum+r.bytes,0),breakdown={};for(const r of transfer){const category=payloadCategory(r.path);breakdown[category]=(breakdown[category]??0)+r.bytes;}
   const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');const map=await data(page),label=await artifactContext(page);
   report.loads.push({mode,cache,choiceMs,readyMs,bodyBytes,breakdown,requests:transfer,heap:await cdp.send('Runtime.getHeapUsage'),map,...label});
   check(`${mode} ${cache}: capture belongs to this actual static build`,label.world===mode&&label.build==='static'&&label.builtAt===version.builtAt&&+map.residentBuildings===metadata[mode].buildingFeatures&&map.inkEnabled==='true');
   if(mode==='khanate')check(`${cache}: historical entry has no modern geometry or facade asset`,!transfer.some(r=>/^\/alem\/(map|facades|geometry)/.test(r.path)));
   if(mode==='astana')check(`${cache}: complete native facade data is resident before ready`,+map.instanceBatches===metadata.astana.architecture.groups.length&&+map.gpuPlacementBuffers===1);
   await captureFrame(page,`${out}/${mode}-${cache}-entry.png`,report);
   if(cache==='cold')await page.close();
  }
  // World profiles remain sequential; cold/warm measurements are already saved.
  await measureFrames(mode,'entry-orbit');
  if(mode==='astana'){
   await home(page);const beforeDistrict=(await data(page)).cameraRequest;await page.getByRole('button',{name:'District Esil on the map',exact:true}).click();await page.waitForFunction(before=>{const d=document.querySelector('[data-testid=city-map]').dataset;return d.cameraRequest!==before&&JSON.parse(d.camera).zoom===3.1&&d.camera===d.renderCamera;},beforeDistrict);await settle(page);for(let i=0;i<11;i++)await zoomIn(page);await settle(page);
   await measureFrames('astana','dense-close-orbit');await context.close();
  }
 }
 const historical=report.loads.find(l=>l.mode==='khanate'&&l.cache==='cold');
 // Retain the original cap and failing exit. A miss still collects switch and
 // frame evidence so actual additional payload can be diagnosed.
 check('Historical cold entry uses less than 4 MB',historical.bodyBytes<report.thresholds.historicalColdBytes,true);
 report.historicalBudgetExcess=Math.max(0,historical.bodyBytes-report.thresholds.historicalColdBytes);
 await page.locator('.need-card[data-choice=M7]').click();await confirmProject(page);await ready(page);await settle(page);
 const cdp=await context.newCDPSession(page),memory=async()=>{await cdp.send('HeapProfiler.collectGarbage');return {heap:await cdp.send('Runtime.getHeapUsage'),dom:await cdp.send('Memory.getDOMCounters'),map:await data(page),resources:await page.evaluate(()=>window.__resources),...await artifactContext(page)};};
 // One live document exposes leaks across complete world disposal.
 for(let i=0;i<12;i++){
  const mode=i%2?'khanate':'astana';await page.getByRole('button',{name:mode==='khanate'?'Khanate':'Astana',exact:true}).click();await ready(page);await settle(page);await page.waitForTimeout(250);
  report.cycles.push({cycle:i+1,mode,...await memory()});
 }
 for(const mode of ['astana','khanate']){
  const samples=report.cycles.filter(c=>c.mode===mode),first=samples[0],last=samples.at(-1);
  check(`${mode}: repeated switches retain one canvas`,last.dom.documents<=first.dom.documents+2&&await page.locator('.alem-city').count()===1);
  check(`${mode}: buffers, textures, programs and vertex arrays are fully released`,JSON.stringify(first.resources)===JSON.stringify(last.resources));
  check(`${mode}: resident GPU allocation including ink does not grow`,first.map.gpuBufferBytes===last.map.gpuBufferBytes&&first.map.gpuShadowBytes===last.map.gpuShadowBytes&&first.map.gpuInkBytes===last.map.gpuInkBytes&&first.map.gpuTemplates===last.map.gpuTemplates&&first.map.gpuPlacementBuffers===last.map.gpuPlacementBuffers);
  check(`${mode}: JS heap stays bounded after collection`,last.heap.usedSize<first.heap.usedSize+report.thresholds.heapGrowthBytes);
 }
 check('Historical school survives all switches',await page.getByTestId('remaining-budget').innerText()==='76');
 const cameraBefore=JSON.parse((await data(page)).camera);await page.getByRole('button',{name:'Astana',exact:true}).click();await ready(page);await page.getByRole('button',{name:'Khanate',exact:true}).click();await ready(page);await settle(page);
 check('Return restores the world-owned historical pose despite additional camera fields',samePose(JSON.parse((await data(page)).camera),cameraBefore));
 report.populatedHistoricalFrames=await measureFrames('khanate','committed-school-orbit');
 check('Static measurement makes no API calls or missing-asset requests',!requests.some(r=>r.path.includes('/api/')||r.error));
 check('No unhandled exceptions',report.errors.length===0);report.completed=report.failures.length===0;if(!report.completed)process.exitCode=1;
}catch(error){report.completed=false;report.failure=String(error);console.error(error);process.exitCode=1;if(page)await captureFrame(page,out+'/failure.png',report).catch(()=>{});}
finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');}
