import {assistantPresentation} from './presentation';
import type {ModeId} from '../modes/types';
import {evaluatePlan, realizedEffect} from '../domain/evaluate';
import {planFingerprint} from '../domain/identity';
import {summarizePlan} from '../domain/plan';
import {BASELINE,INITIATIVES,RULES,SYNERGIES,INCOMPATIBILITIES} from '../domain/scenario';
import {DISTRICT_IDS,INDICATOR_IDS,INITIATIVE_IDS} from '../domain/types';
import type {DistrictId,InitiativeId} from '../domain/types';
import type {AssistantReply,AyaContext,AyaFact,AyaIntent} from './types';
import {signed} from '../ui/copy';

export const districtName=(id:DistrictId|null)=>assistantPresentation().districtName(id);
export const projectName=(id:InitiativeId)=>INITIATIVES[id].name;
const number=(v:number)=>v.toLocaleString('ru-RU',{maximumFractionDigits:2});
export function contextFacts(context:AyaContext):AyaFact[] {
 const {CATALOGUE,DISTRICTS,PROJECT_STORIES,indicatorNames,projectName,districtName,unitFor,quarter,quarterGen,quarterPrep,quarters,seasons,season}=assistantPresentation(context.worldMode);
 const summary=summarizePlan(context.plan);
 const facts:AyaFact[]=[{id:'budget',text:`В плане ${summary.count}/${RULES.decisionCount} решений. Потрачено ${summary.spent} ${unitFor(summary.spent)}, осталось ${summary.remaining} ${unitFor(summary.remaining)}`},
  {id:'rules',text:`Пять разных инициатив, до двух в одной сфере, бюджет ${RULES.budget} ${unitFor(RULES.budget)}. Расчёт — ${RULES.horizon} ${seasons}.`}];
 for(const project of CATALOGUE){
  facts.push({id:`project:${project.id}`,text:`${project.name}: ${project.cost} ${unitFor(project.cost)}; ${project.scope==='citywide'?'для всего города':`для выбранного ${quarterGen}`}. Эффект — с ${project.lag+1}-го ${season}; итог через ${RULES.horizon} ${seasons}.`});
  facts.push({id:`effects:${project.id}`,text:`Вклад за два года${project.scope==='citywide'?` в каждом ${quarterPrep}`:''}: ${INDICATOR_IDS.filter(k=>project.effects[k]!==undefined).map(k=>`${indicatorNames[k]} ${signed(realizedEffect(project.effects[k]!,project.lag))}`).join('; ')}. Задержка учтена. Бонусы сочетаний и границы 0–100 применяются при расчёте плана.`});
  const conflicts=INCOMPATIBILITIES.filter(c=>c.ids.includes(project.id)).map(c=>`Не сочетается с «${projectName(c.ids.find(id=>id!==project.id)!)}» ${c.scope==='plan'?'в одном плане':`в том же ${quarterPrep}`}.`);
  facts.push({id:`limits:${project.id}`,text:[PROJECT_STORIES[project.id].limitation,...conflicts].join(' ')});
  if(project.scope==='district'){
   const story=PROJECT_STORIES[project.id],ordered=DISTRICTS.slice().sort((a,b)=>BASELINE[a.id][story.indicator]-BASELINE[b.id][story.indicator]);
   facts.push({id:`need:${project.id}`,text:`${story.need}, исходные значения: ${ordered.map(d=>`${d.name} ${number(BASELINE[d.id][story.indicator])}/100`).join('; ')}. Ниже — острее потребность. Это сравнение потребностей, а не рейтинг итоговых планов.`});
  }
 }
 for(const d of DISTRICTS){
  const weakest=INDICATOR_IDS.slice().sort((a,b)=>BASELINE[d.id][a]-BASELINE[d.id][b]).slice(0,3);
  facts.push({id:`district:${d.id}`,text:`${d.name}, исходные потребности: ${weakest.map(k=>`${indicatorNames[k]} ${number(BASELINE[d.id][k])}/100`).join('; ')}. Чем ниже показатель, тем острее потребность в учебной модели.`});
 }
 for(const synergy of SYNERGIES)facts.push({id:`synergy:${synergy.ids.join('+')}`,text:`${synergy.ids.map(projectName).join(' + ')}: дополнительно ${signed(synergy.amount)} к показателю «${indicatorNames[synergy.indicatorId]}» в ${quarterPrep} проекта «${projectName(synergy.ids[0])}». Бонус не уменьшается из-за задержки.`});
 if(context.plan.length)facts.push({id:'plan',text:context.plan.map(d=>`${projectName(d.initiativeId)} — ${d.scope==='district'?districtName(d.districtId):'весь город'}`).join('; ')});
 const result=evaluatePlan(context.plan);
 if(result.ok){
  facts.push({id:'result',text:`Оценка плана ${number(result.result.finalScore)}; изменение от исходного города ${signed(result.result.scoreChange)}. Слабейшие ${quarters}: ${result.result.weakestDistricts.map(districtName).join(', ')}.`});
  facts.push({id:'result:critical',text:result.result.criticalPairs.length?`Ниже порога 40 остаются: ${result.result.criticalPairs.map(p=>`${districtName(p.districtId)} — ${indicatorNames[p.indicatorId]} ${number(p.value)}`).join('; ')}.`:'Показателей ниже критического порога 40 не осталось. Это не означает, что все потребности жителей решены.'});
  const negative=result.result.indicatorEvidence.filter(e=>e.change<0);
  if(negative.length)facts.push({id:'result:tradeoffs',text:`Снижение показателей: ${negative.map(e=>`${districtName(e.districtId)} — ${indicatorNames[e.indicatorId]} ${number(e.baseline)} → ${number(e.updated)}`).join('; ')}.`});
 }
 if(context.appeal)facts.push({id:'appeal',text:`Обращение «${context.appeal.title}», ${quarter} ${districtName(context.appeal.districtId)}. Инициативы для рассмотрения: ${context.appeal.initiativeIds.map(projectName).join('; ')}. Принятие проекта само по себе не закрывает обращение.`});
 return facts;
}

const projectWords:readonly [InitiativeId,RegExp][]=[
 ['M11',/переход|пешеход|школьн.{0,8}зон|безопас.{0,12}(путь|дорог)/i],['M7',/школ|детск.{0,8}сад|мест.{0,12}(уч[её]б|обуч)/i],['M8',/поликлиник|здравоохр|медицин|врач/i],['M3',/\blrt\b|лрт|легкорельс/i],['M1',/автобус|полос/i],['M2',/светофор/i],
 ['M4',/парк|сквер/i],['M5',/топлив|угол|угл[её]|дым|отоплен.{0,15}дом/i],['M6',/озелен|посадк|ветрозащит|дерев/i],['M9',/спорт|тренаж[её]р|дворов/i],['M10',/освещ|камер|фонар|темн/i],['M12',/платформ.{0,12}обращ|цифров.{0,12}обращ/i],['M13',/сет[ьи]|труб|водопровод|теплосет/i],['M14',/авари|бригад|предупрежден/i]];
const historicalProjectWords:readonly [InitiativeId,RegExp][]=[
 ['M11',/безопас.{0,12}(переход|путь)|детск.{0,10}переход/i],['M7',/учебн.{0,5}юрт|уч[её]б|наставниц/i],['M8',/лекар|лечебн/i],['M3',/караванн.{0,8}дорог|постоял/i],['M1',/обозн.{0,5}путь|путь.{0,8}обоз|отдельн.{0,6}путь/i],['M2',/распорядител/i],['M4',/общ.{0,5}сад|тен.{0,5}сад/i],['M5',/дым|очаг/i],['M6',/рощ|ветрозащит/i],['M9',/игр|состязан/i],['M10',/фонар|ночн.{0,6}страж/i],['M12',/дом.{0,5}прошен|гонц|писар/i],['M13',/зимов|колодц/i],['M14',/артел|сигнальн/i],
];
const districts:readonly [DistrictId,RegExp][]=[['nura',/нур[аыуе]/i],['esil',/есил|есыл/i],['almaty',/алмат/i],['saryarka',/сарыар/i],['baikonur',/байкон|байқо/i]];
export function mentionedProject(text:string,mode:ModeId='astana'):InitiativeId|null {
 return mentionedProjects(text,mode)[0]??null;
}
export function mentionedDistrict(text:string,mode:ModeId='astana'):DistrictId|null {if(mode==='khanate'){const exact=assistantPresentation(mode).DISTRICTS.find(d=>text.toLocaleLowerCase('ru').includes(d.name.toLocaleLowerCase('ru')));if(exact)return exact.id;for(const [id,pattern] of [['esil',/речн.{0,6}берег|у реки/i],['almaty',/мастер|ремесл/i],['baikonur',/караванн.{0,5}ворот/i],['nura',/пастбищ|нурин/i]] as const)if(pattern.test(text))return id;}return districts.find(([,pattern])=>pattern.test(text))?.[0]??null;}
function mentionedProjects(text:string,mode:ModeId='astana'):InitiativeId[] {
 const {CATALOGUE}=assistantPresentation(mode);
 const found=new Set<InitiativeId>();
 let rest=text.toLocaleLowerCase('ru-RU');
 for(const match of rest.matchAll(/\bm(1[0-4]|[1-9])\b/g))found.add(`M${match[1]}` as InitiativeId);
 // Exact catalogue names own their words: a clean-fuel "transition" is not a crossing.
 for(const project of CATALOGUE){const name=project.name.toLocaleLowerCase('ru-RU');if(rest.includes(name)){found.add(project.id);rest=rest.replaceAll(name,' ');}}
 // Inspect the whole remaining sentence. "A park next to a school" names two
 // projects even without "and"; a clarification is safer than choosing one.
 for(const [id,pattern] of (mode==='khanate'?historicalProjectWords:projectWords))if(pattern.test(rest))found.add(id);
 return [...found];
}
function requestsSeveralProjects(text:string,mode:ModeId='astana'):boolean {return mentionedProjects(text,mode).length>1;}
/** Deliberately conservative: an explanatory question must never spend money. */
export function authorizesAction(text:string):boolean {
 if(/\?|(?:^|\s)(?:не|без)\s|отмен|не\s*(?:надо|нужно|хочу)|что\s+(даст|будет|лучше|измен)|сколько|почему|зачем|расскажи|объясни|сравн|понять|разобраться|подумать|обсуд|посоветуй|покажи\s+(цен|эффект|последств)|можно ли|стоит ли|если|как\s+(постро|добав|выбрать|сделать)/i.test(text))return false;
 return /открой|построй|строим|добавь|включи|сделай|займись|помоги|реши|доведи|заверши|дополни|собери|составь|прими|запусти|хочу\s+(постро|добав|школ|парк|поликлиник)/i.test(text);
}
export function parseSupportedIntent(text:string,context:AyaContext):AyaIntent|null {
 if(/(?:открой|покажи|перейди|перейдём|перейдем).*(?:совет|совещан)/i.test(text))return {kind:'navigate',space:'dashboard',section:'council'};
 if(/(?:открой|покажи|перейди).*(?:дашборд|разбор|аналити|результат|летопис)/i.test(text))return {kind:'navigate',space:'dashboard',section:'review'};
 if(!mentionedProject(text,context.worldMode)&&/(?:открой|покажи|перейди|пойдём|пойдем).*(?:жител|обращени|прошени)/i.test(text))return {kind:'navigate',space:'residents'};
 if(/(?:открой|покажи|перейди).*(?:карт[ау]|город)/i.test(text))return {kind:'navigate',space:'map'};
 const refersToAppeal=/с\s+(?:этим\s+)?(?:обращением|прошением)|этим\s+(?:вопросом|запросом)|этой\s+просьбой/i.test(text)
   &&!!context.appeal&&(!text.includes('«')||text.includes(`«${context.appeal.title}»`));
 const commandText=refersToAppeal?text.replace(/«[^»]*»/g,'обращение'):text;
 if(!authorizesAction(commandText))return null;
 if(/(?:доведи|заверши|дополни|собери|составь).*(?:план|решени|указ)|план.*(?:до конца|целиком)/i.test(text))return {kind:'complete'};
 if(requestsSeveralProjects(commandText,context.worldMode))return null;
 // An appeal title can mention a school while requesting a safe crossing.
 // Its selected, authored initiative is more precise than keywords in that title.
 const initiativeId=(refersToAppeal?context.appeal?.initiativeIds[0]:null)??mentionedProject(text,context.worldMode)??(/обращени|этим|просьб|этот|это/i.test(text)?context.appeal?.initiativeIds[0]??context.projectId??null:null);
 if(!initiativeId)return null;
 const districtId=INITIATIVES[initiativeId].scope==='citywide'?null:mentionedDistrict(text,context.worldMode)??context.appeal?.districtId??context.districtId??(initiativeId==='M7'?'nura':null);
 return {kind:'add',initiativeId,districtId};
}
/** Wire data and saved cards can only name a finite product operation. */
export function readIntent(input:unknown):AyaIntent|null {
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const value=input as Record<string,unknown>;
 if(value.kind==='complete')return {kind:'complete'};
 if(value.kind==='add'&&INITIATIVE_IDS.includes(value.initiativeId as InitiativeId)&& (value.districtId===null||DISTRICT_IDS.includes(value.districtId as DistrictId)))return {kind:'add',initiativeId:value.initiativeId as InitiativeId,districtId:INITIATIVES[value.initiativeId as InitiativeId].scope==='citywide'?null:value.districtId as DistrictId|null};
 if(value.kind==='navigate'&&['map','residents','dashboard'].includes(String(value.space)))return {kind:'navigate',space:value.space as 'map'|'residents'|'dashboard',...(['overview','review','council','registry'].includes(String(value.section))?{section:value.section as 'overview'|'review'|'council'|'registry'}:{})};
 return null;
}
export function intentLabel(intent:AyaIntent,mode:ModeId='astana'):string {
 const {projectName,districtName,unitFor}=assistantPresentation(mode);
 if(intent.kind==='add')return `${projectName(intent.initiativeId)} · ${INITIATIVES[intent.initiativeId].cost} ${unitFor(INITIATIVES[intent.initiativeId].cost)}${intent.districtId?` · ${districtName(intent.districtId)}`:''}`;
 if(intent.kind==='complete')return 'Довести план';
 if(intent.kind==='repair')return 'Применить эту замену';
 if(intent.kind==='navigate')return intent.space==='residents'?'К жителям':intent.space==='map'?'На карту':intent.section==='council'?'На совет':'Разобрать план';
 return 'Объяснить';
}
export function localReply(text:string,context:AyaContext,reason:AssistantReply['reason']='unavailable'):AssistantReply {
 const {PROJECT_STORIES,districtName,quarter,quarterGen,quartersPrep}=assistantPresentation(context.worldMode);
 const selectedTitle=!!context.appeal&&text.includes(`«${context.appeal.title}»`);
 const facts=contextFacts(context),initiativeId=(selectedTitle?context.appeal?.initiativeIds[0]:null)??mentionedProject(text,context.worldMode)??context.projectId??context.appeal?.initiativeIds[0]??null;
 const compared=selectedTitle&&context.appeal?[context.appeal.initiativeIds[0]!]:mentionedProjects(text,context.worldMode);
 const intent=parseSupportedIntent(text,context);
 let reply=`Спросите, что даст проект, где он нужнее или какой есть компромисс. Если хотите поручить действие, назовите проект и ${quarter}.`;
 let selected=['budget'];
 if(requestsSeveralProjects(text,context.worldMode)&&authorizesAction(text)){reply=`В этом запросе несколько проектов. Давайте выберем по одному: назовите проект и ${quarter}, чтобы сначала проверить цену, совместимость и оставшийся бюджет.`;}
 else if(/правил|как\s+(?:играть|устроен|работает)|начать|таймер|часов/i.test(text)){reply='Выберите одну из трёх историй на карте. Посмотрите проект и его цену, затем подтвердите решение. Повторите пять раз — появится итог через два года. Любое решение можно изменить. Таймера нет.';selected.push('rules');}
 else if(/сколько\s+остал|остаток|(?:мой|наш|свободн\S*)\s+бюджет|бюджет|денег/i.test(text)&&!mentionedProject(text,context.worldMode)){reply='Списывается точная цена проекта. Уберёте решение — деньги вернутся; замените — учтётся разница. Тратить всё необязательно: остаток не даёт дополнительных баллов.';}
 else if(compared.length>1){reply='Эти проекты отвечают на разные потребности. Сравните цену, вклад за два года и ограничения. Бюджет остаётся у вас, пока вы не выберете действие.';for(const id of compared)selected.push(`project:${id}`,`effects:${id}`,`limits:${id}`);}
 else if(initiativeId&&/район|квартал|где|куда/i.test(text)&&/выбра|сравн|нужнее|нужен|потребност|лучше|построить/i.test(text)){
  reply=INITIATIVES[initiativeId].scope==='citywide'?`Этот проект действует во всех ${quartersPrep}: выбирать один ${quarter} не нужно.`:`Начните с исходной потребности. Низкое значение показывает, где проблема острее. Затем проверьте ограничения в карточке: ${quarter} с самой большой потребностью не обязательно даёт наибольший общий балл.`;
  selected.push(`project:${initiativeId}`,`need:${initiativeId}`,`limits:${initiativeId}`);
 }
 else if(/результат|балл|оценк|итог|(?:риск|сторон|последств|дальше).*план|план.*(?:риск|сторон|последств|дальше)/i.test(text)&&!mentionedProject(text,context.worldMode)&&!(/этот|этого|обращени/i.test(text))){reply=context.plan.length===5?'План готов. Посмотрите, кому стало лучше и что осталось нерешённым. В разборе можно сравнить замену, а на совете — услышать другие приоритеты.':'Полный результат появится после пяти решений. Пока можно сравнивать вклад проектов и оставшийся бюджет.';selected.push('result','result:critical','result:tradeoffs');}
 else if(initiativeId){
  const committed=context.plan.find(d=>d.initiativeId===initiativeId);
  reply=PROJECT_STORIES[initiativeId].benefit+' '+(committed?`Это решение уже в плане — ${committed.scope==='district'?districtName(committed.districtId):'весь город'}. Повторно покупать его не нужно. `:'')+PROJECT_STORIES[initiativeId].limitation;
  selected.push(`project:${initiativeId}`,`effects:${initiativeId}`,`limits:${initiativeId}`);const district=mentionedDistrict(text,context.worldMode)??context.appeal?.districtId??context.districtId;if(district&&INITIATIVES[initiativeId].scope==='district')selected.push(`district:${district}`);for(const s of SYNERGIES.filter(s=>s.ids.includes(initiativeId)))selected.push(`synergy:${s.ids.join('+')}`);
 }
 else if(/результат|балл|оценк|последств|совет|риск|сильн|дальше/i.test(text)){reply=context.plan.length===5?`Начните с оставшихся потребностей и компромиссов. В разборе можно сравнить замену, а на совете — услышать разные приоритеты. Более высокий общий индекс не обязательно лучше для каждого ${quarterGen}.`:'Встретьте жителя или выберите следующий проект. Полный результат появится после пяти решений. В карточке каждого проекта уже виден его вклад за два года; я могу помочь закончить план, сохранив ваши решения.';selected.push('result','result:critical','result:tradeoffs');}
 else if(context.appeal){reply='Обращение связано с конкретной жизненной ситуацией. Могу заняться предложенным проектом, а затем вернуться к жителю и проверить, что изменилось.';selected.push('appeal');}
 return {worldMode:context.worldMode??'astana',mode:'local',...(reason?{reason}:{}),text:reply,facts:facts.filter(f=>selected.includes(f.id)),intent,fingerprint:planFingerprint(context.plan),revision:context.revision};
}
