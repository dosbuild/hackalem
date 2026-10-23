import {skipDemonstration,confirmProject,chooseProject,chooseDistrict,cameraControls} from '../integration/ui.mjs';
/** An uninterrupted recording through the real planning UI, with no state injection. */
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.CAPTURE_DIR||'artifacts/hero-school',origin=process.env.APP_URL||'http://127.0.0.1:4174';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}}),page=await context.newPage();
page.setDefaultTimeout(30000);const errors=[],frames=[],checks=[],map=page.getByTestId('city-map');page.on('pageerror',e=>errors.push(e.message));
const shot=async n=>page.screenshot({path:`${out}/${n}.png`}),check=(name,value)=>{assert(value,name);checks.push(name);};
await context.addInitScript(()=>{window.__schoolFrames=[];window.__schoolCapture=false;let lastFrame='';const sample=()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(window.__schoolCapture&&d?.camera&&d.frame!==lastFrame){lastFrame=d.frame;window.__schoolFrames.push({t:+d.schoolTime,stage:d.choreography,camera:JSON.parse(d.camera),renderCamera:JSON.parse(d.renderCamera),progress:+d.construction,phase:d.phase,vertices:+d.projectVertices});}requestAnimationFrame(sample);};requestAnimationFrame(sample);});
try{
 await page.goto(origin);await page.locator('[data-ready=true]').waitFor();await skipDemonstration(page);await page.waitForTimeout(700);await shot('00-city-start');
 await chooseProject(page,'M7');await chooseDistrict(page,'nura');await page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.camera||!d.target)return false;const c=JSON.parse(d.camera),t=JSON.parse(d.target);return ['x','y','yaw','pitch','zoom'].every(k=>Math.abs(c[k]-t[k])<.0001);});await shot('01-real-choice');const acceptedCamera=JSON.parse(await map.getAttribute('data-camera'));
 check('Preview leaves the plan unchanged',await page.getByTestId('remaining-budget').innerText()==='100');
 await page.evaluate(()=>window.__schoolCapture=true);await confirmProject(page);
 const captures=[['02-before',4.48/2.2],['03-peak-construction',9.05/2.2],['04-inhabited',17.2/2.2],['05-completed-hold',22.3/2.2]];let i=0;
 for(let sample=0;sample<300;sample++){
  await page.waitForTimeout(95);const d=await map.evaluate(e=>({...e.dataset}));
  if(i<captures.length&&+d.schoolTime>=captures[i][1]){await shot(captures[i][0]);i++;}
  if(+d.schoolTime>14.2)break;
 }
 frames.push(...await page.evaluate(()=>{window.__schoolCapture=false;return window.__schoolFrames;}));
 check('M7 commits exactly 24 units',await page.getByTestId('remaining-budget').innerText()==='76');check('One real commitment',await page.getByTestId('decision-count').innerText()==='1 of 5');
 check('All directed beats occur',['approach','anticipation','arrival','build','activation','people','settle'].every(s=>frames.some(f=>f.stage===s)));
 check('Camera equals render camera throughout',frames.every(f=>JSON.stringify(f.camera)===JSON.stringify(f.renderCamera)));
 check('Animation does not evaluate the plan',frames.filter(f=>f.stage!=='idle').every(f=>f.phase==='present'));
 const d=await map.evaluate(e=>({...e.dataset})),c=JSON.parse(d.camera);check('Completed school retains the accepted architectural preview',c.zoom>80&&['x','y','yaw','pitch','zoom'].every(k=>Math.abs(c[k]-acceptedCamera[k])<.01));check('Planned object persists',JSON.parse(d.interventions).some(o=>o.key==='M7:nura'&&o.state==='planned'));
 await page.waitForTimeout(1000);await shot('06-settled-school');
 // The continuous proof ends here; revisiting is verified in the same normal session.
 await page.locator('.map-project[data-initiative=M7][data-district=nura][data-child=false]').click();await page.getByTestId('program-inspection').waitFor();await page.waitForTimeout(2000);check('Revisiting the school opens read-only inspection',await page.getByTestId('held-project').count()===0&&await page.getByTestId('remaining-budget').innerText()==='76'&&await page.getByTestId('decision-count').innerText()==='1 of 5');await shot('07-persistent-close');
 await page.locator('.alem-city').focus();for(let i=0;i<6;i++)await page.locator('.alem-city').press('-');await page.waitForTimeout(1300);await shot('08-persistent-district');await cameraControls(page);await page.getByRole('button',{name:'City overview',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]').dataset.zoom==='1.000');await page.waitForTimeout(900);
 check('No browser exceptions',errors.length===0);console.log(JSON.stringify({checks,errors},null,2));
}finally{await page.close();await context.close();await rename(await page.video().path(),`${out}/continuous-school.webm`);await browser.close();await writeFile(`${out}/capture-report.json`,JSON.stringify({complete:checks.includes('No browser exceptions'),origin,checks,errors,frames},null,2));}
