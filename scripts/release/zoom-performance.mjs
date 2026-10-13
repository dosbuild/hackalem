import {skipDemonstration,confirmProject,chooseProject,chooseDistrict,cameraControls,artifactContext,captureFrame,nextDecision} from '../integration/ui.mjs';
/** Real production input → draw verification, including populated scenario layers. */
import {chromium} from 'playwright';
import {executablePath,browserArgs} from './browser-options.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import assert from 'node:assert/strict';
const origin=process.env.APP_URL||'http://127.0.0.1:4174',out=process.env.CAPTURE_DIR||process.env.RELEASE_OUTPUT||'artifacts/zoom-performance';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,hasTouch:true,reducedMotion:'no-preference'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
page.setDefaultTimeout(60000);const report={checks:[],failures:[],errors:[],phases:[],browser:await browser.version(),environment:{cpu:os.cpus()[0]?.model,browser:await browser.version(),node:process.version,platform:os.platform(),arch:os.arch(),viewport:{width:1440,height:900},deviceScaleFactor:2,reducedMotion:'normal'}},requests=[];
const check=(name,ok,collectFailure=false)=>{if(!ok&&collectFailure){report.failures.push(name);console.log('FAIL',name);return;}assert(ok,name);report.checks.push(name);console.log('PASS',name);};
page.on('pageerror',e=>report.errors.push(e.message));context.on('request',r=>{if(/^\/alem\/(?:map|facades)-[a-f0-9]{20}\.bin(?:\.gz)?$/.test(new URL(r.url()).pathname))requests.push(r.url());});
await context.addInitScript(()=>{
 window.__zoom={phase:'',frames:[],gpu:[],inputs:[],display:[]};const log=window.__zoom,raf=window.requestAnimationFrame;let gl,ext,query,queryPhase='',active=false,lastCount=0,lastTime=0,lastPhase='',pending=[];
 const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){const result=get.call(this,type,...args);if(type==='webgl2'&&result&&!gl){gl=result;ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');const info=gl.getExtension('WEBGL_debug_renderer_info');log.renderer=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'unknown';}return result;};
 for(const method of ['drawArrays','drawElements','drawArraysInstanced']){const original=WebGL2RenderingContext.prototype[method];WebGL2RenderingContext.prototype[method]=function(...args){if(active&&ext&&!query&&log.phase){query=gl.createQuery();queryPhase=log.phase;gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}return original.apply(this,args);};}
 window.requestAnimationFrame=callback=>raf.call(window,t=>{const start=performance.now();active=true;callback(t);active=false;if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,t,phase:queryPhase});query=null;}const d=document.querySelector('[data-testid=city-map]')?.dataset;if(d?.ready==='true'&&+d.drawCount!==lastCount){if(log.phase){const camera=JSON.parse(d.camera),target=JSON.parse(d.target);log.frames.push({phase:log.phase,t,cpuMs:performance.now()-start,interval:lastPhase===log.phase?t-lastTime:0,zoom:camera.zoom,target:target.zoom,cameraMatches:d.camera===d.renderCamera,buildings:+d.residentBuildings,tiles:+d.residentTiles,shadowCalls:+d.shadowDrawCalls,projectVertices:+d.projectVertices,actorVertices:+d.actorVertices,perspective:camera.perspective,lens:d.cameraLens,inkEnabled:d.inkEnabled,inkBytes:+d.gpuInkBytes,facadeBatches:+d.instanceBatches});}lastCount=+d.drawCount;lastTime=t;lastPhase=log.phase;}for(let i=pending.length-1;i>=0;i--){const p=pending[i];if(gl.getQueryParameter(p.query,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))log.gpu.push({phase:p.phase,t:p.t,ms:gl.getQueryParameter(p.query,gl.QUERY_RESULT)/1e6});gl.deleteQuery(p.query);pending.splice(i,1);}}});
 const display=t=>{log.display.push(t);if(log.display.length>300)log.display.shift();raf.call(window,display);};raf.call(window,display);
 document.addEventListener('wheel',e=>{if(log.phase&&e.target.classList?.contains('alem-city'))log.inputs.push({phase:log.phase,t:performance.now(),trusted:e.isTrusted});},true);
});
const data=()=>page.getByTestId('city-map').evaluate(e=>({...e.dataset}));
const settle=()=>page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.camera||d.camera!==d.renderCamera)return false;const a=JSON.parse(d.camera),b=JSON.parse(d.target);return ['x','y','yaw','pitch','zoom'].every(k=>Math.abs(a[k]-b[k])<.000001);});
const targetZoom=zoom=>page.waitForFunction(zoom=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return d?.target&&JSON.parse(d.target).zoom===zoom;},zoom);
const publicCameraRequest=async action=>{const before=(await data()).cameraRequest;await action();await page.waitForFunction(before=>document.querySelector('[data-testid=city-map]').dataset.cameraRequest!==before,before);};
const home=async()=>{await publicCameraRequest(()=>page.locator('.camera-home').click());await targetZoom(1);await settle();};
const zoomIn=()=>page.locator('.camera-main .camera-primary-zoom[aria-label="Приблизить карту"]').click();
const pct=(xs,p)=>xs.sort((a,b)=>a-b)[Math.floor((xs.length-1)*p)]||0;
async function wheelTour(name,firstDirection=-1,steps=100){
 await page.evaluate(async({name,firstDirection,steps})=>{const canvas=document.querySelector('.alem-city');window.__zoom.phase=name;for(const direction of [firstDirection,-firstDirection])for(let i=0;i<steps;i++){await new Promise(requestAnimationFrame);canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:direction*20,bubbles:true,cancelable:true}));}await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);window.__zoom.phase='';},{name,firstDirection,steps});
 const log=await page.evaluate(()=>window.__zoom),frames=log.frames.filter(f=>f.phase===name),gpu=log.gpu.filter(f=>f.phase===name);
 const refresh=pct(log.display.slice(1).map((t,i)=>t-log.display[i]),.5),summary={name,frames:frames.length,displayIntervalMs:refresh,cpuP95Ms:pct(frames.map(f=>f.cpuMs),.95),gpuP95Ms:pct(gpu.map(f=>f.ms),.95),frameP95Ms:pct(frames.map(f=>f.interval).filter(Boolean),.95),worstZoomError:Math.max(...frames.map(f=>Math.abs(Math.log(f.zoom/f.target))))};report.phases.push(summary);
 check(`${name}: submitted frames are measured`,frames.length>10);
 check(`${name}: every zoom frame reaches the current input target`,summary.worstZoomError<1e-8);
 check(`${name}: camera and city layers share every rendered frame`,frames.every(f=>f.cameraMatches&&f.buildings===60978&&f.tiles===144&&f.inkEnabled==='true'&&f.inkBytes>0&&f.facadeBatches===report.assets.facadeGroups));
 check(`${name}: CPU work fits within half a display interval`,summary.cpuP95Ms<refresh*.5,true);
 check(`${name}: GPU work fits within a display interval`,!gpu.length||summary.gpuP95Ms<refresh,true);
 check(`${name}: zoom keeps display cadence`,summary.frameP95Ms<refresh*1.2+1,true);
}
try{
 await page.goto(origin+'/?mode=astana');await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');const initial=await data(),requestCount=requests.length;
 report.build=await artifactContext(page);check('actual production Astana build is identified',report.build.world==='astana'&&['connected','static'].includes(report.build.build));
 const metadata=await(await page.request.get(origin+'/alem/geometry-low.json')).json();report.assets={facade:metadata.architecture.asset,facadeGroups:metadata.architecture.groups.length,residentBytes:metadata.residentBytes,tiles:metadata.tiles.length};
 await skipDemonstration(page);await cameraControls(page);
 check('entry starts in the architectural lens with ink enabled',initial.cameraLens==='architectural'&&initial.inkEnabled==='true');
 await home();check('one overview action selects the orthographic lens',(await data()).cameraLens==='orthographic');
 for(const district of ['Есиль','Алматы','Сарыарка','Байконур','Нура']){await home();await publicCameraRequest(()=>page.getByRole('button',{name:'Район '+district+' на карте',exact:true}).click());await targetZoom(3.1);await settle();await wheelTour(district);}
 // Native browser wheel dispatch verifies the real input path, too.
 await home();await page.mouse.move(720,360);await page.evaluate(()=>window.__zoom.phase='native-wheel');for(let i=0;i<28;i++){await page.mouse.wheel(0,-24);await page.waitForTimeout(18);}await page.waitForTimeout(70);await page.evaluate(()=>window.__zoom.phase='');
 let log=await page.evaluate(()=>window.__zoom);const native=log.frames.filter(f=>f.phase==='native-wheel');check('trusted wheel input reaches its target without a trailing zoom animation',log.inputs.some(i=>i.phase==='native-wheel'&&i.trusted)&&native.length>10&&native.every(f=>f.zoom===f.target));
 // Two fingers must also interrupt any flight and follow their current separation.
 await home();const touchPoints=[{x:620,y:360,id:1},{x:820,y:360,id:2}];await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints});await page.evaluate(()=>window.__zoom.phase='pinch');for(let i=1;i<=20;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:620-i*3,y:360,id:1},{x:820+i*3,y:360,id:2}]});await page.waitForTimeout(18);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(70);await page.evaluate(()=>window.__zoom.phase='');log=await page.evaluate(()=>window.__zoom);const pinch=log.frames.filter(f=>f.phase==='pinch');check('pinch follows fingers without camera lag',pinch.length>8&&pinch.every(f=>f.zoom===f.target)&&Math.abs(JSON.parse((await data()).camera).zoom-1.6)<.000001);
 // Twist a real two-pointer gesture on the exposed city, above the choice cards.
 await home();const twistBefore=JSON.parse((await data()).camera);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:620,y:360,id:1},{x:820,y:360,id:2}]});
 for(let i=1;i<=20;i++){const angle=i*.03;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:720-100*Math.cos(angle),y:360-100*Math.sin(angle),id:1},{x:720+100*Math.cos(angle),y:360+100*Math.sin(angle),id:2}]});await page.waitForTimeout(18);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(70);const twistAfter=JSON.parse((await data()).camera),turn=Math.atan2(Math.sin(twistAfter.yaw-twistBefore.yaw),Math.cos(twistAfter.yaw-twistBefore.yaw));check('two-finger twist rotates the shared camera without changing scale or spending',Math.abs(turn-.6)<.01&&Math.abs(twistAfter.zoom-twistBefore.zoom)<.00001&&await page.getByTestId('remaining-budget').innerText()==='100'&&(await data()).camera===(await data()).renderCamera);
 await home();const before=JSON.parse((await data()).camera).zoom;await zoomIn();await page.waitForTimeout(220);const button=JSON.parse((await data()).camera).zoom;check('discrete zoom controls finish more than 90% of their transition within 220 ms',(1.4-button)/(1.4-before)<.1);await settle();
 // Prepare an ordinary five-project plan, then exercise normal motion around its residents.
 await page.emulateMedia({reducedMotion:'reduce'});for(const [id,district]of [['M4','esil'],['M1','almaty'],['M8','nura'],['M10','saryarka'],['M14',null]]){await chooseProject(page,id);if(district)await chooseDistrict(page,district);await confirmProject(page);if(id!=='M14')await nextDecision(page);}
 await home();await page.locator('.map-project[data-initiative=M8][data-proposal=false][data-child=false]').click();const inspection=page.getByTestId('program-inspection');await inspection.waitFor();check('populated project picking remains read-only',await page.getByTestId('held-project').count()===0&&(await data()).preview==='');await inspection.locator('.program-locations>summary').click();await inspection.locator('.program-locations li').getByRole('button',{name:'Медпункт 1',exact:true}).click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await targetZoom(160);await settle();await page.emulateMedia({reducedMotion:'no-preference'});const anchors=(await data()).interventions;
 await wheelTour('five-projects-and-residents',1,125);check('inhabited project stays populated after zooming',(+(await data()).actorVertices)>0&&(await data()).interventions===anchors);
 await captureFrame(page,out+'/inhabited-close.png',report);await home();await captureFrame(page,out+'/overview.png',report);
 check('zoom never downloads city geometry',requests.length===requestCount);check('city geometry remains resident',+(await data()).residentBuildings===+initial.residentBuildings);
 check('no browser or WebGL errors',report.errors.length===0&&await page.locator('.alem-city').evaluate(c=>c.getContext('webgl2').getError())===0);
 report.measurements=await page.evaluate(()=>window.__zoom);report.completed=report.failures.length===0;if(!report.completed)process.exitCode=1;
}catch(error){report.completed=false;report.failure=String(error);console.error(error);process.exitCode=1;await captureFrame(page,out+'/failure.png',report).catch(()=>{});report.measurements=await page.evaluate(()=>window.__zoom).catch(()=>null);}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
