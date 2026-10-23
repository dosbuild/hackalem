/** Public demonstration pause: distinguish a stale dataset from an advancing clock. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {openTools,artifactContext} from '../integration/ui.mjs';
const origin=process.env.APP_URL||'http://127.0.0.1:4174',out=process.env.CAPTURE_DIR||'artifacts/cityrt/pause';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),page=await context.newPage();
page.setDefaultTimeout(60000);
const report={origin,samples:[],errors:[],completed:false};page.on('pageerror',error=>report.errors.push(error.message));
const sample=async label=>{const value=await page.evaluate(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return {at:Date.now(),frame:Number(d?.frame),renderFrame:Number(d?.renderFrame),schoolTime:Number(d?.schoolTime),camera:d?.camera,renderCamera:d?.renderCamera,phase:document.querySelector('[data-demo]')?.dataset.demo,plan:JSON.parse(localStorage.getItem('akim:draft')||'{"plan":[]}').plan,paused:!![...document.querySelectorAll('.demonstration-card button')].find(b=>b.textContent==='Resume demonstration')};});report.samples.push({label,...value});return value;};
const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
try{
 await page.goto(origin);await openTools(page);await page.getByRole('button',{name:'See Aya build a school',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-demo]')?.dataset.demo==='building'&&document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');
 report.build=await artifactContext(page);await sample('before-pause');await page.getByRole('button',{name:'Pause',exact:true}).click();await sample('immediate-after-click');
 await page.getByRole('button',{name:'Resume demonstration',exact:true}).waitFor();await frames();const paused=await sample('paused-native-frame');
 await page.waitForTimeout(1400);const after=await sample('paused-after-1400ms');
 report.deltaSchoolSeconds=after.schoolTime-paused.schoolTime;
 assert(paused.paused&&after.paused&&Number.isFinite(paused.schoolTime)&&Math.abs(report.deltaSchoolSeconds)<.12,'The acknowledged paused native clock stays frozen');
 assert(after.plan.length===0,'The demonstration spends no actual draft');
 await page.screenshot({path:out+'/paused.png'});
 await page.getByRole('button',{name:'Resume demonstration',exact:true}).click();await page.waitForTimeout(400);const resumed=await sample('resumed-after-400ms');
 assert(!resumed.paused&&resumed.schoolTime>after.schoolTime+.1,'Resume advances the original isolated demo clock');
 assert(report.errors.length===0,'No unhandled errors');report.completed=true;console.log('PASS acknowledged demonstration pause/resume',report.deltaSchoolSeconds);
}catch(error){report.failure=String(error);process.exitCode=1;await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(error);}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
