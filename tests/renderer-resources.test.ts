import {describe,it,expect} from 'vitest';
// @ts-expect-error The production WebGL renderer is an untyped JavaScript module.
import {createRenderer} from '../src/world/city-gl.js';
import {indexTriangleVertices} from '../src/world/mesh-index.js';
// @ts-expect-error Native JavaScript facade authoring module.
import {makeArchitecturePart} from '../src/world/architecture-models.js';
import {visibleBounds} from '../src/world/render-policy.js';

function device({failShader=0,failLink=0}:{failShader?:number;failLink?:number}={}){
 const live=new Map<string,Set<object>>(),uploads:{buffer:object;bytes:number}[]=[],attributes:{buffer:object;location:number;offset:number}[]=[],draws:{program:object;buffer:object;offset:number;culling:boolean;indexed:boolean}[]=[];
 let bound:object,activeProgram:object,placementOffset=0,enumValue=1,shaders=0,programs=0,culling=false;
 const create=(kind:string)=>{const value={kind,index:kind==='Shader'?++shaders:kind==='Program'?++programs:0};if(!live.has(kind))live.set(kind,new Set());live.get(kind)!.add(value);return value;};
 const remove=(kind:string,value:object)=>{expect(live.get(kind)?.delete(value)).toBe(true);};
 const api:Record<string,any>={NO_ERROR:0,getError:()=>0,isContextLost:()=>false,getShaderParameter:(s:{index:number})=>s.index!==failShader,getShaderInfoLog:()=> 'compile failed',getProgramParameter:(p:{index:number})=>p.index!==failLink,getProgramInfoLog:()=> 'link failed',getExtension:()=>null,
  bindBuffer:(_target:number,buffer:object)=>{bound=buffer;},bufferData:(_target:number,data:ArrayBufferView)=>uploads.push({buffer:bound,bytes:data.byteLength}),
  useProgram:(program:object)=>{activeProgram=program;},
  enable:(flag:number)=>{if(flag===gl.CULL_FACE)culling=true;},disable:(flag:number)=>{if(flag===gl.CULL_FACE)culling=false;},
  vertexAttribPointer:(location:number,_size:number,_type:number,_normalized:boolean,_stride:number,offset:number)=>{attributes.push({buffer:bound,location,offset});if(location===5)placementOffset=offset;},
  drawArraysInstanced:()=>draws.push({program:activeProgram,buffer:bound,offset:placementOffset,culling,indexed:false}),
  drawElementsInstanced:()=>draws.push({program:activeProgram,buffer:bound,offset:placementOffset,culling,indexed:true}),
  checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE};
 for(const kind of ['Buffer','VertexArray','Texture','Framebuffer','Program','Shader']){api['create'+kind]=()=>create(kind);api['delete'+kind]=(v:object)=>remove(kind,v);}
 const gl=new Proxy(api,{get(target,key:string){if(key in target)return target[key];return target[key]=/^[A-Z_0-9]+$/.test(key)?enumValue++:()=>{};}});
 return {gl,live,uploads,attributes,draws,canvas:{getContext:()=>gl},allocated:()=>Array.from(live.values()).reduce((n,s)=>n+s.size,0)};
}
const metadata={tiles:[],buildingFeatures:0,groundCount:3,environment:{}};
describe('world GPU ownership',()=>{
 it('releases every program and partial shader if any world or ink initialization pass fails',()=>{
  for(let failShader=1;failShader<=10;failShader++){const d=device({failShader});expect(()=>createRenderer(d.canvas,new ArrayBuffer(60),metadata)).toThrow('compile failed');expect(d.allocated()).toBe(0);}
  for(let failLink=1;failLink<=5;failLink++){const d=device({failLink});expect(()=>createRenderer(d.canvas,new ArrayBuffer(60),metadata)).toThrow('link failed');expect(d.allocated()).toBe(0);}
 });
 it('refreshes residency after installation and counts changing dynamic buffers without retaining empty allocations',()=>{
  const d=device(),renderer=createRenderer(d.canvas,new ArrayBuffer(60),metadata),part=new ArrayBuffer(60),packed=new Float32Array(16);
  expect(renderer.diagnostics()).toMatchObject({gpuBufferBytes:60,gpuBuffers:1,instanceCount:0});
  renderer.addInstances('first',part,packed.subarray(0,8),[-1,-1,0,0,0,1],0,{templateKey:'window'});
  expect(renderer.diagnostics()).toMatchObject({gpuBufferBytes:184,gpuBuffers:3,instanceCount:1});
  renderer.addInstances('second',part,packed.subarray(8),[0,0,1,1,0,1],0,{templateKey:'window'});
  expect(renderer.diagnostics()).toMatchObject({gpuBufferBytes:184,gpuBuffers:3,instanceCount:2});
  renderer.replaceProjects(new ArrayBuffer(60));renderer.replaceActors(new ArrayBuffer(120));
  expect(renderer.diagnostics()).toMatchObject({gpuBufferBytes:364,gpuBuffers:5,projectVertices:3,actorVertices:6});
  renderer.replaceProjects(new ArrayBuffer(120));renderer.replaceActors(new ArrayBuffer(0));
  expect(renderer.diagnostics()).toMatchObject({gpuBufferBytes:304,gpuBuffers:4,projectVertices:6,actorVertices:0});
  renderer.replaceProjects(new ArrayBuffer(0));
  expect(renderer.diagnostics()).toMatchObject({gpuBufferBytes:184,gpuBuffers:3});
  renderer.destroy();expect(d.allocated()).toBe(0);
 });
 it('shares a packed placement asset while retaining each batch range and releases every resource',()=>{
  const d=device(),renderer=createRenderer(d.canvas,new ArrayBuffer(60),metadata),part=new ArrayBuffer(60),packed=new Float32Array(24);
  renderer.addInstances('front',part,packed.subarray(0,8),[-1,-1,0,0,0,1],0,{templateKey:'window'});
  renderer.addInstances('back',part,packed.subarray(8,24),[0,0,1,1,0,1],0,{templateKey:'window'});
  expect(d.uploads.map(u=>u.bytes)).toEqual([60,60,96]);
  expect(renderer.diagnostics()).toMatchObject({gpuBufferBytes:216,gpuBuffers:3,instanceCount:3,gpuTemplates:1,gpuPlacementBuffers:1});
  expect(renderer.diagnostics().gpuVertexArrays).toBe(2);
  renderer.draw({rotation:[1,0,0,0,1,0,0,0,1],zoom:1,center:[0,0,0],time:.16,tick:0,width:256,height:256});
  expect(new Set(d.attributes.filter(a=>a.location===5||a.location===6).map(a=>a.offset))).toEqual(new Set([0,16,32,48]));
  expect(new Set(d.attributes.filter(a=>a.location===5).map(a=>a.buffer)).size).toBe(1);
  renderer.destroy();expect(d.allocated()).toBe(0);
 });
 it('keeps permanent program geometry resident while activity changes, and releases it on removal',()=>{
  const d=device(),renderer=createRenderer(d.canvas,new ArrayBuffer(60),metadata);
  renderer.replacePrograms(new ArrayBuffer(180));const permanent=d.uploads.at(-1)!.buffer;
  for(let i=0;i<8;i++)renderer.replaceActors(new ArrayBuffer(60+i*60));
  expect(d.uploads.filter(u=>u.buffer===permanent)).toHaveLength(1);
  expect(renderer.diagnostics()).toMatchObject({programVertices:9,projectVertices:9,gpuBuffers:3});
  renderer.replacePrograms(new ArrayBuffer(0));expect(renderer.diagnostics()).toMatchObject({programVertices:0,projectVertices:0,gpuBuffers:2});
  renderer.destroy();expect(d.allocated()).toBe(0);
 });
 it('repeated world creation cannot retain shared templates, placement buffers or ink targets',()=>{
  const d=device(),part=new ArrayBuffer(60),packed=new Float32Array(16);
  for(let i=0;i<12;i++){
   const r=createRenderer(d.canvas,new ArrayBuffer(60),metadata);
   r.addInstances('a',part,packed.subarray(0,8),[-1,-1,0,0,0,1]);r.addInstances('b',part,packed.subarray(8),[0,0,1,1,0,1]);
   r.prepared();r.destroy();expect(d.allocated()).toBe(0);
  }
 });
 it('shares one exact index buffer per facade template, keeps instance ranges and releases it with the final reference',()=>{
  const d=device(),renderer=createRenderer(d.canvas,new ArrayBuffer(60),metadata),part=makeArchitecturePart('garden-home','window',2),indexed=indexTriangleVertices(part)!,packed=new Float32Array(16),bounds=[-.002,-.002,.002,.002,0,.002];
  for(const [id,range]of [['first',packed.subarray(0,8)],['second',packed.subarray(8)]] as const)renderer.addInstances(id,part,range,bounds,0,{templateKey:'facade',detailHeight:.001,fadePixels:[.8,2.2]});
  expect(d.uploads.map(u=>u.bytes)).toEqual([60,indexed.vertexBytes,indexed.data.byteLength-indexed.vertexBytes,packed.byteLength]);
  expect(renderer.diagnostics()).toMatchObject({gpuBufferBytes:60+indexed.data.byteLength+packed.byteLength,gpuBuffers:4,gpuTemplates:1,gpuPlacementBuffers:1,instanceCount:2});
  const main=Array.from(d.live.get('Program')!)[0],k=Math.SQRT1_2;
  renderer.draw({rotation:[1,0,0,0,k,-k,0,k,k],zoom:100,center:[0,0,0],time:.16,tick:0,width:256,height:256});
  expect(d.draws.filter(call=>call.program===main).map(({offset,indexed,culling})=>({offset,indexed,culling}))).toEqual([{offset:0,indexed:true,culling:true},{offset:32,indexed:true,culling:true}]);
  expect(renderer.diagnostics().visibleCityVertices).toBe(3+2*part.byteLength/20);
  renderer.destroy();expect(d.allocated()).toBe(0);
 });
 it('keeps sparse cell children in installation order, culls each child, and includes later additions',()=>{
  const d=device(),renderer=createRenderer(d.canvas,new ArrayBuffer(60),metadata),part=new ArrayBuffer(60),packed=new Float32Array(8*101);
  const near=[-.002,-.002,.002,.002,0,.002],far=[5,5,5.01,5.01,0,.002];
  const add=(i:number,cell:string,bounds:number[],detailHeight=0,buildings=0)=>renderer.addInstances(`architecture/family/part/${i}/${cell}`,part,packed.subarray(i*8,(i+1)*8),bounds,buildings,{templateKey:'window',detailHeight,fadePixels:[.8,2.2]});
  add(0,'0/0',near,0,1);
  add(1,'1/1',far);
  add(2,'2/2',near,0,2);
  // This far child shares the first admitted cell. Its union is conservative;
  // the exact child check must still reject it rather than drawing the cell.
  add(3,'0/0',far);
  add(4,'0/0',near,.001);
  for(let i=5;i<100;i++)add(i,`${i}/${i}`,far);
  const main=Array.from(d.live.get('Program')!)[0],depth=Array.from(d.live.get('Program')!)[1];
  const k=Math.SQRT1_2;
  const draw=(zoom:number)=>{d.draws.length=0;renderer.draw({rotation:[1,0,0,0,k,-k,0,k,k],zoom,center:[0,0,0],time:.16,tick:0,width:256,height:256});return d.draws.filter(call=>call.program===main).map(call=>call.offset);};
  expect(draw(100)).toEqual([0,64,128]);
  expect(d.draws.filter(call=>call.program===main).map(({offset,culling})=>({offset,culling}))).toEqual([{offset:0,culling:false},{offset:64,culling:false},{offset:128,culling:true}]);
  expect(d.draws.filter(call=>call.program===depth).some(call=>call.offset===0)).toBe(true);
  expect(d.draws.filter(call=>call.program===depth).some(call=>call.offset===128)).toBe(false);
  expect(renderer.diagnostics()).toMatchObject({baseDrawCalls:4,visibleCityVertices:12,renderedBuildings:3,instanceBatches:100,gpuTemplates:1,gpuPlacementBuffers:1});
  add(100,'2/2',near,0,4);
  expect(draw(100)).toEqual([0,64,128,3200]);
  // Closed facade boxes cull their hidden faces; the following ordinary body
  // must immediately regain the original two-sided rendering policy.
  expect(d.draws.filter(call=>call.program===main).map(({offset,culling})=>({offset,culling}))).toEqual([{offset:0,culling:false},{offset:64,culling:false},{offset:128,culling:true},{offset:3200,culling:false}]);
  expect(renderer.diagnostics()).toMatchObject({baseDrawCalls:5,visibleCityVertices:15,renderedBuildings:7,instanceBatches:101,gpuTemplates:1,gpuPlacementBuffers:1});
  // An overview admits the whole cell set and returns to the full scan. Tiny
  // façade details still follow their existing pixel visibility threshold.
  expect(draw(.01)).toEqual(Array.from({length:101},(_,i)=>i).filter(i=>i!==4).map(i=>i*32));
  expect(d.uploads.map(u=>u.bytes)).toEqual([60,60,packed.byteLength]);
  renderer.destroy();expect(d.allocated()).toBe(0);
 });
 it('conservative region rejection matches every exact mesh test across view changes and growing cells',()=>{
  const d=device(),renderer=createRenderer(d.canvas,new ArrayBuffer(60),metadata),part=new ArrayBuffer(60),packed=new Float32Array(8*201),bounds:number[][]=[];
  const add=(i:number,cell:string,b:number[])=>{bounds.push(b);renderer.addInstances(`architecture/family/body/${i}/${cell}`,part,packed.subarray(i*8,(i+1)*8),b,0,{templateKey:'body'});};
  for(let i=0;i<200;i++){const x=(i%20)*.17-1.6,y=Math.floor(i/20)*.17-.8;add(i,`${i%20}/${Math.floor(i/20)}`,[x-.015,y-.015,x+.015,y+.015,.00003,.001+(i%9)*.015]);}
  // A later part can expand a cell far beyond the region where it began.
  add(200,'0/0',[1.88,-.012,1.90,.012,0,.015]);
  const main=Array.from(d.live.get('Program')!)[0],k=Math.SQRT1_2,rotation=[1,0,0,0,k,-k,0,k,k];
  const views:[number,number,number,number][]=[[.3,0,0,0],[30,0,0,0],[30,1.89,0,0],[12,-1.3,.45,.6],[4,0,0,.9],[30,0,0,0]];
  for(const [zoom,x,y,perspective]of views){
   d.draws.length=0;const center=[x,y,0],view={rotation,zoom,center,perspective,aspect:1};
   renderer.draw({...view,time:.16,tick:0,width:256,height:256});
   const expected=bounds.flatMap((b,i)=>visibleBounds(b,view)?[i*32]:[]);
   expect(d.draws.filter(call=>call.program===main).map(call=>call.offset)).toEqual(expected);
  }
  renderer.destroy();expect(d.allocated()).toBe(0);
 });
});
