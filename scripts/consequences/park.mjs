import {chromium} from 'playwright';
import {skipDemonstration,chooseProject,chooseDistrict,confirmProject} from '../integration/ui.mjs';
import {placements,programSites} from '../../src/world/project-objects.js';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const id=process.argv[2]||'M4',label=id==='M4'?'park':'bus',out=process.env.RELEASE_OUTPUT||'artifacts/consequences',browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
await mkdir(out,{recursive:true});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}}),page=await context.newPage();
try{
const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.APP_URL||'http://127.0.0.1:4174');await page.locator('[data-ready=true]').waitFor();await skipDemonstration(page);
await chooseProject(page,id);await chooseDistrict(page,'esil');await page.waitForTimeout(800);assert.equal(await page.getByTestId('city-map').getAttribute('data-choreography'),'idle');assert.equal(await page.getByTestId('remaining-budget').innerText(),'100');
await confirmProject(page,{openResult:false});
const samples=[];for(let i=0;i<28;i++){await page.waitForTimeout(500);const d=await page.getByTestId('city-map').evaluate(e=>({...e.dataset}));samples.push(d);if(i===9||i===15||i===25)await page.screenshot({path:`${out}/${label}-${i}.png`});}
assert.equal(await page.getByTestId('remaining-budget').innerText(),id==='M4'?'85':'82');assert.equal(await page.getByTestId('decision-count').innerText(),'1 из 5');assert.equal(samples.at(-1).choreography,'idle');assert(Number(samples.at(-1).zoom)>1,'The completed program holds its working place');
const site=placements[id+':esil'],places=[site,...programSites(site)];
if(id==='M4'){const areas=places.filter(s=>s.kind==='park-area'),occupied=samples.filter(s=>s.choreography==='people'&&+s.programVertices>0&&+s.projectVertices>0);assert(areas.length>0&&areas.every(s=>s.peopleSpots.length>0&&s.items.some(q=>q.kind==='seating')),'The full source parks retain authored native gathering places');assert(occupied.length>1&&+occupied.at(-1).programSeconds>+occupied[0].programSeconds+.1,'The occupied source-area view uploads program geometry and advances its activity clock');}
else assert(samples.some(s=>{if(s.choreography!=='people')return false;const c=JSON.parse(s.camera),nearest=places.slice().sort((a,b)=>Math.hypot(a.origin[0]-c.x,a.origin[1]-c.y)-Math.hypot(b.origin[0]-c.x,b.origin[1]-c.y))[0],population=Math.min(8,nearest.peopleSpots?.length??8),actors=JSON.parse(s.actors);return population>0&&actors.length===population&&new Set(actors.map(a=>a.id)).size===population;}),'The authored working-site native cast inhabits the accepted construction');
assert(samples.every(s=>JSON.stringify(JSON.parse(s.camera))===JSON.stringify(JSON.parse(s.renderCamera))),'Camera and renderer share every physical frame');assert.equal(errors.length,0);
await writeFile(`${out}/${label}-report.json`,JSON.stringify({errors,samples},null,2));console.log(label,'sequence passes: fixed cost, no preview cinematic, authored occupation, completed working-place hold.');

}finally{await context.close();await browser.close();}
