import bootstrap from './bootstrap.json';
import * as projects from './projects.js';
import * as choreography from './choreography.js';
import {naturePlaces} from './landscape.js';
import {createKhanateMotion} from './motion.js';
import {makeTemplate} from './models.js';
import {residents} from '../../modes/khanate/residents';
import {projects as presentation} from '../../modes/khanate/projects';

export default {
 id:'khanate',observations:naturePlaces,cameraBounds:[-.315,-.245,.34,.37],mapLabel:'City by the Esil',bootstrap,projects,choreography,residents,
 districtZoom:20,labelZoom:9,worldZoom:7,placeZoom:40,overviewZoom:9,borders:false,
 // Existing northern courts and herd share the bank, beside the opening paper.
 arrivalPose:{x:-.04075,y:-.018,yaw:-.30,pitch:1,zoom:150},
 createTransitMotion:()=>createKhanateMotion({courts:bootstrap.courtLife,residents}),isHeroSchool:()=>false,
 anchorFor:r=>({id:`${r.location}:${projects.footprintKinds[r.primary]}`,districtId:r.location,kind:projects.footprintKinds[r.primary],label:presentation[r.primary].shortName,provisional:true}),
 projectNames:Object.fromEntries(Object.entries(presentation).map(([id,p])=>[id,p.shortName])),
 projectTitles:Object.fromEntries(Object.entries(presentation).map(([id,p])=>[id,p.name])),
 rendererOptions:{territoryScale:.32,palette:{land:'#d8ccb0',skyTop:'#c6d5cd',skyBottom:'#f0e5cd',nightTop:'#273d43',nightBottom:'#697c77'}},
 shouldAnimateProjects:objects=>objects.some(o=>!o.proposal&&o.phase!=='baseline'),
 install(renderer){const templates=new Map();for(const group of bootstrap.instances){const key=`${group.kind}:${group.variant}`;if(!templates.has(key))templates.set(key,makeTemplate(group.kind,group.variant));renderer.addInstances(group.id,templates.get(key),new Float32Array(group.transforms),group.bounds,group.buildings);}},
};
