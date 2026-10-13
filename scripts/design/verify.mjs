/** Real rendered regressions from the interface design review. No seeded game state. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {chooseProject,openCatalogue,confirmProject,openOutcome,navigate,captureFrame} from '../integration/ui.mjs';
const origin=process.env.APP_URL||'http://127.0.0.1:4174';
const out=process.env.RELEASE_OUTPUT||'artifacts/design';
await mkdir(out,{recursive:true});
const report={checks:[],errors:[],limitations:['Chromium emulation; no physical handset or mobile software keyboard.']};
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const check=(name,ok)=>{assert(ok,name);report.checks.push(name);console.log('PASS',name);};
const overlap=(a,b)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
const exposed=locator=>locator.evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length).every(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&!!hit&&(hit===e||e.contains(hit));}));
let page;
try{
 for(const mode of ['astana','khanate'])for(const [width,height] of [[1440,900],[390,844],[360,640],[832,390]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const label=`${mode} ${width}×${height}`,shot=name=>captureFrame(page,`${out}/${mode}-${width}-${name}.png`,report);
  await page.goto(origin);
  // The explicit public epoch control is the source of truth, regardless of URL defaults.
  await page.getByRole('button',{name:mode==='astana'?'Астана':'Хандық',exact:true}).click();
  await page.locator(`html[data-mode=${mode}]`).waitFor();
  await page.locator('.city-application').waitFor();
  await page.locator('[data-testid=city-map][data-ready=true]').waitFor({timeout:90000});
  check(`${label}: no document overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight===innerHeight));
  check(`${label}: persistent commands are exposed`,await exposed(page.locator('.primary-navigation button,[data-toggle=treasury],[data-toggle=planning],.aya-entry')));
  await shot('city');
  const settings=page.getByRole('button',{name:'Настроить камеру',exact:true});await settings.click();
  check(`${label}: labelled camera palette stays reachable`,await exposed(page.locator('.camera-extras button')));
  await page.keyboard.press('Tab');await page.keyboard.press('Escape');
  check(`${label}: Escape returns camera focus`,await settings.getAttribute('aria-expanded')==='false'&&await settings.evaluate(e=>e===document.activeElement));
  await openCatalogue(page);await shot('catalogue');
  await chooseProject(page,'M7');
  check(`${label}: priced confirmation is visible`,await exposed(page.locator('.candidate .button-row button')));
  await shot('proposal');
  await page.getByRole('button',{name:'Закрыть планирование'}).click();
  await page.getByRole('navigation',{name:'Пространства Алем'}).getByRole('button',{name:mode==='astana'?'Жители':'Прошения',exact:true}).click();
  await page.getByTestId('resident-conversation').waitFor();
  if(height<500)await page.locator('.street-tabs').scrollIntoViewIfNeeded();
  check(`${label}: resident topics fit`,await exposed(page.locator('.street-tabs button')));
  if(width===360){
   const quote=await page.locator('.street-words').boundingBox(),action=await page.locator('.street-primary').boundingBox();
   check(`${label}: resident quote is readable above its action`,quote&&action&&!overlap(quote,action)&&quote.y>=0&&quote.y+quote.height<=height&&await exposed(page.locator('.street-primary')));
  }
  await shot('residents');
  await page.getByRole('button',{name:'Открыть Аю — помощницу города'}).click();
  check(`${label}: composer and dismissal remain exposed`,await exposed(page.locator('.aya-composer textarea,.aya-composer button,.aya-icon-button')));
  if(width===360){
   check(`${label}: greeting opens at its beginning`,await page.locator('.aya-chat-log').evaluate(log=>{const first=log.querySelector('.aya-message');return log.clientHeight>=100&&first.getBoundingClientRect().top>=log.getBoundingClientRect().top;}));
  }
  await shot('aya');
  await page.getByLabel('Сообщение Ае',{exact:true}).press('Escape');
  check(`${label}: Aya restores launcher focus`,await page.locator('.aya-entry').evaluate(e=>e===document.activeElement));
  await context.close();
 }
 for(const mode of ['astana','khanate']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(origin);
  await page.getByRole('button',{name:mode==='astana'?'Астана':'Хандық',exact:true}).click();
  await page.locator(`html[data-mode=${mode}]`).waitFor();
  for(const id of ['M4','M8','M11','M12','M14']){await chooseProject(page,id);await confirmProject(page,{openResult:false});}
  await openOutcome(page);
  for(const [width,height] of [[390,844],[360,640],[1440,900]]){
   await page.setViewportSize({width,height});
   check(`${mode} ${width}: result card content fits its sheet`,await page.locator('.outcome-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
   for(const action of await page.locator('.outcome-actions button').all()){await action.scrollIntoViewIfNeeded();check(`${mode} ${width}: result action ${await action.innerText()} is reachable`,await exposed(action));}
   await page.locator('.outcome-body').evaluate(e=>e.scrollTop=0);
   await captureFrame(page,`${out}/${mode}-${width}-outcome.png`,report);
  }
  await navigate(page,'dashboard');await page.locator('.dash-impact-summary').waitFor();
  await captureFrame(page,`${out}/${mode}-1440-results.png`,report);await context.close();
 }
 check('No uncaught browser errors',report.errors.length===0);report.completed=true;
}catch(error){report.completed=false;report.failure=String(error);process.exitCode=1;console.error(error);await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});}
finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');}
