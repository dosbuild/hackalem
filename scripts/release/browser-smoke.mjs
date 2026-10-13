/** Portable production browser gate; performance measurements run separately. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from './browser-options.mjs';
import {chooseProject,chooseDistrict,confirmProject,navigate,captureFrame,artifactContext} from '../integration/ui.mjs';
import {facadeAsset} from './facade-assets.mjs';

const directory=await mkdtemp(path.join(tmpdir(),'alem-browser-'));
const out=process.env.RELEASE_OUTPUT||'artifacts/browser-smoke';await mkdir(out,{recursive:true});
// Software WebGL on hosted Linux runners can stall compositor readback even after
// a complete GPU frame. Keep screenshots as local diagnostics; CI gates behavior.
const captureScreenshots=!process.env.CI||process.env.CAPTURE_SCREENSHOTS==='1';
const report={checks:[],errors:[],profiles:[],completed:false,captureScreenshots};
const check=(name,ok)=>{assert(ok,name);report.checks.push(name);console.log('PASS',name);};
const child=spawn(process.execPath,['.server/server.mjs'],{
  env:{...process.env,HOST:'127.0.0.1',PORT:'0',ALEM_DATA_DIR:directory,OPENAI_API_KEY:'',RAILWAY_ENVIRONMENT_ID:''},
  stdio:['ignore','pipe','pipe'],
});
let output='',browser;
child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
const exited=new Promise(resolve=>child.once('exit',resolve));
try {
  const origin=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Server readiness timeout: '+output)),15000);
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.stdout.on('data',()=>{const match=output.match(/listening on 127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}});
    exited.then(()=>{clearTimeout(timer);reject(Error('Server exited: '+output));});
  });
  // WebGL-only fallback keeps Chromium's compositor usable on GPU-less runners.
  // https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md
  browser=await chromium.launch({executablePath,headless:true,args:[...browserArgs,...(process.platform==='linux'?['--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']:[])]});
  const overview=JSON.parse(await readFile('dist/alem/geometry-low.json','utf8')),{tiles}=overview,facade=facadeAsset(overview);
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const context=await browser.newContext({viewport,reducedMotion:'reduce',serviceWorkers:'block',...(viewport.width<500?{isMobile:true,hasTouch:true}:{})});
    const page=await context.newPage();page.setDefaultTimeout(30000);
    page.on('pageerror',error=>report.errors.push(error.message));
    const ready=()=>page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true',null,{timeout:180000});
    await page.goto(origin);await ready();
    report.profiles.push({name:`${viewport.width}-production`,...await artifactContext(page)});
    const map=await page.getByTestId('city-map').evaluate(el=>({...el.dataset}));
    check(`${viewport.width}: complete city and every geographic batch`,+map.residentBuildings===60978&&+map.residentTiles===tiles.length&&map.completeCity==='true');
    check(`${viewport.width}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(captureScreenshots)await captureFrame(page,`${out}/city-${viewport.width}.png`,report);
    await chooseProject(page,'M5');if(viewport.width<=800)await page.locator('.sheet-toggle').click();await page.locator('.proposal-details>summary').click();
    const fullName=page.locator('.proposal-details p>strong');await fullName.scrollIntoViewIfNeeded();
    const typography=await fullName.evaluate(node=>{const p=node.parentElement,r=p.getBoundingClientRect(),sheet=p.closest('#planning').getBoundingClientRect();return {name:node.textContent,fontSize:Number.parseFloat(getComputedStyle(p).fontSize),wraps:p.scrollWidth<=p.clientWidth+1,inside:r.left>=sheet.left&&r.right<=sheet.right&&r.top>=0&&r.bottom<=innerHeight};});
    check(`${viewport.width}: the existing long Russian initiative title remains readable`,typography.name.length>=30&&typography.fontSize>=14&&typography.wraps&&typography.inside);
    if(captureScreenshots)await captureFrame(page,`${out}/long-russian-title-${viewport.width}.png`,report);
    await chooseProject(page,'M7');await chooseDistrict(page,'nura');if(viewport.width<=800&&await page.locator('.sheet-toggle').getAttribute('aria-expanded')==='false')await page.locator('.sheet-toggle').click();const kazakh=page.locator('.proposal-person strong');await kazakh.scrollIntoViewIfNeeded();
    const nameGeometry=await kazakh.evaluate(node=>{const r=node.getBoundingClientRect();return {text:node.textContent,fontSize:Number.parseFloat(getComputedStyle(node).fontSize),inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};});
    report.typography??=[];report.typography.push({viewport,russian:typography,kazakh:nameGeometry});
    check(`${viewport.width}: actual Kazakh person spelling remains visible before spending`,/[ӘәҚқҒғҢңӨөҰұҮүҺһІі]/.test(nameGeometry.text)&&nameGeometry.fontSize>=14&&nameGeometry.inside&&await page.getByTestId('remaining-budget').innerText()==='100');
    if(captureScreenshots)await captureFrame(page,`${out}/kazakh-person-${viewport.width}.png`,report);await page.getByRole('button',{name:'Закрыть планирование',exact:true}).press('Escape');
    for(const [id,district] of [['M4','esil'],['M8','nura'],['M11','almaty'],['M12',null],['M14',null]]){
      await chooseProject(page,id);if(district)await chooseDistrict(page,district);
      await confirmProject(page);
    }
    await navigate(page,'dashboard');await page.locator('.dash-score-orbit strong').waitFor();
    check(`${viewport.width}: five real decisions retain the exact score`,await page.locator('.dash-score-orbit strong').innerText()==='54,36');
    if(captureScreenshots)await captureFrame(page,`${out}/result-${viewport.width}.png`,report);
    await page.reload();await page.locator('.connected-application').waitFor();
    check(`${viewport.width}: refresh preserves the five-decision plan`,await page.getByTestId('decision-count').innerText()==='5 из 5');
    await navigate(page,'map');await ready();
    if(viewport.width===1440){
      await navigate(page,'map');
      const blocked='**/'+tiles[0].transport.file;await page.route(blocked,route=>route.abort());await page.reload();
      await page.getByRole('button',{name:'Повторить загрузку карты',exact:true}).waitFor();
      check('failed geometry retains the geographic fallback and saved plan',await page.getByRole('group',{name:'Обзорная карта Астаны'}).isVisible()&&await page.getByTestId('decision-count').innerText()==='5 из 5');
      await page.unroute(blocked);await ready();
      check('map recovers without losing the plan',await page.getByTestId('remaining-budget').innerText()==='25');
      const blockedFacade='**/'+facade.url;await page.route(blockedFacade,route=>route.abort());await page.reload();await page.locator('.world-failure').waitFor();
      check('failed required facade transforms retain the saved plan and geographic fallback',await page.getByRole('group',{name:'Обзорная карта Астаны'}).isVisible()&&await page.getByTestId('decision-count').innerText()==='5 из 5'&&await page.locator('[data-ready=true]').count()===0);
      await page.unroute(blockedFacade);await ready();await navigate(page,'dashboard');await page.locator('.dash-score-orbit strong').waitFor();
      check('facade recovery retains the canonical result and exact remaining budget',await page.locator('.dash-score-orbit strong').innerText()==='54,36'&&await page.getByTestId('remaining-budget').innerText()==='25');
    }
    await context.close();
  }
  const denied=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await denied.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('Storage read denied','SecurityError');};Storage.prototype.setItem=function(){throw new DOMException('Storage write denied','QuotaExceededError');};});
  const deniedPage=await denied.newPage();deniedPage.setDefaultTimeout(30000);deniedPage.on('pageerror',error=>report.errors.push(error.message));await deniedPage.goto(origin);
  await deniedPage.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true',null,{timeout:180000});
  report.profiles.push({name:'denied-storage-read-and-write',...await artifactContext(deniedPage)});
  await chooseProject(deniedPage,'M4');await chooseDistrict(deniedPage,'esil');await confirmProject(deniedPage);
  check('denied browser storage reads and writes preserve current exact-price planning',await deniedPage.getByTestId('remaining-budget').innerText()==='85'&&await deniedPage.getByTestId('decision-count').innerText()==='1 из 5');
  await deniedPage.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.camera||!d.target||d.camera!==d.renderCamera)return false;const a=JSON.parse(d.camera),b=JSON.parse(d.target);return ['x','y','yaw','pitch','zoom'].every(key=>Math.abs(a[key]-b[key])<.00000001);});
  const before=JSON.parse(await deniedPage.getByTestId('city-map').getAttribute('data-camera'));await deniedPage.locator('.alem-city').press('ArrowRight');
  await deniedPage.waitForFunction(x=>Math.abs(JSON.parse(document.querySelector('[data-testid=city-map]').dataset.camera).x-x)>.000001,before.x);
  check('denied camera reads and writes preserve keyboard control without extra spending',await deniedPage.getByTestId('city-map').getAttribute('data-event-camera-owned')==='false'&&await deniedPage.getByTestId('remaining-budget').innerText()==='85');
  if(captureScreenshots)await captureFrame(deniedPage,`${out}/denied-storage-camera.png`,report);await denied.close();
  check('no unhandled browser errors',report.errors.length===0);report.completed=true;
}catch(error){report.failure=String(error);console.error(error);process.exitCode=1;}
finally{
  await browser?.close();
  if(child.exitCode===null){child.kill('SIGTERM');const kill=setTimeout(()=>child.kill('SIGKILL'),5000);await exited;clearTimeout(kill);}
  await rm(directory,{recursive:true,force:true});
  await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
}
