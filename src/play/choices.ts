import {BASELINE, CATALOGUE, INITIATIVES} from '../domain/scenario';
import type {DistrictId, InitiativeId, Plan, PolicyArea} from '../domain/types';
import {STORIES} from '../living/appeals';
import type {LivingStory} from '../living/appeals';
import {PROJECT_STORIES, projectAvailability} from '../features/project-insight';

/** Short editorial labels. All prices, feasibility and effects come from the model. */
export const PROJECT_NAMES:Record<InitiativeId,string>={M1:'Полоса для автобуса',M2:'Умные светофоры',M3:'Новая линия LRT',M4:'Парки и скверы',M5:'Чистое отопление',M6:'Зелёная защита',M7:'Школа и детский сад',M8:'Сеть поликлиник',M9:'Спортивный двор',M10:'Свет на улицах',M11:'Безопасный переход',M12:'Служба обращений',M13:'Надёжные сети',M14:'Аварийные бригады'};
export const SHORT_NEEDS:Record<InitiativeId,string>={
 M1:'Автобус снова стоит в пробке. Хочется успевать домой.',
 M2:'На зелёный не проехать: соседний перекрёсток стоит.',
 M3:'До работы одни пересадки. Нужен надёжный маршрут.',
 M4:'У дома негде присесть и поболтать с соседями.',
 M5:'Зимой дым от печей стоит между нашими домами.',
 M6:'От ветра не спрятаться. Хотелось бы больше деревьев.',
 M7:'Каждое утро везём детей в школу далеко от дома.',
 M8:'Обычный приём врача — целая поездка с пересадками.',
 M9:'Ребятам негде играть, не мешая проходить соседям.',
 M10:'После остановки идёшь домой через тёмный участок.',
 M11:'До школы близко. Но переходить дорогу страшно.',
 M12:'Заявку отправили. Кто за неё отвечает — непонятно.',
 M13:'Хочется, чтобы тепло и вода были без перебоев.',
 M14:'Тепло пропало. Когда приедет бригада — никто не знает.',
};
export const SHORT_LIMITS:Record<InitiativeId,string>={
 M1:'Новые маршруты и расписание — отдельная задача.',M2:'Новых автобусных маршрутов не появится.',M3:'Дорогой проект. Эффект начнётся через год.',
 M4:'В этом районе придётся выбирать: сквер или школа.',M5:'Остальные источники дыма останутся.',M6:'Деревьям нужны время и уход.',
 M7:'Безопасный путь до школы ещё нужно обустроить.',M8:'Для приёма нужны врачи и доступный подход.',M9:'Площадка не заменит школу или поликлинику.',
 M10:'Опасный переход сам по себе безопаснее не станет.',M11:'Машины поедут медленнее: свобода от пробок снизится.',
 M12:'Ответ службы ещё не означает выполненный ремонт.',M13:'Эффект начнётся через год. Стоимость — 28 единиц.',M14:'Быстрый выезд не заменит ремонт старых сетей.',
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
