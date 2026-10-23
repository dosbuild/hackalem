import {isHeroSchool,schoolScene,schoolClock} from './hero-school.js';
import catalog from './placements.json' with {type:'json'};
import contextSites from './context-sites.json' with {type:'json'};
import {Mesh,beat,blend} from './mesh-kit.js';
import {DETAIL,civicModule,entry,busShelter,utilityCabinet,householdHeating,heatingTerminal} from './project-detail.js';
import {macroEcho,ambientTraffic} from './macro-interventions.js';
import {routeAt} from './placement-geometry.js';
import {cachedLrtStation,lrtPier,lrtCar} from './lrt-model.js';
import {pop,arrivalMark,groundRing,routeSection} from './intervention-effects.js';
import {PROPOSAL_TINT,groundPreparation,preparationStrength} from './construction-preparation.js';
import {projectPresentation} from './project-presentation.js';
import {astanaPrograms,programSites,programFrame,programStatic,programDynamic,programOverview} from './astana-programs.js';
export {programSites};
export const footprintKinds={M1:'stop',M3:'stop',M4:'garden',M5:'entrance',M7:'school',M8:'clinic',M9:'garden',M10:'crossing',M11:'crossing',M13:'service'};
export const placements=catalog.records;
const trafficSites=Object.values(placements).filter(o=>o.id==='M1'||o.id==='M14');
const deckZ=o=>(o.origin?.[2]??.00004)+.000006;
// Completed fixed architecture is already in world coordinates. Reuse those
// exact bytes while moving vehicles, trees and cartographic marks stay live.
const stationarySpans=new Map(),STATIONARY_ENTRIES=32,STATIONARY_BYTES=8*1024*1024;
let stationaryBytes=0;
function stationaryDependencies(o,kind){
 const values=[kind,o.id,o.state,o.blocked,...o.origin,o.orientation,...Object.values(DETAIL).flat()];
 if(kind==='emergency'){
  values.push(o.furniture?.length);
  for(const t of [.16,.5,.84]){const q=o.furniture?.[Math.round((o.furniture.length-1)*t)]||routeAt(o.route,t);values.push(...q.point,q.angle,q.ground);}
 }else if(kind==='lighting'){
  const count=Math.min(18,o.furniture?.length||0);values.push(o.furniture?.length);
  for(let i=0;i<count;i++){const q=o.furniture[Math.round(i/Math.max(1,count-1)*(o.furniture.length-1))];values.push(...q.point,q.angle,q.ground);}
 }else if(kind==='bus'){
  values.push(o.origin.length,o.route.length,o.furniture?.length);
  for(const point of o.route)values.push(point.length,...point);
  for(const t of [.18,.38,.62,.82]){const q=o.furniture?.[Math.round((o.furniture.length-1)*t)]||routeAt(o.route,t);values.push(q.point.length,...q.point,q.angle,q.ground);}
  for(const color of Object.values(DETAIL))values.push(Array.isArray(color)?color.length:-1);
 }
 return values;
}
function stationarySpan(m,record,o,p,active,kind,draw){
 if(p!==1||active||o.proposal){draw();return;}
 const dependencies=stationaryDependencies(o,kind),cached=stationarySpans.get(record);
 if(cached&&cached.dependencies.length===dependencies.length&&dependencies.every((value,i)=>Object.is(value,cached.dependencies[i]))){
  const required=m.bytes+cached.data.byteLength;
  if(required>m.buffer.byteLength){let capacity=m.buffer.byteLength;while(capacity<required)capacity*=2;const next=new ArrayBuffer(capacity);new Uint8Array(next).set(new Uint8Array(m.buffer));m.buffer=next;m.view=new DataView(next);}
  new Uint8Array(m.buffer,m.bytes,cached.data.byteLength).set(new Uint8Array(cached.data));m.bytes=required;
  const state=cached.state;m.origin=state.origin.slice();m.angle=state.angle;m.scale=state.scale;m.kind=state.kind;
  m.rotationAngle=state.rotationAngle;m.cosine=state.cosine;m.sine=state.sine;m.lastColor=state.lastColor;m.paint=state.paint.slice();m.lastTint=m.tint;
  stationarySpans.delete(record);stationarySpans.set(record,cached);return;
 }
 if(cached){stationarySpans.delete(record);stationaryBytes-=cached.data.byteLength;}
 const start=m.bytes;draw();const bytes=m.bytes-start;
 if(!bytes||bytes>STATIONARY_BYTES)return;
 while(stationarySpans.size>=STATIONARY_ENTRIES||stationaryBytes+bytes>STATIONARY_BYTES){const oldest=stationarySpans.keys().next().value,entry=stationarySpans.get(oldest);stationarySpans.delete(oldest);stationaryBytes-=entry.data.byteLength;}
 const state={origin:m.origin.slice(),angle:m.angle,scale:m.scale,kind:m.kind,rotationAngle:m.rotationAngle,cosine:m.cosine,sine:m.sine,lastColor:m.lastColor,paint:m.paint.slice()};
 stationarySpans.set(record,{dependencies,data:m.buffer.slice(start,m.bytes),state});stationaryBytes+=bytes;
}
export function projectObjects(props,districts){const objects=[],future=!!props.result&&props.comparisonPosition>=.5;
 const add=(decision,proposal,slot)=>{for(const d of districts.filter(d=>decision.scope==='citywide'||d.id===decision.districtId)){const site=placements[`${decision.initiativeId}:${d.id}`];if(!site)continue;const program=astanaPrograms[site.key];objects.push({...site,program,...(program?.furniture?{furniture:program.furniture}:{}),...projectPresentation(props,decision.initiativeId,d.id,proposal),context:contextSites.records[site.key]||[],proposal,slot,citywide:decision.scope==='citywide',revision:props.scenarioRevision??0,state:proposal?'preview':future?'outcome':'planned',progress:proposal?(props.budgetPreview?.progress??0):1,blocked:!!(proposal&&props.budgetPreview?.blocked)});}};
 props.commitments.forEach((d,i)=>add(d,false,i+1));if(props.candidate&&!props.commitments.some(d=>d.initiativeId===props.candidate.decision.initiativeId&&d.districtId===props.candidate.decision.districtId))add(props.candidate.decision,true,0);return objects;
}
export function tree(m,x,y,p,variant=0,seconds=0){
 if(p<=0)return;const h=(variant%3===0?11:9)*p,crown=pop(p,.15,1),sway=Math.sin(seconds*.7+variant)*.18;
 m.cylinder(x,y,0,.35,h,DETAIL.wood,7,.4);m.beam([x,y,h*.55],[x-2*p,y,h+2*p],.18,DETAIL.wood);
 m.ellipsoid(x+sway,y,h+3*p,4.8*crown,4.2*crown,5.2*crown,variant%2?'#609879':'#82ae6d',10,6);
 m.ellipsoid(x-3.8*p+sway,y-1.1*p,h+1*p,3.4*crown,3.1*crown,3.6*crown,'#94bc79',9,5);
 m.ellipsoid(x+3.6*p+sway,y+1*p,h+2*p,3.0*crown,3.1*crown,4.0*crown,'#6b9e77',9,5);
}
export function bench(m,x,y,p){
 if(p<=0)return;
 for(const dx of [-1.1,1.1])m.box(x+dx,y,0,.12,.72,.55*p,DETAIL.metal);
 for(let row=0;row<3;row++)m.box(x,y+(row-1)*.26,.55*p,2.9,.20,.13,DETAIL.wood);
 for(const dx of [-1.1,1.1])m.box(x+dx,y+.38,.48*p,.12,.12,.80*p,DETAIL.metal);
 for(const z of [.82,1.08])m.box(x,y+.38,z*p,2.9,.12,.16,DETAIL.wood);
}
export function park(m,o,p,lod,options={}){
 const [w,d]=o.size.map(n=>n/.0001),ground=beat(p,0,.2),path=beat(p,.12,.38);
 m.box(0,0,-.04,w*ground,d*ground,.6,'#91a27d');
 if(ground>.7){m.ribbon([[-w*.49,-d*.49],[w*.49,-d*.49],[w*.49,d*.49],[-w*.49,d*.49],[-w*.49,-d*.49]],.7,'#d7bf87',ground,.64);}
 m.box(0,0,.63,w*path,3.5,.12,'#eadbb8');m.box(0,0,.65,3.5,d*path,.14,'#eadbb8');
 const loop=[[-w*.39,-d*.32],[w*.38,-d*.32],[w*.4,d*.29],[-w*.38,d*.32],[-w*.39,-d*.32]];m.ribbon(loop,2.3,'#d5cb9f',path,.65);
 const points=[[-.37,-.31],[-.22,-.3],[-.08,-.31],[.13,-.3],[.27,-.31],[.4,-.28],[-.38,.28],[-.24,.3],[-.08,.31],[.13,.3],[.27,.28],[.4,.28]];
 points.forEach(([x,y],i)=>{const delay=Math.hypot(x,y)*.22+(i%3)*.018,q=pop(p,.22+delay,.57+delay);if(q<=0)return;const cx=x*w,cy=y*d;m.cylinder(cx,cy,.65,4.5*q,.22,'#a9a083',10);
  tree(m,cx,cy,q,i,options.seconds||0);
 });
 if(lod!=='close')return;
 const detail=pop(p,.58,.9);if(detail>0){for(const x of [-w*.25,w*.23])bench(m,x,-d*.09,detail);m.cylinder(w*.12,d*.12,.7,1.8,.75*detail,DETAIL.stone,16);m.cylinder(w*.12,d*.12,1.4*detail,1.5,.08,DETAIL.glass,16);
  for(let i=0;i<12;i++){const x=(i<6?-1:1)*w*.44,y=(i%6-2.5)*d*.105;m.ellipsoid(x,y,1.2,1.5*detail,1.4*detail,1.4*detail,i%3?'#b9c787':'#d4ae77',8,4);}
  for(const x of [-w*.43,w*.43]){m.cylinder(x,0,0,.35,4.8*detail,DETAIL.metal,8);m.kind=11;m.ellipsoid(x,0,4.8*detail,.32,.32,.45,'#dfcdaa',8,4);m.kind=8;}
 }
 if(p>.1&&p<.95){const q=beat(p,.1,.95);m.kind=11;groundRing(m,w*.94,d*.9,q,.65*(1-q),'#c8dfa1',.82);m.kind=8;}
}
export function vehicle(m,color='#b2b7a6',type='bus'){
 const service=type==='service',length=type==='train'?18:service?5.7:11,height=service?2.2:2.85;
 m.box(0,0,.60,length,2.5,height,color);m.box(0,0,.6+height,length*.96,2.5,.16,DETAIL.roof);
 m.box(0,0,.64,length*.98,2.55,.25,DETAIL.roofEdge);
 for(const side of [-1,1]){
  for(let x=-length*.29;x<length*.31;x+=service?1.9:1.6){m.box(x,side*1.26,1.55,service?1.35:1.15,.05,.92,DETAIL.glass);m.box(x,side*1.30,1.55,service?1.48:1.28,.05,.08,DETAIL.frame);}
  for(const x of [-length*.32,length*.32]){m.ellipsoid(x,side*1.17,.58,.57,.25,.57,DETAIL.roofEdge,8,4);m.ellipsoid(x,side*1.35,.58,.25,.07,.25,DETAIL.metal,8,4);}
  m.box(length*.32,side*1.31,.75,.65,.06,1.75,DETAIL.recess);m.box(length*.32,side*1.36,1.5,.52,.04,.78,DETAIL.glass);
 }
 m.box(length*.5+.02,0,1.45,.06,2.1,1.0,DETAIL.glass);for(const side of [-1,1])m.box(length*.51,side*.88,.9,.08,.35,.17,DETAIL.stone);
 if(service){m.box(-1,0,.6+height+.16,2.5,1.45,.22,DETAIL.metal);m.kind=11;m.box(length*.28,0,.6+height+.20,.7,.5,.22,'#d6ad6e');m.kind=8;}
}
function busCorridorPlace(m,o,p){
 const trace=beat(p,.05,.64),section=routeSection(o.route,.5-trace*.5,.5+trace*.5);m.at([0,0,0]);m.ribbon(section,.00031,'#8a9a99',1,deckZ(o));m.ribbon(section,.000045,'#e7dba4',1,deckZ(o)+.000003);
 const steps=48;for(let i=0;i<steps;i++){const t=(i+.5)/steps;if(Math.abs(t-.5)>trace*.5)continue;const q=routeAt(o.route,t);m.at([...q.point,deckZ(o)],q.angle,.0001);m.box(0,1.6,0,1.4,.24,.1,'#f2e5c0');if(i%3===0)m.box(0,-1.5,0,1.8,.3,.5,'#e8d8a9');}
 for(const [i,t] of [.18,.38,.62,.82].entries()){const details=beat(p,.32+i*.075,.57+i*.075);if(!details)continue;const q=o.furniture?.[Math.round((o.furniture.length-1)*t)]||routeAt(o.route,t);m.at([q.point[0],q.point[1],q.ground||.00004],q.angle,.0001);busShelter(m,details);}
}
export function busCorridor(m,o,p,options,record=null){
 // Public custom-Mesh callers retain every original writer invocation.
 if(record)stationarySpan(m,record,o,p,options.active?.id===o.id,'bus',()=>busCorridorPlace(m,o,p));else busCorridorPlace(m,o,p);
 if(!options.staticOnly&&!o.program&&p>.7&&(options.zoom||1)>14){for(let i=0;i<7;i++){const q=routeAt(o.route,((options.seconds||0)*.035+i/7)%1);m.at([...q.point,deckZ(o)],q.angle,.0001);vehicle(m,i%2?'#b0b8a5':'#d2be9b');}}

}
// Only an allocation hint survives a generation. Every mesh and packed snapshot
// still owns fresh bytes; smaller results shrink the next hint immediately.
let projectCapacity=16384;
const PROJECT_CAPACITY_MAX=8*1024*1024;
export function projectStaticMesh(objects,options={}){return projectMesh(objects.filter(record=>!(options.activities?.[record.id]||options.active?.id===record.id)),false,{...options,staticOnly:true});}
export function projectDynamicMesh(objects,futureOrOptions=false,shared={}){const options=typeof futureOrOptions==='object'?futureOrOptions:shared;return projectMesh(objects,false,{...options,dynamicOnly:true});}
export function projectMesh(objects,future=false,shared={}){const mesh=new Mesh(),zoom=shared.zoom??100,lod=zoom<15?'district':'close';
 if(projectCapacity>mesh.buffer.byteLength){mesh.buffer=new ArrayBuffer(projectCapacity);mesh.view=new DataView(mesh.buffer);}
 if(!shared.preview&&!shared.staticOnly)ambientTraffic(mesh,trafficSites,shared);
 for(const record of objects){const labelStart=mesh.bytes;try{const options={...shared,active:shared.activities?.[record.id]??shared.active};const o={...record,...(record.program?.furniture?{furniture:record.program.furniture}:{}),context:contextSites.records[record.key]||[]};const active=options.active?.id===o.id,p=o.proposal?1:active?Math.max(0,Math.min(1,options.active.progress*(o.citywide?1.4:1)-(o.citywide?['esil','almaty','saryarka','baikonur','nura'].indexOf(o.district)*.1:0))):1;
 if(o.phase==='baseline'){if(!shared.staticOnly)programDynamic(mesh,o,options);continue;}
 if(shared.dynamicOnly&&!active){programDynamic(mesh,o,options);if(!shared.preview){programOverview(mesh,o,p,options);macroEcho(mesh,o,p,options);arrivalMark(mesh,o,p,options);}continue;}
 if(active&&!o.proposal&&isHeroSchool(o)&&options.active.key===o.key){
  const t=schoolClock(options.active.elapsed??30);
  groundPreparation(mesh,o,{center:o.origin,span:o.size,orientation:o.orientation},1-beat(t,5.2,5.8),{wholeParcel:true});
 }else if(active&&!o.proposal&&!isHeroSchool(o)){
  const frame=projectPlacementFrame(o);
  const foundationAt=o.id==='M1' ? .395 : o.id==='M3' ? .03 : o.id==='M6' ? .6
   : o.id==='M10' ? Math.floor(Math.min(18,o.furniture?.length||0)/2)*.025
   : o.id==='M13' ? (o.furniture?.length ? .53 : .12) : o.id==='M14' ? .23 : 0;
  const preparationFrame=o.id==='M5'?{...frame,span:[.00032,.00032]}:frame;
  groundPreparation(mesh,o,preparationFrame,preparationStrength(p,foundationAt),{ground:o.id==='M5'?o.peopleSpots[0].position[2]:o.origin[2]});
 }
 // Below block scale only the purpose-built representation is resolvable. Avoid
 // rebuilding thousands of subpixel physical triangles during every camera frame.
 if(zoom<12){programStatic(mesh,o,{...options,programProgress:p});if(!shared.staticOnly){programOverview(mesh,o,p,options);macroEcho(mesh,o,p,options);arrivalMark(mesh,o,p,options);}continue;}
 mesh.at(o.origin,o.orientation,.0001);mesh.kind=8;mesh.tint=c=>{const color=o.id==='M3'&&c==='#4b8f9d'?DETAIL.glass:o.id==='M3'&&c==='#3b7588'?DETAIL.recess:c;return o.blocked?blend(color,'#cf9876',.6):o.proposal?blend(color,'#efe6ce',PROPOSAL_TINT):o.state==='outcome'?blend(color,color,0):blend(color,'#d9d9b5',.20);};
 if(isHeroSchool(o)){schoolScene(mesh,o,options);if(!shared.staticOnly&&!shared.preview)macroEcho(mesh,o,o.proposal?.3:p,options);continue;}
 if(o.id==='M4'){
  if(!o.program?.sites?.length)park(mesh,{...o,size:o.size||[.009,.006]},p,lod,options);

 }
 else if(o.id==='M1')busCorridor(mesh,o,p,options,record);
 else if(o.id==='M2'){if(!o.program?.sites?.length)signals(mesh,o,p);}
 else if(o.id==='M3')rails(mesh,o,p,options);
 else if(o.id==='M5')cleanFuel(mesh,o,p,options);
 else if(o.id==='M6'){if(!o.program?.sites?.some(s=>s.kind==='greening-belt-core'))greening(mesh,o,p);}
 else if(o.id==='M7'||o.id==='M8')stationarySpan(mesh,record,o,p,active,'civic/'+lod,()=>civic(mesh,o,p,lod));
 else if(o.id==='M9')sports(mesh,o,p,lod);
 else if(o.id==='M10')stationarySpan(mesh,record,o,p,active,'lighting',()=>lighting(mesh,o,p));
 else if(o.id==='M11')crossing(mesh,o,p);
 else if(o.id==='M12')requests(mesh,o,p,options);
 else if(o.id==='M13')pipes(mesh,o,p,options);
 else if(o.id==='M14')emergency(mesh,o,p,options,record);
 programStatic(mesh,o,{...options,programProgress:p});
 if(!shared.staticOnly&&!shared.preview)programDynamic(mesh,o,options);
 if(!shared.preview){if(!['M4','M6','M8','M9','M12'].includes(o.id))supportingSpaces(mesh,o,p,options);if(!shared.staticOnly){programOverview(mesh,o,p,options);macroEcho(mesh,o,p,options);arrivalMark(mesh,o,p,options);}}
 }finally{if(shared.projectLabelGeometry)shared.projectLabelGeometry(record,new DataView(mesh.buffer,labelStart,mesh.bytes-labelStart));}}if(!shared.staticOnly){if(shared.activities){for(const active of Object.values(shared.activities))networkSequence(mesh,objects,{...shared,active});}else networkSequence(mesh,objects,shared);}
 const packed=mesh.pack();let capacity=16384;while(capacity<packed.byteLength&&capacity<PROJECT_CAPACITY_MAX)capacity*=2;projectCapacity=capacity;return packed;
}

// Construction preparation retains its original placement and mesh bytes.
function projectPlacementFrame(o){
 if(o.id==='M2')return {center:[o.origin[0],o.origin[1],o.origin[2]+.00025],orientation:o.orientation||0,span:[.0022,.0018]};
 if(o.id==='M3'){const q=routeAt(o.route,.5);return {center:[...q.point,o.origin[2]+.0011],orientation:q.angle,span:[.0095,.0038]};}
 if(o.id==='M11'){const q=routeAt(o.route,.5);return {center:[...q.point,deckZ(o)+.00022],orientation:q.angle,span:[.0022,.0020]};}
 if(o.id==='M10'||o.id==='M13'||o.id==='M14'){
  const count=Math.min(18,o.furniture?.length||0),index=o.id==='M14'||o.id==='M13'?Math.round(((o.furniture?.length||1)-1)*.5):Math.round(Math.floor(count/2)/Math.max(1,count-1)*((o.furniture?.length||1)-1)),q=o.furniture?.[index]||routeAt(o.route,.5);
  return {center:[...q.point,(q.ground||o.origin[2])+(o.id==='M10'?.00055:.00028)],orientation:q.angle,span:o.id==='M10'?[.0025,.0020]:[.0022,.0020]};
 }
 if(o.id==='M1'){
  const q=o.furniture?.[Math.round((o.furniture.length-1)*.38)]||routeAt(o.route,.38);
  return {center:[q.point[0],q.point[1],(q.ground||.00004)+.00020],orientation:q.angle,span:[.0028,.0023]};
 }
 if(o.id==='M5'){
  const point=o.peopleSpots[0].position;
  return {center:[point[0],point[1],point[2]+.00015],orientation:0,span:[.0004,.0004],contextSources:[o.roofs[0].source]};
 }
 return {center:[o.origin[0],o.origin[1],o.origin[2]+.0005],orientation:o.orientation||0,span:o.size||(o.id==='M6'?[.0100,.0028]:o.id==='M13'?[.0022,.0018]:[.012,.010])};
}

/** Frame a drawn fixture nearest the existing gathering place, without moving either. */
export function projectPreviewFrame(o){
 if(o.parentKey)return programFrame(o);
 if(o.program?.sites?.length&&['M4','M2','M6'].includes(o.id))return programFrame(o.program.sites[0]);
 if(!['M10','M13','M14'].includes(o.id))return projectPlacementFrame(o);
 const furniture=o.furniture||[],count=Math.min(18,furniture.length),indices=o.id==='M10'
  ?Array.from({length:count},(_,i)=>Math.round(i/Math.max(1,count-1)*(furniture.length-1)))
  :(o.id==='M13'?[.2,.5,.8]:[.16,.5,.84]).map(t=>Math.round((furniture.length-1)*t));
 const person=o.peopleSpots?.[0]?.position||o.origin,fixtures=indices.map(i=>furniture[i]).filter(Boolean);
 const q=fixtures.reduce((nearest,fixture)=>!nearest||Math.hypot(fixture.point[0]-person[0],fixture.point[1]-person[1])<Math.hypot(nearest.point[0]-person[0],nearest.point[1]-person[1])?fixture:nearest,null)||routeAt(o.route,.5);
 // The native gallery's authored front is orientation-.38. Its reverse clears
 // the surveyed apartment blocks; Nura's emergency route retains that front
 // so its distant canonical resident stays legible in the joint camera frame.
 const yaw=(o.orientation||0)-.38+(o.id==='M14'&&o.district==='nura'?0:Math.PI);
 return {center:[...q.point,(q.ground||o.origin[2])+(o.id==='M10'?.00055:.00028)],orientation:q.angle,span:o.id==='M10'?[.0025,.0020]:[.0022,.0020],cameraYaw:Math.atan2(Math.sin(yaw),Math.cos(yaw))};
}

/** Eight world points around the useful primary place, excluding long network tails. */
export function projectFocusBounds(site){
 const frame=projectPreviewFrame(site),[x,y,z]=frame.center,[w,d]=frame.span,angle=frame.orientation,c=Math.cos(angle),s=Math.sin(angle),base=site.id==='M5'?site.peopleSpots[0].position[2]:Math.max(0,z-.0005),top=site.id==='M5'?base+.0003:base+({M1:.00055,M2:.00065,M3:.0030,M4:.0022,M6:.0022,M7:.0020,M8:.0017,M9:.00065,M10:.0012,M11:.0006,M12:.0009,M13:.00075,M14:.0008}[site.id]??.0015);
 return [base,top].flatMap(height=>[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([X,Y])=>[x+X*c-Y*s,y+X*s+Y*c,height]));
}

function supportingSpaces(m,o,p,options){
 if(o.proposal)return;
 for(const [i,node] of o.context.entries()){
  const grow=beat(p,.28+i*.08,.58+i*.075);if(!grow)continue;
  const width=node.radius*2/ .0001;m.at(node.point,0,.0001);
  if(o.id==='M12'){
   m.box(0,0,0,7,7,.25*grow,DETAIL.paving);utilityCabinet(m,grow);
   if(options.active?.id===o.id&&p<.96){m.at([0,0,0]);m.kind=11;m.ribbon([o.origin,node.point],.000035,'#a3d4ce',grow,.0008);m.kind=8;}
  }else{
   m.ellipsoid(0,0,.1,width*.5*grow,width*.42*grow,.15,'#7d9f70',12,3);m.ribbon([[-width*.43,-width*.3],[width*.43,-width*.3]],1.1,'#e1d3ab',grow,.5);
   for(const [j,[x,y]] of [[-5,1],[4,5],[4,-4]].entries()){const at=m.point([x,y,.5]);m.at(at,0,.000065);tree(m,0,0,grow,i+j,options.seconds||0);m.at(node.point,0,.0001);}
   bench(m,-3,-7,grow);
  }
 }
}

function civic(m,o,p,lod){
 const foundation=beat(p,0,.20),body=beat(p,.18,.68),detail=beat(p,.64,.94);m.box(0,0,0,54,42,.8*foundation,DETAIL.plinth);
 if(o.id==='M7'){
  civicModule(m,{x:-17,y:7,w:17,d:26,h:12.6,growth:body,levels:3,color:DETAIL.brick,lod});
  civicModule(m,{x:0,y:15,w:20,d:11,h:15,growth:body,levels:3,color:DETAIL.stone,lod});
  civicModule(m,{x:17,y:7,w:16,d:26,h:11.8,growth:body,levels:3,color:DETAIL.wall,lod});
  if(detail&&lod==='close'){
   entry(m,0,9.35,1,detail,4.8);m.box(0,-12,.85,29,12,.15,'#c7b78f');
   m.box(-6,-13,1,2.2,2.4,1.1*detail,DETAIL.wood);m.beam([-6,-13,2.1*detail],[-2.4,-16,1],.22,DETAIL.metal);
   for(const x of [5,10])m.cylinder(x,-10,1,.12,3.4*detail,DETAIL.metal,7);m.beam([5,-10,4.4*detail],[10,-10,4.4*detail],.13,DETAIL.metal);
   for(const x of [6.4,8.6]){m.beam([x,-10,4.25*detail],[x,-10,1.7],.05,DETAIL.roofEdge,4);m.box(x,-10,1.6,1.0,.7,.13,DETAIL.wood);}bench(m,-18,-15,detail);
   for(const x of [-24,24])m.box(x,-18,.9,.25,.25,1.2*detail,DETAIL.metal);
   m.beam([-24,-18,2.1],[ -7,-18,2.1],.07,DETAIL.metal,4);m.beam([7,-18,2.1],[24,-18,2.1],.07,DETAIL.metal,4);
  }
 }else{
  civicModule(m,{x:-9,y:7,w:31,d:22,h:11.7,growth:body,levels:3,color:DETAIL.wall,lod,pitched:false});
  civicModule(m,{x:14,y:1,w:14,d:30,h:8.4,growth:body,levels:2,color:DETAIL.stone,lod,pitched:true});
  if(detail&&lod==='close'){
   civicModule(m,{x:-6,y:-8,z:.8,w:10,d:7,h:3.8,growth:detail,levels:1,color:DETAIL.stone,lod,pitched:false});entry(m,-6,-11.55,1,detail,4.0);
   m.box(-17,-4.35,6.5,1.6,.22,.4,DETAIL.accent);m.box(-17,-4.35,5.9,.4,.22,1.6,DETAIL.accent);
   m.box(20,-15,.9,9,7,.14,DETAIL.paving);const original=m.origin;m.at(m.point([20,-15,1]),Math.PI/2,.0001);vehicle(m,'#ded9c8','service');m.at(original,o.orientation,.0001);bench(m,-20,-14,detail);
   for(const x of [-18,-14])m.box(x,-14,.9,1.8,1.1,.5*detail,DETAIL.stone);
  }
 }
 const garden=beat(p,.52,.87),origin=o.origin;
 m.at(origin,o.orientation,.0001);m.ribbon([[-25,-20],[25,-20]],2.6,DETAIL.paving,beat(p,.35,.65),.95);
 m.ribbon([[0,-23],[0,o.id==='M7'?8:-7]],3.8,DETAIL.paving,beat(p,.4,.68),.96);
 if(garden>0&&lod==='close')for(const [i,[x,y]] of [[-25,-19],[25,-19],[-25,19],[25,19]].entries()){const pos=m.point([x,y,.9]);m.at(pos,o.orientation,.00006);tree(m,0,0,garden,i);m.at(origin,o.orientation,.0001);}
}
function sports(m,o,p,lod){
 const surface=beat(p,0,.25),mark=beat(p,.2,.5),gear=beat(p,.45,.9);m.box(0,0,0,51,36,.35*surface,'#8eaaa1');m.box(0,0,.35,34,24,.1*mark,'#bb9579');
 if(mark){m.ribbon([[-17,-12],[17,-12],[17,12],[-17,12],[-17,-12]],.25,DETAIL.stone,mark,.5);m.ribbon([[0,-12],[0,12]],.25,DETAIL.stone,mark,.51);const ring=Array.from({length:25},(_,i)=>[Math.cos(i/24*Math.PI*2)*4,Math.sin(i/24*Math.PI*2)*4]);m.ribbon(ring,.22,DETAIL.stone,mark,.51);}
 if(gear){
  for(const side of [-1,1]){const x=side*17;for(const y of [-3.1,3.1])m.beam([x,y,.5],[x,y,.5+2.7*gear],.11,DETAIL.stone);m.beam([x,-3.1,.5+2.7*gear],[x,3.1,.5+2.7*gear],.11,DETAIL.stone);if(lod==='close'){for(let y=-3;y<=3;y+=.6)m.beam([x,y,.5],[x,y,.5+2.7*gear],.025,DETAIL.metal,4);for(let z=.9;z<3.1;z+=.55)m.beam([x,-3.1,z],[x,3.1,z],.025,DETAIL.metal,4);}}
  for(const x of [-12,-5,2]){m.cylinder(x,15,0,.11,2.5*gear,DETAIL.metal,7);m.beam([x,15,2.5*gear],[x+3,15,2.5*gear],.12,DETAIL.metal);}
  bench(m,8,-16,gear);m.cylinder(21,7,0,.13,4.3*gear,DETAIL.metal);m.box(21,7,3.5*gear,2.4,.16,1.4*gear,DETAIL.stone);m.ellipsoid(21,6.5,3.6*gear,.55,.55,.06,DETAIL.accent,12,3);
  if(lod==='close')for(let i=0;i<6;i++){const a=i*Math.PI/3;m.beam([21+Math.cos(a)*.5,6.5+Math.sin(a)*.5,3.58],[21+Math.cos(a)*.32,6.5+Math.sin(a)*.32,3.0],.025,DETAIL.stone,4);}
  for(const side of [-1,1]){m.box(side*24.7,0,.35,.18,33,1.2*gear,DETAIL.metal);m.box(side*24.7,0,1.55,.28,33,.10,DETAIL.stone);}m.box(0,17.5,.35,12,.20,1.2*gear,DETAIL.metal);
 }
}
function greening(m,o,p){
 const count=8;for(let row=0;row<2;row++)for(let i=0;i<count;i++){
  const growth=beat(p,i*.055+row*.09,.42+i*.055+row*.09),x=(i-(count-1)/2)*12,y=row?6:-6;tree(m,x,y,growth,i+row);m.cylinder(x,y,0,2.5*growth,.15,'#afa184',10);
  if(growth>.8){for(const dx of [-.9,.9])m.cylinder(x+dx,y,0,.09,2.1,DETAIL.wood,6);m.beam([x-.9,y,1.5],[x+.9,y,1.5],.035,DETAIL.stone,4);}
 }
}
function requests(m,o,p,options){
 const base=beat(p,0,.28),body=beat(p,.18,.62),detail=beat(p,.55,.9);m.box(0,0,0,26,25,.35*base,DETAIL.paving);
 civicModule(m,{x:0,y:3,z:.35,w:12,d:9,h:5.8,growth:body,levels:1,color:DETAIL.wall,lod:'close',pitched:true});
 if(detail){entry(m,0,-1.6,.55,detail,3.1);bench(m,-7,-5,detail);m.box(6,-2,.35,2.8,.8,1.35*detail,DETAIL.wood);m.box(6,-1.8,1.7,.12,.12,1.3*detail,DETAIL.metal);m.box(6,-1.8,2.4,2.3,.12,.6,DETAIL.stone);}
 const nodes=[[-10,-9],[10,-9],[-10,10],[10,10]];
 for(const [i,[x,y]] of nodes.entries()){
  const live=beat(p,.22+i*.075,.5+i*.075);m.ribbon([[0,0],[x,y]],.35,DETAIL.paving,live,.40);
  m.box(x,y,.35,1.3,.9,1.7*live,DETAIL.metal);m.box(x,y,2.05,1.4,1.0,.12*live,DETAIL.stone);m.box(x,y-.46,1.3,.85,.04,.35*live,DETAIL.glass);
  if(!options.staticOnly&&!o.program&&p>.8){const t=((options.seconds||0)*.3+i*.25)%1;m.kind=11;m.ellipsoid(x*(1-t),y*(1-t),.65,.22,.22,.12,'#cfbc8f',8,3);m.kind=8;}
 }
 if(options.active?.id===o.id&&p>.1&&p<1)for(let i=0;i<3;i++){const t=(p*2+i*.25)%1,x=(i-1)*10*(1-t),y=-10*(1-t);m.kind=11;m.ellipsoid(x,y,2+Math.sin(t*Math.PI),.35,.35,.35,'#d0b082',8,4);m.kind=8;}
}
function signals(m,o,p){
 const q={point:o.origin,angle:o.orientation},grow=beat(p,0,.7);
 for(const side of [-1,1]){m.at([q.point[0]-Math.sin(q.angle)*.00065*side,q.point[1]+Math.cos(q.angle)*.00065*side,q.point[2]],q.angle,.0001);
  m.cylinder(0,0,0,.16,4.8*grow,DETAIL.metal,8);m.box(0,0,3.0*grow,.65,.45,1.55*grow,DETAIL.roofEdge);
  for(const [i,color] of ['#bd806f','#d9b477','#8ea58a'].entries()){m.kind=11;m.ellipsoid(0,-.27,(3.3+i*.46)*grow,.16,.07,.16,p>.7?color:DETAIL.recess,8,4);m.kind=8;m.box(0,-.27,(3.1+i*.46)*grow,.46,.18,.08,DETAIL.roofEdge);}
  m.box(0,0,0,.48,.48,.18,DETAIL.plinth);
 }
}
export function lampPositions(o){const f=o.furniture||[];return Array.from({length:Math.min(18,f.length)},(_,i)=>f[Math.round(i/Math.max(1,Math.min(18,f.length)-1)*(f.length-1))]).map(q=>[q.point[0],q.point[1],(q.ground||.00004)+.0011]);}
function lighting(m,o,p){const lamps=lampPositions(o);lamps.forEach((q,i)=>{const growth=beat(p,i*.025,.5+i*.025);m.at([q[0],q[1],q[2]-.0011],o.furniture[Math.round(i/Math.max(1,lamps.length-1)*(o.furniture.length-1))].angle,.0001);m.cylinder(0,0,0,.34,11*growth,'#657d80',8);m.beam([0,0,11*growth],[2,0,11*growth],.28,'#657d80');if(growth>.9){m.kind=11;m.ellipsoid(2,0,10.8,.7,.4,.20,'#ffddb0',8,4);m.kind=8;if(i%4===0){m.box(.8,0,7.5,.7,.4,.3,DETAIL.stone);m.ellipsoid(1.6,0,7.7,.1,.18,.15,'#51676c',8,4);}}});}
function crossing(m,o,p){
 // These streets already have a .00034-wide roadway in the source city.
 // Add crossing paint to that surface instead of drawing a second corridor.
 for(const [j,t] of [.28,.5,.72].entries()){
  const q=routeAt(o.route,t),paint=beat(p,j*.09,.42+j*.09),detail=beat(p,.38+j*.09,.72+j*.09);m.at([...q.point,deckZ(o)],q.angle,.0001);
  for(let i=0;i<8*paint;i++)m.box((i-3.5)*1.3,0,0,.85,3.4,.1,'#f3e8c9');
  if(!o.program)for(const side of [-1,1]){for(const x of [-5.5,5.5])m.cylinder(x,side*7,0,.34,.9*detail,DETAIL.stone,7);m.cylinder(-6,side*7,0,.3,4.5*detail,DETAIL.metal,7);m.box(-6,side*7,3.2*detail,1.2,.16,1.2*detail,DETAIL.metal);m.box(-6,side*7-.12,3.35*detail,.8,.03,.8*detail,DETAIL.stone);}
 }
}
function rails(m,o,p,options){
 const trace=beat(p,.03,.66),ground=o.origin[2]??.00006,unit=1/12000,deck=ground+10*unit;
 const section=routeSection(o.route,.5-trace*.5,.5+trace*.5);m.at([0,0,0]);
 // The proposed corridor retains its verified route; its rolling stock and
 // station use the same metre-scale components as the existing city line.
 m.ribbon(section,8.8*unit,'#c7c8b5',1,deck);
 const cumulative=[0];for(let i=1;i<o.route.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(o.route[i][0]-o.route[i-1][0],o.route[i][1]-o.route[i-1][1])/unit);
 const length=cumulative.at(-1),at=(t,offset=0,z=10.22)=>{const q=routeAt(o.route,Math.max(0,Math.min(1,t)));return [q.point[0]-Math.sin(q.angle)*offset*unit,q.point[1]+Math.cos(q.angle)*offset*unit,ground+z*unit];};
 const begin=.5-trace*.5,end=.5+trace*.5;
 for(let d=begin*length;d<end*length;d+=12){const t=d/length,T=Math.min(end,(d+12)/length);
  for(const side of [-1,1]){m.quad(at(t,side*4.4,8.8),at(T,side*4.4,8.8),at(T,side*4.4,10),at(t,side*4.4,10),'#aaa999');m.beam(at(t,side*4.4,11.1),at(T,side*4.4,11.1),.09*unit,'#d5ddcd',4);}
  for(const track of [-2.1,2.1])for(const side of [-1,1])m.beam(at(t,track+side*.7175),at(T,track+side*.7175),.075*unit,'#6f8587',4);
 }
 for(let d=16;d<length;d+=32){const t=d/length;if(t<begin||t>end||Math.abs(t-.5)*length<44)continue;const q=routeAt(o.route,t);m.at([...q.point,ground],q.angle,unit);const grow=beat(p,.15,.7);if(grow>.08){m.at([...q.point,ground],q.angle,unit*grow);lrtPier(m,8.8);}}
 const station=beat(p,.56,.87);if(station){const q=routeAt(o.route,.5);m.at([...q.point,ground],q.angle,unit*station);cachedLrtStation(m,{length:90,width:23,platformHeight:10.1});}
 if(!options.staticOnly&&!o.program&&p>.85&&(options.zoom||1)>14){
  const travel=options.active?.id===o.id ? .46+(options.active.people||0)*.1 : .06+((options.seconds||0)*7.5/length)%.88;
  for(let i=0;i<4;i++){const t=travel+(i-1.5)*15.1/length,q=routeAt(o.route,Math.max(.02,Math.min(.98,t)));m.at(at(t,-2.1),q.angle,unit);lrtCar(m,{cab:i===0||i===3,flip:i===0});}
 }
}
function pipes(m,o,p,options){const reveal=options.active?.id===o.id&&p>.12&&p<.97;const trace=beat(p,.1,.72);
 if(reveal){m.at([0,0,0]);m.ribbon(o.route,.00135,'#405b60',1,-.0002);for(let i=1;i<o.route.length;i++){const a=o.route[i-1],b=o.route[i],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;for(const side of [-1,1]){const ox=-dy/l*.00067*side,oy=dx/l*.00067*side;m.quad([a[0]+ox,a[1]+oy,-.0002],[b[0]+ox,b[1]+oy,-.0002],[b[0]+ox,b[1]+oy,.00065],[a[0]+ox,a[1]+oy,.00065],'#ad9472');}}m.kind=13;const section=routeSection(o.route,.5-trace*.5,.5+trace*.5);for(let i=1;i<section.length;i++){const a=section[i-1],c=section[i];for(const [offset,color] of [[-.00025,'#bca678'],[.00025,'#849ba1']])m.beam([a[0]+offset,a[1],-.00003],[c[0]+offset,c[1],-.00003],.00015,color,10);}m.kind=8;}
 for(const t of [.2,.5,.8]){const q=routeAt(o.route,t);m.at([...q.point,deckZ(o)],q.angle,.0001);m.cylinder(0,0,0,.75,.12*trace,DETAIL.metal,12);m.cylinder(0,0,.12,.61,.035,DETAIL.plinth,12);for(let y=-.4;y<=.4;y+=.2)m.box(0,y,.16,.8,.035,.025,DETAIL.roofEdge);}
 for(const [i,t] of [.2,.5,.8].entries()){const q=o.furniture?.[Math.round((o.furniture.length-1)*t)];if(!q)continue;const live=beat(p,.45+i*.08,.65+i*.08);m.at([q.point[0],q.point[1],q.ground||.00004],q.angle,.0001);utilityCabinet(m,live);}
 if(!options.staticOnly&&!o.program&&p>.8&&(options.zoom||1)>14)for(let i=0;i<2;i++){const q=routeAt(o.route,((options.seconds||0)*.027+i*.5)%1);m.at([...q.point,deckZ(o)],q.angle,.0001);vehicle(m,'#d3b98e','service');}
}
function emergencyStations(m,o,p){
 for(const [i,t] of [.16,.5,.84].entries()){
  const q=o.furniture?.[Math.round((o.furniture.length-1)*t)]||routeAt(o.route,t),grow=beat(p,.1+i*.13,.42+i*.13);m.at([q.point[0],q.point[1],q.ground||.00004],q.angle,.0001);
  civicModule(m,{z:0,w:7.2,d:3.4,h:3.5,growth:grow,levels:1,color:DETAIL.wall,lod:'close',pitched:false});
  if(grow>.8){m.box(-1,-1.76,.18,2,.12,2.8,DETAIL.recess);m.box(-1,-1.85,.28,1.7,.06,2.5,DETAIL.glass);m.box(-1,-2.1,0,2.2,.7,.18,DETAIL.paving);m.box(1.5,-1.80,.4,1.6,.05,1.9,DETAIL.metal);m.box(1.5,-1.84,1.6,1.1,.04,.35,DETAIL.glass);for(let z=.7;z<1.4;z+=.22)m.box(1.5,-1.85,z,1.0,.03,.04,DETAIL.roofEdge);}
  m.cylinder(2,0,3.5*grow,.10,2.5*grow,DETAIL.metal,8);m.kind=11;m.ellipsoid(2,0,6*grow,.35,.35,.20,'#d6ad6e',8,4);m.kind=8;
 }
}
function emergency(m,o,p,options,record){
 stationarySpan(m,record,o,p,options.active?.id===o.id,'emergency',()=>emergencyStations(m,o,p));
 if(!options.staticOnly&&!o.program&&p>.6&&(options.zoom||1)>14)for(let i=0;i<6;i++){const r=routeAt(o.route,((options.seconds||0)*.05+i/6)%1);m.at([...r.point,deckZ(o)],r.angle,.0001);vehicle(m,i%2?'#d6b181':'#c0c5b5','service');}
}
function cleanFuel(m,o,p){
 for(const [i,roof] of o.roofs.entries()){
  const grow=beat(p,i*.045,.6+i*.045);
  // Small terminals retain the exact selected roof associations. The useful
  // household witness is authored at the already vetted ground gathering spot.
  m.at(roof.position,0,.0001);heatingTerminal(m,grow);
 }
 m.at(o.peopleSpots[0].position,0,.0001);householdHeating(m,beat(p,0,.6));
}
function networkSequence(m,objects,options){const a=options.active;if(!a||!['M12','M14','M2'].includes(a.id)||a.progress<.02)return;const nodes=objects.filter(o=>o.id===a.id&&!o.proposal),px=1/(options.scale||324),color=a.id==='M14'?'#e3bf7f':'#b2d5bd',fade=1-beat(a.progress,.82,1);if(fade<=0)return;m.at([0,0,0]);m.kind=14;m.tint=c=>blend(c,c,0);
 for(const [i,o] of nodes.entries()){const target=o.origin,from=nodes[(i+1)%nodes.length].origin;
  const route=Array.from({length:25},(_,j)=>{const t=j/24;return [from[0]+(target[0]-from[0])*t,from[1]+(target[1]-from[1])*t+.018*Math.sin(t*Math.PI)];}),progress=Math.max(0,Math.min(1,a.progress*1.85-i*.075));
  m.ribbon(route,3.3*px*fade,'#466c61',progress,.009);m.ribbon(route,1.8*px*fade,color,progress,.0091);
  const q=routeAt(route,progress);m.at([...q.point,.0092],0,px);m.ellipsoid(0,0,0,2.8*fade,2.8*fade,.2,progress>.9?'#efe2b3':color,8,4);
  m.at(target,0,px);groundRing(m,20,17,Math.max(.1,progress),1.1*fade,color,.01);m.at([0,0,0]);
 }m.kind=8;
}
