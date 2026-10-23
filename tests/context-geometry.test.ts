import {describe,it,expect} from 'vitest';
// @ts-expect-error standalone independent browser evidence helper
import {projectContextVisibility} from '../scripts/cityrt/context-geometry.mjs';
const camera={x:0,y:0,yaw:0,pitch:0,zoom:1,width:390,height:640,perspective:0,rendererZoom:100/(640*.415),projectionScale:100,matrix:[1,0,0,0,1,0,0,0,1]};
const sheet={left:10,top:216,right:380,bottom:563};
const worldBox=(left:number,top:number,right:number,bottom:number)=>[0,0].flatMap(z=>[[left,top],[right,top],[right,bottom],[left,bottom]].map(([x,y])=>[(x!-195)/100,(320-y!)/100,z]));
const sample={camera,sheet,mobile:true,occlusions:[]};
describe('physical project context visibility without a label',()=>{
 it('recognizes a full school-sized volume above the phone sheet',()=>{
  const result=projectContextVisibility({...sample,physicalBounds:worldBox(140,140,248,195)});
  expect(result.visible).toBe(true);expect(result.fraction).toBeCloseTo(1,10);
 });
 it('rejects a tiny icon, a nearly covered building and a building under the HUD',()=>{
  for(const box of [[180,160,200,180],[140,190,248,280],[140,60,248,125]])expect(projectContextVisibility({...sample,physicalBounds:worldBox(...box as [number,number,number,number])}).visible).toBe(false);
 });
 it('subtracts other sheets instead of accepting their covered projected box',()=>{
  const result=projectContextVisibility({...sample,physicalBounds:worldBox(140,140,248,195),occlusions:[{left:155,top:130,right:248,bottom:210}]});
  expect(result.visible).toBe(false);expect(result.fraction).toBeLessThan(.25);
 });
 it('rejects volume behind the homogeneous perspective eye plane',()=>{
  const physicalBounds=worldBox(140,140,248,195).map(p=>[p[0],p[1],.2]);
  expect(projectContextVisibility({...sample,camera:{...camera,perspective:10},physicalBounds}).visible).toBe(false);
 });
});
