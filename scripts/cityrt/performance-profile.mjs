/** Diagnostic native CPU sampling; never an acceptance or equal-load FPS claim. */
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {skipDemonstration,cameraControls,chooseProject,confirmProject,nextDecision,artifactContext} from '../integration/ui.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.APP_URL||'http://127.0.0.1:4208',out=process.env.CAPTURE_DIR||'artifacts/cityrt-performance-profile';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,reducedMotion:'no-preference'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
page.setDefaultTimeout(60000);const report={method:'Chromium native CPU profiler, 1 ms sampling. Same frozen app and native public choices/wheel workload; profiling overhead means these numbers diagnose hot functions only.',phases:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
const data=()=>page.getByTestId('city-map').evaluate(e=>({...e.dataset}));
const settle=()=>page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]').dataset,a=JSON.parse(d.camera),b=JSON.parse(d.target);return d.camera===d.renderCamera&&['x','y','yaw','pitch','zoom'].every(k=>Math.abs(a[k]-b[k])<.000001);});
const home=async()=>{const before=(await data()).cameraRequest;await page.locator('.camera-home').click();await page.waitForFunction(before=>{const d=document.querySelector('[data-testid=city-map]').dataset;return d.cameraRequest!==before&&JSON.parse(d.camera).zoom===1;},before);await settle();};
async function profile(name,direction=-1,steps=100){
 await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
 await page.evaluate(async({direction,steps})=>{const canvas=document.querySelector('.alem-city');for(const d of [direction,-direction])for(let i=0;i<steps;i++){await new Promise(requestAnimationFrame);canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:d*20,bubbles:true,cancelable:true}));}await new Promise(requestAnimationFrame);},{direction,steps});
 const {profile}=await cdp.send('Profiler.stop');await writeFile(`${out}/${name}.cpuprofile`,JSON.stringify(profile));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),counts=new Map();for(const [i,id]of profile.samples.entries())counts.set(id,(counts.get(id)||0)+profile.timeDeltas[i]);
 report.phases.push({name,topSelf:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([id,microseconds])=>({microseconds,frame:nodes.get(id).callFrame,children:nodes.get(id).children})),map:await data()});console.log('PROFILED',name);await cdp.send('Profiler.disable');
}
try{
 await page.goto(origin+'/?mode=astana');await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');await skipDemonstration(page);await cameraControls(page);report.build=await artifactContext(page);
 await home();await page.getByRole('button',{name:'Район Есиль на карте',exact:true}).click();await settle();await profile('empty-esil');
 await page.emulateMedia({reducedMotion:'reduce'});for(const [id,district]of [['M4','esil'],['M1','almaty'],['M8','nura'],['M10','saryarka'],['M14',null]]){await chooseProject(page,id);if(district)await page.locator('.candidate select').selectOption(district);await confirmProject(page);if(id!=='M14')await nextDecision(page);}
 await home();await page.locator('.map-project[data-initiative=M4][data-proposal=false]').click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await settle();await page.emulateMedia({reducedMotion:'no-preference'});await profile('five-projects',1,125);
 report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;console.error(String(error).split('\n')[0]);}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
