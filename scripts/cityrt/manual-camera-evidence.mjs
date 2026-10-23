/** Native regression for manual zoom versus camera-derived UI occlusions. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {skipDemonstration,chooseProject,confirmProject,artifactContext} from '../integration/ui.mjs';
import {cameraFrame} from '../../src/world/projection.js';
const origin=process.env.APP_URL||'http://127.0.0.1:5187',out=process.env.CAPTURE_DIR||'artifacts/cityrt/manual-camera';
await mkdir(out,{recursive:true});
const report={method:'Isolated normal-motion main app; public catalogue and native wheels only. Read-only camera evidence. No runtime calls, storage writes or clock changes.',startedAt:new Date().toISOString(),profiles:[],errors:[],completed:false};
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
try{
 for(const [width,height] of [[1440,900],[390,667]])for(const id of ['M1','M3'])for(const reducedMotion of ['no-preference','reduce']){
  const key=`khanate-${id}-${width}x${height}-${reducedMotion}`,context=await browser.newContext({viewport:{width,height},reducedMotion,recordVideo:{dir:out+'/'+key+'/video',size:{width,height}}}),page=await context.newPage();
  const record={key,width,height,id,reducedMotion,actions:[],frames:[],complete:false};report.profiles.push(record);
  page.on('pageerror',error=>report.errors.push({key,error:String(error)}));
  const state=()=>page.locator('[data-testid=city-map]').evaluate(e=>({...e.dataset}));
  const settle=async()=>{
   await page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.camera||d.camera!==d.renderCamera)return false;const c=JSON.parse(d.camera),t=JSON.parse(d.target);return ['x','y','yaw','pitch','zoom'].every(k=>c[k]===t[k]);},{},{timeout:15000});
  };
  const shot=async name=>{await settle();const before=await state(),build=await artifactContext(page),path=out+'/'+key+'/'+name+'.png';await page.screenshot({path});const after=await state();const sidecar={path,captureBackend:'playwright-page-png',capturedAt:new Date().toISOString(),build,before,after};await writeFile(path+'.json',JSON.stringify(sidecar,null,2)+'\n');record.frames.push(sidecar);};
  try{
   await page.goto(origin+'/?mode=khanate');await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');await skipDemonstration(page);await chooseProject(page,id);await settle();await shot('01-proposal');
   const zoomTo=async wanted=>{
    for(let step=0;step<30;step++){
     await settle();const before=await state(),c=JSON.parse(before.camera),targetBefore=JSON.parse(before.target),delta=Math.log(wanted/targetBefore.zoom);if(Math.abs(delta)<.00005)return;
     const point=await page.locator('.alem-city').evaluate(canvas=>{const r=canvas.getBoundingClientRect();for(const y of [.3,.4,.2,.5])for(const x of [.7,.85,.5]){const p={x:r.x+r.width*x,y:r.y+r.height*y};if(document.elementFromPoint(p.x,p.y)===canvas)return p;}return null;});assert(point,'Visible canvas supports ordinary wheel control');
     // Chromium dispatches wheel deltas as Float32. Use that exact native input
     // in the expected endpoint, retaining the original target-error assertion.
     const change=Math.max(-.25,Math.min(.25,delta)),nativeDeltaY=Math.fround(-change/.002),expected=targetBefore.zoom*Math.exp(-nativeDeltaY*.002),action={kind:'native-wheel',wanted,before:c,targetBefore,nativeDeltaY,expected,at:new Date().toISOString()};record.actions.push(action);await page.mouse.move(point.x,point.y);await page.mouse.wheel(0,nativeDeltaY);
     await page.waitForFunction(expected=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.camera||d.camera!==d.renderCamera)return false;const c=JSON.parse(d.camera),t=JSON.parse(d.target);return Math.abs(t.zoom-expected)<1e-7&&Math.abs(c.zoom-expected)<Math.max(1e-4,expected*5e-6);},expected,{timeout:15000});await settle();
     const after=await state(),actual=JSON.parse(after.camera),target=JSON.parse(after.target);Object.assign(action,{after:actual,target,finishedAt:new Date().toISOString()});
     assert(Math.abs(actual.zoom-expected)<Math.max(1e-4,expected*5e-6),'Manual wheel reaches its own requested zoom');assert(Math.abs(target.zoom-expected)<1e-7,'A derived annotation does not replace the manual target');
     assert(Math.hypot(actual.x-c.x,actual.y-c.y)<1e-7,'Manual zoom retains its chosen position');assert.equal(after.camera,after.renderCamera,'Shared camera is rendered');
    }
    throw Error('Public manual zoom did not converge');
   };
   for(const zoom of [34,44,216,44,34]){await zoomTo(zoom);await shot('zoom-'+zoom+'-'+record.frames.length);}
   // A real new proposal must reacquire context fitting after manual ownership.
   await chooseProject(page,'M7');await settle();const data=await state(),pose=JSON.parse(data.camera),points=JSON.parse(data.projectPhysicalBounds),frame=cameraFrame(pose,width,height,Number(data.frame),{overviewZoom:7});
   const projected=points.map(frame.world),bounds={left:Math.min(...projected.map(p=>p.x)),right:Math.max(...projected.map(p=>p.x)),top:Math.min(...projected.map(p=>p.y)),bottom:Math.max(...projected.map(p=>p.y))};
   assert.equal(data.preview,'M7');assert(bounds.right>0&&bounds.left<width&&bounds.bottom>140&&bounds.top<height-55,'New proposal brings its physical context into the map');record.newContext={pose,bounds,source:'Projected physical framing bounds, not a measured silhouette'};await shot('07-new-teaching-court');
   await zoomTo(216);const held=JSON.parse((await state()).camera);await confirmProject(page);
   await page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return d?.preview===''&&JSON.parse(d.interventions||'[]').some(o=>o.key==='M7:esil'&&o.state==='planned');});await settle();const accepted=JSON.parse((await state()).camera);
   for(const axis of ['x','y','yaw','pitch','zoom'])assert(Math.abs(accepted[axis]-held[axis])<1e-5,'Held confirmation retains manual '+axis);record.heldConfirmation={before:held,after:accepted};await shot('08-held-confirmation');record.complete=true;console.log('PASS native manual camera',key);
  }catch(error){record.failure=String(error);record.failureState=await state().catch(()=>null);await shot('failure').catch(e=>{record.failureCaptureError=String(e);});throw error;}
  finally{await context.close();const video=await page.video()?.path();if(video){record.video=video;await writeFile(video+'.json',JSON.stringify({key,captureBackend:'playwright-context-webm',video,method:report.method},null,2)+'\n');}}
 }
 assert.equal(report.errors.length,0);report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;console.error(String(error));}
finally{await browser.close();report.finishedAt=new Date().toISOString();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
