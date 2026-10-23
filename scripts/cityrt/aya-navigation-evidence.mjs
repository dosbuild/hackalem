/** Aya owns an open stop control; a delayed reply respects an explicit collapse. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {skipDemonstration,artifactContext} from '../integration/ui.mjs';
const origin=process.env.APP_URL||'http://127.0.0.1:4206',out=process.env.CAPTURE_DIR||'artifacts/cityrt/aya-navigation';
await mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const report={origin,checks:[],profiles:[],errors:[],completed:false};let context,page,release;
const check=(name,pass)=>{assert(pass,name);report.checks.push(name);console.log('PASS',name);};
const draft=()=>page.evaluate(()=>JSON.parse(localStorage.getItem(document.documentElement.dataset.mode==='khanate'?'alem:khanate:akim:draft':'akim:draft')||'{"plan":[]}').plan);
const start=async mode=>{context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));await page.goto(origin+'/?mode='+mode);await skipDemonstration(page);await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');report.profiles.push(await artifactContext(page));await page.getByRole('button',{name:'Open Aya, the city assistant',exact:true}).click();};
const send=async text=>{await page.getByLabel('Message to Aya',{exact:true}).fill(text);await page.getByRole('button',{name:'Send message to Aya',exact:true}).click();};
try{
 for(const mode of ['astana','khanate']){
  await start(mode);await send(mode==='khanate'?'Open teaching yurts on the Riverbank':'Help with the school shortage in Nura');
  const stop=page.getByRole('button',{name:'Stop',exact:true});await stop.waitFor();check(mode+': automatic place navigation keeps Stop visible',await page.locator('#aya-dialogue').isVisible());await stop.click();await page.waitForTimeout(1800);
  check(mode+': stopping before commitment spends no budget',(await draft()).length===0&&await page.getByTestId('remaining-budget').innerText()==='100');await page.screenshot({path:out+'/'+mode+'-stopped.png'});await context.close();context=null;
 }
 await start('astana');let entered;const requested=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let interceptions=0;
 await context.route(url=>url.pathname==='/api/dashboard/complete',async route=>{interceptions++;const response=await route.fetch();entered();await gate;await route.fulfill({response});});
 await send('Complete the plan');await requested;await page.getByRole('button',{name:'Minimise the conversation with Aya',exact:true}).click();check('explicit collapse closes Aya during the real pending completion',await page.locator('#aya-dialogue').count()===0);release();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('akim:draft')||'{"plan":[]}').plan.length>0);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 check('late completion navigation respects the latest collapsed overlay',interceptions===1&&await page.locator('#aya-dialogue').count()===0);
 await page.locator('.alem-city').press('ArrowRight');const saved=JSON.stringify(await draft());await page.waitForTimeout(700);check('manual camera takeover interrupts the remaining sequence without changing accepted decisions',JSON.stringify(await draft())===saved);await page.screenshot({path:out+'/late-completion-stays-collapsed.png'});
 check('no unhandled errors',report.errors.length===0);report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;console.error(error);await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{release?.();await context?.close();await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
