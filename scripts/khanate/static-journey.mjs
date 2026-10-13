import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {chooseProject,confirmProject,openOutcome,nextDecision,navigate,captureFrame,artifactContext} from '../integration/ui.mjs';
const mode=process.env.WORLD_MODE||'khanate',historical=mode==='khanate';
const origin=process.env.APP_URL||'http://127.0.0.1:4198',out=process.env.CAPTURE_DIR||`artifacts/khanate/static${historical?'':'-astana'}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
// The functional CI journey shares the connected smoke test's reduced-motion
// setting. SwiftShader must not redraw the full modern city continuously while
// Playwright checks forms and council work; native motion is covered locally.
const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block',reducedMotion:process.env.CI?'reduce':'no-preference'}),page=await context.newPage();page.setDefaultTimeout(process.env.CI?180000:45000);
const report={origin,checks:[],errors:[],api:[],failed:[],date:new Date().toISOString()};
const responses=[];
context.on('response',response=>responses.push((async()=>{await response.finished();const sizes=await response.request().sizes();return {path:new URL(response.url()).pathname,bytes:sizes.responseBodySize,status:response.status()};})().catch(()=>null)));
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS',name);};
const shot=name=>process.env.CI&&!process.env.CAPTURE_SCREENSHOTS?Promise.resolve():captureFrame(page,`${out}/${name}.png`,report);
const plan=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{"plan":[]}').plan,historical?'alem:khanate:akim:draft':'akim:draft');
const section=name=>page.getByRole('navigation',{name:'Разделы дашборда'}).getByRole('button',{name});
page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.failed.push({url:r.url(),error:r.failure()?.errorText}));
await page.route('**/api/**',route=>{report.api.push(route.request().url());return route.abort();});
try{
 const started=Date.now();await page.goto(`${origin}/${historical?'khanate-preview/':''}?mode=${mode}`);await page.locator('[data-toggle=planning]').waitFor();report.firstChoiceMs=Date.now()-started;
 await page.locator('[data-ready=true]').waitFor();report.cityReadyMs=Date.now()-started;report.environment=await artifactContext(page);await shot('01-arrival');
 const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,bytes:r.encodedBodySize})));
 report.coldResources=resources;report.network= (await Promise.all(responses)).filter(Boolean);report.coldBytes=report.network.reduce((n,r)=>n+r.bytes,0);
 check('Compressed geometry was fetched on plain static hosting',report.network.some(r=>/\/map-.*\.bin\.gz/.test(r.path)));
 if(historical){check('Historical direct entry excludes modern map geometry',!report.network.some(r=>/\/alem\/(map|geometry)/.test(r.path)));check('Historical first play stays below 4 MB on plain static hosting',report.coldBytes<4_000_000);}
 check('Opening exposes City, a labeled project action, and the untouched budget',await page.locator('.city-application').getAttribute('data-context')==='city'&&await page.locator('[data-toggle=planning]').isVisible()&&await page.getByTestId('remaining-budget').innerText()==='100');
 await chooseProject(page,'M7');await page.locator('.candidate select').selectOption(historical?'esil':'nura');await shot('02-proposal');await confirmProject(page);
 await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.choreography==='idle');await shot('03-school');
 check('The school costs 24 and commits once',(await plan()).length===1&&await page.getByTestId('remaining-budget').innerText()==='76');
 await nextDecision(page);
 for(const [id,district] of [['M4','saryarka'],['M10','saryarka'],['M12',null],['M1','saryarka']]){
  await chooseProject(page,id);if(district)await page.locator('.candidate select').selectOption(district);await confirmProject(page,{openResult:false});
  if(id!=='M1')await nextDecision(page);
 }
 check('Five distinct decisions retain canonical cost',(await plan()).length===5&&await page.getByTestId('remaining-budget').innerText()==='17');
 await page.getByTestId('result-invitation').waitFor();check('Fifth confirmation keeps City unobstructed until the result is opened',await page.locator('.city-application').getAttribute('data-context')==='city'&&await page.getByTestId('outcome-sheet').count()===0);await shot('04-finished-city');await openOutcome(page);await navigate(page,'dashboard');await page.locator('.dash-score-orbit').waitFor();await shot('04-chronicle');
 await section('Разбор плана').click();await page.locator('.dash-histogram').waitFor();await shot('05-exact-review');
 const original=JSON.stringify(await plan());await page.getByRole('button',{name:'Сравнить с оптимумом',exact:true}).click();await page.locator('.dash-comparison').waitFor();check('Alternative inspection leaves the committed plan intact',JSON.stringify(await plan())===original);await page.getByRole('button',{name:'Оставить мой план',exact:true}).click();
 await section('Совет').click();await page.getByRole('button',{name:'Начать заседание'}).click();await page.getByRole('button',{name:'Весь протокол'}).click();
 check('Local council has seven participants and chair',await page.locator('.dash-members article').count()===8);await shot('06-council');
 await page.locator('.dash-amendments input').first().check();await page.getByRole('button',{name:'Сравнить и принять'}).click();await page.getByRole('button',{name:'Принять изменения'}).click();
 check('Worker-checked amendment changes the authoritative plan',JSON.stringify(await plan())!==original);
 await section(historical?'Книга города':'Реестр').click();await page.getByLabel('Название команды').fill('Первая летопись');await page.getByRole('button',{name:'Сохранить в книге'}).click();await page.getByRole('status').filter({hasText:'Первая летопись'}).waitFor();await shot('07-local-book');
 const saved=JSON.stringify(await plan());await page.reload();await page.getByTestId('remaining-budget').waitFor();check('Reload keeps historical decisions',JSON.stringify(await plan())===saved);
 await page.getByRole('button',{name:historical?'Астана':'Хандық',exact:true}).click();await page.getByTestId('remaining-budget').waitFor();check('The other world has an independent treasury',await page.getByTestId('remaining-budget').innerText()==='100');
 await page.getByRole('button',{name:historical?'Хандық':'Астана',exact:true}).click();await page.getByTestId('remaining-budget').waitFor();check('Return restores the saved plan',JSON.stringify(await plan())===saved);
 check('Full static journey made zero API requests',report.api.length===0);check('No uncaught application errors',report.errors.length===0);
 report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;console.error(error);await shot('failure').catch(()=>{});}
finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
