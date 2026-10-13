import bootstrap from './bootstrap.json';
import * as projects from './project-objects.js';
import * as choreography from './choreography.js';
import {createLrtMotion} from './lrt-motion.js';
import {isHeroSchool} from './hero-school.js';
import {RESIDENTS} from '../residents/population';
import {anchorFor} from '../residents/engine';
import {INITIATIVES} from '../domain/scenario';
import {makeArchitecturePart} from './architecture-models.js';
import {fetchMapAsset} from './map-assets.js';

export default {
 id:'astana',mapLabel:'Карта Астаны',bootstrap,projects,choreography,
 arrivalPose:{x:-.005,y:-.092,yaw:-.28,pitch:.90,zoom:62},
 createTransitMotion:createLrtMotion,isHeroSchool,anchorFor,residents:RESIDENTS,
 projectNames:{M1:'Автобусы',M2:'Светофоры',M3:'LRT',M4:'Парк',M5:'Топливо',M6:'Посадки',M7:'Школа',M8:'Клиника',M9:'Спорт',M10:'Свет',M11:'Переходы',M12:'Обращения',M13:'Сети',M14:'Бригады'},
 projectTitles:Object.fromEntries(Object.values(INITIATIVES).map(i=>[i.id,i.name])),
 async install(renderer,{base,signal}){
  const architecture=bootstrap.metadata.architecture;if(!architecture)return;
  const data=await fetchMapAsset({...architecture.asset,url:base+architecture.asset.url},{signal}),templates=new Map();
  for(const group of architecture.groups){
   signal.throwIfAborted();const key=group.family+'/'+group.part+'/'+group.columns;
   if(!templates.has(key))templates.set(key,makeArchitecturePart(group.family,group.part,group.columns));
   renderer.addInstances(group.id,templates.get(key),new Float32Array(data,group.offset,group.bytes/4),group.bounds,0,{detailHeight:1.5/12000,fadePixels:[1.3,3.2],templateKey:key});
  }
 },
};
