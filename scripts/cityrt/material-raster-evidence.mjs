/** Exact native pixel pairs at the failing temporal raster samples. */
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {skipDemonstration,artifactContext} from '../integration/ui.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.APP_URL||'http://127.0.0.1:4208',out=process.env.CAPTURE_DIR||'artifacts/material-raster-evidence';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),context=await browser.newContext({viewport:{width:1000,height:800},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(60000);
const report={method:'Unmodified native WebGL RGBA readPixels, bottom row first, plus lossless canvas PNG; exact original ±1e-6 renderer-zoom targets and reverse pair. No shader/app/state/camera injection.',pairs:[],completed:false};
try{
 await page.goto(origin+'/?mode=astana');await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');await skipDemonstration(page);report.build=await artifactContext(page);
 await page.locator('.camera-home').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=city-map]').dataset.camera).zoom===1);
 await page.getByRole('button',{name:'Район Есиль на карте',exact:true}).click();await page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]').dataset;return JSON.parse(d.camera).zoom===3.1&&d.camera===d.renderCamera;});
 await page.evaluate(()=>{
  const e=document.querySelector('[data-testid=city-map]'),c=document.querySelector('.alem-city'),gl=c.getContext('webgl2'),frame=()=>new Promise(requestAnimationFrame),pose=()=>JSON.parse(e.dataset.camera);
  window.rasterProbe={async capture(z){const p=pose(),target=Math.max(1,Math.min(288,z*p.height*.415/Math.min(p.height*.36,p.width*.29)));
   for(let i=0;i<40;i++){const current=pose().zoom;if(Math.abs(current-target)<1e-10)break;c.dispatchEvent(new WheelEvent('wheel',{deltaY:Math.max(-130,Math.min(130,-Math.log(target/current)/.002)),bubbles:true,cancelable:true}));await frame();await frame();}
   await frame();if(e.dataset.camera!==e.dataset.renderCamera||Math.abs(pose().zoom-target)>1e-8)throw Error('Unsettled raster pair');
   const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let text='';for(let i=0;i<pixels.length;i+=32768)text+=String.fromCharCode(...pixels.subarray(i,i+32768));
   return {width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,rgba:btoa(text),png:c.toDataURL('image/png'),subpixelBits:gl.getParameter(gl.SUBPIXEL_BITS),samples:gl.getParameter(gl.SAMPLES),camera:pose(),map:{...e.dataset},glError:gl.getError()};}};
 });
 for(const zoom of [100,109.4401042200658,200]){const pair={zoom,frames:[]};for(const [name,factor]of [['a',1-1e-6],['b',1+1e-6],['c',1-1e-6]]){const raw=await page.evaluate(z=>rasterProbe.capture(z),zoom*factor),prefix=`${out}/zoom-${zoom}-${name}`;await writeFile(prefix+'.rgba',Buffer.from(raw.rgba,'base64'));await writeFile(prefix+'.png',Buffer.from(raw.png.split(',')[1],'base64'));delete raw.rgba;delete raw.png;await writeFile(prefix+'.json',JSON.stringify({...report.build,...raw},null,2)+'\n');pair.frames.push({name,prefix,...raw});}report.pairs.push(pair);console.log('CAPTURED',zoom);}
 report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;console.error(String(error).split('\n')[0]);}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
