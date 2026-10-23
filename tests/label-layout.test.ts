import {it,expect} from 'vitest';
import {placeProjectLabel,projectLabelVolume,projectLabelLeader,projectLabelFootprint,projectLabelPhysicalLeader,createProjectLabelFootprints} from '../src/world/label-layout';
import {cameraFrame} from '../src/world/projection';
import {sampleConstructionActivities} from '../src/world/construction-activities.js';
// @ts-expect-error Native JavaScript runtime, exercised as loaded by Vite.
import {constructionActivitiesRemoved} from '../src/world/runtime-core.js';
// @ts-expect-error Native JavaScript project authoring module has no declaration.
import {placements as modernSites,projectFocusBounds as modernBounds,projectMesh as modernMesh} from '../src/world/project-objects.js';
// @ts-expect-error Native JavaScript project authoring module has no declaration.
import {placements as historicalSites,projectFocusBounds as historicalBounds,projectMesh as historicalMesh} from '../src/world/khanate/projects.js';
type Rect={left:number;right:number;top:number;bottom:number};
type Point={x:number;y:number};
const separated=(a:Rect,b:Rect)=>a.bottom+7<=b.top||a.top-7>=b.bottom||a.right+7<=b.left||a.left-7>=b.right;
// Independent polygon clipping, rather than the production SAT collision test.
const physicalOverlap=(outline:readonly Point[],box:Rect)=>{
 let clipped=[...outline];
 for(const [axis,edge,direction] of [['x',box.left-7,1],['x',box.right+7,-1],['y',box.top-7,1],['y',box.bottom+7,-1]] as const){
  const next:Point[]=[];
  for(let i=0;i<clipped.length;i++){
   const a=clipped[i]!,b=clipped[(i+1)%clipped.length]!,insideA=(a[axis]-edge)*direction>=0,insideB=(b[axis]-edge)*direction>=0;
   if(insideA)next.push(a);
   if(insideA!==insideB){const t=(edge-a[axis])/(b[axis]-a[axis]);next.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
  }
  clipped=next;
 }
 return Math.abs(clipped.reduce((sum,a,i)=>{const b=clipped[(i+1)%clipped.length]!;return sum+a.x*b.y-a.y*b.x;},0))>1e-6;
};
it('moves a mobile project label clear of guidance and keeps its target within the viewport',()=>{
 const card={left:12,right:330,top:450,bottom:757},aya={left:230,right:378,top:698,bottom:754};
 const point=placeProjectLabel({x:137,y:438},{x:210,y:465},{width:120,height:28},{width:390,height:844},[card,aya]);
 expect(point).not.toBeNull();expect(point!.box.bottom).toBeLessThan(card.top-7);expect(point!.box.left).toBeGreaterThanOrEqual(8);expect(point!.box.right).toBeLessThanOrEqual(382);
});
it('does not stack a new label over an existing one or expose an unreachable control',()=>{
 const first=placeProjectLabel({x:170,y:300},{x:210,y:330},{width:160,height:30},{width:390,height:844},[])!;
 const next=placeProjectLabel({x:170,y:300},{x:210,y:330},{width:160,height:30},{width:390,height:844},[first.box]);
 expect(next).not.toBeNull();expect(next!.box.bottom+7<=first.box.top||next!.box.top-7>=first.box.bottom||next!.box.right+7<=first.box.left||next!.box.left-7>=first.box.right).toBe(true);
 expect(placeProjectLabel({x:170,y:300},{x:210,y:330},{width:160,height:30},{width:390,height:844},[{left:0,top:0,right:390,bottom:844}])).toBeNull();
});
it('keeps every side fallback outside its own volume and the UI, including a narrow legal strip',()=>{
 const volume={left:240,right:360,top:260,bottom:390},viewport={width:600,height:650},anchor={x:300,y:320},size={width:100,height:28},preferred={x:300,y:412};
 const below={left:0,right:600,top:400,bottom:650},above={left:0,right:600,top:0,bottom:250},right={left:370,right:600,top:0,bottom:650},left={left:0,right:230,top:0,bottom:650};
 for(const [ui,side] of [[[],'below'],[[below],'above'],[[below,above,left],'right'],[[below,above,right],'left']] as const){
  const obstacles=[volume,...ui],point=placeProjectLabel(anchor,preferred,size,viewport,obstacles)!;
  expect(point).not.toBeNull();expect(obstacles.every(r=>separated(point.box,r))).toBe(true);
  if(side==='below')expect(point.box.top).toBeGreaterThanOrEqual(volume.bottom+7);
  if(side==='above')expect(point.box.bottom).toBeLessThanOrEqual(volume.top-7);
  if(side==='right')expect(point.box.left).toBeGreaterThanOrEqual(volume.right+7);
  if(side==='left')expect(point.box.right).toBeLessThanOrEqual(volume.left-7);
 }
 // The available strip is only one label high; a 30 px row scan misses it.
 const floor={left:0,right:600,top:312,bottom:650},ceiling={left:0,right:600,top:0,bottom:268};
 const point=placeProjectLabel(anchor,preferred,size,viewport,[volume,floor,ceiling])!;
 expect(point).not.toBeNull();expect([volume,floor,ceiling].every(r=>separated(point.box,r))).toBe(true);
 expect(placeProjectLabel(anchor,preferred,size,viewport,[volume,{left:0,right:600,top:0,bottom:650}])).toBeNull();
});
it('clears real modern and historical M2/M7 bounds from both sides at all six viewport sizes',()=>{
 for(const [width,height] of [[1440,900],[1920,1080],[1280,720],[820,1180],[390,667],[360,640]])for(const [sites,bounds] of [[modernSites,modernBounds],[historicalSites,historicalBounds]])for(const id of ['M2','M7'])for(const yaw of [-.24,Math.PI-.24])for(const proposal of [false,true]){
  const site={...sites[`${id}:esil`],proposal},points:number[][]=bounds(site),center=points[0]!.map((_,i)=>(Math.min(...points.map(p=>p[i]!))+Math.max(...points.map(p=>p[i]!)))/2);
  // Use the one production projection at a readable close view, with the model
  // centered above a phone sheet or beside the desktop contextual surface.
  const frame=cameraFrame({x:center[0]!,y:center[1]!,yaw,pitch:1,zoom:width!<=800?38:70},width!,height!);
  const projected=points.map(frame.world),volume=projectLabelVolume(projected)!;
  const anchor=frame.world(site.origin),size={width:proposal?210:240,height:28},ui=width!<=800?{left:8,right:width!-8,top:height!*.72,bottom:height!}:{left:24,right:404,top:140,bottom:height!-85};
  const placement=placeProjectLabel(anchor,{x:anchor.x,y:volume.bottom+22},size,{width:width!,height:height!},[volume,ui]);
  expect(placement).not.toBeNull();expect(physicalOverlap(volume.outline,placement!.box)).toBe(false);expect(separated(placement!.box,ui)).toBe(true);
  expect(placement!.box.left).toBeGreaterThanOrEqual(8);expect(placement!.box.right).toBeLessThanOrEqual(width!-8);
  const leader=projectLabelLeader(volume,placement!);expect(Math.hypot(leader.x-placement!.x,leader.y-placement!.y)).toBeLessThan(150);
 }
});
it('builds a deterministic convex outline without changing projection inputs and attaches the leader to an edge',()=>{
 const points=[{x:200,y:100},{x:100,y:200},{x:0,y:100},{x:100,y:0},{x:100,y:100},{x:200,y:100},{x:100,y:300,visible:false},{x:Infinity,y:10}],original=JSON.stringify(points),volume=projectLabelVolume(points)!;
 expect(volume.outline).toEqual([{x:0,y:100},{x:100,y:0},{x:200,y:100},{x:100,y:200}]);
 expect(projectLabelVolume([...points].reverse())).toEqual(volume);expect(JSON.stringify(points)).toBe(original);
 expect(projectLabelLeader(volume,{x:250,y:250})).toEqual({x:150,y:150});
 expect(projectLabelVolume([{x:0,y:0},{x:1,y:1},{x:2,y:2}])).toBeNull();
 const corner=placeProjectLabel({x:50,y:50},{x:24,y:170},{width:26,height:18},{width:300,height:500},[volume]);
 expect(corner).toMatchObject({x:24,y:170});expect(physicalOverlap(volume.outline,corner!.box)).toBe(false);
});
it('keeps the 288-zoom V11 school front/back plates beside the real outline instead of a distant apartment',()=>{
 // Exact camera components from immutable V11 gallery 08a/08b sidecars. These
 // fixtures reproduce the original 398..1512 by 109..872 physical AABB.
 const cameras=[{x:-.3820898381081444,y:-.1461565830367435,yaw:-2.1517176055908203,pitch:1,zoom:287.9999998849097},{x:-.38287656212265536,y:-.14149056917924818,yaw:.9898748016357422,pitch:1,zoom:287.9999998849097}],site=modernSites['M7:nura'];
 const ui=[{left:24,right:404,top:185,bottom:809},{left:1142,right:1416,top:713,bottom:809},{left:1194,right:1416,top:826,bottom:894}];
 for(const pose of cameras){
  const frame=cameraFrame(pose,1440,900),volume=projectLabelVolume(modernBounds(site).map(frame.world))!,anchor=frame.world(site.origin),placement=placeProjectLabel(anchor,{x:anchor.x,y:volume.bottom+22},{width:71,height:28},{width:1440,height:900},[...ui,volume])!;
  expect(volume.left).toBeCloseTo(398.6314,3);expect(volume.right).toBeCloseTo(1511.9609,3);
  expect(placement).not.toBeNull();expect(physicalOverlap(volume.outline,placement.box)).toBe(false);expect(ui.every(r=>separated(placement.box,r))).toBe(true);
  expect(placement.box.left).toBeGreaterThan(500);expect(placement.box.top).toBeGreaterThan(600);
  const leader=projectLabelLeader(volume,placement);expect(Math.hypot(leader.x-placement.x,leader.y-placement.y)).toBeLessThan(50);
  expect(placement.box.left>volume.left&&placement.box.right<volume.right&&placement.box.top>volume.top&&placement.box.bottom<volume.bottom).toBe(true);
 }
});
const packedPoints=(points:readonly (readonly number[])[])=>{
 const mesh=new DataView(new ArrayBuffer(points.length*20));
 points.forEach(([x,y,z,kind],i)=>{mesh.setFloat32(i*20,x!,true);mesh.setFloat32(i*20+4,y!,true);mesh.setFloat32(i*20+8,z!,true);mesh.setUint8(i*20+18,kind!);});return mesh;
};
it('samples only exact low physical vertices, ignores transient marks and never joins separate objects across empty ground',()=>{
 const source=Array.from({length:100},(_,i)=>[i,5,0,8]);source.push([50,90,5,8],[50,95,0,11],[150,5,0,8]);
 const mesh=packedPoints(source),original=new Uint8Array(mesh.buffer).slice(),bounds=[[0,0,0],[100,100,10]],points=projectLabelFootprint(mesh,bounds);
 expect(points.length).toBeGreaterThan(0);expect(points.length).toBeLessThanOrEqual(32);expect(new Uint8Array(mesh.buffer)).toEqual(original);
 for(const p of points){expect(source.some(q=>q[3]===8&&q.slice(0,3).every((value,i)=>value===p[i]))).toBe(true);expect(p[1]).toBe(5);expect(p[2]).toBe(0);}
 const detached=[{x:0,y:0,visible:true},{x:100,y:0,visible:true}],leader=projectLabelPhysicalLeader(detached,{x:49,y:40});
 expect(leader).toBe(detached[0]);expect(leader!.x).not.toBe(49);
 expect(projectLabelPhysicalLeader([{x:Infinity,y:0},{x:0,y:0,visible:false}],{x:5,y:5})).toBeNull();
 const ground=packedPoints([[2,2,1,4],[8,8,1,4],[5,5,0,8],[5,5,2,4]]);
 expect(projectLabelFootprint(ground,[[0,0,0],[10,10,10]]).every(p=>p[2]===1)).toBe(true);
});
it('samples a current completed mesh once, withholds unbuilt geometry and releases old proposal/world/context samples',()=>{
 const mesh=packedPoints([[0,0,0,8],[1,0,0,8],[0,1,0,8]]),proposal={},completed={},otherWorld={},bounds=[[0,0,0],[1,1,1]],cache=createProjectLabelFootprints(),read=mesh.getFloat32.bind(mesh);let reads=0;
 mesh.getFloat32=(offset,littleEndian)=>{reads++;return read(offset,littleEndian);};
 cache.reset([{site:proposal,bounds}]);cache.capture(proposal,mesh,false);const first=cache.read(proposal),firstReads=reads;
 expect(first?.length).toBeGreaterThan(0);expect(firstReads).toBeGreaterThan(0);cache.capture(proposal,mesh,false);expect(reads).toBe(firstReads);expect(cache.read(proposal)).toBe(first);
 cache.reset([{site:completed,bounds}]);expect(cache.read(proposal)).toBeUndefined();expect(cache.read(completed)).toBeUndefined();cache.capture(completed,mesh,true);expect(reads).toBe(firstReads);expect(cache.read(completed)).toBeUndefined();
 cache.capture(completed,mesh,false);expect(reads).toBeGreaterThan(firstReads);const completedReads=reads;cache.capture(completed,mesh,true);expect(reads).toBe(completedReads);expect(cache.read(completed)).toBeUndefined();
 cache.capture(completed,mesh,false);expect(reads).toBeGreaterThan(completedReads);cache.reset([{site:otherWorld,bounds}]);expect(cache.read(completed)).toBeUndefined();cache.capture(completed,mesh,false);const worldReads=reads;cache.capture(otherWorld,mesh,false);expect(reads).toBeGreaterThan(worldReads);cache.clear();expect(cache.read(otherWorld)).toBeUndefined();
});
it('withholds an offscreen stop attachment and selects only an exact visible vertex clear of the current paper sheet',()=>{
 // Native V17 M1 resident pose: the cartographic origin is near the bottom
 // right, while all actual primary stop vertices are behind the top toolbar.
 const pose={x:-.014912869967271567,y:-.5206742591587977,yaw:2.5451751708984376,pitch:1,zoom:288},site=modernSites['M1:esil'],frame=cameraFrame(pose,1440,900);
 const bytes=modernMesh([site],false,{preview:true,zoom:288,seconds:4}),points=projectLabelFootprint(new DataView(bytes),modernBounds(site)),projected=points.map(world=>({...frame.world(world),world}));
 expect(projected.length).toBeGreaterThan(0);expect(frame.world(site.origin).y).toBeGreaterThan(700);
 expect(projected.every(p=>p.y<40)).toBe(true);
 expect(projectLabelPhysicalLeader(projected,{x:1352,y:711},{width:1440,height:900},[])).toBeNull();
 const visible={x:700,y:400,visible:true,world:[1,2,3]},covered={x:300,y:400,visible:true,world:[4,5,6]};
 const leader=projectLabelPhysicalLeader([covered,visible],{x:300,y:410},{width:1440,height:900},[{left:24,right:404,top:185,bottom:809}]);
 expect(leader).toBe(visible);expect(leader!.world).toBe(visible.world);
 expect(projectLabelPhysicalLeader([visible],{x:700,y:400},{width:360,height:640},[])).toBeNull();
});
it('selects the nearest real footprint vertex whose leader clears a protected body, without altering the eligibility path',()=>{
 const body=projectLabelVolume([{x:98,y:180},{x:102,y:180},{x:102,y:220},{x:98,y:220}])!,label={x:150,y:200};
 const blocked={x:90,y:200,visible:true,world:[1,2,3]},clear={x:80,y:150,visible:true,world:[4,5,6]},points=[blocked,clear];
 expect(projectLabelPhysicalLeader(points,label,{width:600,height:650},[])).toBe(blocked);
 expect(projectLabelPhysicalLeader(points,label,{width:600,height:650},[],[body])).toBe(clear);
 expect(projectLabelPhysicalLeader([blocked],label,{width:600,height:650},[],[body])).toBeNull();
 expect(projectLabelPhysicalLeader([blocked],label,{width:600,height:650},[])).toBe(blocked);
 expect(points).toEqual([blocked,clear]);expect(clear.world).toEqual([4,5,6]);
});
it('keeps a two-pixel body margin while leaving empty corners of its convex outline available',()=>{
 const body=projectLabelVolume([{x:100,y:180},{x:120,y:200},{x:100,y:220},{x:80,y:200}])!,label={x:150,y:200};
 const near={x:100,y:177.5,visible:true},withinMargin={x:100,y:178.5,visible:true};
 expect(projectLabelPhysicalLeader([near],{x:140,y:177.5},undefined,[],[body])).toBe(near);
 expect(projectLabelPhysicalLeader([withinMargin],{x:140,y:178.5},undefined,[],[body])).toBeNull();
 const emptyCorner={x:82,y:182,visible:true};
 expect(projectLabelPhysicalLeader([emptyCorner],{x:95,y:177},undefined,[],[body])).toBe(emptyCorner);
 expect(projectLabelPhysicalLeader([{x:100,y:200,visible:true}],label,undefined,[],[body])).toBeNull();
});
it('checks the actual clamped plate edge while retaining center-distance ranking and legacy calls',()=>{
 const body=projectLabelVolume([{x:270,y:345},{x:290,y:345},{x:290,y:363},{x:270,y:363}])!,plate={x:400,y:400,box:{left:317.5,right:482.5,top:386,bottom:414}};
 const source={x:100,y:200,visible:true,world:[1,2,3]},fartherClear={x:780,y:200,visible:true,world:[4,5,6]};
 // The old center ray misses the body; its actually rendered clamped edge does not.
 expect(projectLabelPhysicalLeader([source],{x:plate.x,y:plate.y},undefined,[],[body])).toBe(source);
 expect(projectLabelPhysicalLeader([source],plate,undefined,[],[body])).toBeNull();
 expect(projectLabelPhysicalLeader([source,fartherClear],plate,undefined,[],[body])).toBe(fartherClear);
 expect(projectLabelPhysicalLeader([source,fartherClear],plate)).toBe(source);
 const closerCenter={x:400,y:240,visible:true},closerEdge={x:240,y:380,visible:true};
 expect(projectLabelPhysicalLeader([closerEdge,closerCenter],plate)).toBe(closerCenter);
 expect(projectLabelPhysicalLeader([closerEdge,closerCenter],plate,undefined,[],[])).toBe(closerCenter);
});
it('attaches the real signal and teaching-court footprints in both native gallery angles and zooms without changing collision clearance',()=>{
 // Exact shared camera poses from V16 native 07/08/08a/08b sidecars. The old
 // framing-hull endpoints visibly stopped before the physical interventions.
 const fixtures=[
  {site:modernSites['M2:esil'],bounds:modernBounds,mesh:modernMesh,width:97,cameras:[
   {x:-.012571689623289785,y:-.463768666245386,yaw:-.5984970092773437,pitch:1,zoom:287.99999988490976},
   {x:-.008981114034997791,y:-.4608169342696632,yaw:2.5430953979492186,pitch:1,zoom:287.99999988490976},
   {x:-.01188094292503105,y:-.46290230896529877,yaw:-.5984970855712892,pitch:1,zoom:518.4000008130478},
   {x:-.00967185777327047,y:-.46168329144275866,yaw:2.543095321655273,pitch:1,zoom:518.4000008130478}]},
  {site:historicalSites['M7:esil'],bounds:historicalBounds,mesh:historicalMesh,width:117,cameras:[
   {x:-.022686026935192075,y:-.07618317173931599,yaw:-.5,pitch:1,zoom:205.5321502968842},
   {x:-.017161523077185374,y:-.0728456951827122,yaw:2.6415924072265624,pitch:1,zoom:205.5321502968842},
   {x:-.021603446616152527,y:-.07507027025709674,yaw:-.5,pitch:1,zoom:369.95787126246796},
   {x:-.01824411072654274,y:-.07395860519316118,yaw:2.6415924072265624,pitch:1,zoom:369.95787126246796}]}
 ];
 const ui=[{left:24,right:404,top:185,bottom:809},{left:1142,right:1416,top:713,bottom:809},{left:1194,right:1416,top:826,bottom:894}];
 for(const fixture of fixtures)for(const proposal of [false,true]){
  const site={...fixture.site,proposal},bytes=fixture.mesh([site],false,{preview:true,zoom:288,schoolTime:30,seconds:4}),view=new DataView(bytes),bounds=fixture.bounds(site),points=projectLabelFootprint(view,bounds);
  expect(points.length).toBeGreaterThan(0);expect(points.length).toBeLessThanOrEqual(32);
  for(const point of points){let found=false;for(let at=0;at<view.byteLength;at+=20)if((view.getUint8(at+18)===4||view.getUint8(at+18)===8)&&point.every((value,i)=>value===view.getFloat32(at+i*4,true))){found=true;break;}expect(found).toBe(true);}
  for(const pose of fixture.cameras){
   const frame=cameraFrame(pose,1440,900),volume=projectLabelVolume(bounds.map(frame.world))!,anchor=frame.world(site.origin),placement=placeProjectLabel(anchor,{x:anchor.x,y:volume.bottom+22},{width:fixture.width,height:28},{width:1440,height:900},[...ui,volume])!;
   expect(physicalOverlap(volume.outline,placement.box)).toBe(false);expect(ui.every(r=>separated(placement.box,r))).toBe(true);
   const projected=points.map(world=>({...frame.world(world),world})),leader=projectLabelPhysicalLeader(projected,placement)!;
   expect(leader).not.toBeNull();expect(projected).toContain(leader);expect(frame.world(leader.world)).toMatchObject({x:leader.x,y:leader.y});
   const old=projectLabelLeader(volume,placement);expect(Math.hypot(old.x-leader.x,old.y-leader.y)).toBeGreaterThan(15);
  }
 }
});
it('observes each actual project upload without changing its packed bytes, including early-return macro and hero branches',()=>{
 for(const [sites,mesh] of [[modernSites,modernMesh],[historicalSites,historicalMesh]])for(const key of ['M2:esil','M7:nura'])for(const zoom of [8,288]){
  const site={...sites[key],proposal:true},baseline=mesh([site],false,{preview:true,zoom,schoolTime:30,seconds:4}),seen:{site:unknown;bytes:number}[]=[],actual=mesh([site],false,{preview:true,zoom,schoolTime:30,seconds:4,projectLabelGeometry:(record:unknown,view:DataView)=>{seen.push({site:record,bytes:view.byteLength});projectLabelFootprint(view,(sites===modernSites?modernBounds:historicalBounds)(site));}});
  expect(Buffer.compare(Buffer.from(actual),Buffer.from(baseline))).toBe(0);expect(seen).toHaveLength(1);expect(seen[0]!.site).toBe(site);expect(seen[0]!.bytes).toBeGreaterThan(0);
 }
});
it('uploads the final static project and releases its physical label after the later of two restored receipts completes',()=>{
 const sites=['M8:nura','M9:esil'].map(key=>({...modernSites[key],proposal:false})),receipts=sites.map((site:any,i)=>({key:site.key,startedAt:1000+i*2000,durationMs:12000})),originalReceipts=JSON.stringify(receipts),context={cache:new Map(),quietKeys:new Set<string>()},footprints=createProjectLabelFootprints();
 footprints.reset(sites.map(site=>({site,bounds:modernBounds(site)})));
 let previous=sampleConstructionActivities(sites,receipts,12000,context),lastUpload:ArrayBuffer|undefined;const completedAt:number[]=[],uploadsAt:number[]=[];
 expect(Object.keys(previous)).toEqual(['M8','M9']);
 // The camera and its primary M8 choreography are settled by 13 s. Only the
 // independent M9 saved clock can request the final static upload at 15 s.
 for(const now of [12016,13000,14999,15000,15016]){
  const current=sampleConstructionActivities(sites,receipts,now,context),removed=constructionActivitiesRemoved(previous,current);
  if(removed)completedAt.push(now);
  if(removed||Object.keys(current).length){uploadsAt.push(now);lastUpload=modernMesh(sites,false,{preview:true,zoom:160,activities:current,seconds:4,projectLabelGeometry:(site:object,mesh:DataView)=>footprints.capture(site,mesh,!!current[(site as {id:string}).id])});}
  if(now===13000){expect(Object.keys(current)).toEqual(['M9']);expect(footprints.read(sites[0]!)).toBeDefined();expect(footprints.read(sites[1]!)).toBeUndefined();}
  if(now===14999)expect(footprints.read(sites[1]!)).toBeUndefined();
  if(now===15000)expect(footprints.read(sites[1]!)?.length).toBeGreaterThan(0);
  previous=current;
 }
 expect(completedAt).toEqual([13000,15000]);expect(uploadsAt).toEqual([12016,13000,14999,15000]);expect(JSON.stringify(receipts)).toBe(originalReceipts);
 const completed=modernMesh(sites,false,{preview:true,zoom:160,seconds:4});expect(new Uint8Array(lastUpload!)).toEqual(new Uint8Array(completed));
 expect(constructionActivitiesRemoved({},{})).toBe(false);
});
