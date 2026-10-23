import {DISTRICT_IDS,INITIATIVE_IDS} from '../../domain/types';
import type {InitiativeId} from '../../domain/types';
import {INITIATIVES} from '../../domain/scenario';
import type {Appeal,LivingStory,LivingPlace} from '../../living/appeals';
import type {Resident,Visual,Prop,AnchorKind} from '../../residents/types';
import {storySeeds} from './story-seeds';
import {projects} from './projects';
import {districts} from './terms';

export const provenance='Authored petitions from a fictional city on the Esil';
const places:Record<InitiativeId,LivingPlace>={M1:'stop',M2:'crossing',M3:'stop',M4:'garden',M5:'service',M6:'garden',M7:'school',M8:'clinic',M9:'court',M10:'crossing',M11:'crossing',M12:'service',M13:'service',M14:'service'};
const props:Record<InitiativeId,Prop>={M1:'cart',M2:'scarf',M3:'satchel',M4:'plant',M5:'bread',M6:'plant',M7:'book',M8:'tote',M9:'ball',M10:'scarf',M11:'satchel',M12:'book',M13:'toolbox',M14:'gloves'};
const secondary:Record<InitiativeId,InitiativeId>={M1:'M2',M2:'M11',M3:'M10',M4:'M9',M5:'M6',M6:'M5',M7:'M11',M8:'M10',M9:'M10',M10:'M12',M11:'M7',M12:'M14',M13:'M14',M14:'M13'};
const habits:Record<InitiativeId,string>={
 M1:'Checks a knot on the baggage and turns towards the river.',M2:'Brushes dust from a sleeve while letting a neighbour pass.',M3:'Adjusts a saddlebag and looks for travelling companions.',
 M4:'Covers a small tree\'s roots with a damp cloth.',M5:'Wraps bread in a clean cloth and looks up at the smoke.',M6:'Tightens a soft tie on a sapling.',
 M7:'Holds a bookmark and makes room for a pupil nearby.',M8:'Sorts herb bundles and moves them away from the mat\'s edge.',M9:'Stops a ball with one foot before it rolls towards the road.',
 M10:'Adjusts a collar and looks towards the evening path.',M11:'Holds a bag close and checks whether the crossing is clear.',M12:'Closes a book around one hand to keep the page.',
 M13:'Sets a tool on the mat with its handle towards the passage.',M14:'Folds work gloves and checks the bag\'s ties.',
};
function visualFor(index:number,id:InitiativeId):Visual {
 return {era:'khanate',coat:['#566d6c','#986f5b','#76816a','#745a60','#9b906f'][index%5]!,accent:['#c5ac7d','#ded3b9','#b98770','#9bac9f'][index%4]!,skin:['#cfa17c','#b88564','#ddb695','#c19472'][index%4]!,hair:index%7===0?'#a6a397':'#3b322c',cut:index%3===0?'wide':'long',head:index%3===0?'hood':'cap',build:id==='M9'?'small':index%4===0?'broad':'regular',mobility:index%13===0?'cane':'walk',prop:props[id]};
}
const stories:LivingStory[]=[],appeals:Appeal[]=[],residents:Resident[]=[];
for(const districtId of DISTRICT_IDS)for(const initiativeId of INITIATIVE_IDS){
 const [name,role,opening,request]=storySeeds[districtId][initiativeId],index=stories.length;
 const id=`khanate-story-${districtId}-${initiativeId}`,appealId=`KHAN-${districtId.toUpperCase()}-${initiativeId.slice(1).padStart(3,'0')}`;
 const visual=visualFor(index,initiativeId),place=places[initiativeId],project=projects[initiativeId],other=secondary[initiativeId];
 stories.push({id,appealId,districtId,name,role,initiativeId,visual,place,opening});
 appeals.push({id:appealId,districtId,title:`${project.shortName} · ${name}`,topic:INITIATIVES[initiativeId].area,addressee:`To the Khan of the city on the Esil · ${districts.find(d=>d.id===districtId)!.name}`,applicant:`${name}, ${role}`,circumstances:opening,request,initiativeIds:[initiativeId],storyId:id,sourceIds:[],provenance,limitation:'This resident and these circumstances were written for the game. A decree supports a policy area; an individual request is not considered fulfilled simply because its construction scene has finished.'});
 const anchor:AnchorKind=place==='court'?'garden':place;
 residents.push({id,name,age:initiativeId==='M9'?'teenager':index%7===0?'older adult':'adult',synthetic:true,signature:['M7','M1','M5'].includes(initiativeId),home:districtId,location:districtId,role,visual,habit:habits[initiativeId],action:{ru:opening,kk:opening},why:{ru:request,kk:request},primary:initiativeId,secondary:other,concerns:[project.indicator,projects[other].indicator],relationships:[],routine:[{activity:'idle',anchor,seconds:5},{activity:'handle',anchor,seconds:4},{activity:'walk',anchor,seconds:4},{activity:'wait',anchor,seconds:3}]});
}
export {stories,residents};
export const storyAppeals:readonly Appeal[]=appeals;
