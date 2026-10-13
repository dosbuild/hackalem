import {applyEdit} from '../domain/plan';
import {hasCompletion} from '../domain/planning-search';
import {DISTRICTS, INITIATIVES, SYNERGIES, INCOMPATIBILITIES} from '../domain/scenario';
import type {CandidateDecision, CitywideInitiativeId, DistrictId, DistrictInitiativeId, IndicatorId, InitiativeId, Plan, ValidationIssue} from '../domain/types';

/** Editorial context only. Prices, effects, compatibility and feasibility stay in the model. */
export const PROJECT_STORIES:Record<InitiativeId,{benefit:string;limitation:string;indicator:IndicatorId;need:string}>= {
  M1:{benefit:'Автобусу — свой путь через пробки.',limitation:'Расписание и безопасный подход к остановке потребуют отдельного внимания.',indicator:'T2',need:'Общественный транспорт'},
  M2:{benefit:'Согласовать движение на перекрёстках всего города.',limitation:'Светофоры не создают новые маршруты общественного транспорта.',indicator:'T1',need:'Свобода от пробок'},
  M3:{benefit:'Дать району новую рельсовую связь.',limitation:'К станции ещё нужно добраться. Это один из самых дорогих и медленных проектов.',indicator:'T2',need:'Общественный транспорт'},
  M4:{benefit:'Место для прогулок и встреч рядом с домом.',limitation:'Парк не решает нехватку школ и медицинской помощи.',indicator:'E1',need:'Обеспеченность зеленью'},
  M5:{benefit:'Меньше дыма от отопления частных домов.',limitation:'Другие источники загрязнения остаются. Семьям потребуется подготовить дома.',indicator:'E2',need:'Качество воздуха'},
  M6:{benefit:'Больше зелени и защиты от ветра во всех районах.',limitation:'Посадкам нужны время и уход; они не заменяют чистое отопление.',indicator:'E1',need:'Обеспеченность зеленью'},
  M7:{benefit:'Больше учебных мест рядом с семьями.',limitation:'Дорога до школы и её безопасность остаются отдельной задачей.',indicator:'S1',need:'Школы и детские сады'},
  M8:{benefit:'Первичная медицинская помощь ближе к дому.',limitation:'Нужны специалисты и организация приёма. Модель не предсказывает длину очереди.',indicator:'S2',need:'Первичная медицина'},
  M9:{benefit:'Двор, где можно двигаться и встречаться.',limitation:'Небольшая поддержка трёх показателей; полноценную школу или поликлинику не заменит.',indicator:'S2',need:'Первичная медицина'},
  M10:{benefit:'Свет на вечернем пути и более обозримые улицы.',limitation:'Освещение не исправляет опасную геометрию перехода.',indicator:'B1',need:'Безопасность улиц'},
  M11:{benefit:'Безопаснее перейти дорогу и дойти до школы.',limitation:'Компромисс: автомобили движутся медленнее, поэтому свобода от пробок снижается.',indicator:'B2',need:'Безопасность дорог'},
  M12:{benefit:'Понятнее путь обращения от вопроса до ответа.',limitation:'Быстрый ответ сам по себе не ремонтирует трубу и не закрывает обращение.',indicator:'C2',need:'Скорость решения обращений'},
  M13:{benefit:'Надёжнее тепло и вода в выбранном районе.',limitation:'Дорогой проект с отложенным эффектом. Внутридомовые проблемы могут сохраниться.',indicator:'C1',need:'Надёжность сетей'},
  M14:{benefit:'Городские службы лучше готовы к неполадкам.',limitation:'Быстрый выезд не заменяет плановую модернизацию сетей.',indicator:'C1',need:'Надёжность сетей'},
};

export function projectDecision(id:InitiativeId,district:DistrictId|null):CandidateDecision {
  return INITIATIVES[id].scope==='citywide'
    ? {initiativeId:id as CitywideInitiativeId,scope:'citywide'}
    : {initiativeId:id as DistrictInitiativeId,scope:'district',districtId:district};
}

/** Inspect all district choices so a local conflict never hides a project viable elsewhere. */
export function projectAvailability(plan:Plan,id:InitiativeId,district:DistrictId|null,replaces:InitiativeId|null=null) {
  const inspect=(place:DistrictId|null)=>{
    const decision=projectDecision(id,place);
    const edit=applyEdit(plan,replaces?{kind:'replace',target:replaces,decision}:{kind:'add',decision});
    const issues:readonly ValidationIssue[]=edit.accepted?(hasCompletion(edit.plan)?[]:[{code:'stranded'}]):edit.issues;
    return {districtId:place,available:issues.length===0,issues};
  };
  const choices=INITIATIVES[id].scope==='citywide'?[inspect(null)]:DISTRICTS.map(d=>inspect(d.id));
  const selected=choices.find(c=>c.districtId===district)??(INITIATIVES[id].scope==='citywide'?choices[0]:undefined);
  return {choices,selected,available:choices.some(c=>c.available),elsewhere:!!selected&&!selected.available&&choices.some(c=>c.available)};
}

export function projectConnections(id:InitiativeId,plan:Plan,district:DistrictId|null,replaces:InitiativeId|null=null) {
  const others=plan.filter(d=>d.initiativeId!==replaces&&d.initiativeId!==id);
  const synergies=SYNERGIES.filter(s=>s.ids.includes(id)).map(s=>{
    const partnerId=s.ids.find(other=>other!==id)!;
    const partner=others.find(d=>d.initiativeId===partnerId);
    return {...s,partnerId,active:!!partner,districtId:id===s.ids[0]?district:partner?.scope==='district'?partner.districtId:null};
  });
  const conflicts=INCOMPATIBILITIES.filter(c=>c.ids.includes(id)).map(c=>({
    ...c,partnerId:c.ids.find(other=>other!==id)!,
  }));
  return {synergies,conflicts};
}
