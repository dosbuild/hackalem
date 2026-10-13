import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import astana from '../src/world/astana-definition.js';
import {cameraFrame,occluded} from '../src/world/projection.js';
import {clamp} from '../src/world/city-math.js';
import {RESIDENT_HEIGHT} from '../src/world/resident-models.js';
import {placeProjectLabel,projectLabelVolume,projectLabelFootprint,projectLabelPhysicalLeader,createProjectLabelSizes} from '../src/world/label-layout.js';

// Actual V19 reduced M3 Esil native 12-use-resident camera and selected actor.
// Exercise the production overlay closure; no second camera or placement logic.
const nativePose={x:-.06259016386701513,y:-.47556251883251927,yaw:-.9338197626712781,pitch:1,zoom:288};
const position=[-.062389844436138146,-.47571072614484217,.00004],selectedId='story-esil-M3';
const source=readFileSync(new URL('../src/world/runtime-core.js',import.meta.url),'utf8');
const start=source.indexOf('\n function drawOverlay('),end=source.indexOf('\n function scenarioActors(',start);
if(start<0||end<0)throw Error('Missing production overlay boundary');
const production=source.slice(start,end);
function overlay({pose=nativePose,actorPosition=position,fallbackPosition=position,actor=true,selected=true,footprint,labelPlacement,projectedBody,occlusions}={}){
 const site=astana.projects.placements['M3:esil'],bounds=astana.projects.projectFocusBounds(site),mesh=astana.projects.projectMesh([site],false,{preview:true,zoom:288,seconds:4});
 let volumeCalls=0;
 const projectVolume=points=>projectedBody&&volumeCalls++===0?projectedBody:projectLabelVolume(points);
 const placeLabel=labelPlacement?()=>labelPlacement:placeProjectLabel;
 return new Function('astana','site','bounds','physical','pose','actorPosition','fallbackPosition','actor','selected','cameraFrame','occluded','clamp','RESIDENT_HEIGHT','placeProjectLabel','projectLabelVolume','projectLabelPhysicalLeader','createProjectLabelSizes','occlusions',`
  const width=1440,height=900,frame=cameraFrame(pose,width,height,91),current=pose,world={...astana,borders:false},projectNames=astana.projectNames;
  const rects=occlusions??[{left:24,right:404,top:185,bottom:809},{left:1142,right:1416,top:713,bottom:809},{left:1194,right:1416,top:826,bottom:894}],safeRects=()=>rects;
  const focusedSite=null;const props={focusedDistrict:'esil',comparisonPosition:0,selectedCommitment:'M3',occlusions:rects},scene=selected?{selectedId:'${selectedId}',anchor:{id:'scenario:M3:esil'}}:null;
  const actors=actor?[{resident:{id:'${selectedId}'},position:actorPosition,anchor:{id:'scenario:M3:esil'}}]:[],encounterPosition=()=>fallbackPosition;
  const element={dataset:{}},usedBoxes=[],hitTargets=[],districtLabels=[],districts=[],people=[],objects=[site],activities={},animation=null,choreography=null;
  const projectFocus=o=>world.projects.projectPreviewFrame?.(o)?.center||o.view?.center||o.origin;
  const b={dataset:{},style:{},classList:{toggle(){}},offsetWidth:165.4375,offsetHeight:28.796875},projectLabels=[{o:site,b,bounds}],labelFootprints={read:()=>physical},labelSizes=createProjectLabelSizes(new EventTarget());
  const strokes=[];let moving;const ctx={clearRect(){},beginPath(){},moveTo(x,y){moving={x,y};},lineTo(x,y){strokes.push([moving,{x,y}]);},stroke(){},setLineDash(){},fillRect(){}};
  const landmarkExplorer={draw(){}},bus={project(){},physical(){}},renderer={diagnostics:()=>({projectVertices:1,actorVertices:1})},reduced=()=>true,schoolStart=0,constructionNow=()=>0,isHeroSchool=()=>false;
  ${production}
  drawOverlay(0,0);labelSizes.destroy();return {b,usedBoxes,strokes,element,frame};
 `)(astana,site,bounds,footprint??projectLabelFootprint(new DataView(mesh),bounds),pose,actorPosition,fallbackPosition,actor,selected,cameraFrame,occluded,clamp,RESIDENT_HEIGHT,placeLabel,projectVolume,projectLabelPhysicalLeader,createProjectLabelSizes,occlusions);
}
const inside=(p,outline)=>{
 let direction=0;for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],d=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);if(d&&direction&&Math.sign(d)!==direction)return false;if(d)direction=Math.sign(d);}return true;
};
// Independent clipping of the protected convex hull against the label box.
function overlap(outline,box){
 let polygon=[...outline];
 for(const [axis,edge,direction]of [['x',box.left,1],['x',box.right,-1],['y',box.top,1],['y',box.bottom,-1]]){
  const next=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],aa=(a[axis]-edge)*direction>=0,bb=(b[axis]-edge)*direction>=0;if(aa)next.push(a);if(aa!==bb){const t=(edge-a[axis])/(b[axis]-a[axis]);next.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}polygon=next;
 }
 return Math.abs(polygon.reduce((sum,a,i)=>{const b=polygon[(i+1)%polygon.length];return sum+a.x*b.y-a.y*b.x;},0))>1e-6;
}
function leadersClear(actual,body){
 for(const [a,b]of actual.strokes){const count=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*4);for(let i=0;i<=count;i++){const t=count?i/count:0;expect(inside({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},body.outline)).toBe(false);}}
}
it('moves the real native M3 label away from the selected head and body in the same shared frame',()=>{
 const actual=overlay(),body=actual.usedBoxes[0],box=actual.usedBoxes.at(-1),feet=actual.frame.world(position),head=actual.frame.world([position[0],position[1],position[2]+RESIDENT_HEIGHT]);
 expect(feet.x).toBeCloseTo(720,6);expect(feet.y).toBeCloseTo(459.526,3);expect(head.y).toBeCloseTo(440.415,3);
 expect(inside(head,body.outline)).toBe(true);expect(inside(feet,body.outline)).toBe(true);
 expect(overlap(body.outline,{left:627.328125,right:792.765625,top:424.8359375,bottom:453.6328125})).toBe(true);
 expect(actual.b.hidden).toBe(false);expect(actual.b.dataset.frame).toBe('91');expect(actual.b.dataset.leaderFrame).toBe('91');
 expect(overlap(body.outline,box)).toBe(false);expect(actual.usedBoxes).toHaveLength(2);leadersClear(actual,body);
});
it('reserves the actual selected actor rather than the canonical encounter point and refreshes its hull with camera movement',()=>{
 for(const pose of [nativePose,{...nativePose,yaw:nativePose.yaw+.035},{...nativePose,x:nativePose.x+.000035,zoom:340}]){
  const moved=[position[0]+.00012,position[1]-.00006,position[2]],actual=overlay({pose,actorPosition:moved}),body=actual.usedBoxes[0],box=actual.usedBoxes.at(-1);
  expect(actual.element.dataset.residentPosition).toBe(JSON.stringify(moved));expect(inside(actual.frame.world(moved),body.outline)).toBe(true);expect(overlap(body.outline,box)).toBe(false);leadersClear(actual,body);
 }
 const fallback=overlay({actor:false});expect(fallback.element.dataset.residentPosition).toBe(JSON.stringify(position));expect(fallback.usedBoxes[0].outline.length).toBeGreaterThan(3);
 expect(overlay({selected:false}).usedBoxes).toHaveLength(1);
});
it('keeps the native nameplate clickable and omits its line when every actual attachment intersects the selected body',()=>{
 const actual=overlay({footprint:[position]}),body=actual.usedBoxes[0],box=actual.usedBoxes.at(-1);
 expect(actual.b.hidden).toBe(false);expect(overlap(body.outline,box)).toBe(false);
 expect(actual.b.dataset.leaderWorld).toBe('null');expect(actual.b.dataset.leaderX).toBe('');expect(actual.b.dataset.leaderY).toBe('');expect(actual.strokes).toEqual([]);
});
it('protects the actual canvas stroke in the center-safe but clamped-edge-blocked counterexample',()=>{
 const frame=cameraFrame(nativePose,1440,900),projectedBody=projectLabelVolume([{x:270,y:345},{x:290,y:345},{x:290,y:363},{x:270,y:363}]),labelPlacement={x:400,y:400,box:{left:317.5,right:482.5,top:386,bottom:414}};
 const blocked=frame.inverseWorld(100,200,0),clear=frame.inverseWorld(780,200,0),options={projectedBody,labelPlacement,occlusions:[]};
 const actual=overlay({...options,footprint:[blocked,clear]});
 expect(actual.strokes).toHaveLength(1);expect(actual.strokes[0][0].x).toBeCloseTo(780,7);expect(actual.strokes[0][0].y).toBeCloseTo(200,7);
 expect(actual.strokes[0][1]).toEqual({x:482.5,y:386});leadersClear(actual,projectedBody);
 const onlyBlocked=overlay({...options,footprint:[blocked]});expect(onlyBlocked.b.hidden).toBe(false);expect(onlyBlocked.strokes).toEqual([]);
});
