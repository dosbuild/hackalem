import {routeAt} from '../placement-geometry.js';
import {residentModel,identitySeed} from '../resident-models.js';
import {Mesh,smooth} from '../mesh-kit.js';
import {groundHeight} from './landscape.js';

/** Ordinary court activity reuses actual resident appearances, with no new story. */
export function bindCourtResidents(courts,residents){
 const used=new Set();return courts.flatMap(court=>{
  const resident=residents.find(r=>r.home===court.district&&!used.has(r.id));if(!resident)return [];
  used.add(resident.id);return [{...court,resident}];
 });
}
export function sampleCourtLife(courts,seconds,{quiet=false}={}){
 const t=quiet?32:seconds;
 return courts.map(court=>{
  const f=((t+court.offset)%court.period)/court.period;
  const progress=f<.35?smooth(f/.35):f<.65?1:f<.92?1-smooth((f-.65)/.27):0,activity=f>=.35&&f<.65?'use':f>=.92?'talk':'walk';
  const turn=f<.5?0:f<.65?Math.PI*smooth((f-.5)/.15):f<.92?Math.PI:Math.PI+Math.PI*smooth((f-.92)/.08);
  const q=routeAt(court.route,progress);
  return {id:court.id,kind:'person',resident:court.resident,position:[...q.point,groundHeight(...q.point)+.00006],angle:q.angle+Math.PI/2+turn,activity,phase:t*(activity==='walk'?6:2)+(activity==='walk'?identitySeed(court.resident.id):0),radius:.00018};
 });
}
const templates=new Map();
export function courtResidentTemplate(p,detail){
 const phase=((Math.round(p.phase/(Math.PI*2)*16)%16)+16)%16,key=p.resident.id+'/'+p.activity+'/'+phase+'/'+detail;
 if(templates.has(key))return templates.get(key);
 const m=new Mesh();residentModel(m,p.resident,[0,0,0],0,(phase/16*Math.PI*2-(p.activity==='walk'?identitySeed(p.resident.id):0))/(p.activity==='walk'?6:2),p.activity,detail);
 const data=m.pack();if(templates.size>=96)templates.delete(templates.keys().next().value);templates.set(key,data);return data;
}
export const courtTemplateBytes=()=>[...templates.values()].reduce((n,data)=>n+data.byteLength,0);
