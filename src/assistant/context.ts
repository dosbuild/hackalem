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
const number=(v:number)=>v.toLocaleString('en-US',{maximumFractionDigits:2});
export function contextFacts(context:AyaContext):AyaFact[] {
 const {CATALOGUE,DISTRICTS,PROJECT_STORIES,indicatorNames,projectName,districtName,unitFor,quarter,quarterGen,quarterPrep,quarters,seasons,season}=assistantPresentation(context.worldMode);
 const summary=summarizePlan(context.plan);
 const facts:AyaFact[]=[{id:'budget',text:`Your plan has ${summary.count}/${RULES.decisionCount} decisions. Spent ${summary.spent} ${unitFor(summary.spent)}, remaining ${summary.remaining} ${unitFor(summary.remaining)}`},
  {id:'rules',text:`Five distinct initiatives, at most two per area, budget ${RULES.budget} ${unitFor(RULES.budget)}. Calculation covers ${RULES.horizon} ${seasons}.`}];
 for(const project of CATALOGUE){
  facts.push({id:`project:${project.id}`,text:`${project.name}: ${project.cost} ${unitFor(project.cost)}; ${project.scope==='citywide'?'for the whole city':`for the selected ${quarterGen}`}. Effects begin in ${season} ${project.lag+1}; results after ${RULES.horizon} ${seasons}.`});
  facts.push({id:`effects:${project.id}`,text:`Two-year contribution${project.scope==='citywide'?` in each ${quarterPrep}`:''}: ${INDICATOR_IDS.filter(k=>project.effects[k]!==undefined).map(k=>`${indicatorNames[k]} ${signed(realizedEffect(project.effects[k]!,project.lag))}`).join('; ')}. Delay is included. Synergies and the 0–100 limits are applied when calculating the plan.`});
  const conflicts=INCOMPATIBILITIES.filter(c=>c.ids.includes(project.id)).map(c=>`Conflicts with “${projectName(c.ids.find(id=>id!==project.id)!)}” ${c.scope==='plan'?'in one plan':`in the same ${quarterPrep}`}.`);
  facts.push({id:`limits:${project.id}`,text:[PROJECT_STORIES[project.id].limitation,...conflicts].join(' ')});
  if(project.scope==='district'){
   const story=PROJECT_STORIES[project.id],ordered=DISTRICTS.slice().sort((a,b)=>BASELINE[a.id][story.indicator]-BASELINE[b.id][story.indicator]);
   facts.push({id:`need:${project.id}`,text:`${story.need}, baseline values: ${ordered.map(d=>`${d.name} ${number(BASELINE[d.id][story.indicator])}/100`).join('; ')}. Lower means a greater need. This compares needs, not final plan rankings.`});
  }
 }
 for(const d of DISTRICTS){
  const weakest=INDICATOR_IDS.slice().sort((a,b)=>BASELINE[d.id][a]-BASELINE[d.id][b]).slice(0,3);
  facts.push({id:`district:${d.id}`,text:`${d.name}, baseline needs: ${weakest.map(k=>`${indicatorNames[k]} ${number(BASELINE[d.id][k])}/100`).join('; ')}. A lower indicator means a greater need in this educational model.`});
 }
 for(const synergy of SYNERGIES)facts.push({id:`synergy:${synergy.ids.join('+')}`,text:`${synergy.ids.map(projectName).join(' + ')}: an additional ${signed(synergy.amount)} for indicator “${indicatorNames[synergy.indicatorId]}” in ${quarterPrep} for project “${projectName(synergy.ids[0])}”. The bonus is not reduced by the delay.`});
 if(context.plan.length)facts.push({id:'plan',text:context.plan.map(d=>`${projectName(d.initiativeId)} — ${d.scope==='district'?districtName(d.districtId):'citywide'}`).join('; ')});
 const result=evaluatePlan(context.plan);
 if(result.ok){
  facts.push({id:'result',text:`Plan score ${number(result.result.finalScore)}; change from the baseline city ${signed(result.result.scoreChange)}. Weakest ${quarters}: ${result.result.weakestDistricts.map(districtName).join(', ')}.`});
  facts.push({id:'result:critical',text:result.result.criticalPairs.length?`Still below 40: ${result.result.criticalPairs.map(p=>`${districtName(p.districtId)} — ${indicatorNames[p.indicatorId]} ${number(p.value)}`).join('; ')}.`:'No indicators remain below the critical threshold of 40. This does not mean every resident’s needs are resolved.'});
  const negative=result.result.indicatorEvidence.filter(e=>e.change<0);
  if(negative.length)facts.push({id:'result:tradeoffs',text:`Indicator decreases: ${negative.map(e=>`${districtName(e.districtId)} — ${indicatorNames[e.indicatorId]} ${number(e.baseline)} → ${number(e.updated)}`).join('; ')}.`});
 }
 if(context.appeal)facts.push({id:'appeal',text:`Request “${context.appeal.title}”, ${quarter} ${districtName(context.appeal.districtId)}. Initiatives to consider: ${context.appeal.initiativeIds.map(projectName).join('; ')}. Accepting a project does not resolve the request by itself.`});
 return facts;
}

// Legacy catalogue titles are accepted as input; all displayed content remains English.
const legacyCatalogueNames:readonly {id:InitiativeId;name:string}[]=[
 {id:'M1',name:'Выделенные автобусные полосы'},
 {id:'M2',name:'Адаптивные светофоры'},
 {id:'M3',name:'Строительство или расширение LRT'},
 {id:'M4',name:'Парк или сквер'},
 {id:'M5',name:'Переход частных домов на чистое топливо'},
 {id:'M6',name:'Озеленение и ветрозащитные посадки'},
 {id:'M7',name:'Модульная школа и детский сад'},
 {id:'M8',name:'Семейная поликлиника'},
 {id:'M9',name:'Спортивные пространства во дворах'},
 {id:'M10',name:'Освещение и камеры'},
 {id:'M11',name:'Безопасные переходы и школьные зоны'},
 {id:'M12',name:'Единая платформа обращений жителей'},
 {id:'M13',name:'Модернизация тепловых и водопроводных сетей'},
 {id:'M14',name:'Аварийные бригады и раннее предупреждение'},
];
const projectWords:readonly [InitiativeId,RegExp][]=[
 ['M11',/\bcrossings?\b|\bpedestrian\b|\bschool zones?\b|переход|пешеход|школьн.{0,8}зон|безопас.{0,12}(путь|дорог)/i],['M7',/\bschools?\b(?!\s+(?:zones?|crossings?))|\bkindergarten\b|\beducation\b|школ(?!ьн.{0,8}зон)|детск.{0,8}сад|мест.{0,12}(уч[её]б|обуч)/i],['M8',/\bclinic\b|\bhealthcare\b|\bdoctor\b|поликлиник|здравоохр|медицин|врач/i],['M3',/\blrt\b|лрт|легкорельс/i],['M1',/\bbus(?:es)?\b|автобус|полос/i],['M2',/\btraffic (?:signals?|lights?)\b|светофор/i],
 ['M4',/\bparks?\b|\bsquares?\b|парк|сквер/i],['M5',/\bclean (?:fuel|heating)\b|\bcoal\b|\bsmoke\b|топлив|угол|угл[её]|дым|отоплен.{0,15}дом/i],['M6',/\btrees?\b|\bplantings?\b|\bwindbreak\b|\bgreen shelter\b|озелен|посадк|ветрозащит|дерев/i],['M9',/\bsports?\b|\bplaygrounds?\b|спорт|тренаж[её]р|дворов/i],['M10',/\blighting\b|\bcameras?\b|освещ|камер|фонар|темн/i],['M12',/\b(?:request|appeal) (?:platform|service)\b|платформ.{0,12}обращ|цифров.{0,12}обращ/i],['M13',/\butilit(?:y|ies)\b|\bpipes?\b|\bnetworks?\b|сет[ьи]|труб|водопровод|теплосет/i],['M14',/\bemergency\b|\bcrews?\b|\bearly warning\b|авари|бригад|предупрежден/i]];
const historicalProjectWords:readonly [InitiativeId,RegExp][]=[
 ['M11',/\bsafe (?:crossings?|paths?)\b|безопас.{0,12}(переход|путь)|детск.{0,10}переход/i],['M7',/\bteaching yurts?\b|\blearning\b|\btutors?\b|учебн.{0,5}юрт|уч[её]б|наставниц/i],['M8',/\bhealers?\b|\bmedicine\b|лекар|лечебн/i],['M3',/\bcaravan (?:roads?|routes?)\b|\binns?\b|караванн.{0,8}дорог|постоял/i],['M1',/\bcart (?:lanes?|paths?)\b|обозн.{0,5}путь|путь.{0,8}обоз|отдельн.{0,6}путь/i],['M2',/\btraffic stewards?\b|распорядител/i],['M4',/\bshared gardens?\b|\bshaded gardens?\b|общ.{0,5}сад|тен.{0,5}сад/i],['M5',/\bsmoke\b|\bhearths?\b|дым|очаг/i],['M6',/\bgroves?\b|\bwindbreaks?\b|рощ|ветрозащит/i],['M9',/\bgames?\b|\bcontests?\b|игр|состязан/i],['M10',/\blanterns?\b|\bnight guards?\b|фонар|ночн.{0,6}страж/i],['M12',/\bpetition(?: house| book)?\b|\bmessengers?\b|дом.{0,5}прошен|гонц|писар/i],['M13',/\bwells?\b|\bwinter quarters?\b|зимов|колодц/i],['M14',/\bwork crews?\b|\bsignal\b|артел|сигнальн/i],
];
const districts:readonly [DistrictId,RegExp][]=[['nura',/\bnura\b|нур[аыуе]/i],['esil',/\b(?:esil|yesil)\b|есил|есыл/i],['almaty',/\balmaty\b|алмат/i],['saryarka',/\bsaryarka\b|сарыар/i],['baikonur',/\bbaikonur\b|байкон|байқо/i]];
export function mentionedProject(text:string,mode:ModeId='astana'):InitiativeId|null {
 return mentionedProjects(text,mode)[0]??null;
}
export function mentionedDistrict(text:string,mode:ModeId='astana'):DistrictId|null {if(mode==='khanate'){const exact=assistantPresentation(mode).DISTRICTS.find(d=>text.toLocaleLowerCase('en').includes(d.name.toLocaleLowerCase('en')));if(exact)return exact.id;for(const [id,pattern] of [['esil',/\briverbank\b|\briverside\b|речн.{0,6}берег|у реки/i],['almaty',/\bcrafts?\b|\bworkshops?\b|мастер|ремесл/i],['baikonur',/\bcaravan gates?\b|караванн.{0,5}ворот/i],['nura',/\bpastures?\b|пастбищ|нурин/i]] as const)if(pattern.test(text))return id;}return districts.find(([,pattern])=>pattern.test(text))?.[0]??null;}
function mentionedProjects(text:string,mode:ModeId='astana'):InitiativeId[] {
 const {CATALOGUE}=assistantPresentation(mode);
 const found=new Set<InitiativeId>();
 let rest=text.toLocaleLowerCase('en-US');
 for(const match of rest.matchAll(/\bm(1[0-4]|[1-9])\b/g))found.add(`M${match[1]}` as InitiativeId);
 // Exact catalogue names own their words: a clean-fuel "transition" is not a crossing.
 for(const project of [...CATALOGUE,...(mode==='astana'?legacyCatalogueNames:[])].sort((a,b)=>b.name.length-a.name.length)){const name=project.name.toLocaleLowerCase('en-US');if(rest.includes(name)){found.add(project.id);rest=rest.replaceAll(name,' ');}}
 // Inspect the whole remaining sentence. "A park next to a school" names two
 // projects even without "and"; a clarification is safer than choosing one.
 for(const [id,pattern] of (mode==='khanate'?historicalProjectWords:projectWords))if(pattern.test(rest))found.add(id);
 return [...found];
}
function requestsSeveralProjects(text:string,mode:ModeId='astana'):boolean {return mentionedProjects(text,mode).length>1;}
/** Deliberately conservative: an explanatory question must never spend money. */
export function authorizesAction(text:string):boolean {
 if(/\b(?:do not|don[’']t|never|without|cancel|stop|what|why|how|explain|compare|discuss|consider|should|could|would|if)\b|\bshow\b.*\b(?:cost|price|effect|consequence)/i.test(text))return false;
 if(/\?|(?:^|\s)(?:не|без)\s|отмен|не\s*(?:надо|нужно|хочу)|что\s+(даст|будет|лучше|измен)|сколько|почему|зачем|расскажи|объясни|сравн|понять|разобраться|подумать|обсуд|посоветуй|покажи\s+(цен|эффект|последств)|можно ли|стоит ли|если|как\s+(постро|добав|выбрать|сделать)/i.test(text))return false;
 return /\b(?:open|build|add|include|create|help|complete|finish|assemble|adopt|launch|fund)\b|открой|построй|строим|добавь|включи|сделай|займись|помоги|реши|доведи|заверши|дополни|собери|составь|прими|запусти|хочу\s+(постро|добав|школ(?!ьн.{0,8}зон)|парк|поликлиник)/i.test(text);
}
export function parseSupportedIntent(text:string,context:AyaContext):AyaIntent|null {
 if(/\b(?:open|show|go to|visit)\b.*\bcouncil\b/i.test(text))return {kind:'navigate',space:'dashboard',section:'council'};
 if(/\b(?:open|show|go to)\b.*\b(?:dashboard|review|analysis|results?|chronicle)\b/i.test(text))return {kind:'navigate',space:'dashboard',section:'review'};
 if(!mentionedProject(text,context.worldMode)&&/\b(?:open|show|go to|visit|meet)\b.*\b(?:residents?|requests?|petitions?)\b/i.test(text))return {kind:'navigate',space:'residents'};
 if(/\b(?:open|show|go to)\b.*\b(?:map|city)\b/i.test(text))return {kind:'navigate',space:'map'};
 if(/(?:открой|покажи|перейди|перейдём|перейдем).*(?:совет|совещан)/i.test(text))return {kind:'navigate',space:'dashboard',section:'council'};
 if(/(?:открой|покажи|перейди).*(?:дашборд|разбор|аналити|результат|летопис)/i.test(text))return {kind:'navigate',space:'dashboard',section:'review'};
 if(!mentionedProject(text,context.worldMode)&&/(?:открой|покажи|перейди|пойдём|пойдем).*(?:жител|обращени|прошени)/i.test(text))return {kind:'navigate',space:'residents'};
 if(/(?:открой|покажи|перейди).*(?:карт[ау]|город)/i.test(text))return {kind:'navigate',space:'map'};
 const refersToAppeal=/\bthis (?:request|petition|issue|appeal)\b|с\s+(?:этим\s+)?(?:обращением|прошением)|этим\s+(?:вопросом|запросом)|этой\s+просьбой/i.test(text)
   &&!!context.appeal&&(!/[«“]/.test(text)||containsAppealTitle(text,context.appeal.title));
 const commandText=refersToAppeal?text.replace(/«[^»]*»|“[^”]*”/g,'request'):text;
 if(!authorizesAction(commandText))return null;
 if(/\b(?:complete|finish|assemble|build)\b.*\b(?:plan|decisions|decrees)\b|(?:доведи|заверши|дополни|собери|составь).*(?:план|решени|указ)|план.*(?:до конца|целиком)/i.test(text))return {kind:'complete'};
 if(requestsSeveralProjects(commandText,context.worldMode))return null;
 // An appeal title can mention a school while requesting a safe crossing.
 // Its selected, authored initiative is more precise than keywords in that title.
 const initiativeId=(refersToAppeal?context.appeal?.initiativeIds[0]:null)??mentionedProject(text,context.worldMode)??(/\brequest\b|\bthis\b|\bit\b|обращени|этим|просьб|этот|это/i.test(text)?context.appeal?.initiativeIds[0]??context.projectId??null:null);
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
 if(intent.kind==='complete')return 'Complete the plan';
 if(intent.kind==='repair')return 'Apply this replacement';
 if(intent.kind==='navigate')return intent.space==='residents'?'Meet residents':intent.space==='map'?'On the map':intent.section==='council'?'To the council':'Review the plan';
 return 'Explain';
}
function containsAppealTitle(text:string,title:string):boolean {return text.includes(`«${title}»`)||text.includes(`“${title}”`);}
export function localReply(text:string,context:AyaContext,reason:AssistantReply['reason']='unavailable'):AssistantReply {
 const {PROJECT_STORIES,districtName,quarter,quarterGen,quartersPrep}=assistantPresentation(context.worldMode);
 const selectedTitle=!!context.appeal&&containsAppealTitle(text,context.appeal.title);
 const facts=contextFacts(context),initiativeId=(selectedTitle?context.appeal?.initiativeIds[0]:null)??mentionedProject(text,context.worldMode)??context.projectId??context.appeal?.initiativeIds[0]??null;
 const compared=selectedTitle&&context.appeal?[context.appeal.initiativeIds[0]!]:mentionedProjects(text,context.worldMode);
 const intent=parseSupportedIntent(text,context);
 let reply=`Ask what a project achieves, where it is most needed or what trade-offs it has. To request an action, name a project and ${quarter}.`;
 let selected=['budget'];
 if(requestsSeveralProjects(text,context.worldMode)&&authorizesAction(text)){reply=`This request includes several projects. Let’s choose one at a time: name a project and ${quarter}, so we can first check its price, compatibility and remaining budget.`;}
 else if(/\brules?\b|\bhow (?:to play|does|is)\b|\bstart\b|\btimer\b|правил|как\s+(?:играть|устроен|работает)|начать|таймер|часов/i.test(text)){reply='Choose one of the three stories on the map. Review the project and its price, then confirm. Repeat five times to see the result after two years. Any decision can be changed. There is no timer.';selected.push('rules');}
 else if(/\bbudget\b|\bmoney\b|\bremaining\b|сколько\s+остал|остаток|(?:мой|наш|свободн\S*)\s+бюджет|бюджет|денег/i.test(text)&&!mentionedProject(text,context.worldMode)){reply='The exact project price is deducted. Remove a decision to refund it; replace it to pay the difference. You do not need to spend everything: the remainder earns no extra points.';}
 else if(compared.length>1){reply='These projects address different needs. Compare their price, two-year contribution and limitations. The budget remains yours until you choose an action.';for(const id of compared)selected.push(`project:${id}`,`effects:${id}`,`limits:${id}`);}
 else if(initiativeId&&/\bdistricts?\b|\bquarters?\b|\bwhere\b|район|квартал|где|куда/i.test(text)&&/\bchoos|\bcompar|\bneed|\bbest\b|\bbuild\b|выбра|сравн|нужнее|нужен|потребност|лучше|построить/i.test(text)){
  reply=INITIATIVES[initiativeId].scope==='citywide'?`This project affects all ${quartersPrep}: choosing a single ${quarter} is unnecessary.`:`Start with the baseline need. A low value shows where the problem is most acute. Then check the card’s limitations: the ${quarter} with the greatest need does not necessarily produce the highest overall score.`;
  selected.push(`project:${initiativeId}`,`need:${initiativeId}`,`limits:${initiativeId}`);
 }
 else if(/\bresults?\b|\bscore\b|\b(?:risks?|strengths?|consequences?|next).*plan\b|\bplan.*(?:risks?|strengths?|consequences?|next)\b|результат|балл|оценк|итог|(?:риск|сторон|последств|дальше).*план|план.*(?:риск|сторон|последств|дальше)/i.test(text)&&!mentionedProject(text,context.worldMode)&&!(/\bthis\b|\brequest\b|этот|этого|обращени/i.test(text))){reply=context.plan.length===5?'Your plan is ready. See who benefited and what remains unresolved. Compare a replacement in the review or hear other priorities at the council.':'Full results appear after five decisions. For now, compare project contributions and the remaining budget.';selected.push('result','result:critical','result:tradeoffs');}
 else if(initiativeId){
  const committed=context.plan.find(d=>d.initiativeId===initiativeId);
  reply=PROJECT_STORIES[initiativeId].benefit+' '+(committed?`This decision is already in your plan — ${committed.scope==='district'?districtName(committed.districtId):'citywide'}. There is no need to buy it again. `:'')+PROJECT_STORIES[initiativeId].limitation;
  selected.push(`project:${initiativeId}`,`effects:${initiativeId}`,`limits:${initiativeId}`);const district=mentionedDistrict(text,context.worldMode)??context.appeal?.districtId??context.districtId;if(district&&INITIATIVES[initiativeId].scope==='district')selected.push(`district:${district}`);for(const s of SYNERGIES.filter(s=>s.ids.includes(initiativeId)))selected.push(`synergy:${s.ids.join('+')}`);
 }
 else if(/\bresults?\b|\bscore\b|\bconsequences?\b|\bcouncil\b|\brisks?\b|\bstrengths?\b|\bnext\b|результат|балл|оценк|последств|совет|риск|сильн|дальше/i.test(text)){reply=context.plan.length===5?`Start with remaining needs and trade-offs. Compare a replacement in the review or hear different priorities at the council. A higher overall index is not necessarily better for every ${quarterGen}.`:'Meet a resident or choose the next project. Full results appear after five decisions. Each project card already shows its two-year contribution; I can help complete the plan while keeping your decisions.';selected.push('result','result:critical','result:tradeoffs');}
 else if(context.appeal){reply='This request relates to a specific everyday situation. I can work on the proposed project, then revisit the resident to see what changed.';selected.push('appeal');}
 return {worldMode:context.worldMode??'astana',mode:'local',...(reason?{reason}:{}),text:reply,facts:facts.filter(f=>selected.includes(f.id)),intent,fingerprint:planFingerprint(context.plan),revision:context.revision};
}
