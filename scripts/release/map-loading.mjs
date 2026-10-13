import {skipDemonstration,confirmProject,chooseProject,chooseDistrict,captureFrame,artifactContext} from '../integration/ui.mjs';
/** Production-only network/GPU fault injection. No external map provider or credentials. */
import {chromium} from 'playwright';
import {executablePath,browserArgs} from './browser-options.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {facadeAsset} from './facade-assets.mjs';
const origin=(process.env.APP_URL||'http://127.0.0.1:4174').replace(/\/$/,''),out=process.env.RELEASE_OUTPUT||'artifacts/map-loading';
await mkdir(out,{recursive:true});
const [overview,version]=await Promise.all([fetch(origin+'/alem/geometry-low.json').then(response=>response.json()),fetch(origin+'/version.json').then(response=>response.json())]);
assert(['connected','static'].includes(version.delivery),'Loading evidence needs an identified production build');
const facade=facadeAsset(overview),requestPath=asset=>asset.url.replace(/[^/]+$/,asset.transport?.file||asset.url.split('/').at(-1))+(version.delivery==='static'?'.gz':'');
const report={environment:{origin,world:'astana',...version},checks:[],errors:[],profiles:[],measurements:{},limitations:['Chromium on local desktop hardware; bandwidth and latency are emulated, not a Railway deployment or a physical phone.']};
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS',name);};
const contexts=[];
async function setup(name){const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'});contexts.push(context);const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.message));report.profiles.push({name,world:'astana',build:version.delivery});return {context,page};}
const shot=(page,name)=>captureFrame(page,`${out}/${name}.png`,report);
const ready=page=>page.waitForFunction(()=>{const m=document.querySelector('[data-testid=city-map]');return m?.dataset.ready==='true'&&+m.dataset.drawCount>0;},null,{timeout:600000});
try {
  const slow=await setup('slow-complete-download'),cdp=await slow.context.newCDPSession(slow.page);
  report.slowRequests=[];slow.page.on('requestfailed',r=>report.slowRequests.push({url:r.url(),failure:r.failure()}));slow.page.on('response',r=>report.slowRequests.push({url:r.url(),status:r.status(),headers:r.headers()}));
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:180,downloadThroughput:128*1024,uploadThroughput:64*1024});
  const started=Date.now();await slow.page.goto(origin,{waitUntil:'domcontentloaded'});
  await slow.page.getByRole('group',{name:'Обзорная карта Астаны'}).waitFor();
  report.measurements.previewMs=Date.now()-started;
  check('clickable geographic preview is available during slow mesh download',report.measurements.previewMs<12000);
  await slow.page.getByRole('button',{name:'Выбрать район Нура',exact:true}).locator('text').click();
  check('visible inline district controls work during the initial City download',await slow.page.getByRole('button',{name:'Выбрать район Нура',exact:true}).getAttribute('aria-pressed')==='true');
  await slow.page.getByRole('button',{name:'Выбрать район Байконур',exact:true}).press('Enter');
  check('the inline geographic fallback is keyboard-selectable',await slow.page.getByRole('button',{name:'Выбрать район Байконур',exact:true}).getAttribute('aria-pressed')==='true');
  await shot(slow.page,'slow-preview');
  try{await ready(slow.page);}catch(error){report.slowState=await slow.page.locator('body').evaluate(e=>({text:e.innerText,map:document.querySelector('[data-testid=city-map]')?.dataset}));await shot(slow.page,'slow-failure');throw error;}report.measurements.slowFirstCityMs=Date.now()-started;
  check('progressing 1 Mbps download survives the old 15-second total deadline',report.measurements.slowFirstCityMs>15000&&report.measurements.slowFirstCityMs<600000);
  const requests=await slow.page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,bytes:r.encodedBodySize})));
  check('initial load never requests the monolithic city',!requests.some(r=>/\/(?:city|city-low)\.bin$/.test(r.path)));
  report.measurements.completeMeshBytes=requests.filter(r=>r.path.startsWith('/alem/map-')).reduce((n,r)=>n+r.bytes,0);
  check('the new required raw facade asset belongs to the completed slow reveal',report.slowRequests.some(r=>r.status===200&&new URL(r.url).pathname==='/'+requestPath(facade)));
  const prepared=await slow.page.getByTestId('city-map').evaluate(e=>({...e.dataset}));
  check('slow first reveal waits for every required batch',+prepared.residentTiles===overview.tiles.length&&+prepared.residentBuildings===60978);
  report.measurements.complete=prepared;
  await shot(slow.page,'slow-ready');await slow.context.close();

  const transient=await setup('transient-base-503');let attempts=0;
  await transient.context.route('**/'+requestPath(overview),route=>++attempts<=2?route.fulfill({status:503,body:'temporary'}):route.continue());
  await transient.page.goto(origin);await ready(transient.page);check('temporary 503s recover without a visitor action',attempts>=3);await transient.context.close();

  const delayed=await setup('delayed-last-geographic-batch');let releaseTile;const gate=new Promise(resolve=>releaseTile=resolve);
  await delayed.context.route('**/'+requestPath(overview.tiles.at(-1)),async route=>{await gate;await route.continue();});
  await delayed.page.goto(origin,{waitUntil:'domcontentloaded'});
  await delayed.page.waitForFunction(expected=>+document.querySelector('[data-testid=city-map]')?.dataset.loadedTiles===expected,overview.tiles.length-1);
  check('one delayed batch keeps incomplete 3D hidden',await delayed.page.getByTestId('city-map').getAttribute('data-ready')==='false'&&!await delayed.page.locator('.alem-city').isVisible());
  check('existing preview and loading message stay available',await delayed.page.getByRole('group',{name:'Обзорная карта Астаны'}).isVisible()&&await delayed.page.locator('.map-loading').isVisible());
  releaseTile();await ready(delayed.page);await delayed.context.close();

  const delayedFacade=await setup('delayed-required-facades');let releaseFacade,facadeEntered;
  const facadeGate=new Promise(resolve=>releaseFacade=resolve),facadeRequested=new Promise(resolve=>facadeEntered=resolve);
  await delayedFacade.context.route('**/'+requestPath(facade),async route=>{facadeEntered();await facadeGate;await route.continue();});
  await delayedFacade.page.goto(origin,{waitUntil:'domcontentloaded'});await facadeRequested;
  check('delayed required facades keep incomplete 3D hidden',await delayedFacade.page.getByTestId('city-map').getAttribute('data-ready')==='false'&&!await delayedFacade.page.locator('.alem-city').isVisible());
  check('facade preparation retains the interactive geographic preview',await delayedFacade.page.getByRole('group',{name:'Обзорная карта Астаны'}).isVisible()&&await delayedFacade.page.locator('.map-loading').isVisible());
  await shot(delayedFacade.page,'facades-delayed');releaseFacade();await ready(delayedFacade.page);await delayedFacade.context.close();

  const missingFacade=await setup('missing-required-facades');let denyFacade=true,facadeFailures=0;
  await missingFacade.context.route('**/'+requestPath(facade),route=>{if(denyFacade){facadeFailures++;return route.fulfill({status:404,body:'Required facade asset unavailable'});}return route.continue();});
  await missingFacade.page.goto(origin);await missingFacade.page.locator('.world-failure').waitFor();
  check('missing facades never expose a partial ready city',facadeFailures>0&&await missingFacade.page.getByRole('group',{name:'Обзорная карта Астаны'}).isVisible()&&await missingFacade.page.locator('[data-ready=true]').count()===0);
  await chooseProject(missingFacade.page,'M4');await chooseDistrict(missingFacade.page,'esil');await confirmProject(missingFacade.page);
  const fallbackDraft=await missingFacade.page.evaluate(()=>JSON.parse(localStorage.getItem('akim:draft')));
  check('required-asset failure keeps exact-price planning functional',await missingFacade.page.getByTestId('remaining-budget').innerText()==='85'&&fallbackDraft.plan.length===1&&fallbackDraft.plan[0].initiativeId==='M4'&&fallbackDraft.plan[0].districtId==='esil');
  await shot(missingFacade.page,'facades-missing-functional');denyFacade=false;await ready(missingFacade.page);
  const recoveredDraft=await missingFacade.page.evaluate(()=>JSON.parse(localStorage.getItem('akim:draft'))),facadeMetrics=await missingFacade.page.getByTestId('city-map').evaluate(e=>({...e.dataset}));
  check('facade retry reveals the complete city without resetting plan or clocks',+facadeMetrics.residentBuildings===60978&&+facadeMetrics.residentTiles===overview.tiles.length&&JSON.stringify(recoveredDraft.plan)===JSON.stringify(fallbackDraft.plan)&&JSON.stringify(recoveredDraft.construction)===JSON.stringify(fallbackDraft.construction));
  await missingFacade.context.close();

  const bootLoss=await setup('gpu-loss-during-preparation');let releaseBootTile,bootTileEntered,holdBootTile=true;
  const bootGate=new Promise(resolve=>releaseBootTile=resolve),bootRequested=new Promise(resolve=>bootTileEntered=resolve);
  await bootLoss.context.route('**/'+requestPath(overview.tiles.at(-1)),async route=>{if(holdBootTile){holdBootTile=false;bootTileEntered();await bootGate;}await route.continue().catch(()=>{});});
  await bootLoss.page.goto(origin,{waitUntil:'domcontentloaded'});await bootRequested;
  check('context-loss probe occurs before native readiness',await bootLoss.page.getByTestId('city-map').getAttribute('data-ready')==='false');
  await bootLoss.page.locator('.alem-city').evaluate(canvas=>{const extension=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');if(!extension)throw Error('Context-loss extension unavailable');extension.loseContext();});
  await bootLoss.page.locator('.world-failure').waitFor();
  check('WebGL loss during preparation aborts the partial city and preserves the fallback',await bootLoss.page.getByRole('group',{name:'Обзорная карта Астаны'}).isVisible()&&await bootLoss.page.getByTestId('remaining-budget').innerText()==='100'&&await bootLoss.page.locator('[data-ready=true]').count()===0);
  await shot(bootLoss.page,'gpu-loss-preparation');releaseBootTile();await ready(bootLoss.page);
  check('preparation context loss recovers a complete city automatically',+(await bootLoss.page.getByTestId('city-map').getAttribute('data-resident-buildings'))===60978&&await bootLoss.page.getByTestId('remaining-budget').innerText()==='100');
  await bootLoss.context.close();

  const detail=await setup('failed-batch-and-live-context-recovery');let blockDetails=true;
  await detail.context.route('**/'+requestPath(overview.tiles[0]),route=>blockDetails?route.abort():route.continue());
  await detail.page.goto(origin);await detail.page.locator('.world-failure').waitFor();
  check('failed required batch keeps geographic fallback, never a partial ready city',await detail.page.getByRole('group',{name:'Обзорная карта Астаны'}).isVisible()&&await detail.page.locator('[data-ready=true]').count()===0);
  blockDetails=false;await ready(detail.page);await skipDemonstration(detail.page);
  await chooseProject(detail.page,'M7');await chooseDistrict(detail.page,'nura');await confirmProject(detail.page);
  await detail.page.locator('.map-project[data-initiative=M7][data-proposal=false][data-child=false]').click();await detail.page.getByTestId('program-inspection').waitFor();
  check('recovered school picking opens read-only inspection without spending again',await detail.page.getByTestId('held-project').count()===0&&await detail.page.getByTestId('remaining-budget').innerText()==='76');await detail.page.waitForTimeout(500);
  const metrics=await detail.page.getByTestId('city-map').evaluate(e=>({...e.dataset}));report.measurements.close=metrics;
  check('recovery prepares complete resident geometry',+metrics.residentTiles===overview.tiles.length&&+metrics.residentBuildings===60978);
  await shot(detail.page,'school-close');
  const first=await detail.page.locator('.alem-city').evaluate(c=>c.toDataURL());await detail.page.waitForTimeout(1800);
  check('stationary reduced-motion textures remain pixel-stable',first===await detail.page.locator('.alem-city').evaluate(c=>c.toDataURL()));
  check('no WebGL errors after resident rendering',await detail.page.locator('.alem-city').evaluate(c=>c.getContext('webgl2').getError())===0);
  await detail.page.locator('.alem-city').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await detail.page.locator('.world-failure').waitFor();await ready(detail.page);
  check('lost GPU context recovers automatically and preserves the plan',await detail.page.getByTestId('remaining-budget').innerText()==='76');
  await detail.context.close();

  const noGPU=await setup('webgl-unavailable-functional-fallback');
  await noGPU.context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:get.call(this,kind,...args);};});
  await noGPU.page.goto(origin);await noGPU.page.locator('.world-failure').waitFor();
  check('no WebGL still provides a geographic map and all five districts',await noGPU.page.getByRole('group',{name:'Обзорная карта Астаны'}).isVisible()&&await noGPU.page.locator('.district-button').count()===5);
  await shot(noGPU.page,'no-webgl');
  await chooseProject(noGPU.page,'M7');await chooseDistrict(noGPU.page,'nura');await confirmProject(noGPU.page);
  check('no WebGL still accepts the exact canonical school price',await noGPU.page.getByTestId('remaining-budget').innerText()==='76'&&await noGPU.page.getByTestId('decision-count').innerText()==='1 из 5');
  await noGPU.page.getByTestId('program-inspection').getByRole('button',{name:'К жителям',exact:true}).click();await noGPU.page.getByTestId('resident-layer').waitFor();
  check('no WebGL retains the funded person and direct encounter',await noGPU.page.locator('.resident-encounter[data-resident-id=story-nura-M7]').isVisible()&&await noGPU.page.getByTestId('remaining-budget').innerText()==='76');
  await shot(noGPU.page,'no-webgl-funded-person');report.noGPU=await artifactContext(noGPU.page);
  check('no unhandled browser exceptions',report.errors.length===0);report.completed=true;
}catch(error){report.completed=false;report.failure=String(error);console.error(error);process.exitCode=1;}
finally{await Promise.allSettled(contexts.map(c=>c.close()));await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
