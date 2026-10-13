/** All seventy authored people remain reachable in the shared native city. */
import assert from 'node:assert/strict';import {mkdir,writeFile,rename} from 'node:fs/promises';import {chromium} from 'playwright';import {executablePath,browserArgs} from '../release/browser-options.mjs';import {skipDemonstration,navigate,captureFrame,labelVideo} from './ui.mjs';
const out=process.env.RELEASE_OUTPUT||'artifacts/integration/residents',origin=process.env.APP_URL||'http://127.0.0.1:4174';await mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),report={checks:[],errors:[],observations:[]};const check=(name,ok)=>{assert(ok,name);report.checks.push(name);console.log('PASS',name);};
try{for(const [name,width,height] of [['desktop',1440,900],['narrow',390,844]]){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',recordVideo:{dir:out,size:{width,height}}}),page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.message));await page.goto(origin);await skipDemonstration(page);await page.locator('[data-testid=city-map][data-ready=true]').waitFor();await navigate(page,'residents');
 const seen=new Set();let pinned;
 for(const district of name==='desktop'?['Есиль','Алматы','Сарыарка','Байконур','Нура']:['Нура']){
  // Place encounters hide the overview district strip. Use the persistent
  // public overview action before choosing another part of the same city.
  await navigate(page,'map');await page.getByRole('button',{name:'Обзор города',exact:true}).click();
  await page.getByRole('button',{name:`Район ${district} на карте`,exact:true}).click();
  await navigate(page,'residents');
  const districtId=({'Есиль':'esil','Алматы':'almaty','Сарыарка':'saryarka','Байконур':'baikonur','Нура':'nura'})[district];await page.locator(`.street-roster [data-story-id="story-${districtId}-M1"]`).waitFor();
  const local=new Set();for(let turn=0;turn<4;turn++){
   const ids=await page.locator('.street-roster [data-story-id]').evaluateAll(es=>es.map(e=>e.dataset.storyId));
   for(const id of ids){if(local.has(id))continue;local.add(id);seen.add(id);await page.locator(`.street-roster [data-story-id="${id}"]`).click();await page.waitForFunction(id=>document.querySelector('[data-testid=city-map]')?.dataset.resident===id,id);pinned=id;check(`${district}: ${id} is the actual selected native actor`,await page.getByTestId('resident-conversation').isVisible());}
   await page.getByRole('button',{name:'Другие жители',exact:true}).click();
  }check(`${name}: ${district} exposes fourteen distinct authored stories`,local.size===14);
  await page.reload();await page.getByTestId('resident-conversation').waitFor();await page.waitForFunction(id=>document.querySelector('[data-testid=city-map]')?.dataset.resident===id,pinned);check(`${name}: ${district} reload retains the same interlocutor`,true);
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid=city-map]')?.dataset.zoom)>=18);check(`${name}: ${district} reload returns to the resident's actual place`,await page.getByTestId('city-map').getAttribute('data-anchor')===`scenario:${pinned.split('-').at(-1)}:${districtId}`);
 }
 check(`${name}: expected authored residents are reachable`,seen.size===(name==='desktop'?70:14));check(`${name}: meetings never spend`,await page.getByTestId('remaining-budget').innerText()==='100');await captureFrame(page,`${out}/${name}-encounter.png`,report);
 await page.getByRole('button',{name:'Архив обращений',exact:true}).click();check(`${name}: complete archive has 240 appeals`,(await page.locator('.living-search-count').innerText()).includes('240'));await page.getByLabel('Найти обращение').fill('вода');check(`${name}: search finds specific water appeals`,await page.locator('.living-appeal-row').count()>0);await page.locator('.living-appeal-row').first().click();const readTitle=await page.locator('.living-reader h2').innerText();await page.reload();await page.locator('.living-reader h2').waitFor();check(`${name}: reload preserves the exact appeal being read`,await page.locator('.living-reader h2').innerText()===readTitle);await page.locator('.living-sources summary').click();check(`${name}: formal reader preserves linked public provenance`,await page.locator('.living-sources a').count()>0);await captureFrame(page,`${out}/${name}-formal-appeal.png`,report);check(`${name}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));report.observations.push({name,seen:[...seen],pinned});
 await labelVideo(page,`${out}/${name}-encounters.webm`,report);await page.close();await context.close();await rename(await page.video().path(),`${out}/${name}-encounters.webm`);
 }check('no unhandled browser exceptions',!report.errors.length);report.completed=true;
}catch(error){report.completed=false;report.failure=String(error);console.error(error);process.exitCode=1;}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
