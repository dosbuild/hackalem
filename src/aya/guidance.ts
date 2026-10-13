import type {AppState} from '../app/state';
import {editingPlan} from '../app/state';
import {applyEdit,summarizePlan} from '../domain/plan';
import {BASELINE,INITIATIVES,DISTRICTS} from '../domain/scenario';
import {INDICATOR_IDS} from '../domain/types';
import type {InitiativeId} from '../domain/types';
import {districtName,indicatorNames,issueMessage,format} from '../ui/copy';
import {observe,hasCurrentResult} from '../residents/engine';
import type {Resident} from '../residents/types';
export const LIMITS:Record<InitiativeId,string>={
 M1:'Полосы влияют на транспорт. Безопасный переход — отдельная задача. LRT и автобусные полосы несовместимы в одном плане.',
 M2:'Светофоры затрагивают пробки и дорожную безопасность во всех пяти районах. Доступность общественного транспорта этим проектом не меняется.',
 M3:'LRT влияет на транспорт и качество воздуха. Это не расчёт времени конкретной поездки. С автобусными полосами в одном плане не сочетается.',
 M4:'Сквер меняет обеспеченность зеленью, качество воздуха и общественную безопасность. Медицинская обеспеченность от него не меняется.',
 M5:'Чистое топливо влияет на воздух и коммунальные сети. Сквер даёт иной набор эффектов, включая обеспеченность зеленью. Это разные задачи.',
 M6:'Посадки затрагивают зелень и воздух во всех районах. Они не заменяют переоборудование домов на чистое топливо.',
 M7:'Здесь две задачи: учебные места и дорога до школы. Этот проект влияет на первую. Дорожная безопасность остаётся отдельным показателем.',
 M8:'Модель показывает изменение медицинской обеспеченности. Она не рассчитывает, сколько минут человек будет ждать приёма.',
 M9:'Дворовой спорт затрагивает три показателя небольшими эффектами. Он не равнозначен новой школе или поликлинике.',
 M10:'Освещение затрагивает общественную и дорожную безопасность. Это не прогноз числа происшествий для конкретного двора.',
 M11:'Безопасность дорог растёт, но свобода от пробок снижается. У одного решения есть польза и транспортный компромисс.',
 M12:'Платформа меняет обработку обращений. Она сама не заменяет тепловые и водопроводные сети.',
 M13:'Модернизация меняет состояние сетей и воздух. Обработка обращений — отдельная задача.',
 M14:'Бригады затрагивают сети и работу служб во всех пяти районах. Это не прогноз времени приезда к конкретному человеку.',
};
export interface Guidance {key:string;title:string;text:string;facts:string[];limitation:string;pose:'wait'|'notice'|'point'|'open'|'listen'|'compare';}
export function proposalGuidance(state:AppState):Guidance|null {
 const c=state.candidate;if(!c)return null;const plan=editingPlan(state);const item=INITIATIVES[c.decision.initiativeId];const preview=applyEdit(plan,c.replaces?{kind:'replace',target:c.replaces,decision:c.decision}:{kind:'add',decision:c.decision});
 const originalPlan=state.alternative?state.plan:plan;
 const oldId=state.alternative?originalPlan[state.alternative.slot]!.initiativeId:c.replaces;
 const old=oldId?INITIATIVES[oldId]:null;
 const scope=c.decision.scope==='citywide'?'все пять районов':c.decision.districtId?districtName(c.decision.districtId):'район ещё не выбран';
 return {key:`proposal:${state.revision}:${JSON.stringify(c)}`,title:preview.accepted?'Что именно изменит этот проект?':'Предложение нужно уточнить',pose:'point',
 text:preview.accepted?LIMITS[item.id]:preview.issues.map(issueMessage).join(' '),facts:[`Охват: ${scope}. Это одно из пяти решений.`, `Цена сейчас: ${item.cost} ед. Эффект начинает учитываться после ${item.lag} кв.; горизонт оценки — 8 кв. Это не срок строительства.`,...(old?[`Замена: ${old.name} (${old.cost} ед.) → ${item.name} (${item.cost} ед.).`, `Свободный бюджет: ${summarizePlan(originalPlan).remaining} → ${preview.accepted?summarizePlan(preview.plan).remaining:'без изменений'} ед. Охват до: ${originalPlan.find(d=>d.initiativeId===old.id)?.scope==='citywide'?'весь город':districtName((originalPlan.find(d=>d.initiativeId===old.id) as {districtId:Parameters<typeof districtName>[0]}).districtId)}; после: ${scope}.`]:[])],
 limitation:preview.accepted?'Это предложение на бумаге. Окружение изменится только после расчёта действующего плана.':`План и бюджет сохранены. ${LIMITS[item.id]}`};
}
export function reflection(state:AppState) {
 const touched=new Set(state.plan.flatMap(d=>INDICATOR_IDS.filter(k=>INITIATIVES[d.initiativeId].effects[k]!==undefined).flatMap(k=>(d.scope==='citywide'?DISTRICTS.map(x=>x.id):[d.districtId]).map(id=>`${id}:${k}`))));
 const untouched=DISTRICTS.flatMap(d=>INDICATOR_IDS.filter(k=>!touched.has(`${d.id}:${k}`)).map(k=>({districtId:d.id,indicatorId:k,value:BASELINE[d.id][k]}))).sort((a,b)=>a.value-b.value);
 return {touched:touched.size,untouched,summary:`План затрагивает ${touched.size} из 50 районных показателей. ${untouched[0]?`${districtName(untouched[0].districtId)}: ${indicatorNames[untouched[0].indicatorId]} (${untouched[0].value}) остаётся вне прямых эффектов выбранных проектов.`:'Все показатели затронуты хотя бы одним прямым эффектом.'}`};
}
export function returnGuidance(state:AppState,resident:Resident):Guidance|null {
 if(!hasCurrentResult(state))return null;const futureState={...state,comparisonPosition:1};const o=observe(resident,futureState);
 const touched=o.evidence.indicators.filter(i=>i.delta!==0);
 const text=o.treatment?'Мы вернулись к знакомому месту. Связанный проект вошёл в расчёт; новые детали сцены иллюстрируют его эффекты.':touched.length?'Мы начали здесь. Связанный проект здесь не выполнен, но другие решения затронули показатели района.':'Мы начали здесь. В вашем плане для этой задачи ничего не изменилось. Посмотрим, где изменения произошли.';
 return {key:`return:${state.revision}:${resident.id}`,title:`Снова здесь · ${resident.name}`,pose:'compare',text,facts:o.evidence.indicators.map(i=>`${indicatorNames[i.id]}: ${format(i.before)} → ${format(i.after)}${i.critical?' · ниже 40':''}`),limitation:o.evidence.limitation};
}
export function conclusion(state:AppState):string {
 if(!hasCurrentResult(state))return 'После изменения плана прежний результат больше не действует. Нужен новый расчёт.';
 const r=state.result!.value;const critical=r.criticalPairs[0];
 if(critical)return `Открытый вопрос: ${districtName(critical.districtId)} — ${indicatorNames[critical.indicatorId]}: ${format(critical.value)}, ниже 40. Что изменится, если направить сюда одно из пяти решений?`;
 const untouched=reflection(state).untouched[0];return untouched?`Открытый вопрос: ${districtName(untouched.districtId)} — ${indicatorNames[untouched.indicatorId]} остался без прямого эффекта. Хотите проверить другой охват плана?`:'Показателей ниже 40 нет. Как изменится результат, если перенести одно районное решение?';
}
