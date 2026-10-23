import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
const origin=process.env.APP_URL||'http://127.0.0.1:4198',out='artifacts/khanate/life';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),report={checks:[],scenes:[],errors:[]};
const check=(n,v)=>{assert(v,n);report.checks.push(n);console.log('PASS',n);};
const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
const map=()=>page.getByTestId('city-map').evaluate(e=>({...e.dataset}));
const settle=()=>page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(d?.ready!=='true')return false;const a=JSON.parse(d.camera),b=JSON.parse(d.target);return ['x','y','zoom'].every(k=>Math.abs(a[k]-b[k])<.0001);});
try{
 await page.goto(origin+'/?mode=khanate');await settle();await page.screenshot({path:out+'/00-arrival.png'});check('Arrival contains animals and moving people',+(await map()).livingAnimals>0&&+(await map()).livingPeople>0);
 for(const id of ['steppe-herd','steppe-flock','steppe-caravan','steppe-spring','steppe-ridge','steppe-willow']){
  await page.locator('.landmark-atlas summary').click();await page.locator(`.landmark-atlas [data-landmark-id="${id}"]`).click();await page.waitForTimeout(250);await settle();
  const before=await map();await page.screenshot({path:`${out}/${id}.png`});await page.waitForTimeout(2500);const after=await map();
  const first=JSON.parse(before.life),last=JSON.parse(after.life);check(`${id}: a native scene changes while watching`,last.some(p=>{const a=first.find(x=>x.id===p.id);return a&&Math.hypot(...p.position.map((v,i)=>v-a.position[i]))>.00012;}));
  report.scenes.push({id,animals:after.livingAnimals,people:after.livingPeople,birds:after.livingBirds,vertices:after.transitVertices,bytes:after.gpuBufferBytes,camera:JSON.parse(after.camera)});
 }
 check('Observation preserves the treasury',await page.getByTestId('remaining-budget').innerText()==='100');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(500);const still=await map();await page.waitForTimeout(1500);const frozen=await map();check('Reduced motion freezes all life',still.life===frozen.life);check('Reduced motion avoids idle GPU redraw',+frozen.drawCount-+still.drawCount<=1);
 await page.setViewportSize({width:390,height:844});await page.locator('.landmark-atlas summary').click();await page.locator('.landmark-atlas [data-landmark-id="steppe-herd"]').click();await page.waitForTimeout(250);await settle();await page.screenshot({path:out+'/phone.png'});check('Phone has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check('No WebGL errors',await page.locator('.alem-city').evaluate(c=>c.getContext('webgl2').getError())===0);check('No application exceptions',report.errors.length===0);report.completed=true;
}catch(e){report.failure=String(e);console.error(e);process.exitCode=1;await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
