import {skipDemonstration,confirmProject,chooseProject,chooseDistrict,cameraControls} from '../integration/ui.mjs';
import assert from 'node:assert/strict';
import {projectObjects,projectFocusBounds} from '../../src/world/project-objects.js';
import bootstrap from '../../src/world/bootstrap.json' with {type:'json'};
import {cameraFrame} from '../../src/world/projection.js';
import {projectLabelVolume} from '../../src/world/label-layout.js';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {writeFile,mkdir,rename} from 'node:fs/promises';
const out=process.env.RELEASE_OUTPUT||'artifacts/consequences/gallery';await mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});const report=[];
// Independently clip the projected silhouette against the label's padded box;
// the production placement code uses SAT. Empty bounding-box corners stay free.
const overlapsPhysical=(outline,box)=>{
 let clipped=outline;
 for(const [axis,edge,direction] of [['x',box.left-7,1],['x',box.right+7,-1],['y',box.top-7,1],['y',box.bottom+7,-1]]){
  const next=[];
  for(let i=0;i<clipped.length;i++){const a=clipped[i],b=clipped[(i+1)%clipped.length],insideA=(a[axis]-edge)*direction>=0,insideB=(b[axis]-edge)*direction>=0;if(insideA)next.push(a);if(insideA!==insideB){const t=(edge-a[axis])/(b[axis]-a[axis]);next.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}
  clipped=next;
 }
 return Math.abs(clipped.reduce((sum,a,i)=>{const b=clipped[(i+1)%clipped.length];return sum+a.x*b.y-a.y*b.x;},0))>1e-6;
};
try{
for(const id of (process.argv.slice(2).length?process.argv.slice(2):Array.from({length:14},(_,i)=>`M${i+1}`))){
 const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.APP_URL||'http://127.0.0.1:4174');await page.locator('[data-ready=true]').waitFor();await skipDemonstration(page);await chooseProject(page,id);if(await page.locator('.candidate select').count())await chooseDistrict(page,'esil');await confirmProject(page,{openResult:false});
 const citywide=['M2','M6','M12','M14'].includes(id);await page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return d?.choreography==='build'&&+d.construction>.4&&+d.construction<.9;});
 const building=await page.getByTestId('city-map').evaluate(e=>({...e.dataset})),buildingCamera=JSON.parse(building.camera),plan=await page.evaluate(()=>JSON.parse(localStorage.getItem('akim:draft')).plan),working=projectObjects({commitments:plan,candidate:null,result:null,comparisonPosition:0,scenarioRevision:+building.scenarioRevision},bootstrap.districts.features).find(o=>o.key===id+':esil'),workingBounds=projectFocusBounds(working),buildingPoints=workingBounds.map(cameraFrame(buildingCamera,buildingCamera.width,buildingCamera.height,+building.frame).world);assert.deepEqual(workingBounds,JSON.parse(building.projectPhysicalBounds),`${id}: source and runtime use the same funded physical footprint`);assert(+building.projectVertices>0,`${id}: construction has geometry`);assert(buildingCamera.zoom>1&&buildingPoints.every(p=>p.visible&&p.x>=0&&p.x<=buildingCamera.width&&p.y>=0&&p.y<=buildingCamera.height),`${id}: construction frames the complete authored working place above overview scale`);
 // Held local previews retain their selected parent nameplate. Camera-led
 // tours remain quiet. In either case, labels must leave the actual build clear.
 const buildVolume=projectLabelVolume(buildingPoints),buildLabels=await page.locator('.map-project:visible').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {initiative:e.dataset.initiative,district:e.dataset.district,child:e.dataset.child,proposal:e.dataset.proposal,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom}};}));
 assert(buildVolume,`${id}: construction has a physical projected silhouette`);
 const labelsClear=buildLabels.length<2&&buildLabels.every(l=>building.eventCameraOwned==='false'&&l.initiative===id&&l.district==='esil'&&l.child==='false'&&l.proposal==='false'&&!overlapsPhysical(buildVolume.outline,l.rect));
 if(!labelsClear){await page.screenshot({path:`${out}/${id}-construction-label-failure.png`});await writeFile(`${out}/${id}-construction-label-failure.json`,JSON.stringify({building,buildingPoints,buildVolume,buildLabels},null,2)+'\n');}
 assert(labelsClear,`${id}: selected labels leave physical construction visible`);await page.screenshot({path:`${out}/${id}-build.png`});
 await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.choreography==='idle');await page.screenshot({path:`${out}/${id}-macro.png`});
 await cameraControls(page);await page.getByRole('button',{name:'Обзор города',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.zoom==='1.000');await page.locator(`.map-project[data-initiative=${id}][data-district=esil][data-child=false]`).click();await page.getByTestId('program-inspection').waitFor();await page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.camera||!d.target)return false;const c=JSON.parse(d.camera),t=JSON.parse(d.target);return ['x','y','yaw','pitch','zoom'].every(k=>Math.abs(c[k]-t[k])<.0001);});await page.screenshot({path:`${out}/${id}-close.png`});
 const data=await page.getByTestId('city-map').evaluate(e=>({...e.dataset})),camera=JSON.parse(data.camera),frame=cameraFrame(camera,camera.width,camera.height,+data.frame),bounds=JSON.parse(data.projectPhysicalBounds),points=bounds?.map(frame.world);assert.equal(errors.length,0,`${id}: browser exceptions`);assert(+data.projectVertices>0,`${id}: visible project geometry`);assert(camera.zoom>1&&points?.length&&points.every(p=>p.visible&&p.x>=0&&p.x<=camera.width&&p.y>=0&&p.y<=camera.height),`${id}: inspection frames the full physical working place`);assert.equal(JSON.parse(data.interventions).length,citywide?5:1,`${id}: correct scope`);assert.equal(await page.getByTestId('decision-count').innerText(),'1 из 5');assert.equal(await page.getByTestId('held-project').count(),0,`${id}: marker inspection is read only`);assert.equal(data.preview,'',`${id}: inspection does not prepare a replacement`);const remaining=await page.getByTestId('remaining-budget').innerText();await page.getByTestId('program-inspection').getByRole('button',{name:'Изменить решение',exact:true}).click();await page.getByTestId('held-project').waitFor();assert.equal(await page.getByTestId('remaining-budget').innerText(),remaining,`${id}: explicit edit preserves the fixed committed cost`);assert.equal(await page.getByTestId('decision-count').innerText(),'1 из 5',`${id}: explicit edit preserves the accepted decision`);report.push({id,errors,data,buildLabels,buildVolume});console.log(id,errors.length?'ERROR '+errors.join(','):'rendered');await page.close();await context.close();await rename(await page.video().path(),`${out}/${id}-construction.webm`);
}
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
