/** Native public-UI fragment review; no private state or camera injection. */
import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {cameraControls,captureFrame,artifactContext} from '../integration/ui.mjs';
const origin=process.env.APP_URL??'http://127.0.0.1:4174',out=resolve(process.env.CAPTURE_DIR??'artifacts/cityrt/fragments');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),report={origin,profiles:[],errors:[],complete:false};
let context,page,record;
async function state(){return page.getByTestId('city-map').evaluate(el=>({...el.dataset}));}
async function settled(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForFunction(()=>{const el=document.querySelector('[data-testid=city-map]');if(!el||el.dataset.eventCameraOwned==='true')return false;const c=JSON.parse(el.dataset.camera),t=JSON.parse(el.dataset.target);return ['x','y','yaw','pitch','zoom'].every(k=>Math.abs(c[k]-t[k])<1e-8);});}
async function shot(name){await captureFrame(page,resolve(record.dir,`${name}.png`));record.frames.push({name,world:record.mode,map:await state()});}
async function action(label,fn){const before=await state();await fn();record.actions.push({label,before,after:await state()});}
async function end(){if(!context)return;const video=page.video();await context.storageState({path:resolve(record.dir,'storage-state.json')});await page.close();await context.close();if(video){const path=resolve(record.dir,'review.webm');await rename(await video.path(),path);record.video=path;}await writeFile(resolve(record.dir,'review.json'),JSON.stringify(record,null,2));context=null;}
try{
 for(const mode of ['astana','khanate']){
  const dir=resolve(out,mode);await mkdir(dir,{recursive:true});record={mode,dir,frames:[],actions:[]};report.profiles.push(record);
  context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference',recordVideo:{dir,size:{width:1440,height:900}},serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push({mode,message:e.message}));
  await page.goto(`${origin}/?mode=${mode}`);await page.locator('.need-card[data-choice=M7]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');await settled();record.build=await artifactContext(page);await shot('01-entry');
  await action('school choice',()=>page.locator('.need-card[data-choice=M7]').click());await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.preview==='M7');await settled();await shot('02-proposal');
  await action('direct person',()=>page.locator('.proposal-context-actions button').first().click());await page.getByTestId('resident-layer').waitFor();await shot('03-person');await action('Escape to proposal',()=>page.keyboard.press('Escape'));await page.getByTestId('held-project').waitFor();
  const held=await state();await action('explicit confirmation',()=>page.locator('.proposal-confirmation .primary').click());await page.waitForFunction(()=>JSON.parse(localStorage.getItem(document.documentElement.dataset.mode==='khanate'?'alem:khanate:akim:draft':'akim:draft')).plan.length===1);await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.constructions?.includes('M7'));
  assert.equal((await state()).cameraRequest,held.cameraRequest,'Confirmation does not issue a new camera request');
  await page.waitForFunction(()=>{const el=document.querySelector('[data-testid=city-map]');return JSON.parse(el?.dataset.constructions||'[]').some(o=>o.id==='M7'&&o.progress>.3&&o.progress<.85);});await shot('04-construction');
  await page.waitForFunction(()=>{const el=document.querySelector('[data-testid=city-map]');return el?.dataset.choreography==='idle'&&JSON.parse(el.dataset.constructions||'[]').length===0;});await settled();await shot('05-inhabited-front');await cameraControls(page);
  for(const [name,count] of [['06-side',6],['07-back',8],['08-other-side',7]]){for(let i=0;i<count;i++)await action('rotate right',()=>page.getByRole('button',{name:'Повернуть карту вправо',exact:true}).click());await settled();await shot(name);}
  await action('reopen accepted place',()=>page.locator('.consequence-actions').getByRole('button',{name:'Изменить решение',exact:true}).click());await page.getByTestId('held-project').waitFor();await settled();await shot('09-return');
  await end();
 }
 assert.equal(report.errors.length,0);report.complete=true;
}catch(e){report.failure=String(e);process.exitCode=1;if(page)await shot('failure').catch(()=>{});}
finally{await end();await browser.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));}
