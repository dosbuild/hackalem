import {corePresentation} from './presentation';
import type {CorePresentation} from './presentation';
import {members as historicalMembers,openings as historicalOpenings} from '../modes/khanate/council';
import { BASELINE_ASSESSMENT, evaluatePlan } from '../domain/evaluate';
import { planFingerprint } from '../domain/identity';
import { DISTRICTS, WEIGHTS } from '../domain/scenario';
import { INDICATOR_IDS } from '../domain/types';
import type { Plan, ScenarioResult } from '../domain/types';
import type { Amendment, CouncilEvent, CouncilSession, Member, MemberId, MetricImpact, PackageCheck, Vote } from '../dashboard/types';
import { number, signed } from '../dashboard/format';
import { allSwaps } from './review';

export const COUNCIL_RULES_VERSION='priorities-2';
export const MEMBERS:Member[]=[
 {id:'transport',name:'Данияр',title:'Транспорт',initials:'Д',focus:'Путь до школы и работы'},
 {id:'environment',name:'Амина',title:'Экология',initials:'А',focus:'Воздух и зелёные улицы'},
 {id:'social',name:'Мадина',title:'Социальная сфера',initials:'М',focus:'Места в школах и доступ к врачу'},
 {id:'safety',name:'Тимур',title:'Безопасность',initials:'Т',focus:'Безопасные дворы и переходы'},
 {id:'municipal',name:'Ерлан',title:'Городское хозяйство',initials:'Е',focus:'Надёжность сетей и обратная связь'},
 {id:'ombudsman',name:'Сауле',title:'Омбудсмен районов',initials:'С',focus:'Районы, которые остаются позади'},
 {id:'finance',name:'Руслан',title:'Финансы',initials:'Р',focus:'Польза каждой единицы бюджета'},
 {id:'chair',name:'Алия',title:'Председатель',initials:'А',focus:'Общий результат и открытые разногласия'},
];
const roleIndicators:Record<string,string[]>= {transport:['T1','T2'],environment:['E1','E2'],social:['S1','S2'],safety:['B1','B2'],municipal:['C1','C2']};
export function councilMetrics(result:ScenarioResult):Record<MemberId,number> {
 const value={} as Record<MemberId,number>;
 for(const [role,keys] of Object.entries(roleIndicators))value[role as MemberId]=DISTRICTS.reduce((n,d)=>n+d.populationShare*INDICATOR_IDS.filter(k=>keys.includes(k)).reduce((v,k)=>v+WEIGHTS[k]*result.indicators[d.id][k],0),0);
 value.ombudsman=result.weakestValue-result.criticalPairs.length;
 value.finance=10*result.scoreChange/result.summary.spent;
 return value;
}
export function impacts(before:ScenarioResult,after:ScenarioResult):MetricImpact[] {
 const original=councilMetrics(before),next=councilMetrics(after);
 return (MEMBERS.filter(m=>m.id!=='chair') as (Member&{id:MemberId})[]).map(m=>({member:m.id,before:original[m.id],after:next[m.id],delta:next[m.id]-original[m.id]}));
}
export function votes(before:ScenarioResult,after:ScenarioResult):Vote[] {
 return impacts(before,after).map(impact=>{
  const newCritical=impact.member!=='finance'&&after.criticalPairs.some(pair=>(impact.member==='ombudsman'||roleIndicators[impact.member]?.includes(pair.indicatorId))&&before.indicators[pair.districtId][pair.indicatorId]>=40);
  const vote=newCritical||impact.delta<=-.1+1e-10?'against':impact.delta<-1e-10?'abstain':'for';
  return {...impact,vote,reason:newCritical?'Появляется новый показатель ниже 40.':vote==='against'?`Результат направления снижается на ${number(-impact.delta)}.`:vote==='abstain'?'Небольшое снижение; требуется наблюдение.':impact.delta>1e-9?`Результат направления растёт на ${number(impact.delta)}.`:'Результат направления сохраняется.'};
 });
}
export function checkPackage(plan:Plan,amendments:Amendment[],ids:string[]):PackageCheck {
 const invalid=(reason:string):PackageCheck=>({valid:false,ids,reason,plan:null,score:null,cost:null,impacts:[],votes:[]});
 if(new Set(ids).size!==ids.length)return invalid('Поправка выбрана несколько раз.');
 const changes=ids.map(id=>amendments.find(a=>a.id===id));if(changes.some(a=>!a))return invalid('Неизвестная поправка.');
 const selected=changes as Amendment[];
 if(new Set(selected.map(a=>a.replace.initiativeId)).size!==selected.length)return invalid('Две поправки заменяют одно решение. Выберите одну.');
 const candidate=plan.map(d=>selected.find(a=>a.replace.initiativeId===d.initiativeId)?.with??d);
 const before=evaluatePlan(plan),after=evaluatePlan(candidate);
 if(!before.ok||!after.ok)return invalid('Вместе поправки нарушают бюджет, уникальность решений, лимит направления или конфликт на одном месте. Выберите другой пакет.');
 return {valid:true,ids,reason:null,plan:after.result.plan,score:after.result.finalScore,cost:after.result.summary.spent,impacts:impacts(before.result,after.result),votes:votes(before.result,after.result)};
}
const openings:Record<MemberId,string>={
 transport:'Дорога связывает возможности города. Проверяю, станет ли проще добраться до учёбы и работы.',
 environment:'Зелёная улица и чистый воздух нужны каждый день. Рост общего балла не должен скрывать потери для среды.',
 social:'За показателями стоят семьи, которым нужны места в школе и приём у врача. Эти потребности нельзя считать взаимозаменяемыми.',
 safety:'Меня интересует не число объектов, а безопасность пути. Обращаю внимание и на отрицательные эффекты для транспорта.',
 municipal:'Город должен работать и в обычный день, и при аварии. Проверяю сети и возможность быть услышанным.',
 ombudsman:'Среднее по городу может расти, пока один район остаётся позади. Мой приоритет — слабейший район и критические показатели.',
 finance:'Не обязательно потратить всё. Сравниваю прирост результата на бюджет, но экономия сама по себе баллов не даёт.',
};
/** Adapted hackathon council: distinct metric briefs, objections, revalidated packages and deterministic votes. */
export function buildCouncil(plan:Plan,id:string,createdAt:string,mode?:CorePresentation):CouncilSession {
 const {decisionLabel,unit,seasons}=corePresentation(mode);
 const members=mode?.id==='khanate'?historicalMembers:MEMBERS,voices=mode?.id==='khanate'?historicalOpenings:openings;
 const outcome=evaluatePlan(plan);if(!outcome.ok)throw new Error('invalid_plan');const original=outcome.result;
 const available=allSwaps(original.plan).map(s=>{const r=evaluatePlan(s.plan);if(!r.ok)throw new Error('invalid_swap');return{...s,impacts:impacts(original,r.result)};});
 const amendments:Amendment[]=[],events:CouncilEvent[]=[];
 const emit=(event:Omit<CouncilEvent,'seq'|'source'>)=>events.push({...event,seq:events.length+1,source:'local'});
 emit({type:'opening',member:'chair',text:`Обсудим пять решений стоимостью ${original.summary.spent} ${unit} Итог через восемь ${seasons} — ${number(original.finalScore)}. Сначала позиции участников, затем поправки и голосование. Все участники — вымышленные роли учебного совета.`});
 for(const member of members.filter(m=>m.id!=='chair')) {
  const role=member.id as MemberId;
  // A council represents conflicting priorities, including alternatives to the
  // score optimum. Never suppress a district/sector gain merely for losing score.
  const candidate=available.filter(a=>a.impacts.find(i=>i.member===role)!.delta>1e-9).sort((a,b)=>b.impacts.find(i=>i.member===role)!.delta-a.impacts.find(i=>i.member===role)!.delta||b.gain-a.gain)[0];
  if(candidate&&!amendments.some(a=>a.id===candidate.id))amendments.push({...candidate,proposer:role});
  emit({type:'speech',member:role,text:`${voices[role]} ${candidate?`Предлагаю: ${decisionLabel(candidate.replace)} → ${decisionLabel(candidate.with)}. Общий балл ${signed(candidate.gain)}, стоимость плана ${candidate.cost} ${unit}${candidate.gain<0?' Я предлагаю пожертвовать частью общего балла ради улучшения моего направления. Эта потеря должна остаться видимой.':''}`:'Среди замен одного решения нет варианта, который улучшает мой показатель. Сохраним достигнутое.'}`,...(candidate?{amendmentId:candidate.id}:{})});
 }
 for(const a of amendments)emit({type:'amendment',member:a.proposer,text:`Поправка проверена: ${decisionLabel(a.with)}. Изменение балла ${signed(a.gain)}.`,amendmentId:a.id});
 const leader=[...amendments].sort((a,b)=>b.gain-a.gain)[0];
 if(leader){
  const opponents=leader.impacts.filter(i=>i.delta< -1e-9).sort((a,b)=>a.delta-b.delta);
  for(const opponent of opponents)emit({type:'objection',member:opponent.member,text:`Возражаю против замены «${decisionLabel(leader.replace)}»: мой показатель изменится с ${number(opponent.before)} до ${number(opponent.after)} (${signed(opponent.delta)}). Общий выигрыш не отменяет этой потери.`,amendmentId:leader.id});
  if(opponents.length)emit({type:'response',member:leader.proposer,text:`Потеря остаётся в протоколе. Я предлагаю эту замену ради общего прироста ${signed(leader.gain)}, но окончательное решение принимает автор плана. Можно собрать другой пакет.`,amendmentId:leader.id});
 }
 const packages:PackageCheck[]=[];
 // At most seven proposals: test every package, not merely each amendment in isolation.
 for(let mask=0;mask<2**amendments.length;mask++){const check=checkPackage(original.plan,amendments,amendments.filter((_,i)=>mask&(1<<i)).map(a=>a.id));if(check.valid)packages.push(check);}
 const majority=packages.filter(p=>p.votes.filter(v=>v.vote==='for').length>=4);
 const recommendation=[...majority].sort((a,b)=>b.score!-a.score!||a.ids.length-b.ids.length)[0]??checkPackage(original.plan,amendments,[]);
 emit({type:'package',member:'chair',text:`Проверено допустимых пакетов: ${packages.length}. Рекомендован ${recommendation.ids.length?`пакет из ${recommendation.ids.length} поправок`:'исходный план'}: балл ${number(recommendation.score!)}, стоимость ${recommendation.cost} ${unit} Требуется большинство — не менее четырёх голосов.`});
 for(const vote of recommendation.votes)emit({type:'vote',member:vote.member,text:`${vote.vote==='for'?'За':vote.vote==='against'?'Против':'Воздержался'}. ${vote.reason}`});
 const against=recommendation.votes.filter(v=>v.vote==='against');
 const summary=`${recommendation.ids.length?'Совет рекомендует проверенный пакет поправок.':'Совет рекомендует сохранить исходный план.'} Балл ${number(original.finalScore)} → ${number(recommendation.score!)}. За: ${recommendation.votes.filter(v=>v.vote==='for').length} из 7.${against.length?` Особое мнение: ${against.map(v=>members.find(m=>m.id===v.member)!.title).join(', ')}.`:''} Применение остаётся за вами.`;
 emit({type:'protocol',member:'chair',text:summary});emit({type:'closed',member:'chair',text:'Запись сохранена. Можно пересмотреть обсуждение, сравнить пакет или вернуться к жителям.'});
 return {...(mode?{worldMode:mode.id}:{}),rulesVersion:COUNCIL_RULES_VERSION,id,fingerprint:planFingerprint(original.plan),plan:original.plan,score:original.finalScore,createdAt,status:'complete',members,events,amendments,recommendation,summary,mode:'local',originalAssessment:original};
}
export const BASE_SCORE=BASELINE_ASSESSMENT.finalScore;
