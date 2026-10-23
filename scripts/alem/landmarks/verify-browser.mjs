/** The real city, viewed through its public landmark controls. No model-only substitute. */
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../../release/browser-options.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.APP_URL||'http://127.0.0.1:5175',out=process.env.RELEASE_OUTPUT||'artifacts/landmarks/map-qa';
const manifest=JSON.parse(await readFile('public/alem/landmarks.json','utf8'));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();
const report={checks:[],views:[],errors:[],requests:[],completed:false};
page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.url().includes('/alem/map-'))report.requests.push(r.url());});
page.setDefaultTimeout(60000);const map=page.getByTestId('city-map');
const check=(name,result)=>{assert(result,name);report.checks.push(name);console.log('PASS',name);};
const settle=async()=>{await page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.camera||!d?.target||d.camera!==d.renderCamera)return false;const a=JSON.parse(d.camera),b=JSON.parse(d.target);return ['x','y','yaw','pitch','zoom'].every(k=>Math.abs(a[k]-b[k])<.000001);});};
const data=()=>map.evaluate(el=>({...el.dataset}));
async function capture(id,variant='front'){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.waitForFunction(({id,zoom})=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return d?.landmark===id&&d.target&&Math.abs(JSON.parse(d.target).zoom-zoom)<.000001;},{id,zoom:manifest.landmarks.find(m=>m.id===id).zoom});
 await settle();const d=await data();await page.screenshot({path:`${out}/${id}-${variant}.png`});
 const bounds=await page.locator('.landmark-caption').boundingBox();report.views.push({id,variant,camera:JSON.parse(d.camera),renderedBuildings:+d.renderedBuildings,visibleCityVertices:+d.visibleCityVertices,submitMs:+d.drawSubmitMs,gpuBufferBytes:+d.gpuBufferBytes,caption:bounds});
 check(`${id}/${variant}: complete city and selected landmark`,d.completeCity==='true'&&+d.residentBuildings===60978&&d.landmark===id);
 check(`${id}/${variant}: caption stays inside viewport`,bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=(page.viewportSize().width+1)&&bounds.y+bounds.height<=page.viewportSize().height-60);
 check(`${id}/${variant}: geographic model has depth without a WebGL error`,await page.locator('.alem-city').evaluate(c=>c.getContext('webgl2').getError())===0&&+d.visibleCityVertices>1000);
 if(variant==='phone'){const model=manifest.landmarks.find(m=>m.id===id),pose=JSON.parse(d.camera),scale=Math.min(pose.height*.36,pose.width*.29)*pose.zoom,x=pose.width/2+(Math.cos(pose.yaw)*((model.position[0]-71.431)*5.8-pose.x)-Math.sin(pose.yaw)*((model.position[1]-51.139)*9.25-pose.y))*scale;check(`${id}/phone: closed atlas does not push the landmark to the screen edge`,Math.abs(x-pose.width/2)<pose.width*.18);}
}
try{
 const started=Date.now();await page.goto(origin+'/?landmark=expo');await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');await settle();
 report.loadMs=Date.now()-started;check('deep link arrives at EXPO after bootstrap', (await data()).landmark==='expo');
 const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='alem:context'))),loadedRequests=report.requests.length;
 for(let i=0;i<manifest.landmarks.length;i++){
  const model=manifest.landmarks[i];if(i)await page.getByRole('button',{name:'Next place',exact:true}).click();await capture(model.id);
  check(`${model.id}: current place has a reloadable URL`,new URL(page.url()).searchParams.get('landmark')===model.id);
  check(`${model.id}: exploration uncovers the city`,!await page.locator('.decision-deck').isVisible());
  if(model.id==='lrt')check('LRT arrival has two physical four-car trains',+(await data()).lrtTrains===2&&+(await data()).transitVertices>20000);
  if(model.id==='palace'){
   const a=JSON.parse((await data()).camera);await page.getByRole('button',{name:'Zoom in on map',exact:true}).click();await page.waitForFunction(zoom=>JSON.parse(document.querySelector('[data-testid=city-map]').dataset.target).zoom>zoom,a.zoom);await settle();const b=JSON.parse((await data()).camera);
   check('landmark outside scenario districts can zoom without being moved',Math.hypot(a.x-b.x,a.y-b.y)<.00001&&b.zoom>a.zoom);
  }

 }
 check('tour makes no additional city geometry requests',report.requests.length===loadedRequests);
 check('tour preserves the saved plan and budget',JSON.stringify(before)===JSON.stringify(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='alem:context')))));
 await page.getByRole('button',{name:'Back to decisions',exact:true}).click();await settle();check('return restores decisions',await page.locator('.decision-deck').isVisible()&&!await page.locator('.landmark-caption').isVisible());
 check('return clears only the landmark query',new URL(page.url()).searchParams.get('landmark')===null);
 await page.locator('.landmark-atlas summary').click();check('all places are reachable from the atlas',await page.locator('.landmark-atlas-list button').count()===manifest.landmarks.length);
 await page.locator('.landmark-atlas summary').press('Escape');check('Escape dismisses the atlas',await page.locator('.landmark-atlas').getAttribute('open')===null);
 await page.setViewportSize({width:390,height:844});await page.locator('.landmark-atlas summary').click();await page.locator('.landmark-atlas-list [data-landmark-id=expo]').click();await capture('expo','phone');
 await page.locator('.landmark-atlas summary').click();await page.locator('.landmark-atlas-list [data-landmark-id=lrt]').click();await capture('lrt','phone');
 check('phone does not overflow horizontally',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'Back to decisions',exact:true}).click();check('phone returns to the untouched decision deck',await page.locator('.decision-deck').isVisible());
 check('no unhandled browser exceptions',report.errors.length===0);report.completed=true;
}catch(error){report.failure=String(error);console.error(error);process.exitCode=1;await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
