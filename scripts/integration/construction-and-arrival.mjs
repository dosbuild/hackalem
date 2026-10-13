/** Scene/resource recovery and simultaneous construction through the production UI. */
import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {skipDemonstration,captureFrame,labelVideo} from './ui.mjs';
const out=process.env.RELEASE_OUTPUT||'artifacts/integration/construction-and-arrival',origin=process.env.APP_URL||'http://127.0.0.1:4174';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),report={checks:[],errors:[]};
const check=(name,ok)=>{assert(ok,name);report.checks.push(name);console.log('PASS',name);};
let context,page;
async function start(init){context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}});if(init)await context.addInitScript(init);page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.message));}
async function end(name){await labelVideo(page,`${out}/${name}.webm`,report);await page.close();await context.close();await rename(await page.video().path(),`${out}/${name}.webm`);}
const ready=()=>page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');
const draft=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('akim:draft')));
const activities=()=>page.getByTestId('city-map').evaluate(e=>JSON.parse(e.dataset.constructions||'[]'));
try{
 await start();let imageRequests=0;
 await context.route('**/aya/guide-*.webp',route=>{imageRequests++;return route.fulfill({status:503,body:'Unavailable'});});
 await page.goto(origin);await skipDemonstration(page);await ready();await page.getByRole('button',{name:'Жители',exact:true}).click();await page.getByTestId('resident-conversation').waitFor();
 check('Resident encounters have no dependency on remote or decorative images',await page.locator('.street-conversation>header>.resident-portrait').isVisible()&&await page.getByTestId('city-map').isVisible());
 await page.getByRole('button',{name:'Архив обращений',exact:true}).click();await page.getByLabel('Найти обращение').fill('школ');check('Appeals remain usable when companion artwork fails',await page.locator('.living-appeal-row').count()>0);await page.getByRole('button',{name:'Закрыть каталог обращений'}).click();
 await page.setViewportSize({width:390,height:844});const fallback=page.locator('.aya-entry .aya-guide');check('The compact phone helper keeps a visible name when its artwork fails',await fallback.isVisible()&&await fallback.innerText()==='Ая');await captureFrame(page,`${out}/01-mobile-artwork-fallback.png`,report);
 await page.getByRole('button',{name:'Открыть Аю — помощницу города'}).click();check('Aya has a working text-labelled entry even without the atlas',imageRequests>0&&await page.getByLabel('Сообщение Ае',{exact:true}).isVisible());await captureFrame(page,`${out}/01-artwork-unavailable.png`,report);await end('artwork-recovery');

 await start(()=>{if(!localStorage.getItem('batch-seeded')){localStorage.setItem('batch-seeded','1');localStorage.setItem('akim:draft',JSON.stringify({schemaVersion:1,scenarioVersion:'astana-education-1',preferences:{welcomeDismissed:true},plan:[{initiativeId:'M3',scope:'district',districtId:'nura'},{initiativeId:'M5',scope:'district',districtId:'almaty'},{initiativeId:'M13',scope:'district',districtId:'esil'}]}));}});
 await page.goto(origin);await ready();await page.getByRole('button',{name:'Открыть Аю — помощницу города'}).click();await page.getByLabel('Сообщение Ае',{exact:true}).fill('Доведи план');await page.getByRole('button',{name:'Отправить сообщение Ае'}).click();await page.getByRole('button',{name:'Применить эту замену',exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('akim:draft')).plan.length===5);
 const saved=await draft(),newReceipts=saved.construction.filter(r=>Date.now()-r.startedAt<3000);assert(newReceipts.length>=2,'repair has multiple new projects');
 check('every new package project has its own authoritative construction clock',new Set(newReceipts.map(r=>r.key)).size===newReceipts.length&&newReceipts.every(r=>Number.isFinite(r.startedAt)&&r.durationMs>0&&r.startedAt+r.durationMs>Date.now()));
 // An evaluated eight-quarter future depicts completed projects. It must not
 // restart or accelerate their independent, persisted wall-clock receipts.
 await page.waitForFunction(keys=>{const d=document.querySelector('[data-testid=city-map]')?.dataset,projects=JSON.parse(d?.interventions||'[]');return d?.phase==='future'&&keys.every(key=>projects.some(p=>p.key===key&&p.state==='outcome'))&&JSON.parse(d.constructions||'[]').length===0;},newReceipts.map(r=>r.key));
 check('the eight-quarter package future shows completed projects while retaining their live receipts',JSON.stringify((await draft()).construction)===JSON.stringify(saved.construction));await captureFrame(page,`${out}/03-package-future.png`,report);
 await page.getByRole('button',{name:'Свернуть разговор с Аей'}).click();const before=Date.now();await page.getByRole('button',{name:'Жители',exact:true}).click();await page.getByTestId('resident-conversation').waitFor();await page.getByRole('button',{name:'Город',exact:true}).click();await page.waitForTimeout(300);
 const after=Date.now();check('manual navigation preserves every project clock and elapsed construction time',JSON.stringify((await draft()).construction)===JSON.stringify(saved.construction)&&after>before&&newReceipts.every(r=>Math.min(r.durationMs,after-r.startedAt)>=Math.min(r.durationMs,before-r.startedAt)));
 await page.reload();await ready();check('refresh retains every receipt and the single package spend',JSON.stringify((await draft()).construction)===JSON.stringify(saved.construction)&&JSON.stringify((await draft()).plan)===JSON.stringify(saved.plan));
 await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=city-map]')?.dataset.constructions||'[]').length===0);check('all package projects settle without replay',(await draft()).plan.length===5);await captureFrame(page,`${out}/04-package-restored.png`,report);await end('package-restoration');
 check('no uncaught application errors',report.errors.length===0);report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;console.error(error);await captureFrame(page,`${out}/failure.png`,report).catch(()=>{});}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
