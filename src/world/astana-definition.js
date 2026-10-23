import bootstrap from './bootstrap.json';
import * as projects from './project-objects.js';
import * as choreography from './choreography.js';
import {createLrtMotion} from './lrt-motion.js';
import {isHeroSchool} from './hero-school.js';
import {RESIDENTS} from '../residents/population';
import {anchorFor} from '../residents/engine';
import {INITIATIVES} from '../domain/scenario';
import {makeArchitecturePart} from './architecture-models.js';
import {fetchMapAsset,fetchMapJsonAsset} from './map-assets.js';

export default {
 id:'astana',mapLabel:'Map of Astana',bootstrap,projects,choreography,
 arrivalPose:{x:-.005,y:-.092,yaw:-.28,pitch:.90,zoom:62},
 createTransitMotion:createLrtMotion,isHeroSchool,anchorFor,residents:RESIDENTS,
 projectNames:{M1:'Buses',M2:'Signals',M3:'LRT',M4:'Park',M5:'Heating',M6:'Planting',M7:'School',M8:'Clinic',M9:'Sport',M10:'Lighting',M11:'Crossings',M12:'Requests',M13:'Utilities',M14:'Crews'},
 projectTitles:Object.fromEntries(Object.values(INITIATIVES).map(i=>[i.id,i.name])),
 async install(renderer,{base,signal}){
  const architecture=bootstrap.metadata.architecture;if(!architecture)return;
  const [data,groups]=await Promise.all([
   fetchMapAsset({...architecture.asset,url:base+architecture.asset.url},{signal}),
   fetchMapJsonAsset({...architecture.groupsAsset,url:base+architecture.groupsAsset.url},{signal}),
  ]),templates=new Map();
  if(!Array.isArray(groups)||groups.length!==architecture.groupCount)throw Error('Façade placement metadata mismatch');
  for(const group of groups){
   signal.throwIfAborted();const key=group.family+'/'+group.part+'/'+group.columns;
   if(!templates.has(key))templates.set(key,makeArchitecturePart(group.family,group.part,group.columns));
   renderer.addInstances(group.id,templates.get(key),new Float32Array(data,group.offset,group.bytes/4),group.bounds,0,{detailHeight:1.5/12000,fadePixels:[1.3,3.2],templateKey:key});
  }
 },
};
