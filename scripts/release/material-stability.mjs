import {skipDemonstration,artifactContext,captureFrame,labelVideo} from '../integration/ui.mjs';
/** Temporal raster regression through production wheel input, not just fixed views. */
import {chromium} from 'playwright';
import {executablePath,browserArgs} from './browser-options.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import assert from 'node:assert/strict';
const origin=process.env.APP_URL||'http://127.0.0.1:4174',out=process.env.CAPTURE_DIR||process.env.RELEASE_OUTPUT||'artifacts/material-stability';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const context=await browser.newContext({viewport:{width:1000,height:800},reducedMotion:'reduce',recordVideo:{dir:out+'/video',size:{width:1000,height:800}}});
const page=await context.newPage(),report={checks:[],pairs:[],tours:[],errors:[],environment:{cpu:os.cpus()[0]?.model,browser:await browser.version(),node:process.version,platform:os.platform(),arch:os.arch(),viewport:{width:1000,height:800},deviceScaleFactor:1,reducedMotion:'reduce'}};page.setDefaultTimeout(60000);
page.on('pageerror',e=>report.errors.push(e.message));
const check=(name,value)=>{report.checks.push({name,passed:!!value});if(!process.env.MATERIAL_BASELINE)assert(value,name);console.log(value?'PASS':'FAIL',name);};
try{
 await page.goto(origin+'/?mode=astana');await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');
 report.build=await artifactContext(page);check('actual production Astana build is identified',report.build.world==='astana'&&['connected','static'].includes(report.build.build));
 const metadata=await(await page.request.get(origin+'/alem/geometry-low.json')).json();report.assets={facade:metadata.architecture.asset,facadeGroups:metadata.architecture.groups.length,residentBytes:metadata.residentBytes};
 await skipDemonstration(page);
 await page.evaluate(()=>{
  const element=document.querySelector('[data-testid=city-map]'),canvas=document.querySelector('.alem-city'),gl=canvas.getContext('webgl2');
  const frame=()=>new Promise(requestAnimationFrame);
  const pose=()=>JSON.parse(element.dataset.camera);
  window.materialProbe={
   async zoomTo(z){const p=pose(),target=Math.max(1,Math.min(288,z*p.height*.415/Math.min(p.height*.36,p.width*.29)));
    for(let i=0;i<40;i++){const current=pose().zoom;if(Math.abs(current-target)<1e-10)break;canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:Math.max(-130,Math.min(130,-Math.log(target/current)/.002)),bubbles:true,cancelable:true}));await frame();await frame();}
    await frame();const current=pose();if(element.dataset.camera!==element.dataset.renderCamera||Math.abs(current.zoom-target)>1e-8)throw Error('Material capture is not at a settled rendered camera');return current;
   },
   pixels(){const a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;},
   compare(a,b){const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;let strong=0,interior=0,interiorFlips=0,sum=0;
    for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){
     const i=(y*width+x)*4;let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(a[i+c]-b[i+c]));sum+=d;strong+=d>8;
     let flat=true;for(const offset of [-2*width,-width,-2,-1,1,2,width,2*width]){for(let c=0;c<3;c++)if(Math.abs(a[i+c]-a[i+offset*4+c])>=5||Math.abs(b[i+c]-b[i+offset*4+c])>=5){flat=false;break;}if(!flat)break;}
     if(flat){interior++;interiorFlips+=d>8;}
    }
    return {strong,interior,interiorFlips,meanDelta:sum/(width*height),pixels:width*height};
   },canvas,gl,element,frame,pose
  };
 });
 const detailHeight=1.5/12000,fadeScale=detailHeight*.415*800,fadePixels=[1.3,3.2],fadeSamples=[fadePixels[0],(fadePixels[0]+fadePixels[1])/2,fadePixels[1]];
 report.windowFade={detailHeightMetres:1.5,pixelRange:fadePixels,groundRendererZoomRange:fadePixels.map(p=>p/fadeScale),districtGroundTransitions:[],note:'Nominal range omits camera tilt/depth. Each district also samples the projected-height fade endpoints and midpoint at its actual camera ground centre; surface position/depth can vary these thresholds. Actual native-city raster pairs remain the authority.'};
 // Retain every original sample as well as the current fade interval.
 const originalZooms=[.36/.415,1.2*.36/.415,3*.36/.415,3,4,5,7.6,1.9/2**-2.5,15.2,1.9/2**-3.5,.8/fadeScale,30.4,50,2.2/fadeScale,100,200];
 for(const district of ['Есиль','Алматы','Сарыарка','Байконур','Нура']){
  const beforeHome=await page.getByTestId('city-map').getAttribute('data-camera-request');await page.locator('.camera-home').click();await page.waitForFunction(before=>{const d=document.querySelector('[data-testid=city-map]').dataset;return d.cameraRequest!==before&&JSON.parse(d.camera).zoom===1&&d.camera===d.renderCamera;},beforeHome);
  const beforeDistrict=await page.getByTestId('city-map').getAttribute('data-camera-request');await page.getByRole('button',{name:'Район '+district+' на карте',exact:true}).click();await page.waitForFunction(before=>{const d=document.querySelector('[data-testid=city-map]').dataset;return d.cameraRequest!==before&&JSON.parse(d.camera).zoom===3.1&&d.camera===d.renderCamera;},beforeDistrict);
  const transition=await page.evaluate(({detailHeight,pixels})=>{
   const p=materialProbe.pose(),vertical=Math.abs(p.matrix[7])*detailHeight*.415*p.height,depth=detailHeight*p.matrix[8]*.415/2.2;
   // The fade range lies within the full architectural lens. Solve the
   // production projected vertical segment at the ground centre for its zoom.
   return {pitch:p.pitch,rendererZooms:pixels.map(pixel=>pixel/(vertical+pixel*depth))};
  },{detailHeight,pixels:fadeSamples});
  check(`${district}: current window fade has finite ordered transition samples`,transition.rendererZooms.every((z,i)=>Number.isFinite(z)&&z>0&&(i===0||z>transition.rendererZooms[i-1])));
  report.windowFade.districtGroundTransitions.push({district,...transition});
  const zooms=[...new Set([...originalZooms,...fadeSamples.map(p=>p/fadeScale),...transition.rendererZooms])].sort((a,b)=>a-b);
  for(const zoom of zooms){
   const pair=await page.evaluate(async zoom=>{const p=materialProbe;await p.zoomTo(zoom*(1-1e-6));const a=p.pixels();await p.zoomTo(zoom*(1+1e-6));const b=p.pixels(),change=p.compare(a,b);await p.zoomTo(zoom*(1-1e-6));const c=p.pixels();return {zoom,...change,returnDifferences:a.reduce((n,v,i)=>n+(v!==c[i]),0),shadowCalls:+p.element.dataset.shadowDrawCalls,lens:p.element.dataset.cameraLens,inkEnabled:p.element.dataset.inkEnabled,facadeBatches:+p.element.dataset.instanceBatches,camera:p.pose(),glError:p.gl.getError()};},zoom);
   report.pairs.push({district,...pair});
  }
  const pairs=report.pairs.filter(p=>p.district===district);
  check(`${district}: no interior material flips at any former or current zoom/fade threshold`,pairs.every(p=>p.interiorFlips===0));
  check(`${district}: threshold differences stay confined to raster edges`,pairs.every(p=>p.strong/p.pixels<.004));
  check(`${district}: reverse zoom restores the exact same pixels`,pairs.every(p=>p.returnDifferences===0));
  check(`${district}: scale changes do not regenerate or realign shadows`,pairs.every(p=>p.shadowCalls===0));
  check(`${district}: both lenses keep ink and the complete native facade representation`,new Set(pairs.map(p=>p.lens)).size===2&&pairs.every(p=>p.inkEnabled==='true'&&p.facadeBatches===report.assets.facadeGroups));
  const tour=await page.evaluate(async()=>{const p=materialProbe,frames=[];for(const direction of [1,-1])for(let i=0;i<=75;i++){const z=1.1*Math.exp((direction===1?i:75-i)/75*Math.log(200/1.1));await p.zoomTo(z);frames.push({zoom:p.pose().zoom,shadowCalls:+p.element.dataset.shadowDrawCalls,buildings:+p.element.dataset.residentBuildings});}return frames;});
  report.tours.push({district,frames:tour});check(`${district}: continuous zoom retains geometry without rebuilding static shadows`,tour.every(f=>f.shadowCalls<=6&&f.buildings===60978));
  await page.evaluate(()=>materialProbe.zoomTo(100));
  const path=out+'/'+district+'.png';await page.locator('.alem-city').screenshot({path});await writeFile(path+'.json',JSON.stringify({...await artifactContext(page),capture:'city-canvas',camera:await page.evaluate(()=>materialProbe.pose())},null,2)+'\n');
 }
 check('no WebGL or browser errors',report.errors.length===0&&report.pairs.every(p=>p.glError===0));
 report.completed=report.checks.every(c=>c.passed);
}catch(error){report.completed=false;report.failure=String(error);process.exitCode=1;console.error(error);await captureFrame(page,out+'/failure.png',report).catch(()=>{});}
finally{await labelVideo(page,await page.video().path(),report).catch(()=>{});await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await context.close();await browser.close();}
