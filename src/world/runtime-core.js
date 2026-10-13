import {cameraSession} from './camera-session.js';
import {inspectionPose} from './inspection-motion.js';
import {createLandmarkExplorer} from './landmark-explorer.js';
import {placeProjectLabel,projectLabelVolume,projectLabelPhysicalLeader,createProjectLabelFootprints,createProjectLabelSizes} from './label-layout.js';
import {sampleConstructionActivities} from './construction-sampler.js';
import {cameraFrame,revealFocus,fitContext,occluded} from './projection';
import {residentsMesh,RESIDENT_HEIGHT} from './resident-models';
import {routeAt} from './placement-geometry';
import {eventLight} from './intervention-effects';
import {rgb} from './mesh-kit';
import {collectProgramSites,programLocations,resolveProgramAnchor,nearestProgramSite} from './program-runtime.js';
import {currentPresentationResult} from './project-presentation.js';

import {createRenderer} from './city-gl';
import {fetchMapAsset} from './map-assets.js';
import {prepareCity} from './city-residency.js';
import {MAX_ZOOM,anchorPose,boundedPose,confinePose,geoPoint,inversePoint,contains,clamp,mix} from './city-math';


import {DISTRICT_COLORS} from './district-colors';


const PHONE_ENCOUNTER_MAX_ZOOM=2304,PHONE_ENCOUNTER_HEIGHT=32;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
/** The final static mesh is needed even when the camera's earlier build is done. */
export function constructionActivitiesRemoved(previous,current){
 for(const id in previous)if(!Object.hasOwn(current,id))return true;
 return false;
}
/** Close physical geometry changes only at its authored detail threshold. */
export function projectZoomChanged(previous,current,heroSchool=false){
 if(previous===current)return false;
 if(heroSchool&&(previous>24)!==(current>24))return true;
 if(previous>18&&current>18)return false;
 // The macro representation uses pixel-scaled geometry through zoom 18.
 // Crossings still update when smaller than the ordinary continuous deadband.
 if([12,15,18].some(threshold=>(previous>=threshold)!==(current>=threshold))||
    (previous>14)!==(current>14)||(previous>18)!==(current>18))return true;
 return Math.abs(current-previous)>Math.max(.002,current*.002);
}
export async function createCityRuntime(element,initial,bus,status,signal,world){
 const {bootstrap,projectNames,projectTitles,createTransitMotion:createLrtMotion,anchorFor,isHeroSchool}=world;
 const {projectObjects,projectMesh,footprintKinds,placements,lampPositions}=world.projects;
 const {createChoreography,OVERVIEW,CLOSE_ZOOM,closePose,eventPose}=world.choreography;
 const projectionOptions={overviewZoom:OVERVIEW.zoom},viewSession=cameraSession(world.id,undefined,PHONE_ENCOUNTER_MAX_ZOOM),savedView=viewSession.read();
 let cameraZoomLimit=viewSession.zoomLimit,networkEncounterCamera=false;
 const RESIDENTS=world.residents,SIGNATURE_RESIDENTS=RESIDENTS.filter(r=>r.signature);
 const base=import.meta.env.BASE_URL,abort=new AbortController(),preparationStarted=performance.now();let booting=true,firstFrame=null;
 element.dataset.ready='false';element.dataset.completeCity='false';element.dataset.loadProgress='0';
 const progress=value=>{const next=String(Math.min(99,Math.round(value*100)));if(element.dataset.loadProgress!==next){element.dataset.loadProgress=next;element.dispatchEvent(new Event('alem-progress'));}};
 signal?.throwIfAborted();const cancel=()=>abort.abort(signal?.reason);signal?.addEventListener('abort',cancel,{once:true});
 const {metadata}=bootstrap,{features:districts}=bootstrap.districts,anchors={...bootstrap.anchors};
 const constrain=v=>{const p=boundCamera(v),b=world.cameraBounds;if(b)return {...p,x:clamp(p.x,b[0],b[2]),y:clamp(p.y,b[1],b[3])};return element.dataset.landmarkActive==='true'?p:confinePose(v,districts,cameraZoomCeiling());};
 const canvas=document.createElement('canvas');
 const context=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});
 if(!context){signal?.removeEventListener('abort',cancel);throw Error('WebGL 2 недоступен');}
 const bootLoss=e=>{e.preventDefault();abort.abort(new Error('Контекст WebGL потерян'));};canvas.addEventListener('webglcontextlost',bootLoss);
 let data;const preparedBytes=metadata.residentBytes;try{data=await fetchMapAsset({...metadata,url:base+metadata.url},{signal:abort.signal,onProgress:value=>{progress(value*metadata.bytes/preparedBytes);}});abort.signal.throwIfAborted();}catch(error){signal?.removeEventListener('abort',cancel);canvas.removeEventListener('webglcontextlost',bootLoss);context.getExtension('WEBGL_lose_context')?.loseContext();throw error;}
 const identityFor=id=>{const d=districts.find(d=>d.id===id);return d?{name:d.properties.name,position:d.properties.center,color:DISTRICT_COLORS[id]}:null;};
 const overlay=document.createElement('canvas'),labels=document.createElement('div');canvas.className='alem-city';overlay.className='alem-overlay';labels.className='geo-labels';element.append(canvas,overlay,labels);const ctx=overlay.getContext('2d');let renderer;
 try{
  renderer=createRenderer(canvas,data,metadata,world.rendererOptions);data=null;
  await world.install?.(renderer,{base,signal:abort.signal});
  await prepareCity({tiles:metadata.tiles,base,renderer,signal:abort.signal,onProgress:p=>{
   element.dataset.loadedTiles=String(p.loaded);element.dataset.expectedTiles=String(p.total);
   progress((metadata.bytes+p.progress*p.totalBytes)/preparedBytes);
  }});
  abort.signal.throwIfAborted();
 }catch(e){signal?.removeEventListener('abort',cancel);canvas.removeEventListener('webglcontextlost',bootLoss);if(renderer)renderer.destroy();else context.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();overlay.remove();labels.remove();throw e;}
 canvas.removeEventListener('webglcontextlost',bootLoss);
 canvas.tabIndex=0;canvas.setAttribute('aria-label',world.mapLabel+'. Перетаскивание и стрелки — перемещение. Правая кнопка или Shift с перетаскиванием — поворот. Плюс и минус — масштаб, Home — обзор.');canvas.setAttribute('role','img');
 let alive=true,props=initial,scene=null,appState=null,lastCamera=-1,current={...OVERVIEW},target={...current},time=.16,timeFrom=.16,timeTo=.16,timeStart=0,timeDuration=0,resultRevision=null,planCount=initial.commitments.length,lastFrame=0,frameId,drag=null,width=1,height=1,lastInfo='',born=performance.now(),lastWorldDraw=0,nightLevel=0,renderedTime=.16,lastWidth=0,lastHeight=0,lastCameraSave=0;
 let lastProjectZoom=0,inspectionOrbit=null,initialLandmarkPending=true,lrtStarted=born;const lrtMotion=createLrtMotion();
 // Both futures use one paused visual clock. Real construction receipts retain
 // their wall-clock timestamps and continue while the comparison is open.
 let motionPause=0,comparisonAt=initial.comparisonSessionId?born:null;
 const motionNow=now=>(comparisonAt??now)-motionPause;
 const constructionNow=()=>props.constructionNow??Date.now();
 let schoolStart=constructionNow()-30000;
 let choreographyControlsCamera=true;
 const receiptFor=record=>props.construction?.find(r=>r.key===`${record.id}:${record.citywide?'city':record.district}`);
 let activities={};const quietConstruction=new Set(),constructionCache=new Map();
 let choreography=null,animation=null,actors=[],lastActorCount=0,lastActorKey=null,lastScenarioDraw=0,scenarioDirty=true,actorAnchor=null,encounterReturn=null;
 const hitTargets=[];let cameraFlight=false,directInput=false,manualCamera=false,occlusionDirty=false;let quality='resident';
 const usedBoxes=[],labelFootprints=createProjectLabelFootprints(),labelSizes=createProjectLabelSizes(window,document.fonts);
 const projectLabelGeometry=(record,mesh)=>{
  if(current.zoom<=15)return;
  const constructing=!record.proposal&&!!(activities[record.id]||animation?.id===record.id);
  // Static/dynamic builders own parent records; labels own child-place records.
  // Sample the same uploaded static triangles inside each measured child volume.
  for(const {o} of projectLabels)if(o.key===record.key||o.parentKey===record.key){
   if(constructing||mesh.byteLength)labelFootprints.capture(o,mesh,constructing);
  }
 };
 let frame=cameraFrame(current,1,1,0,projectionOptions),frameSerial=0,objects=[],sites=[],objectKey='',staticProgramKey='',projectLabels=[],annotation=null,safeDirty=true,geographicFocus=null,geographicHeight=0,focusedSite=null;
 const safeRects=()=>[...(props.occlusions||[]),...(annotation&&width<=800?[{left:8,right:width-8,top:height-annotation.height-8,bottom:height}]:[])];
 // The proposal and its camera share the actual useful model place (for
 // example a stop on a corridor or the principal roof of a citywide measure).
 function projectFocus(site){return !(isHeroSchool(site)||world.id==='khanate'&&site.id==='M7')&&(world.projects.projectPreviewFrame?.(site)?.center||site.view?.center)||site.origin;}
 function focusProject(site){if(!site)return;focusedSite=site;const p=projectFocus(site);geographicFocus=inversePoint(0,0,frame.matrix,p);geographicHeight=p[2];}
 function projectClose(site){const authored=world.projects.projectPreviewFrame?.(site),pose={...closePose(site),...(authored?.cameraYaw!==undefined?{yaw:authored.cameraYaw}:{})};if(world.id==='khanate'&&width<=800&&!site.route)pose.zoom*=1.65;if(isHeroSchool(site)||world.id==='khanate'&&site.id==='M7')return pose;const p=projectFocus(site);return {...pose,x:p[0]+Math.sin(pose.yaw)*Math.tan(pose.pitch)*p[2],y:p[1]+Math.cos(pose.yaw)*Math.tan(pose.pitch)*p[2],zoom:world.id==='astana'&&['M1','M2','M10','M11','M13','M14'].includes(site.id)?288:pose.zoom};}
 function encounterPosition(){
  const site=scene?.anchor.id?resolveProgramAnchor(scene.anchor.id,sites,placements):null;
  if(actorAnchor)return actorAnchor;
  if(isHeroSchool(site))return [site.origin[0]+Math.sin(site.orientation)*.0014,site.origin[1]-Math.cos(site.orientation)*.0014,site.origin[2]+.000085];
  return site?.peopleSpots?.[0]?.position||(site?[site.origin[0],site.origin[1]-.0017,site.origin[2]+.00008]:geoPoint(anchors[scene?.anchor.id]?.position||geographicFocus||[71.431,51.139],.00004));
 }
 function selectedNetworkSite(){const site=scene?.selectedId?resolveProgramAnchor(scene.anchor.id,sites,placements):null;return site&&['M1','M3'].includes(site.id)?site:null;}
 function focusPoint(){if(landmarkExplorer?.selected)return landmarkExplorer.selected.focusPosition||landmarkExplorer.selected.position;if(scene?.selectedId&&(!selectedNetworkSite()||networkEncounterCamera)){const position=encounterPosition();geographicFocus=inversePoint(0,0,frame.matrix,position);geographicHeight=position[2];}else if(props.candidate)focusProject(objects.find(o=>o.proposal&&o.district===props.focusedDistrict)||objects.find(o=>o.proposal));return geographicFocus;}
 function safeFocus(){
  const p=focusPoint();let rects=safeRects();
  // The atlas closes synchronously on selection. Read its current bounds here,
  // before React's ResizeObserver props catch up, so a closed menu cannot push
  // the next landmark toward the edge of a narrow screen.
  if(landmarkExplorer?.selected){const origin=element.getBoundingClientRect();rects=[...(element.closest('.play-application')||element.parentElement).querySelectorAll('[data-occludes-city]')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>{const r=el.getBoundingClientRect();return {left:r.left-origin.left,right:r.right-origin.left,top:r.top-origin.top,bottom:r.bottom-origin.top};});}
  if(p&&target.zoom>1.1){
   const site=focusedSite&&!scene?.selectedId?focusedSite:scene?.selectedId&&(!selectedNetworkSite()||networkEncounterCamera)&&resolveProgramAnchor(scene.anchor.id,sites,placements)?resolveProgramAnchor(scene.anchor.id,sites,placements):props.candidate?objects.find(o=>o.id===props.candidate.decision.initiativeId&&o.district===props.focusedDistrict):objects.find(o=>Math.hypot(o.position[0]-p[0],o.position[1]-p[1])<.00001)||(props.comparisonSessionId&&props.cameraRequest.kind==='location'&&props.cameraRequest.anchorId.startsWith('scenario:')?placements[props.cameraRequest.anchorId.slice(9)]:null);
   // A long route is useful context for its project, but not for a conversation.
   // Keep the actual resident readable instead of fitting kilometres of network.
   if(scene?.selectedId&&networkEncounterCamera&&site){
    const person=encounterPosition(),radius=RESIDENT_HEIGHT*.6,body=[-radius,radius].flatMap(x=>[-radius,radius].flatMap(y=>[0,RESIDENT_HEIGHT].map(z=>[person[0]+x,person[1]+y,person[2]+z])));
    let fitted=fitContext(target,body,width,height,rects,projectionOptions);
    if(width<=800&&!manualCamera)for(let step=0;step<2;step++){
     const view=cameraFrame(fitted,width,height,0,projectionOptions),foot=view.world(person),head=view.world([person[0],person[1],person[2]+RESIDENT_HEIGHT]),bodyHeight=Math.hypot(head.x-foot.x,head.y-foot.y);
     if(Number.isFinite(bodyHeight)&&bodyHeight>0)fitted=fitContext(boundCamera({...fitted,zoom:fitted.zoom*PHONE_ENCOUNTER_HEIGHT/bodyHeight}),body,width,height,rects,projectionOptions);
    }
    target=boundCamera(fitted);return;
   }
   if(site&&(!scene?.selectedId||objects.some(o=>o.key===site.key))){
    const size=world.projects.projectFocusBounds?.(site),w=world.id==='khanate'&&site.id==='M7'?.0064:site.size?.[0]??.006,d=world.id==='khanate'&&site.id==='M7'?.0064:site.size?.[1]??.006,h=world.id==='khanate'&&site.id==='M7'?.0006:isHeroSchool(site)?.00165:.0015,c=Math.cos(site.orientation??0),s=Math.sin(site.orientation??0);
    const points=size??[-1,1].flatMap(x=>[-1,1].flatMap(y=>[0,h].map(z=>[site.origin[0]+x*w*.5*c-y*d*.5*s,site.origin[1]+x*w*.5*s+y*d*.5*c,site.origin[2]+z])));
    // A network's fixture and its unchanged resident can be separate places.
    // Fit both once; this camera-only envelope never changes label footprints.
    const service=world.id==='astana'&&['M10','M13','M14'].includes(site.id),person=service&&(scene?.selectedId?encounterPosition():site.peopleSpots?.[0]?.position),radius=RESIDENT_HEIGHT*.6;
    const cameraPoints=person?[...points,...[-radius,radius].flatMap(x=>[-radius,radius].flatMap(y=>[0,RESIDENT_HEIGHT].map(z=>[person[0]+x,person[1]+y,person[2]+z])))]:points;
    target=boundCamera(fitContext(target,cameraPoints,width,height,rects,projectionOptions));
    // A fitted project volume is the context. Point-only nudging afterward can
    // move its visible edge back under the atlas or the bottom sheet.
    if(service||!scene?.selectedId)return;
   }
   target=boundCamera(revealFocus(target,p,width,height,rects,width<=800?20:48,geographicHeight,projectionOptions));
  }
 }
 function inspectProgram(site){
  if(!site)return;
  interruptFlight();flight(site.position,CLOSE_ZOOM,site.origin[2]);target=constrain(projectClose(site));focusProject(site);safeDirty=true;
  if(!site.proposal)props.onProgramInspect?.({initiativeId:site.id,districtId:site.district,siteId:site.key});
 }
 function syncProjects(){
  const next=projectObjects(props,districts,anchors),key=JSON.stringify(next.map(o=>[o.key,o.state,o.phase,o.revision,o.proposal,o.blocked,o.progress,o.resultId,o.program?.version]));
  if(key===objectKey)return;
  objectKey=key;objects=next;sites=collectProgramSites(objects,world.projects.programSites);
  for(const site of sites)if(site.isChild)site.position=inversePoint(0,0,frame.matrix,site.origin);
  if(focusedSite)focusedSite=sites.find(site=>site.key===focusedSite.key)??null;
  if(props.candidate)focusProject(objects.find(o=>o.proposal&&o.district===props.focusedDistrict)||objects.find(o=>o.proposal));
  props.onProgramLocations?.(programLocations(sites,projectNames));
  element.dataset.programSites=JSON.stringify(sites.map(o=>({key:o.key,parentKey:o.parentKey,id:o.id,district:o.district,phase:o.phase,origin:o.origin,source:o.source})));
  const presentationResult=currentPresentationResult(props);
  element.dataset.presentationResult=JSON.stringify(presentationResult?{resultId:presentationResult.resultId,planFingerprint:presentationResult.planFingerprint,finalScore:presentationResult.finalScore}:null);
  element.dataset.scenePhase=objects[0]?.phase??'baseline';
  scenarioDirty=true;staticProgramKey='';projectLabels.forEach(({b})=>b.remove());
  projectLabels=sites.map(o=>{
   const b=document.createElement('button');b.className='map-project';b.dataset.initiative=o.id;b.dataset.district=o.district;b.dataset.site=o.key;b.dataset.child=String(o.isChild);b.dataset.slot=String(o.slot);b.dataset.proposal=String(o.proposal);b.dataset.phase=o.phase??o.state;
   b.textContent=o.isChild?o.label??projectNames[o.id]:o.proposal?projectNames[o.id]:`${o.slot} · ${projectNames[o.id]}${o.id==='M3'&&world.id==='astana'?' · сценарная трасса':''}`;
   b.setAttribute('aria-label',`${o.proposal?'Предложение':'Решение '+o.slot}: ${projectTitles[o.id]} · ${districts.find(d=>d.id===o.district).properties.name}${o.isChild?' · '+(o.label??'другое место'):o.citywide?' · весь город':''}`);
   b.title=b.getAttribute('aria-label');b.onclick=()=>inspectProgram(o);labels.append(b);return {o,b,bounds:world.projects.projectFocusBounds?.(o)};
  });
  labelFootprints.reset(projectLabels.map(({o,bounds})=>({site:o,bounds})));lastWorldDraw=-Infinity;
 }

 const districtLabels=districts.map(d=>{const b=document.createElement('button');b.className='district-label';b.onclick=()=>props.onDistrictSelect(d.id);b.setAttribute('aria-label',`${world.id==='khanate'?'Квартал':'Район'} ${d.properties.name} на карте`);b.innerHTML=`<span><i aria-hidden="true" style="background:${DISTRICT_COLORS[d.id]}"></i> ${d.properties.name}</span><small>${world.id==='khanate'?'КВАРТАЛ':'РАЙОН'}</small>`;labels.append(b);return {d,b,small:b.querySelector('small'),focused:null};});
 const wayfinding=document.createElement('div');wayfinding.className='district-wayfinding';wayfinding.dataset.occludesCity='';element.append(wayfinding);
 const landmarkExplorer=createLandmarkExplorer({element,labels,landmarks:metadata.landmarks||[],observations:world.observations||[],mode:world.id,visit:visitLandmark,leave:overview});
 function visitLandmark(model){
  // These are authored arrival moments, not a live railway timetable.
  if(model.id==='lrt')lrtStarted=motionNow(performance.now());else if(model.id==='esil-bridges')lrtStarted=motionNow(performance.now())-115000;
  interruptFlight();networkEncounterCamera=false;encounterReturn=null;cameraZoomLimit=MAX_ZOOM;manualCamera=false;choreographyControlsCamera=false;geographicFocus=model.focusPosition||model.position;geographicHeight=model.focusHeight/12000;
  const p=geoPoint(geographicFocus),yaw=model.yaw??-.3,pitch=model.pitch??1,h=geographicHeight;
  target=boundCamera({...current,x:p[0]+Math.sin(yaw)*Math.tan(pitch)*h,y:p[1]+Math.cos(yaw)*Math.tan(pitch)*h,yaw,pitch,zoom:model.zoom});
  cameraFlight=true;directInput=false;safeDirty=true;lastWorldDraw=-Infinity;
 }
 const people=SIGNATURE_RESIDENTS.filter((r,i,a)=>a.findIndex(p=>p.location===r.location)===i).map(r=>{const b=document.createElement('button');b.className='map-resident';b.textContent=`${r.name} · поговорить`;b.setAttribute('aria-label',`Поговорить: ${r.name}`);b.onclick=e=>{e.stopPropagation();interruptFlight();flight(anchors[anchorFor(r).id].position,CLOSE_ZOOM);bus.select(r.id);};labels.append(b);return {r,b,anchor:anchors[anchorFor(r).id]};});
 function flight(p,zoom,h=.0009){networkEncounterCamera=false;encounterReturn=null;cameraZoomLimit=MAX_ZOOM;manualCamera=false;if(zoom>18&&quality==='light')void setQuality('detail');geographicFocus=p;geographicHeight=h;cameraFlight=true;directInput=false;target=constrain({...current,...anchorPose(p),zoom});safeDirty=true;}
 function overview(){networkEncounterCamera=false;encounterReturn=null;cameraZoomLimit=MAX_ZOOM;manualCamera=false;landmarkExplorer?.clear();inspectionOrbit=null;choreographyControlsCamera=false;geographicFocus=null;cameraFlight=true;directInput=false;target={...OVERVIEW};}
 function camera(request){if(request.id===lastCamera)return;manualCamera=false;const first=lastCamera<0;lastCamera=request.id;landmarkExplorer?.clear();inspectionOrbit=null;choreographyControlsCamera=false;
 if(first&&((savedView&&request.kind==='overview')||(request.kind==='overview'&&world.arrivalPose))){
  current={...(savedView||world.arrivalPose)};
  // A fresh phone arrival frames the occupied court in the city area above
  // the choice sheet. Returning players retain their own saved camera.
  const w=element.clientWidth,h=element.clientHeight;
  if(!savedView&&world.id==='khanate'&&w<=800&&w>0&&h>0){
   const focus=[current.x,current.y,0];current=fitContext({...current,zoom:280},[focus],w,h,safeRects(),projectionOptions);
   geographicFocus=inversePoint(0,0,frame.matrix,focus);geographicHeight=0;safeDirty=true;
  }
  target={...current};
 }
 else if(request.kind==='overview')overview();
 else if(request.kind==='location'&&resolveProgramAnchor(request.anchorId,sites,placements)){const site=resolveProgramAnchor(request.anchorId,sites,placements);if(scene?.selectedId&&scene.anchor.id===request.anchorId&&(site.isChild||['M1','M3'].includes(site.id)||site.id==='M4'&&site.program)){if(encounterReturn)encounterReturn.request=lastCamera;encounterCamera(site);}else{flight(site.position,CLOSE_ZOOM,site.origin[2]);target=constrain(projectClose(site));focusProject(site);}}
 else if(request.kind==='location'&&anchors[request.anchorId])flight(anchors[request.anchorId].position,CLOSE_ZOOM);
 else{const d=districts.find(d=>d.id===request.districtId);if(d)flight(d.properties.view_center,world.districtZoom??3.1);}
 element.dataset.cameraRequest=String(lastCamera);if(reduced()){current={...target};lastWorldDraw=-Infinity;}}
 function transition(to,duration){timeFrom=time;timeTo=to;timeStart=performance.now();timeDuration=reduced()?0:duration;if(reduced()){time=to;lastWorldDraw=-Infinity;}}
 function screenScale(){return frame.scale;}
 function viewRotation(){return frame.matrix;}
 function project(p,h=0){return frame.project(p,h);}
 function line(points,color,w=1,dash=[]){ctx.beginPath();let started=false;for(const p of points){const q=project(p,.0014);if(!q.visible){started=false;continue;}if(!started){ctx.moveTo(q.x,q.y);started=true;}else ctx.lineTo(q.x,q.y);}ctx.strokeStyle=color;ctx.lineWidth=w;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
 function drawOverlay(now,night){
 ctx.clearRect(0,0,width,height);hitTargets.length=0;usedBoxes.length=0;
 const future=!!props.result&&props.comparisonPosition>=.5,rects=safeRects();
 const onScreen=(p,pad=16)=>p.visible&&p.x>pad&&p.x<width-pad&&p.y>24&&p.y<height-24&&!occluded(p,rects,10);
 const selectedOrigin=scene?.selectedId?(actors.find(a=>a.resident.id===scene.selectedId)?.position||encounterPosition()):null;
 const residentRadius=RESIDENT_HEIGHT*.6,selectedBody=selectedOrigin?projectLabelVolume([-residentRadius,residentRadius].flatMap(x=>[-residentRadius,residentRadius].flatMap(y=>[0,RESIDENT_HEIGHT].map(z=>frame.world([selectedOrigin[0]+x,selectedOrigin[1]+y,selectedOrigin[2]+z]))))):null;
 if(selectedBody)usedBoxes.push(selectedBody);
 if(world.borders!==false)for(const d of districts){const active=props.focusedDistrict===d.id,highlight=animation?.stage==='district'&&objects.some(o=>o.id===animation.id&&o.district===d.id);for(const poly of d.geometry.type==='Polygon'?[d.geometry.coordinates]:d.geometry.coordinates)for(const r of poly)line(r,highlight?'#f4e6b1bb':active?'#f7f0d2cc':'#35494255',highlight?1.8:active?1.8:.75);}
 // Geographic names retain their identity even when an initiative affects the district.
 for(const label of districtLabels){const {d,b,small}=label,p=project(identityFor(d.id).position,.003),focused=props.focusedDistrict===d.id;b.hidden=current.zoom>(world.labelZoom??5)||!onScreen(p,40);b.style.left=`${p.x}px`;b.style.top=`${p.y}px`;if(label.focused!==focused){b.classList.toggle('is-focused',focused);small.textContent=world.id==='khanate'?(focused?'ВАШ КВАРТАЛ':'КВАРТАЛ'):(focused?'ВЫБРАННЫЙ РАЙОН':'РАЙОН');label.focused=focused;}if(!b.hidden)usedBoxes.push({left:p.x-55,right:p.x+55,top:p.y-24,bottom:p.y+24});}
 // Project nameplates are readable annotations; the actual object is in the city depth pass.
 const visibleProjectLabels=[];
 const orderedLabels=[...projectLabels].sort((a,b)=>Number(b.o.key===focusedSite?.key)-Number(a.o.key===focusedSite?.key)||Number(a.o.isChild)-Number(b.o.isChild));
 for(const {o,b,bounds} of orderedLabels){
  const close=current.zoom>15,p=frame.world(close?projectFocus(o):o.origin),constructing=!o.proposal&&!!(activities[o.id]||animation?.id===o.id),footprint=labelFootprints.read(o),physical=close&&!constructing&&footprint!==undefined?footprint.map(world=>({...frame.world(world),world})):null;
  const available=physical?!!projectLabelPhysicalLeader(physical,p,{width,height},rects):p.visible&&p.x>=8&&p.x<=width-8&&p.y>=16&&p.y<=height-24;
  b.dataset.anchorX=p.x.toFixed(3);b.dataset.anchorY=p.y.toFixed(3);b.dataset.frame=String(frame.id);b.hidden=!available||(o.isChild&&current.zoom<(world.id==='khanate'?24:12))||(current.zoom<15&&o.citywide&&o.district!==(props.focusedDistrict??'esil'))||!!(animation&&['approach','anticipation','arrival','build','activation','people'].includes(animation.stage)&&!(o.key===choreography?.key&&!choreographyControlsCamera&&!o.proposal));if(!b.hidden)visibleProjectLabels.push({o,b,p,bounds,footprint,constructing,physical});
 }
 // Read every eligible nameplate before placement writes can invalidate layout.
 const measuredProjectLabels=visibleProjectLabels.map(label=>({...label,size:labelSizes.read(label.b)}));
 for(const {o,b,p,size,bounds,footprint,constructing,physical} of measuredProjectLabels){
  // Protect only this project's visible physical place; network tails and other
  // offscreen projects must not reserve the whole city for their nameplates.
  const points=current.zoom>15?bounds?.map(frame.world).filter(q=>q.visible):null;
  const volume=points?.length?projectLabelVolume(points):null;
  const half=size.width/2,preferred={x:current.zoom>15?p.x:p.x+half+24,y:volume?volume.bottom+size.height/2+8:current.zoom>15?p.y+(o.size?.[1]||.003)*frame.scale*.6+55:p.y+27};
  const placement=placeProjectLabel(p,preferred,size,{width,height},[...rects,...usedBoxes,...(volume?[volume]:[])]);
  if(!placement){b.hidden=true;continue;}const {x,y}=placement;
  b.style.left=`${x}px`;b.style.top=`${y}px`;b.classList.toggle('proposal',o.proposal);b.classList.toggle('selected',o.key===focusedSite?.key||props.selectedCommitment===o.id);
  const leader=current.zoom>15&&!constructing?projectLabelPhysicalLeader(physical||[],placement,{width,height},rects,selectedBody?[selectedBody]:[]):current.zoom<=15?p:null;
  b.dataset.leaderSource=leader?(leader.world?'sampled-physical-footprint':'cartographic-origin'):'pending-physical-geometry';b.dataset.leaderFrame=String(frame.id);b.dataset.footprintSamples=String(footprint?.length||0);b.dataset.leaderWorld=JSON.stringify(leader?.world||null);b.dataset.leaderX=leader?.x.toFixed(3)||'';b.dataset.leaderY=leader?.y.toFixed(3)||'';
  if(leader){const end={x:clamp(leader.x,placement.box.left,placement.box.right),y:clamp(leader.y,placement.box.top,placement.box.bottom)};
  ctx.strokeStyle=o.proposal?'#f3ddb5aa':'#f5e9c585';ctx.lineWidth=1;ctx.setLineDash(o.proposal?[3,3]:[]);ctx.beginPath();ctx.moveTo(leader.x,leader.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#eee0b4';ctx.fillRect(leader.x-1.5,leader.y-1.5,3,3);}
  usedBoxes.push(placement.box);
 }
 for(const {r,b,anchor} of people){const q=project(anchor.position,.00004);b.hidden=!!scene?.selectedId||props.focusedDistrict!==r.location||current.zoom<1.8||current.zoom>18||!onScreen(q,45);b.style.left=`${q.x}px`;b.style.top=`${q.y+25}px`;}
 for(const actor of actors){const q=frame.world([actor.position[0],actor.position[1],actor.position[2]+RESIDENT_HEIGHT*.5]),feet=frame.world(actor.position),head=frame.world([actor.position[0],actor.position[1],actor.position[2]+RESIDENT_HEIGHT]);hitTargets.push({x:q.x,y:q.y,resident:actor.resident.id,anchor:actor.anchor,position:actor.position,radius:Math.max(10,Math.hypot(head.x-feet.x,head.y-feet.y)*.6)});}
 landmarkExplorer.draw(frame,rects,usedBoxes);
 bus.physical(false);
 if(scene?.selectedId){const origin=selectedOrigin,p=frame.world(origin);
  bus.project?.({anchor:p,frame:frame.id,zoom:current.zoom,width,height,occlusions:props.occlusions||[]});bus.physical(current.zoom>=18&&p.visible);
  const head=frame.world([origin[0],origin[1],origin[2]+RESIDENT_HEIGHT]);element.dataset.residentPosition=JSON.stringify(origin);element.dataset.residentX=p.x.toFixed(3);element.dataset.residentY=p.y.toFixed(3);element.dataset.residentWorldHeight=String(RESIDENT_HEIGHT);element.dataset.residentPixelHeight=String(Math.hypot(head.x-p.x,head.y-p.y));
 }else bus.project?.(null);
 element.dataset.actors=JSON.stringify(actors.map(a=>({id:a.resident.id,position:a.position,activity:a.activity})));
 element.dataset.frame=String(frame.id);element.dataset.projectVertices=String(renderer.diagnostics().projectVertices);element.dataset.projectWorldWidth=String(objects[0]?.size?.[0]||.006);const physicalBounds=projectLabels[0]?.bounds,projectedBounds=physicalBounds?.map(p=>frame.world(p));element.dataset.projectPixelWidth=String(projectedBounds?.length?Math.max(...projectedBounds.map(p=>p.x))-Math.min(...projectedBounds.map(p=>p.x)):frame.scale*(objects[0]?.size?.[0]||.006)*Math.abs(Math.cos(current.yaw)));element.dataset.projectPhysicalBounds=JSON.stringify(physicalBounds||null);element.dataset.scenarioRevision=String(props.scenarioRevision||0);element.dataset.interventions=JSON.stringify(objects.map(o=>({key:o.key,state:o.state,revision:o.revision,origin:o.origin,source:o.source})));element.dataset.actorVertices=String(renderer.diagnostics().actorVertices);element.dataset.construction=String(animation?.progress??1);element.dataset.schoolTime=String(reduced()||props.comparisonSessionId||props.result&&props.comparisonPosition>=.5?30:(constructionNow()-schoolStart)/1000);element.dataset.heroScene=String(objects.some(isHeroSchool));
 }
 function scenarioActors(now){
  if(current.zoom<18)return [];
  const seconds=reduced()?4:(motionNow(now)-born)/1000;
  const selectedSite=scene?.selectedId?resolveProgramAnchor(scene.anchor.id,sites,placements):null;
  const selectedPerson=scene?.residents.find(r=>r.id===scene.selectedId);
  const inspectedSite=focusedSite?.isChild&&!focusedSite.proposal&&!props.candidate&&props.selectedCommitment===focusedSite.id?focusedSite:null;
  const near=scene?.selectedId?sites.find(o=>!o.proposal&&(selectedSite?o.key===selectedSite.key:o.id===selectedPerson?.primary&&o.district===scene.anchor.districtId)):inspectedSite??nearestProgramSite(sites,[current.x,current.y]);
  const localAnimation=near?activities[near.id]:null;
  if(isHeroSchool(near)&&!scene?.selectedId)return [];
  if(near&&(!localAnimation||localAnimation.id!==near.id||localAnimation.people>.05)){
   const local=[...(scene?.selectedId?scene.residents:[]),...RESIDENTS].filter((r,i,rows)=>r.location===near.district&&rows.findIndex(other=>other.id===r.id)===i).sort((a,b)=>(Number(b.id===scene?.selectedId)*2+Number(b.primary===near.id))-(Number(a.id===scene?.selectedId)*2+Number(a.primary===near.id)));
   const maximum=near.peopleSpots?Math.min(8,near.peopleSpots.length):8,count=localAnimation?.id===near.id?Math.max(1,Math.ceil(localAnimation.people*maximum)):maximum;return local.slice(0,count).map((resident,i)=>{let position,angle=0,activity=i===0?'use':i%3?'idle':'walk';
    if(near.peopleSpots){const spot=near.peopleSpots[i];position=[...spot.position];angle=spot.angle;}else{const w=near.size?.[0]||.006;const offsets=[[0,-.26],[-.29,0],[0,.14],[.05,.18],[.24,0],[.29,.02],[-.11,-.07],[-.4,0]],q=offsets[i];position=[near.origin[0]+q[0]*w,near.origin[1]+q[1]*(near.size?.[1]||.004),near.origin[2]+.000065];}
    if(isHeroSchool(near)){
     const x=[0,-6,6,-11,11,-4,4,0][i],y=-14-(i%3)*4,c=Math.cos(near.orientation),s=Math.sin(near.orientation);
     position=[near.origin[0]+(x*c-y*s)*.0001,near.origin[1]+(x*s+y*c)*.0001,near.origin[2]+.000085];
    }else if(!near.isChild&&world.id==='astana'&&(near.id==='M7'||near.id==='M8')){position=[near.origin[0]+[-.0016,-.0004,.0003,.0012,.0007,-.0011,.0018,-.0005][i],near.origin[1]+[-.0016,-.002,-.0015,-.0021,-.0017,-.0022,-.0015,-.0017][i],near.origin[2]+.00010];if(i===0){position[0]=near.origin[0]-(near.id==='M8'?.0006:0);position[1]=near.origin[1]-.00175+(.5+.5*Math.sin(seconds*.35))*.0005;activity='walk';}}
    if(near.id==='M6')position[1]=near.origin[1]-.001;if(near.id==='M12'){position[0]=near.origin[0]+(i/7-.5)*.0025;position[1]=near.origin[1]-.00085-(i%2)*.00035;}
    if(!near.isChild&&!scene?.selectedId&&i>=6&&near.context?.length&&near.id!=='M12'){const node=near.context[(i-6)%near.context.length];position=[node.point[0]+.00065,node.point[1]-.0007,node.point[2]+.00006];activity=i===6?'walk':'idle';if(i===6)position[1]+=Math.sin(seconds*.5)*.00012;}
    if(near.id==='M9'&&i===0)activity='use';if(i===1&&localAnimation?.stage==='people'&&localAnimation.elapsed<8.5)activity='wave';if(i===3&&(seconds+i)%24<2)activity='point';if(activity==='walk')angle+=Math.PI/2;
    if(activity==='walk'&&!scene?.selectedId&&near.type==='parcel'&&!['M7','M8'].includes(near.id))position[0]+=Math.sin(seconds*.35+i)*.00026;
    if(scene?.selectedId===resident.id){activity='talk';position=encounterPosition();}
    const anchor={id:`${near.isChild?'program':'scenario'}:${near.key}`,districtId:near.district,kind:footprintKinds[near.id]||'service',label:projectNames[near.id],provisional:true};
    return {resident,position,angle,activity,anchor};
   });
  }
  if(scene?.selectedId){const p=encounterPosition();return [...scene.residents].sort((a,b)=>Number(b.id===scene.selectedId)-Number(a.id===scene.selectedId)).slice(0,4).map((resident,i)=>({resident,position:[p[0]+(i?i*.0007:0),p[1]+(i? .0005:0),p[2]],angle:0,activity:resident.id===scene.selectedId?'talk':'idle',anchor:scene.anchor}));}
  return [];
 }
 function beginChoreography(record,restore=false,hold=false){
  // A citywide proposal establishes coverage at overview scale. Confirmation
  // must still travel to a working place; only useful local previews are held.
  hold=hold&&!record.citywide;
  const receipt=receiptFor(record),now=receipt?.startedAt??constructionNow(),school=isHeroSchool(record),quiet=reduced();
  choreographyControlsCamera=!restore&&!hold;if(choreographyControlsCamera){networkEncounterCamera=false;encounterReturn=null;cameraZoomLimit=MAX_ZOOM;manualCamera=false;}
  if(receipt&&constructionNow()-now>=receipt.durationMs){if(school)schoolStart=now;return;}
  if(school)schoolStart=now-(quiet?30000:0);
  if(quiet){
   choreography=null;animation=null;
   if(!manualCamera){if(record.citywide)target=boundCamera(projectClose(record));focusProject(record);safeDirty=true;}
   scenarioDirty=true;return;
  }
  if(!record.citywide&&quality==='light')void setQuality('detail');
  const authored=projectClose(record),points=world.projects.projectFocusBounds?.(record);
  const close=boundCamera(points?fitContext(authored,points,width,height,safeRects(),projectionOptions):revealFocus(authored,record.position,width,height,safeRects(),80,record.origin[2],projectionOptions));
  choreography=createChoreography(record,now,current,close);if(!hold){geographicFocus=null;safeDirty=false;cameraFlight=false;}scenarioDirty=true;
 }
 function info(now){const moving=timeDuration>1000&&timeTo>1&&now-timeStart<timeDuration;const day=((renderedTime%1)+1)%1;const light=day<.2?'Утренний свет':day<.39?'День':day<.52?'Закат':day<.65?'Сумерки':day<.96?'Ночь · город не спит':'Рассвет';const phase=props.result&&props.comparisonPosition>=.5?'future':props.candidate?'proposal':'present';wayfinding.hidden=current.zoom<(world.placeZoom??6);const centerPoint=inversePoint(0,0,viewRotation(),[current.x,current.y]);const localDistrict=districts.find(d=>centerPoint&&contains(d.geometry,centerPoint));const localIdentity=identityFor(localDistrict?.id);wayfinding.textContent=localIdentity?localIdentity.name:world.id==='khanate'?'Вольная степь':'Вне сценарных районов';element.dataset.centerDistrict=localDistrict?.id||'';wayfinding.style.borderColor=localIdentity?.color||'transparent';element.dataset.motionTime=String((motionNow(now)-born)/1000);const metrics=renderer.diagnostics();for(const key of ['gpuVertexArrays','gpuTemplates','gpuPlacementBuffers','instanceBatches','residentTiles','expectedTiles','renderedTiles','culledTiles','residentBuildings','renderedBuildings','culledBuildings','gpuBufferBytes','gpuShadowBytes','gpuMeshes','gpuBuffers','frameDrawCalls','shadowDrawCalls','transitVertices'])element.dataset[key]=String(metrics[key]);element.dataset.completeCity=String(metrics.completeCity);element.dataset.buildingCount=String(metadata.buildingFeatures||0);element.dataset.visibleCityVertices=String(metrics.visibleCityVertices||metrics.cityVertices);element.dataset.cityDrawCalls=String(metrics.baseDrawCalls);element.dataset.projection='planar';element.dataset.cameraLens=frame.perspective?'architectural':'orthographic';element.dataset.perspectiveStrength=String(frame.perspective);element.dataset.inkEnabled=String(metrics.inkEnabled);element.dataset.gpuInkBytes=String(metrics.gpuInkBytes);element.dataset.groundVertices=String(metrics.groundVertices);element.dataset.drawCount=String(metrics.drawCount);element.dataset.drawSubmitMs=metrics.drawSubmitMs.toFixed(3);element.dataset.drawSubmitAverageMs=metrics.drawSubmitAverageMs.toFixed(3);element.dataset.scale=current.zoom>(world.placeZoom??8)?'place':current.zoom>(world.overviewZoom??1.8)?'district':'world';element.dataset.phase=phase;element.dataset.quality=quality;element.dataset.landmarkCount=String(metadata.landmarks?.length||0);element.dataset.centerX=current.x.toFixed(5);element.dataset.centerY=current.y.toFixed(5);element.dataset.time=time.toFixed(4);element.dataset.zoom=current.zoom.toFixed(3);element.dataset.yaw=current.yaw.toFixed(4);element.dataset.pitch=current.pitch.toFixed(4);element.dataset.transition=String(moving);element.dataset.resident=scene?.selectedId||'';element.dataset.anchor=scene?.selectedId?scene.anchor.id:'';element.dataset.treatments=scene?.observation.relatedTreatments.join(',')||'';element.dataset.preview=props.candidate?.decision.initiativeId||'';element.dataset.previewProgress=String(props.budgetPreview?.progress??0);element.dataset.previewBlocked=String(props.budgetPreview?.blocked??false);element.dataset.previewDistricts=props.candidate?.decision.scope==='citywide'?districts.map(d=>d.id).join(','):props.candidate?.decision.districtId||'';const key=`${!!inspectionOrbit}:${quality}:${light}:${moving}:${phase}:${current.zoom>(world.placeZoom??8)?'place':current.zoom>(world.overviewZoom??1.8)?'district':'world'}`;if(key!==lastInfo){lastInfo=key;element.dispatchEvent(new CustomEvent('alem-state',{bubbles:true,detail:{quality,light,moving,phase,orbit:!!inspectionOrbit,scale:current.zoom>(world.placeZoom??8)?'Место встречи':current.zoom>(world.overviewZoom??1.8)?(world.id==='khanate'?'Квартал':'Район'):'Весь город'}}));}}
 function tick(now){if(!alive)return;frameId=requestAnimationFrame(tick);if(document.hidden)return;
 const dt=Math.min(64,now-lastFrame);lastFrame=now;
 const futureView=!!props.result&&props.comparisonPosition>=.5,baselineView=objects.some(o=>o.phase==='baseline');
 try{
  const oldWidth=width,oldHeight=height;width=element.clientWidth;height=element.clientHeight;if(!width||!height)return;
  if(width!==oldWidth||height!==oldHeight){labelSizes.invalidate();resizeCamera();}
  // Camera-derived UI may change its footprint after a zoom. Manual input keeps
  // ownership; real context changes and viewport resize still request a fit.
  if((safeDirty||occlusionDirty&&!manualCamera)&&(!choreography||!choreographyControlsCamera)){safeFocus();safeDirty=false;occlusionDirty=false;}
  if(choreography&&!props.comparisonSessionId&&!baselineView){const sample=choreography.sample(constructionNow());animation={...sample,elapsed:(constructionNow()-choreography.start)/1000,id:choreography.id,key:choreography.key};if(choreographyControlsCamera){current={...sample.pose};target={...sample.pose};}element.dataset.choreography=sample.stage;element.dataset.eventCameraOwned=String(choreographyControlsCamera);element.dataset.eventQuiet=String(['approach','anticipation','arrival','build','activation','people'].includes(sample.stage));element.dataset.eventDuration=String(sample.duration);if(sample.done){const finishedSite=objects.find(o=>o.key===choreography.key);choreography=null;animation=null;if(choreographyControlsCamera){current={...sample.pose};target={...sample.pose};if(finishedSite){geographicFocus=finishedSite.position;geographicHeight=finishedSite.origin[2];safeDirty=true;}}scenarioDirty=true;}}else {animation=null;element.dataset.choreography='idle';element.dataset.eventCameraOwned='false';element.dataset.eventQuiet='false';}
  // A two-year result displays completed places; wall-clock receipts keep advancing.
  const previousActivities=activities;
  activities=props.comparisonSessionId||baselineView?{}:sampleConstructionActivities(objects,props.construction||[],constructionNow(),{quiet:reduced(),quietKeys:quietConstruction,cache:constructionCache,createChoreography,overview:OVERVIEW});
  if(constructionActivitiesRemoved(previousActivities,activities))scenarioDirty=true;
  const constructing=Object.keys(activities).length>0;
  const hero=objects.find(isHeroSchool),heroReceipt=hero&&receiptFor(hero);if(heroReceipt&&activities.M7)schoolStart=heroReceipt.startedAt;
  element.dataset.constructions=JSON.stringify(Object.values(activities).map(a=>({id:a.id,progress:a.progress,elapsed:a.elapsed})));
  // Continuous input already has a trajectory. Follow it on the next display frame;
  // only discrete controls and authored flights need an interpolated transition.
  if(inspectionOrbit){if(reduced()||now-inspectionOrbit.started>=24000){inspectionOrbit=null;}else{target=boundCamera(inspectionPose(inspectionOrbit.pose,inspectionOrbit.pivot,(now-inspectionOrbit.started)/1000,{...projectionOptions,width,height}));directInput=true;}}
  element.dataset.inspectionOrbit=String(!!inspectionOrbit);
  const easing=reduced()||directInput?1:1-Math.exp(-dt/(cameraFlight?170:65));let navigating=false;
  for(const key of ['x','y','yaw','pitch','zoom']){if(Math.abs(current[key]-target[key])>.00001){navigating=true;current[key]=mix(current[key],target[key],easing);}else if(current[key]!==target[key]){current[key]=target[key];navigating=true;}}
  frame=cameraFrame(current,width,height,++frameSerial,projectionOptions);element.dataset.camera=JSON.stringify({...current,width,height,perspective:frame.perspective,rendererZoom:frame.rendererZoom,projectionScale:frame.scale,matrix:Array.from(frame.matrix)});element.dataset.target=JSON.stringify(target);
  if(timeDuration){const t=clamp((now-timeStart)/timeDuration,0,1);time=mix(timeFrom,timeTo,t*t*(3-2*t));if(t===1)timeDuration=0;}
  if(overlay.width!==width||overlay.height!==height){overlay.width=width;overlay.height=height;}
  actors=scenarioActors(now);const programBand=[12,15,18,24,55,100].filter(z=>current.zoom>z).length,programCell=current.zoom>12?[Math.floor(current.x/.02),Math.floor(current.y/.02)]:[0,0];
  const permanentKey=objectKey+'|'+programBand+'|'+(world.projects.projectStaticCacheKey?.({zoom:current.zoom})??'')+'|'+programCell.join('/')+'|'+Object.keys(activities).sort().join('/');
  const programOptions={zoom:current.zoom,center:[programCell[0]*.02+.01,programCell[1]*.02+.01],active:animation,activities,anchors,schoolTime:reduced()||props.comparisonSessionId||futureView?30:(constructionNow()-schoolStart)/1000,seconds:reduced()?4:(motionNow(now)-born)/1000,reducedMotion:reduced(),scale:frame.scale,projectLabelGeometry};
  element.dataset.programSeconds=String(programOptions.seconds);element.dataset.comparisonFrozen=String(!!props.comparisonSessionId);
  if(world.projects.projectStaticMesh&&permanentKey!==staticProgramKey){renderer.replacePrograms(world.projects.projectStaticMesh(objects,programOptions),current.zoom>=12);staticProgramKey=permanentKey;scenarioDirty=true;lastWorldDraw=-Infinity;}
  element.dataset.programVertices=String(renderer.diagnostics().programVertices??0);
  if(scenarioDirty||choreography||constructing||projectZoomChanged(lastProjectZoom,current.zoom,!!hero)||!reduced()&&!props.comparisonSessionId&&now-lastScenarioDraw>100&&(world.shouldAnimateProjects?world.shouldAnimateProjects(objects,current.zoom):(current.zoom<18||objects.some(o=>['M1','M2','M3','M4','M6','M12','M13','M14'].includes(o.id)||!o.proposal&&o.context?.length||isHeroSchool(o)&&current.zoom>24)))){
   const build=world.projects.projectDynamicMesh??projectMesh;
   renderer.replaceProjects(build(objects,!!props.result,programOptions),current.zoom>=12);lastScenarioDraw=now;lastProjectZoom=current.zoom;scenarioDirty=false;lastWorldDraw=-Infinity;
  }
  // Reduced motion freezes both poses and geometry. Re-uploading unchanged people
  // every animation frame needlessly invalidated all dynamic shadow cascades.
  const actorKey=reduced()||props.comparisonSessionId?JSON.stringify([current.zoom>=55,actors.map(a=>[a.resident.id,a.resident.visual,a.resident.signature,a.position,a.angle,a.activity])]):null;
  if((actors.length||lastActorCount)&&(actorKey===null||actorKey!==lastActorKey)){
   renderer.replaceActors(residentsMesh(actors,reduced()?4:(motionNow(now)-born)/1000,current.zoom));lastWorldDraw=-Infinity;lastActorCount=actors.length;lastActorKey=actorKey;
  }
  const transit=lrtMotion.update({seconds:(motionNow(now)-lrtStarted)/1000,zoom:frame.rendererZoom,perspective:frame.perspective,rotation:frame.matrix,center:[current.x,current.y,0],aspect:width/height,reducedMotion:reduced(),night:nightLevel,residentIds:actors.map(a=>a.resident.id)});if(transit){renderer.replaceTransit(transit);lastWorldDraw=-Infinity;}const ambient=lrtMotion.diagnostics();element.dataset.lrtTrains=String(ambient.visibleTrains);if(world.id==='khanate'){element.dataset.livingPeople=String(ambient.people);element.dataset.livingAnimals=String(ambient.animals);element.dataset.livingBirds=String(ambient.birds);element.dataset.life=JSON.stringify(ambient.poses);}
  if(navigating||timeDuration||choreography||constructing||now-lastWorldDraw>(reduced()||props.comparisonSessionId?60000:1000)||width!==lastWidth||height!==lastHeight){const lamps=objects.filter(o=>o.id==='M10'&&!o.proposal&&o.phase!=='baseline').flatMap(o=>lampPositions(o).filter((_,i)=>!activities.M10||activities.M10.progress>.43+i*.025)).sort((a,b)=>Math.hypot(a[0]-current.x,a[1]-current.y)-Math.hypot(b[0]-current.x,b[1]-current.y)).slice(0,24),utility=activities.M13&&activities.M13.progress>.12&&activities.M13.progress<.97?objects.find(o=>o.key===activities.M13.key):null;const lightTime=animation?.id==='M10'?mix(time,.63,Math.min(1,animation.progress*2)*Math.max(0,Math.min(1,((animation.duration||10)-.65-animation.elapsed)/1.6))):time;renderedTime=lightTime;const light=reduced()?null:eventLight(objects,animation);if(light)light.color=rgb(light.color).map(v=>v/255);element.dataset.eventLight=String(light?.strength||0);nightLevel=renderer.draw({eventLight:light,lamps,cutPath:utility?.route||[],rotation:frame.matrix,zoom:frame.rendererZoom,perspective:frame.perspective,center:[current.x,current.y,0],time:lightTime,tick:reduced()?0:motionNow(now)/1000,width,height,focusPoint:[current.x,current.y,0]}).night;element.dataset.renderCamera=element.dataset.camera;element.dataset.renderFrame=String(frame.id);lastWorldDraw=now;lastWidth=width;lastHeight=height;}
  drawOverlay(now,nightLevel);info(now);if(!navigating&&!choreography&&now-lastCameraSave>500){viewSession.save(current,cameraZoomLimit);lastCameraSave=now;}
  if(booting){renderer.prepared();booting=false;firstFrame?.resolve();}
 }catch(e){alive=false;if(booting)firstFrame?.reject(e);else status({kind:'failed',message:String(e)});}}
 function cameraZoomCeiling(){return width<=800?cameraZoomLimit:MAX_ZOOM;}
 function boundCamera(value){return boundedPose(value,cameraZoomCeiling());}
 function resizeCamera(){
  const site=selectedNetworkSite();
  if(site&&networkEncounterCamera){
   if(width<=800)cameraZoomLimit=PHONE_ENCOUNTER_MAX_ZOOM;
   if(!manualCamera)encounterCamera(site);
  }
  current=boundCamera(current);target=boundCamera(target);safeDirty=true;
 }
 function encounterCamera(site){
   const person=encounterPosition();let yaw=OVERVIEW.yaw,pitch=OVERVIEW.pitch;
   if(world.id==='astana'&&site.id==='M3'){
    const station=routeAt(site.route,.5),dx=person[0]-station.point[0],dy=person[1]-station.point[1],side=-dx*Math.sin(station.angle)+dy*Math.cos(station.angle);
    yaw=side>0?Math.PI-station.angle:-station.angle;pitch=1;
   }
   yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));
   const z=person[2]+RESIDENT_HEIGHT*.5;
   networkEncounterCamera=true;cameraZoomLimit=width<=800?PHONE_ENCOUNTER_MAX_ZOOM:MAX_ZOOM;
   const zoom=width<=800?PHONE_ENCOUNTER_HEIGHT/(RESIDENT_HEIGHT*Math.sin(pitch)*Math.min(height*.36,width*.29)):288;
   safeDirty=true;
   target=boundCamera({...target,x:person[0]+Math.sin(yaw)*Math.tan(pitch)*z,y:person[1]+Math.cos(yaw)*Math.tan(pitch)*z,yaw,pitch,zoom});cameraFlight=true;directInput=false;
  }
 function showEncounter(next,state){
  const entering=next?.selectedId&&(next.selectedId!==scene?.selectedId||next.anchor.id!==scene?.anchor.id),leaving=!next?.selectedId&&!!scene?.selectedId,site=entering?resolveProgramAnchor(next.anchor.id,sites,placements):null;
  if(entering){
   if(site&&(site.isChild||['M1','M3'].includes(site.id)||site.id==='M4'&&site.program)&&!scene?.selectedId)encounterReturn={pose:{...target},zoomLimit:cameraZoomLimit,focus:geographicFocus&&[...geographicFocus],height:geographicHeight,manual:manualCamera,request:lastCamera};
   if(!site||!(site.isChild||['M1','M3'].includes(site.id)||site.id==='M4'&&site.program)){networkEncounterCamera=false;cameraZoomLimit=MAX_ZOOM;target=boundCamera(target);}
   safeDirty=true;manualCamera=false;inspectionOrbit=null;choreographyControlsCamera=false;
  }
  scene=next;appState=state;scenarioDirty=true;
  if(entering&&site&&(site.isChild||['M1','M3'].includes(site.id)||site.id==='M4'&&site.program))encounterCamera(site);
  if(leaving)networkEncounterCamera=false;
  if(leaving&&encounterReturn){
   // A newer public destination or a manual gesture owns the camera. Otherwise
   // return to the inspected place, not the resident's distant part of its route.
   if(!manualCamera&&lastCamera===encounterReturn.request){cameraZoomLimit=encounterReturn.zoomLimit;target=boundCamera(encounterReturn.pose);geographicFocus=encounterReturn.focus;geographicHeight=encounterReturn.height;manualCamera=encounterReturn.manual;safeDirty=false;occlusionDirty=false;cameraFlight=true;directInput=false;}
   encounterReturn=null;
  }
  if(!next?.selectedId)actorAnchor=null;
 }
 function interruptFlight(){manualCamera=true;safeDirty=false;occlusionDirty=false;inspectionOrbit=null;props.onManualControl?.();if(choreography||animation)scenarioDirty=true;choreographyControlsCamera=false;directInput=false;if(cameraFlight){target={...current};cameraFlight=false;}}
 function preserveCamera(){
  manualCamera=true;safeDirty=false;occlusionDirty=false;inspectionOrbit=null;
  if(choreography||animation)scenarioDirty=true;
  choreographyControlsCamera=false;directInput=false;cameraFlight=false;
  target={...current};encounterReturn=null;
 }
 function orbit(active){const wasActive=!!inspectionOrbit;interruptFlight();if(active===false||active===undefined&&wasActive||reduced())return;const p=focusPoint();inspectionOrbit={started:performance.now(),pose:{...current},pivot:p?geoPoint(p,geographicHeight):[current.x,current.y,0]};target={...current};cameraFlight=false;}
 // Context fitting can place the centre beyond a world's pan boundary on a
 // short screen. View-only controls retain that centre; panning stays confined.
 function zoom(factor){interruptFlight();target=boundCamera({...target,zoom:target.zoom*(factor>0?1.4:1/1.4)});}
 function down(e){if(e.target!==canvas)return;interruptFlight();directInput=true;target={...current};cameraFlight=false;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,cx:target.x,cy:target.y,yaw:target.yaw,pitch:target.pitch,orbit:e.button===2||e.shiftKey,ground:frame.inverseWorld(e.clientX-canvas.getBoundingClientRect().left,e.clientY-canvas.getBoundingClientRect().top)};canvas.style.cursor='grabbing';}
 function move(e){if(!drag||drag.id!==e.pointerId)return;if(drag.orbit){target=boundCamera({...target,yaw:drag.yaw+(e.clientX-drag.x)*.005,pitch:drag.pitch+(e.clientY-drag.y)*.003});return;}const rect=canvas.getBoundingClientRect(),reference=cameraFrame({...target,x:drag.cx,y:drag.cy},width,height,0,projectionOptions),under=reference.inverseWorld(e.clientX-rect.left,e.clientY-rect.top);if(under&&drag.ground)target=constrain({...target,x:drag.cx+drag.ground[0]-under[0],y:drag.cy+drag.ground[1]-under[1]});}
 function up(e){if(!drag||drag.id!==e.pointerId)return;const click=!drag.orbit&&Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<5;drag=null;canvas.style.cursor='grab';if(e.type==='pointercancel'||!click)return;const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const hit=hitTargets.find(t=>Math.hypot(t.x-x,t.y-y)<(t.radius||20));if(hit){if(hit.home)overview();else if(hit.resident){interruptFlight();actorAnchor=hit.position;bus.encounter({residentId:hit.resident,anchor:hit.anchor});}else inspectProgram(sites.find(site=>site.key===hit.siteId)||sites.find(site=>site.id===hit.id));return;}const p=frame.inverse(x,y);if(p){const d=districts.find(d=>contains(d.geometry,p));if(d)props.onDistrictSelect(d.id);}}
 function wheel(e){e.preventDefault();interruptFlight();directInput=true;target=boundCamera({...target,zoom:target.zoom*Math.exp(-clamp(e.deltaY,-130,130)*.002)});}
 function key(e){if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key)){e.preventDefault();interruptFlight();if(e.key==='Home')overview();else if(e.key==='+'||e.key==='=')zoom(1);else if(e.key==='-')zoom(-1);else target=constrain({...target,x:target.x+(e.key==='ArrowLeft'?-.16:e.key==='ArrowRight'?.16:0)/target.zoom,y:target.y+(e.key==='ArrowUp'?.16:e.key==='ArrowDown'?-.16:0)/target.zoom});}}
 function contextLost(e){e.preventDefault();alive=false;abort.abort(new Error('Контекст WebGL потерян'));cancelAnimationFrame(frameId);status({kind:'failed',message:'Контекст WebGL потерян'});}
 const pointers=new Map();let pinch=null;
 function touchDown(e){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){interruptFlight();directInput=true;target={...current};const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),angle:Math.atan2(b.y-a.y,b.x-a.x),zoom:current.zoom,yaw:current.yaw};drag=null;canvas.setPointerCapture(e.pointerId);}else down(e);}
 function touchMove(e){if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&pointers.size===2){const [a,b]=[...pointers.values()];target=boundCamera({...target,zoom:pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance),yaw:pinch.yaw+Math.atan2(Math.sin(Math.atan2(b.y-a.y,b.x-a.x)-pinch.angle),Math.cos(Math.atan2(b.y-a.y,b.x-a.x)-pinch.angle))});}else move(e);}
 function touchUp(e){pointers.delete(e.pointerId);if(pinch){if(!pointers.size)pinch=null;drag=null;return;}up(e);}
 const events={contextmenu:e=>e.preventDefault(),pointerdown:touchDown,pointermove:touchMove,pointerup:touchUp,pointercancel:touchUp,wheel,keydown:key,webglcontextlost:contextLost};for(const [name,fn] of Object.entries(events))canvas.addEventListener(name,fn,name==='wheel'?{passive:false}:undefined);
 async function setQuality(){/* One complete representation at every scale. */}
 const runtime={preserveCamera,annotationSize(size){const changed=JSON.stringify(annotation)!==JSON.stringify(size);annotation=size;if(changed&&size)safeDirty=true;},setQuality,update(next){const old=props;if(next.result&&old.result&&next.comparisonPosition!==old.comparisonPosition){timeDuration=0;timeFrom=time;timeTo=time;}if(next.comparisonSessionId&&!old.comparisonSessionId){comparisonAt=performance.now();choreography=null;animation=null;choreographyControlsCamera=false;}else if(!next.comparisonSessionId&&old.comparisonSessionId){motionPause+=performance.now()-(comparisonAt??performance.now());comparisonAt=null;}if(next.result&&next.comparisonPosition<.5){choreography=null;animation=null;choreographyControlsCamera=false;}props=next;syncProjects();if(JSON.stringify(props.occlusions)!==JSON.stringify(old.occlusions)&&props.occlusions?.length>=(old.occlusions?.length||0))occlusionDirty=true;if(props.candidate&&props.candidate.decision!==old.candidate?.decision){safeDirty=true;manualCamera=false;}camera(props.cameraRequest);if(!booting&&initialLandmarkPending){initialLandmarkPending=false;landmarkExplorer.initial();}const added=props.commitments.find(d=>!old.commitments.some(p=>JSON.stringify(p)===JSON.stringify(d)));if(added&&!booting&&!props.comparisonSessionId&&!(props.result&&props.comparisonPosition<.5)){const record=objects.find(o=>!o.proposal&&o.id===added.initiativeId&&(!o.citywide||o.district===(props.focusedDistrict??'esil')))||objects.find(o=>!o.proposal&&o.id===added.initiativeId);if(record)beginChoreography(record,false,old.heldInitiative===record.id);}if(choreography&&!objects.some(o=>!o.proposal&&o.key===choreography.key)){choreography=null;animation=null;}/* Geometry, camera and light invalidate themselves; UI-only updates need no GPU draw. */if(props.comparisonSessionId||old.comparisonSessionId){timeDuration=0;resultRevision=props.result?.revision??null;planCount=props.commitments.length;return;}if((props.result?.revision??null)!==resultRevision){resultRevision=props.result?.revision??null;if(props.result)transition(Math.floor(time)+1.16,6200);else transition(Math.round(time-.16)+.16,800);}else if(props.commitments.length!==planCount){planCount=props.commitments.length;transition(Math.round(time-.16)+.16,1100);}planCount=props.commitments.length;if(!props.result&&props.cameraRequest.kind==='overview'&&props.commitments.length===0&&old.commitments.length)transition(Math.round(time-.16)+.16,600);},show:showEncounter,pose(){/* Aya is viewport guidance; residents own the encounter. */},zoom,orbit,rotate(x,y){interruptFlight();target=boundCamera({...target,yaw:target.yaw+x,pitch:target.pitch+y});},replay(){if(props.result&&!props.comparisonSessionId){time=.16;transition(1.16,6200);}},destroy(){if(alive&&!booting)viewSession.save(current,cameraZoomLimit);alive=false;abort.abort();signal?.removeEventListener('abort',cancel);cancelAnimationFrame(frameId);for(const [name,fn] of Object.entries(events))canvas.removeEventListener(name,fn);bus.physical(false);bus.project?.(null);landmarkExplorer.destroy();labelFootprints.clear();labelSizes.destroy();renderer.destroy();canvas.remove();overlay.remove();labels.remove();wayfinding.remove();},diagnostics(){return {camera:{...current},target,time,quality,...renderer.diagnostics(),lrt:lrtMotion.diagnostics(),vertexCount:metadata.vertices,counts:metadata.counts,anchor:scene?.anchor.id,actorCount:scene?.selectedId?3:0};}};
 runtime.update(initial);
 const failed=()=>firstFrame?.reject(abort.signal.reason);
 try{
  await new Promise((resolve,reject)=>{firstFrame={resolve,reject};abort.signal.addEventListener('abort',failed,{once:true});if(abort.signal.aborted)failed();else frameId=requestAnimationFrame(tick);});
  abort.signal.throwIfAborted();element.dataset.preparationMs=(performance.now()-preparationStarted).toFixed(1);
  const school=objects.find(isHeroSchool);if(school)schoolStart=receiptFor(school)?.startedAt??constructionNow()-30000;
  const underway=objects.find(o=>!o.proposal&&receiptFor(o)&&constructionNow()-receiptFor(o).startedAt<receiptFor(o).durationMs);if(underway&&!props.comparisonSessionId&&!(props.result&&props.comparisonPosition<.5))beginChoreography(underway,true);
  element.dataset.loadProgress='100';element.dataset.ready='true';element.dataset.vertices=String(metadata.vertices);status({kind:'ready'});return runtime;
 }catch(error){runtime.destroy();throw error;}
 finally{firstFrame=null;abort.signal.removeEventListener('abort',failed);}
}
