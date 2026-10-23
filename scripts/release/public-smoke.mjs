/** Non-destructive smoke of the normal connected UI and the real same-origin APIs. */
import {chromium} from 'playwright';
import {executablePath,browserArgs} from './browser-options.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chooseProject,chooseDistrict,confirmProject,navigate} from '../integration/ui.mjs';
const origin=new URL(process.env.APP_URL||'http://127.0.0.1:4174').origin,out=process.env.RELEASE_OUTPUT||'artifacts/public';await mkdir(out,{recursive:true});
const report={origin,checkedAt:new Date().toISOString(),checks:[],errors:[],external:[],completed:false};
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS',name);};
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'});

const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.message));
// Passive observation preserves normal browser caching; request routing disables it.
page.on('request',r=>{const u=new URL(r.url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin)report.external.push(u.href);});
const ready=()=>page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true',null,{timeout:90000});
const plan=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('akim:draft')||'{"plan":[]}').plan);
try{
 check('production health is ready',(await fetch(origin+'/healthz')).status===200);
 report.version=await(await fetch(origin+'/version.json')).json();
 check('build identifies the application and scenario',report.version.application==='alem'&&typeof report.version.version==='string'&&report.version.model==='astana-education-1'&&report.version.delivery==='connected'&&JSON.stringify(report.version.worlds)==='["astana","khanate"]');
 // Revision identity is optional; deployment checks can require an explicit revision.
 if(process.env.EXPECTED_COMMIT)check('deployed build matches the expected commit',report.version.commit===process.env.EXPECTED_COMMIT);
 for(const path of ['/.env','/.data/dashboard.json','/asset-manifest.json','/src/main.tsx'])check('private path rejected: '+path,(await fetch(origin+path)).status===404);
 const start=Date.now();await page.goto(origin,{waitUntil:'domcontentloaded'});await ready();report.cityReadyMs=Date.now()-start;
 await page.waitForFunction(()=>document.querySelector('.connected-application')?.dataset.demo==='off',null,{timeout:60000});
 check('arrival preserves the empty visitor plan',(await plan()).length===0&&await page.getByTestId('remaining-budget').innerText()==='100');
 const map=await page.getByTestId('city-map').evaluate(e=>({...e.dataset}));check('complete city is resident',+map.residentBuildings===60978&&+map.loadedTiles===+map.residentTiles);
 await page.screenshot({path:out+'/city.png'});
 await navigate(page,'residents');await page.locator('.street-roster [data-story-id]').first().click();
 check('resident conversation opens',await page.getByTestId('resident-conversation').isVisible());await page.screenshot({path:out+'/residents.png'});
 await page.getByRole('button',{name:'Open Aya, the city assistant'}).click();await page.getByLabel('Message to Aya',{exact:true}).press('Escape');
 await page.locator('#aya-dialogue').waitFor({state:'detached'});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 check('closing Aya preserves resident conversation and keyboard focus',await page.getByTestId('resident-conversation').isVisible()&&await page.evaluate(()=>document.activeElement?.classList.contains('aya-entry')));
 await navigate(page,'map');
 const reviewResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/dashboard/review'&&r.request().method()==='POST');
 for(const [id,district] of [['M4','esil'],['M8','nura'],['M11','almaty'],['M12',null],['M14',null]]){
  await chooseProject(page,id);if(district)await chooseDistrict(page,district);await confirmProject(page);
 }
 check('five manual projects spend exactly 75 units',(await plan()).length===5&&await page.getByTestId('remaining-budget').innerText()==='25');
 await navigate(page,'dashboard');await page.locator('.dash-score-orbit').waitFor();await page.locator('.dash-loading').waitFor({state:'detached'});
 check('automatic result matches independent arithmetic',await page.locator('.dash-score-orbit strong').innerText()==='54.36');
 check('real dashboard review loads',(await reviewResponse).status()===200&&await page.locator('.dash-error').count()===0);
 await page.screenshot({path:out+'/dashboard.png'});
 await page.getByRole('navigation',{name:'Dashboard sections'}).getByRole('button',{name:'Council',exact:false}).click();
 if(process.env.VERIFY_COUNCIL_WRITE==='1'){
 const councilResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/dashboard/council'&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Start the meeting'}).click();
 const councilApi=await councilResponse,council=await councilApi.json();report.councilId=council.id;
 await page.getByRole('button',{name:'Full minutes'}).click();
 check('real council records seven participants and a chair',councilApi.status()===200&&await page.locator('.dash-members article').count()===8);
 const restoredCouncil=await(await fetch(origin+'/api/dashboard/council/'+council.id)).json();
 check('saved council protocol can be retrieved',JSON.stringify(restoredCouncil.events)===JSON.stringify(council.events));
 }else{
  check('council is available for the completed plan',await page.getByRole('button',{name:'Start the meeting'}).isEnabled());
  report.councilVerification='Read-only; set VERIFY_COUNCIL_WRITE=1 only against isolated or explicitly authorized storage.';
 }
 await page.getByRole('navigation',{name:'Dashboard sections'}).getByRole('button',{name:/Registry/}).click();
 check('durable public registry responds',(await fetch(origin+'/api/dashboard/registry')).status===200);
 await page.getByRole('button',{name:'Open Aya, the city assistant'}).click();
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/assistant'&&r.request().method()==='POST');
 await page.getByLabel('Message to Aya',{exact:true}).fill('Which limitations should I consider in my plan?');await page.getByRole('button',{name:'Send message to Aya'}).click();
 const api=await response,body=await api.json();report.assistant={status:api.status(),mode:body.mode,reason:body.reason};
 await page.waitForFunction(()=>!document.querySelector('.aya-progress'));
 check('real assistant API answers without changing decisions',api.status()===200&&(await plan()).length===5);
 const saved=JSON.stringify(await plan());
 for(let visit=1;visit<=3;visit++){
  await page.reload();await page.locator('.connected-application').waitFor();
  check(`return ${visit} restores the same plan without onboarding`,JSON.stringify(await plan())===saved&&await page.locator('[data-demo=off]').count()===1);
  // Readiness means a visible first city frame; a restored dashboard deliberately keeps the map hidden.
  await navigate(page,'map');await ready();check(`return ${visit} renders the complete map`,+(await page.getByTestId('city-map').getAttribute('data-resident-buildings'))===60978);
 }
 for(const [width,height] of [[1280,720],[390,844]]){await page.setViewportSize({width,height});await navigate(page,'dashboard');check(`${width}×${height} has no horizontal page overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/dashboard-${width}.png`});}
 check('no uncaught browser errors or external browser services',report.errors.length===0&&report.external.length===0);report.completed=true;
}catch(error){report.failure=String(error);console.error(error);process.exitCode=1;await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}finally{await browser.close();await writeFile(out+'/live-journey.json',JSON.stringify(report,null,2)+'\n');}
