import {BASELINE, CATALOGUE, INITIATIVES} from '../domain/scenario';
import type {DistrictId, InitiativeId, Plan, PolicyArea} from '../domain/types';
import {STORIES} from '../living/appeals';
import type {LivingStory} from '../living/appeals';
import {PROJECT_STORIES, projectAvailability} from '../features/project-insight';

/** Short editorial labels. All prices, feasibility and effects come from the model. */
export const PROJECT_NAMES:Record<InitiativeId,string>={M1:'Dedicated bus lane',M2:'Smart traffic signals',M3:'New line: LRT',M4:'Parks and squares',M5:'Clean heating',M6:'Green shelter',M7:'School and kindergarten',M8:'Local clinics',M9:'Courtyard sports',M10:'Street lighting',M11:'Safe crossings',M12:'Resident request service',M13:'Reliable utilities',M14:'Emergency crews'};
export const SHORT_NEEDS:Record<InitiativeId,string>={
 M1:'The bus is stuck in traffic again. I want to get home on time.',
 M2:'The light is green, but the next junction is blocked.',
 M3:'Getting to work means so many transfers. We need a reliable route.',
 M4:'There is nowhere near home to sit and chat with neighbours.',
 M5:'In winter, smoke from stoves hangs between our homes.',
 M6:'There is no shelter from the wind. We need more trees.',
 M7:'Every morning, we drive the children to a school far from home.',
 M8:'A routine doctor visit means a long trip with transfers.',
 M9:'The children need somewhere to play without blocking the neighbours.',
 M10:'The walk home from the bus stop crosses a dark stretch.',
 M11:'School is nearby. But crossing the road feels dangerous.',
 M12:'We submitted a request. Who is responsible for it?',
 M13:'We want reliable heat and water.',
 M14:'The heating has stopped. Nobody knows when the crew will arrive.',
};
export const SHORT_LIMITS:Record<InitiativeId,string>={
 M1:'New routes and timetables are a separate task.',M2:'This will not create new bus routes.',M3:'An expensive project. Effects begin after a year.',
 M4:'This district must choose between a park and a school.',M5:'Other sources of smoke will remain.',M6:'Trees need time and care.',
 M7:'A safe route to school still needs to be built.',M8:'Appointments need doctors and accessible entrances.',M9:'A sports area cannot replace a school or clinic.',
 M10:'A dangerous crossing will still need attention.',M11:'Cars will move more slowly: traffic flow will decrease.',
 M12:'A service response does not mean the repair is complete.',M13:'Effects begin after a year. Cost: 28 units.',M14:'A fast response cannot replace repairs to old utilities.',
};
// Authored follow-up concerns. These never imply extra numerical synergies.
const FOLLOW_UPS:Partial<Record<InitiativeId,InitiativeId>>={M1:'M2',M2:'M11',M3:'M10',M4:'M9',M5:'M6',M6:'M5',M7:'M11',M8:'M10',M9:'M10',M10:'M12',M11:'M10',M12:'M14',M13:'M14',M14:'M13'};
const ORDER:readonly InitiativeId[]=['M1','M4','M7','M10','M12','M8','M6','M11','M14','M5','M9','M2','M13','M3'];
export interface Choice {story:LivingStory; initiativeId:InitiativeId; districtId:DistrictId;}

/** A varied, feasible invitation, not a score optimizer. No choice is applied here. */
export function availableChoices(plan:Plan, district:DistrictId|null=null,stories:readonly LivingStory[]=STORIES,opening:readonly InitiativeId[]=[]):Choice[] {
 const chosen=new Set(plan.map(d=>d.initiativeId)),last=plan.at(-1),followUp=last?FOLLOW_UPS[last.initiativeId]:undefined;
 const base=plan.length?ORDER:[...opening,...ORDER.filter(id=>!opening.includes(id))];
 const order=followUp?[followUp,...base.filter(id=>id!==followUp)]:base;
 return order.filter(id=>!chosen.has(id)).flatMap(id=>{
  const availability=projectAvailability(plan,id,district);
  if(!availability.available)return [];
  const local=stories.filter(s=>s.initiativeId===id&&(INITIATIVES[id].scope==='citywide'||availability.choices.some(c=>c.available&&c.districtId===s.districtId)));
  const place=district??(id===followUp&&last?.scope==='district'?last.districtId:null);
  const openingPlace=!plan.length&&opening.length?(id==='M5'?'almaty':'esil'):null;
  const preferred=local.find(s=>s.districtId===(place??openingPlace));
  const story=preferred??local.sort((a,b)=>BASELINE[a.districtId][PROJECT_STORIES[id].indicator]-BASELINE[b.districtId][PROJECT_STORIES[id].indicator])[0];
  return story?[{story,initiativeId:id,districtId:story.districtId}]:[];
 });
}
export function choicePage(choices:readonly Choice[],page:number,count=3):Choice[] {
 if(!choices.length)return [];
 // Visit every starting point, including pools divisible by three. Otherwise
 // diversity filtering can leave a project permanently outside the deck.
 const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;
 let step=count;while(gcd(step,choices.length)!==1)step++;
 const offset=(((page*step)%choices.length)+choices.length)%choices.length,rotated=[...choices.slice(offset),...choices.slice(0,offset)];
 const selected:Choice[]=[],areas=new Set<PolicyArea>();
 for(const choice of rotated){const area=INITIATIVES[choice.initiativeId].area;if(areas.has(area))continue;selected.push(choice);areas.add(area);if(selected.length===count)return selected;}
 for(const choice of rotated){if(!selected.includes(choice))selected.push(choice);if(selected.length===count)break;}
 return selected;
}
export const projectCount=CATALOGUE.length;
