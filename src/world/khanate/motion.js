import {Mesh} from '../mesh-kit.js';
import {visibleBounds} from '../render-policy.js';
import {sampleLife,lifePopulation} from './life.js';
import {appendPose,lifeTemplate,templateCacheBytes} from './life-models.js';
import {bindCourtResidents,sampleCourtLife,courtResidentTemplate,courtTemplateBytes} from './court-life.js';

/** One bounded dynamic batch. Hidden life does no geometry work; reduced motion
 * freezes positions and uploads once. Walking cycles are independent of camera. */
export function createKhanateMotion({courts=[],residents=[]}={}){
 const courtResidents=bindCourtResidents(courts,residents);
 let key='',stats={visibleTrains:0,visibleRiders:0,people:0,animals:0,birds:0},poses=[];
 return {update(view){
  const {seconds,zoom,reducedMotion,night=0,residentIds=[]}=view,step=reducedMotion||night>.7?32:Math.floor(seconds*(zoom>24?16:10))/(zoom>24?16:10),excluded=new Set(residentIds);
  poses=[...sampleLife(step,{reducedMotion,night:night>.7}),...sampleCourtLife(courtResidents,step,{quiet:reducedMotion||night>.7})].filter(p=>{if(p.resident&&excluded.has(p.resident.id))return false;const r=p.radius??Math.max(.00025,p.scale*6),h=p.resident?.00028:p.scale*10;return visibleBounds([p.position[0]-r,p.position[1]-r,p.position[0]+r,p.position[1]+r,p.position[2]-.00004,p.position[2]+h],view);});
  const next=poses.length?step+':'+(zoom>=55?'detail':'simple')+':'+poses.map(p=>p.id).join(','):'hidden';if(key===next)return null;key=next;
  const m=new Mesh();stats={visibleTrains:0,visibleRiders:0,people:0,animals:0,birds:0};
  for(const p of poses){appendPose(m,p.resident?courtResidentTemplate(p,zoom>=55):lifeTemplate(p.kind,p.phase,p.variant,p.activity),p.position,p.angle,p.resident?1:p.scale);stats[p.kind==='person'?'people':['bird','eagle'].includes(p.kind)?'birds':'animals']++;}
  return m.pack();
 },diagnostics(){return {...stats,population:lifePopulation.length+courtResidents.length,routedPopulation:lifePopulation.length,courtPopulation:courtResidents.length,cacheBytes:templateCacheBytes()+courtTemplateBytes(),poses:poses.map(p=>({id:p.id,kind:p.kind,...(p.resident?{residentId:p.resident.id}:{}),position:p.position,activity:p.activity}))};}};
}
