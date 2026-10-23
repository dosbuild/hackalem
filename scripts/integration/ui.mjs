import {writeFile} from 'node:fs/promises';

/** Public actions for the five-choice game. Drafts are read only by assertions. */
export async function skipDemonstration(page){
 const demo=page.getByTestId('school-demonstration');
 if(await demo.count())await demo.getByRole('button',{name:/Skip demonstration|Now my city/}).click();
 await page.locator('[data-demo=off]').waitFor();
}
export async function openOutcome(page){
 if(!await page.getByTestId('outcome-sheet').count())await page.getByRole('navigation',{name:'Alem spaces'}).getByRole('button',{name:/^(Outcome|Chronicle)$/}).click();
 await page.getByTestId('outcome-sheet').waitFor();
}
/** Legacy journeys inspect the result after their fifth confirmation through its public action. */
export async function confirmProject(page,{openResult=true}={}){
 await page.getByTestId('held-project').locator('.button-row .primary').click();
 if(openResult&&await page.getByTestId('decision-count').innerText()==='5 of 5')await openOutcome(page);
}
export async function openCatalogue(page){
 if(await page.locator('#aya-dialogue').count())await page.getByRole('button',{name:'Minimise the conversation with Aya'}).click();
 if(!await page.locator('.catalogue-sheet').count()){
  await page.locator('[data-toggle="planning"]').click();
 }
 await page.locator('.catalogue-sheet').waitFor();
}
export async function chooseProject(page,id){
 await openCatalogue(page);
 await page.locator(`.project-choice[data-project="${id}"]`).click();
 await page.getByTestId('held-project').waitFor();
}
/** Changing place on a phone uses the visible details control first. */
export async function chooseDistrict(page,id){
 const select=page.getByTestId('held-project').locator('select');
 if(await select.inputValue()===id)return;
 if(!await select.isVisible()){
  const expand=page.locator('.sheet-toggle');
  if(await expand.getAttribute('aria-expanded')==='false')await expand.click();
  await select.waitFor({state:'visible'});
 }
 await select.selectOption(id);
}
/** This adapter retains the old contract: dashboard means the complete book. */
export async function navigate(page,name){
 const historical=await page.locator('html').getAttribute('data-mode')==='khanate';
 const labels={map:'City',residents:historical?'Petitions':'Residents',dashboard:historical?'Chronicle':'Outcome'};
 await page.getByRole('navigation',{name:'Alem spaces'}).getByRole('button',{name:labels[name]||name,exact:true}).click();
 if(name==='dashboard'&&await page.getByTestId('outcome-sheet').count())await page.getByTestId('outcome-sheet').getByRole('button',{name:/^Detailed results/}).click();
 if(name==='dashboard')await page.getByRole('navigation',{name:'Dashboard sections'}).waitFor();
}
export async function openTools(page){
 await openCatalogue(page);
 const tools=page.locator('.plan-tools');if(await tools.getAttribute('open')===null)await tools.locator('summary').click();
}
export async function cameraControls(page){const settings=page.getByRole('button',{name:'Adjust camera',exact:true});if(await settings.getAttribute('aria-expanded')==='false')await settings.click();}
export const projectEncounter=page=>page.getByTestId('resident-layer');
export async function nextDecision(page){
 if(await projectEncounter(page).count())await projectEncounter(page).getByRole('button',{name:/^Return/}).click();
 const next=page.getByRole('button',{name:/^Next decision/});if(await next.count())await next.click();
 await page.getByTestId('decision-deck').waitFor();
}

const versions=new WeakMap();
/** Label evidence using the actual visible world and the served build manifest. */
export async function artifactContext(page){
 let version=versions.get(page);
 if(!version){
  try{const response=await page.request.get(new URL('version.json',page.url()).href);version=response.ok()?await response.json():{};}catch{version={};}
  versions.set(page,version);
 }
 const surface=await page.evaluate(()=>({world:document.documentElement.dataset.mode??'unknown',development:!!document.querySelector('script[src*="/@vite/client"]'),viewport:{width:innerWidth,height:innerHeight},context:document.querySelector('.city-application')?.getAttribute('data-context')??null}));
 return {world:surface.world,build:version.delivery??(surface.development?'development':'unknown'),url:page.url(),capturedAt:new Date().toISOString(),viewport:surface.viewport,context:surface.context};
}
export async function captureFrame(page,path,report){
 const metadata=await artifactContext(page);await page.screenshot({path});await writeFile(`${path}.json`,JSON.stringify(metadata,null,2)+'\n');
 if(report){report.artifacts??=[];report.artifacts.push({path,...metadata});report.environment??={};Object.assign(report.environment,{world:metadata.world,build:metadata.build});}
}
export async function labelVideo(page,path,report){
 const metadata=await artifactContext(page);await writeFile(`${path}.json`,JSON.stringify({...metadata,type:'continuous-ui-recording'},null,2)+'\n');
 if(report){report.recordings??=[];report.recordings.push({path,...metadata});}
}
