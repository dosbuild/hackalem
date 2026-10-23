/** Broken optional chunks must preserve the shell, the plan and an honest recovery action. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {chooseProject,confirmProject,captureFrame} from './ui.mjs';
const origin=process.env.APP_URL||'http://127.0.0.1:4174',out=process.env.RELEASE_OUTPUT||'artifacts/integration/section-recovery';
await mkdir(out,{recursive:true});
const report={checks:[],errors:[],date:new Date().toISOString(),origin};
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS',name);};
try{
 for(const [chunk,label,title,extension] of [['ResidentsSpace','Residents','Resident stories are currently unavailable','js'],['Dashboard','Outcome','Detailed results are currently unavailable','css']]){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
  let blocked=true,requests=0;
  await context.route(`**/assets/${chunk}-*.${extension}`,route=>{if(blocked){requests++;return route.abort('connectionfailed');}return route.continue();});
  await page.goto(origin);await chooseProject(page,'M4');await confirmProject(page);
  await page.getByRole('navigation',{name:'Alem spaces'}).getByRole('button',{name:label,exact:true}).click();
  await page.getByRole('heading',{name:title,exact:true}).waitFor();
  check(`${chunk}: failed module keeps the funded plan and shell`,requests>0&&await page.getByTestId('remaining-budget').innerText()==='85'&&await page.getByTestId('decision-count').innerText()==='1 of 5');
  check(`${chunk}: recovery has no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:360,height:640},{width:832,height:390}]){
   await page.setViewportSize(viewport);
   for(const button of await page.locator('.section-recovery button').all()){
    await button.scrollIntoViewIfNeeded();
    check(`${chunk} ${viewport.width}×${viewport.height}: recovery action receives pointer input`,await button.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&(hit===el||el.contains(hit));}));
   }
   await captureFrame(page,`${out}/${chunk}-failure-${viewport.width}.png`,report);
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('.section-recovery').getByRole('button',{name:'Return to the city',exact:true}).click();
  await chooseProject(page,'M10');await confirmProject(page);
  check(`${chunk}: manual play continues after the failure`,await page.getByTestId('remaining-budget').innerText()==='73'&&await page.getByTestId('decision-count').innerText()==='2 of 5');
  await page.getByRole('navigation',{name:'Alem spaces'}).getByRole('button',{name:label,exact:true}).click();
  await page.getByRole('heading',{name:title,exact:true}).waitFor();blocked=false;
  await page.locator('.section-recovery').getByRole('button',{name:'Reload page',exact:true}).click();
  await page.locator(chunk==='ResidentsSpace'?'.street-conversation':'.dash-shell').waitFor();
  check(`${chunk}: reload restores the section and exact budget`,await page.getByTestId('remaining-budget').innerText()==='73'&&await page.getByTestId('decision-count').innerText()==='2 of 5');
  await context.close();
 }
 for(const initiallyDenied of [true,false]){
  const context=await browser.newContext({viewport:{width:360,height:640},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',e=>report.errors.push(e.message));
  if(initiallyDenied)await context.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Storage denied','QuotaExceededError');};});
  await context.route('**/assets/ResidentsSpace-*.js',route=>route.abort('connectionfailed'));
  await page.goto(origin);await chooseProject(page,'M4');await confirmProject(page);
  await page.getByRole('navigation',{name:'Alem spaces'}).getByRole('button',{name:'Residents',exact:true}).click();
  await page.getByRole('heading',{name:'Resident stories are currently unavailable',exact:true}).waitFor();
  if(initiallyDenied){
   check('Known storage failure never offers a destructive reload',await page.locator('.section-recovery').getByRole('button',{name:'Reload page',exact:true}).count()===0);
  }else{
   await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Storage denied','QuotaExceededError');};});
   let navigations=0;page.on('framenavigated',()=>navigations++);
   await page.locator('.section-recovery').getByRole('button',{name:'Reload page',exact:true}).click();
   await page.locator('.section-recovery').getByText('Your browser is not saving decisions.',{exact:false}).waitFor();
   check('New storage failure cancels reload and preserves the in-memory plan',navigations===0&&await page.getByTestId('remaining-budget').innerText()==='85'&&await page.getByTestId('decision-count').innerText()==='1 of 5');
  }
  await page.locator('.section-recovery').getByRole('button',{name:'Return to the city',exact:true}).click();
  await chooseProject(page,'M10');await confirmProject(page);
  check(`Storage denied (${initiallyDenied?'initial':'late'}): play remains usable`,await page.getByTestId('remaining-budget').innerText()==='73');
  await context.close();
 }
 check('Handled chunk failures do not produce uncaught application errors',report.errors.length===0);report.completed=true;
}catch(error){report.failure=String(error);console.error(error);process.exitCode=1;}
finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');}
