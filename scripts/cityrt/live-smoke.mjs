/** First main-app review of a candidate; public URL, controls and read-only metrics. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {captureFrame,artifactContext} from '../integration/ui.mjs';
const origin=process.env.APP_URL||'http://127.0.0.1:5187',out=resolve(process.env.CAPTURE_DIR||'artifacts/cityrt/smoke');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),report={origin,worlds:[],errors:[],complete:false};
try{
 for(const world of process.env.WORLD_MODE?[process.env.WORLD_MODE]:['astana','khanate']){
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:process.env.PROBE_MOTION||'reduce',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(90000);
  const record={world,frames:[]};report.worlds.push(record);page.on('pageerror',e=>report.errors.push({world,message:e.message}));
  try{
   const start=performance.now();await page.goto(`${origin}/?mode=${world}`);await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');
   console.log('READY',world,Math.round(performance.now()-start));record.readyMs=performance.now()-start;record.build=await artifactContext(page);
   const shot=async name=>{await captureFrame(page,resolve(out,`${world}-${name}.png`));record.frames.push({name,map:await page.getByTestId('city-map').evaluate(el=>({...el.dataset})),glError:await page.locator('.alem-city').evaluate(el=>el.getContext('webgl2').getError())});};
   await shot('entry');
   await page.locator('.need-card[data-choice=M7]').click();await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.preview==='M7');
   await page.waitForFunction(()=>{const el=document.querySelector('[data-testid=city-map]');return el.dataset.camera===el.dataset.renderCamera;});await shot('school');
   await page.locator('.camera-home').click();await shot('overview');
   assert(record.frames.every(f=>f.glError===0),'WebGL error');assert.equal(record.frames[0].map.completeCity,'true');
  }finally{await context.close();}
 }
 assert.equal(report.errors.length,0);report.complete=true;
}catch(e){report.failure=String(e);process.exitCode=1;}
finally{await browser.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));}
