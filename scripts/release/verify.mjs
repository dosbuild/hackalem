/** Release resilience/performance pass using the existing Playwright test stack.
 * Run against npm start, never a development bundle. No real provider calls here.
 */
import {chromium} from 'playwright';
import {chooseProject,confirmProject,cameraControls,navigate} from '../integration/ui.mjs';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));process.chdir(root);
const origin=process.env.APP_URL||'http://127.0.0.1:4174';
const out=process.env.RELEASE_OUTPUT||'artifacts/release';await mkdir(out,{recursive:true});
const executablePath=process.env.BROWSER_PATH||(existsSync('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser')?'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser':undefined);
const report={origin,startedAt:new Date().toISOString(),environment:{platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,browser:executablePath||'Playwright Chromium',node:process.version},checks:[],errors:[],measurements:[],limits:{coldCityMs:Number(process.env.COLD_CITY_BUDGET_MS||8000),navigationActionRoundTripMs:1000},limitations:['Emulated touch viewport, not physical mobile hardware','No native Kazakh review','No new-participant comprehension test','Browser animation intervals are not GPU frame times']};
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS',name);};
const browser=await chromium.launch({...(executablePath?{executablePath}:{}),headless:true,args:['--disable-background-networking','--use-gl=angle',...(os.platform()==='darwin'?['--use-angle=metal']:[])]});
const contexts=[];
async function create(viewport,extra={}) {
 const context=await browser.newContext({viewport,serviceWorkers:'block',...extra});contexts.push(context);
 await context.route('**/api/explanation',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:'local',reason:'failed'})}));
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==origin)return route.abort();return route.fallback();});
 await context.addInitScript(()=>{let queued=false;const observer=new MutationObserver(()=>{const map=document.querySelector('[data-testid=city-map]');if(!queued&&map?.dataset.ready==='true'&&Number(map.dataset.drawCount)>0){queued=true;requestAnimationFrame(()=>{window.__releaseFirstCityMs=performance.now();observer.disconnect();});}});observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-ready','data-draw-count']});});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.setDefaultTimeout(20000);
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 return {context,page,cdp};
}
const ready=page=>page.waitForFunction(()=>document.querySelector('[data-testid="city-map"]')?.dataset.ready==='true'&&Number(document.querySelector('[data-testid="city-map"]')?.dataset.drawCount)>0,{}, {timeout:25000});
const inspect=async(page,id,district)=>{if(!await page.locator('#planning').count())await page.locator('[data-toggle=planning]').click();await chooseProject(page,id);if(district)await page.locator('.candidate select').selectOption(district);};
const commit=async(page,id,district)=>{await inspect(page,id,district);await confirmProject(page);};
try {
 const metadata=await (await fetch(origin+'/alem/geometry-low.json')).json(),overviewPath='/alem/'+metadata.tiles[0].transport.file;
 const health=await fetch(origin+'/healthz');check('production health',health.ok);
 report.version=await (await fetch(origin+'/version.json')).json();check('release identifies application and model',report.version.application==='alem'&&report.version.model==='astana-education-1');
 for(const target of ['/.env','/package.json','/src/main.tsx','/docs/scenario/source/goal-objective.md','/missing.js'])check(`private/missing route ${target}`, (await fetch(origin+target)).status===404);
 for(const viewport of [{width:1440,height:900},{width:1366,height:768},{width:390,height:844}]) {
  const {context,page}=await create(viewport,viewport.width===390?{hasTouch:true,isMobile:true}:{});
  await page.goto(origin);await ready(page);
  await page.waitForFunction(()=>Number(window.__releaseFirstCityMs)>0);
  const cold=await page.evaluate(()=>({elapsedMs:window.__releaseFirstCityMs,measurement:'Complete resident city and GPU-finished first frame followed by one browser animation frame',firstContentfulPaintMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),transferred:performance.getEntriesByType('resource').reduce((sum,r)=>sum+r.transferSize,performance.getEntriesByType('navigation')[0]?.transferSize||0),assets:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.transferSize,durationMs:r.duration,encodedBytes:r.encodedBodySize,decodedBytes:r.decodedBodySize})),map:{...document.querySelector('[data-testid="city-map"]').dataset}}));
  const measurement={viewport,cold};report.measurements.push(measurement);
  check(`useful city ${viewport.width}`,cold.elapsedMs<report.limits.coldCityMs);
  check(`no duplicate compatibility mesh download ${viewport.width}`,!cold.assets.some(a=>a.name.endsWith('/city.bin')));
  check(`no horizontal overflow ${viewport.width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check(`Russian playable arrival ${viewport.width}`,await page.locator('.city-application').getAttribute('data-context')==='city'&&await page.getByTestId('remaining-budget').innerText()==='100'&&await page.locator('[data-toggle=planning]').isVisible());
  await page.screenshot({path:`${out}/arrival-${viewport.width}.png`});
  const gpu=await page.evaluate(()=>{const canvas=document.querySelector('.alem-city'),gl=canvas?.getContext('webgl2'),debug=gl?.getExtension('WEBGL_debug_renderer_info');return debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unavailable';});
  await page.getByRole('button',{name:'Как играть',exact:true}).click();
  check(`entry can request guidance ${viewport.width}`,(await page.getByRole('dialog').innerText()).includes('Таймера нет'));
  await page.getByRole('button',{name:'Продолжить игру',exact:true}).click();await cameraControls(page);
  await page.getByRole('button',{name:'Повернуть карту вправо',exact:true}).scrollIntoViewIfNeeded();
  const start=performance.now();await page.getByRole('button',{name:'Повернуть карту вправо',exact:true}).click();const inputMs=performance.now()-start;
  check(`navigation responds ${viewport.width}`,inputMs<report.limits.navigationActionRoundTripMs);
  const frames=await page.evaluate(()=>new Promise(resolve=>{const values=[];let previous=performance.now();function frame(t){values.push(t-previous);previous=t;if(values.length<90)requestAnimationFrame(frame);else {const sorted=values.slice(1).sort((a,b)=>a-b);resolve({median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)]});}}requestAnimationFrame(frame);}));
  const renderer=await page.getByTestId('city-map').evaluate(e=>({drawCount:e.dataset.drawCount,cpuSubmitMs:e.dataset.drawSubmitMs,cpuSubmitAverageMs:e.dataset.drawSubmitAverageMs}));
  Object.assign(measurement,{navigationActionRoundTripMs:inputMs,browserAnimationIntervalsMs:frames,renderer,gpu});
  await context.close();
 }
 // Fresh context: state, service failure, renderer failure, corrupted/obsolete storage and recovery.
 const {page,context}=await create({width:1366,height:768},{reducedMotion:'reduce'});
 await page.goto(origin);await ready(page);
 await commit(page,'M4','esil');await page.waitForTimeout(150);
 const quiet=await page.getByTestId('city-map').evaluate(e=>({...e.dataset}));
 check('reduced motion skips construction and event illumination',quiet.choreography==='idle'&&quiet.eventQuiet==='false'&&+quiet.eventLight===0);
 await page.waitForTimeout(800);
 check('reduced motion keeps the committed camera stationary',await page.getByTestId('city-map').getAttribute('data-camera')===quiet.camera);
 await page.reload();await ready(page);
 check('draft resumes', (await page.getByTestId('decision-count').innerText()).startsWith('1')&&(await page.getByTestId('remaining-budget').innerText()).startsWith('85'));
 await page.route('**'+overviewPath,route=>route.abort());await page.reload();
 await page.getByRole('button',{name:'Повторить загрузку карты',exact:true}).waitFor();
 check('renderer failure preserves plan and usable districts',(await page.getByTestId('decision-count').innerText()).startsWith('1')&&await page.locator('.district-button').count()===5);
 await page.unroute('**'+overviewPath);await ready(page);
 check('renderer recovers automatically without losing draft',(await page.getByTestId('remaining-budget').innerText()).startsWith('85'));
 for(const [id,d] of [['M8','nura'],['M11','almaty'],['M12',null],['M14',null]])await commit(page,id,d);
 await navigate(page,'dashboard');await page.locator('.dash-score-orbit strong').waitFor();
 check('Provider independence keeps the exact numerical result',await page.locator('.dash-score-orbit strong').innerText()==='54,36');
 await page.route('**/api/assistant',route=>route.fulfill({status:503,body:'unavailable'}));await page.getByRole('button',{name:'Открыть Аю — помощницу города'}).click();await page.getByLabel('Сообщение Ае',{exact:true}).fill('Какие риски остались в моём плане?');await page.getByRole('button',{name:'Отправить сообщение Ае'}).click();await page.getByText('Ая · без AI-связи',{exact:true}).last().waitFor();
 check('Unavailable AI is labelled honestly',await page.getByText('Ая · без AI-связи',{exact:true}).count()>0);await page.getByRole('button',{name:'Свернуть разговор с Аей'}).click();await page.screenshot({path:`${out}/result-fallback.png`});
 await navigate(page,'map');check('Reduced motion settles the reveal',await page.getByTestId('city-map').getAttribute('data-transition')==='false');
 await page.evaluate(()=>{const canvas=document.querySelector('.city-canvas canvas');const gl=canvas?.getContext('webgl2');gl?.getExtension('WEBGL_lose_context')?.loseContext();});
 await page.getByRole('button',{name:'Повторить загрузку карты',exact:true}).waitFor();
 check('context loss preserves the evaluated plan',await page.getByTestId('decision-count').innerText()==='5 из 5'&&await page.getByTestId('remaining-budget').innerText()==='25');
 await ready(page);
 for(const [name,raw,text] of [['malformed','{bad','повреждён'],['obsolete',JSON.stringify({schemaVersion:0,scenarioVersion:'old'}),'другой версии']]) {
  await page.evaluate(raw=>localStorage.setItem('akim:draft',raw),raw);await page.reload();await ready(page);
  check(`${name} draft gets recovery notice`,(await page.locator('.city-notice').innerText()).includes(text)&&(await page.getByTestId('decision-count').innerText()).startsWith('0'));
 }
 await context.close();
 const unavailable=await create({width:1366,height:768});await unavailable.context.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Disabled','SecurityError');}});});
 await unavailable.page.goto(origin);await ready(unavailable.page);
 check('storage unavailable remains playable',(await unavailable.page.locator('.city-notice').innerText()).includes('недоступно'));
 await commit(unavailable.page,'M4','esil');
 check('disabled storage does not block commitment',(await unavailable.page.getByTestId('decision-count').innerText()).startsWith('1'));
 check('no unhandled browser exceptions',report.errors.length===0);
 report.completed=true;
} catch(error){report.completed=false;report.failure=String(error);console.error(error);process.exitCode=1;}
finally {await Promise.allSettled(contexts.map(c=>c.close()));await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');}
