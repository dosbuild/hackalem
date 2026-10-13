/** Sequential public-camera preliminary performance probe; final static gate remains required. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {artifactContext} from '../integration/ui.mjs';
const world=process.env.WORLD_MODE||'astana',origin=process.env.APP_URL||'http://127.0.0.1:5187',out=resolve(process.env.CAPTURE_DIR||'artifacts/cityrt/perf-probe');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(60000);
const report={world,frames:[],errors:[],complete:false};page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.goto(`${origin}/?mode=${world}`);await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');report.build=await artifactContext(page);
 await page.evaluate(()=>{window.__probeFrames=[];let last=0,count=0;const frame=t=>{const d=document.querySelector('[data-testid=city-map]')?.dataset,n=+d?.drawCount;if(n!==count){if(last)window.__probeFrames.push({ms:t-last,submit:+d.drawSubmitMs,vertices:+d.visibleCityVertices,calls:+d.frameDrawCalls});last=t;count=n;}window.__probe=requestAnimationFrame(frame);};window.__probe=requestAnimationFrame(frame);});
 await page.locator('.camera-orbit').click();console.log('INSPECTION',world);
 await page.waitForFunction(()=>window.__probeFrames.length>=120);
 report.frames=await page.evaluate(()=>{cancelAnimationFrame(window.__probe);return window.__probeFrames.slice(5);});
 const quantile=(key,q)=>report.frames.map(f=>f[key]).sort((a,b)=>a-b)[Math.floor(report.frames.length*q)];
 report.metrics={samples:report.frames.length,medianMs:quantile('ms',.5),p95Ms:quantile('ms',.95),medianSubmitMs:quantile('submit',.5),p95SubmitMs:quantile('submit',.95),maxVertices:Math.max(...report.frames.map(f=>f.vertices))};
 report.map=await page.getByTestId('city-map').evaluate(el=>({...el.dataset}));report.gpu=await page.locator('.alem-city').evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {error:gl.getError(),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'};});
 report.complete=report.errors.length===0&&report.gpu.error===0;console.log(JSON.stringify(report.metrics));
}catch(e){report.failure=String(e);process.exitCode=1;console.error(e);}
finally{await context.close();await browser.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));}
