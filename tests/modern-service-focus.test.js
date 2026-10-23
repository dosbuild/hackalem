import {describe,it,expect} from 'vitest';
import {placements,projectPreviewFrame,lampPositions,projectMesh} from '../src/world/project-objects.js';
import {routeAt} from '../src/world/placement-geometry.js';

const districts=['esil','almaty','saryarka','baikonur','nura'];
const selected={M10:[12,7,10,11,3],M13:[4,14,15,20,null],M14:[7,10,15,19,6]};
const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));

describe('modern service physical focus',()=>{
 it('selects existing drawn fixtures near canonical people and leaves source placements intact',()=>{
  const before=JSON.stringify(placements);
  for(const [id,indices] of Object.entries(selected))for(const [i,district] of districts.entries()){
   const site=placements[`${id}:${district}`],index=indices[i],fixture=index===null?routeAt(site.route,.5):site.furniture[index],frame=projectPreviewFrame(site);
   expect(frame.center.slice(0,2),site.key).toEqual(fixture.point);
   expect(frame.orientation,site.key).toBe(fixture.angle);
   expect(frame.span,site.key).toEqual(id==='M10'?[.0025,.0020]:[.0022,.0020]);
   if(id==='M10')expect(lampPositions(site).some(point=>point[0]===frame.center[0]&&point[1]===frame.center[1]),site.key).toBe(true);
   if(index!==null){
    const mesh=new DataView(projectMesh([{...site,proposal:false,state:'planned',progress:1}],false,{zoom:288,preview:true,seconds:4,schoolTime:30}));
    let physical=false;
    for(let offset=0;offset<mesh.byteLength;offset+=20){
     const x=mesh.getFloat32(offset,true),y=mesh.getFloat32(offset+4,true),z=mesh.getFloat32(offset+8,true);
     if(Math.hypot(x-fixture.point[0],y-fixture.point[1])<.00055&&z>(fixture.ground||.00004)+(id==='M10'?.0007:.00018)){physical=true;break;}
    }
    expect(physical,site.key+' has existing physical fixture vertices').toBe(true);
   }
  }
  expect(JSON.stringify(placements)).toBe(before);
 });
 it('exposes the source-checked native reverse yaw, retaining the clear Nura emergency front',()=>{
  for(const id of Object.keys(selected))for(const district of districts){
   const site=placements[`${id}:${district}`],frame=projectPreviewFrame(site);
   expect(frame.cameraYaw,site.key).toBe(wrap(site.orientation-.38+(id==='M14'&&district==='nura'?0:Math.PI)));
  }
  expect(projectPreviewFrame(placements['M14:nura']).cameraYaw).toBeCloseTo(-2.29353332683285,12);
  expect(projectPreviewFrame(placements['M1:esil']).cameraYaw).toBeUndefined();
 });
 it('does not focus an unsampled lighting furniture node',()=>{
  const original=placements['M10:esil'],undrawn=original.furniture[5];
  expect(lampPositions(original).some(point=>point[0]===undrawn.point[0]&&point[1]===undrawn.point[1])).toBe(false);
  const frame=projectPreviewFrame({...original,peopleSpots:[{position:[...undrawn.point,.00004],angle:undrawn.angle}]});
  expect(frame.center.slice(0,2)).not.toEqual(undrawn.point);
  expect(lampPositions(original).some(point=>point[0]===frame.center[0]&&point[1]===frame.center[1])).toBe(true);
 });
});
