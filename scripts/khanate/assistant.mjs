import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {confirmProject} from '../integration/ui.mjs';
const origin=process.env.APP_URL||'http://127.0.0.1:4198',out=process.env.CAPTURE_DIR||'artifacts/khanate/assistant';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(75000);
const report={checks:[],errors:[],api:[]},key='alem:khanate:akim:draft';
const check=(name,ok)=>{assert(ok,name);report.checks.push(name);console.log('PASS',name);};
await context.route('**/api/**',route=>{report.api.push(route.request().url());return route.abort();});page.on('pageerror',e=>report.errors.push(e.message));
const plan=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).plan,key);
const send=async text=>{if(!await page.locator('#aya-dialogue').count())await page.getByRole('button',{name:'Открыть Аю — помощницу города'}).click();await page.getByLabel('Сообщение Ае',{exact:true}).fill(text);await page.getByRole('button',{name:'Отправить сообщение Ае'}).click();};
const idle=()=>page.waitForFunction(()=>!document.querySelector('.aya-progress'));
try{
 await page.goto(`${origin}/?mode=khanate`);await page.locator('[data-ready=true]').waitFor();await page.locator('.need-card[data-choice=M7]').click();await confirmProject(page);
 const first=await plan();await send('Что дадут учебные юрты?');await idle();check('Historical explanation never spends',JSON.stringify(await plan())===JSON.stringify(first));
 await send('Доведи план');await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).plan.length===5,key);await idle();
 const completed=await plan();check('Browser worker completes the plan while preserving the original school',completed.some(d=>d.initiativeId===first[0].initiativeId&&d.districtId===first[0].districtId));
 await page.screenshot({path:`${out}/completed.png`});await page.getByRole('button',{name:'Отменить мой шаг',exact:true}).click();check('Undo restores the player’s original choice',JSON.stringify(await plan())===JSON.stringify(first));
 // A real legacy-save shape with three valid but stranded expensive choices.
 await page.evaluate(k=>{const value=JSON.parse(localStorage.getItem(k));value.plan=[{scope:'district',initiativeId:'M3',districtId:'nura'},{scope:'district',initiativeId:'M13',districtId:'esil'},{scope:'district',initiativeId:'M5',districtId:'almaty'}];value.construction=[];localStorage.setItem(k,JSON.stringify(value));},key);
 await page.reload();await page.locator('[data-ready=true]').waitFor();const stranded=await plan();await send('Доведи план');await page.locator('.aya-repair').waitFor();await idle();
 check('Legacy stranded plan receives a concrete replacement without automatic spending',JSON.stringify(await plan())===JSON.stringify(stranded));
 await page.getByRole('button',{name:'Применить эту замену',exact:true}).click();await idle();
 check('Explicit repair completes five decisions',(await plan()).length===5);
 const repaired=await plan();check('Repair changes only the necessary original decision',stranded.filter(d=>repaired.some(p=>p.initiativeId===d.initiativeId&&p.districtId===d.districtId)).length===2);
 await page.screenshot({path:`${out}/repaired.png`});await page.getByLabel('Сообщение Ае',{exact:true}).focus();await page.keyboard.press('Escape');check('Keyboard dismissal restores focus',await page.locator('.aya-entry').evaluate(e=>e===document.activeElement));
 check('Completion and repair make zero API requests',report.api.length===0);check('No uncaught errors',report.errors.length===0);report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;console.error(error);await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
