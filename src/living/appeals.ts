import type {ModeDefinition} from '../modes/types';
import type { AppState } from '../app/state';
import { isCurrentResult } from '../domain/identity';
import { DISTRICTS, INITIATIVES } from '../domain/scenario';
import { DISTRICT_IDS } from '../domain/types';
import type { DistrictId, IndicatorId, InitiativeId, PolicyArea } from '../domain/types';
import { RESIDENTS } from '../residents/population';
import type { Visual, Prop } from '../residents/types';
import { STORY_SEEDS } from './data/stories';
import { STORY_VOICES } from './data/voices';
import { READING_SEEDS } from './data/reading';

export const PROVENANCE = 'Scenario requests based on public information about eOtinish topics and procedures';
export const SOURCES = {
  eotinish:{title:'eOtinish: topics and submitting requests',url:'https://eotinish.kz/ru',note:'Public request categories and the purpose of the official system.'},
  process:{title:'Government material about eOtinish',url:'https://www.gov.kz/memleket/entities/pavlodar-transport/press/news/details/942252?lang=ru',note:'Official guidance on submitting a request, identifying the authority and describing the issue.'},
  development:{title:'Astana development plan for 2021–2025',url:'https://www.gov.kz/memleket/entities/astana/documents/details/574960?lang=ru',note:'A historical public document covering education, healthcare, transport, utilities, safety and the environment. A thematic source, not evidence of the current condition of a particular place.'},
  school:{title:'Public plans to expand Astana\'s school network',url:'https://www.gov.kz/memleket/entities/astana/press/news/details/675700?lang=ru',note:'Municipal material about demand for learning places; publication figures are not copied into the scenarios.'},
  clinic:{title:'Primary healthcare development in Astana',url:'https://www.gov.kz/memleket/entities/astana/press/news/details/1136763?lang=ru',note:'Municipal material about medical infrastructure and access to appointments.'},
  fuel:{title:'The capital\'s gasification programme',url:'https://www.gov.kz/memleket/entities/astana/press/news/details/922284?lang=ru',note:'The public topic of switching fuel; no addresses, tariffs or actual applicants are borrowed.'},
  green:{title:'Planting and tree care in the capital',url:'https://www.gov.kz/memleket/entities/astana/press/news/details/879062?lang=ru',note:'Public material on planting and irrigation systems.'},
} as const;
export type SourceId = keyof typeof SOURCES;
export type LivingPlace = 'stop'|'school'|'clinic'|'garden'|'court'|'crossing'|'service';
export interface Appeal {
  id:string; districtId:DistrictId; title:string; topic:PolicyArea; addressee:string;
  applicant:string; circumstances:string; request:string; initiativeIds:readonly InitiativeId[];
  storyId:string|null; sourceIds:readonly SourceId[]; provenance:string;
  limitation:string;
}
export interface LivingStory {
  id:string; appealId:string; districtId:DistrictId; name:string; role:string;
  initiativeId:InitiativeId; visual:Visual; place:LivingPlace; opening:string;
}
const sourcesFor=(id:InitiativeId):SourceId[]=>['eotinish','process',...(['M7'].includes(id)?['school' as const]:['M8'].includes(id)?['clinic' as const]:id==='M5'?['fuel' as const]:['M4','M6'].includes(id)?['green' as const]:['development' as const])];
const districtName=(id:DistrictId)=>DISTRICTS.find(d=>d.id===id)!.name;
export const TOPICS:Record<PolicyArea,string>={transport:'Transport',environment:'Environment and planting',social:'Education and health',safety:'Safety',municipal:'City services'};
const PLACE:Record<InitiativeId,LivingPlace>={M1:'stop',M2:'crossing',M3:'stop',M4:'garden',M5:'service',M6:'garden',M7:'school',M8:'clinic',M9:'court',M10:'crossing',M11:'crossing',M12:'service',M13:'service',M14:'service'};
const PROPS:Record<InitiativeId,Prop>={M1:'satchel',M2:'thermos',M3:'headphones',M4:'watering-can',M5:'tote',M6:'plant',M7:'book',M8:'folder',M9:'ball',M10:'camera',M11:'stroller',M12:'clipboard',M13:'toolbox',M14:'headphones'};
function visualFor(name:string,i:number,id:InitiativeId):Visual {
  const existing=RESIDENTS.find(r=>r.name===name);
  if(existing)return {...existing.visual,prop:PROPS[id]};
  return {coat:['#455d75','#756389','#8b7054','#557c6c','#a56152'][i%5]!,accent:['#e4bc75','#cbdac4','#c58555','#d2adbe'][i%4]!,skin:['#d29c77','#e1b48e','#bd8666'][i%3]!,hair:['#302d32','#aba297','#534338'][i%3]!,cut:i%2?'long':'jacket',head:i%2?'cap':'bob',build:'regular',mobility:'walk',prop:PROPS[id]};
}
const appeals:Appeal[]=[],stories:LivingStory[]=[];
for(const districtId of DISTRICT_IDS) {
  for(const [index,seed] of STORY_SEEDS[districtId].entries()) {
    const [initiativeId,name,role,title,circumstances,request]=seed;
    const id=`ALEM-${districtId.toUpperCase()}-${String(index+1).padStart(3,'0')}`,storyId=`story-${districtId}-${initiativeId}`;
    appeals.push({id,districtId,title,topic:INITIATIVES[initiativeId].area,addressee:`To the Mayor (Akim) of ${districtName(districtId)} district, Astana`,applicant:name,circumstances,request,initiativeIds:[initiativeId],storyId,sourceIds:sourcesFor(initiativeId),provenance:PROVENANCE,limitation:'Educational scenario: the applicant and circumstances are fictional. Choosing a project does not mean that a request has been officially reviewed or resolved.'});
    stories.push({id:storyId,appealId:id,districtId,name,role,initiativeId,place:PLACE[initiativeId],visual:visualFor(name,stories.length,initiativeId),opening:STORY_VOICES[districtId][initiativeId]});
  }
  for(const [index,seed] of READING_SEEDS[districtId].entries()) {
    const [title,applicant,circumstances,request,initiativeIds]=seed;
    appeals.push({id:`ALEM-${districtId.toUpperCase()}-${String(index+15).padStart(3,'0')}`,districtId,title,topic:INITIATIVES[initiativeIds[0]!].area,addressee:`To the Mayor (Akim) of ${districtName(districtId)} district, Astana`,applicant,circumstances,request,initiativeIds,storyId:null,sourceIds:sourcesFor(initiativeIds[0]!),provenance:PROVENANCE,limitation:'An authored reading scenario. Related programmes can support this policy area, but do not replace inspection and specific work on this request. No separate encounter with the applicant is provided.'});
  }
}
export const APPEALS:readonly Appeal[]=appeals;
export const STORIES:readonly LivingStory[]=stories;
export const APPEAL_BY_ID:Readonly<Record<string,Appeal>>=Object.fromEntries(APPEALS.map(a=>[a.id,a]));
export const STORY_BY_ID:Readonly<Record<string,LivingStory>>=Object.fromEntries(STORIES.map(s=>[s.id,s]));
export function getAppealContext(id:string|null|undefined):Appeal|null {return id?APPEAL_BY_ID[id]??null:null;}

const REACTIONS:Record<InitiativeId,{indicator:IndicatorId;metric:string;benefit:string;unresolved:string;tradeoff:string}>={
  M1:{indicator:'T2',metric:'access to public transport',benefit:'The bus gains priority in traffic. The journey becomes more predictable.',unresolved:'A lane alone does not change the timetable or make every approach to a stop safe.',tradeoff:'Road space must be redistributed. Bus lanes and LRT are incompatible within one plan.'},
  M2:{indicator:'T1',metric:'freedom from congestion',benefit:'Signals can respond to traffic at junctions in all five districts.',unresolved:'Adjusting traffic signals creates no new route and does not replace accessible dropped kerbs.',tradeoff:'This is a citywide measure. Compare its benefit with the local transport need.'},
  M3:{indicator:'T2',metric:'access to public transport',benefit:'The district gains a more reliable rail connection to other parts of the city.',unresolved:'People still need to reach the station; the final part of the journey and transfers require separate attention.',tradeoff:'LRT costs 30 units and has a four-quarter effect delay. It cannot share a plan with bus lanes.'},
  M4:{indicator:'E1',metric:'access to green spaces',benefit:'A place appears for short walks, rest and neighbourly meetings.',unresolved:'A small park adds no school places and does not remove heating emissions.',tradeoff:'In one district, a park and modular school compete for the same site: the model does not allow both.'},
  M5:{indicator:'E2',metric:'environmental quality',benefit:'Switching to clean fuel reduces the burden from heating private homes.',unresolved:'Other pollution sources remain. The switch requires home preparation and support for families.',tradeoff:'In the same district, this programme is incompatible with heating and water network upgrades.'},
  M6:{indicator:'E1',metric:'access to green spaces',benefit:'Windbreak planting connects exposed stretches across all districts.',unresolved:'Trees grow gradually and need care. Planting does not replace a switch to clean fuel in homes.',tradeoff:'The citywide programme has a four-quarter delay. Young planting does not become a mature forest on the day it is chosen.'},
  M7:{indicator:'S1',metric:'access to education',benefit:'A modular school and kindergarten add education facilities close to families.',unresolved:'The route to school remains a separate task. A new building does not mean every child already has a place.',tradeoff:'A school costs 24 units. A park cannot be selected in the same district; the school\'s effect has a three-quarter delay.'},
  M8:{indicator:'S2',metric:'access to healthcare',benefit:'A family clinic brings primary healthcare closer to residents.',unresolved:'Specialists, accessible approaches and appointment arrangements are needed. A building alone does not remove every queue.',tradeoff:'A clinic requires 20 units. In the model, its effect has a three-quarter delay.'},
  M9:{indicator:'S2',metric:'access to healthcare and active living',benefit:'Neighbours gain a dedicated place for regular courtyard activities.',unresolved:'The court supports activity, but cannot replace a school or clinic.',tradeoff:'A sports court costs less than a major facility, but contributes much less to social indicators.'},
  M10:{indicator:'B1',metric:'public safety',benefit:'Lighting makes the route easier to see; cameras support safety where justified.',unresolved:'Cameras do not fix dangerous crossing geometry. Lighting and equipment need maintenance.',tradeoff:'Sensible fields of view and privacy protection are needed. A camera does not prove that incidents have disappeared.'},
  M11:{indicator:'B2',metric:'road safety',benefit:'The pedestrian route gains safe crossings and school zones.',unresolved:'A safe crossing does not increase learning places or replace public transport.',tradeoff:'Greater safety slows car traffic: M11 has a negative contribution to T1.'},
  M12:{indicator:'C2',metric:'quality of city services',benefit:'Residents can better understand who is handling a request and what stage it has reached.',unresolved:'A quick reply is not a repaired pipe. Each request still needs checking and action.',tradeoff:'The platform covers all five districts, but does not perform physical works itself.'},
  M13:{indicator:'C1',metric:'utility network reliability',benefit:'Inspected sections of heating and water networks are upgraded.',unresolved:'Network repairs do not resolve every issue inside a building. Service restoration and reinstated surfaces still need checking.',tradeoff:'This costs 28 units with a four-quarter delay. In one district it cannot be combined with the clean-fuel programme.'},
  M14:{indicator:'C1',metric:'utility service reliability',benefit:'Crews and early warnings improve every district\'s readiness for faults.',unresolved:'A rapid callout does not replace planned upgrades to an ageing network.',tradeoff:'Service readiness helps the response, but cannot guarantee there will be no failures.'},
};
export type RelationKind='draft'|'considering'|'committed'|'calculated'|'partial'|'unresolved';
export interface AppealRelation {kind:RelationKind;label:string;description:string;indicator:IndicatorId;before:number|null;after:number|null;resultId:string|null;}
export function getAppealRelation(appeal:Appeal,state:AppState,mode?:ModeDefinition):AppealRelation {
  const primary=appeal.initiativeIds[0]!,reaction=mode?{...REACTIONS[primary],metric:mode.indicators[REACTIONS[primary].indicator],unresolved:mode.projects[primary].limitation}:REACTIONS[primary];
  const seasons=mode?.terms.seasons??'quarters',name=mode?.projects[primary].name??INITIATIVES[primary].name;
  const applies=(d:{initiativeId:InitiativeId;scope:string;districtId?:DistrictId|null},ids:readonly InitiativeId[])=>ids.includes(d.initiativeId)&&(d.scope==='citywide'||d.districtId===appeal.districtId);
  const committed=state.plan.some(d=>applies(d,[primary]));
  const related=state.plan.some(d=>applies(d,appeal.initiativeIds));
  const considering=!!state.candidate&&applies(state.candidate.decision,appeal.initiativeIds);
  const current=isCurrentResult(state.plan,state.revision,state.result)?state.result!.value:null;
  const before=current?.baseline[appeal.districtId][reaction.indicator]??null,after=current?.indicators[appeal.districtId][reaction.indicator]??null;
  let kind:RelationKind='draft',label='Awaiting a decision',description='There is no related decision in the current plan yet.';
  if(current){
    if(committed&&after!>before!){kind='calculated';label='Calculated effect';description=`After 8 ${seasons}: ${reaction.metric} ${number(before!)} → ${number(after!)}. This is a model indicator, not confirmation that the request has been fulfilled.`;}
    else if((after!>before!)||related){kind='partial';label='Partial support';description=`The plan addresses this need: ${reaction.metric} ${number(before!)} → ${number(after!)}. The request itself needs separate checking and action.`;}
    else {kind='unresolved';label='Issue remains';description=`The calculated outcome leaves this need unresolved: ${reaction.metric} ${number(before!)} → ${number(after!)}. ${reaction.unresolved}`;}
  }else if(committed){kind='committed';label='Programme in the plan';description=`«${name}» is included in the plan. The construction scene shows the choice; the outcome is evaluated over 8 ${seasons}.`;}
  else if(considering){kind='considering';label='Under consideration';description='A related project is selected for consideration. No decision has been made and no budget spent.';}
  else if(related){kind='partial';label='Related programme in the plan';description='The selected programme relates to this topic. This particular request needs inspection and separate actions.';}
  return {kind,label,description,indicator:reaction.indicator,before,after,resultId:current?.resultId??null};
}
const number=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:2});
export function getStoryConversation(story:LivingStory,state:AppState,answer:'opening'|'effect'|'remaining'='opening') {
  const appeal=APPEAL_BY_ID[story.appealId]!,relation=getAppealRelation(appeal,state),r=REACTIONS[story.initiativeId],item=INITIATIVES[story.initiativeId];
  const scoped=item.scope==='citywide'?'in all five districts':`in ${districtName(story.districtId)} district`;
  let text=story.opening;
  if(relation.kind==='considering')text=`You are considering «${item.name}» ${scoped}. ${r.benefit} For now, it is a proposal: our request remains open.`;
  if(relation.kind==='committed')text=`Our concern is now in the plan: «${item.name}» ${scoped}. ${r.benefit} Now we need to wait for the calculation and check what this decision does not cover.`;
  if(relation.kind==='calculated')text=`I see a change in our district calculation. ${relation.description} ${r.unresolved}`;
  if(relation.kind==='partial')text=`The plan partially supports our need. ${relation.description} ${r.unresolved}`;
  if(relation.kind==='unresolved')text=`Our request «${appeal.title}» is still relevant. ${relation.description}`;
  if(answer==='effect')text=`${r.benefit} Cost: ${item.cost} units, applying ${scoped}. Effect delay: ${item.lag} ${item.lag===1?'quarter':item.lag<5?'quarters':'quarters'}. ${r.tradeoff}${relation.resultId?' '+relation.description:''}`;
  if(answer==='remaining')text=r.unresolved+' '+r.tradeoff+' No official request is sent from here: this is a scenario for discussing a city plan.';
  return {text,relation,benefit:r.benefit,unresolved:r.unresolved};
}
