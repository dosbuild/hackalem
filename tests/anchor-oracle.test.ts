import {describe,it,expect} from 'vitest';
// The independent evidence harness intentionally remains native Node JavaScript.
// @ts-expect-error no declaration for standalone oracle
import {projectAnchor,auditAnchorFrames,authoredAnnotationFocuses,authoredProgramSites} from '../scripts/fullscreen/anchor-oracle.mjs';
import {readFileSync} from 'node:fs';
// @ts-expect-error existing geography declaration omits its runtime placements export
import {placements as historicalPlacements} from '../src/world/khanate/geography.js';

const camera={x:.1,y:-.2,yaw:0,pitch:0,zoom:2,width:1000,height:500,perspective:10,rendererZoom:200/(500*.415),projectionScale:200,frame:41,matrix:[1,0,0,0,1,0,0,0,1]};
const origin=[.11,-.18,.03],expected={x:500+.01*200/.7,y:250-.02*200/.7};
const options={placementsByMode:{astana:{'M7:nura':{origin}},khanate:{'M7:esil':{origin}}},annotationFocusesByMode:{astana:{'M7:nura':origin},khanate:{'M7:esil':origin}},minimumObservations:0,minimumZooms:0,requireBothLenses:false};
const fixture=(world='astana')=>({world,c:{...camera},r:{...camera},frame:41,renderFrame:40,annotationFrame:41,resident:{id:'person',anchor:'scenario:M7:nura',position:origin,actors:[{id:'person',position:origin}],x:expected.x,y:expected.y},objects:[{id:'M7',district:world==='astana'?'nura':'esil',origin,frame:41,x:Number(expected.x.toFixed(3)),y:Number(expected.y.toFixed(3))}]});

describe('independent evidence anchor oracle',()=>{
 it('intersects the analytically known homogeneous clip projection',()=>{
  const point=projectAnchor(origin,camera);
  expect(point.w).toBeCloseTo(.7,12);expect(point.x).toBeCloseTo(expected.x,10);expect(point.y).toBeCloseTo(expected.y,10);
  const orthographic=projectAnchor(origin,{...camera,perspective:0});
  expect(orthographic.x).toBeCloseTo(502,10);expect(orthographic.y).toBeCloseTo(246,10);
 });
 it('accepts rounded CSS diagnostics in either actual world without loosening the browser tolerance',()=>{
  for(const world of ['astana','khanate']){
   const report=auditAnchorFrames([fixture(world)],{...options,world});
   expect(report.anchorObservations).toBe(2);expect(report.maxErrorPixels).toBeLessThan(.00071);
  }
 });
 it('rejects the old orthographic assumption, stale frames, changed world origins and GPU lens disagreement',()=>{
  const orthographic=fixture();orthographic.c.perspective=0;orthographic.r.perspective=0;
  expect(()=>auditAnchorFrames([orthographic],options)).toThrow(/projection drift/);
  const stale=fixture();stale.objects[0]!.frame=40;expect(()=>auditAnchorFrames([stale],options)).toThrow(/frame drift/);
  const moved=fixture();moved.objects[0]!.origin=[.11,-.18,.04];expect(()=>auditAnchorFrames([moved],options)).toThrow(/canonical/);
  const lens=fixture();lens.r.perspective=0;expect(()=>auditAnchorFrames([lens],options)).toThrow(/lens parameters/);
 });
});

const canonical={astana:JSON.parse(readFileSync(new URL('../src/world/placements.json',import.meta.url),'utf8')).records,khanate:historicalPlacements};
const historicalViews=JSON.parse(readFileSync(new URL('../src/world/khanate/site-views.json',import.meta.url),'utf8'));
const authoredFocuses=authoredAnnotationFocuses(canonical,historicalViews);
const authoredPrograms={astana:JSON.parse(readFileSync(new URL('../src/world/astana-programs.json',import.meta.url),'utf8')).records,khanate:Object.fromEntries(JSON.parse(readFileSync(new URL('../src/world/khanate/program-sites.json',import.meta.url),'utf8')).programs.map((program:{key:string})=>[program.key,program]))};
// These are real V23 native003 observations. Keep the recorded camera and label
// coordinates independent of the expected-focus resolver under test.
const nativeCases=[
 {world:'astana',frame:550,id:'M4',district:'esil',x:1360.932,y:772.672,c:{x:-.09368656893529631,y:-.3201659518635895,yaw:-.06251486913301385,pitch:.781426679965293,zoom:162.5680239375275,width:1440,height:900,perspective:26.602040280686314,rendererZoom:141.02286413857806,projectionScale:52672.03975575891,matrix:[.9980465769767761,-.0443509966135025,.044000107795000076,.06247415766119957,.7085227370262146,-.7029171586036682,0,.7042929530143738,.7099094390869141]}},
 {world:'khanate',frame:370,id:'M4',district:'saryarka',x:427.448,y:21.39,c:{x:-.10363714416487362,y:.1055730004337745,yaw:-.24,pitch:1,zoom:280,width:1440,height:900,perspective:45.81818181818181,rendererZoom:242.89156626506025,projectionScale:90720,matrix:[.9713379740715027,-.1284312754869461,.20001986622810364,.2377026230096817,.5248161554336548,-.8173527121543884,0,.8414709568023682,.5403022766113281]}},
 {world:'astana',frame:1685,id:'M12',district:'nura',x:351001.577,y:-139803.065,c:{x:-.38215510259192537,y:-.14089655993941635,yaw:1.491540687909122,pitch:.82,zoom:232.00614751629752,width:1440,height:900,perspective:37.96464232084868,rendererZoom:201.25834483341472,projectionScale:75169.9917952804,matrix:[.07917269319295883,.6800796389579773,-.7288507223129272,-.996860921382904,.054013289511203766,-.05788678303360939,0,.7311458587646484,.6822212338447571]}},
 {world:'khanate',frame:2017,id:'M12',district:'baikonur',x:-1101474.285,y:-79779.922,c:{x:-.0965896006406315,y:.1018953358801527,yaw:-.24,pitch:.9726020571288339,zoom:233.2522599760728,width:1440,height:900,perspective:38.16855163244827,rendererZoom:202.33930985876194,projectionScale:75573.73223224758,matrix:[.9713379740715027,-.13386252522468567,.19642648100852966,.2377026230096817,.5470101833343506,-.8026688694953918,0,.8263538479804993,.5631512403488159]}}
];
const nativeSample=(entry:typeof nativeCases[number])=>({world:entry.world,c:entry.c,r:entry.c,frame:entry.frame,renderFrame:entry.frame,resident:null,objects:[{id:entry.id,district:entry.district,origin:canonical[entry.world as keyof typeof canonical][`${entry.id}:${entry.district}`].origin,frame:entry.frame,x:entry.x,y:entry.y}]});
const nativeOptions={placementsByMode:canonical,annotationFocusesByMode:authoredFocuses,minimumObservations:0,minimumZooms:0,requireBothLenses:false};

describe('authored close annotation focus semantics',()=>{
 it('resolves every saved parent and unique satellite, retaining source origins and school exceptions',()=>{
  const places=authoredProgramSites(canonical,authoredPrograms),focuses=authoredAnnotationFocuses(canonical,historicalViews,authoredPrograms);
  expect(Object.keys(places.astana)).toHaveLength(261);expect(Object.keys(places.khanate)).toHaveLength(275);
  for(const world of ['astana','khanate'] as const){
   expect(Object.keys(focuses[world]).sort()).toEqual(Object.keys(places[world]).sort());
   for(const [key,parent] of Object.entries(canonical[world]))expect(places[world][key].origin).toEqual((parent as {origin:number[]}).origin);
  }
  const clinic=places.astana['M8:nura:clinic-satellite-1'];expect(focuses.astana[clinic.key]).toEqual([clinic.origin[0],clinic.origin[1],clinic.origin[2]+.0004]);
  for(const child of authoredPrograms.khanate['M7:nura'].sites)expect(focuses.khanate[child.key]).toEqual(child.origin);
 });
 it('audits satellites by their own identity and rejects parent origins or a false initiative',()=>{
  const places=authoredProgramSites(canonical,authoredPrograms),focuses=authoredAnnotationFocuses(canonical,historicalViews,authoredPrograms),site=places.astana['M8:nura:clinic-satellite-1'];
  const c={...camera,zoom:24,x:site.origin[0],y:site.origin[1]},q=projectAnchor([site.origin[0],site.origin[1],site.origin[2]+.0004],c);
  const sample={world:'astana',c,r:c,frame:41,renderFrame:40,objects:[{id:site.id,district:site.district,site:site.key,child:true,origin:site.origin,frame:41,x:Number(q.x.toFixed(3)),y:Number(q.y.toFixed(3))}]},opts={...nativeOptions,placementsByMode:places,annotationFocusesByMode:focuses};
  expect(auditAnchorFrames([sample],opts).maxErrorPixels).toBeLessThan(.00071);
  expect(()=>auditAnchorFrames([{...sample,objects:[{...sample.objects[0],origin:canonical.astana['M8:nura'].origin}]}],opts)).toThrow(/canonical/);
  expect(()=>auditAnchorFrames([{...sample,objects:[{...sample.objects[0],id:'M7'}]}],opts)).toThrow(/initiative/);
 });
 it('retains real visible and horizon annotations in both worlds at the original tolerance',()=>{
  for(const entry of nativeCases){const result=auditAnchorFrames([nativeSample(entry)],{...nativeOptions,world:entry.world});expect(result.anchorObservations).toBe(1);expect(result.maxErrorPixels).toBeLessThan(.00071);}
 });
 it('rejects canonical-origin projection for those visible and horizon close annotations',()=>{
  for(const entry of nativeCases){const key=`${entry.id}:${entry.district}`,wrong={...authoredFocuses,[entry.world]:{...authoredFocuses[entry.world],[key]:canonical[entry.world as keyof typeof canonical][key].origin}};expect(()=>auditAnchorFrames([nativeSample(entry)],{...nativeOptions,annotationFocusesByMode:wrong})).toThrow(/projection drift/);}
 });
 it('uses the canonical origin at exactly 15 and the authored focus only above 15',()=>{
  const focus=[origin[0],origin[1],.031],key='M4:esil',opts={...options,placementsByMode:{astana:{[key]:{origin}}},annotationFocusesByMode:{astana:{[key]:focus}}};
  const make=(zoom:number,useFocus:boolean)=>{const c={...camera,zoom},w=useFocus?.69:.7;return {world:'astana',c,r:c,frame:41,renderFrame:40,resident:null,objects:[{id:'M4',district:'esil',origin,frame:41,x:500+.01*200/w,y:250-.02*200/w}]};};
  expect(auditAnchorFrames([make(15,false)],opts).maxErrorPixels).toBeLessThan(.000001);
  expect(auditAnchorFrames([make(15.00001,true)],opts).maxErrorPixels).toBeLessThan(.000001);
  expect(()=>auditAnchorFrames([make(15,true)],opts)).toThrow(/projection drift/);
  expect(()=>auditAnchorFrames([make(15.00001,false)],opts)).toThrow(/projection drift/);
 });
 it('keeps the hero school and every historical school anchored to their canonical origins',()=>{
  expect(authoredFocuses.astana['M7:nura']).toEqual(canonical.astana['M7:nura'].origin);
  for(const district of ['esil','almaty','saryarka','baikonur','nura'])expect(authoredFocuses.khanate[`M7:${district}`]).toEqual(canonical.khanate[`M7:${district}`].origin);
  expect(authoredFocuses.astana['M7:esil']).toEqual([...canonical.astana['M7:esil'].origin.slice(0,2),canonical.astana['M7:esil'].origin[2]+.0005]);
  expect(Object.keys(authoredFocuses.astana)).toHaveLength(70);expect(Object.keys(authoredFocuses.khanate)).toHaveLength(70);
 });
 it('fails on missing focus maps, missing placements and changed focus data',()=>{
  const entry=nativeCases[0]!,sample=nativeSample(entry),key='M4:esil';
  expect(()=>auditAnchorFrames([sample],{...nativeOptions,annotationFocusesByMode:{}})).toThrow(/focus map/);
  expect(()=>auditAnchorFrames([sample],{...nativeOptions,annotationFocusesByMode:{astana:{}}})).toThrow(/Missing authored annotation focus/);
  expect(()=>auditAnchorFrames([sample],{...nativeOptions,placementsByMode:{astana:{}}})).toThrow(/Missing placement/);
  const wrong={...authoredFocuses,astana:{...authoredFocuses.astana,[key]:[...authoredFocuses.astana[key].slice(0,2),.0008]}};
  expect(()=>auditAnchorFrames([sample],{...nativeOptions,annotationFocusesByMode:wrong})).toThrow(/projection drift/);
 });
 it('rejects altered historical centers that disagree with their authored bounds',()=>{
  const views=structuredClone(historicalViews);views['M4:saryarka'].center[2]+=.0001;
  expect(()=>authoredAnnotationFocuses(canonical,views)).toThrow(/center disagrees/);
 });
});
