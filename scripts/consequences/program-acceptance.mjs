/**
 * Production acceptance for the authored programs in both worlds.
 *
 * APP_URL=http://127.0.0.1:4174 RELEASE_OUTPUT=artifacts/program-acceptance
 *   node scripts/consequences/program-acceptance.mjs
 *
 * --prepare-only validates real five-decision fixtures and model contracts without
 * opening a browser. Default execution is sequential, including fresh public UX
 * contexts. Fixtures save drafts only; the application computes every result.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {stripTypeScriptTypes} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {skipDemonstration,chooseProject,chooseDistrict,confirmProject,artifactContext,captureFrame} from '../integration/ui.mjs';
import * as astana from '../../src/world/project-objects.js';
import * as khanate from '../../src/world/khanate/projects.js';
import {astanaPrograms,junctionSnapshot,baselineJunctionSnapshot,trafficPhase,crossingSnapshot,boardingSnapshot,PROGRAM_METRE} from '../../src/world/astana-programs.js';
import {programCrossingCycle,programCrossingCartPose} from '../../src/world/khanate/programs.js';
import {collectProgramSites} from '../../src/world/program-runtime.js';
import {pointSegment} from '../../src/world/placement-geometry.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const modes=['astana','khanate'];
const sizes=[[1440,900],[1366,768],[390,844],[360,640],[540,360]];
const ids=Array.from({length:14},(_,i)=>'M'+(i+1));
const districtIds=['esil','almaty','saryarka','baikonur','nura'];
const publicPlan=[
 {initiativeId:'M4',scope:'district',districtId:'esil'},
 {initiativeId:'M1',scope:'district',districtId:'almaty'},
 {initiativeId:'M8',scope:'district',districtId:'nura'},
 {initiativeId:'M10',scope:'district',districtId:'saryarka'},
 {initiativeId:'M14',scope:'citywide'},
];
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const format=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
const draftKey=mode=>mode==='astana'?'akim:draft':'alem:khanate:akim:draft';
const presentationKey=mode=>mode==='astana'?'alem:presentation:v1':'alem:khanate:alem:presentation:v1';
const geometryRequest=url=>/^\/(?:alem|khanate)\/(?:map|facades)-[a-f0-9]{20}\.bin(?:\.gz)?$/.test(new URL(url).pathname);
const cameraKeys=['x','y','yaw','pitch','zoom'];

/** Compile unchanged domain sources in a temporary ESM directory, independently
 * of the served application's bundled evaluator. No source or API is modified. */
export async function loadDomain(){
 const temp=await mkdtemp(join(tmpdir(),'alem-program-evaluator-'));
 try{
  await writeFile(join(temp,'package.json'),'{"type":"module"}\n');
  for(const name of (await readdir(join(root,'src/domain'))).filter(n=>n.endsWith('.ts'))){
   const source=await readFile(join(root,'src/domain',name),'utf8');
   const output=stripTypeScriptTypes(source,{mode:'strip'})
    .replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,(_all,a,b,c)=>a+b+(b.endsWith('.js')?'':'.js')+c);
   await writeFile(join(temp,name.replace(/\.ts$/,'.js')),output);
  }
  const evaluator=await import(pathToFileURL(join(temp,'evaluate.js')).href);
  const scenario=await import(pathToFileURL(join(temp,'scenario.js')).href);
  return {...evaluator,...scenario,dispose:()=>rm(temp,{recursive:true,force:true})};
 }catch(error){await rm(temp,{recursive:true,force:true});throw error;}
}

export function buildFixturePlans(domain){
 return ids.map(id=>{
  const target=domain.INITIATIVES[id],districtId=id==='M7'?'nura':'esil';
  const decision={initiativeId:id,scope:target.scope,...(target.scope==='district'?{districtId}:{})};
  const candidates=domain.CATALOGUE.filter(i=>i.id!==id).sort((a,b)=>a.cost-b.cost||Number(a.id.slice(1))-Number(b.id.slice(1)));
  let selected=null;
  const search=(start,plan)=>{
   if(plan.length===5){const evaluated=domain.evaluatePlan(plan);if(evaluated.ok)selected={id,districtId,plan,result:evaluated.result};return;}
   for(let i=start;i<candidates.length&&!selected;i++){
    const initiative=candidates[i],place=districtIds[(i+1)%districtIds.length];
    search(i+1,[...plan,{initiativeId:initiative.id,scope:initiative.scope,...(initiative.scope==='district'?{districtId:place}:{})}]);
   }
  };
  search(0,[decision]);assert(selected,`No valid complete fixture for ${id}`);return selected;
 });
}

async function loadWorlds(){
 const [modern,historical]=await Promise.all(['astana','khanate'].map(async mode=>{
  const name=mode==='astana'?'src/world/bootstrap.json':'src/world/khanate/bootstrap.json';
  const bootstrap=JSON.parse(await readFile(join(root,name),'utf8'));
  return {mode,projects:mode==='astana'?astana:khanate,districts:bootstrap.districts.features};
 }));
 return {astana:modern,khanate:historical};
}

function recordCheck(report,section,name,ok,details){
 report.checks.push({section,name,ok:!!ok,...(details===undefined?{}:{details})});
 assert(ok,`${section}: ${name}`);console.log('PASS',section,name);
}
const propsFor=(fixture,position=1)=>({commitments:fixture.plan,candidate:null,scenarioRevision:7,result:{revision:7,value:fixture.result},comparisonPosition:position});
function sitesFor(world,objects){return collectProgramSites(objects,world.projects.programSites);}

/** Source/model assertions cover every district, while browser fixtures below
 * cover one real evaluated five-decision scene for each initiative and world. */
export function modelCoverage(report,worlds,fixtures,domain){
 const check=(name,ok,details)=>recordCheck(report,'model',name,ok,details);
 const expectedParks={esil:['1196402246','1456208624'],almaty:['243930491','243930492','243930493'],saryarka:['885788799','885788800','885788801'],baikonur:['1428964223','500220321'],nura:['1526900307','1534678435']};
 report.modelCoverage=[];
 for(const mode of modes){
  const world=worlds[mode],keys=new Set(),programs=[];
  for(const id of ids)for(const districtId of districtIds){
   const scope=domain.INITIATIVES[id].scope;
   const decision={initiativeId:id,scope,...(scope==='district'?{districtId}:{})};
   const parent=world.projects.projectObjects({commitments:[decision],scenarioRevision:0},world.districts).find(o=>o.district===districtId);
   const original=world.projects.placements[id+':'+districtId],children=world.projects.programSites(parent);
   assert.deepEqual(parent.origin,original.origin,`${mode} ${parent.key} original encounter origin`);
   assert.deepEqual(parent.peopleSpots,original.peopleSpots,`${mode} ${parent.key} original resident origins`);
   assert(parent.program,`${mode} ${parent.key} rich program metadata`);
   for(const child of children){
    assert(child.id===id&&child.district===districtId&&child.parentKey===parent.key,`${mode} ${child.key} scoped identity`);
    assert(!keys.has(child.key),`${mode} duplicate child ${child.key}`);keys.add(child.key);
    assert(child.peopleSpots?.length>0,`${mode} ${child.key} occupied, checked site`);
    assert(world.projects.projectFocusBounds(child)?.every(p=>p.every(Number.isFinite)),`${mode} ${child.key} finite physical focus`);
   }
   if(id==='M8'){
    const satellites=children.filter(s=>s.key!==parent.key);
    assert.equal(satellites.length,3,`${mode} ${parent.key} exactly three satellite facilities`);
    for(const site of satellites){
     assert.equal(site.origin[2],mode==='astana'?.00004:.00006,`${mode} ${site.key} source ground`);
     assert(site.peopleSpots.every(s=>Math.abs(s.position[2]-site.origin[2])<1e-9),`${mode} ${site.key} grounded waiting residents`);
     if(mode==='astana'){
      assert.deepEqual(site.buildingSize,[24,18]);assert.deepEqual(site.size,[40*PROGRAM_METRE,36*PROGRAM_METRE]);
      assert(site.separationMetres>=400&&site.approach?.source?.startsWith('way/')&&site.residentialSource,`${site.key} residential cluster and checked approach`);
     }else assert(site.kind==='treatment-court'&&site.source.startsWith('household-court:')&&site.approach.length>1,`${site.key} inhabited treatment court`);
    }
   }
   if(mode==='astana'&&id==='M4'){
    assert.deepEqual(children.map(s=>s.source.split('/')[1]),expectedParks[districtId]);
    for(const site of children){assert(site.rings[0].length>3&&site.items.length>10);assert.equal(new Set(site.items.map(i=>i.kind)).size,4);assert(site.items.every(i=>i.point[2]===.00004));}
   }
   programs.push({key:parent.key,scope,source:parent.source,childCount:children.filter(s=>s.key!==parent.key).length,locations:sitesFor(world,[parent]).map(s=>({key:s.key,source:s.source,kind:s.kind,origin:s.origin}))});
  }
  check(`${mode}: all 70 original program anchors, scopes, navigable places and occupied clinic networks`,programs.length===70,{programs:70,uniqueProgramSites:keys.size});
  report.modelCoverage.push({mode,programs});
  for(const fixture of fixtures){
   const serialized=JSON.stringify(fixture.result),after=world.projects.projectObjects(propsFor(fixture),world.districts),before=world.projects.projectObjects(propsFor(fixture,0),world.districts);
   const target=after.filter(o=>o.id===fixture.id),local=domain.INITIATIVES[fixture.id].scope==='district';
   assert.equal(target.length,local?1:5,`${mode} ${fixture.id} funded scope`);
   assert.deepEqual([...new Set(target.map(o=>o.district))].sort(),(local?[fixture.districtId]:districtIds).slice().sort());
   for(const parent of target){
    const ledger=fixture.result.indicatorEvidence.filter(row=>row.districtId===parent.district&&[...row.measureEffects,...row.synergies].some(effect=>effect.initiativeIds.includes(parent.id)));
    assert.deepEqual(parent.evidence,ledger,`${mode} ${parent.key} exact evaluator ledger`);assert.equal(parent.resultId,fixture.result.resultId);
   }
   const options={zoom:45,seconds:4,reducedMotion:true,scale:14580};
   const infrastructure=world.projects.projectStaticMesh(target,options);
   const baseline=world.projects.projectStaticMesh(before.filter(o=>o.id===fixture.id),options);
   const later=world.projects.projectStaticMesh(target,{...options,seconds:22});
   assert.equal(baseline.byteLength,0);assert(infrastructure.byteLength>0);assert(Buffer.from(infrastructure).equals(Buffer.from(later)));
   const use=world.projects.projectDynamicMesh(target,false,options),quiet=world.projects.projectDynamicMesh(target,false,{...options,seconds:22});
   assert(Buffer.from(use).equals(Buffer.from(quiet)),`${mode} ${fixture.id} reduced-motion pose`);
   // These are the existing program test budgets, not new relaxed thresholds.
   if(mode==='astana'&&['M4','M8','M2','M1','M5','M11','M14'].includes(fixture.id))assert(use.byteLength<4*1024*1024);
   if(mode==='khanate'&&fixture.id==='M2')assert(use.byteLength<3000000);
   assert.equal(JSON.stringify(fixture.result),serialized,`${mode} ${fixture.id} rendering leaves exact score/contributions unchanged`);
   check(`${mode} ${fixture.id}: physical delivered kit, exact ledger and frozen bounded use`,true,{parents:target.length,staticBytes:infrastructure.byteLength,dynamicBytes:use.byteLength,resultId:fixture.result.resultId,ledgerHash:hash(fixture.result.indicatorEvidence)});
  }
 }
 let junctions=0,pedestrianFrames=0,baselineDifferent=0;
 for(const district of districtIds){const sites=astanaPrograms['M2:'+district].sites;assert.equal(sites.length,3);
  for(const site of sites){junctions++;let queued=false,released=false,pedestrians=false;
   for(let second=0;second<80;second+=.25){
    const phase=junctionSnapshot(site,second);assert(new Set(phase.vehicles.filter(v=>v.green).map(v=>v.axis)).size<=1);
    queued ||=phase.vehicles.some(v=>v.stopped);released ||=phase.vehicles.some(v=>!v.stopped);
    if(phase.axis==='pedestrian'){pedestrians=true;pedestrianFrames++;assert(phase.vehicles.every(v=>v.stopped&&!v.insideJunction));}
   }
   assert(queued&&released&&pedestrians);if(hash(baselineJunctionSnapshot(site,8))!==hash(junctionSnapshot(site,8)))baselineDifferent++;
  }
 }
 assert.deepEqual([trafficPhase(13).departingAxis,trafficPhase(29).departingAxis],['east-west','north-south']);
 check('Astana M2: exactly three vetted junctions in every district, opposing release safety, departing amber and protected pedestrian phase',junctions===15&&baselineDifferent===15,{junctions,pedestrianFrames,baselineDifferent});
 const independentRoutes=Object.values(astana.placements).filter(p=>['M1','M14'].includes(p.id)),separations=[];
 for(const district of districtIds)for(const site of astanaPrograms['M2:'+district].sites){
  let nearest={metres:Infinity};
  for(const route of independentRoutes)for(let i=1;i<route.route.length;i++){
   const metres=pointSegment(site.origin,route.route[i-1],route.route[i])/PROGRAM_METRE;
   if(metres<nearest.metres)nearest={junction:site.key,route:route.key,metres};
  }
  separations.push(nearest);
 }
 // The active crossing sits 15 m from the junction; the native bus lane has
 // a 1.7 m lateral offset and a 10.8 m body. Check a conservative 26 m radius.
 check('independent M1/M14 traffic routes clear every timed M2 conflict zone',separations.every(s=>s.metres>26),{nearest:separations.slice().sort((a,b)=>a.metres-b.metres)[0],junctions:separations});
 for(let second=0;second<72;second+=.25){const cycle=programCrossingCycle(second);assert(!(cycle.cartOpen&&cycle.herdOpen));if(cycle.allWaiting)assert(!cycle.cartOpen&&!cycle.herdOpen);}
 for(const boundary of [13,17,30,36]){const a=programCrossingCartPose(boundary-1e-5),b=programCrossingCartPose(boundary+1e-5);assert(Math.hypot(a.point[0]-b.point[0],a.point[1]-b.point[1])<.0001);}
 check('Khanate M2: cart and herd releases exclude one another and retain clearance waits',true,{cycleSeconds:36});
 assert(crossingSnapshot(2,true).speed<crossingSnapshot(2,false).speed);assert(crossingSnapshot(8,true).pedestrian&&crossingSnapshot(8,true).stopped);
 const routeParent=astana.projectObjects({commitments:[{initiativeId:'M1',scope:'district',districtId:'esil'}]},worlds.astana.districts)[0],buses=boardingSnapshot(routeParent,0);
 assert.deepEqual([...new Set(buses.map(b=>b.side))].sort(),[-1,1]);assert(buses.some(b=>b.stopped));assert.notEqual(hash(buses),hash(boardingSnapshot(routeParent,8)));
 check('Astana M1 and M11: two-way checked-stop boarding and slower yielding crossings',true);
}

const mapData=page=>page.getByTestId('city-map').evaluate(element=>({...element.dataset}));
async function settle(page){
 await page.waitForFunction(()=>{
  const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.camera||!d.target||d.camera!==d.renderCamera)return false;
  const a=JSON.parse(d.camera),b=JSON.parse(d.target);return ['x','y','yaw','pitch','zoom'].every(key=>Math.abs(a[key]-b[key])<1e-6)&&d.choreography==='idle';
 });
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function ready(page,mode,report,{settleCamera=true}={}){
 await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');
 await skipDemonstration(page);if(settleCamera)await settle(page);
 const build=await artifactContext(page),data=await mapData(page);
 recordCheck(report,'browser',`${mode}: identified production build and complete resident world`,build.world===mode&&['connected','static'].includes(build.build)&&data.completeCity==='true'&&+data.residentTiles===+data.expectedTiles&&+data.drawCount>0,{build,residentBuildings:+data.residentBuildings,residentTiles:+data.residentTiles});
 return {build,buildings:data.residentBuildings,tiles:data.residentTiles,templates:data.gpuTemplates,placementBuffers:data.gpuPlacementBuffers};
}
async function expectResult(page,result){
 await page.waitForFunction(expected=>{
  const d=document.querySelector('[data-testid=city-map]')?.dataset,r=d?.presentationResult&&JSON.parse(d.presentationResult);
  return r&&r.resultId===expected.resultId&&r.planFingerprint===expected.planFingerprint&&r.finalScore===expected.finalScore;
 },{resultId:result.resultId,planFingerprint:result.planFingerprint,finalScore:result.finalScore});
}
function equalCamera(a,b){return cameraKeys.every(key=>Math.abs(JSON.parse(a.camera)[key]-JSON.parse(b.camera)[key])<1e-7);}
function equalResult(a,b){return a.presentationResult===b.presentationResult;}
async function draft(page,mode){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),draftKey(mode));}
async function city(page){await page.getByRole('navigation',{name:'Alem spaces'}).getByRole('button',{name:'City',exact:true}).click();await settle(page);}
async function inspectFunded(page,plan,id){
 await page.locator('[data-toggle=treasury]').click();await page.getByTestId('treasury-sheet').waitFor();
 await page.locator('.treasury-plan li button').nth(plan.findIndex(d=>d.initiativeId===id)).click();await page.getByTestId('program-inspection').waitFor();await settle(page);
}
async function visitChild(page,child,world){
 const locations=page.locator('.program-locations');
 if(await locations.getAttribute('open')===null)await locations.locator('summary').click();
 const districtName=world.districts.find(d=>d.id===child.district)?.properties.name;
 assert(districtName,`${child.key} authored district name`);
 let button=locations.locator('li button').filter({has:page.locator('strong').and(page.getByText(child.label,{exact:true}))});
 if(await button.locator('small').count())button=button.filter({has:page.locator('small').and(page.getByText(districtName,{exact:true}))});
 assert.equal(await button.count(),1,`${child.key} unique public location action`);
 await button.scrollIntoViewIfNeeded();await button.click();await settle(page);
 assert.equal(await button.getAttribute('aria-pressed'),'true',`${child.key} selected place`);
 await page.waitForFunction(({key,id,district,siteId})=>{
  const view=JSON.parse(localStorage.getItem(key)||'null')?.view;
  return view?.kind==='inspection'&&view.initiativeId===id&&view.districtId===district&&view.siteId===siteId;
 },{key:presentationKey(world.mode),id:child.id,district:child.district,siteId:child.key});
 assert.equal(await page.locator('.inspection-meta>span').innerText(),`${districtName} · ${child.label}`,`${child.key} visible scoped place identity`);
 const exposure=await selectedExposure(page,world,child);
 assert(exposure.visible,`${child.key} checked physical focus fits the exposed map: ${JSON.stringify(exposure)}`);
 return exposure;
}
function representative(world,fixture){
 const parent=world.projects.projectObjects(propsFor(fixture),world.districts).find(o=>o.id===fixture.id&&o.district===fixture.districtId);
 const children=world.projects.programSites(parent).filter(s=>s.key!==parent.key);
 if(['M2','M4','M6','M8'].includes(fixture.id))return {parent,child:children[0]};
 if(world.mode==='khanate'&&['M1','M3','M5','M10','M11'].includes(fixture.id))return {parent,child:children[0]};
 return {parent,child:null};
}
async function pixels(page){return hash(await page.locator('.alem-city').evaluate(canvas=>canvas.toDataURL()));}
async function sceneCapture(page,path,report,extra){
 const data=await mapData(page),metadata=await artifactContext(page),signature=await pixels(page);
 await page.locator('.alem-city').screenshot({path});
 await writeFile(path+'.json',JSON.stringify({...metadata,capture:'city-canvas',camera:JSON.parse(data.camera),light:+data.time,effectiveSeconds:+data.programSeconds,phase:data.scenePhase,comparisonFrozen:data.comparisonFrozen,result:JSON.parse(data.presentationResult),hash:signature,...extra},null,2)+'\n');
 report.artifacts.push({path,...metadata,...extra});return {data,hash:signature,path};
}
async function compareScene(page,world,fixture,report,out,reference){
 const label=world.mode+' '+fixture.id,check=(name,ok,details)=>recordCheck(report,'fixture',label+': '+name,ok,details);
 const locations=JSON.parse((await mapData(page)).programSites),expected=sitesFor(world,world.projects.projectObjects(propsFor(fixture),world.districts));
 assert.deepEqual(locations.map(s=>s.key).sort(),expected.map(s=>s.key).sort());
 for(const location of locations){const authored=expected.find(site=>site.key===location.key);assert.deepEqual(location.origin,authored.origin,`${label} ${location.key} physical origin`);assert.equal(location.source,authored.source,`${label} ${location.key} source provenance`);}
 const target=locations.filter(s=>s.id===fixture.id),local=fixture.plan.find(d=>d.initiativeId===fixture.id).scope==='district';
 check('runtime locations retain funded scope and complete program identity',target.length===expected.filter(s=>s.id===fixture.id).length&&new Set(target.map(s=>s.district)).size===(local?1:5),{locations:target});
 await inspectFunded(page,fixture.plan,fixture.id);
 const {parent,child}=representative(world,fixture);if(child)await visitChild(page,child,world);
 await city(page);await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.transition==='false');
 const comparison=page.getByRole('group',{name:'Compare the city before and after'});
 await comparison.getByRole('button',{name:'Before your decisions',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.scenePhase==='baseline'&&document.querySelector('[data-testid=city-map]')?.dataset.comparisonFrozen==='true');await settle(page);
 const before=await sceneCapture(page,join(out,`${world.mode}-${fixture.id}-before.png`),report,{category:'seeded-evaluated-fixture',initiativeId:fixture.id,siteId:child?.key??parent.key});
 await comparison.getByRole('button',{name:'Two years later',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.scenePhase==='evaluated'&&+document.querySelector('[data-testid=city-map]')?.dataset.programVertices>0);await settle(page);
 const after=await sceneCapture(page,join(out,`${world.mode}-${fixture.id}-after.png`),report,{category:'seeded-evaluated-fixture',initiativeId:fixture.id,siteId:child?.key??parent.key});
 check('before hides delivered infrastructure; after contains physical static geometry',+before.data.programVertices===0&&+after.data.programVertices>0,{beforeVertices:+before.data.programVertices,afterVertices:+after.data.programVertices});
 check('physical city pixels change at the same camera, light and comparison clock',before.hash!==after.hash&&equalCamera(before.data,after.data)&&before.data.time===after.data.time&&before.data.programSeconds===after.data.programSeconds&&after.data.comparisonFrozen==='true',{before:before.hash,after:after.hash,camera:JSON.parse(after.data.camera),light:after.data.time,clock:after.data.programSeconds});
 const result=JSON.parse(after.data.presentationResult);
 check('exact evaluated result identity and score survive both views',equalResult(before.data,after.data)&&result.resultId===fixture.result.resultId&&result.planFingerprint===fixture.result.planFingerprint&&result.finalScore===fixture.result.finalScore,{actual:result,ledgerHash:hash(fixture.result.indicatorEvidence)});
 const liveDraft=await draft(page,world.mode);assert.deepEqual(liveDraft.plan,fixture.plan);
 await comparison.getByRole('button',{name:'Before your decisions',exact:true}).click();await settle(page);
 await comparison.getByRole('button',{name:'Two years later',exact:true}).click();await settle(page);const repeated=await mapData(page),repeatPixels=await pixels(page);
 check('repeated frozen after view is pixel-identical and allocations remain bounded',repeatPixels===after.hash&&['gpuBufferBytes','gpuBuffers','gpuInkBytes','gpuShadowBytes','programVertices','gpuPlacementBuffers','gpuTemplates'].every(key=>repeated[key]===after.data[key]),{gpuBytes:+repeated.gpuBufferBytes,programVertices:+repeated.programVertices});
 check('populated scene retains complete city residency and original shared placement/template resources',repeated.completeCity==='true'&&repeated.residentBuildings===reference.buildings&&repeated.residentTiles===reference.tiles&&repeated.gpuTemplates===reference.templates&&repeated.gpuPlacementBuffers===reference.placementBuffers);
 const glError=await page.locator('.alem-city').evaluate(canvas=>canvas.getContext('webgl2').getError());check('no WebGL error',glError===0,{glError});
 report.fixtureCoverage.push({mode:world.mode,id:fixture.id,plan:fixture.plan,result:fixture.result,siteId:child?.key??parent.key,locations:target,before:{path:before.path,hash:before.hash},after:{path:after.path,hash:after.hash},data:after.data});
}

async function exposed(locator){return locator.evaluateAll(elements=>elements.map(element=>{
 const r=element.getBoundingClientRect(),clip={left:0,right:innerWidth,top:0,bottom:innerHeight};
 for(let p=element.parentElement;p;p=p.parentElement){const style=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(style.overflowX)){clip.left=Math.max(clip.left,b.left);clip.right=Math.min(clip.right,b.right);}if(/auto|scroll|hidden|clip/.test(style.overflowY)){clip.top=Math.max(clip.top,b.top);clip.bottom=Math.min(clip.bottom,b.bottom);}}
 // Keep full rectangular clip containment, but hit-test the actual rounded
 // shape rather than its transparent corners. Edge midpoints stay strict.
 const style=getComputedStyle(element),corner=value=>{const [x,y=x]=value.split(/\s+/),radius=(n,span)=>Math.min(span/2,parseFloat(n)*(n.endsWith('%')?span/100:1)||0);return [Math.max(2,radius(x,r.width)*(1-Math.SQRT1_2)+2),Math.max(2,radius(y,r.height)*(1-Math.SQRT1_2)+2)];};
 const tl=corner(style.borderTopLeftRadius),tr=corner(style.borderTopRightRadius),bl=corner(style.borderBottomLeftRadius),br=corner(style.borderBottomRightRadius),cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2;
 const points=[[r.left+tl[0],r.top+tl[1]],[r.right-tr[0],r.top+tr[1]],[r.left+bl[0],r.bottom-bl[1]],[r.right-br[0],r.bottom-br[1]],[cx,r.top+2],[cx,r.bottom-2],[r.left+2,cy],[r.right-2,cy],[cx,cy]],hits=points.map(([x,y])=>{const target=document.elementFromPoint(x,y);return {x,y,hit:target===element||element.contains(target),target:target?`${target.tagName.toLowerCase()}.${target.className?.baseVal??target.className}`:null};});
 return {name:element.getAttribute('aria-label')||element.textContent?.trim(),width:r.width,height:r.height,inside:r.left>=clip.left-.5&&r.right<=clip.right+.5&&r.top>=clip.top-.5&&r.bottom<=clip.bottom+.5,hit:hits.every(p=>p.hit),blocked:hits.filter(p=>!p.hit),rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},clip};
}));}
async function actions(page,report,label,selector,minTouch=true){
 const controls=await exposed(page.locator(selector));
 recordCheck(report,'public',label,controls.length>0&&controls.every(c=>c.inside&&c.hit&&(!minTouch||c.width>=44-.5&&c.height>=44-.5)),controls);return controls;
}
async function selectedExposure(page,world,child){
 const data=await mapData(page),camera=JSON.parse(data.camera);
 // Use the actual rendered projection values rather than a guessed world lens.
 const matrix=camera.matrix,scale=camera.projectionScale,perspective=camera.perspective;
 const points=world.projects.projectFocusBounds(child).map(p=>{const v=[p[0]-camera.x,p[1]-camera.y,p[2]||0],q=[0,1,2].map(axis=>matrix[axis]*v[0]+matrix[axis+3]*v[1]+matrix[axis+6]*v[2]),w=1-q[2]*perspective;return {x:camera.width/2+q[0]*scale/w,y:camera.height/2-q[1]*scale/w,visible:w>.015};});
 const box={left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
 const blockers=await page.locator('[data-occludes-city]:visible').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {name:e.getAttribute('aria-label')||e.className,left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
 return {siteId:child.key,camera,box,blockers,visible:points.every(p=>p.visible&&Number.isFinite(p.x)&&Number.isFinite(p.y))&&box.left>=0&&box.right<=camera.width&&box.top>=0&&box.bottom<=camera.height&&!blockers.some(r=>Math.min(box.right,r.right)>Math.max(box.left,r.left)&&Math.min(box.bottom,r.bottom)>Math.max(box.top,r.top))};
}

/** Public child inspection -> conversation -> reload -> City. Only the final
 * recovery probe writes a presentation bookmark; it never writes a plan/result. */
async function childConversationJourney(page,mode,size,world,child,result,report,out,entry){
 const [width,height]=size,label=`${mode} ${width}×${height}`,anchorId='program:'+child.key,key=presentationKey(mode),storyId=(mode==='astana'?'story-':'khanate-story-')+'nura-M8';
 const planBefore=(await draft(page,mode)).plan,exactResult=(await mapData(page)).presentationResult;
 const canonicalLabel=await page.getByTestId('program-inspection').locator('#inspection-title').innerText();
 const check=(section,name,ok,details)=>recordCheck(report,section,label+': '+name,ok,details);
 const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),key);
 const capture=async name=>{const path=join(out,`${mode}-public-${width}x${height}-${name}.png`);await captureFrame(page,path,report);entry.captures.push(path);return path;};
 const identity=async()=>{
  await page.getByTestId('resident-layer').waitFor();
  await page.waitForFunction(({anchorId,storyId})=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return d?.anchor===anchorId&&d.resident===storyId;},{anchorId,storyId});await settle(page);
  const data=await mapData(page),saved=await stored(),visibleLabel=await page.getByTestId('resident-layer').locator('.conversation-heading span').innerText(),position=JSON.parse(data.residentPosition),viewport=page.viewportSize();
  check('public-child-conversation','conversation retains exact child anchor, visible label and native waiting-place camera',data.anchor===anchorId&&data.resident===storyId&&saved.view.kind==='encounter'&&saved.view.anchor.id===anchorId&&saved.view.anchor.label===child.label&&visibleLabel.endsWith(' · '+child.label)&&child.peopleSpots.some(spot=>Math.hypot(...spot.position.map((value,i)=>value-position[i]))<1e-6)&&+data.residentX>=0&&+data.residentX<=viewport.width&&+data.residentY>=0&&+data.residentY<=viewport.height,{anchorId,visibleLabel,position,camera:JSON.parse(data.camera)});
  check('public-child-conversation','conversation preserves the complete funded plan and exact evaluated result',hash((await draft(page,mode)).plan)===hash(planBefore)&&data.presentationResult===exactResult&&await page.getByTestId('held-project').count()===0&&await page.getByTestId('remaining-budget').innerText()==='19'&&await page.getByTestId('resident-layer').locator('.resident-evidence').getAttribute('data-result-id')===result.resultId);
  return {data,saved,visibleLabel};
 };
 const closeToCity=async(before,step)=>{
  await city(page);await page.waitForTimeout(350);await settle(page);
  const data=await mapData(page),presentation=await stored();
  check('public-child-conversation',step+': City retains the current conversation camera and clears the return inspector',equalCamera(before,data)&&presentation.view.kind==='city'&&presentation.returnTo===null&&await page.getByTestId('resident-layer').count()===0&&await page.getByTestId('program-inspection').count()===0,{before:JSON.parse(before.camera),after:JSON.parse(data.camera)});
  return data;
 };
 const inspected=await stored(),inspectionCamera=await mapData(page);
 assert(inspected.view.kind==='inspection'&&inspected.view.siteId===child.key&&inspected.view.initiativeId===child.id&&inspected.view.districtId===child.district,`${label} public inspection selects the conversation child`);
 await page.getByTestId('program-inspection').getByRole('button',{name:'Meet residents',exact:true}).click();
 const opened=await identity();
 check('public-child-conversation','visible inspection action sends the camera to the same physical child',opened.saved.view.anchor.id===anchorId&&opened.saved.view.anchor.label===child.label&&/^\d+$/.test(opened.data.cameraRequest)&&opened.data.cameraRequest!==inspectionCamera.cameraRequest,{siteId:inspected.view.siteId,anchorId:opened.saved.view.anchor.id,beforeRequest:inspectionCamera.cameraRequest,afterRequest:opened.data.cameraRequest});
 const openedCapture=await capture('child-conversation');
 await closeToCity(opened.data,'direct public conversation');const directCityCapture=await capture('child-conversation-city-direct');
 await inspectFunded(page,publicPlan,'M8');await visitChild(page,child,world);
 await page.getByTestId('program-inspection').getByRole('button',{name:'Meet residents',exact:true}).click();await identity();
 await page.reload();await ready(page,mode,report);await expectResult(page,result);
 const restored=await identity(),reloadCapture=await capture('child-conversation-reload');
 check('public-child-conversation','reload restores the same child label, resident and scoped bookmark',restored.saved.view.residentId===opened.saved.view.residentId&&restored.saved.view.storyId===opened.saved.view.storyId&&restored.saved.view.anchor.id===opened.saved.view.anchor.id&&restored.saved.view.anchor.label===opened.saved.view.anchor.label&&restored.visibleLabel===opened.visibleLabel,{before:opened.saved.view,after:restored.saved.view});
 const closed=await closeToCity(restored.data,'reloaded child conversation');
 const cityCapture=await capture('child-conversation-city');
 // These IDs are grammatical for their own world, but absent from the native
 // program catalogue. Keep the genuine resident/story and authoritative draft.
 const missing=mode==='astana'?'program:M8:nura:clinic-satellite-999':'program:M8:nura@999';
 assert(!JSON.parse(closed.programSites).some(site=>'program:'+site.key===missing));
 const bookmark={view:{...restored.saved.view,anchor:{...restored.saved.view.anchor,id:missing,label:'Unavailable programme site'}},returnTo:null};
 await page.evaluate(({key,bookmark})=>localStorage.setItem(key,JSON.stringify(bookmark)),{key,bookmark});await page.reload();await ready(page,mode,report);await expectResult(page,result);
 await page.waitForFunction(({key,storyId})=>{const d=document.querySelector('[data-testid=city-map]')?.dataset,p=JSON.parse(localStorage.getItem(key)||'null');return d?.anchor==='scenario:M8:nura'&&d.resident===storyId&&p?.view.anchor?.id==='scenario:M8:nura';},{key,storyId});await settle(page);
 const recovered=await mapData(page),recoveredPresentation=await stored(),recoveredLabel=await page.getByTestId('resident-layer').locator('.conversation-heading span').innerText();
 check('saved-presentation-recovery','unknown grammatical child recovers to the same canonical resident and authored place',recovered.anchor==='scenario:M8:nura'&&recovered.resident===storyId&&recoveredPresentation.view.kind==='encounter'&&recoveredPresentation.view.residentId===restored.saved.view.residentId&&recoveredPresentation.view.storyId===restored.saved.view.storyId&&recoveredPresentation.view.anchor.label===canonicalLabel&&recoveredLabel.endsWith(' · '+canonicalLabel)&&!recoveredLabel.includes('Unavailable site'),{missing,canonicalAnchor:recovered.anchor,visibleLabel:recoveredLabel});
 check('saved-presentation-recovery','bookmark recovery changes no funded decision or evaluator evidence',hash((await draft(page,mode)).plan)===hash(planBefore)&&recovered.presentationResult===exactResult&&await page.getByTestId('remaining-budget').innerText()==='19'&&await page.getByTestId('resident-layer').locator('.resident-evidence').getAttribute('data-result-id')===result.resultId);
 const recoveryCapture=await capture('child-bookmark-recovery');await city(page);
 entry.childConversation={completed:true,anchorId,storyId,label:child.label,captures:[openedCapture,directCityCapture,reloadCapture,cityCapture]};
 entry.childBookmarkRecovery={completed:true,category:'explicit-saved-presentation-only',missing,canonicalAnchor:'scenario:M8:nura',capture:recoveryCapture};
 // Restore the public child inspector for the existing Escape/layout checks.
 await inspectFunded(page,publicPlan,'M8');await visitChild(page,child,world);
}

async function publicJourney(browser,mode,size,world,domain,report,out,origin){
 const [width,height]=size,label=`${mode} ${width}×${height}`,context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();
 page.setDefaultTimeout(60000);page.on('pageerror',error=>report.errors.push({category:'public',label,message:error.message}));
 const check=(name,ok,details)=>recordCheck(report,'public',label+': '+name,ok,details),entry={mode,viewport:{width,height},category:'public-UI',captures:[]};report.publicJourneys.push(entry);
 try{
  await page.goto(origin+'/?mode='+mode);entry.build=(await ready(page,mode,report)).build;
  check('fresh City is unobstructed by context sheets',await page.locator('.city-application').getAttribute('data-context')==='city'&&await page.locator('.context-panel,.planning-drawer').count()===0);
  for(const [index,decision] of publicPlan.entries()){
   await chooseProject(page,decision.initiativeId);if(decision.scope==='district')await chooseDistrict(page,decision.districtId);
   await actions(page,report,label+` ${decision.initiativeId}: confirmation and cancellation are exposed 44 px actions`,'[data-testid=held-project] .button-row button:visible');
   assert(await page.getByTestId('held-project').innerText());
   // Intentionally leave the fifth result compact. The legacy helper default
   // opens it, which would conceal a broken City-after-confirmation behavior.
   await confirmProject(page,{openResult:false});
   await page.waitForFunction(count=>document.querySelector('[data-testid=decision-count]')?.textContent===`${count} of 5`,index+1);
  }
  const expected=domain.evaluatePlan(publicPlan);assert(expected.ok);await expectResult(page,expected.result);
  await page.getByTestId('result-invitation').waitFor();await settle(page);
  check('fifth public confirmation keeps City and a compact exact-score invitation',await page.locator('.city-application').getAttribute('data-context')==='city'&&await page.getByTestId('outcome-sheet').count()===0&&await page.locator('.context-panel,.planning-drawer').count()===0&&(await page.getByTestId('result-invitation').innerText()).includes(format(expected.result.finalScore)));
  check('fixed five decisions spend 81 units and leave 19',await page.getByTestId('remaining-budget').innerText()==='19'&&hash((await draft(page,mode)).plan)===hash(publicPlan));
  await actions(page,report,label+': finished City primary controls are exposed 44 px actions','.primary-navigation button,[data-toggle=treasury],[data-toggle=planning],[data-testid=result-invitation],.comparison-resume:visible');
  const finished=join(out,`${mode}-public-${width}x${height}-finished.png`);await captureFrame(page,finished,report);entry.captures.push(finished);
  const cityCamera=await mapData(page);await city(page);check('City action retains the existing camera',equalCamera(cityCamera,await mapData(page)));
  await page.locator('[data-toggle=treasury]').click();await page.getByTestId('treasury-sheet').waitFor();
  const balance=await page.locator('.treasury-ledger b').allTextContents();check('Budget opens treasury with the funded plan and exact three-part conservation',await page.locator('.catalogue-sheet').count()===0&&await page.locator('.treasury-plan li').count()===5&&balance.map(Number).reduce((a,b)=>a+b,0)===100&&Number(balance[2])===81,{balance});
  const treasury=join(out,`${mode}-public-${width}x${height}-treasury.png`);await captureFrame(page,treasury,report);entry.captures.push(treasury);
  await page.getByTestId('treasury-sheet').getByRole('button',{name:'Open projects',exact:true}).click();await page.locator('.catalogue-sheet').waitFor();
  check('explicit Projects action opens all fourteen priced catalogue entries',await page.getByTestId('treasury-sheet').count()===0&&await page.locator('.project-choice').count()===14);
  await page.keyboard.press('Escape');await city(page);
  await inspectFunded(page,publicPlan,'M8');await city(page);
  const marker=page.locator('.map-project[data-initiative=M8][data-district=nura][data-proposal=false][data-child=false]').filter({visible:true});
  assert.equal(await marker.count(),1,`${label} visible clinic parent picking`);await marker.click();await page.getByTestId('program-inspection').waitFor();await settle(page);
  const savedBefore=await draft(page,mode),resultBefore=(await mapData(page)).presentationResult;
  check('physical program picking opens only a read-only inspector',await page.locator('.city-application').getAttribute('data-context')==='inspection'&&await page.getByTestId('held-project').count()===0&&await page.locator('.catalogue-sheet').count()===0&&await page.getByTestId('program-inspection').getByRole('button',{name:'Edit decision',exact:true}).count()===1);
  const fixture={id:'M8',districtId:'nura',plan:publicPlan,result:expected.result},parent=world.projects.projectObjects(propsFor(fixture),world.districts).find(o=>o.id==='M8'),child=world.projects.programSites(parent).find(s=>s.key!==parent.key);
  await visitChild(page,child,world);
  check('clinic inspector exposes the original hub plus exactly three real satellite places',await page.locator('.program-locations li button').count()===4);
  const exposure=await selectedExposure(page,world,child);entry.selectedSite=exposure;
  check('the entire selected satellite fits the exposed map outside context controls',exposure.visible,exposure);
  await actions(page,report,label+': inspector primary and explicit edit actions remain exposed','.consequence-actions button:visible');
  check('child visit preserves committed decisions, funds and exact evaluation',hash((await draft(page,mode)).plan)===hash(savedBefore.plan)&&await page.getByTestId('held-project').count()===0&&await page.getByTestId('remaining-budget').innerText()==='19'&&(await mapData(page)).presentationResult===resultBefore);
  const inspection=join(out,`${mode}-public-${width}x${height}-child-inspection.png`);await captureFrame(page,inspection,report);entry.captures.push(inspection);
  if(width===1440||width===390)await childConversationJourney(page,mode,size,world,child,expected.result,report,out,entry);
  const focused=await mapData(page);await page.keyboard.press('Escape');await settle(page);
  check('Escape closes inspection without moving the physical site',await page.locator('.city-application').getAttribute('data-context')==='city'&&equalCamera(focused,await mapData(page)));
  // Navigate the real document's keyboard order, without programmatic focus.
  const budget=page.locator('[data-toggle=treasury]');let reached=false;
  for(let turn=0;turn<60&&!reached;turn++){await page.keyboard.press('Tab');reached=await budget.evaluate(button=>button===document.activeElement);}
  check('keyboard tab order reaches Budget',reached);await page.keyboard.press('Enter');await page.getByTestId('treasury-sheet').waitFor();await page.keyboard.press('Escape');await settle(page);
  check('layout has no horizontal document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByTestId('result-invitation').click();await page.getByTestId('outcome-sheet').waitFor();
  check('compact result expands on request with the exact evaluator score',(await page.locator('.result-score strong').innerText())===format(expected.result.finalScore));
  await actions(page,report,label+': expanded result close is exposed','[data-testid=outcome-sheet] button[aria-label="Return to the city"]');
  entry.result={resultId:expected.result.resultId,score:expected.result.finalScore,ledgerHash:hash(expected.result.indicatorEvidence)};entry.completed=true;
 }catch(error){entry.completed=false;entry.failure=String(error);await captureFrame(page,join(out,`${mode}-public-${width}x${height}-failure.png`),report).catch(()=>{});throw error;}
 finally{await context.close();}
}

async function normalComparison(browser,mode,world,fixture,report,out,origin){
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(60000);
 page.on('pageerror',error=>report.errors.push({category:'normal-comparison',mode,message:error.message}));
 try{
  await context.addInitScript(({key,version,plan})=>localStorage.setItem(key,JSON.stringify({schemaVersion:1,scenarioVersion:version,plan,preferences:{welcomeDismissed:true}})),{key:draftKey(mode),version:fixture.result.scenarioVersion,plan:fixture.plan});
  await page.goto(origin+'/?mode='+mode);await ready(page,mode,report);await expectResult(page,fixture.result);
  await inspectFunded(page,fixture.plan,'M2');const {child}=representative(world,fixture);if(child)await visitChild(page,child,world);await city(page);
  const comparison=page.getByRole('group',{name:'Compare the city before and after'});await comparison.getByRole('button',{name:'Before your decisions',exact:true}).click();await settle(page);
  const before=await mapData(page);await page.waitForTimeout(350);const waited=await mapData(page);
  recordCheck(report,'normal-comparison',`${mode}: comparison freezes the actual active clock and light`,before.comparisonFrozen==='true'&&before.programSeconds===waited.programSeconds&&before.time===waited.time);
  await comparison.getByRole('button',{name:'Two years later',exact:true}).click();await settle(page);const after=await mapData(page);
  recordCheck(report,'normal-comparison',`${mode}: baseline and after share exact normal-motion camera, light, clock and result`,equalCamera(before,after)&&before.time===after.time&&before.programSeconds===after.programSeconds&&equalResult(before,after)&&after.scenePhase==='evaluated');
  await sceneCapture(page,join(out,`${mode}-M2-normal-frozen-after.png`),report,{category:'normal-motion-frozen-fixture'});
  await page.getByRole('button',{name:'Resume city life',exact:true}).click();
  await page.waitForFunction(seconds=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return d?.comparisonFrozen==='false'&&+d.programSeconds>seconds+.1;},+after.programSeconds);
  recordCheck(report,'normal-comparison',`${mode}: public play action resumes city motion without changing results`,(await mapData(page)).presentationResult===after.presentationResult);
  // Observe a complete real phase sequence. Public play/compare actions freeze
  // each view at its actual clock; no timer, renderer or geometry is injected.
  const intervals=mode==='astana'?[['east-west-amber',12,14],['north-south-release',16,28],['north-south-amber',28,30],['pedestrian',32,39],['east-west-release',0,12]]:[['cart-clearance',13,17],['herd-release',17,30],['all-waiting',30,36],['cart-release',0,13]];
  const period=mode==='astana'?40:36,offset=mode==='astana'?child.coordinationOffset||0:-child.index*3;
  for(const [name,start,end] of intervals){
   await page.waitForFunction(({period,offset,start,end})=>{
    const d=document.querySelector('[data-testid=city-map]')?.dataset,t=((+d?.programSeconds-offset)%period+period)%period;
    return d?.comparisonFrozen==='false'&&t>=start+.65&&t<Math.min(end-.25,start+2);
   },{period,offset,start,end});
   await comparison.getByRole('button',{name:'Two years later',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.comparisonFrozen==='true');await settle(page);
   const state=await mapData(page),seconds=+state.programSeconds,phase=mode==='astana'?junctionSnapshot(child,seconds):programCrossingCycle(seconds,child.index*3);
   if(mode==='astana'){
    assert(new Set(phase.vehicles.filter(v=>v.green).map(v=>v.axis)).size<=1);
    if(name==='pedestrian')assert(phase.axis==='pedestrian'&&phase.vehicles.every(v=>v.stopped&&!v.insideJunction));
    if(name.endsWith('amber'))assert(phase.amber&&phase.departingAxis===(name.startsWith('east')?'east-west':'north-south'));
    if(name.endsWith('release'))assert(phase.vehicles.some(v=>!v.stopped));
   }else assert(!(phase.cartOpen&&phase.herdOpen)&&(name==='herd-release'?phase.herdOpen:name==='cart-release'?phase.cartOpen:phase.allWaiting));
   const capture=await sceneCapture(page,join(out,`${mode}-M2-phase-${name}.png`),report,{category:'observed-clock-traffic-phase',siteId:child.key,expectedPhase:phase});
   report.trafficFrames??=[];report.trafficFrames.push({mode,siteId:child.key,name,seconds,phase,capture:capture.path});
   recordCheck(report,'normal-comparison',`${mode}: rendered ${name} at observed shared clock`,state.scenePhase==='evaluated'&&state.comparisonFrozen==='true'&&state.presentationResult===after.presentationResult,{seconds,siteId:child.key,capture:capture.path});
   await page.getByRole('button',{name:'Resume city life',exact:true}).click();
  }
 }catch(error){await captureFrame(page,join(out,`${mode}-normal-comparison-failure.png`),report).catch(()=>{});throw error;}
 finally{await context.close();}
}

/** Fresh public actions only: native wall-clock construction, exact evaluated
 * replacement, result invalidation and complete refunds in each world. */
async function programLifecycle(browser,mode,world,domain,report,out,origin){
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(60000);
 page.on('pageerror',error=>report.errors.push({category:'public-normal-motion-lifecycle',mode,message:error.message}));
 const entry={mode,category:'public-normal-motion-lifecycle',captures:[],completed:false};report.lifecycles.push(entry);
 const check=(name,ok,details)=>recordCheck(report,'lifecycle',`${mode}: ${name}`,ok,details),capture=async name=>{const path=join(out,`${mode}-lifecycle-${name}.png`);await captureFrame(page,path,report);entry.captures.push(path);};
 const receiptFor=(saved,id)=>saved.construction.find(r=>r.key.startsWith(id+':'));
 const construction=data=>JSON.parse(data.constructions||'[]').find(c=>c.id==='M4');
 const edit=async(plan,id)=>{await inspectFunded(page,plan,id);await page.getByTestId('program-inspection').getByRole('button',{name:'Edit decision',exact:true}).click();await page.getByTestId('held-project').waitFor();};
 const committedSites=async(plan,absent=[])=>{
  const data=await mapData(page),actual=JSON.parse(data.programSites),objects=world.projects.projectObjects({commitments:plan,scenarioRevision:+data.scenarioRevision},world.districts),expected=sitesFor(world,objects);
  assert.deepEqual(actual.map(s=>s.key).sort(),expected.map(s=>s.key).sort(),`${mode} lifecycle exact native parent and child inventory`);
  for(const site of actual){const source=expected.find(s=>s.key===site.key);assert.deepEqual(site.origin,source.origin);assert.equal(site.source,source.source);}
  for(const id of absent)assert(!actual.some(s=>s.id===id)&&!JSON.parse(data.interventions).some(p=>p.key.startsWith(id+':'))&&await page.locator(`.map-project[data-initiative=${id}]`).count()===0,`${mode} ${id} removes native parents, children and map labels`);
  return data;
 };
 try{
  await page.goto(origin+'/?mode='+mode);const native=await ready(page,mode,report),fresh=await mapData(page),freshDraft=await draft(page,mode);
  check('fresh normal-motion lifecycle starts with 100 units and no saved decisions',(freshDraft===null||freshDraft.plan.length===0)&&await page.getByTestId('remaining-budget').innerText()==='100'&&JSON.parse(fresh.programSites).length===0);
  await chooseProject(page,'M4');await chooseDistrict(page,'esil');await confirmProject(page,{openResult:false});
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=city-map]')?.dataset.constructions||'[]').some(c=>c.id==='M4'&&c.elapsed<12));
  const committed=await draft(page,mode),receipt=receiptFor(committed,'M4'),beforeInput=await mapData(page);
  check('public park confirmation creates one real 12-second receipt and spends exactly 15',committed.plan.length===1&&committed.plan[0].initiativeId==='M4'&&receipt.key==='M4:esil'&&receipt.startedAt>0&&receipt.durationMs===12000&&await page.getByTestId('remaining-budget').innerText()==='85'&&construction(beforeInput).elapsed<12,{receipt,construction:construction(beforeInput),cameraOwned:beforeInput.eventCameraOwned});
  // Hit-test an exposed native canvas point; wheel and drag are real browser
  // inputs. Neither clocks nor reducers are substituted for this sequence.
  const exposedMapPoint=()=>page.locator('.alem-city').evaluate(canvas=>{
   for(const x of [.74,.53,.28])for(const y of [.45,.65,.28]){const p={x:innerWidth*x,y:innerHeight*y};if(document.elementFromPoint(p.x,p.y)===canvas)return p;}return null;
  });
  const point=await exposedMapPoint();assert(point,`${mode} exposed map point for construction interruption`);
  await page.mouse.move(point.x,point.y);await page.mouse.wheel(0,80);
  await page.waitForFunction(zoom=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return d?.eventCameraOwned==='false'&&Math.abs(JSON.parse(d.camera).zoom-zoom)>.01;},JSON.parse(beforeInput.camera).zoom);
  const wheeled=await mapData(page),dragPoint=await exposedMapPoint();assert(dragPoint,`${mode} exposed native canvas after wheel`);
  await page.mouse.move(dragPoint.x,dragPoint.y);await page.mouse.down();await page.mouse.move(dragPoint.x+65,dragPoint.y+24,{steps:6});await page.mouse.up();
  await page.waitForFunction(previous=>{const d=document.querySelector('[data-testid=city-map]')?.dataset,c=JSON.parse(d?.camera||'null'),target=JSON.parse(d?.target||'null');return c&&target&&d.camera===d.renderCamera&&d.eventCameraOwned==='false'&&Math.hypot(c.x-previous.x,c.y-previous.y)>1e-6&&['x','y','zoom','yaw','pitch'].every(key=>Math.abs(c[key]-target[key])<1e-7);},JSON.parse(wheeled.camera));
  const interrupted=await mapData(page);await page.waitForTimeout(220);const progressing=await mapData(page);
  check('wheel and drag release event camera ownership while native construction keeps progressing',interrupted.eventCameraOwned==='false'&&progressing.eventCameraOwned==='false'&&equalCamera(interrupted,progressing)&&construction(progressing)?.elapsed>construction(beforeInput).elapsed&&construction(progressing).elapsed<12,{before:construction(beforeInput),after:construction(progressing),camera:JSON.parse(progressing.camera)});
  assert.deepEqual((await draft(page,mode)).construction,committed.construction,`${mode} manual inputs never change receipt timestamps`);await capture('interrupted');
  await page.reload();await ready(page,mode,report,{settleCamera:false});
  await page.waitForFunction(({startedAt,durationMs})=>{const d=document.querySelector('[data-testid=city-map]')?.dataset,c=JSON.parse(d?.constructions||'[]').find(c=>c.id==='M4');return Date.now()-startedAt>=durationMs?!c:!!c;},receipt);
  const restored=await draft(page,mode),restoredData=await mapData(page),elapsed=await page.evaluate(startedAt=>Date.now()-startedAt,receipt.startedAt),restoredConstruction=construction(restoredData);
  check('reload retains the same construction receipt, spend and advancing original clock',hash(restored.plan)===hash(committed.plan)&&hash(restored.construction)===hash(committed.construction)&&await page.getByTestId('remaining-budget').innerText()==='85'&&(restoredConstruction?restoredConstruction.elapsed>=construction(progressing).elapsed:elapsed>=receipt.durationMs),{receipt:receiptFor(restored,'M4'),elapsedMs:elapsed,construction:restoredConstruction??'completed during reload'});entry.receipt={before:receipt,after:receiptFor(restored,'M4'),beforeReload:construction(progressing),afterReload:restoredConstruction??null};await capture('receipt-reloaded');
  for(const decision of publicPlan.slice(1)){await chooseProject(page,decision.initiativeId);if(decision.scope==='district')await chooseDistrict(page,decision.districtId);await confirmProject(page,{openResult:false});}
  const original=domain.evaluatePlan(publicPlan);assert(original.ok);await expectResult(page,original.result);await city(page);
  check('five real public choices compute the original exact result and 81-unit spend',hash((await draft(page,mode)).plan)===hash(publicPlan)&&await page.getByTestId('remaining-budget').innerText()==='19');
  await edit(publicPlan,'M4');await page.getByTestId('held-project').getByRole('button',{name:'Replace with another project',exact:true}).click();await page.locator('.catalogue-sheet').waitFor();await page.locator('.project-choice[data-project=M6]').click();await page.getByTestId('held-project').waitFor();
  const replacementPlan=publicPlan.map(d=>d.initiativeId==='M4'?{initiativeId:'M6',scope:'citywide'}:d),replacement=domain.evaluatePlan(replacementPlan);assert(replacement.ok);
  check('explicit Treasury → Inspect → Edit replacement preview retains the original plan and exact result',hash((await draft(page,mode)).plan)===hash(publicPlan)&&JSON.parse((await mapData(page)).presentationResult).resultId===original.result.resultId&&await page.getByTestId('remaining-budget').innerText()==='19'&&await page.getByTestId('held-project').locator('.replacement-summary').isVisible()&&await page.getByTestId('held-project').locator('.proposal-citywide').isVisible());
  await confirmProject(page,{openResult:false});await expectResult(page,replacement.result);await city(page);
  const replaced=await draft(page,mode),replacementData=await committedSites(replacementPlan,['M4']),replacementSites=JSON.parse(replacementData.programSites).filter(s=>s.id==='M6');
  check('replacement refunds 15, charges 20 once and recomputes the authoritative five-decision result',hash(replaced.plan)===hash(replacementPlan)&&await page.getByTestId('remaining-budget').innerText()==='14'&&replacement.result.resultId!==original.result.resultId&&replacement.result.planFingerprint!==original.result.planFingerprint&&replacement.result.finalScore!==original.result.finalScore&&new Set(replacementSites.map(s=>s.district)).size===5&&!receiptFor(replaced,'M4')&&receiptFor(replaced,'M6')?.key==='M6:city',{previousResult:original.result.resultId,result:replacement.result.resultId,locations:replacementSites.length});await capture('replaced');
  await page.reload();await ready(page,mode,report);await expectResult(page,replacement.result);
  check('replacement reload restores the new complete plan, receipt identities and exact result',hash((await draft(page,mode)).plan)===hash(replacementPlan)&&hash((await draft(page,mode)).construction)===hash(replaced.construction)&&await page.getByTestId('remaining-budget').innerText()==='14');await committedSites(replacementPlan,['M4']);
  await edit(replacementPlan,'M6');await page.getByTestId('held-project').locator('.remove-commitment').click();
  await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.presentationResult==='null');await city(page);
  let remainingPlan=replacementPlan.filter(d=>d.initiativeId!=='M6');const removed=await draft(page,mode),removedData=await committedSites(remainingPlan,['M4','M6']);
  check('explicit removal refunds all 20 M6 units and invalidates the five-decision result',hash(removed.plan)===hash(remainingPlan)&&await page.getByTestId('remaining-budget').innerText()==='34'&&!receiptFor(removed,'M6')&&removedData.presentationResult==='null'&&await page.getByTestId('result-invitation').count()===0,{remaining:34,removedReceipt:'M6:city'});await capture('removed');
  for(const decision of [...remainingPlan]){await edit(remainingPlan,decision.initiativeId);await page.getByTestId('held-project').locator('.remove-commitment').click();remainingPlan=remainingPlan.filter(d=>d.initiativeId!==decision.initiativeId);await city(page);assert.equal(await page.getByTestId('remaining-budget').innerText(),String(100-remainingPlan.reduce((n,d)=>n+domain.INITIATIVES[d.initiativeId].cost,0)));await committedSites(remainingPlan,['M4','M6',decision.initiativeId]);}
  await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.programVertices==='0');const empty=await draft(page,mode),emptyData=await mapData(page);
  check('all explicit refunds restore 100 and release every program site, label, receipt and static site buffer',empty.plan.length===0&&empty.construction.length===0&&await page.getByTestId('remaining-budget').innerText()==='100'&&JSON.parse(emptyData.programSites).length===0&&JSON.parse(emptyData.interventions).length===0&&await page.locator('.map-project').count()===0&&+emptyData.programVertices===0&&+emptyData.gpuBufferBytes<+replacementData.gpuBufferBytes&&emptyData.residentBuildings===native.buildings&&emptyData.residentTiles===native.tiles,{fundedGpuBytes:+replacementData.gpuBufferBytes,emptyGpuBytes:+emptyData.gpuBufferBytes,staticProgramVertices:+emptyData.programVertices});await capture('fully-refunded');
  await page.reload();await ready(page,mode,report);const emptyReload=await mapData(page);
  check('empty-plan reload retains full refund and never restores removed labels, geometry or results',(await draft(page,mode)).plan.length===0&&(await draft(page,mode)).construction.length===0&&await page.getByTestId('remaining-budget').innerText()==='100'&&JSON.parse(emptyReload.programSites).length===0&&+emptyReload.programVertices===0&&emptyReload.presentationResult==='null'&&await page.locator('.map-project').count()===0);
  entry.results={original:{resultId:original.result.resultId,planFingerprint:original.result.planFingerprint,score:original.result.finalScore},replacement:{resultId:replacement.result.resultId,planFingerprint:replacement.result.planFingerprint,score:replacement.result.finalScore},removed:null};entry.completed=true;
 }catch(error){entry.failure=String(error);await capture('failure').catch(()=>{});throw error;}
 finally{await context.close();}
}

export async function main(){
 const publicOnly=process.argv.includes('--public-only');
 const lifecycleOnly=process.argv.includes('--lifecycle-only');assert(!(publicOnly&&lifecycleOnly),'Choose one targeted browser gate');
 const publicCase=process.argv.find(arg=>arg.startsWith('--public-case='))?.slice('--public-case='.length);
 assert(!publicCase||publicOnly,'--public-case requires --public-only');
 if(publicCase)assert(/^(astana|khanate):(1440x900|1366x768|390x844|360x640|540x360)$/.test(publicCase),'Unknown public viewport case');
 const publicCases=modes.flatMap(mode=>sizes.map(size=>({mode,size}))).filter(({mode,size})=>!publicCase||`${mode}:${size.join('x')}`===publicCase);
 const out=resolve(process.env.RELEASE_OUTPUT||join(root,'artifacts/consequences/program-acceptance')),origin=(process.env.APP_URL||'http://127.0.0.1:4174').replace(/\/$/,'');
 await mkdir(out,{recursive:true});
 const report={startedAt:new Date().toISOString(),appUrl:origin,checks:[],errors:[],artifacts:[],fixtureCoverage:[],publicJourneys:[],lifecycles:[],completed:false,limitations:[
  'Seeded fixture scenes are valid saved drafts evaluated by the actual application; they do not prove the public selection journey. Public UX cases make every purchase through visible controls.',
  'Exact score and result identity are checked against an independent compilation of unchanged domain code. Exact contribution rows are checked in the native presentation adapter/model layer; browser diagnostics expose identity and score, not the complete ledger.',
  'Viewport evidence is automated desktop-browser emulation, not a physical-phone measurement. Screenshot visual review remains required.',
  'This gate preserves residency, shared resources and repeated-scene allocation stability. Existing renderer, zoom, materials, fullscreen and display-cadence release gates remain required and are not replaced by these checks.',
 ],requiredReleaseGates:['test:geometry','test:consequences','test:fullscreen','test:renderer','test:zoom','test:materials','test:school','test:integration','test:static']};
 let domain,browser,currentPage;
 try{
  domain=await loadDomain();const worlds=await loadWorlds(),fixtures=buildFixturePlans(domain);
  report.fixtureManifest=fixtures.map(f=>({id:f.id,districtId:f.districtId,plan:f.plan,resultId:f.result.resultId,spent:f.result.summary.spent,score:f.result.finalScore,ledgerHash:hash(f.result.indicatorEvidence)}));
  modelCoverage(report,worlds,fixtures,domain);
  report.childConversationManifest=modes.flatMap(mode=>[sizes[0],sizes[2]].map(([width,height])=>({mode,viewport:{width,height},publicActions:['inspect M8 child','Meet residents','reload','City'],bookmarkRecovery:'explicit presentation only; existing public plan re-evaluated by the app'})));
  const replacementPlan=publicPlan.map(d=>d.initiativeId==='M4'?{initiativeId:'M6',scope:'citywide'}:d),originalResult=domain.evaluatePlan(publicPlan),replacementResult=domain.evaluatePlan(replacementPlan);assert(originalResult.ok&&replacementResult.ok&&originalResult.result.resultId!==replacementResult.result.resultId&&originalResult.result.finalScore!==replacementResult.result.finalScore);
  report.lifecycleManifest=modes.map(mode=>({mode,category:'fresh-public-normal-motion',originalPlan:publicPlan,replacementPlan,originalResultId:originalResult.result.resultId,replacementResultId:replacementResult.result.resultId,remaining:[100,85,19,14,34,100],publicActions:['confirm M4','wheel and drag active construction','reload same receipt','complete real five choices','Treasury → Inspect → Edit → replace with M6','reload exact new result','Treasury → Inspect → Edit → remove M6','remove remaining decisions and reload full refund']}));
  if(process.argv.includes('--prepare-only')){report.prepared=true;report.execution='model-and-fixture-preparation-only';console.log('Prepared 28 evaluated browser fixtures, 10 public viewport journeys, 4 child conversation/recovery regressions and 2 fresh normal-motion replacement/removal lifecycles; no browser launched.');return report;}
  browser=await chromium.launch({executablePath,headless:true,args:browserArgs});report.browser=await browser.version();report.execution=lifecycleOnly?'public-normal-motion-lifecycle-browser-only':publicCase?'public-viewport-case-browser-only':publicOnly?'public-viewport-browser-only':'production-browser';
  if(publicOnly)report.limitations.push('This targeted run covers public viewport journeys only. Run the default gate for the required28 before/after fixtures, normal traffic phases and both-world normal-motion construction/replacement/removal lifecycles.');
  if(lifecycleOnly)report.limitations.push('This targeted run covers the two fresh normal-motion construction/replacement/removal lifecycles only. Run the default gate for exhaustive physical fixtures and the ten public viewport journeys.');
  if(publicCase)report.limitations.push(`This debug run covers only ${publicCase}. It does not establish the required ten public viewport journeys.`);
  // At most one page uses a GPU at a time. Fixture contexts are separate from
  // all public contexts and reuse only their own HTTP cache between reloads.
  if(!publicOnly&&!lifecycleOnly)for(const mode of modes){
   const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();currentPage=page;page.setDefaultTimeout(60000);
   const requests=[];context.on('request',request=>{if(geometryRequest(request.url()))requests.push(request.url());});page.on('pageerror',error=>report.errors.push({category:'fixture',mode,message:error.message}));
   await context.addInitScript(({key,version})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({schemaVersion:1,scenarioVersion:version,plan:[],preferences:{welcomeDismissed:true}}));},{key:draftKey(mode),version:domain.SCENARIO_VERSION});
   try{
    await page.goto(origin+'/?mode='+mode);await ready(page,mode,report);
    for(const fixture of fixtures){
     await page.evaluate(({key,version,plan})=>localStorage.setItem(key,JSON.stringify({schemaVersion:1,scenarioVersion:version,plan,preferences:{welcomeDismissed:true}})),{key:draftKey(mode),version:domain.SCENARIO_VERSION,plan:fixture.plan});
     await page.reload();const reference=await ready(page,mode,report);await expectResult(page,fixture.result);const readyRequests=requests.length;
     await compareScene(page,worlds[mode],fixture,report,out,reference);
     recordCheck(report,'fixture',`${mode} ${fixture.id}: no geometry requests after the complete ready frame`,requests.length===readyRequests,{requests:readyRequests});
    }
   }catch(error){await captureFrame(page,join(out,`${mode}-fixture-failure.png`),report).catch(()=>{});throw error;}
   finally{await context.close();currentPage=null;}
   await normalComparison(browser,mode,worlds[mode],fixtures.find(f=>f.id==='M2'),report,out,origin);
  }
  if(!publicOnly)for(const mode of modes)await programLifecycle(browser,mode,worlds[mode],domain,report,out,origin);
  if(!lifecycleOnly)for(const {mode,size} of publicCases)await publicJourney(browser,mode,size,worlds[mode],domain,report,out,origin);
  if(!publicOnly&&!lifecycleOnly)recordCheck(report,'coverage','all14 programs in both worlds captured as actual evaluate-backed before/after scenes',report.fixtureCoverage.length===28&&modes.every(mode=>ids.every(id=>report.fixtureCoverage.some(f=>f.mode===mode&&f.id===id))));
  if(!publicOnly)recordCheck(report,'coverage','both worlds complete public normal-motion interruption, receipt reload, exact replacement/removal and full refund',report.lifecycles.length===2&&modes.every(mode=>report.lifecycles.some(l=>l.mode===mode&&l.completed)));
  if(!lifecycleOnly)recordCheck(report,'coverage',publicCase?`requested public viewport journey ${publicCase} completes`:'both-world public five-decision journeys complete at all five required viewports',report.publicJourneys.length===publicCases.length&&publicCases.every(({mode,size:[width,height]})=>report.publicJourneys.some(j=>j.mode===mode&&j.viewport.width===width&&j.viewport.height===height&&j.completed)));
  const childCases=publicCases.filter(({size:[width]})=>width===1440||width===390);
  if(!lifecycleOnly&&childCases.length)recordCheck(report,'coverage',publicCase?'requested child conversation, reload, City-camera and bad-bookmark regression completes':'both-world desktop and phone child conversation, reload, City-camera and bad-bookmark regressions complete',childCases.every(({mode,size:[width]})=>report.publicJourneys.some(j=>j.mode===mode&&j.viewport.width===width&&j.childConversation?.completed&&j.childBookmarkRecovery?.completed)));
  recordCheck(report,'browser','no unhandled browser exception',report.errors.length===0,report.errors);report.completed=true;return report;
 }catch(error){report.failure=String(error);console.error(error);process.exitCode=1;if(currentPage)await captureFrame(currentPage,join(out,'fixture-failure.png'),report).catch(()=>{});return report;}
 finally{
  report.finishedAt=new Date().toISOString();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  await browser?.close();await domain?.dispose();
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
