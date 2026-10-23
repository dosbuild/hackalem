/** Native public-wheel check for the quotation beneath a pinned proposal action. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {skipDemonstration,chooseProject,artifactContext} from '../integration/ui.mjs';
const origin=process.env.APP_URL||'http://127.0.0.1:4174',out=process.env.CAPTURE_DIR||'artifacts/cityrt/proposal-scroll-recovery';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),report={method:'Actual frozen app, isolated profiles, public sheet toggle and wheel input. No DOM/style/state or clock injection.',profiles:[],errors:[]};
try{
 for(const [width,height]of [[1440,900],[1280,720],[390,667],[360,640]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  try{
   await page.goto(origin+'/?mode=khanate');await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');await skipDemonstration(page);await chooseProject(page,'M7');
   if(width<=800)await page.locator('.sheet-toggle').click();
   const quote=page.locator('.candidate .proposal-quote');await quote.waitFor({state:'visible'});
   const snapshot=()=>page.locator('.candidate').evaluate(e=>{const q=e.querySelector('.proposal-quote'),f=e.querySelector('.proposal-confirmation'),r=q.getBoundingClientRect(),a=f.getBoundingClientRect(),paper=e.closest('.planning-drawer').getBoundingClientRect();return {text:q.textContent,quote:{top:r.top,bottom:r.bottom,left:r.left,right:r.right},footer:{top:a.top,bottom:a.bottom},paper:{top:paper.top,bottom:paper.bottom},fullyVisible:r.top>=paper.top&&r.bottom<=a.top-2&&r.left>=0&&r.right<=innerWidth};});
   const before=await snapshot();let after=before;
   for(let step=0;step<8&&!after.fullyVisible;step++){
    const box=await page.locator('.candidate').boundingBox();assert(box);await page.mouse.move(box.x+box.width*.5,Math.min(after.footer.top-30,box.y+box.height*.5));await page.mouse.wheel(0,80);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));after=await snapshot();
   }
   assert(after.fullyVisible,'The complete quotation is readable above the pinned action at '+width+'x'+height);
   const action=page.locator('.proposal-confirmation .primary'),actionBox=await action.boundingBox();assert(actionBox&&actionBox.y+actionBox.height<=height,'Pinned primary action remains on screen');
   await page.screenshot({path:`${out}/${width}x${height}-quote-readable.png`});report.profiles.push({width,height,build:await artifactContext(page),before,after});console.log('PASS quotation scroll recovery',width,height);
  }finally{await context.close();}
 }
 assert.equal(report.errors.length,0);report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;console.error(String(error));}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
