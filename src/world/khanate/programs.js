import bootstrap from './bootstrap.json' with {type:'json'};
import layout from './settlement-layout.json' with {type:'json'};
import authoredPrograms from './program-sites.json' with {type:'json'};
import {placements,quarters,river,toGeo} from './geography.js';
import {paths,smoothPath} from './settlement.js';
import {OBJECT_UNIT,localPoint} from './scale.js';
import {inPolygon,pointSegment,routeAt,distance} from '../placement-geometry.js';

// This is presentation geography, never an input to the eight-quarter model.
// Membership comes from the shipped 55 courts and 188 homes. No household is
// generated, moved or removed to make space for an improvement.
const homes=bootstrap.instances.filter(g=>g.kind==='yurt').flatMap(g=>Array.from({length:g.transforms.length/8},(_,i)=>{
 const [x,y,z,scale,orientation]=g.transforms.slice(i*8,i*8+5),source=layout.homes.find(h=>distance(h.position,[x,y])<1e-9);
 return {id:source?.id??`${g.id}:${i}`,district:g.district,cluster:source?.cluster,origin:[x,y,z],orientation,radius:17.5*scale,scale,variant:g.variant};
}));
const courts=layout.courts.filter(c=>homes.some(h=>h.district===c.district&&h.cluster===c.cluster));
const tradePaths=paths.map(p=>smoothPath(p));
export function nearestProgramApproach(point,routes=programSource.approaches){let best={point,distance:Infinity};for(const route of routes)for(let i=1;i<route.length;i++){
 const a=route[i-1],b=route[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1))),p=[a[0]+t*dx,a[1]+t*dy],d=distance(point,p);
 if(d<best.distance)best={point:p,distance:d};
}return best;}
const approaches=[...tradePaths,...layout.courts.map(c=>{const join=nearestProgramApproach(c.center,tradePaths).point;return smoothPath([c.center,[(c.center[0]+join[0])*.5+.00025,(c.center[1]+join[1])*.5],join]);}),...homes.map(h=>[h.origin,layout.courts.find(c=>c.district===h.district&&c.cluster===h.cluster)?.center??h.origin])];
export const programSource=Object.freeze({homes,courts,approaches,roads:tradePaths,river,householdCount:188,courtCount:55});
const riverDistance=p=>Math.min(...river.slice(1).map((b,i)=>pointSegment(p,river[i],b)));
const standing=Object.values(placements).flatMap(p=>p.peopleSpots.map(s=>({parentKey:p.key,point:s.position}))),working=bootstrap.courtLife.flatMap(c=>c.route);
const kind={M1:'cart-yard',M2:'crossing-keeper',M3:'caravan-yard',M4:'well-garden',M5:'hearth-workshop',M6:'windbreak',M7:'lesson-court',M8:'treatment-court',M9:'contest-yard',M10:'watch-post',M11:'child-crossing',M12:'petition-court',M13:'water-court',M14:'aid-base'};
const labels={M1:'Погрузочный двор',M2:'Смотритель перехода',M3:'Караванный привал',M4:'Сад у колодца',M5:'Домашний очаг',M6:'Защитная роща',M7:'Учебный двор',M8:'Лечебный двор',M9:'Двор игр',M10:'Дозорный пост',M11:'Детская тропа',M12:'Приём прошений',M13:'Колодец и зимовье',M14:'Двор помощи'};
const radius={M1:.0023,M2:.0024,M3:.0034,M4:.0058,M5:.0015,M6:.0053,M7:.0035,M8:.0032,M9:.0033,M10:.0018,M11:.0024,M12:.0024,M13:.0033,M14:.0028};
const counts={M1:3,M2:2,M3:3,M4:3,M5:6,M6:3,M7:2,M8:3,M9:3,M10:3,M11:3,M12:2,M13:3,M14:2};
const useSpots={M3:[[-8,-6],[8,-6],[-26,-10],[26,-10],[-10,24],[10,24]],M4:[[-4,-20],[4,-20],[-12,0],[12,0],[-4,28],[4,28]],M7:[[-12,-14],[0,-14],[12,-14],[5,-2],[-30,-21],[30,-10]],M8:[[-20,-15],[-15,-15],[19,-5],[24,-5],[-16,25],[16,25]],M9:[[-13,-12],[13,-12],[-10,15],[10,15],[-29,-4],[29,-4]],M12:[[-12,-18],[12,-18],[-15,-26],[15,-26],[-15,8],[15,8]],M14:[[-14,-12],[14,-12],[-14,7],[14,7],[-8,-25],[8,-25]]};
const compatible=(a,b)=>a===b||[['M1','M3'],['M4','M7'],['M5','M13']].some(pair=>pair.includes(a)&&pair.includes(b));
const primaryReservations=Object.values(placements).map(p=>({key:p.key,id:p.id,district:p.district,origin:p.origin,radius:['M4','M7'].includes(p.id)?.0065:['M1','M3'].includes(p.id)?.0014:p.id==='M6'?.0001:.0026}));
const reserved=[...primaryReservations];
const reservedConnectors=[];
function free(point,r,q,id,parentKey){
 const samples=Array.from({length:16},(_,i)=>[point[0]+Math.cos(i*Math.PI/8)*r,point[1]+Math.sin(i*Math.PI/8)*r]);
 if(!samples.every(p=>inPolygon(p,[q.polygon]))||riverDistance(point)<=.0065+r+.00006)return false;
 if(homes.some(h=>distance(point,h.origin)<r+h.radius+.00010))return false;
 if(tradePaths.some(path=>path.slice(1).some((b,i)=>pointSegment(point,path[i],b)<r+.0005)))return false;
 if(standing.some(s=>distance(point,s.point)<r+.00012)||working.some(p=>distance(point,p)<r+.00018))return false;
 if(bootstrap.metadata.landmarks.some(l=>point[0]>l.bounds.min[0]-r&&point[0]<l.bounds.max[0]+r&&point[1]>l.bounds.min[1]-r&&point[1]<l.bounds.max[1]+r))return false;
 if(reservedConnectors.some(c=>!compatible(id,c.id)&&c.route.slice(1).some((b,i)=>pointSegment(point,c.route[i],b)<r+c.width+.00006)))return false;
 return !reserved.some(s=>s.key!==parentKey&&!compatible(id,s.id)&&distance(point,s.origin)<r+s.radius+.00015);
}
function pathFree(route,width,parentKey){const quarter=quarters.find(q=>q.id===parentKey.split(':')[1]);for(let i=1;i<route.length;i++){
 const a=route[i-1],b=route[i],steps=Math.max(2,Math.ceil(distance(a,b)/.00035));
 for(let j=0;j<=steps;j++){const p=[a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps];if(riverDistance(p)<=.0065+width+.00002||!inPolygon(p,[quarter.polygon]))return false;}
 if(homes.some(h=>pointSegment(h.origin,a,b)<h.radius+width+.000035))return false;
 if(standing.some(s=>s.parentKey!==parentKey&&pointSegment(s.point,a,b)<width+.00016))return false;
 if(reserved.some(s=>s.key!==parentKey&&!s.key.startsWith(parentKey+'@')&&!compatible(parentKey.split(':')[0],s.id)&&pointSegment(s.origin,a,b)<s.radius+width&&distance(route[0],s.origin)>s.radius))return false;
}return true;}
function connect(point,orientation,r,parentKey){
 // Test every full ribbon, including bends, rather than only its endpoints.
 const width=['M1','M3'].includes(parentKey.split(':')[0])?.00048:.00018;
 const choices=approaches.map(path=>nearestProgramApproach(point,[path])).sort((a,b)=>a.distance-b.distance).slice(0,30);
 for(const target of choices){const end=target.point,angle=Math.atan2(end[1]-point[1],end[0]-point[0]),start=[point[0]+Math.cos(angle)*r*.78,point[1]+Math.sin(angle)*r*.78];
  const direct=[start,end];if(pathFree(direct,width,parentKey))return direct;
  for(const bend of [.001,-.001,.002,-.002,.004,-.004,.006,-.006,.009,-.009]){const middle=[(start[0]+end[0])/2-Math.sin(angle)*bend,(start[1]+end[1])/2+Math.cos(angle)*bend],route=[start,middle,end];if(pathFree(route,width,parentKey))return route;}
 }return null;
}
const box=(origin,r)=>({min:[origin[0]-r,origin[1]-r,origin[2]],max:[origin[0]+r,origin[1]+r,origin[2]+.0012],extent:[r*2,r*2,.0012],center:[...origin.slice(0,2),origin[2]+.0006]});
function descriptor(parent,point,r,index,source,options={}){
 const orientation=options.orientation??parent.orientation,origin=[point[0],point[1],.00006],key=index===0?parent.key:`${parent.key}@${index}`;
 return {key,parentKey:parent.key,id:parent.id,district:parent.district,origin,position:toGeo(origin),orientation,size:[r*2,r*2],radius:r,source,kind:kind[parent.id],label:index===0?`${labels[parent.id]} · главный двор`:`${labels[parent.id]} · ${index}`,index,peopleSpots:(useSpots[parent.id]??[[-9,-13],[9,-13],[-14,0],[14,0],[-7,13],[7,13]]).map(([x,y])=>({position:localPoint(origin,orientation,x,y),angle:orientation})),view:{...box(origin,r),zoom:Math.min(280,Math.max(65,1.2/(r*2)))},...options};
}
const allPrograms=new Map();
function buildPrograms(){
 // Larger landscaped and healing footprints claim land first. This stable
 // order is independent of purchases, so replacing a decision never moves sites.
 const order=['M4','M7','M8','M6','M3','M1','M13','M9','M2','M11','M14','M12','M10','M5'];
 for(const id of order)for(const q of quarters){
  const parent=placements[`${id}:${q.id}`],r=radius[id],gardenRadius=id==='M4'?Math.min(r,nearestProgramApproach(parent.origin,tradePaths).distance-.00065):r,primary=descriptor(parent,parent.origin,id==='M4'?gardenRadius:id==='M7'?r:['M1','M3','M6','M11'].includes(id)?.0001:Math.min(r,.0026),0,'authored-khanate-parcel',{primary:true,legacy:true,peopleSpots:parent.peopleSpots,view:id==='M4'?{...box(parent.origin,gardenRadius),zoom:Math.min(280,1.2/(gardenRadius*2))}:parent.view}),sites=[primary],localCourts=courts.filter(c=>c.district===q.id),used=new Set();
  if(['M1','M3','M6','M11'].includes(id))primary.kind='encounter-anchor';
  if(id==='M6'){
   const usedEdges=new Set();
   for(let index=1;index<=counts[id];index++){
    let chosen;
    for(let edge=0;edge<q.polygon.length;edge++){
     if(usedEdges.has(edge))continue;const a=q.polygon[edge],b=q.polygon[(edge+1)%q.polygon.length],angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
     for(const t of [.28,.5,.72,.18,.82])for(const inset of [r*1.45,r*1.9,r*2.4]){
      const boundary=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],toward=Math.atan2(q.center[1]-boundary[1],q.center[0]-boundary[0]),point=[boundary[0]+Math.cos(toward)*inset,boundary[1]+Math.sin(toward)*inset];
      if(!free(point,r,q,id,parent.key))continue;const approach=connect(point,angle,r,parent.key);if(!approach)continue;
      const court=localCourts.slice().sort((a,b)=>distance(a.center,point)-distance(b.center,point))[0];chosen=descriptor(parent,point,r,index,`quarter-edge:${q.id}:${edge}`,{cluster:court.cluster,edge,approach,orientation:angle});break;
     }if(chosen)break;
    }
    if(!chosen)throw Error(`No complete clear windbreak belt ${index} in ${q.id}`);
    sites.push(chosen);usedEdges.add(chosen.edge);reserved.push(chosen);reservedConnectors.push({id,route:chosen.approach,width:.00018});
   }
  }else if(id==='M5'){
   const selected=homes.filter(h=>h.district===q.id).sort((a,b)=>a.cluster-b.cluster||a.id.localeCompare(b.id));
   const ordered=localCourts.flatMap(c=>selected.filter(h=>h.cluster===c.cluster).slice(0,1));
   for(const [index,h] of ordered.slice(0,counts[id]).entries()){
    const site=descriptor(parent,h.origin,h.radius+.00015,index+1,`existing-household:${h.id}`,{kind:'converted-hearth',hostHomeId:h.id,home:h,cluster:h.cluster,approach:[h.origin,layout.courts.find(c=>c.district===q.id&&c.cluster===h.cluster).center]});sites.push(site);
   }
  }else{
   let available=[...localCourts];
   // Edge planting follows exposed quarter edges. Treatment courts maximize
   // source-cluster separation before considering a smaller safe separation.
   if(id==='M6')available.sort((a,b)=>Math.min(...q.polygon.map(p=>distance(a.center,p)))-Math.min(...q.polygon.map(p=>distance(b.center,p))));
   if(id==='M8')available.sort((a,b)=>distance(b.center,parent.origin)-distance(a.center,parent.origin));
   for(let index=1;index<=counts[id];index++){
    let chosen;
    for(const separation of id==='M8'?[.066667,.033333,.024]:[0]){
     for(const court of available){if(used.has(court.cluster))continue;
      for(let attempt=0;attempt<240;attempt++){
       const angle=(court.cluster*1.37+index*.61+attempt*2.399963),spread=.0038+r+Math.sqrt(attempt)*.0010,point=[court.center[0]+Math.cos(angle)*spread,court.center[1]+Math.sin(angle)*spread];
       if(id==='M8'&&sites.slice(1).some(s=>distance(point,s.origin)<separation))continue;
       if(!free(point,r,q,id,parent.key))continue;
       const approach=connect(point,parent.orientation,r,parent.key);if(!approach)continue;
       chosen=descriptor(parent,point,r,index,`household-court:${q.id}:${court.cluster}`,{cluster:court.cluster,approach,separation:separation||undefined});break;
      }if(chosen)break;
     }if(chosen)break;
    }
    if(!chosen)throw Error(`No complete clear ${id} program site ${index} in ${q.id}`);
    sites.push(chosen);used.add(chosen.cluster);reserved.push(chosen);reservedConnectors.push({id,route:chosen.approach,width:['M1','M3'].includes(id)?.00048:.00018});
   }
  }
  const areas=sites.filter(s=>!s.legacy&&s.kind!=='converted-hearth').map(s=>({key:`${s.key}:area`,siteKey:s.key,ring:Array.from({length:16},(_,i)=>[s.origin[0]+Math.cos(i*Math.PI/8)*s.radius*.94,s.origin[1]+Math.sin(i*Math.PI/8)*s.radius*.94]),source:s.source}));
  const points=sites.flatMap(s=>[[s.origin[0]-s.radius,s.origin[1]-s.radius],[s.origin[0]+s.radius,s.origin[1]+s.radius],...(s.approach??[]),...(s.legacy&&s.kind!=='encounter-anchor'&&s.view?[s.view.min,s.view.max]:[])]),min=[Math.min(...points.map(p=>p[0]))-.0005,Math.min(...points.map(p=>p[1]))-.0005,Math.min(.00004,...sites.map(s=>s.view?.min?.[2]??.00006))],max=[Math.max(...points.map(p=>p[0]))+.0005,Math.max(...points.map(p=>p[1]))+.0005,Math.max(.00126,...sites.map(s=>s.view?.max?.[2]??.00126))],bounds={min,max,extent:max.map((v,i)=>v-min[i]),center:min.map((v,i)=>(v+max[i])/2)};
  allPrograms.set(parent.key,Object.freeze({key:parent.key,id,district:q.id,sites,areas,bounds,source:{courts:sites.filter(s=>s.cluster!==undefined).map(s=>`${q.id}:${s.cluster}`),households:sites.filter(s=>s.hostHomeId).map(s=>s.hostHomeId)},illustrative:true}));
 }
}
let built=false;
function ensurePrograms(){if(built)return;for(const program of authoredPrograms.programs){allPrograms.set(program.key,Object.freeze(program));for(const site of program.sites){if(site.legacy||site.hostHomeId)continue;reserved.push(site);reservedConnectors.push({id:site.id,route:site.approach,width:['M1','M3'].includes(site.id)?.00048:.00018});}}built=true;}
export function generateKhanateProgramData(){reserved.splice(0,reserved.length,...primaryReservations);reservedConnectors.splice(0);allPrograms.clear();buildPrograms();built=true;return {version:1,programs:Object.values(placements).map(p=>allPrograms.get(p.key))};}
export function programFor(record){ensurePrograms();return record.program??allPrograms.get(record.parentKey??record.key);}
export function programSites(record){return programFor(record)?.sites??[record];}
export function programBounds(record){return programFor(record)?.bounds??record.view;}
export function programCrossingCycle(seconds,offset=0){const time=((seconds+offset)%36+36)%36;return {time,cartOpen:time<13,herdOpen:time>=17&&time<30,allWaiting:time>=13&&time<17||time>=30,cartProgress:Math.min(1,time/13),herdProgress:Math.max(0,Math.min(1,(time-17)/13))};}
export function programCrossingCartPose(seconds,offset=0){const cycle=programCrossingCycle(seconds,offset),t=cycle.time;
 if(cycle.cartOpen)return {point:[0,-27+54*cycle.cartProgress],angle:Math.PI,waiting:false,returning:false};
 if(t<17)return {point:[0,27],angle:Math.PI+(t-13)/4*Math.PI/2,waiting:true,returning:false};
 if(t<30){const pose=routeAt([[0,27],[-18,27],[-18,-27],[0,-27]],(t-17)/13);return {...pose,angle:pose.angle+Math.PI/2,waiting:false,returning:true};}
 return {point:[0,-27],angle:Math.PI/2+(t-30)/6*Math.PI/2,waiting:true,returning:true};
}
export function programRoutePose(route,seconds,{period=90,offset=0,wait=8}={}){const t=((seconds+offset)%period+period)%period,travel=(period-wait*2)/2,returning=t>=travel+wait,progress=t<travel?t/travel:t<travel+wait?1:t<period-wait?1-(t-travel-wait)/travel:0,q=routeAt(route,progress),turn=t>=travel&&t<travel+wait?(t-travel)/wait*Math.PI:t>=period-wait?Math.PI+(t-period+wait)/wait*Math.PI:returning?Math.PI:0;return {...q,progress,routeAngle:q.angle,turn,angle:q.angle+Math.PI/2+turn,waiting:t>=travel&&t<travel+wait||t>=period-wait,returning};}

export function auditKhanatePrograms(){
 ensurePrograms();const issues=[],checked={programs:allPrograms.size,sites:0,solids:0,connectors:0,primaryGardens:0,homes:homes.length,courts:layout.courts.length};
 for(const program of allPrograms.values())for(const site of program.sites){checked.sites++;if(site.legacy)continue;
  if(site.hostHomeId){if(!homes.some(h=>h.id===site.hostHomeId&&distance(h.origin,site.origin)<1e-9))issues.push(`${site.key}: unknown converted household`);continue;}
  checked.solids++;const q=quarters.find(q=>q.id===site.district),r=site.radius;
  if(!Array.from({length:32},(_,i)=>[site.origin[0]+Math.cos(i*Math.PI/16)*r,site.origin[1]+Math.sin(i*Math.PI/16)*r]).every(p=>inPolygon(p,[q.polygon])))issues.push(`${site.key}: full envelope outside district`);
  if(riverDistance(site.origin)<=.0065+r+.000025)issues.push(`${site.key}: river envelope`);
  for(const h of homes)if(distance(site.origin,h.origin)<r+h.radius+.000025)issues.push(`${site.key}: home ${h.id}`);
  if(tradePaths.some(path=>path.slice(1).some((b,i)=>pointSegment(site.origin,path[i],b)<r+.0005)))issues.push(`${site.key}: source road envelope`);
  if(standing.some(s=>distance(site.origin,s.point)<r+.0001))issues.push(`${site.key}: standing resident envelope`);
  for(const other of reserved)if(other.key!==site.key&&other.key!==site.parentKey&&!compatible(site.id,other.id)&&distance(site.origin,other.origin)<r+other.radius+.0001)issues.push(`${site.key}: program envelope ${other.key}`);
  if(!site.approach||site.approach.length<2)issues.push(`${site.key}: no checked approach`);else {checked.connectors++;if(!pathFree(site.approach,['M1','M3'].includes(site.id)?.00048:.00018,site.parentKey))issues.push(`${site.key}: full connector clearance`);const end=site.approach.at(-1);if(nearestProgramApproach(end).distance>.000001)issues.push(`${site.key}: detached connector`);}
 }
 for(const program of allPrograms.values())if(program.id==='M4'){const primary=program.sites[0];checked.primaryGardens++;if(nearestProgramApproach(primary.origin,tradePaths).distance<primary.radius+.0005)issues.push(`${primary.key}: expanded primary garden reaches source road`);}
 return {ok:issues.length===0,issues,checked,provenance:'shipped settlement-layout / bootstrap, unchanged 188 homes and 55 courts',primaryPolicy:'Original approved encounter parcels retained; shared M1/M3, M4/M7 and M5/M13 parcels preserve domain conflicts. Audit covers every new full courtyard envelope, household attachment and connector.'};
}
