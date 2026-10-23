/** Public Aya completion/undo and dashboard adoption must retain a usable primary view. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {skipDemonstration,chooseProject,chooseDistrict,confirmProject,openOutcome,navigate,captureFrame} from './ui.mjs';

const origin=process.env.APP_URL||'http://127.0.0.1:4174',out=process.env.RELEASE_OUTPUT||'artifacts/integration/automation-presentation';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),report={date:new Date().toISOString(),checks:[],errors:[],profiles:[]};
const modes=process.env.WORLD_MODE?[process.env.WORLD_MODE]:['astana','khanate'];
assert(modes.every(mode=>['astana','khanate'].includes(mode)),'Unknown WORLD_MODE');
const availableProfiles=modes.flatMap(mode=>['choices','proposal','book'].map(startAt=>`${mode}-${startAt}`));
const profiles=process.env.AUTOMATION_PROFILES?process.env.AUTOMATION_PROFILES.split(',').map(value=>value.trim()):availableProfiles;
assert(profiles.length&&new Set(profiles).size===profiles.length&&profiles.every(profile=>availableProfiles.includes(profile)),'Unknown or duplicated AUTOMATION_PROFILES');
report.requestedProfiles=profiles;
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS',name);};
let page,context;
try{
 for(const [mode,startAt] of profiles.map(profile=>profile.split('-'))){
  const profile=`${mode}-${startAt}`,key=mode==='astana'?'akim:draft':'alem:khanate:akim:draft';
  context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',error=>report.errors.push({profile,message:error.message}));
  await page.goto(`${origin}/?mode=${mode}`);await skipDemonstration(page);await page.locator('[data-toggle=planning]').waitFor();
  const plan=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{"plan":[]}').plan,key);
  const waitCount=count=>page.waitForFunction(({key,count})=>JSON.parse(localStorage.getItem(key)||'{"plan":[]}').plan.length===count,{key,count},{timeout:100000});
  const closeAya=async()=>{if(await page.locator('#aya-dialogue').count())await page.getByRole('button',{name:'Minimise the conversation with Aya',exact:true}).click();};
  const openAya=async()=>{if(!await page.locator('#aya-dialogue').count())await page.getByRole('button',{name:'Open Aya, the city assistant',exact:true}).click();};
  if(startAt==='proposal'){
   // This accepted school is viable but absent from the global optimum, so
   // the later dashboard comparison has a real plan change to adopt.
   await chooseProject(page,'M7');await chooseDistrict(page,'esil');await confirmProject(page);await waitCount(1);
   await chooseProject(page,'M4');await chooseDistrict(page,'saryarka');await page.getByTestId('held-project').waitFor();
  }
  if(startAt==='book'){await navigate(page,'dashboard');await page.locator('.dash-hero').waitFor();}
  const acceptedBefore=JSON.stringify(await plan());
  await openAya();await page.getByLabel('Message to Aya',{exact:true}).fill('Доведи план');await page.getByLabel('Message to Aya',{exact:true}).press('Enter');
  await waitCount(5);check(`${profile}: Aya is the sole contextual surface during completion`,await page.locator('#aya-dialogue').count()===1&&await page.getByTestId('outcome-sheet').count()===0&&await page.getByTestId('held-project').count()===0);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const focus=await page.evaluate(()=>{const node=document.activeElement;return {insideAya:!!node?.closest('#aya-dialogue'),tag:node?.tagName,id:node?.id,className:node?.className};});
  report.focus??=[];report.focus.push({profile,...focus});
  check(`${profile}: the completed result keeps keyboard focus in the active Aya conversation`,focus.insideAya);
  const stop=page.getByRole('button',{name:'Stop',exact:true});if(await stop.count())await stop.click();
  await closeAya();await page.getByTestId('result-invitation').waitFor();
  const completed=await plan();
  check(`${profile}: Aya completion leaves the finished city without a sixth choice or empty proposal`,completed.length===5&&new Set(completed.map(d=>d.initiativeId)).size===5&&await page.locator('.city-application').getAttribute('data-context')==='city'&&await page.getByTestId('decision-deck').count()===0&&await page.getByTestId('held-project').count()===0);
  check(`${profile}: completion preserves accepted decisions`,JSON.parse(acceptedBefore).every(d=>completed.some(next=>JSON.stringify(d)===JSON.stringify(next))));
  await captureFrame(page,`${out}/${profile}-finished-city.png`,report);await openOutcome(page);await captureFrame(page,`${out}/${profile}-result.png`,report);
  await page.getByRole('button',{name:'How to play',exact:true}).click();await page.getByRole('dialog').waitFor();await captureFrame(page,`${out}/${profile}-help.png`,report);await page.getByRole('dialog').press('Escape');
  if(startAt!=='proposal'){
   await openAya();await page.getByRole('button',{name:'Undo my step',exact:true}).click();await waitCount(0);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const undoFocus=await page.evaluate(()=>{const node=document.activeElement;return {insideAya:!!node?.closest('#aya-dialogue'),tag:node?.tagName,id:node?.id,className:node?.className};});report.focus.push({profile,stage:'undo',...undoFocus});
   check(`${profile}: undo keeps focus in Aya's textarea after its action button disappears`,undoFocus.insideAya&&undoFocus.id==='aya-message');
   await closeAya();await page.getByTestId('decision-deck').waitFor();
   check(`${profile}: undo from a result returns playable choices and all100 units`,await page.getByTestId('remaining-budget').innerText()==='100'&&await page.getByTestId('outcome-sheet').count()===0&&await page.getByTestId('held-project').count()===0&&await page.locator('.city-application').getAttribute('data-context')==='choices');
   await page.locator('.need-card[data-choice=M7]').click();check(`${profile}: another manual proposal works after undo`,await page.getByTestId('held-project').isVisible());
  }else{
   // Retain a real proposal as the dashboard's return context, then adopt a
   // different complete plan so that proposal must be reconciled on return.
   await chooseProject(page,completed[0].initiativeId);await page.getByTestId('held-project').waitFor();
   await navigate(page,'dashboard');await page.getByRole('navigation',{name:'Dashboard sections'}).getByRole('button',{name:'Plan review'}).click();
   await page.getByRole('button',{name:'Compare with the optimum',exact:true}).click();await page.locator('.dash-comparison').waitFor();
   await page.getByRole('button',{name:'Accept changes',exact:true}).click();
   await page.waitForFunction(({key,original})=>JSON.stringify(JSON.parse(localStorage.getItem(key)).plan)!==original,{key,original:JSON.stringify(completed)});
   await page.getByRole('button',{name:'Return to the city',exact:true}).click();await page.getByTestId('result-invitation').waitFor();
   check(`${profile}: dashboard adoption returns to the updated city without a stale proposal`,(await plan()).length===5&&await page.getByTestId('held-project').count()===0&&await page.locator('.city-application').getAttribute('data-context')==='city');
   await openOutcome(page);await captureFrame(page,`${out}/${profile}-adopted-result.png`,report);
  }
  report.profiles.push({profile,completed:true});await context.close();context=null;page=null;
 }
 check('Automation and dashboard presentation have no uncaught exceptions',report.errors.length===0);report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;console.error(error);if(page)await captureFrame(page,`${out}/failure.png`,report).catch(()=>{});}
finally{await context?.close();await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
