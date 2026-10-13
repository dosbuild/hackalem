import {describe,it,expect} from 'vitest';
import {cameraFrame,revealFocus,fitContext,annotationPosition,occluded} from '../src/world/projection';
import {geoPoint,rotation,transform} from '../src/world/city-math';
import bootstrap from '../src/world/bootstrap.json';
import {visibleBounds,frustumPlanes} from '../src/world/render-policy';
// @ts-expect-error Native JavaScript authoring module has no TypeScript declaration.
import {placements,projectFocusBounds,projectPreviewFrame,projectObjects} from '../src/world/project-objects.js';

describe('one camera frame for city and anchored content',()=>{
 it('retains homogeneous edge and near-plane intersections with prepared clip planes',()=>{
  for(const zoom of [1,3,62,160,288,518.4,576,1507.95,1774.95,2304])for(const yaw of [-2.7,-.28,0,1.8]){
   const f=cameraFrame({x:.02,y:-.03,yaw,pitch:.82,zoom},1440,900),view={rotation:f.matrix,center:[.02,-.03,0],aspect:1.6,zoom:f.rendererZoom,perspective:f.perspective},prepared={...view,clipPlanes:frustumPlanes(view)};
   for(let i=0;i<120;i++){
    const x=.02+Math.sin(i*1.13)*.08,y=-.03+Math.cos(i*.77)*.08,bounds=[x-.002,y-.003,x+.002,y+.003,0,.002+(i%8)*.001];
    expect(visibleBounds(bounds,prepared)).toBe(visibleBounds(bounds,view));
    const corners=[bounds[0],bounds[2]].flatMap(x=>[bounds[1],bounds[3]].flatMap(y=>[bounds[4],bounds[5]].map(z=>f.world([x!,y!,z!]))));
    if(corners.some(p=>p.visible&&p.x>=0&&p.x<=1440&&p.y>=0&&p.y<=900))expect(visibleBounds(bounds,prepared)).toBe(true);
   }
  }
 });
 it('agrees with GPU clip coordinates during overview, district and encounter motion',()=>{
  for(let step=0;step<=120;step++){
   const t=step/120,pose={x:.1-t*.22,y:.12-t*.5,yaw:-.12+t*.3,pitch:.4+t*.5,zoom:1+191*Math.sin(t*Math.PI)};
   for(const [width,height] of [[1440,900],[1366,768],[390,844]]){
    const frame=cameraFrame(pose,width!,height!);
    for(const anchor of Object.values(bootstrap.anchors)){
     const world=geoPoint(anchor.position,.004),p=frame.world(world),q=transform(Array.from(new Float32Array(rotation(pose.yaw,pose.pitch))),[world[0]!-pose.x,world[1]!-pose.y,world[2]!]);
     // Independent homogeneous GPU clip calculation, including the lens W.
     const w=1-q[2]!*frame.perspective;
     expect(p.x).toBeCloseTo((q[0]!*.83*frame.rendererZoom/(width!/height!)/w+1)*width!/2,7);
     expect(p.y).toBeCloseTo((1-q[1]!*.83*frame.rendererZoom/w)*height!/2,7);
     const ground=frame.project(anchor.position),inverse=frame.inverse(ground.x,ground.y)!;
     if(!ground.visible)continue;
     expect(inverse[0]).toBeCloseTo(anchor.position[0]!,9);expect(inverse[1]).toBeCloseTo(anchor.position[1]!,9);
     const [a,b,c,d,e,f]=frame.billboard(world),edge=frame.world([world[0]!,world[1]!,world[2]!-.00032]);
     expect(e!+c!).toBeCloseTo(edge.x,7);expect(f!+d!).toBeCloseTo(edge.y,7);expect(a).toBeTypeOf('number');expect(b).toBeTypeOf('number');
    }
   }
  }
 });
 it('agrees with homogeneous GPU clipping around the extended encounter near plane',()=>{
  for(const zoom of [1507.95,1774.95,2304])for(const [width,height]of [[390,667],[360,640],[1440,900]])for(const yaw of [-2.7,-.28,1.8]){
   const pose={x:.02,y:-.03,yaw,pitch:.82,zoom},frame=cameraFrame(pose,width!,height!),m=frame.matrix,view={rotation:m,center:[pose.x,pose.y,0],aspect:width!/height!,zoom:frame.rendererZoom,perspective:frame.perspective},prepared={...view,clipPlanes:frustumPlanes(view)};
   for(const nearW of [-.03,.015,.05,1,2])for(const edge of [-1,0,1]){
    const q=[edge*nearW*view.aspect/(view.zoom*.83),0,(1-nearW)/frame.perspective];
    const center=[pose.x+m[0]!*q[0]!+m[1]!*q[1]!+m[2]!*q[2]!,pose.y+m[3]!*q[0]!+m[4]!*q[1]!+m[5]!*q[2]!,m[6]!*q[0]!+m[7]!*q[1]!+m[8]!*q[2]!],d=6/frame.scale;
    const bounds=[center[0]!-d,center[1]!-d,center[0]!+d,center[1]!+d,center[2]!-d,center[2]!+d];
    const corners=[bounds[0],bounds[2]].flatMap(x=>[bounds[1],bounds[3]].flatMap(y=>[bounds[4],bounds[5]].map(z=>[x!,y!,z!])));
    const clips=corners.map(world=>{
     const p=frame.world(world),v=transform(m,[world[0]!-pose.x,world[1]!-pose.y,world[2]!]),w=1-v[2]!*frame.perspective,x=v[0]!*view.zoom*.83/view.aspect,y=v[1]!*view.zoom*.83,z=v[2]!*.25;
     expect(p.x).toBeCloseTo((x/w+1)*width!/2,7);expect(p.y).toBeCloseTo((1-y/w)*height!/2,7);expect(p.visible).toBe(w>.015&&Math.abs(v[2]!/w)<4);
     return [w+x,w-x,w+y,w-y,w-z,w+z];
    });
    const intersects=[0,1,2,3,4,5].every(i=>clips.some(p=>p[i]!>=-.000001));
    expect(visibleBounds(bounds,view)).toBe(intersects);expect(visibleBounds(bounds,prepared)).toBe(intersects);
   }
  }
 });
 it('naturally scales physical objects with the world without clamping their screen size',()=>{
  const pose={x:0,y:0,yaw:.2,pitch:.8,zoom:1};
  const width=(zoom:number)=>{const f=cameraFrame({...pose,zoom},1440,900,0,{perspective:false}),a=f.world([0,0,0]),b=f.world([.017,0,0]);return Math.hypot(a.x-b.x,a.y-b.y);};
  expect(width(24)/width(1)).toBeCloseTo(24,9);expect(width(160)/width(1)).toBeCloseTo(160,9);expect(width(192)/width(1)).toBeCloseTo(192,9);
 });
 it('blends the lens continuously from one geographic scale and intersects elevated planes',()=>{
  const pose={x:.03,y:-.1,yaw:-.28,pitch:.9,zoom:1};
  expect(cameraFrame(pose,1440,900).perspective).toBe(0);
  expect(cameraFrame({...pose,zoom:7},1440,900,0,{overviewZoom:7}).perspective).toBe(0);
  const world=[pose.x+.004,pose.y-.002,.003];
  for(const zoom of [1,1.2,1.21,2,2.99,3,30,160]){
   const frame=cameraFrame({...pose,zoom},1440,900),point=frame.world(world),back=frame.inverseWorld(point.x,point.y,world[2]);
   world.forEach((value,i)=>expect(back![i]).toBeCloseTo(value,10));
   const adjacent=cameraFrame({...pose,zoom:zoom+.00001},1440,900).world(world);
   expect(Math.hypot(point.x-adjacent.x,point.y-adjacent.y)).toBeLessThan(.01);
  }
  expect(cameraFrame({...pose,zoom:160},1440,900).world([pose.x,pose.y,.1]).visible).toBe(false);
 });
 it('moves an obscured focus through the camera, and preserves a readable camera when a drawer closes',()=>{
  const point=[71.431,51.139],pose={x:0,y:0,yaw:-.12,pitch:.78,zoom:24};
  const rect={left:600,top:80,right:1420,bottom:880};
  const next=revealFocus(pose,point,1440,900,[rect]),p=cameraFrame(next,1440,900).project(point);
  expect(occluded(p,[rect],43)).toBe(false);expect(next.zoom).toBe(pose.zoom);
  expect(revealFocus(next,point,1440,900,[])).toEqual(next);
 });
 it('keeps a mobile encounter above its sheet without changing zoom or geographic anchor',()=>{
  const point=[71.431,51.139],pose={x:0,y:0,yaw:0,pitch:.8,zoom:24},sheet={left:8,right:382,top:435,bottom:844};
  const next=revealFocus(pose,point,390,844,[sheet],32),p=cameraFrame(next,390,844).project(point);
  expect(p.y).toBeLessThan(403);expect(next.zoom).toBe(24);
  expect(annotationPosition(p,{width:374,height:401},{width:390,height:844})).toEqual({x:8,y:435});
 });
 it('fits a physical model in the narrow phone band above a tall decision sheet',()=>{
  const pose={x:0,y:0,yaw:-.24,pitch:.82,zoom:232},sheet={left:10,right:380,top:216,bottom:590};
  const points=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[0,.0016].map(z=>[x*.0042,y*.0034,z])));
  const next=fitContext(pose,points,390,667,[sheet]),frame=cameraFrame(next,390,667),projected=points.map(frame.world);
  expect(next.zoom).toBeLessThan(pose.zoom);
  expect(Math.min(...projected.map(p=>p.y))).toBeGreaterThan(108);
  expect(Math.max(...projected.map(p=>p.y))).toBeLessThan(207);
  expect(projected.every(p=>p.visible&&p.x>10&&p.x<380)).toBe(true);
  expect(fitContext(next,points,390,667,[sheet])).toEqual(next);
  const desktop=fitContext(pose,points,1440,900,[sheet]),desktopPoints=points.map(cameraFrame(desktop,1440,900).world);
  expect(desktopPoints.every(p=>p.visible&&!occluded(p,[sheet],8))).toBe(true);
  expect(fitContext(desktop,points,1440,900,[sheet])).toEqual(desktop);
 });
 it('retreats from the near plane without collapsing full source parks to a city overview',()=>{
  for(const districtId of ['esil','almaty','saryarka','baikonur','nura']){
   const site=projectObjects({commitments:[{initiativeId:'M4',districtId,scope:'district'}],comparisonPosition:1},[{id:districtId}])[0],authored=projectPreviewFrame(site),points=projectFocusBounds(site);
   const pose={x:authored.center[0],y:authored.center[1],yaw:-.12,pitch:.78,zoom:160};
   for(const [width,height,sheet]of [[1280,720,{left:20,right:400,top:100,bottom:630}],[390,844,{left:8,right:382,top:480,bottom:759}]] as const){
    const next=fitContext(pose,points,width,height,[sheet]),projected=points.map(cameraFrame(next,width,height).world);
    expect(next.zoom).toBeGreaterThan(2);
    expect(projected.every((p:{visible:boolean;x:number;y:number})=>p.visible&&!occluded(p,[sheet],8))).toBe(true);
    expect(Math.max(...projected.map((p:{x:number})=>p.x))-Math.min(...projected.map((p:{x:number})=>p.x))).toBeGreaterThan(80);
    expect(fitContext(next,points,width,height,[sheet])).toEqual(next);
   }
  }
 });
 it('fits the whole project beside a tablet sheet while retaining its world points',()=>{
  const pose={x:0,y:0,yaw:.3,pitch:.82,zoom:232},sheet={left:24,right:404,top:140,bottom:1094};
  const points=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[0,.002].map(z=>[x*.0042,y*.0034,z])));
  const original=JSON.stringify(points),next=fitContext(pose,points,820,1180,[sheet]),projected=points.map(cameraFrame(next,820,1180).world);
  expect(projected.every(p=>p.visible&&p.x>414&&p.x<804&&p.y>140&&p.y<1035)).toBe(true);
  expect(next.zoom).toBeLessThan(pose.zoom);
  expect(JSON.stringify(points)).toBe(original);
  expect(fitContext(next,points,820,1180,[sheet])).toEqual(next);
 });
 it('uses the open city beside a phone atlas when comparing a real sports court',()=>{
  const pose={x:-.414835367,y:-.059516639,yaw:-.12,pitch:.78,zoom:160};
  const sheet={left:10,right:350,top:255.8125,bottom:563},atlas={left:12,right:166.7,top:155,bottom:195},controls={left:312,right:348,top:155,bottom:351};
  const points=[-.41893234,-.41343234].flatMap(x=>[-.046011025,-.042011025].flatMap(y=>[.000035,.000685].map(z=>[x,y,z])));
  const next=fitContext(pose,points,360,640,[sheet,atlas,controls]),p=points.map(cameraFrame(next,360,640).world);
  expect(p.every(q=>q.visible&&q.y>130&&q.y<sheet.top-8&&!occluded(q,[atlas,controls],8))).toBe(true);
  expect(Math.max(...p.map(q=>q.y))-Math.min(...p.map(q=>q.y))).toBeGreaterThan(44);
  expect(next.zoom).toBe(pose.zoom);
  expect(fitContext(next,points,360,640,[sheet,atlas,controls])).toEqual(next);
 });
 it('fits the asymmetric close school volume once and holds that pose when the proposal closes',()=>{
  const pose={x:-.3816152475813026,y:-.14124939680644058,yaw:1.4917176175577105,pitch:.82,zoom:232};
  const points:number[][]=projectFocusBounds(placements['M7:nura']),sheet={left:24,right:404,top:140,bottom:814};
  const next=fitContext(pose,points,1440,900,[sheet]),p=points.map(cameraFrame(next,1440,900).world);
  expect(p.every(q=>q.visible&&q.x>=414&&q.x<=1424&&q.y>=140&&q.y<=755)).toBe(true);
  expect(fitContext(next,points,1440,900,[])).toEqual(next);
  expect(next.yaw).toBe(pose.yaw);expect(next.pitch).toBe(pose.pitch);
 });
});
