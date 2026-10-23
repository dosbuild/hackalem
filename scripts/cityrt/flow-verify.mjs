/** Production Alem journey gate. Run against a prepared connected/static build.
 * APP_URL=http://127.0.0.1:4174 CAPTURE_DIR=artifacts/cityrt/flow node scripts/cityrt/flow-verify.mjs
 * Optional WORLD_MODE=astana|khanate; FLOW_SUITE=journey|screens|legacy|phone-results|all (default all).
 * Browser profiles are isolated and run sequentially. Functional journeys use
 * normal motion; screen inspections use reduced motion. No private state access,
 * dispatch injection, localStorage writes, or synthetic application events.
 * Legacy profiles use the bundled synthetic legacy-save fixtures, changing origins only.
 */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {installAnchorSampler} from '../fullscreen/capture-anchors.mjs';
import {artifactContext} from '../integration/ui.mjs';
import {projectContextVisibility} from './context-geometry.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const origin=(process.env.APP_URL??'http://127.0.0.1:4174').replace(/\/$/,'');
const out=resolve(root,process.env.CAPTURE_DIR??'artifacts/cityrt/flow');
const suite=process.env.FLOW_SUITE??'all';
assert(['all','journey','screens','legacy','phone-results'].includes(suite),'Unknown FLOW_SUITE');
const modes=process.env.WORLD_MODE?[process.env.WORLD_MODE]:['astana','khanate'];
assert(modes.every(mode=>['astana','khanate'].includes(mode)),'Unknown WORLD_MODE');
const report={url:origin,suite,modes,startedAt:new Date().toISOString(),checks:[],profiles:[],uxComparisons:[],errors:[],completed:false};
await mkdir(out,{recursive:true});
// Read the production model/editorial modules outside the browser; no UI store
// is imported or mutated. Vite only resolves the existing extensionless TS imports.
const loader=await createServer({root,configFile:false,publicDir:false,logLevel:'silent',appType:'custom',server:{middlewareMode:true,watch:null}});
const [{evaluatePlan},{INITIATIVES},{resultImpact,leadingProject},{allSwaps},astana,khanate,astanaProjects,khanateProjects]=await Promise.all([
 loader.ssrLoadModule('/src/domain/evaluate.ts'),loader.ssrLoadModule('/src/domain/scenario.ts'),
 loader.ssrLoadModule('/src/dashboard/impact.ts'),loader.ssrLoadModule('/src/core/review.ts'),loader.ssrLoadModule('/src/modes/astana.ts'),loader.ssrLoadModule('/src/modes/khanate/index.ts'),
 loader.ssrLoadModule('/src/world/project-objects.js'),loader.ssrLoadModule('/src/world/khanate/projects.js'),
]);
const definitions={astana:astana.default,khanate:khanate.default};
const projectGeometry={astana:astanaProjects,khanate:khanateProjects};
await loader.close();
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
let active;
const check=(name,ok,evidence={})=>{assert(ok,name);report.checks.push({profile:active?.record.name,name,...evidence});console.log('PASS',active?.record.name??'',name);};
const draftKey=mode=>mode==='astana'?'akim:draft':'alem:khanate:akim:draft';
const checkpointKey=mode=>mode==='astana'?'alem:previous-plan':'alem:khanate:alem:previous-plan';
const parseNumber=text=>Number(text.replace(/[\s\u00a0\u202f]/g,'').replace(',','.'));
const expectedResult=plan=>{const evaluated=evaluatePlan(plan);assert(evaluated.ok,'UI produced an invalid/incomplete result plan');return evaluated.result;};
const decision=(id,district)=>INITIATIVES[id].scope==='citywide'?{initiativeId:id,scope:'citywide'}:{initiativeId:id,scope:'district',districtId:district};
const samePlan=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((item,i)=>item.initiativeId===b[i].initiativeId&&item.scope===b[i].scope&&item.districtId===b[i].districtId);
const store=key=>active.page.evaluate(key=>{const value=localStorage.getItem(key);return value?JSON.parse(value):null;},key);
const draft=()=>store(draftKey(active.mode));
const view=()=>active.page.locator('.city-application').getAttribute('data-context');
const waitView=kind=>active.page.locator(`.city-application[data-context="${kind}"]`).waitFor();
const snapshot=()=>active.page.evaluate(key=>{
 const map=document.querySelector('[data-testid=city-map]'),app=document.querySelector('.city-application');
 const worldMode=document.documentElement.dataset.mode,actualKey=worldMode==='khanate'?'alem:khanate:akim:draft':worldMode==='astana'?'akim:draft':key;
 const saved=JSON.parse(localStorage.getItem(actualKey)||'null');
 const parse=value=>{try{return JSON.parse(value||'null');}catch{return null;}};
 return {at:Date.now(),worldMode,context:app?.dataset.context,space:app?.dataset.space,remaining:document.querySelector('[data-testid=remaining-budget]')?.textContent,
  plan:saved?.plan??[],construction:saved?.construction??[],camera:parse(map?.dataset.camera),renderCamera:parse(map?.dataset.renderCamera),target:parse(map?.dataset.target),
  cameraRequest:map?.dataset.cameraRequest,frame:map?.dataset.frame,phase:map?.dataset.phase,scale:map?.dataset.scale,centerDistrict:map?.dataset.centerDistrict,resident:map?.dataset.resident,anchor:map?.dataset.anchor,
  choreography:map?.dataset.choreography,eventCameraOwned:map?.dataset.eventCameraOwned,activeConstructions:parse(map?.dataset.constructions)??[],
  interventions:parse(map?.dataset.interventions)??[],
  preview:map?.dataset.preview,previewDistricts:map?.dataset.previewDistricts,previewBlocked:map?.dataset.previewBlocked,time:map?.dataset.time,motionTime:parse(map?.dataset.motionTime)};
},draftKey(active.mode));
async function flushCameraFrames({force=false}={}){
 if(!active||active.deferCameraFrames&&!force)return 0;
 const current=active,startedAtMs=performance.now(),drain={startedAtMs,forced:force,drainedFrames:0};
 // Only drain the evidence sampler we installed. The application store, camera
 // and DOM stay untouched; real reloads may replace this document next.
 try{
  const samples=await current.page.evaluate(()=>Array.isArray(window.__cameraAudit)?window.__cameraAudit.splice(0):[]);
  current.cameraFrames.push(...samples);drain.drainedFrames=samples.length;drain.completed=true;return samples.length;
 }finally{drain.durationMs=performance.now()-startedAtMs;(current.record.cameraDrains??=[]).push(drain);}
}
async function withDeferredCameraFrames(operation){
 const current=active;assert(current&&!current.deferCameraFrames,'Camera evidence deferrals must not overlap');
 await flushCameraFrames();current.deferCameraFrames=true;
 let operationFailed=false;
 try{return await operation();}
 catch(error){operationFailed=true;throw error;}
 finally{
  current.deferCameraFrames=false;
  try{await flushCameraFrames();}
  catch(error){if(!operationFailed)throw error;current.record.cameraDrainError=String(error);}
 }
}
async function action(label,operation){
 const timing={clock:'node:perf_hooks performance.now',startedAtMs:performance.now(),cameraFramesDeferred:!!active.deferCameraFrames,stages:[]};
 const stage=async(name,run)=>{const startedAtMs=performance.now(),measured={name,startedAtMs};timing.stages.push(measured);
  try{const value=await run();measured.completed=true;if(name.startsWith('flush-'))measured.drainedFrames=value;return value;}
  finally{measured.durationMs=performance.now()-startedAtMs;}
 };
 try{
  await stage('flush-before',()=>flushCameraFrames());
  const before=await stage('snapshot-before',snapshot),entry={ordinal:active.record.actions.length+1,label,before,timing};
  active.record.actions.push(entry);await stage('operation',operation);await stage('flush-after',()=>flushCameraFrames());entry.after=await stage('snapshot-after',snapshot);
 }finally{timing.durationMs=performance.now()-timing.startedAtMs;}
}
const click=(label,locator)=>action(label,()=>locator.click());
const tap=(label,locator)=>action(label,()=>locator.tap());
const key=name=>action(`keyboard:${name}`,()=>active.page.keyboard.press(name));
async function compareUx(boundary,start,snapshots,endpoint){
 const actions=active.record.actions.slice(start),surface=state=>`${state.context}:${state.space}`;
 assert(actions.length&&snapshots.length>=2,'UX task requires recorded actions and observed endpoints');
 const primarySurfaceTransitions=snapshots.slice(1).filter((state,index)=>surface(state)!==surface(snapshots[index])).length;
 const task={profile:active.record.name,boundary,current:{actionCount:actions.length,primarySurfaceTransitions,actions:actions.map(action=>({ordinal:action.ordinal,label:action.label})),surfaces:snapshots.map(state=>({context:state.context,space:state.space,resident:state.resident,anchor:state.anchor,cameraRequest:state.cameraRequest})),...endpoint}};
 report.uxComparisons.push(task);
 if(boundary==='ordinary')check('Accepting a proposed project takes two explicit actions',actions.length===2,{ux:task});
 else if(boundary==='built-person-place')check('Related person and place use two actions and one surface transition',actions.length===2&&primarySurfaceTransitions===1,{ux:task});
 else if(boundary==='result-alternative')check('The canonical one-slot alternative opens in one action',actions.length===1&&expectedResult(endpoint.alternativePlan).resultId===endpoint.resultId,{ux:task});
 else if(boundary==='result-person')check('A result opens its related person and place in one action',actions.length===1&&!!endpoint.residentId&&!!endpoint.anchor,{ux:task});
 else check('A proposal opens its related person in one action',actions.length===1,{ux:task});
}
async function exposedControl(locator){
 return locator.evaluate(node=>{
  const r=node.getBoundingClientRect(),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2),style=getComputedStyle(node);
  const luminance=color=>{const rgb=color.match(/[\d.]+/g)?.slice(0,3).map(Number);if(!rgb||rgb.length!==3)return null;const linear=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];};
  const foreground=luminance(style.color),background=luminance(style.backgroundColor),channels=style.backgroundColor.match(/[\d.]+/g)?.map(Number),opaque=channels?.length===3||channels?.length===4&&channels[3]===1,contrast=!opaque||foreground===null||background===null?null:(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
  return {label:node.textContent.trim(),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},fontSize:parseFloat(style.fontSize),foreground:style.color,background:style.backgroundColor,contrast,
   visible:r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&style.visibility!=='hidden'&&!!hit&&node.contains(hit),sheetScroll:node.closest('.outcome-sheet,.alternative-overlay')?.scrollTop??null};
 });
}
async function assertCompleteResult(name){
 const page=active.page;await waitView('result');await page.getByTestId('outcome-sheet').waitFor();
 const state=await snapshot(),decisionCount=(await page.getByTestId('decision-count').innerText()).replace(/\s+/g,' ').trim(),decks=await page.getByTestId('decision-deck').count();
 check(name,state.context==='result'&&state.plan.length===5&&decisionCount==='5 of 5'&&decks===0&&await page.getByTestId('outcome-sheet').isVisible(),{context:state.context,planCount:state.plan.length,decisionCount,decisionDecks:decks});
}
async function assertMapTimeSwitch(){
 const page=active.page,group=page.getByRole('group',{name:'Compare the city before and after',exact:true}),labels=['Before your decisions','Two years later'];
 check('Result exposes exactly the two native map time tabs',await view()==='result'&&await group.count()===1&&await group.getByRole('button').count()===2,{viewport:active.record.viewport});
 const controls=[];
 for(const label of labels){
  const button=group.getByRole('button',{name:label,exact:true}),control=await exposedControl(button);
  const text=await button.evaluate(node=>{
   const r=node.getBoundingClientRect();
   const textRects=[...node.childNodes].filter(child=>child.nodeType===Node.TEXT_NODE&&child.textContent.trim()).flatMap(child=>{const range=document.createRange();range.selectNodeContents(child);return [...range.getClientRects()].map(t=>{
    const points=[[(t.left+t.right)/2,(t.top+t.bottom)/2],[t.left+Math.min(1,t.width/2),t.top+1],[t.right-Math.min(1,t.width/2),t.top+1],[t.left+Math.min(1,t.width/2),t.bottom-1],[t.right-Math.min(1,t.width/2),t.bottom-1]];
    return {left:t.left,top:t.top,right:t.right,bottom:t.bottom,exposed:t.left>=Math.max(r.left,0)&&t.right<=Math.min(r.right,innerWidth)&&t.top>=Math.max(r.top,0)&&t.bottom<=Math.min(r.bottom,innerHeight)&&points.every(([x,y])=>{const hit=document.elementFromPoint(x,y);return !!hit&&node.contains(hit);})};
   });});
   return {textRects,fullLabel:textRects.length>0&&textRects.every(t=>t.exposed),noOverflow:node.scrollWidth<=node.clientWidth};
  });
  controls.push({...control,...text});
 }
 check('Both result map time tabs and their full labels are inside the viewport and hit-testable',controls.every((control,index)=>control.visible&&control.label===labels[index]&&control.fullLabel&&control.noOverflow&&control.fontSize>=12),{viewport:active.record.viewport,controls});
}
async function assertFutureControls(){
 const page=active.page,group=page.getByRole('group',{name:'Choose a future'});
 for(const label of ['My plan','Alternative']){const control=await exposedControl(group.getByRole('button',{name:label,exact:true}));check('Both future labels are exposed and readable before comparison input',control.visible&&control.label===label&&control.fontSize>=12&&control.contrast>=4.5,{control});}
 const hold=await exposedControl(page.getByTestId('future-switcher').locator('.hold-future'));check('Pointer and keyboard hold control is exposed before use',hold.visible&&hold.fontSize>=12&&hold.contrast>=4.5,{control:hold});
 const layout=await page.getByTestId('future-switcher').evaluate(node=>{const sheet=node.closest('[data-testid=future-comparison]'),metrics=sheet?.querySelector('.local-future-difference'),r=node.getBoundingClientRect(),m=metrics?.getBoundingClientRect();return {inside:!!sheet,position:getComputedStyle(node).position,switchBottom:r.bottom,metricsTop:m?.top};});
 check('Future controls occupy normal flow above comparison metrics',layout.inside&&layout.position==='static'&&layout.switchBottom<=layout.metricsTop,{layout});
}
async function assertPhoneWayfinding(physical){
 const badge=await active.page.locator('.district-wayfinding').evaluate(node=>{
  const r=node.getBoundingClientRect(),style=getComputedStyle(node);
  return {name:node.textContent.trim(),occludes:node.hasAttribute('data-occludes-city'),fontSize:parseFloat(style.fontSize),visible:!node.hidden&&style.display!=='none'&&r.width>0&&r.height>0,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom}};
 });
 const box=physical.box,r=badge.rect,intersection=Math.max(0,Math.min(box.right,r.right)-Math.max(box.left,r.left))*Math.max(0,Math.min(box.bottom,r.bottom)-Math.max(box.top,r.top));
 check('Phone quarter name remains readable and clear of the changed project volume',badge.visible&&badge.name&&badge.occludes&&badge.fontSize>=12&&intersection===0,{badge,modelBox:box,intersection});
}
async function assertPhoneNavigation(){
 const expected=['City',definitions[active.mode].terms.residents,definitions[active.mode].terms.result];
 const nav=await active.page.getByRole('navigation',{name:'Alem spaces'}).evaluate((node,expected)=>{
  const rect=node.getBoundingClientRect();
  const controls=[...node.querySelectorAll('button')].map((button,index)=>{
   const r=button.getBoundingClientRect(),style=getComputedStyle(button),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
   const textRects=[...button.childNodes].filter(child=>child.nodeType===Node.TEXT_NODE&&child.textContent.trim()).flatMap(child=>{const range=document.createRange();range.selectNodeContents(child);return [...range.getClientRects()].map(t=>({left:t.left,top:t.top,right:t.right,bottom:t.bottom}));});
   return {label:button.textContent.trim(),expected:expected[index],fontSize:parseFloat(style.fontSize),width:r.width,height:r.height,
    visible:r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&!!hit&&button.contains(hit),
    textFits:textRects.length>0&&textRects.every(t=>t.left>=r.left&&t.right<=r.right&&t.top>=r.top&&t.bottom<=r.bottom),noOverflow:button.scrollWidth<=button.clientWidth,textRects};
  });
  return {controls,noOverflow:node.scrollWidth<=node.clientWidth,visible:rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight};
 },expected);
 check('All three unchanged phone navigation labels are readable, exposed and hit-testable without overflow',nav.visible&&nav.noOverflow&&nav.controls.length===3&&nav.controls.every(control=>control.label===control.expected&&control.visible&&control.textFits&&control.noOverflow&&control.fontSize>=12&&control.width>=44&&control.height>=44),{navigation:nav});
}
async function chooseDistrict(id){
 const select=active.page.getByTestId('held-project').locator('select');
 if(!await select.isVisible()){
  const expand=active.page.locator('.sheet-toggle');
  assert.equal(await expand.getAttribute('aria-expanded'),'false','Hidden district selector requires the collapsed proposal details control');
  await click('expand proposal details for district choice',expand);
  await select.waitFor({state:'visible'});
 }
 assert(await select.isVisible()&&await select.isEnabled(),'District selector must be visible and enabled before choosing a place');
 await action(`district:${id}`,()=>select.selectOption(id));
}
async function waitCount(count){await active.page.waitForFunction(({key,count})=>JSON.parse(localStorage.getItem(key)||'{"plan":[]}').plan.length===count,{key:draftKey(active.mode),count});}
async function ready(){await active.page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');}
async function settledCamera(){
 // Geometry assertions observe a rendered pose and its label projection together.
 // Owned construction camera motion must end or be relinquished through real input.
 await active.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const held=active.page.getByTestId('held-project'),storyId=await held.count()?await held.getAttribute('data-story-id'):null;
 const expectedPreview=definitions[active.mode].stories.find(story=>story.id===storyId)?.initiativeId;
 if(expectedPreview)await active.page.waitForFunction(id=>document.querySelector('[data-testid=city-map]')?.dataset.preview===id,expectedPreview);
 await active.page.waitForFunction(()=>{
  const map=document.querySelector('[data-testid=city-map]');if(!map||map.dataset.eventCameraOwned==='true')return false;
  try{const camera=JSON.parse(map.dataset.camera),target=JSON.parse(map.dataset.target),render=JSON.parse(map.dataset.renderCamera);
   return ['x','y','yaw','pitch','zoom'].every(k=>Math.abs(camera[k]-target[k])<.00000001&&Math.abs(camera[k]-render[k])<.000001);
  }catch{return false;}
 });
 await active.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function shot(name){await active.page.locator('.river-passage').waitFor({state:'detached'});await active.page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');const path=resolve(active.directory,`${name}.png`),metadata=await artifactContext(active.page);await active.page.screenshot({path});await writeFile(`${path}.json`,JSON.stringify(metadata,null,2)+'\n');active.record.screenshots.push({path,...metadata});}
async function start(mode,name,{viewport={width:1440,height:900},motion='no-preference',storageState,hasTouch=false}={}){
 assert(!active,'Browser profiles must run sequentially');
 const directory=resolve(out,name);await mkdir(directory,{recursive:true});
 const context=await browser.newContext({viewport,hasTouch,reducedMotion:motion,serviceWorkers:'block',recordVideo:{dir:directory,size:viewport},...(storageState?{storageState}:{})});
 await installAnchorSampler(context);
 const page=await context.newPage();page.setDefaultTimeout(Number(process.env.FLOW_TIMEOUT_MS??90000));
 const record={name,mode,viewport,motion,hasTouch,actions:[],screenshots:[],errors:[],requestsFailed:[]};report.profiles.push(record);
 active={mode,directory,context,page,record,cameraFrames:[]};
 page.on('pageerror',error=>{record.errors.push(error.message);report.errors.push({profile:name,message:error.message});});
 page.on('requestfailed',request=>record.requestsFailed.push({url:request.url(),reason:request.failure()?.errorText}));
 await page.goto(`${origin}/?mode=${mode}`);await page.getByTestId('remaining-budget').waitFor();
 const versionResponse=await context.request.get(`${origin}/version.json`);
 assert(versionResponse.ok(),'Production version.json must identify the tested build');
 record.build=await versionResponse.json();
 if(!await page.getByTestId('city-map').isVisible())await click('return captured book to visible city',page.getByRole('navigation',{name:'Alem spaces'}).getByRole('button',{name:'City',exact:true}));
 await ready();
 const demo=page.getByTestId('school-demonstration');if(await demo.count())await click('dismiss supplied demonstration',demo.getByRole('button',{name:/Skip demonstration|Now my city/}));
 await page.locator('[data-demo=off]').waitFor();
 check('Actual world matches profile',await page.evaluate(()=>document.documentElement.dataset.mode)===mode);
}
async function end(){
 if(!active)return;
 const current=active;current.record.final=await snapshot().catch(()=>null);
 await flushCameraFrames({force:true});const metadata=await artifactContext(current.page),allFrames=current.cameraFrames,frames=allFrames.filter(frame=>frame.world===current.mode);
 current.record.camera={samples:frames.length,excludedOtherWorldFrames:allFrames.length-frames.length};
 await writeFile(resolve(current.directory,'camera-frames.json'),JSON.stringify(frames));
 await writeFile(resolve(current.directory,'camera-frames.meta.json'),JSON.stringify(metadata,null,2)+'\n');
 await current.context.storageState({path:resolve(current.directory,'storage-state.json')});
 const video=current.page.video();await current.page.close();await current.context.close();
 if(video){const path=resolve(current.directory,'journey.webm');await rename(await video.path(),path);current.record.video=path;await writeFile(`${path}.json`,JSON.stringify({...metadata,type:'continuous-ui-recording',initialWorld:current.mode,worlds:[...new Set(current.record.actions.flatMap(action=>[action.before?.worldMode,action.after?.worldMode]).filter(Boolean))]},null,2)+'\n');}
 await writeFile(resolve(current.directory,'actions.json'),JSON.stringify(current.record,null,2));active=null;
}
async function catalogue(){
 if(await view()==='catalogue')return;
 const page=active.page,link=page.locator('.proposal-catalogue-link');
 if(await link.count())await click('open catalogue from accepted/proposed slot',link);
 else await click('open catalogue from treasury',page.locator('[data-toggle=planning]'));
 await waitView('catalogue');
}
async function choose(id,district){
 await catalogue();await click(`catalogue choose ${id}`,active.page.locator(`.project-choice[data-project="${id}"]`));await waitView('proposal');
 if(district&&await active.page.getByTestId('held-project').locator('select').inputValue()!==district)await chooseDistrict(district);
}
const confirm=()=>click('confirm explicit proposal',active.page.getByTestId('held-project').locator('.proposal-confirmation .primary'));
async function next(){await click('next while construction continues',active.page.locator('.consequence-actions').getByRole('button',{name:'Next decision',exact:true}));await waitView('choices');}
async function commitmentSnapshot(before,id){
 await active.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const after=await snapshot();
 const sources=before.interventions.filter(item=>item.key.startsWith(`${id}:`)&&item.state==='preview');
 check('Every ordinary acceptance retains the proposed target and physical source positions',after.cameraRequest===before.cameraRequest&&['x','y','yaw','pitch','zoom'].every(key=>Math.abs(after.target[key]-before.target[key])<.00000001)&&sources.length>0&&sources.every(source=>after.interventions.some(item=>item.key===source.key&&item.origin.every((value,i)=>value===source.origin[i]))),{initiativeId:id,beforeTarget:before.target,afterTarget:after.target,sources});
 return after;
}
async function nextPreserving(committed,id){
 await next();const after=await snapshot();
 check('Every next choice retains all accepted decisions and original construction receipts',samePlan(after.plan,committed.plan)&&JSON.stringify(after.construction)===JSON.stringify(committed.construction)&&after.cameraRequest===committed.cameraRequest,{initiativeId:id,receipts:committed.construction});
}
async function assertStory(id,district){
 const expected=definitions[active.mode].stories.find(story=>story.initiativeId===id&&story.districtId===district);assert(expected,'Authored story missing');
 const held=active.page.getByTestId('held-project');
 check('Proposal binds the existing person to project and district',await held.getAttribute('data-story-id')===expected.id&&await held.locator('.proposal-person strong').innerText()===expected.name,{storyId:expected.id,initiativeId:id,district});
 return expected;
}
async function encounter(story,resultId){
 await active.page.getByTestId('resident-layer').waitFor();
 await active.page.waitForFunction(({id,anchor})=>{const map=document.querySelector('[data-testid=city-map]');return map?.dataset.resident===id&&map?.dataset.anchor===anchor;},{id:story.id,anchor:`scenario:${story.initiativeId}:${story.districtId}`});
 check('Meeting retains the actual person and geographic anchor',await active.page.locator('.resident-encounter').getAttribute('data-resident-id')===story.id,{storyId:story.id,anchor:`scenario:${story.initiativeId}:${story.districtId}`});
 if(resultId)check('Resident evidence shares the canonical result identity',await active.page.locator('.resident-evidence').getAttribute('data-result-id')===resultId,{resultId});
}
async function escapedTo(kind){
 await key('Escape');await waitView(kind);
 await active.page.waitForFunction(kind=>{
  const focused=document.activeElement;if(!focused||focused===document.body)return false;
  return kind==='proposal'?!!focused.closest('#planning'):kind==='result'?!!focused.closest('[data-testid=outcome-sheet]'):true;
 },kind);
 check('Escape returns useful keyboard focus to the prior surface',await view()===kind,{surface:kind});
}
async function resultPeople(result){
 const impact=resultImpact(result),contributor=leadingProject(impact.highlight),mode=definitions[active.mode];
 const helped=mode.stories.find(story=>story.districtId===impact.highlight.districtId&&story.initiativeId===contributor);
 const waiting=mode.stories.find(story=>story.districtId===impact.remaining.districtId&&mode.projects[story.initiativeId].indicator===impact.remaining.indicatorId);
 assert(helped&&waiting,'Existing contribution/need stories must resolve');
 const cards=active.page.getByTestId('outcome-sheet').locator('.outcome-person');
 check('Result people are selected from existing authoritative contributions and unresolved need',await cards.count()===2&&await cards.nth(0).getAttribute('data-story-id')===helped.id&&await cards.nth(0).getAttribute('data-contributor')===contributor&&await cards.nth(1).getAttribute('data-story-id')===waiting.id,{resultId:result.resultId,helped:helped.id,waiting:waiting.id,contributor});
 return {helped,waiting,contributor};
}
async function bookAndPeople(plan){
 const page=active.page,receipts=JSON.stringify((await draft()).construction),result=expectedResult(plan);
 await click('open complete result book',page.getByTestId('outcome-sheet').getByRole('button',{name:'Detailed results',exact:true}));
 const tabs=page.getByRole('navigation',{name:'Dashboard sections'});await tabs.waitFor();
 check('Full book retains the canonical numerical result',Math.abs(parseNumber(await page.locator('.dash-score-orbit strong').innerText())-result.finalScore)<=.0051);
 for(const section of ['Plan review','Council',active.mode==='khanate'?'City book':'Registry']){
  const tab=tabs.getByRole('button',{name:new RegExp(section)});await click(`book section: ${section}`,tab);
  check('Every existing result book section remains reachable',await tab.getAttribute('aria-current')==='page',{section});
 }
 await page.locator('.dash-submit form').waitFor();
 check('Registry publication remains a separate explicit named action',await page.locator('.dash-submit form input').inputValue()===''&&!await page.locator('.dash-submit form button').isEnabled());
 await click('open full resident book',page.getByRole('navigation',{name:'Alem spaces'}).getByRole('button',{name:definitions[active.mode].terms.residents,exact:true}));
 await page.getByTestId('resident-conversation').waitFor();
 await page.waitForFunction(()=>!!document.activeElement?.closest('.product-space'));
 const name=await page.locator('.street-conversation h2').innerText(),story=definitions[active.mode].stories.find(story=>story.name===name);assert(story,'Book person must be an existing authored story');
 await click('disclose full authored story',page.locator('.street-details>summary'));
 check('Short encounter retains the original authored story in the book',await page.locator('.street-details p').first().innerText()===story.opening,{storyId:story.id});
 await click('read original appeal',page.locator('.street-details').getByRole('button',{name:'Read the request',exact:true}));await page.locator('.living-reader').waitFor();
 const appealId=await page.locator('.living-document-heading code').innerText(),reader=await page.locator('.living-reader').elementHandle();assert(reader,'Appeal reader must exist');
 await click('open Aya over the reader',page.getByRole('button',{name:'Open Aya, the city assistant',exact:true}));await page.locator('#aya-dialogue').waitFor();
 // Move out of the Aya textarea through real Tab input. Escape must still close
 // only the overlay; the reader's capture listener must preserve its context.
 for(let i=0;i<12&&await page.evaluate(()=>!!document.activeElement?.closest('#aya-dialogue'));i++)await key('Tab');
 check('Keyboard can reach persistent controls while Aya is open',await page.evaluate(()=>document.activeElement!==document.body&&!document.activeElement?.closest('#aya-dialogue')));
 await key('Escape');await page.locator('#aya-dialogue').waitFor({state:'detached'});
 check('Aya Escape preserves the same reader and plan',await reader.evaluate(node=>node.isConnected&&node===document.querySelector('.living-reader'))&&samePlan((await draft()).plan,plan));await reader.dispose();
 await click('reader directly meets its existing author',page.locator('.living-reader').getByRole('button',{name:'Meet the author',exact:true}));await page.getByTestId('resident-conversation').waitFor();
 await page.waitForFunction(()=>!!document.activeElement?.closest('.street-conversation'));
 check('Reader meeting returns useful focus to the same author conversation',await page.locator('.street-conversation h2').innerText()===name,{storyId:story.id});
 await click('open complete appeal archive',page.locator('.street-topline button'));await page.locator('.living-register').waitFor();
 check('All existing appeals remain searchable in the full archive',(await page.locator('.living-search-count').innerText()).includes(String(definitions[active.mode].appeals.length)));
 await action('find the same authored appeal',()=>page.getByRole('searchbox',{name:'Find a request'}).fill(appealId));
 const row=page.locator(`.living-appeal-row[data-appeal-id="${appealId}"]`);await row.waitFor();await click('read archived appeal',row);await page.locator('.living-reader').waitFor();
 await key('Escape');await page.locator('.living-register').waitFor();await page.waitForFunction(id=>document.activeElement?.getAttribute('data-appeal-id')===id,appealId);
 check('Reader Escape restores its actual archive row',await page.locator('.living-reader').count()===0,{appealId});
 await key('Escape');await page.getByTestId('resident-conversation').waitFor();
 check('Archive Escape returns its persistent opener',await page.evaluate(()=>document.activeElement===document.querySelector('.street-topline button')));
 await click('return from full book to changed city',page.getByRole('navigation',{name:'Alem spaces'}).getByRole('button',{name:'City',exact:true}));await waitView('result');
 check('Book, reader and Aya navigation retain exact plan, receipts and treasury',samePlan((await draft()).plan,plan)&&JSON.stringify((await draft()).construction)===receipts&&await page.getByTestId('remaining-budget').innerText()===String(result.summary.remaining));
 await shot('book-context-return');
}
async function builtPersonPlaceJourney(mode){
 await start(mode,`${mode}/ux-built-person-place`);const page=active.page,district=mode==='astana'?'nura':'esil';
 await click('related-place setup: choose the existing school need',page.locator('.need-card[data-choice=M7]'));await waitView('proposal');
 const story=await assertStory('M7',district);await settledCamera();await confirm();await waitCount(1);await waitView('inspection');
 const accepted=await snapshot(),receipt=accepted.construction.find(item=>item.key===`M7:${district}`);assert(receipt,'Real accepted school receipt is required');
 // This matches the original completed-project task. Wait on its authoritative
 // wall clock and actual rendered activities; do not advance or replace time.
 await page.waitForFunction(({key,receiptKey})=>{
  const saved=JSON.parse(localStorage.getItem(key)||'null'),receipt=saved?.construction?.find(item=>item.key===receiptKey),map=document.querySelector('[data-testid=city-map]');
  return !!receipt&&Date.now()>=receipt.startedAt+receipt.durationMs&&!!map&&!JSON.parse(map.dataset.constructions||'[]').some(item=>item.id==='M7')&&map.dataset.eventCameraOwned==='false';
 },{key:draftKey(mode),receiptKey:receipt.key});
 await settledCamera();const before=await snapshot(),begin=active.record.actions.length;
 check('Related-place task starts at the actually completed accepted school',before.context==='inspection'&&before.at>=receipt.startedAt+receipt.durationMs&&before.activeConstructions.length===0&&before.remaining==='76'&&before.interventions.some(item=>item.key===receipt.key),{receipt,at:before.at});
 await shot('01-completed-project');
 await click('completed project directly meets its existing person',page.locator('.consequence-actions [data-context-action=meet]'));await waitView('encounter');await encounter(story);
 const met=await snapshot();
 check('Completed-project meeting keeps the same school and person without a book or slot detour',met.context==='encounter'&&met.space==='map'&&met.resident===story.id&&met.anchor===`scenario:M7:${district}`&&met.cameraRequest===before.cameraRequest,{storyId:story.id});
 await shot('02-direct-person');
 await click('person directly shows the related school place',page.locator('.conversation-place').getByRole('button',{name:'Show location on map',exact:true}));await settledCamera();const placed=await snapshot();
 check('Related place is reached directly while retaining the person and completed project',placed.context==='encounter'&&placed.space==='map'&&placed.resident===story.id&&placed.anchor===met.anchor&&placed.scale==='place'&&placed.cameraRequest!==met.cameraRequest&&samePlan(placed.plan,before.plan)&&JSON.stringify(placed.construction)===JSON.stringify(before.construction)&&placed.remaining===before.remaining&&before.interventions.every(source=>placed.interventions.some(item=>item.key===source.key&&item.origin.every((value,index)=>value===source.origin[index]))),{storyId:story.id,cameraRequest:placed.cameraRequest});
 await compareUx('built-person-place',begin,[before,met,placed]);await shot('03-related-place');
 await escapedTo('inspection');await nextPreserving(placed,'M7');
 check('Completed-project related-place profile has no uncaught errors',active.record.errors.length===0);await end();
}
async function functionJourney(mode){
 await start(mode,`${mode}/functional`);const page=active.page,schoolDistrict=mode==='astana'?'nura':'esil';
 check('Fresh isolated profile has 100 units, no accepted plan and three existing needs',!(await draft())?.plan?.length&&await page.getByTestId('remaining-budget').innerText()==='100'&&await page.locator('.need-card').count()===3);
 await shot('01-entry');const ordinaryStart=active.record.actions.length;
 await click('ordinary school: choose',page.locator('.need-card[data-choice=M7]'));await waitView('proposal');
 await assertStory('M7',schoolDistrict);await settledCamera();await shot('02-school-proposal');
 // Keep the continuous sampler running, but transfer its accumulated frames
 // only after the real-time confirm/next/manual-takeover assertions finish.
 const receipt=await withDeferredCameraFrames(async()=>{
 const proposed=await snapshot();await confirm();await waitCount(1);
 await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=city-map]')?.dataset.constructions||'[]').some(item=>item.id==='M7'&&item.progress<1));
 const committed=await snapshot(),receipt=committed.construction.find(item=>item.key===`M7:${schoolDistrict}`);
 await commitmentSnapshot(proposed,'M7');
 check('Ordinary school is exactly choose + confirm',active.record.actions.length-ordinaryStart===2,{actions:2});
 await compareUx('ordinary',ordinaryStart,[active.record.actions[ordinaryStart].before,proposed,committed]);
 check('School commits once at its canonical price',samePlan(committed.plan,[decision('M7',schoolDistrict)])&&committed.remaining==='76');
 check('Accepted commitment retains the useful camera request',committed.cameraRequest===proposed.cameraRequest&&committed.target.zoom>=proposed.target.zoom*.75,{before:proposed.target,after:committed.target});
 assert(receipt,'Construction receipt missing');await next();const advanced=await snapshot();
 check('Immediate next does not reset the accepted plan, camera request or construction receipt',samePlan(advanced.plan,committed.plan)&&advanced.cameraRequest===committed.cameraRequest&&JSON.stringify(advanced.construction[0])===JSON.stringify(receipt));
 check('Next is available during live construction',receipt.startedAt+receipt.durationMs>advanced.at,{receipt,atNext:advanced.at});
 // Real manual input releases cinematic ownership while preserving construction.
 await action('manual map drag',async()=>{await page.mouse.move(1050,390);await page.mouse.down();await page.mouse.move(1090,410,{steps:6});await page.mouse.up();});
 await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.eventCameraOwned==='false');
 await settledCamera();const afterManual=await snapshot(),beforeProgress=advanced.activeConstructions.find(item=>item.id==='M7'),afterProgress=afterManual.activeConstructions.find(item=>item.id==='M7');
 check('Manual camera takeover preserves the receipt and construction advances or legitimately finishes',JSON.stringify((await draft()).construction[0])===JSON.stringify(receipt)&&!!beforeProgress&&(afterProgress?afterProgress.elapsed>beforeProgress.elapsed:receipt.startedAt+receipt.durationMs<=afterManual.at),{beforeProgress,afterProgress});
 return receipt;
 });await shot('03-next-during-construction');
 await click('open accepted school slot',page.locator('.plan-ribbon .filled button').first());await waitView('proposal');
 const schoolPerson=await assertStory('M7',schoolDistrict);await settledCamera();const meetingStart=active.record.actions.length,beforeMeeting=await snapshot();
 await click('meet the proposal person directly',page.locator('.proposal-context-actions button').first());await encounter(schoolPerson);
 check('Proposal-to-person is one action and retains proposal camera',active.record.actions.length-meetingStart===1&&(await snapshot()).cameraRequest===beforeMeeting.cameraRequest);
 await compareUx('proposal-person',meetingStart,[beforeMeeting,await snapshot()]);
 await escapedTo('proposal');await assertStory('M7',schoolDistrict);check('Meeting and return spend nothing',await page.getByTestId('remaining-budget').innerText()==='76');
 await key('Escape');await waitView('choices');
 await catalogue();check('All fourteen initiatives remain visible',await page.locator('.project-choice').count()===14);
 const park=page.locator('.project-choice[data-project=M4]');check('Scoped conflict advertises another available district',/another (district|quarter)/.test(await park.innerText()));
 await click('inspect park',park);await waitView('proposal');await chooseDistrict(schoolDistrict);await assertStory('M4',schoolDistrict);
 check('District change updates person and exact price while exposing same-place conflict',parseNumber(await page.locator('.proposal-price').evaluate(element=>element.childNodes[0].textContent))===15&&!await page.locator('.proposal-confirmation .primary').isEnabled()&&/school|yurt|incompatible|same resources/i.test(await page.locator('.validation-preview').innerText()));
 await chooseDistrict('saryarka');await assertStory('M4','saryarka');check('Another district clears the conflict without editing the school',await page.locator('.proposal-confirmation .primary').isEnabled()&&samePlan((await draft()).plan,[decision('M7',schoolDistrict)]));
 await settledCamera();const proposedPark=await snapshot();await confirm();await waitCount(2);const committedPark=await commitmentSnapshot(proposedPark,'M4');await nextPreserving(committedPark,'M4');
 let fifthAccepted;
 for(const [id,district] of [['M10','saryarka'],['M12',null],['M1','saryarka']]){
  await choose(id,district);await settledCamera();const before=await snapshot();await confirm();await waitCount(before.plan.length+1);const accepted=await commitmentSnapshot(before,id);
  check('Acceptance adds no overview camera command',(await snapshot()).cameraRequest===before.cameraRequest,{initiativeId:id});
  if(id==='M1')fifthAccepted=accepted;
  if(id!=='M1')await nextPreserving(accepted,id);
 }
 await page.getByTestId('outcome-sheet').waitFor();let original=(await draft()).plan;const result=expectedResult(original);
 check('Fifth decision calculates automatically beside the visible city',await view()==='result'&&await page.getByTestId('city-map').isVisible()&&await page.getByTestId('remaining-budget').innerText()==='17'&&original.length===5&&Math.abs(parseNumber(await page.locator('.result-score>strong').innerText())-result.finalScore)<=.0051,{resultId:result.resultId,score:result.finalScore});
 await assertCompleteResult('Fresh fifth decision shows the result without a sixth decision deck');await assertMapTimeSwitch();
 await page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return d?.phase==='future'&&d.choreography==='idle'&&JSON.parse(d.constructions??'[]').length===0;});
 const future=await snapshot(),lastReceipt=fifthAccepted.construction.find(receipt=>receipt.key==='M1:saryarka');
 check('Two-year result renders completed projects while authoritative live receipts remain unchanged',future.activeConstructions.length===0&&future.interventions.length>0&&future.interventions.every(item=>item.state==='outcome')&&JSON.stringify(future.construction)===JSON.stringify(fifthAccepted.construction)&&!!lastReceipt&&lastReceipt.startedAt+lastReceipt.durationMs>future.at,{receipts:future.construction,phase:future.phase,liveFifthReceipt:lastReceipt});
 const initialAlternative=await exposedControl(page.getByTestId('outcome-sheet').getByRole('button',{name:'Compare one replacement',exact:true}));
 check('The result alternative action is exposed before any result interaction or scrolling',initialAlternative.visible&&initialAlternative.fontSize>=12&&initialAlternative.contrast>=4.5&&initialAlternative.sheetScroll===0,{control:initialAlternative});
 const people=await resultPeople(result);await shot('04-result-beside-city');
 for(const [kind,story,index] of [['helped',people.helped,0],['unresolved',people.waiting,1]]){
  const row=page.locator('.outcome-person').nth(index),begin=active.record.actions.length,beforePerson=await snapshot();
  await click(`result meet ${kind} person`,row.locator('.outcome-actions button').first());await encounter(story,result.resultId);
  check('Result-to-person requires one action',active.record.actions.length-begin===1,{kind,actions:1});
  if(kind==='unresolved')await compareUx('result-person',begin,[beforePerson,await snapshot()],{residentId:story.id,anchor:`scenario:${story.initiativeId}:${story.districtId}`});
  await escapedTo('result');
  const placeStart=active.record.actions.length,beforePlace=await snapshot();await click(`result visit ${kind} place`,page.locator('.outcome-person').nth(index).locator('.outcome-actions button').nth(1));await settledCamera();const placed=await snapshot();
  check('Result-to-place requires one action and requests close inspection while retaining the result',active.record.actions.length-placeStart===1&&await view()==='result'&&placed.cameraRequest!==beforePlace.cameraRequest&&placed.scale==='place',{kind,actions:1,placed});
 }
 const alternativeControl=await exposedControl(page.getByTestId('outcome-sheet').getByRole('button',{name:'Compare one replacement',exact:true}));check('Direct alternative remains hit-testable before the actual action',alternativeControl.visible,{control:alternativeControl});
 const swap=allSwaps(original)[0];assert(swap,'A real valid one-slot alternative is required');
 const alternativePlan=swap.plan,alternativeResult=expectedResult(alternativePlan);
 const alternativeStart=active.record.actions.length,beforeAlternative=await snapshot();await click('result to evaluated one-slot alternative',page.getByTestId('outcome-sheet').getByRole('button',{name:'Compare one replacement',exact:true}));await waitView('comparison');await page.getByTestId('future-comparison').waitFor();
 check('Result-to-evaluated alternative is one action and preserves every accepted decision and receipt',active.record.actions.length-alternativeStart===1&&!await page.locator('.alternative-workbench').count()&&samePlan((await draft()).plan,original)&&JSON.stringify((await draft()).construction)===JSON.stringify(beforeAlternative.construction),{actions:1,swapId:swap.id,alternativePlan,resultId:alternativeResult.resultId});
 check('Direct comparison names the original and changed project with their real scope',await page.getByTestId('future-change').isVisible()&&/→/.test(await page.getByTestId('future-change').innerText()),{change:await page.getByTestId('future-change').innerText()});
 await compareUx('result-alternative',alternativeStart,[beforeAlternative,await snapshot()],{alternativePlan,resultId:alternativeResult.resultId});
 await settledCamera();await assertFutureControls();const comparisonCamera=await snapshot();
 await click('show evaluated variant',page.getByRole('group',{name:'Choose a future'}).getByRole('button',{name:'Alternative',exact:true}));await settledCamera();await assertFutureControls();const variant=await snapshot();
 check('Alternative uses its canonical result identity without adopting the plan',await page.getByTestId('future-comparison').getAttribute('data-result-id')===alternativeResult.resultId&&samePlan((await draft()).plan,original)&&Math.abs(parseNumber(await page.getByTestId('displayed-future-score').innerText())-alternativeResult.finalScore)<=.0051);
 check('Comparison toggles keep the same rendered camera, lighting and visual motion clock',comparisonCamera.cameraRequest===variant.cameraRequest&&['x','y','yaw','pitch','zoom'].every(k=>Math.abs(comparisonCamera.camera[k]-variant.camera[k])<.0001)&&comparisonCamera.time===variant.time&&Number.isFinite(comparisonCamera.motionTime)&&comparisonCamera.motionTime===variant.motionTime,{before:comparisonCamera.camera,after:variant.camera,motionBefore:comparisonCamera.motionTime,motionAfter:variant.motionTime});
 check('Comparison visual-clock freeze never changes authoritative construction receipts',JSON.stringify(comparisonCamera.construction)===JSON.stringify(variant.construction));
 await shot('05-variant');
 const futureGroup=page.getByRole('group',{name:'Choose a future'}),hold=page.getByTestId('future-switcher').locator('.hold-future');
 await click('select original before temporary future hold',futureGroup.getByRole('button',{name:'My plan',exact:true}));
 const holdBox=await hold.boundingBox();assert(holdBox,'Visible hold control required');
 await action('pointer holds the variant',async()=>{await page.mouse.move(holdBox.x+holdBox.width/2,holdBox.y+holdBox.height/2);await page.mouse.down();});
 await page.waitForFunction(()=>document.querySelector('.future-toggle button:last-child')?.getAttribute('aria-pressed')==='true');
 check('Pointer hold temporarily selects the variant',await page.getByTestId('future-comparison').getAttribute('data-result-id')===alternativeResult.resultId);
 await action('pointer release restores original',()=>page.mouse.up());await page.waitForFunction(()=>document.querySelector('.future-toggle button:first-child')?.getAttribute('aria-pressed')==='true');
 await key('Shift+Tab');check('Keyboard reaches the same visible hold control',await hold.evaluate(node=>document.activeElement===node));
 await action('keyboard holds the variant',()=>page.keyboard.down('Space'));await page.waitForFunction(()=>document.querySelector('.future-toggle button:last-child')?.getAttribute('aria-pressed')==='true');
 check('Keyboard hold temporarily selects the same canonical variant',await page.getByTestId('future-comparison').getAttribute('data-result-id')===alternativeResult.resultId);
 await action('keyboard release restores original',()=>page.keyboard.up('Space'));await page.waitForFunction(()=>document.querySelector('.future-toggle button:first-child')?.getAttribute('aria-pressed')==='true');
 const released=await snapshot();check('Pointer and keyboard release preserve the matched camera, light, motion and receipts',released.cameraRequest===comparisonCamera.cameraRequest&&['x','y','yaw','pitch','zoom'].every(k=>Math.abs(released.camera[k]-comparisonCamera.camera[k])<.0001)&&released.time===comparisonCamera.time&&released.motionTime===comparisonCamera.motionTime&&JSON.stringify(released.construction)===JSON.stringify(comparisonCamera.construction)&&samePlan(released.plan,original));
 await click('discard alternative losslessly',page.getByTestId('future-comparison').getByRole('button',{name:'Keep my plan',exact:true}));await waitView('result');
 check('Discard restores original plan and treasury',samePlan((await draft()).plan,original)&&await page.getByTestId('remaining-budget').innerText()==='17');
 const parkIndex=original.findIndex(item=>item.initiativeId==='M4');await click('open accepted park slot',page.locator('.plan-ribbon .filled button').nth(parkIndex));await waitView('proposal');
 await click('accepted slot straight to place',page.locator('.proposal-context-actions button').nth(1));await settledCamera();check('Slot place does not spend or change decisions',samePlan((await draft()).plan,original)&&await page.getByTestId('remaining-budget').innerText()==='17');
 await choose('M6');check('Replacement shows exact five-unit difference before commitment',/\+5/.test(await page.locator('.replacement-summary').innerText())&&await page.getByTestId('remaining-budget').innerText()==='17'&&samePlan((await draft()).plan,original));
 await confirm();await page.getByTestId('outcome-sheet').waitFor();await waitCount(5);check('Replacement credits the old price and keeps five slots',await page.getByTestId('remaining-budget').innerText()==='12'&&(await draft()).plan.some(item=>item.initiativeId==='M6')&&!(await draft()).plan.some(item=>item.initiativeId==='M4'));
 await click('open replacement slot',page.locator('.plan-ribbon .filled button').nth(parkIndex));await waitView('proposal');await click('refund accepted planting price',page.locator('.remove-commitment'));await waitCount(4);
 check('Refund returns exactly twenty units',await page.getByTestId('remaining-budget').innerText()==='32');
 await choose('M4','saryarka');await confirm();await waitCount(5);await page.getByTestId('outcome-sheet').waitFor();
 const readded=(await draft()).plan,expectedReadded=[...original.filter(item=>item.initiativeId!=='M4'),original.find(item=>item.initiativeId==='M4')];
 check('Re-add appends the refunded decision, restores the same canonical result and retains other clocks',samePlan(readded,expectedReadded)&&expectedResult(readded).resultId===result.resultId&&await page.getByTestId('remaining-budget').innerText()==='17'&&JSON.stringify((await draft()).construction.find(item=>item.key===receipt.key))===JSON.stringify(receipt));
 original=readded;
 // Native modal keyboard escape and focus, then real previous-attempt recovery.
 const retainedResult=await page.getByTestId('outcome-sheet').elementHandle();assert(retainedResult,'Primary result must exist before opening guide');
 await click('open game guide',page.getByRole('button',{name:'How to play',exact:true}));await page.getByRole('dialog').waitFor();
 check('Guide preserves the mounted primary context under one overlay',await retainedResult.evaluate(node=>node.isConnected&&node===document.querySelector('[data-testid=outcome-sheet]'))&&await page.getByTestId('outcome-sheet').count()===1&&await page.getByRole('dialog').count()===1);
 for(let i=0;i<5;i++){await key('Tab');check('Native modal retains keyboard focus',await page.evaluate(()=>!!document.activeElement?.closest('dialog')));}
 await key('Escape');await page.getByRole('dialog').waitFor({state:'detached'});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 check('Guide Escape restores its persistent opener without remounting the primary',await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')==='How to play')&&await retainedResult.evaluate(node=>node.isConnected&&node===document.querySelector('[data-testid=outcome-sheet]')));await retainedResult.dispose();
 await bookAndPeople(original);
 const overviewStart=active.record.actions.length;await click('inspect complete geographic overview',page.locator('.hud-overview'));await settledCamera();
 check('Whole geography remains one action with the orthographic lens and exact saved plan',active.record.actions.length-overviewStart===1&&(await snapshot()).camera.perspective===0&&samePlan((await draft()).plan,original));
 // Explore with the same completed plan. The native atlas must own the visible
 // context while open, and overlays must close before the selected caption.
 const atlasSummary=page.locator('.landmark-atlas>summary'),atlasReceipts=JSON.stringify((await draft()).construction);
 await click('open places over the completed result',atlasSummary);
 check('Open atlas exposes its places and temporarily hides the underlying result',await page.locator('.landmark-atlas-list button').first().isVisible()&&!await page.getByTestId('outcome-sheet').isVisible());
 await click('visit the first existing atlas place',page.locator('.landmark-atlas-list button').first());await page.locator('.landmark-caption').waitFor();
 const landmark=await page.getByTestId('city-map').getAttribute('data-landmark');
 await click('guide over selected atlas place',page.getByRole('button',{name:'How to play',exact:true}));await page.getByRole('dialog').waitFor();await key('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
 check('Guide Escape preserves the selected atlas place',await page.getByTestId('city-map').getAttribute('data-landmark')===landmark&&await page.locator('.landmark-caption').isVisible());
 await click('Aya over selected atlas place',page.getByRole('button',{name:'Open Aya, the city assistant',exact:true}));await page.locator('#aya-dialogue').waitFor();
 for(let i=0;i<80&&!await page.evaluate(()=>!!document.activeElement?.closest('.landmark-caption'));i++)await key('Tab');
 check('Keyboard can reach the selected caption while Aya is open',await page.evaluate(()=>!!document.activeElement?.closest('.landmark-caption')));
 await key('Escape');await page.locator('#aya-dialogue').waitFor({state:'detached'});
 check('Aya owns Escape before the selected caption',await page.getByTestId('city-map').getAttribute('data-landmark')===landmark&&await page.locator('.landmark-caption').isVisible());
 await key('Escape');await page.getByTestId('outcome-sheet').waitFor();
 check('Caption Escape restores the atlas summary and completed result',!await page.locator('.landmark-caption').isVisible()&&await atlasSummary.evaluate(node=>document.activeElement===node)&&samePlan((await draft()).plan,original)&&JSON.stringify((await draft()).construction)===atlasReceipts);
 await click('select another existing atlas context',atlasSummary);await click('visit place before opening catalogue',page.locator('.landmark-atlas-list button').first());
 await catalogue();check('Catalogue remains the single exposed paper after atlas selection',await page.locator('.catalogue-sheet').isVisible()&&!await page.locator('.landmark-caption').isVisible()&&!await page.locator('.landmark-atlas').isVisible()&&samePlan((await draft()).plan,original));await shot('atlas-catalogue-context');
 await click('open recovery tools',page.locator('.plan-tools>summary'));await click('review restart before accepting',page.locator('.drawer-restart'));await page.getByRole('dialog').waitFor();
 check('Opening restart is protected and spends nothing',samePlan((await draft()).plan,original));await key('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
 const beforeRestart=await draft();await click('open restart again',page.locator('.drawer-restart'));await click('accept new attempt explicitly',page.getByRole('dialog').getByRole('button',{name:'Start a new plan',exact:true}));await waitCount(0);
 await waitView('choices');check('New attempt opens choices for its empty plan',await view()==='choices'&&(await draft()).plan.length===0);
 check('New attempt retains a real checkpoint and resets treasury',samePlan((await store(checkpointKey(mode))).plan,original)&&await page.getByTestId('remaining-budget').innerText()==='100');
 await catalogue();await click('open previous attempt tools',page.locator('.plan-tools>summary'));await click('review previous attempt',page.locator('.restore-plan-link'));await page.getByRole('dialog').waitFor();
 check('Restore dialog previews all five real decisions',await page.locator('.recovery-plan-list li').count()===5);await click('restore saved attempt explicitly',page.getByRole('dialog').getByRole('button',{name:'Restore this plan',exact:true}));await waitCount(5);
 await assertCompleteResult('Restored complete checkpoint opens its result without a sixth decision deck');await assertMapTimeSwitch();
 check('Previous attempt restoration preserves exact receipts and budget',samePlan((await draft()).plan,original)&&JSON.stringify((await draft()).construction)===JSON.stringify(beforeRestart.construction)&&await page.getByTestId('remaining-budget').innerText()==='17');
 const saved=await draft();await action('reload genuine saved attempt',()=>page.reload());await ready();
 await assertCompleteResult('Reloaded complete checkpoint keeps its result without a sixth decision deck');await assertMapTimeSwitch();
 check('Reload restores genuine plan and completed construction without replay',samePlan((await draft()).plan,saved.plan)&&JSON.stringify((await draft()).construction)===JSON.stringify(saved.construction));
 const expiredAtReload=saved.construction.filter(item=>item.startedAt+item.durationMs<=Date.now()).map(item=>item.key.split(':')[0]);
 check('Expired receipts produce no replay after a normal-motion reload',!(await snapshot()).activeConstructions.some(item=>expiredAtReload.includes(item.id)));
 const other=mode==='astana'?'khanate':'astana';await click('switch to independent other world',page.getByRole('button',{name:definitions[other].title,exact:true}));await ready();
 check('Other world has an independent fresh treasury',await page.getByTestId('remaining-budget').innerText()==='100');await click('return to saved world',page.getByRole('button',{name:definitions[mode].title,exact:true}));await ready();
 await assertCompleteResult('Returning to the complete saved world opens its result without a sixth decision deck');await assertMapTimeSwitch();
 check('Switching back restores original world decisions',samePlan((await draft()).plan,original)&&await page.getByTestId('remaining-budget').innerText()==='17');await shot('06-restored-world');
 check('No uncaught application errors',active.record.errors.length===0);await end();
}
async function screenInspection(mode,viewport){
 await start(mode,`${mode}/screens/${viewport.width}x${viewport.height}`,{viewport,motion:'reduce'});const page=active.page;
 await click('screen inspect school',page.locator('.need-card[data-choice=M7]'));await waitView('proposal');await settledCamera();
 const geometry=await page.evaluate(()=>{
  const map=document.querySelector('[data-testid=city-map]'),button=document.querySelector('.proposal-confirmation .primary'),sheet=document.querySelector('#planning');
  const point=[...document.querySelectorAll('.map-project')].find(element=>element.dataset.initiative==='M7'&&element.dataset.proposal==='true'&&!element.hidden);
  const box=button.getBoundingClientRect(),paper=sheet.getBoundingClientRect(),x=(box.left+box.right)/2,y=(box.top+box.bottom)/2,hit=document.elementFromPoint(x,y);
  const summary=['.proposal-project-title','.project-benefit','.compact-tradeoff','.proposal-confirmation>span'].map(selector=>{
   const node=sheet.querySelector(selector),rect=node?.getBoundingClientRect(),point=rect?document.elementFromPoint((rect.left+rect.right)/2,(rect.top+rect.bottom)/2):null;
   return {selector,text:node?.textContent,visible:!!node&&!!rect&&rect.width>0&&rect.height>0&&rect.left>=0&&rect.right<=innerWidth&&rect.top>=paper.top&&rect.bottom<=Math.min(paper.bottom,innerHeight)&&!!point&&node.contains(point),rect:rect?{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom}:null};
  });
  const contextActions=[...sheet.querySelectorAll('.proposal-context-actions button')].map(node=>{
   const r=node.getBoundingClientRect(),style=getComputedStyle(node),centre=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
   const textRects=[...node.childNodes].filter(child=>child.nodeType===Node.TEXT_NODE&&child.textContent.trim()).flatMap(child=>{const range=document.createRange();range.selectNodeContents(child);return [...range.getClientRects()].map(t=>{
    const points=[[(t.left+t.right)/2,(t.top+t.bottom)/2],[t.left+Math.min(1,t.width/2),t.top+1],[t.right-Math.min(1,t.width/2),t.top+1],[t.left+Math.min(1,t.width/2),t.bottom-1],[t.right-Math.min(1,t.width/2),t.bottom-1]];
    return {left:t.left,top:t.top,right:t.right,bottom:t.bottom,exposed:t.left>=r.left&&t.right<=r.right&&t.top>=Math.max(r.top,paper.top,0)&&t.bottom<=Math.min(r.bottom,paper.bottom,innerHeight)&&points.every(([x,y])=>{const hit=document.elementFromPoint(x,y);return !!hit&&node.contains(hit);})};
   });});
   return {label:node.textContent.trim(),fontSize:parseFloat(style.fontSize),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},visible:r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=paper.top&&r.bottom<=Math.min(paper.bottom,innerHeight)&&!!centre&&node.contains(centre),textRects,fullLabel:textRects.length>0&&textRects.every(t=>t.exposed)};
  });
  return {button:{left:box.left,top:box.top,right:box.right,bottom:box.bottom},sheet:{left:paper.left,top:paper.top,right:paper.right,bottom:paper.bottom},
   summary,contextActions,
   actionExposed:box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight&&!!hit&&button.contains(hit),
   anchor:point?{x:Number(point.dataset.anchorX),y:Number(point.dataset.anchorY),frame:point.dataset.frame}:null,frame:map.dataset.frame,renderFrame:map.dataset.renderFrame,renderCamera:map.dataset.renderCamera,camera:map.dataset.camera,
   physicalBounds:JSON.parse(map.dataset.projectPhysicalBounds??'null'),physicalKey:JSON.parse(map.dataset.interventions??'[]')[0]?.key,
   occlusions:[...document.querySelectorAll('[data-occludes-city]')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};})};
 });
 check('Candidate action is exposed and hit-testable without scrolling',geometry.actionExposed,{viewport,geometry});
 check('Project, main effect, substantial limitation and remaining budget are visible before confirming',geometry.summary.every(item=>item.visible),{viewport,summary:geometry.summary});
 if(viewport.width<=400)check('Short-phone meet and place labels are fully exposed above the confirmation footer',geometry.contextActions.length===2&&geometry.contextActions.every(action=>action.visible&&action.fullLabel&&action.fontSize>=12),{viewport,actions:geometry.contextActions});
 const mobile=viewport.width<=800;
 assert(Array.isArray(geometry.physicalBounds)&&geometry.physicalBounds.length>=8,'Actual project physical bounds required');
 const physical=projectContextVisibility({physicalBounds:geometry.physicalBounds,camera:JSON.parse(geometry.camera),sheet:geometry.sheet,occlusions:geometry.occlusions,mobile});
 check('Context project remains visible above the phone sheet or beside the desktop sheet',geometry.physicalKey===`M7:${mode==='astana'?'nura':'esil'}`&&Number(geometry.frame)>0&&Number(geometry.renderFrame)>0&&Number(geometry.renderFrame)<=Number(geometry.frame)&&geometry.renderCamera===geometry.camera&&physical.visible,{viewport,geometry,physical});
 await shot('school-action-and-place');
 if(mobile){
  const held=await page.getByTestId('held-project').elementHandle();assert(held,'Phone proposal must exist before context actions');
  const story=await assertStory('M7',mode==='astana'?'nura':'esil'),before=await snapshot();
  await click('phone: directly meet the proposed person',page.getByTestId('held-project').locator('[data-context-action=meet]'));await encounter(story);
  await page.waitForFunction(()=>!!document.activeElement?.closest('[data-testid=resident-layer]'));
  await escapedTo('proposal');
  // The remounted Candidate may focus its heading first. Wait for App's
  // existing double-rAF return to the exact opener, retaining the same strict
  // visible/hit-test predicate rather than accepting that transient heading.
  await page.waitForFunction(()=>{
   const node=document.activeElement;if(!(node instanceof HTMLElement)||node.dataset.contextAction!=='meet')return false;
   const r=node.getBoundingClientRect(),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
   return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&!!hit&&node.contains(hit);
  },null,{timeout:5000});
  check('Phone meeting Escape restores the visible actual proposal opener',await page.evaluate(()=>{
   const node=document.activeElement;if(!(node instanceof HTMLElement)||node.dataset.contextAction!=='meet')return false;
   const r=node.getBoundingClientRect(),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
   return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&!!hit&&node.contains(hit);
  }),{viewport});
  await settledCamera();
  const returnedGeometry=await page.evaluate(()=>{
   const d=document.querySelector('[data-testid=city-map]').dataset,r=document.querySelector('#planning').getBoundingClientRect();
   return {physicalBounds:JSON.parse(d.projectPhysicalBounds),camera:JSON.parse(d.camera),renderCamera:d.renderCamera,cameraJson:d.camera,key:JSON.parse(d.interventions)[0]?.key,sheet:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},occlusions:[...document.querySelectorAll('[data-occludes-city]')].filter(node=>!node.hidden&&getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width>0).map(node=>{const b=node.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom};}),mobile:true};
  });
  const returnedPhysical=projectContextVisibility(returnedGeometry);
  check('Phone meeting return restores useful actual model bounds in the rendered settled pose',returnedGeometry.key===`M7:${mode==='astana'?'nura':'esil'}`&&returnedGeometry.renderCamera===returnedGeometry.cameraJson&&returnedPhysical.visible,{viewport,physical:returnedPhysical});
  const returned=await snapshot();
  check('Phone meeting and return retain the priced proposal, camera and unchanged plan',await page.getByTestId('held-project').getAttribute('data-story-id')===story.id&&returned.cameraRequest===before.cameraRequest&&samePlan(returned.plan,before.plan)&&JSON.stringify(returned.construction)===JSON.stringify(before.construction)&&returned.remaining===before.remaining,{viewport,storyId:story.id});
  // Meeting temporarily unmounted the proposal. Capture its returned instance
  // to verify that overlays retain it, rather than treating remounting as focus.
  await held.dispose();const returnedHeld=await page.getByTestId('held-project').elementHandle();assert(returnedHeld);
  await click('phone: open guide over the proposal',page.getByRole('button',{name:'How to play',exact:true}));await page.getByRole('dialog').waitFor();
  for(let i=0;i<5;i++){await key('Tab');check('Phone guide retains modal keyboard focus',await page.evaluate(()=>!!document.activeElement?.closest('dialog')),{viewport});}
  await key('Escape');await page.getByRole('dialog').waitFor({state:'detached'});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  check('Phone guide Escape restores its persistent opener and mounted proposal',await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')==='How to play')&&await returnedHeld.evaluate(node=>node.isConnected&&node===document.querySelector('[data-testid=held-project]')),{viewport});
  await click('phone: open Aya over the proposal',page.getByRole('button',{name:'Open Aya, the city assistant',exact:true}));await page.locator('#aya-dialogue').waitFor();
  await key('Escape');await page.locator('#aya-dialogue').waitFor({state:'detached'});
  check('Phone Aya Escape restores her persistent opener and the same priced proposal',await page.evaluate(()=>document.activeElement===document.querySelector('.aya-entry'))&&await returnedHeld.evaluate(node=>node.isConnected&&node===document.querySelector('[data-testid=held-project]'))&&samePlan((await draft()).plan,before.plan)&&await page.getByTestId('remaining-budget').innerText()===before.remaining,{viewport});
  await returnedHeld.dispose();await shot('phone-context-return');
 }
 // Complete the same real five-decision journey through public proposal controls.
 // Each viewport must expose the result's native map time tabs, not just a proposal.
 await confirm();await waitCount(1);await next();
 for(const [index,[id,district]] of [['M4','saryarka'],['M10','saryarka'],['M12',null],['M1','saryarka']].entries()){
  await choose(id,district);await confirm();await waitCount(index+2);if(index<3)await next();
 }
 await assertCompleteResult('Screen public fifth confirmation opens the result without a sixth decision deck');
 const result=expectedResult((await draft()).plan);
 check('Screen result keeps the canonical score and exact remaining budget',await page.getByTestId('remaining-budget').innerText()===String(result.summary.remaining)&&Math.abs(parseNumber(await page.locator('.result-score>strong').innerText())-result.finalScore)<=.0051,{viewport,resultId:result.resultId});
 await assertMapTimeSwitch();await shot('result-time-tabs');
 check('Reduced-motion screen has no uncaught errors',active.record.errors.length===0);await end();
}
async function capturedBaseline(mode){
 const supplied=process.env[mode==='astana'?'LEGACY_ASTANA_STATE':'LEGACY_KHANATE_STATE'];
 const path=resolve(supplied??resolve(root,`tests/fixtures/legacy-${mode}-storage.json`));
 const bytes=await readFile(path),state=JSON.parse(bytes.toString()),entry=state.origins.find(entry=>entry.localStorage.some(item=>item.name===draftKey(mode)));
 assert(entry,'Legacy fixture has no draft for this world');const source=JSON.parse(entry.localStorage.find(item=>item.name===draftKey(mode)).value);
 assert(source.plan.length,'Legacy fixture must contain real decisions');expectedResult(source.plan);
 // Keep every captured value unchanged. Only transport the origin metadata to
 // the tested server; never modify the baseline file or manufacture old saves.
 const rebased={...state,origins:state.origins.map(item=>item===entry?{...item,origin:new URL(origin).origin}:item)};
 return {source,rebased,evidence:{source:path,sourceSha256:createHash('sha256').update(bytes).digest('hex'),sourceOrigin:entry.origin,testOrigin:new URL(origin).origin}};
}
async function legacyRestoration(mode){
 const {source,rebased,evidence}=await capturedBaseline(mode);
 await start(mode,`${mode}/legacy`,{motion:'no-preference',storageState:rebased});
 const restored=await draft();check('Bundled legacy save restores unchanged at the current origin',samePlan(restored.plan,source.plan),evidence);
 if(source.construction)check('Legacy construction receipts retain their exact clocks',JSON.stringify(restored.construction)===JSON.stringify(source.construction));
 const expired=(restored.construction??[]).filter(item=>item.startedAt+item.durationMs<=Date.now()).map(item=>item.key.split(':')[0]);
 check('Completed baseline projects are not replayed',!(await snapshot()).activeConstructions.some(item=>expired.includes(item.id)));
 await click('open restored result beside city',active.page.getByRole('navigation',{name:'Alem spaces'}).getByRole('button',{name:definitions[mode].terms.result,exact:true}));await active.page.getByTestId('outcome-sheet').waitFor();
 const expected=expectedResult(source.plan);check('Old save recomputes canonical result and exact treasury',await active.page.getByTestId('remaining-budget').innerText()===String(expected.summary.remaining)&&Math.abs(parseNumber(await active.page.locator('.result-score>strong').innerText())-expected.finalScore)<=.0051,{resultId:expected.resultId});
 await resultPeople(expected);await shot('restored-baseline');
 await action('reload the actual old saved attempt',()=>active.page.reload());await ready();await active.page.getByTestId('outcome-sheet').waitFor();
 check('Old plan reload preserves exact decisions, treasury and construction clocks',samePlan((await draft()).plan,source.plan)&&JSON.stringify((await draft()).construction)===JSON.stringify(restored.construction)&&await active.page.getByTestId('remaining-budget').innerText()===String(expected.summary.remaining));
 check('Normal-motion old-save reload still does not replay expired projects',!(await snapshot()).activeConstructions.some(item=>expired.includes(item.id)));
 const other=mode==='astana'?'khanate':'astana';await click('old save: switch to independent other world',active.page.getByRole('button',{name:definitions[other].title,exact:true}));await ready();
 check('Old baseline save does not leak into the other world',await active.page.getByTestId('remaining-budget').innerText()==='100');
 await click('old save: return to restored world',active.page.getByRole('button',{name:definitions[mode].title,exact:true}));await ready();
 check('Old baseline plan survives world switching unchanged',samePlan((await draft()).plan,source.plan)&&JSON.stringify((await draft()).construction)===JSON.stringify(restored.construction));
 check('Legacy restoration has no uncaught errors',active.record.errors.length===0);await end();
}
async function phoneResultComparison(mode){
 const {source,rebased,evidence}=await capturedBaseline(mode),viewport={width:360,height:640};
 await start(mode,`${mode}/phone-results/360x640`,{viewport,motion:'reduce',hasTouch:true,storageState:rebased});
 const page=active.page,original=source.plan,receipts=JSON.stringify(source.construction),result=expectedResult(original);
 check('Touch phone restores the untouched legacy fixture plan and original receipt clocks',samePlan((await draft()).plan,original)&&JSON.stringify((await draft()).construction)===receipts,{...evidence,viewport,hasTouch:true});
 await tap('phone: open actual restored result',page.getByRole('navigation',{name:'Alem spaces'}).getByRole('button',{name:definitions[mode].terms.result,exact:true}));
 await page.getByTestId('outcome-sheet').waitFor();await waitView('result');
 await assertPhoneNavigation();
 check('Phone restored result retains the canonical score and exact budget',await page.getByTestId('remaining-budget').innerText()===String(result.summary.remaining)&&Math.abs(parseNumber(await page.locator('.result-score>strong').innerText())-result.finalScore)<=.0051,{resultId:result.resultId});
 await resultPeople(result);const alternativeButton=page.getByTestId('outcome-sheet').getByRole('button',{name:'Compare one replacement',exact:true});
 const initialAction=await exposedControl(alternativeButton);
 check('Phone alternative CTA is readable and hit-testable at initial result scroll zero',initialAction.visible&&initialAction.fontSize>=12&&initialAction.contrast>=4.5&&initialAction.sheetScroll===0,{control:initialAction});
 await shot('01-phone-result-scroll-zero');
 const directStart=active.record.actions.length,directSwap=allSwaps(original)[0];assert(directSwap,'A valid direct phone replacement is required');
 await tap('phone: direct evaluated result alternative',alternativeButton);await waitView('comparison');await page.getByTestId('future-comparison').waitFor();await settledCamera();
 check('Successful restoration notice clears on explicit manual intent without a separate dismissal',await page.locator('.city-notice').count()===0);
 check('Phone direct evaluated alternative is one tap and preserves all original commitments and clocks',active.record.actions.length-directStart===1&&samePlan((await draft()).plan,original)&&JSON.stringify((await draft()).construction)===receipts&&!await page.locator('.alternative-workbench').count(),{swapId:directSwap.id,alternativePlan:directSwap.plan});
 await assertFutureControls();const directCamera=await snapshot();
 await tap('phone: inspect the directly evaluated variant',page.getByRole('group',{name:'Choose a future'}).getByRole('button',{name:'Alternative',exact:true}));await settledCamera();const directVariant=await snapshot(),directResult=expectedResult(directSwap.plan);
 check('Phone direct preview uses the canonical single-swap result with unchanged comparison conditions',await page.getByTestId('future-comparison').getAttribute('data-result-id')===directResult.resultId&&directVariant.cameraRequest===directCamera.cameraRequest&&JSON.stringify(directVariant.camera)===JSON.stringify(directCamera.camera)&&directVariant.time===directCamera.time&&directVariant.motionTime===directCamera.motionTime&&samePlan((await draft()).plan,original)&&JSON.stringify((await draft()).construction)===receipts,{resultId:directResult.resultId});
 assert(directSwap.with.scope==='district','Restored legacy direct comparison must have a real district model');
 const directSite=projectGeometry[mode].placements[`${directSwap.with.initiativeId}:${directSwap.with.districtId}`],directBounds=directSite&&projectGeometry[mode].projectFocusBounds(directSite);
 assert(directBounds?.length>=8,'The directly calculated replacement needs its real physical volume');
 const directLayout=await page.locator('.alternative-overlay').evaluate(paper=>{
  const r=paper.getBoundingClientRect();return {sheet:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},occlusions:[...document.querySelectorAll('[data-occludes-city]')].filter(node=>!node.hidden&&getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0).map(node=>{const b=node.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom};})};
 });
 const directPhysical=projectContextVisibility({physicalBounds:directBounds,camera:directVariant.camera,...directLayout,mobile:true}),directObject=directVariant.interventions.find(item=>item.key===directSite.key);
 check('One-tap phone comparison exposes the actual calculated replacement above its sheet',!!directObject&&directObject.state==='outcome'&&directObject.origin.every((value,i)=>value===directSite.origin[i])&&JSON.stringify(directVariant.camera)===JSON.stringify(directVariant.renderCamera)&&directPhysical.visible,{swapId:directSwap.id,project:directObject,physical:directPhysical,layout:directLayout});
 await assertPhoneWayfinding(directPhysical);
 await shot('direct-phone-evaluated-one-slot');
 // The editable path remains an explicit, separate choice. Retain the existing
 // native manual-confirmation, touch-hold and useful-model-volume gates below.
 await tap('phone: explicitly edit the calculated variant',page.getByTestId('future-comparison').getByRole('button',{name:'Edit alternative',exact:true}));await waitView('proposal');
 await tap('phone: open the replacement catalogue',page.locator('.proposal-catalogue-link'));await waitView('catalogue');
 await tap('phone: choose actual sports alternative',page.locator('.project-choice[data-project=M9]'));await waitView('proposal');
 const district=await page.locator('.candidate select').inputValue(),alternativePlan=original.map(item=>item.initiativeId===directSwap.replace.initiativeId?decision('M9',district):item),alternativeResult=expectedResult(alternativePlan);
 const confirmation=page.getByTestId('held-project').locator('.proposal-confirmation .primary'),confirmControl=await exposedControl(confirmation);
 check('Phone explicit alternative confirmation is exposed before tapping',confirmControl.visible&&confirmControl.fontSize>=12&&await confirmation.isEnabled(),{control:confirmControl});
 await tap('phone: confirm evaluated alternative',confirmation);await page.getByTestId('future-comparison').waitFor();await settledCamera();
 check('Phone comparison arrival gives useful focus to its own sheet',await page.evaluate(()=>!!document.activeElement?.closest('[data-testid=future-comparison]')));
 await assertFutureControls();
 const group=page.getByRole('group',{name:'Choose a future'}),mine=group.getByRole('button',{name:'My plan',exact:true}),variantButton=group.getByRole('button',{name:'Alternative',exact:true}),hold=page.getByTestId('future-switcher').locator('.hold-future');
 const phoneLayout=await page.getByTestId('future-switcher').evaluate(node=>{
  const paper=node.closest('.alternative-overlay'),tabs=node.querySelector('.future-toggle'),r=paper.getBoundingClientRect();
  return {scroll:paper.scrollTop,scrollWidth:paper.scrollWidth,clientWidth:paper.clientWidth,direction:getComputedStyle(tabs).flexDirection,sheet:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},height:innerHeight};
 });
 check('Short-phone comparison exposes a single-row selector at scroll zero without horizontal overflow',phoneLayout.scroll===0&&phoneLayout.direction==='row'&&phoneLayout.scrollWidth<=phoneLayout.clientWidth&&phoneLayout.sheet.top>=130+44&&phoneLayout.sheet.bottom<=phoneLayout.height-55,{layout:phoneLayout});
 const comparison=await snapshot();
 const assertOriginalUntouched=async(label)=>check(label,samePlan((await draft()).plan,original)&&JSON.stringify((await draft()).construction)===receipts&&await page.getByTestId('remaining-budget').innerText()===String(result.summary.remaining));
 const assertMatched=async(label)=>{
  const current=await snapshot();
  check(label,current.cameraRequest===comparison.cameraRequest&&['x','y','yaw','pitch','zoom'].every(k=>Math.abs(current.camera[k]-comparison.camera[k])<.0001)&&current.time===comparison.time&&Number.isFinite(current.motionTime)&&current.motionTime===comparison.motionTime&&JSON.stringify(current.construction)===receipts&&samePlan(current.plan,original),{camera:current.camera,time:current.time,motionTime:current.motionTime});
 };
 await tap('phone: tap evaluated variant',variantButton);await settledCamera();await assertFutureControls();
 await assertPhoneNavigation();
 check('Phone variant displays the independently evaluated canonical result',await page.getByTestId('future-comparison').getAttribute('data-result-id')===alternativeResult.resultId&&Math.abs(parseNumber(await page.getByTestId('displayed-future-score').innerText())-alternativeResult.finalScore)<=.0051,{resultId:alternativeResult.resultId,plan:alternativePlan});
 await assertMatched('Phone variant keeps exactly matched camera, light, motion and original receipt clocks');
 const variant=await snapshot(),site=projectGeometry[mode].placements[`M9:${district}`],physicalBounds=site&&projectGeometry[mode].projectFocusBounds(site);
 assert(physicalBounds?.length>=8,'Real alternative model bounds are required');
 const actualGeometry=await page.locator('.alternative-overlay').evaluate(paper=>{
  const r=paper.getBoundingClientRect();return {sheet:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},occlusions:[...document.querySelectorAll('[data-occludes-city]')].filter(node=>!node.hidden&&getComputedStyle(node).display!=='none'&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0).map(node=>{const b=node.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom};})};
 });
 // Bounds come from the actual project's source model, rather than the first
 // saved intervention (which may be a distant unchanged school). Projection
 // remains the independent homogeneous oracle used by the full camera audit.
 const physical=projectContextVisibility({physicalBounds,camera:variant.camera,...actualGeometry,mobile:true}),actualProject=variant.interventions.find(item=>item.key===site.key);
 check('Phone alternative model has a useful exposed volume above its comparison sheet',!!actualProject&&actualProject.state==='outcome'&&actualProject.origin.every((value,i)=>value===site.origin[i])&&JSON.stringify(variant.camera)===JSON.stringify(variant.renderCamera)&&physical.visible,{project:actualProject,geometry:actualGeometry,physical});
 await assertPhoneWayfinding(physical);
 await shot('02-phone-variant-and-place');
 await tap('phone: select original before touch hold',mine);const holdControl=await exposedControl(hold);
 check('Phone touch hold is exposed before touching',holdControl.visible,{control:holdControl});
 const box=await hold.boundingBox();assert(box,'Phone hold bounds required');
 const touch=await active.context.newCDPSession(page);
 try{
  // Chromium's real touch input generates pointer capture/release. No DOM
  // event is synthesized and no application method or store is called.
  await action('phone: touch holds variant',()=>touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,radiusX:1,radiusY:1,force:1}]}));
  await page.waitForFunction(()=>document.querySelector('.future-toggle button:last-child')?.getAttribute('aria-pressed')==='true');
  check('Real phone touch hold shows the canonical variant',await page.getByTestId('future-comparison').getAttribute('data-result-id')===alternativeResult.resultId);
 }finally{await action('phone: touch release restores original',()=>touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}));await touch.detach();}
 await page.waitForFunction(()=>document.querySelector('.future-toggle button:first-child')?.getAttribute('aria-pressed')==='true');
 check('Phone touch release restores the canonical original',await page.getByTestId('future-comparison').getAttribute('data-result-id')===result.resultId);
 await assertMatched('Phone touch release preserves matched camera, light, motion and receipts');
 for(let i=0;i<80&&!await hold.evaluate(node=>document.activeElement===node);i++)await key('Tab');
 check('Real keyboard navigation reaches the phone hold control',await hold.evaluate(node=>document.activeElement===node)&&(await exposedControl(hold)).visible);
 await action('phone: keyboard holds variant',()=>page.keyboard.down('Space'));await page.waitForFunction(()=>document.querySelector('.future-toggle button:last-child')?.getAttribute('aria-pressed')==='true');
 check('Phone keyboard hold shows the same canonical variant',await page.getByTestId('future-comparison').getAttribute('data-result-id')===alternativeResult.resultId);
 await action('phone: keyboard release restores original',()=>page.keyboard.up('Space'));await page.waitForFunction(()=>document.querySelector('.future-toggle button:first-child')?.getAttribute('aria-pressed')==='true');
 await action('phone: keyboard holds before Escape',()=>page.keyboard.down('Space'));await page.waitForFunction(()=>document.querySelector('.future-toggle button:last-child')?.getAttribute('aria-pressed')==='true');
 await key('Escape');await action('phone: release escaped Space',()=>page.keyboard.up('Space'));
 check('Phone Escape releases temporary future and preserves the focused comparison',await page.getByTestId('future-comparison').getAttribute('data-result-id')===result.resultId&&await hold.evaluate(node=>document.activeElement===node));
 await assertMatched('Phone keyboard release and Escape preserve exact comparison conditions');
 const footerButtons=page.getByTestId('future-comparison').locator('.future-decisions button'),lastMetric=page.getByTestId('future-comparison').locator('.local-future-difference li').last();
 assert(await lastMetric.count(),'The real evaluated comparison must have remaining district metrics');
 const footerExposed=async()=>{
  const controls=await Promise.all([0,1,2].map(index=>exposedControl(footerButtons.nth(index))));
  return {controls,visible:controls.every(control=>control.visible&&control.fontSize>=12)&&(await exposedControl(lastMetric)).visible};
 };
 const scrolling=await active.context.newCDPSession(page);
 try{
  for(let attempt=0;attempt<4&&!(await footerExposed()).visible;attempt++){
   const gesture=await page.getByTestId('future-comparison').evaluate(node=>{
    const paper=node.closest('.alternative-overlay').getBoundingClientRect(),body=node.querySelector('.local-future-difference').getBoundingClientRect();
    const top=Math.max(paper.top+12,body.top+8),bottom=Math.min(paper.bottom-16,body.bottom-8);
    return {x:(paper.left+paper.right)/2,start:bottom,end:Math.max(paper.top+16,bottom-(paper.bottom-paper.top)*.7),insideBody:bottom>top};
   });
   assert(gesture.insideBody,'A real visible comparison body area is required for touch scrolling');
   await action(`phone: real touch swipe through comparison details ${attempt+1}`,async()=>{
    let down=false;
    try{
     await scrolling.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:gesture.x,y:gesture.start,radiusX:1,radiusY:1,force:1}]});down=true;
     for(let step=1;step<=12;step++){
      await scrolling.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:gesture.x,y:gesture.start+(gesture.end-gesture.start)*step/12,radiusX:1,radiusY:1,force:1}]});
      await new Promise(resolve=>setTimeout(resolve,20));
     }
    }finally{if(down)await scrolling.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   });
   // Native momentum may finish after the contact is released. Observe it;
   // never write scrollTop or manufacture a DOM scroll event.
   await page.waitForFunction(()=>{
    const paper=document.querySelector('.alternative-overlay');return !!paper&&paper.scrollTop>0;
   },null,{timeout:5000});
  }
 }finally{await scrolling.detach();}
 await page.waitForFunction(()=>{
  const sheet=document.querySelector('[data-testid=future-comparison]'),nodes=[...sheet.querySelectorAll('.future-decisions button'),sheet.querySelector('.local-future-difference li:last-child')];
  return nodes.length===4&&nodes.every(node=>{if(!node)return false;const r=node.getBoundingClientRect(),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&!!hit&&node.contains(hit);});
 },null,{timeout:5000});
 const scrolledFooter=await footerExposed(),scrolledMetric=await exposedControl(lastMetric);
 check('Real phone touch scrolling exposes remaining metrics and every comparison footer action',scrolledFooter.visible&&scrolledMetric.sheetScroll>0,{footer:scrolledFooter.controls,lastMetric:scrolledMetric});
 await assertMatched('Phone touch scrolling preserves the matched camera, light, motion, original plan and receipts');
 await assertPhoneNavigation();await shot('04-phone-comparison-scrolled');
 // No initial-control assertion follows. Real keyboard navigation may scroll
 // the focused controls into view as it reaches the existing discard action.
 const discard=page.getByTestId('future-comparison').getByRole('button',{name:'Keep my plan',exact:true});
 for(let i=0;i<80&&!await discard.evaluate(node=>document.activeElement===node);i++)await key('Tab');
 check('Phone keyboard can reach the real discard action',await discard.evaluate(node=>document.activeElement===node));
 await key('Enter');await waitView('result');await page.getByTestId('outcome-sheet').waitFor();
 await page.waitForFunction(()=>!!document.activeElement?.closest('[data-testid=outcome-sheet]'));
 check('Phone comparison returns useful keyboard focus to the original result',await page.getByTestId('future-comparison').count()===0&&await page.evaluate(()=>!!document.activeElement?.closest('[data-testid=outcome-sheet]')));
 await assertOriginalUntouched('Phone touch and keyboard comparison never adopt or alter the baseline plan');
 await assertPhoneNavigation();
 check('Phone returned result retains the original canonical score',Math.abs(parseNumber(await page.locator('.result-score>strong').innerText())-result.finalScore)<=.0051,{resultId:result.resultId});
 await shot('03-phone-result-after-keyboard-return');
 check('Phone result/comparison has no uncaught errors',active.record.errors.length===0);await end();
}
try{
 if(['all','journey'].includes(suite))for(const mode of modes)await functionJourney(mode);
 if(['all','journey'].includes(suite))for(const mode of modes)await builtPersonPlaceJourney(mode);
 if(['all','screens'].includes(suite))for(const mode of modes)for(const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:1280,height:720},{width:820,height:1180},{width:390,height:667},{width:360,height:640}])await screenInspection(mode,viewport);
 if(['all','legacy'].includes(suite))for(const mode of modes)await legacyRestoration(mode);
 if(['all','phone-results'].includes(suite))for(const mode of modes)await phoneResultComparison(mode);
 if(suite==='all')check('All requested functional, viewport, legacy and touch-phone profiles complete',report.profiles.length===modes.length*10,{profiles:report.profiles.length,expectedProfiles:modes.length*10});
 report.completed=true;report.fullGate=suite==='all'&&modes.length===2;
}catch(error){report.failure=String(error);report.stack=error.stack;process.exitCode=1;console.error(error);if(active)await shot('failure').catch(()=>{});}
finally{
 await end().catch(error=>{report.cleanupError=String(error);process.exitCode=1;});await browser.close();
 report.finishedAt=new Date().toISOString();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
}
