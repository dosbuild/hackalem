/** One sequential main-app probe: atlas return/coexistence and actual phone bounds. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {skipDemonstration,artifactContext,captureFrame} from '../integration/ui.mjs';
import {projectContextVisibility} from './context-geometry.mjs';
const url=process.env.APP_URL??'http://127.0.0.1:4174',out=resolve(process.env.CAPTURE_DIR??'artifacts/cityrt/context-audit');
await mkdir(out,{recursive:true});
const report={url,profiles:[],errors:[],completed:false};
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
try{
 for(const mode of ['astana','khanate'])for(const width of [1440,390,360]){
  const viewport={width,height:width===1440?900:width===390?667:640},name=`${mode}-${width}`,directory=resolve(out,name);await mkdir(directory,{recursive:true});
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(10000);
  const record={name,mode,viewport,checks:[],errors:[]};report.profiles.push(record);page.on('pageerror',e=>record.errors.push(e.message));
  const check=(name,pass,evidence={})=>{record.checks.push({name,pass,...evidence});console.log(pass?'PASS':'FAIL',record.name,name);};
  const geometry=selector=>page.locator(selector).evaluate(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,display:getComputedStyle(node).display,visible:r.width>0&&r.height>0&&getComputedStyle(node).visibility!=='hidden',hit:!!hit&&node.contains(hit)};});
  try{
   await page.goto(`${url}/?mode=${mode}`);await skipDemonstration(page);await page.getByTestId('city-map').waitFor();await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');
   record.artifact=await artifactContext(page);
   if(width===1440){
    const summary=page.locator('.landmark-atlas>summary');
    record.atlasOpener=await geometry('.landmark-atlas>summary');check('Atlas opener is visible and hit-testable beside the primary surface',record.atlasOpener.hit,record.atlasOpener);
    // Keep exploring with real keyboard input after recording a covered opener.
    // This is not a forced click or a DOM-dispatched event.
    const openAtlas=async()=>{if((await geometry('.landmark-atlas>summary')).hit)await summary.click();else{let reached=false;for(let i=0;i<80;i++){await page.keyboard.press('Tab');if(await summary.evaluate(node=>document.activeElement===node)){reached=true;break;}}if(!reached)throw Error('Atlas summary is not keyboard reachable');await page.keyboard.press('Enter');}};
    const selectPlace=async()=>{const first=page.locator('.landmark-atlas-list button').first(),g=await first.evaluate(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return {visible:r.width>0&&r.height>0,hit:!!hit&&node.contains(hit)};});check('Open atlas exposes its actual first place action',g.visible&&g.hit,g);if(g.hit)await first.click();else{await page.keyboard.press('Tab');if(!await first.evaluate(node=>document.activeElement===node))throw Error('First atlas place is not the next keyboard action');await page.keyboard.press('Enter');}};
    await openAtlas();await page.keyboard.press('Escape');
    check('List Escape restores its real summary',await summary.evaluate(node=>document.activeElement===node)&&await page.locator('.landmark-atlas').getAttribute('open')===null);
    await openAtlas();await selectPlace();await page.locator('.landmark-caption').waitFor();
    const id=await page.getByTestId('city-map').getAttribute('data-landmark');await page.keyboard.press('Escape');
    check('Selected caption Escape returns decisions and summary focus',!await page.locator('.landmark-caption').isVisible()&&await page.locator('.decision-deck').isVisible()&&await summary.evaluate(node=>document.activeElement===node),{selected:id});
    await captureFrame(page,resolve(directory,'selected-caption-escape.png'),report);
    if(await page.locator('.landmark-caption').isVisible())await page.locator('.landmark-back').click();
    await openAtlas();await selectPlace();
    await page.locator('[data-toggle=planning]').click();await page.locator('.catalogue-sheet').waitFor({state:'attached'});
    record.catalogue={atlas:await geometry('.landmark-atlas>summary'),caption:await geometry('.landmark-caption'),paper:await geometry('.catalogue-sheet')};
    check('Catalogue exposes its own paper and no reachable atlas context',record.catalogue.paper.visible&&record.catalogue.paper.hit&&!record.catalogue.atlas.visible&&!record.catalogue.caption.visible,record.catalogue);
    await captureFrame(page,resolve(directory,'catalogue-coexistence.png'),report);
    // Actual Tab reaches the independent native summary even when its centre is
    // occluded. Enter then reveals whether it can cover the primary catalogue.
    let reached=false;for(let i=0;i<80;i++){await page.keyboard.press('Tab');if(await summary.evaluate(node=>document.activeElement===node)){reached=true;break;}}
    record.catalogue.keyboardReachedAtlas=reached;
    if(reached){await page.keyboard.press('Enter');record.catalogue.openAtlas=await geometry('.landmark-atlas');await captureFrame(page,resolve(directory,'catalogue-keyboard-atlas.png'),report);}
    check('Keyboard cannot expose an independent atlas over the catalogue',!reached,record.catalogue);
   }else{
    await page.locator('.need-card[data-choice=M7]').click();await page.getByTestId('held-project').waitFor();
    await page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(d?.preview!=='M7'||!d?.projectPhysicalBounds||d.projectPhysicalBounds==='null'||!d.camera||d.camera!==d.renderCamera)return false;const c=JSON.parse(d.camera),t=JSON.parse(d.target);return ['x','y','yaw','pitch','zoom'].every(k=>Math.abs(c[k]-t[k])<.000001);});
    const sample=await page.evaluate(()=>{const d=document.querySelector('[data-testid=city-map]').dataset,r=document.querySelector('#planning').getBoundingClientRect();return {physicalBounds:JSON.parse(d.projectPhysicalBounds),camera:JSON.parse(d.camera),renderCamera:JSON.parse(d.renderCamera),frame:d.frame,renderFrame:d.renderFrame,sheet:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},occlusions:[...document.querySelectorAll('[data-occludes-city]')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>{const b=el.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom};}),mobile:true};});
    record.physical={...sample,...projectContextVisibility(sample)};check('Actual model has useful exposed bounds above the phone sheet',record.physical.visible,record.physical);
    await captureFrame(page,resolve(directory,'phone-physical-context.png'),report);
   }
  }catch(error){record.failure=String(error);report.errors.push({profile:name,error:String(error)});await captureFrame(page,resolve(directory,'failure.png'),report).catch(()=>{});}
  finally{await context.close();}
 }
 report.completed=report.profiles.every(p=>!p.failure&&p.checks.every(c=>c.pass));if(!report.completed)process.exitCode=1;
}finally{await browser.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
