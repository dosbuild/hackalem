/** Public navigation must never strand an uncommitted one-swap comparison. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {skipDemonstration,chooseProject,chooseDistrict,confirmProject,openOutcome,captureFrame} from './ui.mjs';

const origin=process.env.APP_URL||'http://127.0.0.1:4174';
const out=process.env.RELEASE_OUTPUT||'artifacts/integration/alternative-navigation';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const report={checks:[],errors:[],profiles:[]};
let page,context;
const modes=process.env.WORLD_MODE?[process.env.WORLD_MODE]:['astana','khanate'];
assert(modes.every(mode=>['astana','khanate'].includes(mode)),'Unknown WORLD_MODE');
try{
 for(const mode of modes)for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const profile=`${mode}-${viewport.width}`,key=mode==='astana'?'akim:draft':'alem:khanate:akim:draft';
  const check=(name,value)=>{assert(value,`${profile}: ${name}`);report.checks.push(`${profile}: ${name}`);console.log('PASS',profile,name);};
  context=await browser.newContext({viewport,reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',error=>report.errors.push({profile,message:error.message}));
  await page.goto(`${origin}/?mode=${mode}`);await skipDemonstration(page);
  const plan=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{"plan":[]}').plan,key);
  for(const [id,district]of [['M7','nura'],['M4','saryarka'],['M10','saryarka'],['M12',null],['M1','saryarka']]){
   await chooseProject(page,id);if(district)await chooseDistrict(page,district);await confirmProject(page,{openResult:false});
  }
  const original=JSON.stringify(await plan());
  await openOutcome(page);
  const compare=async()=>{await page.getByRole('button',{name:'Compare one replacement',exact:true}).click();await page.getByTestId('future-comparison').waitFor();};
  await compare();
  await page.getByRole('group',{name:'Choose a future'}).getByRole('button',{name:'Alternative',exact:true}).click();
  check('previewing a replacement preserves the committed plan',JSON.stringify(await plan())===original);
  await openOutcome(page);
  check('result navigation exits preview and displays the saved outcome',await page.getByTestId('outcome-sheet').isVisible()&&await page.getByTestId('future-comparison').count()===0&&JSON.stringify(await plan())===original);
  await captureFrame(page,`${out}/${profile}-returned-result.png`,report);
  await compare();
  await page.getByRole('button',{name:'Edit alternative',exact:true}).click();
  await page.getByTestId('held-project').waitFor();
  await openOutcome(page);
  check('result navigation exits an edited alternative without spending',await page.getByTestId('outcome-sheet').isVisible()&&await page.getByTestId('held-project').count()===0&&JSON.stringify(await plan())===original);
  await compare();
  await page.getByRole('button',{name:'Keep my plan',exact:true}).click();
  await openOutcome(page);
  check('explicit cancellation keeps the result reachable',JSON.stringify(await plan())===original&&await page.getByTestId('outcome-sheet').isVisible());
  await compare();
  await page.getByRole('button',{name:'Accept alternative',exact:true}).click();
  await openOutcome(page);
  const accepted=await plan();
  check('explicit adoption replaces exactly one of five decisions',accepted.length===5&&JSON.parse(original).filter(decision=>!accepted.some(next=>JSON.stringify(next)===JSON.stringify(decision))).length===1);
  check('adoption displays the new outcome',await page.getByTestId('outcome-sheet').isVisible());
  await captureFrame(page,`${out}/${profile}-adopted-result.png`,report);
  report.profiles.push({profile,completed:true});await context.close();context=null;page=null;
 }
 assert.equal(report.errors.length,0,'No uncaught application errors');report.completed=true;
}catch(error){report.failure=String(error);report.completed=false;console.error(error);if(page)await captureFrame(page,`${out}/failure.png`,report).catch(()=>{});process.exitCode=1;}
finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
