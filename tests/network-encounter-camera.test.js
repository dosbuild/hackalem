import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import astana from '../src/world/astana-definition.js';
import khanate from '../src/world/khanate/definition.js';
import {MAX_ZOOM,anchorPose,boundedPose,clamp,confinePose,geoPoint,inversePoint} from '../src/world/city-math.js';
import {cameraFrame,fitContext,revealFocus,occluded} from '../src/world/projection.js';
import {routeAt} from '../src/world/placement-geometry.js';
import {RESIDENT_HEIGHT} from '../src/world/resident-models.js';
import {collectProgramSites,resolveProgramAnchor} from '../src/world/program-runtime.js';

// Execute the production closures, just as manual-camera-controls.test.js does.
// The real world definitions and shared Float32 projection supply their data;
// WebGL depth, DOM effect ordering and animated arrival need native verification.
const source=readFileSync(new URL('../src/world/runtime-core.js',import.meta.url),'utf8');
function productionFunction(name){
 const start=source.indexOf(`\n function ${name}(`);
 if(start<0)throw Error('Missing production camera function '+name);
 const end=source.indexOf('\n function ',start+1);
 if(end<0)throw Error('Missing camera function boundary after '+name);
 return source.slice(start,name==='visitLandmark'?source.indexOf('\n const people=',start):end);
}
const constants=source.split('\n').find(line=>line.startsWith('const PHONE_ENCOUNTER_MAX_ZOOM='));
const constrain=source.split('\n').find(line=>line.startsWith(' const constrain='));
const functions=['selectedNetworkSite','cameraZoomCeiling','boundCamera','resizeCamera','visitLandmark','projectFocus','focusProject','projectClose','encounterPosition','encounterCamera','focusPoint','safeFocus','flight','overview','camera','showEncounter','interruptFlight','preserveCamera','orbit','zoom'].map(productionFunction).join('\n');
const focusTick=source.split('\n').find(line=>line.includes('if((safeDirty||occlusionDirty&&!manualCamera)'));
if(!focusTick)throw Error('Missing production focus ownership gate');
const sitePosition=[71.431,51.139];
const worlds=[astana,khanate],districts=['esil','almaty','saryarka','baikonur','nura'];
const profiles=[
 {name:'desktop',width:1440,height:900,occlusions:[{left:16,right:400,top:140,bottom:790}]},
 {name:'short phone',width:390,height:667,occlusions:[{left:0,right:390,top:460,bottom:667}],annotation:{width:374,height:207}},
 {name:'small phone',width:360,height:640,occlusions:[{left:0,right:360,top:433,bottom:640}],annotation:{width:344,height:207}},
];

function controls(world,key,profile=profiles[0],options={}){
 const site=world.projects.placements[key],prior={...world.choreography.closePose(site),yaw:.42,pitch:.65,zoom:288,...options.pose},focus=inversePoint(0,0,cameraFrame(prior,profile.width,profile.height).matrix,site.origin);
 return new Function('world','site','profile','options','prior','focus','anchorPose','boundedPose','clamp','confinePose','geoPoint','inversePoint','cameraFrame','fitContext','revealFocus','routeAt','RESIDENT_HEIGHT','MAX_ZOOM','collectProgramSites','resolveProgramAnchor',`
  const {placements}=world.projects,{OVERVIEW,CLOSE_ZOOM,closePose}=world.choreography,isHeroSchool=world.isHeroSchool;
  const {features:districts}=world.bootstrap.districts,anchors=world.bootstrap.anchors;
  const projectionOptions={overviewZoom:OVERVIEW.zoom};let width=profile.width,height=profile.height,cameraZoomLimit=options.zoomLimit??MAX_ZOOM,networkEncounterCamera=false;
  ${constants}
  const element={dataset:{},getBoundingClientRect:()=>({left:0,top:0})},landmarkExplorer={selected:null,clear(){}},savedView=null,reduced=()=>false;
  ${constrain}
  let manualControls=0;
  let props={focusedDistrict:site.district,commitments:[{initiativeId:site.id,scope:'district',districtId:site.district}],candidate:null,occlusions:profile.occlusions,cameraRequest:{id:41,kind:'location',anchorId:'scenario:'+site.key},onManualControl:()=>manualControls++};
  let current={...prior},target={...prior},frame=cameraFrame(current,width,height,0,projectionOptions),scene=null,appState=null,lastCamera=41;
  let objects=world.projects.projectObjects(props,districts),sites=collectProgramSites(objects,world.projects.programSites),focusedSite=null,geographicFocus=focus&&[...focus],geographicHeight=site.origin[2],annotation=profile.annotation??null;
  let actorAnchor=null,encounterReturn=null,safeDirty=false,occlusionDirty=false,manualCamera=options.manual??false,scenarioDirty=false,cameraFlight=false,directInput=false;
  let inspectionOrbit=null,choreography=null,animation=null,choreographyControlsCamera=false,quality='resident',lastWorldDraw=0;
  const setQuality=()=>{},safeRects=()=>[...(props.occlusions||[]),...(annotation&&width<=800?[{left:8,right:width-8,top:height-annotation.height-8,bottom:height}]:[])];
  ${functions}
  return {
   show:showEncounter,fit:safeFocus,
   tick(){${focusTick}},
   settle(){current={...target};frame=cameraFrame(current,width,height,0,projectionOptions);},
   request(request){props={...props,cameraRequest:request};camera(request);},
   zoom,orbit,manual:interruptFlight,preserve:preserveCamera,overview,fly:flight,landmark:visitLandmark,
   resize(next){width=next.width;height=next.height;props={...props,occlusions:next.occlusions};annotation=next.annotation??null;resizeCamera();},
   clicked(position){actorAnchor=position;},
   position:encounterPosition,
   state(){return {target:{...target},focus:geographicFocus&&[...geographicFocus],height:geographicHeight,manual:manualCamera,zoomLimit:cameraZoomCeiling(),networkEncounterCamera,safeDirty,occlusionDirty,request:lastCamera,actorAnchor,encounterReturn,scene,appState,scenarioDirty,cameraFlight,directInput,manualControls,inspectionOrbit};},
  };
 `)(world,site,profile,options,prior,focus,anchorPose,boundedPose,clamp,confinePose,geoPoint,inversePoint,cameraFrame,fitContext,revealFocus,routeAt,RESIDENT_HEIGHT,MAX_ZOOM,collectProgramSites,resolveProgramAnchor);
}
function encounter(site,resident='resident-at-'+site.key){return {selectedId:resident,anchor:{id:'scenario:'+site.key},residents:[]};}
function body(position){
 const radius=RESIDENT_HEIGHT*.6;
 return [-radius,radius].flatMap(x=>[-radius,radius].flatMap(y=>[0,RESIDENT_HEIGHT].map(z=>[position[0]+x,position[1]+y,position[2]+z])));
}
function projectedBody(world,pose,position,profile){
 const frame=cameraFrame(pose,profile.width,profile.height,0,{overviewZoom:world.choreography.OVERVIEW.zoom});
 return {corners:body(position).map(frame.world),height:Math.hypot(frame.world(position).x-frame.world([position[0],position[1],position[2]+RESIDENT_HEIGHT]).x,frame.world(position).y-frame.world([position[0],position[1],position[2]+RESIDENT_HEIGHT]).y)};
}
function context(state){return {target:state.target,focus:state.focus,height:state.height,manual:state.manual,zoomLimit:state.zoomLimit,request:state.request};}

describe('network encounters retain a resident-sized camera context',()=>{
 for(const world of worlds)it(`${world.id}: explicit City dismissal preserves a child conversation camera`,()=>{
  const decision={initiativeId:'M8',scope:'district',districtId:'esil'},objects=world.projects.projectObjects({commitments:[decision],candidate:null},world.bootstrap.districts.features),site=collectProgramSites(objects,world.projects.programSites).find(s=>s.isChild),c=controls(world,'M8:esil');
  c.show({selectedId:'child-resident',anchor:{id:'program:'+site.key},residents:[]},{});c.tick();c.settle();const before=c.state().target;
  c.preserve();c.show(null,{});c.tick();expect(c.state().target).toEqual(before);expect(c.state().encounterReturn).toBeNull();expect(c.state().cameraFlight).toBe(false);
 });
 for(const world of worlds)for(const id of ['M4','M8'])for(const profile of profiles)it(`${world.id} ${id}: child conversations frame their own resident and return to the inspected area on ${profile.name}`,()=>{
  const key=`${id}:esil`,decision={initiativeId:id,scope:'district',districtId:'esil'},objects=world.projects.projectObjects({commitments:[decision],candidate:null},world.bootstrap.districts.features),site=collectProgramSites(objects,world.projects.programSites).find(s=>s.isChild),c=controls(world,key,profile,{pose:{zoom:24}});
  expect(site).toBeDefined();const before=context(c.state()),selected={selectedId:'child-resident',anchor:{id:'program:'+site.key},residents:[]};
  c.show(selected,{});c.request({id:42,kind:'location',anchorId:selected.anchor.id});c.tick();
  const position=c.position(),projected=projectedBody(world,c.state().target,position,profile);
  expect(position).toEqual(site.peopleSpots[0].position);
  expect(projected.corners.every(p=>p.visible&&!occluded(p,profile.occlusions))).toBe(true);
  if(profile.width<=800)expect(projected.height).toBeCloseTo(32,1);else expect(projected.height).toBeGreaterThan(13);
  c.show(null,{});c.tick();expect(c.state().target).toEqual(before.target);expect(c.state().encounterReturn).toBeNull();
 });
 for(const world of worlds)for(const id of ['M1','M3'])for(const profile of profiles){
  it(`${world.id} ${id}: all five resident bodies remain outside ${profile.name} sheets without fitting the route`,()=>{
   for(const district of districts){
    const site=world.projects.placements[`${id}:${district}`],c=controls(world,site.key,profile);
    c.show(encounter(site),{world:world.id});c.tick();
    const {target}=c.state(),position=site.peopleSpots[0].position,projected=projectedBody(world,target,position,profile);
    // Long authored route/project bounds must not shrink a selected resident.
    if(profile.width<=800){expect(target.zoom,site.key).toBeGreaterThan(576);expect(target.zoom,site.key).toBeLessThanOrEqual(2304);expect(projected.height,site.key).toBeCloseTo(32,1);}else expect(target.zoom,site.key).toBe(288);
    expect(c.position(),site.key).toEqual(position);
    expect(projected.height,site.key).toBeGreaterThan(profile.width>800?13:10);
    const rects=[...profile.occlusions,...(profile.annotation?[{left:8,right:profile.width-8,top:profile.height-profile.annotation.height-8,bottom:profile.height}]:[])];
    for(const point of projected.corners){
     expect(point.visible,site.key).toBe(true);
     expect(point.x,site.key).toBeGreaterThanOrEqual(16-1e-3);
     expect(point.x,site.key).toBeLessThanOrEqual(profile.width-16+1e-3);
     expect(point.y,site.key).toBeGreaterThanOrEqual(profile.width<=800?110-1e-3:140-1e-3);
     expect(point.y,site.key).toBeLessThanOrEqual(profile.height-(profile.width<=800?85:145)+1e-3);
     expect(occluded(point,rects),site.key).toBe(false);
    }
   }
  });
  it(`${world.id} ${id}: a later same-place camera request and scene refresh retain the resident on ${profile.name}`,()=>{
   for(const district of districts){
    const site=world.projects.placements[`${id}:${district}`],c=controls(world,site.key,profile),selected=encounter(site);
    // ResidentsSpace can show the encounter in the current effect pass, then
    // deliver focusLocation in the next commit. Exercise that exact order.
    c.show(selected,{revision:1});
    c.request({id:42,kind:'location',anchorId:selected.anchor.id});
    c.show({...selected},{revision:2});c.tick();
    const {target,request}=c.state(),position=c.position(),projected=projectedBody(world,target,position,profile);
    expect(request,site.key).toBe(42);
    if(profile.width<=800){expect(target.zoom,site.key).toBeGreaterThan(576);expect(target.zoom,site.key).toBeLessThanOrEqual(2304);expect(projected.height,site.key).toBeCloseTo(32,1);}else expect(target.zoom,site.key).toBe(288);
    expect(position,site.key).toEqual(site.peopleSpots[0].position);
    expect(projected.height,site.key).toBeGreaterThan(profile.width>800?13:10);
    const rects=[...profile.occlusions,...(profile.annotation?[{left:8,right:profile.width-8,top:profile.height-profile.annotation.height-8,bottom:profile.height}]:[])];
    for(const point of projected.corners){
     expect(point.visible,site.key).toBe(true);
     expect(point.x,site.key).toBeGreaterThanOrEqual(16-1e-3);
     expect(point.x,site.key).toBeLessThanOrEqual(profile.width-16+1e-3);
     expect(point.y,site.key).toBeGreaterThanOrEqual(profile.width<=800?110-1e-3:140-1e-3);
     expect(point.y,site.key).toBeLessThanOrEqual(profile.height-(profile.width<=800?85:145)+1e-3);
     expect(occluded(point,rects),site.key).toBe(false);
    }
   }
  });
 }
 for(const district of districts)it(`Astana M3 ${district}: face the actual station from the cleared canonical side`,()=>{
  const site=astana.projects.placements[`M3:${district}`],station=routeAt(site.route,.5),person=site.peopleSpots[0].position,c=controls(astana,site.key);
  c.show(encounter(site),{});
  const {target}=c.state(),side=-(person[0]-station.point[0])*Math.sin(station.angle)+(person[1]-station.point[1])*Math.cos(station.angle),direction=side>0?Math.PI-station.angle:-station.angle;
  expect(Math.sin(target.yaw)).toBeCloseTo(Math.sin(direction),12);
  expect(Math.cos(target.yaw)).toBeCloseTo(Math.cos(direction),12);
  expect(target.pitch).toBe(1);
 });
 for(const world of worlds)for(const id of ['M1','M3']){
  for(const manual of [false,true])it(`${world.id} ${id}: closing restores the exact previously ${manual?'manually':'automatically'} inspected context`,()=>{
   const site=world.projects.placements[`${id}:esil`],c=controls(world,site.key,profiles[1],{manual}),before=context(c.state());
   const state={world:world.id};c.show(encounter(site),state);c.tick();c.settle();
   expect(c.state().target).not.toEqual(before.target);
   expect(c.state().appState).toBe(state);
   c.show(null,state);c.tick();
   expect(context(c.state())).toEqual(before);
   expect(c.state().encounterReturn).toBeNull();
  });
  for(const manual of [false,true])it(`${world.id} ${id}: a delayed same-place request retains the ${manual?'manual':'automatic'} return context`,()=>{
   const site=world.projects.placements[`${id}:esil`],c=controls(world,site.key,profiles[2],{manual}),before=context(c.state()),clicked=site.peopleSpots.at(-1).position,selected=encounter(site,'clicked-person');
   c.clicked(clicked);c.show(selected,{revision:1});
   c.request({id:42,kind:'location',anchorId:selected.anchor.id});
   c.show({...selected},{revision:2});c.tick();c.settle();
   expect(c.position()).toBe(clicked);
   expect(projectedBody(world,c.state().target,c.position(),profiles[2]).height).toBeCloseTo(32,1);
   c.show(null,{revision:3});c.tick();
   expect(context(c.state())).toEqual({...before,request:42});
   expect(c.state().actorAnchor).toBeNull();
   expect(c.state().encounterReturn).toBeNull();
  });
  it(`${world.id} ${id}: phone manual ownership retains headroom after zooming out, refresh and close`,()=>{
   const site=world.projects.placements[`${id}:esil`],c=controls(world,site.key,profiles[1]),selected=encounter(site);
   c.show(selected,{});c.tick();c.settle();
   for(let i=0;i<5;i++)c.zoom(-1);
   expect(c.state().target.zoom).toBeLessThan(576);
   const controlled=context(c.state());c.show({...selected},{});c.tick();c.show(null,{});c.tick();
   expect(context(c.state())).toEqual(controlled);expect(c.state().zoomLimit).toBe(2304);
   for(let i=0;i<10;i++)c.zoom(1);
   expect(c.state().target.zoom).toBe(2304);
  });
  it(`${world.id} ${id}: automatic close restores an earlier extended manual view and its ceiling`,()=>{
   const site=world.projects.placements[`${id}:esil`],c=controls(world,site.key,profiles[1],{manual:true,zoomLimit:2304,pose:{zoom:1800}}),before=context(c.state());
   c.show(encounter(site),{});c.tick();c.settle();c.show(null,{});c.tick();
   expect(context(c.state())).toEqual(before);c.settle();c.zoom(1);expect(c.state().target.zoom).toBe(2304);
  });
  it(`${world.id} ${id}: automatic encounters recompute for both phone widths and desktop`,()=>{
   const site=world.projects.placements[`${id}:esil`],c=controls(world,site.key,profiles[1]);c.show(encounter(site),{});c.tick();c.settle();
   for(const profile of [profiles[2],profiles[0],profiles[1]]){
    c.resize(profile);c.tick();c.settle();const state=c.state(),projected=projectedBody(world,state.target,c.position(),profile);
    if(profile.width<=800){expect(projected.height).toBeCloseTo(32,1);expect(state.zoomLimit).toBe(2304);}else{expect(state.target.zoom).toBe(288);expect(state.zoomLimit).toBe(576);}
    for(const point of projected.corners){expect(point.visible).toBe(true);expect(occluded(point,profile.occlusions)).toBe(false);}
   }
  });
  it(`${world.id} ${id}: a manual resize keeps ownership and limits desktop zoom`,()=>{
   const site=world.projects.placements[`${id}:esil`],c=controls(world,site.key,profiles[1]);c.show(encounter(site),{});c.tick();c.settle();c.zoom(1);c.settle();
   const manual=context(c.state());c.resize(profiles[2]);c.tick();expect(c.state().target.zoom).toBe(manual.target.zoom);expect(c.state().manual).toBe(true);
   c.resize(profiles[0]);c.tick();expect(c.state().target.zoom).toBe(576);expect(c.state().manual).toBe(true);
   c.resize(profiles[1]);c.tick();c.settle();c.zoom(1);expect(c.state().target.zoom).toBeGreaterThan(576);expect(c.state().zoomLimit).toBe(2304);
  });
  for(const [name,leave]of [
   ['project label',c=>c.fly(sitePosition,160)],
   ['project',c=>c.request({id:42,kind:'location',anchorId:'scenario:M7:nura'})],
   ['district',c=>c.request({id:42,kind:'district',districtId:'nura'})],
   ['overview',c=>c.overview()],
   ['landmark',c=>c.landmark({id:'test',position:sitePosition,focusHeight:12,zoom:160})],
  ])it(`${world.id} ${id}: an explicit ${name} destination restores ordinary headroom`,()=>{
   const site=world.projects.placements[`${id}:esil`],c=controls(world,site.key,profiles[1],{manual:true,zoomLimit:2304,pose:{zoom:1800}});c.show(encounter(site),{});c.tick();c.settle();leave(c);const destination=context(c.state());expect(c.state().networkEncounterCamera).toBe(false);
   for(const profile of [profiles[2],profiles[0],profiles[1]]){c.resize(profile);c.tick();expect(c.state().zoomLimit).toBe(576);expect(c.state().target.zoom).toBeLessThanOrEqual(576);expect(c.state().networkEncounterCamera).toBe(false);}
   const resized=context(c.state());c.show(null,{});expect(context(c.state())).toEqual(resized);expect(c.state().encounterReturn).toBeNull();c.settle();
   // Home has no focused world point to refit; its exact destination survives resize.
   if(name==='overview')expect(resized).toEqual(destination);
   expect(c.state().zoomLimit).toBe(576);for(let i=0;i<30;i++)c.zoom(1);expect(c.state().target.zoom).toBe(576);
  });
  it(`${world.id} ${id}: refreshing the same conversation preserves a resident's manual camera takeover`,()=>{
   const site=world.projects.placements[`${id}:esil`],c=controls(world,site.key),selected=encounter(site);
   c.show(selected,{});c.tick();c.settle();c.zoom(1);
   const controlled=context(c.state());c.show({...selected},{});c.tick();
   expect(context(c.state())).toEqual(controlled);
   expect(c.state().manual).toBe(true);
   c.show(null,{});c.tick();
   expect(context(c.state())).toEqual(controlled);
  });
  it(`${world.id} ${id}: meeting a resident stops the previously started inspection orbit`,()=>{
   const site=world.projects.placements[`${id}:esil`],c=controls(world,site.key);
   c.orbit(true);expect(c.state().inspectionOrbit).not.toBeNull();
   c.show(encounter(site),{});
   expect(c.state().inspectionOrbit).toBeNull();
   c.tick();expect(c.state().target.zoom).toBeGreaterThanOrEqual(288);
  });
  it(`${world.id} ${id}: actual manual zoom outranks returning to an older context`,()=>{
   const site=world.projects.placements[`${id}:esil`],c=controls(world,site.key);
   c.show(encounter(site),{});c.tick();c.settle();c.zoom(1);
   const controlled=context(c.state());c.show(null,{});c.tick();
   expect(context(c.state())).toEqual(controlled);
   expect(c.state().manual).toBe(true);
   expect(c.state().manualControls).toBe(1);
   expect(c.state().encounterReturn).toBeNull();
  });
  it(`${world.id} ${id}: a new public project request outranks encounter return`,()=>{
   const site=world.projects.placements[`${id}:esil`],c=controls(world,site.key);
   c.show(encounter(site),{});c.tick();c.settle();
   c.request({id:42,kind:'location',anchorId:'scenario:M7:nura'});
   const requested=context(c.state());c.show(null,{});
   expect(context(c.state())).toEqual(requested);
   expect(c.state().request).toBe(42);
   expect(c.state().encounterReturn).toBeNull();
  });
  it(`${world.id} ${id}: a clicked actor's actual anchor takes precedence over the canonical first person`,()=>{
   const site=world.projects.placements[`${id}:esil`],c=controls(world,site.key),clicked=site.peopleSpots.at(-1).position;
   expect(clicked).not.toEqual(site.peopleSpots[0].position);
   const selected=encounter(site,'clicked-person');
   c.clicked(clicked);c.show(selected,{});c.tick();
   c.request({id:42,kind:'location',anchorId:selected.anchor.id});c.show({...selected},{});c.tick();
   expect(c.position()).toBe(clicked);
   const frame=cameraFrame(c.state().target,1440,900,0,{overviewZoom:world.choreography.OVERVIEW.zoom});
   expect(occluded(frame.world(clicked),profiles[0].occlusions)).toBe(false);
   if(world.id==='astana'&&id==='M3'){
    const station=routeAt(site.route,.5),side=-(clicked[0]-station.point[0])*Math.sin(station.angle)+(clicked[1]-station.point[1])*Math.cos(station.angle),direction=side>0?Math.PI-station.angle:-station.angle;
    expect(Math.cos(c.state().target.yaw-direction)).toBeCloseTo(1,12);
   }
   c.show(null,{});expect(c.state().actorAnchor).toBeNull();
  });
 }
 for(const world of worlds)it(`${world.id}: ordinary M7 encounters keep their existing place-fitting path`,()=>{
  const site=world.projects.placements['M7:nura'],c=controls(world,site.key),before=c.state().target;
  c.show(encounter(site),{});
  expect(c.state().target).toEqual(before);
  expect(c.state().encounterReturn).toBeNull();
  c.tick();const fitted=c.state().target;c.show(null,{});
  expect(c.state().target).toEqual(fitted);
  expect(c.state().encounterReturn).toBeNull();
 });
});
