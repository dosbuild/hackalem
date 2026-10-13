/** Real receipt-age evidence after choose -> confirm -> immediate Next.
 * APP_URL=http://127.0.0.1:4174 CAPTURE_DIR=artifacts/cityrt/construction node scripts/cityrt/construction-evidence.mjs
 * One browser, fresh isolated normal-motion profiles, public UI only. No clock,
 * storage, plan, camera or application-event injection.
 */
import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {artifactContext,skipDemonstration} from '../integration/ui.mjs';
import {projectContextVisibility} from './context-geometry.mjs';
import {projectAnchor} from '../fullscreen/anchor-oracle.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),url=(process.env.APP_URL??'http://127.0.0.1:4174').replace(/\/$/,''),out=resolve(root,process.env.CAPTURE_DIR??'artifacts/cityrt/construction');
const modes=process.env.WORLD_MODE?[process.env.WORLD_MODE]:['astana','khanate'];
assert(modes.every(mode=>['astana','khanate'].includes(mode)),'Unknown WORLD_MODE');
await mkdir(out,{recursive:true});
const report={url,startedAt:new Date().toISOString(),profiles:[],completed:false,visualReviewPending:true};
let browser;
const read=page=>page.evaluate(()=>{
 const map=document.querySelector('[data-testid=city-map]'),d=map.dataset,key=document.documentElement.dataset.mode==='khanate'?'alem:khanate:akim:draft':'akim:draft';
 const parse=value=>{try{return JSON.parse(value??'null');}catch{return null;}},draft=parse(localStorage.getItem(key));
 const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};};
 const label=document.querySelector('.map-project[data-initiative=M7][data-proposal=false]'),r=label?.getBoundingClientRect(),hit=r?document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2):null;
 return {at:Date.now(),world:document.documentElement.dataset.mode,context:document.querySelector('.city-application')?.dataset.context,normalMotion:!matchMedia('(prefers-reduced-motion:reduce)').matches,
  plan:draft?.plan??[],receipts:draft?.construction??[],remaining:document.querySelector('[data-testid=remaining-budget]')?.textContent,
  camera:parse(d.camera),renderCamera:parse(d.renderCamera),target:parse(d.target),cameraRequest:d.cameraRequest,frame:d.frame,renderFrame:d.renderFrame,phase:d.phase,
  schoolTime:Number(d.schoolTime),choreography:d.choreography,eventCameraOwned:d.eventCameraOwned,eventQuiet:d.eventQuiet,activities:parse(d.constructions)??[],interventions:parse(d.interventions)??[],
  physicalBounds:parse(d.projectPhysicalBounds),sheet:rect(document.querySelector('.decision-deck')??document.querySelector('.consequence-card')??document.querySelector('#planning')),
  occlusions:[...document.querySelectorAll('[data-occludes-city]')].filter(node=>!node.hidden&&getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width>0).map(rect),
  label:label?{text:label.textContent,initiative:label.dataset.initiative,district:label.dataset.district,anchor:{x:Number(label.dataset.anchorX),y:Number(label.dataset.anchorY)},frame:label.dataset.frame,hidden:label.hidden,rect:rect(label),visible:!label.hidden&&r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&!!hit&&label.contains(hit)}:null};
});
try{
 browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
 for(const mode of modes){
  const district=mode==='astana'?'nura':'esil',directory=resolve(out,mode),viewport={width:1440,height:900};await mkdir(directory,{recursive:true});
  const context=await browser.newContext({viewport,reducedMotion:'no-preference',serviceWorkers:'block',recordVideo:{dir:directory,size:viewport}}),page=await context.newPage();page.setDefaultTimeout(90000);
  const record={mode,district,viewport,actions:[],samples:[],checks:[],errors:[],visualReview:['ground stakes/site preparation','first foundation/building work','growth through6/10seconds','completed model and use']};report.profiles.push(record);
  page.on('pageerror',error=>record.errors.push(error.message));
  const check=(name,pass,evidence={})=>{record.checks.push({name,pass,...evidence});console.log(pass?'PASS':'FAIL',mode,name);};
  const action=async(name,operation)=>{const before=await read(page);await operation();record.actions.push({name,before,after:await read(page)});};
  try{
   await page.goto(`${url}/?mode=${mode}`);await skipDemonstration(page);await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');
   const version=await page.request.get(`${url}/version.json`);assert(version.ok(),'Production version provenance is required');record.build=await version.json();record.provenance=await artifactContext(page);
   const fresh=await read(page);assert(fresh.world===mode&&fresh.normalMotion&&fresh.plan.length===0&&fresh.remaining==='100','Fresh normal-motion world is required');
   await action('choose existing school need',()=>page.locator('.need-card[data-choice=M7]').click());await page.getByTestId('held-project').waitFor();
   await page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(d?.preview!=='M7'||!d.camera||d.camera!==d.renderCamera||!d.target)return false;const c=JSON.parse(d.camera),t=JSON.parse(d.target);return ['x','y','yaw','pitch','zoom'].every(k=>Math.abs(c[k]-t[k])<.0000001);});
   const proposed=await read(page);record.proposal=proposed;
   await action('confirm school once',()=>page.getByTestId('held-project').locator('.proposal-confirmation .primary').click());
   await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'{"plan":[]}').plan.length===1,mode==='astana'?'akim:draft':'alem:khanate:akim:draft');
   const accepted=await read(page),receipt=accepted.receipts.find(item=>item.key===`M7:${district}`);
   assert(receipt&&receipt.durationMs>0&&receipt.durationMs<=30000,'Real bounded school receipt is required');record.receipt=receipt;
   const plan=JSON.stringify(accepted.plan),receipts=JSON.stringify(accepted.receipts);
   check('Accepted school retains its proposed camera request and canonical price',accepted.cameraRequest===proposed.cameraRequest&&accepted.remaining==='76'&&accepted.plan[0]?.initiativeId==='M7'&&accepted.plan[0]?.districtId===district);
   await action('immediate Next while city remains visible',()=>page.locator('.consequence-actions').getByRole('button',{name:'Следующее решение →',exact:true}).click());await page.getByTestId('decision-deck').waitFor();
   const next=await read(page);record.next=next;
   check('Immediate Next retains original receipt, plan and useful camera request',JSON.stringify(next.plan)===plan&&JSON.stringify(next.receipts)===receipts&&next.cameraRequest===accepted.cameraRequest&&next.target.zoom>=proposed.target.zoom*.75,{elapsedSeconds:(next.at-receipt.startedAt)/1000});
   check('Next happens during real live construction',next.at<receipt.startedAt+receipt.durationMs&&await page.getByTestId('city-map').isVisible());
   const capture=async(targetMs,label)=>{
    await page.waitForFunction(({startedAt,targetMs})=>Date.now()>=startedAt+targetMs,{startedAt:receipt.startedAt,targetMs},{timeout:35000});
    // The receipt deadline can fall between native frames. Read a frame that
    // follows it, rather than comparing wall time with the preceding activity.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const before=await read(page);assert(before.physicalBounds?.length>=8,'Actual school bounds are required');
    const physical=projectContextVisibility({...before,mobile:false}),path=resolve(directory,`${label}.png`);await page.screenshot({path});
    const after=await read(page),provenance=await artifactContext(page);
    const sample={label,targetSeconds:targetMs/1000,elapsedStartSeconds:(before.at-receipt.startedAt)/1000,elapsedEndSeconds:(after.at-receipt.startedAt)/1000,receipt,before,after,physical,path,...provenance};
    record.samples.push(sample);await writeFile(`${path}.json`,JSON.stringify(sample,null,2)+'\n');
    // Crop the actual projected school volume; no map action changes its pose.
    const b=physical.box,left=Math.max(0,Math.floor(b.left)-8),top=Math.max(0,Math.floor(b.top)-8),right=Math.min(viewport.width,Math.ceil(b.right)+8),bottom=Math.min(viewport.height,Math.ceil(b.bottom)+8);
    if(right>left&&bottom>top){const crop=resolve(directory,`${label}-site.png`),cropBefore=await read(page);await page.screenshot({path:crop,clip:{x:left,y:top,width:right-left,height:bottom-top}});sample.crop=crop;await writeFile(`${crop}.json`,JSON.stringify({...provenance,targetSeconds:targetMs/1000,elapsedStartSeconds:(cropBefore.at-receipt.startedAt)/1000,elapsedEndSeconds:((await read(page)).at-receipt.startedAt)/1000,receipt,clip:{left,top,right,bottom},physical},null,2)+'\n');}
    check(`${label}: physical site remains usefully exposed`,physical.visible&&JSON.stringify(before.camera)===JSON.stringify(before.renderCamera),{fraction:physical.fraction,elapsedSeconds:sample.elapsedStartSeconds});
    const native=before.interventions.find(item=>item.key===`M7:${district}`),anchor=native&&projectAnchor(native.origin,before.camera),nameplate=before.label;
    // Existing quiet construction deliberately suppresses nameplates. Retain
    // that authored choice while checking their canonical identity and exact
    // same-frame anchor, and require exposure once quiet construction ends.
    check(`${label}: accepted nameplate retains canonical identity and same-frame anchor`,!!nameplate&&nameplate.initiative==='M7'&&nameplate.district===district&&nameplate.text.length>0&&Number(nameplate.frame)===Number(before.frame)&&!!anchor&&Math.hypot(nameplate.anchor.x-anchor.x,nameplate.anchor.y-anchor.y)<.002&&(before.eventQuiet==='true'||nameplate.visible),{label:nameplate,eventQuiet:before.eventQuiet,independentAnchor:anchor});
    check(`${label}: Next preserves saved progress and the camera request`,JSON.stringify(before.plan)===plan&&JSON.stringify(before.receipts)===receipts&&before.cameraRequest===accepted.cameraRequest&&before.context==='choices'&&before.phase==='present');
    check(`${label}: real activity follows the original receipt age`,before.at<receipt.startedAt+receipt.durationMs?before.activities.some(item=>item.id==='M7'&&Math.abs(item.elapsed-(before.at-receipt.startedAt)/1000)<.25):!before.activities.some(item=>item.id==='M7'),{activities:before.activities});
   };
   for(const seconds of [0,2,6,10])await capture(seconds*1000,`next-${String(seconds).padStart(2,'0')}s`);
   await capture(Math.max(10500,receipt.durationMs+250),'completed-followup');
   check('Normal construction sequence has no uncaught errors',record.errors.length===0);
  }catch(error){record.failure=String(error);process.exitCode=1;await page.screenshot({path:resolve(directory,'failure.png')}).catch(()=>{});}
  finally{
   const metadata=await artifactContext(page),video=page.video();await context.storageState({path:resolve(directory,'storage-state.json')});await page.close();await context.close();
   if(video){const path=resolve(directory,'journey.webm');await rename(await video.path(),path);record.video=path;await writeFile(`${path}.json`,JSON.stringify({...metadata,type:'continuous-normal-motion-construction',receipt:record.receipt},null,2)+'\n');}
   await writeFile(resolve(directory,'report.json'),JSON.stringify(record,null,2)+'\n');
  }
 }
 report.completed=report.profiles.length===modes.length&&report.profiles.every(record=>!record.failure&&record.checks.every(check=>check.pass));if(!report.completed)process.exitCode=1;
}catch(error){report.failure=String(error);process.exitCode=1;}
finally{await browser?.close();report.finishedAt=new Date().toISOString();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
