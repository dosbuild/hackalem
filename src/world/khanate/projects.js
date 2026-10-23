import {Mesh,beat,blend} from '../mesh-kit.js';
import {routeAt} from '../placement-geometry.js';
import {PALETTE} from '../../design/palette.js';
import {placements,quarters} from './geography.js';
import {paths,smoothPath,householdCourts,courtCenter} from './settlement.js';
import {yurt,well,steppeTree,lantern,cart} from './models.js';
import {residentModel,RESIDENT_HEIGHT} from '../resident-models.js';
import {OBJECT_UNIT,localPoint,meshBounds} from './scale.js';
import {PROPOSAL_TINT,groundPreparation,preparationStrength} from '../construction-preparation.js';
import {projectPresentation} from '../project-presentation.js';
import {programFor,programSites,programBounds,auditKhanatePrograms} from './programs.js';
import {programArchitecture,programWitnesses,joinProgramMeshes,programVisibilityBand} from './program-models.js';
export const projectStaticCacheKey=options=>programVisibilityBand(options.zoom);
export {placements};
export {programSites,programBounds,auditKhanatePrograms};
export const projectFocusBounds=site=>{const view=site.view?.focus??site.view;return view?[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[x<0?view.min[0]:view.max[0],y<0?view.min[1]:view.max[1],z<0?view.min[2]:view.max[2]]))):undefined;};
export const projectPreviewFrame=site=>site.view?.focus;
export function crossingFamilyView(site){
 const {min,max}=meshBounds(projectMesh([{...site,proposal:false}],false,{seconds:4,crossingPlaceOnly:true}));
 // The existing west guides and path share their close view with the three
 // existing family positions. The other bank stays in the full model/view.
 for(const spot of site.peopleSpots.slice(0,3)){
  for(const axis of [0,1]){min[axis]=Math.min(min[axis],spot.position[axis]-RESIDENT_HEIGHT*.5);max[axis]=Math.max(max[axis],spot.position[axis]+RESIDENT_HEIGHT*.5);}
  min[2]=Math.min(min[2],spot.position[2]);max[2]=Math.max(max[2],spot.position[2]+RESIDENT_HEIGHT*1.25);
 }
 return {min,max,extent:max.map((value,i)=>value-min[i]),center:min.map((value,i)=>(value+max[i])/2)};
}
function nearestApproach(point,routes){let closest={point,distance:Infinity};for(const route of routes)for(let i=1;i<route.length;i++){
 const a=route[i-1],b=route[i],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0,q=[a[0]+t*dx,a[1]+t*dy],distance=Math.hypot(q[0]-point[0],q[1]-point[1]);
 if(distance<closest.distance)closest={point:q,distance};
}return closest;}
// These are the same court approaches already baked by khanate/prepare.mjs.
// The new keeper spur joins their actual centreline, rather than a display road.
const tradePaths=paths.map(path=>smoothPath(path)),settlementApproaches=[...tradePaths,...quarters.flatMap(q=>householdCourts[q.id].map((court,index)=>{
 const center=courtCenter(q,court,index),join=nearestApproach(center,tradePaths).point;
 return smoothPath([center,[(center[0]+join[0])*.5+.00025,(center[1]+join[1])*.5],join]);
}))];
function approachFor(site){const q=nearestApproach(site.origin,settlementApproaches).point,c=Math.cos(site.orientation),s=Math.sin(site.orientation),dx=(q[0]-site.origin[0])/OBJECT_UNIT,dy=(q[1]-site.origin[1])/OBJECT_UNIT,join=[dx*c+dy*s,-dx*s+dy*c],side=join[1]<0?-1:1;
 // Two authored bends clear the existing yurt-2-saryarka:12 and
 // yurt-1-baikonur:6 footprints. Homes and their approaches stay in place.
 const bend=site.key==='M2:saryarka'?[22,-214]:site.key==='M2:baikonur'?[212,-40]:[join[0]*.5,(join[1]+side*34)*.5];
 return {join,side,route:[[0,side*34],bend,join]};}
const crossingApproaches=Object.fromEntries(Object.values(placements).filter(site=>site.id==='M2').map(site=>[site.key,approachFor(site)]));
export const crossingApproach=site=>crossingApproaches[site.key]??approachFor(site);
/** An open trade route returns along the same road, turning while standing. */
export function cartRoutePose(route,seconds){const f=((seconds/720+.16)%1+1)%1,progress=f<.44?f/.44:f<.52?1:f<.96?1-(f-.52)/.44:0,q=routeAt(route,progress),turn=f<.44?0:f<.52?Math.PI*beat(f,.44,.52):f<.96?Math.PI:Math.PI+Math.PI*beat(f,.96,1);return {...q,angle:q.angle-Math.PI/2+turn};}
export const footprintKinds={M1:'stop',M2:'crossing',M3:'stop',M4:'garden',M5:'entrance',M6:'garden',M7:'school',M8:'clinic',M9:'garden',M10:'crossing',M11:'crossing',M12:'service',M13:'service',M14:'service'};
export function projectObjects(props,districts){const out=[],future=!!props.result&&props.comparisonPosition>=.5;
 const add=(decision,proposal,slot)=>{for(const d of districts.filter(d=>decision.scope==='citywide'||d.id===decision.districtId)){const site=placements[`${decision.initiativeId}:${d.id}`];if(site){const program=programFor(site),presentation=projectPresentation(props,decision.initiativeId,d.id,proposal),representative=['M1','M2','M3','M5','M6','M10','M11'].includes(site.id)?program.sites[1].view:site.id==='M4'?program.sites[0].view:site.view?.focus??site.view;
  out.push({...site,program,view:{...program.bounds,focus:representative,zoom:representative.zoom??site.view?.zoom??240},...presentation,slot,proposal,citywide:decision.scope==='citywide',revision:props.scenarioRevision??0,state:proposal?'preview':future?'outcome':'planned',progress:proposal?props.budgetPreview?.progress??0:1,blocked:!!(proposal&&props.budgetPreview?.blocked)});
 }}};
 props.commitments.forEach((d,i)=>add(d,false,i+1));if(props.candidate&&!props.commitments.some(d=>d.initiativeId===props.candidate.decision.initiativeId&&d.districtId===props.candidate.decision.districtId))add(props.candidate.decision,true,0);return out;
}
const timber='#92775a',dark='#695743';
function shade(m,x,y,p){for(const dx of [-9,9])for(const dy of [-6,6])m.box(x+dx,y+dy,0,.4,.4,10*p,timber);m.quad([x-10,y-7,10*p],[x+10,y-7,10*p],[x+10,y+7,11*p],[x-10,y+7,11*p],PALETTE.felt);}
function bench(m,x,y,p){m.box(x,y,1.8*p,7,2,.4,timber);for(const dx of [-2.3,2.3])m.box(x+dx,y,0,.45,1.8,1.8*p,dark);}
function hearth(m,p){m.cylinder(0,0,0,2.4,2.4*p,'#b98c6c',14,1.6);m.box(0,1.5,0,1.4,1.4,11*p,'#aa8266');m.cylinder(0,0,2.4*p,1.2,.12,'#695949',14);}
function cookingHearth(m,p){
 if(p<=0)return;
 const clay='#b98c6c',mouth='#48392d',rim='#d0a582',floor=.20*p;
 // Keep the original fourteen-sided footprint, with a real opening through
 // its front shell. The inner wall sits behind the arch rather than on it.
 const skin=(step,z)=>{const i=Math.floor(step),t=step-i,a=i/14*Math.PI*2,b=(i+1)/14*Math.PI*2,r=2.4-.8*z/(2.4*p);return [(Math.cos(a)*(1-t)+Math.cos(b)*t)*r,(Math.sin(a)*(1-t)+Math.sin(b)*t)*r,z];};
 const arch=[[9.35,.50],[9.7,1.05],[10,1.38],[10.5,1.52],[11,1.38],[11.3,1.05],[11.65,.50]],height=step=>{
  const i=arch.findIndex(q=>q[0]>=step);if(i===0)return arch[0][1]*p;
  const a=arch[i-1],b=arch[i],t=(step-a[0])/(b[0]-a[0]);return (a[1]*(1-t)+b[1]*t)*p;
 },inner=q=>[q[0]*.85,-.9,q[2]],front=q=>[q[0]*1.015,q[1]*1.015,q[2]];
 for(let i=0;i<14;i++){
  const steps=[i,...arch.filter(q=>q[0]>i&&q[0]<i+1).map(q=>q[0]),i+1];
  for(let j=1;j<steps.length;j++){
   const a=steps[j-1],b=steps[j],A=skin(a,0),B=skin(b,0),C=skin(b,2.4*p),D=skin(a,2.4*p);
   if(a>=arch[0][0]&&b<=arch.at(-1)[0]){
    const lo=skin(a,floor),ro=skin(b,floor),hi=skin(a,height(a)),rh=skin(b,height(b));
    m.quad(A,B,ro,lo,clay);m.quad(hi,rh,C,D,clay);
    m.quad(inner(lo),inner(ro),inner(rh),inner(hi),mouth);
    m.quad(lo,ro,inner(ro),inner(lo),'#84745e');m.quad(hi,inner(hi),inner(rh),rh,'#a07a5c');
    m.quad(front(hi),front(rh),skin(b,height(b)+.18*p),skin(a,height(a)+.18*p),rim);
   }else m.quad(A,B,C,D,clay);
  }
  m.tri([0,0,2.4*p],skin(i,2.4*p),skin(i+1,2.4*p),clay);
 }
 for(const [step,z] of [arch[0],arch.at(-1)]){
  const lo=skin(step,floor),hi=skin(step,z*p);
  if(step===arch[0][0])m.quad(lo,inner(lo),inner(hi),hi,'#a07a5c');else m.quad(hi,inner(hi),inner(lo),lo,'#a07a5c');
  m.beam(front(lo),front(hi),.10*p,rim,6);
 }
 m.box(0,-1.93,.10*p,2.4,.4,.10*p,'#a1937b');
 m.box(0,1.5,0,1.4,1.4,7.1*p,'#aa8266');m.box(0,1.5,7.1*p,1.4,1.4,.03*p,mouth);
 for(const x of [-.55,.55])for(const y of [.95,2.05])m.box(x,y,7.13*p,.13,.13,.32*p,'#aa8266');
 m.box(0,1.5,7.45*p,1.9,1.4,.18*p,'#b59a7c');
 m.cylinder(0,0,2.4*p,1.2,.12*p,'#695949',14);
 m.ellipsoid(0,0,3.1*p,.9,.9,.65*p,'#666057',12,6);
 m.cylinder(0,0,3.74*p,.88,.10*p,'#928570',12,.73);m.cylinder(0,0,3.84*p,.18,.22*p,'#695949',8);
 for(const side of [-1,1])m.beam([side*.85,0,3.1*p],[side*1.25,0,3.1*p],.10*p,'#666057',6);
}
function hearthWorkTable(m,p){
 if(p<=0)return;
 for(const x of [-3,3])for(const y of [-1.3,1.3])m.box(x,y,0,.35,.35,2.2*p,dark);
 m.box(0,0,2.2*p,8,4,.3*p,timber);m.box(-1.5,0,2.5*p,2.8,2.4,.04*p,PALETTE.felt);
 for(let i=0;i<3;i++)m.ellipsoid(-1.5,0,(2.64+i*.18)*p,.82,.62,.10*p,'#d4bb88',10,4);
 m.ellipsoid(2.1,.4,3*p,.6,.55,.5*p,'#b38d69',10,5);m.cylinder(2.1,.4,3.48*p,.29,.03*p,'#48392d',10);
 m.beam([.5,-.7,2.57*p],[3,-.7,2.57*p],.055*p,timber,5);
}
const child={id:'khanate-pupil',signature:false,visual:{era:'khanate',coat:PALETTE.indigo,accent:PALETTE.brass,skin:'#d0a17b',hair:'#3b322c',cut:'long',head:'cap',build:'small',mobility:'walk',prop:'book'}};
// This ambient cast explains use of the physical court; it never enters the
// resident registry, contribution journal or numerical scenario.
const teacher={id:'khanate-teaching-court-keeper',signature:false,visual:{...child.visual,coat:PALETTE.clay,accent:PALETTE.textile,skin:'#bd916e',head:'bun',build:'regular'}};
export function legacyProjectMesh(objects,_future=false,shared={}){
 const m=new Mesh(),seconds=shared.seconds??0;
 for(const o of objects){const labelStart=m.bytes;try {const active=shared.activities?.[o.id]??shared.active,progress=o.proposal?0:active?.id===o.id?active.progress:1;
  const p=o.proposal?1:Math.max(0,Math.min(1,progress)),scale=OBJECT_UNIT;
  if(active?.id===o.id&&!o.proposal){
   const points=projectFocusBounds(o),center=points?[0,1,2].map(axis=>(Math.min(...points.map(p=>p[axis]))+Math.max(...points.map(p=>p[axis])))/2):o.origin;
   const q=o.route&&['M1','M3'].includes(o.id)?routeAt(o.route,.52):null,bridge=o.id==='M11';
   const frame=q?{center:q.point,span:[.0014,.0011],orientation:q.angle}:bridge?{center:[o.origin[0]-.007,o.origin[1]],span:[.0014,.0007],orientation:0}:{center,span:o.view?.focus?.extent||o.view?.extent||o.size,orientation:o.orientation};
   const foundationAt=['M1','M3'].includes(o.id)?.44:o.id==='M4'?.05:['M5','M6'].includes(o.id)?.1:o.id==='M7'?.02:o.id==='M8'?.06:o.id==='M10'?.2:['M12','M14'].includes(o.id)?.02:0;
   groundPreparation(m,o,frame,preparationStrength(p,foundationAt));
  }
  m.at(o.origin,o.orientation,scale);m.kind=8;m.tint=c=>o.proposal?blend(c,PALETTE.paper,PROPOSAL_TINT):blend(c,c,0);
  const at=(x=0,y=0,angle=o.orientation,factor=1)=>m.at(localPoint(o.origin,o.orientation,x,y),angle,scale*factor);
  if(p<=0)continue;
  switch(o.id){
   case 'M1':case 'M3':{
    m.at([0,0,0]);m.kind=4;m.ribbon(o.route,o.id==='M3'?.00074:.00053,PALETTE.clay,beat(p,0,.70),.00009);m.kind=8;
    for(const [i,t] of [.16,.52,.84].entries()){const q=routeAt(o.route,t),v=beat(p,.34+i*.1,.70+i*.1);m.at([...q.point,.00006],q.angle,scale);if(o.id==='M3')yurt(m,{variant:i,progress:v});else{m.box(0,4,0,.45,.45,7*v,timber);m.box(0,4,6*v,6,.4,.8,PALETTE.textile);}}
    if(!o.proposal&&!shared.staticOnly&&p>.8){const q=cartRoutePose(o.route,seconds);m.at([...q.point,.00006],q.angle,scale);cart(m);}break;
   }
   case 'M2':{
    at();m.kind=4;
    const approach=beat(p,.03,.36),connection=crossingApproach(o);
    // Two trodden approaches and low rope guides make the waiting order
    // readable beside the shaded crossing keeper, without closing the steppe.
    for(const x of [-5,5])m.ribbon([[x,-32],[x,-7],[x,8],[x,32]],6,'#cfc09d',approach,.035);
    m.ribbon([[-5,connection.side*32],[0,connection.side*34],[5,connection.side*32]],6,'#cfc09d',approach,.035);
    // Only the measured primary-place pass omits this ground context. The
    // shipped mesh and its full bounds always include the real connection.
    if(!shared.crossingPlaceOnly)m.ribbon(connection.route,3.6,'#cfc09d',approach,.035);
    m.kind=8;
    const guides=beat(p,.62,1);
    for(const x of [-10,10]){
     for(const y of [-26,-14,-7,-1,14,26])m.box(x,y,0,.32,.32,2.8*guides,timber);
     for(const [a,b]of [[-26,-14],[-14,-7],[-7,-1],[14,26]])m.beam([x,a,2.2*guides],[x,b,2.2*guides],.10,PALETTE.felt,5);
    }
    for(const [i,x]of [-17,17].entries()){
     at(x);m.box(0,0,0,.6,.6,13*p,timber);m.box(0,0,10*p,7,1,3,PALETTE.indigo);
     for(const xx of [-3.55,3.55])m.box(xx,0,10*p,.18,1.12,3,timber);
     for(const z of [10*p,10*p+3])m.box(0,0,z,7.3,1.12,.18,timber);
     if(guides>.8)for(const side of [-1,1]){
      // Painted arrows and tally strokes are visible on both board faces.
      const direction=i?1:-1,y=side*.515;
      m.box(-direction*.45,y,10*p+1.75,2.7,.025,.16,PALETTE.felt);
      m.tri([direction*1.8,y,10*p+1.75],[direction*.6,y,10*p+2.35],[direction*.6,y,10*p+1.15],PALETTE.brass);
      for(const xx of [-1.5,-.5,.5])m.box(xx,y,10*p+.6,.13,.025,.45,PALETTE.felt);
     }
    }
    at();shade(m,0,0,beat(p,.25,.8));
    // The existing loaded cart waits clear of the keeper and the resident
    // spots. Its small queue movement uses the world's shared visual clock.
    if(!o.proposal&&!shared.staticOnly&&p>.98){at(5,connection.side*(23+Math.sin(seconds*Math.PI/45)),o.orientation+(connection.side<0?Math.PI:0));cart(m);}
    break;
   }
   case 'M4':
    well(m,beat(p,.05,.4));for(let i=0;i<8;i++){const a=i/8*Math.PI*2;at(Math.cos(a)*28,Math.sin(a)*23);steppeTree(m,i,beat(p,.25+i*.025,.75+i*.025));}at();for(const x of [-12,12])bench(m,x,-12,beat(p,.7,1));break;
   case 'M5':
    for(const [i,x] of [-15,0,15].entries()){at(x,(i%2)*14);cookingHearth(m,beat(p,.10+i*.13,.60+i*.12));}at();shade(m,0,-17,beat(p,.62,1));at(0,-17);hearthWorkTable(m,beat(p,.72,1));break;
   case 'M6':
    for(let i=0;i<16;i++){at((i%8-3.5)*9,Math.floor(i/8)*12);steppeTree(m,i,beat(p,.1+(i%8)*.05,.55+(i%8)*.05));}break;
   case 'M7':{
    const c=Math.cos(o.orientation),s=Math.sin(o.orientation),point=(x,y,z=0)=>[o.origin[0]+(x*c-y*s)*scale,o.origin[1]+(x*s+y*c)*scale,o.origin[2]+z*scale];
    const courtAt=(x=0,y=0,factor=1)=>m.at(point(x,y),o.orientation,scale*factor);
    courtAt();m.kind=4;
    // Trodden ground joins each doorway to the settlement approach; it has no
    // display plinth and leaves the surrounding steppe open.
    const ground=beat(p,.02,.34),earth=[[-32,8],[-34,-5],[-27,-19],[-15,-29],[5,-31],[23,-24],[34,-13],[36,4],[27,22],[9,28],[-8,25],[-25,20]];
    // Packed earth is a quiet irregular surface, with one upward normal. A
    // flattened sphere introduced underside shading and looked like a pedestal.
    if(ground>0)for(let i=0;i<earth.length;i++){const a=earth[i],b=earth[(i+1)%earth.length];m.tri([0,-ground,.025],[a[0]*ground,a[1]*ground,.025],[b[0]*ground,b[1]*ground,.025],'#d6c7a6',[[0,0,1],[0,0,1],[0,0,1]]);}
    for(const route of [[[0,-44],[0,-25],[-18,-18],[-24,-3]],[[0,-25],[18,-18],[24,-3]],[[0,-25],[-8,-8],[-9,3],[0,7]]])m.ribbon(route,3.1,'#cfc09d',ground,.045);
    m.kind=8;
    for(const [i,[x,y]] of [[-24,5],[0,15],[24,5]].entries()){courtAt(x,y,.82);yurt(m,{variant:i,heightScale:.75,progress:Math.max(0,(p-i*.06)/(1-i*.06))});}
    courtAt();for(const x of [-29,29]){m.box(x,-15,0,.45,.45,3.5*beat(p,.8,1),timber);m.beam([x,-15,2.5*beat(p,.8,1)],[x,-1,2.5*beat(p,.8,1)],.12,timber,6);}
    // A shared classroom spills into the court: mats, a writing board and shade
    // are useful parts of the place, revealed after the felt has been secured.
    const court=beat(p,.76,1);
    for(const [i,x] of [-12,0,12].entries()){
     courtAt(x,-13);m.box(0,0,.07,9,11*court,.08,[PALETTE.textile,PALETTE.indigo,PALETTE.pine][i]);
     if(court>.8){
      for(const y of [-4,4]){m.box(0,y,.16,8,.22,.025,PALETTE.brass);for(const xx of [-3,3]){m.beam([xx-.45,y,.20],[xx,y+.42,.20],.045,PALETTE.felt,4);m.beam([xx,y+.42,.20],[xx+.45,y,.20],.045,PALETTE.felt,4);}}
      for(const xx of [-4.15,4.15])m.box(xx,0,.16,.12,10.2,.025,PALETTE.brass);
     }
    }
    courtAt();for(const x of [-4,4]){m.box(x,0,0,.35,.35,5*court,timber);m.box(x,0,.02,1.8,2,.16,dark);}m.box(0,0,2.4*court,8,.25,3*court,PALETTE.indigo);
    for(const x of [-4.15,4.15])m.box(x,-.16,2.35*court,.20,.20,3.15*court,timber);
    for(const z of [2.35,5.35])m.box(0,-.16,z*court,8.5,.20,.20,timber);
    if(court>.8)for(const [x,z,w] of [[-2,4.6,1.3],[1,4.6,2],[-1.4,3.65,2.5],[1.9,3.65,1]])m.box(x,-.155,z,.05+w,.018,.05,PALETTE.felt);
    // A small work table and cloth shade keep tools and waiting places at the
    // edge of the lesson, so the mat court and doorway approach remain clear.
    courtAt(-27,-17);for(const x of [-8,8])for(const y of [-5,5])m.box(x,y,0,.32,.32,9*court,timber);
    if(court>0){m.quad([-9,-6,8.8*court],[9,-6,8.8*court],[9,0,9.5*court],[-9,0,9.5*court],PALETTE.felt);m.quad([-9,0,9.5*court],[9,0,9.5*court],[9,6,8.8*court],[-9,6,8.8*court],PALETTE.felt);}
    if(court>.8)for(const x of [-8,8])m.beam([x,-5,8.8],[x-2,-8,.12],.065,'#b6a07c',5);
    for(const x of [-2.6,2.6])m.box(x,0,.1,.30,3,2.2*court,dark);m.box(0,0,2.25*court,7,3.7,.25,timber);
    if(court>.8){m.box(-1.6,0,2.52,2,1.7,.15,PALETTE.textile);m.box(-1.6,-.12,2.68,1.85,1.35,.035,PALETTE.felt);m.cylinder(2,.6,2.52,.55,.9,'#b49a78',10,.50);}
    for(const x of [-38,38]){courtAt(x,11);steppeTree(m,1,beat(p,.7,1)*1.15);courtAt(x,-10);bench(m,0,0,court);}
    const welcome=beat(p,.88,1);if(welcome&&!o.proposal&&!shared.staticOnly){
     residentModel(m,teacher,point(5,-2),o.orientation,seconds,'talk',true);
     for(let i=0;i<4;i++){const arrival=Math.max(0,(welcome-i*.12)/(1-i*.12));if(!arrival)continue;
      residentModel(m,{...child,id:`khanate-pupil-${i}`,visual:{...child.visual,coat:[PALETTE.indigo,PALETTE.clay,PALETTE.pine,PALETTE.textile][i]}},point((i-1.5)*8,-42+arrival*29,.16),o.orientation+Math.PI,seconds,arrival<1?'walk':'use',true);
     }
    }break;
   }
   case 'M8':
    for(const [i,x] of [-17,17].entries()){at(x,8,0,.83);yurt(m,{variant:1,progress:beat(p,i*.1,.75+i*.1)});}at();shade(m,0,-18,beat(p,.6,.9));for(let i=0;i<8;i++){at((i%4-1.5)*4,24+Math.floor(i/4)*4);m.cylinder(0,0,0,1.4,.7,PALETTE.clay,10);steppeTree(m,2,beat(p,.6,1)*.18);}break;
   case 'M9':
    m.cylinder(0,0,0,26,.15,PALETTE.path,48);for(let i=0;i<24;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12;m.beam([Math.cos(a)*19,Math.sin(a)*19,.2],[Math.cos(b)*19,Math.sin(b)*19,.2],.18,PALETTE.felt,5);}for(const x of [-27,27])bench(m,x,0,p);for(const x of [-12,12])m.box(x,24,0,.5,.5,6*p,timber);m.beam([-12,24,5*p],[12,24,5*p],.15,PALETTE.textile,5);break;
   case 'M10':
    for(const [i,x] of [-26,-9,9,26].entries()){at(x,i%2?5:-5);lantern(m,beat(p,.2+i*.08,.64+i*.08));}at();shade(m,0,16,beat(p,.55,.95));break;
   case 'M11':
    m.at([0,0,0]);m.kind=4;m.ribbon([[o.origin[0]-.008,o.origin[1]],[o.origin[0]+(shared.crossingPlaceOnly?-.006:.008),o.origin[1]]],.00045,'#d3c09a',p,.00009);m.kind=8;
    // Crossing endpoints retain their geographic span; only the roadside objects shrink.
    for(const side of shared.crossingPlaceOnly?[-1]:[-1,1])for(const y of [-3.75,3.75]){m.at([o.origin[0]+side*.007,o.origin[1]+y*scale,o.origin[2]],0,scale);m.box(0,0,0,.4,.4,4*p,timber);m.beam([0,0,3.5*p],[side*8,0,3.5*p],.15,timber,5);}break;
   case 'M12':
    yurt(m,{variant:2,progress:p});at(0,-17);shade(m,0,0,beat(p,.55,.92));m.box(0,0,0,7,4,3*p,timber);m.box(0,-.5,3*p,2.7,2,.15,PALETTE.felt);m.box(4,3,0,2.5,2.5,7*beat(p,.7,1),PALETTE.indigo);break;
   case 'M13':
    well(m,beat(p,0,.55));for(const [i,x] of [-23,23].entries()){at(x,12);const q=beat(p,.25+i*.1,.90);m.box(0,0,0,21,23,8*q,'#b09270');m.box(0,0,8*q,24,26,.6,PALETTE.felt);m.box(0,-11.6,0,3.5,.3,6*q,dark);hearth(m,q);}break;
   case 'M14':
    yurt(m,{variant:1,progress:p});at(18,7);m.box(0,0,0,1,1,22*p,timber);m.box(0,0,16*p,8,1,4,PALETTE.textile);at(0,-16);m.box(0,0,0,9,5,3.5*beat(p,.55,.9),timber);for(const x of [-2,0,2])m.beam([x,-1,3.5],[x,1,3.5],.13,dark,5);break;
  }
  }finally{if(shared.projectLabelGeometry)shared.projectLabelGeometry(o,new DataView(m.buffer,labelStart,m.bytes-labelStart));}
 }
 return m.pack();
}
const staticCache=new Map();
let staticCacheBytes=0;
function activityFor(o,shared){const active=shared.activities?.[o.id]??shared.active;return active?.id===o.id&&active.progress<1?active:null;}
function architectureFor(o,shared,progress=1){
 // Canonical transport encounter anchors may sit beside existing households.
 // Their physical program is the source-vetted connected yards, not a ribbon
 // drawn through that household. Original keys/origins still own encounters.
 const base=['M1','M3','M4','M6','M11'].includes(o.id)?new ArrayBuffer(0):legacyProjectMesh([o],false,{...shared,activities:undefined,active:progress<1?{id:o.id,progress}:undefined,staticOnly:true,projectLabelGeometry:undefined});
 return joinProgramMeshes([base,programArchitecture(o,shared,progress)]);
}
export function projectStaticMesh(objects,options={},legacyOptions){
 const shared=typeof options==='boolean'?legacyOptions??{}:options;
 const buffers=[];
 for(const o of objects){let packed=new ArrayBuffer(0);if(o.phase!=='baseline'&&!activityFor(o,shared)){
  const center=shared.center,cell=center?`${Math.floor(center[0]*100)}:${Math.floor(center[1]*100)}`:'all',key=`${o.key}:${o.proposal?'preview':'complete'}:${(shared.zoom??7)<25?'overview':Math.floor((shared.zoom??7)/35)}:${cell}`;
  if(staticCache.has(key))packed=staticCache.get(key);else {packed=architectureFor(o,shared);while(staticCache.size&&(staticCache.size>=80||staticCacheBytes+packed.byteLength>32*1024*1024)){const oldest=staticCache.keys().next().value;staticCacheBytes-=staticCache.get(oldest).byteLength;staticCache.delete(oldest);}if(packed.byteLength<=32*1024*1024){staticCache.set(key,packed);staticCacheBytes+=packed.byteLength;}}
 }buffers.push(packed);if(shared.projectLabelGeometry)shared.projectLabelGeometry(o,new DataView(packed));
 }return joinProgramMeshes(buffers);
}
export function projectDynamicMesh(objects,_future=false,shared={}){
 const buffers=[],budget={remaining:160};
 for(const o of objects){const active=activityFor(o,shared);let packed;
  if(active&&o.phase!=='baseline'){
   const construction=architectureFor(o,shared,Math.max(0,Math.min(1,active.progress))),welcome=active.progress>.88&&!o.proposal?programWitnesses(o,shared,budget):new ArrayBuffer(0);packed=joinProgramMeshes([construction,welcome]);
  }else packed=o.proposal?new ArrayBuffer(0):programWitnesses(o,shared,budget);
  buffers.push(packed);if(shared.projectLabelGeometry)shared.projectLabelGeometry(o,new DataView(packed));
 }return joinProgramMeshes(buffers);
}
export function projectMesh(objects,future=false,shared={}){
 if(!objects.some(o=>o.program))return legacyProjectMesh(objects,future,shared);
 const buffers=[],budget={remaining:160};for(const o of objects){const active=activityFor(o,shared),architecture=o.phase==='baseline'?new ArrayBuffer(0):architectureFor(o,shared,active?Math.max(0,Math.min(1,active.progress)):1),witness=o.proposal||active?.progress<=.88?new ArrayBuffer(0):programWitnesses(o,shared,budget),packed=joinProgramMeshes([architecture,witness]);buffers.push(packed);if(shared.projectLabelGeometry)shared.projectLabelGeometry(o,new DataView(packed));}return joinProgramMeshes(buffers);
}
export const lampPositions=o=>{
 if(o.phase==='baseline')return [];
 const base=[-26,-9,9,26].map((x,i)=>localPoint(o.origin,o.orientation,x,i%2?5:-5,9));if(!o.program)return base;
 return [...base,...programSites(o).filter(s=>!s.legacy&&s.approach).flatMap(s=>[...[-17,17].map(x=>localPoint(s.origin,s.orientation,x,-8,9)),...Array.from({length:4},(_,i)=>{const q=routeAt(s.approach,(i+.5)/4),side=i%2?-1:1;return [q.point[0]-Math.sin(q.angle)*.00018*side,q.point[1]+Math.cos(q.angle)*.00018*side,.00060];})])];
};
