import assert from 'node:assert/strict';

/** Expected annotation positions from authored records, never sampled labels.
 * Keep this data/geometry oracle independent of runtime focus and projection.
 */
export function authoredAnnotationFocuses(placementsByMode,khanateViews,programsByMode={}){
 const result={astana:{},khanate:{}};
 const point=(value,description)=>{assert(Array.isArray(value)&&value.length===3&&value.every(Number.isFinite),`Invalid authored ${description}`);return value;};
 const routePoint=(route,fraction)=>{
  assert(Array.isArray(route)&&route.length>=2&&route.every(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite)),'Missing authored focus route');
  const lengths=route.slice(1).map((p,i)=>Math.hypot(p[0]-route[i][0],p[1]-route[i][1]));
  let distance=fraction*lengths.reduce((sum,length)=>sum+length,0);
  for(let i=0;i<lengths.length;i++){
   if(distance<=lengths[i]||i===lengths.length-1){const t=distance/(lengths[i]||1);return [route[i][0]+(route[i+1][0]-route[i][0])*t,route[i][1]+(route[i+1][1]-route[i][1])*t];}
   distance-=lengths[i];
  }
  assert.fail('Authored focus route has no segment');
 };
 const boundedFocus=(view,key,program=false)=>{
  const bounds=view?.focus??view,min=point(bounds?.min,`view minimum ${key}`),max=point(bounds?.max,`view maximum ${key}`);
  assert(min.every((value,i)=>value<=max[i]),`Reversed authored view bounds ${key}`);
  const center=min.map((value,i)=>(value+max[i])/2);
  const authored=point(bounds.center,`view center ${key}`);
  // New circular sites store their surveyed centre directly. Subtracting and
  // adding a radius can round its recovered midpoint by one Float64 ulp.
  assert(authored.every((value,i)=>program?Math.abs(value-center[i])<=Number.EPSILON*Math.max(Math.abs(min[i]),Math.abs(max[i]),Math.abs(value)):value===center[i]),`Authored view center disagrees with bounds ${key}`);
  return program?authored:center;
 };
 const placeFocus=(site,key)=>{
  const origin=point(site.origin,`program origin ${key}`);
  if(site.kind!=='park-area')return [origin[0],origin[1],origin[2]+.0004];
  const bounds=site.focusBounds;assert(Array.isArray(bounds)&&bounds.length===4&&bounds.every(Number.isFinite)&&bounds[0]<=bounds[2]&&bounds[1]<=bounds[3],`Invalid authored area bounds ${key}`);
  return [(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2,origin[2]+.00045];
 };
 for(const mode of ['astana','khanate']){
  const placements=placementsByMode[mode];assert(placements,`Missing authored placements for ${mode}`);
  for(const [key,original] of Object.entries(placements)){
   const program=programsByMode[mode]?.[key],site=program?.furniture?{...original,furniture:program.furniture}:original;
   assert(key===`${site.id}:${site.district}`&&site.key===key,`Authored placement identity disagrees for ${mode}:${key}`);
   const origin=point(site.origin,`origin ${mode}:${key}`);let focus;
   if(mode==='khanate'){
    const view=program?program.sites[['M1','M2','M3','M5','M6','M10','M11'].includes(site.id)?1:0]?.view:khanateViews?.[key];assert(view,`Missing authored historical view ${key}`);
    const center=boundedFocus(view,key,!!program);
    focus=site.id==='M7'?origin:center;
   }else if(site.id==='M7'&&site.district==='nura')focus=origin;
   else if(program?.sites?.length&&['M4','M2','M6'].includes(site.id))focus=placeFocus(program.sites[0],key);
   else if(site.id==='M2')focus=[origin[0],origin[1],origin[2]+.00025];
   else if(site.id==='M3'||site.id==='M11')focus=[...routePoint(site.route,.5),site.id==='M3'?origin[2]+.0011:origin[2]+.000006+.00022];
   else if(site.id==='M5'){
    const foot=point(site.peopleSpots?.[0]?.position,`principal roof foot ${key}`);focus=[foot[0],foot[1],foot[2]+.00015];
   }else if(site.id==='M1'){
    const furniture=site.furniture??[],fixture=furniture[Math.round((furniture.length-1)*.38)],xy=fixture?.point??routePoint(site.route,.38);
    focus=[...xy,(fixture?.ground||.00004)+.00020];
   }else if(['M10','M13','M14'].includes(site.id)){
    // Select only fixtures that are actually drawn, then the nearest one to
    // the authored gathering place. Equal distances retain drawing order.
    const furniture=site.furniture??[],count=Math.min(18,furniture.length),indices=site.id==='M10'
     ?Array.from({length:count},(_,i)=>Math.round(i/Math.max(1,count-1)*(furniture.length-1)))
     :(site.id==='M13'?[.2,.5,.8]:[.16,.5,.84]).map(t=>Math.round((furniture.length-1)*t));
    const person=point(site.peopleSpots?.[0]?.position??origin,`gathering place ${key}`);let nearest,nearestDistance=Infinity;
    for(const index of indices){const fixture=furniture[index];if(!fixture)continue;assert(Array.isArray(fixture.point)&&fixture.point.length===2&&fixture.point.every(Number.isFinite),`Invalid authored fixture ${key}`);const distance=Math.hypot(fixture.point[0]-person[0],fixture.point[1]-person[1]);if(distance<nearestDistance){nearest=fixture;nearestDistance=distance;}}
    const xy=nearest?.point??routePoint(site.route,.5);focus=[...xy,(nearest?.ground||origin[2])+(site.id==='M10'?.00055:.00028)];
   }else{
    assert(['M4','M6','M7','M8','M9','M12'].includes(site.id),`Unknown authored focus rule ${key}`);
    focus=[origin[0],origin[1],origin[2]+.0005];
   }
   result[mode][key]=point(focus,`annotation focus ${mode}:${key}`).slice();
   for(const child of program?.sites??[]){
    if(child.key===key)continue;
    assert(child.parentKey===key&&child.id===site.id&&child.district===site.district,`Authored child identity disagrees for ${mode}:${child.key}`);
    assert(!result[mode][child.key],`Duplicate authored child ${mode}:${child.key}`);
    result[mode][child.key]=(mode==='khanate'?(child.id==='M7'?point(child.origin,`school origin ${child.key}`):boundedFocus(child.view,child.key,true)):placeFocus(child,child.key)).slice();
   }
  }
 }
 return result;
}

/** Resolve unique child identities from saved geography, independently of UI diagnostics. */
export function authoredProgramSites(placementsByMode,programsByMode={}){
 const result={};
 for(const mode of ['astana','khanate']){
  const placements=placementsByMode[mode];assert(placements,`Missing authored placements for ${mode}`);result[mode]={...placements};
  for(const [parentKey,program] of Object.entries(programsByMode[mode]??{})){
   const parent=placements[parentKey];assert(parent,`Missing original parent ${mode}:${parentKey}`);
   for(const site of program.sites??[]){
    assert(Array.isArray(site.origin)&&site.origin.length===3&&site.origin.every(Number.isFinite),`Invalid authored child origin ${mode}:${site.key}`);
    assert(site.id===parent.id&&site.district===parent.district,`Authored child initiative disagrees ${mode}:${site.key}`);
    if(site.key===parentKey){assert(site.origin.every((value,i)=>value===parent.origin[i]),`Original parent moved in authored program ${mode}:${parentKey}`);continue;}
    assert(site.parentKey===parentKey&&typeof site.key==='string'&&!result[mode][site.key],`Invalid or duplicate authored child ${mode}:${site.key}`);
    result[mode][site.key]=site;
   }
  }
 }
 return result;
}

/** Independent GPU homogeneous clip arithmetic. Never imports world projection. */
export function projectAnchor(position,c){
 for(const key of ['x','y','yaw','pitch','zoom','width','height','perspective','rendererZoom','projectionScale'])assert(Number.isFinite(c[key]),`Missing exact camera diagnostic ${key}`);
 assert(c.width>0&&c.height>0&&c.zoom>0&&c.rendererZoom>0&&c.projectionScale>0,'Invalid projection dimensions / scale');
 assert(c.perspective>=0,'Invalid architectural lens');
 const a=Math.cos(c.yaw),b=Math.sin(c.yaw),p=Math.cos(c.pitch),d=Math.sin(c.pitch);
 const m=Array.from(new Float32Array([a,p*b,-d*b,-b,p*a,-d*a,0,d,p]));
 assert(Array.isArray(c.matrix)&&c.matrix.length===9&&c.matrix.every((value,i)=>value===m[i]),'Sampled rotation disagrees with independently reconstructed Float32 camera');
 assert(Math.abs(c.projectionScale-c.rendererZoom*c.height*.415)<1e-8,'CSS projection scale disagrees with GPU zoom');
 assert(Array.isArray(position)&&position.length===3&&position.every(Number.isFinite),'Invalid world anchor');
 const x=position[0]-c.x,y=position[1]-c.y,z=position[2];
 const qx=m[0]*x+m[3]*y+m[6]*z,qy=m[1]*x+m[4]*y+m[7]*z,qz=m[2]*x+m[5]*y+m[8]*z;
 const w=1-qz*c.perspective,aspect=c.width/c.height;
 const clipX=qx*.83*c.rendererZoom/aspect,clipY=qy*.83*c.rendererZoom;
 return {x:(clipX/w+1)*c.width/2,y:(1-clipY/w)*c.height/2,z:qz,w,visible:w>.015&&Math.abs(qz/w)<4};
}

/** Compare same-frame public anchors with authored focus / actual actor feet. */
export function auditAnchorFrames(samples,{placementsByMode,annotationFocusesByMode,world,minimumObservations=1000,minimumZooms=40,requireBothLenses=true}){
 let maxError=0,observations=0,worst=null;const tracked=new Set(),transitionZooms=new Set(),lenses=new Set(),modes=new Set();
 const observe=(position,x,y,c,detail)=>{
  assert(Number.isFinite(x)&&Number.isFinite(y),'Nonfinite recorded anchor');
  const q=projectAnchor(position,c),error=Math.hypot(x-q.x,y-q.y);
  assert(Number.isFinite(error),'Nonfinite anchor projection');
  if(error>maxError){maxError=error;worst={...detail,c,q,error};}
  observations++;
 };
 for(const sample of samples){
  const mode=sample.world??world;assert(mode==='astana'||mode==='khanate','Anchor sample must identify its actual world');
  if(world)assert(mode===world,'Anchor sample world differs from artifact metadata');
  const placements=placementsByMode[mode];assert(placements,`No canonical placements for ${mode}`);modes.add(mode);
  const annotationFocuses=annotationFocusesByMode?.[mode];assert(annotationFocuses,`No authored annotation focus map for ${mode}`);
  const c=sample.c;assert(c&&sample.r,'Camera and render pose required');
  assert(Number.isFinite(sample.frame)&&sample.frame>0,'Exact annotation frame diagnostic required');
  assert(Number.isFinite(sample.renderFrame)&&sample.renderFrame>0&&sample.renderFrame<=sample.frame,'Invalid GPU submission frame');
  assert(['x','y','yaw','pitch','zoom','width','height','perspective','rendererZoom','projectionScale'].every(key=>c[key]===sample.r[key]),'Labels and GPU use different camera / lens parameters');
  assert(c.matrix?.every((value,i)=>value===sample.r.matrix?.[i]),'Labels and GPU use different rotations');
  transitionZooms.add(c.zoom.toFixed(2));lenses.add(c.perspective===0?'orthographic':'architectural');
  for(const object of sample.objects){
   if(object.x===null||object.y===null)continue;
   const parentKey=`${object.id}:${object.district}`,key=object.site??parentKey,site=placements[key];assert(site,`Missing placement ${mode}:${key}`);
   if(object.site!==undefined){assert(site.id===object.id&&site.district===object.district,`Rendered child initiative differs from canonical ${mode}:${key}`);assert(key===parentKey||site.parentKey===parentKey,`Rendered child parent differs from canonical ${mode}:${key}`);if(object.child!==undefined)assert(object.child===(key!==parentKey),`Rendered child classification differs from canonical ${mode}:${key}`);}
   assert(object.frame===sample.frame,`Project ${key} annotation frame drift`);
   assert(Array.isArray(object.origin)&&object.origin.every((value,i)=>value===site.origin[i]),`Rendered project origin differs from canonical ${mode}:${key}`);
   const focus=annotationFocuses[key];assert(Array.isArray(focus)&&focus.length===3&&focus.every(Number.isFinite),`Missing authored annotation focus ${mode}:${key}`);
   const expected=c.zoom>15?focus:site.origin;
   observe(expected,object.x,object.y,c,{object,expectedAnnotationPosition:expected});tracked.add(`${mode}:${key}`);
  }
  if(sample.resident&&sample.resident.x!==null&&sample.resident.y!==null){
   const resident=sample.resident,actor=resident.actors.find(actor=>actor.id===resident.id);
   assert(Array.isArray(resident.position),'Exact resident foot diagnostic required');
   if(actor)assert(actor.position.every((value,i)=>value===resident.position[i]),'Resident foot diagnostic differs from physical actor');
   if(sample.annotationFrame)assert(sample.annotationFrame===sample.frame,'Resident conversation and world use different frames');
   observe(resident.position,resident.x,resident.y,c,{resident});tracked.add(`${mode}:${resident.anchor}`);
  }
 }
 assert(observations>minimumObservations,`Only ${observations} anchor observations`);
 assert(transitionZooms.size>minimumZooms,`Only ${transitionZooms.size} transition zooms`);
 if(requireBothLenses)assert(lenses.has('orthographic')&&lenses.has('architectural'),'Journey must cover overview and architectural perspective');
 assert(maxError<.002,`Anchor projection drift ${maxError}px; ${JSON.stringify(worst)}`);
 return {samples:samples.length,anchorObservations:observations,distinctZooms:transitionZooms.size,maxErrorPixels:maxError,worlds:[...modes],lenses:[...lenses],tracked:[...tracked],method:'Independent Float32 yaw/pitch rotation and GPU homogeneous clip W reconstructed from exact same-frame diagnostic lens / scale parameters. Parent and unique child origins must remain canonical in every observation; annotation positions use canonical origins at zoom <=15 and independently resolved saved program bounds / authored model focus at zoom >15, preserving school origin exceptions. All recorded project annotations and actual physical resident feet, including offscreen and horizon positions, are compared at <0.002 CSS px through motion, angle changes and safe-area / phone-fit shifts.'};
}
