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
 M1:'Lanes affect transport. A safe crossing is a separate task. LRT and bus lanes cannot coexist in one plan.',
 M2:'Traffic signals affect congestion and road safety in all five districts. This project does not change public transport access.',
 M3:'LRT affects transport and air quality. This does not calculate an individual journey time. It cannot coexist with bus lanes in one plan.',
 M4:'A park changes green space, air quality and public safety. It does not change healthcare provision.',
 M5:'Clean fuel affects air and utility networks. A park has a different set of effects, including green space. These address different needs.',
 M6:'Plantings affect greenery and air across all districts. They do not replace converting homes to clean fuel.',
 M7:'There are two tasks here: school places and the journey to school. This project addresses the first. Road safety remains a separate indicator.',
 M8:'The model shows a change in healthcare provision. It does not calculate how many minutes someone will wait for an appointment.',
 M9:'Courtyard sports provide small effects across three indicators. They are not equivalent to a new school or clinic.',
 M10:'Lighting affects public and road safety. This does not predict the number of incidents in a particular courtyard.',
 M11:'Road safety improves, but traffic flow decreases. One decision brings both a benefit and a transport trade-off.',
 M12:'The platform changes request handling. It does not replace heating and water networks.',
 M13:'Upgrades change utilities and air quality. Request handling is a separate task.',
 M14:'Crews affect utilities and city services across all five districts. This does not predict arrival time for a particular person.',
};
export interface Guidance {key:string;title:string;text:string;facts:string[];limitation:string;pose:'wait'|'notice'|'point'|'open'|'listen'|'compare';}
export function proposalGuidance(state:AppState):Guidance|null {
 const c=state.candidate;if(!c)return null;const plan=editingPlan(state);const item=INITIATIVES[c.decision.initiativeId];const preview=applyEdit(plan,c.replaces?{kind:'replace',target:c.replaces,decision:c.decision}:{kind:'add',decision:c.decision});
 const originalPlan=state.alternative?state.plan:plan;
 const oldId=state.alternative?originalPlan[state.alternative.slot]!.initiativeId:c.replaces;
 const old=oldId?INITIATIVES[oldId]:null;
 const scope=c.decision.scope==='citywide'?'all five districts':c.decision.districtId?districtName(c.decision.districtId):'no district selected yet';
 return {key:`proposal:${state.revision}:${JSON.stringify(c)}`,title:preview.accepted?'What exactly will this project change?':'The proposal needs clarification',pose:'point',
 text:preview.accepted?LIMITS[item.id]:preview.issues.map(issueMessage).join(' '),facts:[`Scope: ${scope}. This is one of five decisions.`, `Price now: ${item.cost} units. Effects begin after ${item.lag} quarters; the evaluation horizon is 8 quarters. This is not the construction time.`,...(old?[`Replacement: ${old.name} (${old.cost} units) → ${item.name} (${item.cost} units).`, `Available budget: ${summarizePlan(originalPlan).remaining} → ${preview.accepted?summarizePlan(preview.plan).remaining:'unchanged'} units. Previous scope: ${originalPlan.find(d=>d.initiativeId===old.id)?.scope==='citywide'?'citywide':districtName((originalPlan.find(d=>d.initiativeId===old.id) as {districtId:Parameters<typeof districtName>[0]}).districtId)}; after: ${scope}.`]:[])],
 limitation:preview.accepted?'This is a proposal on paper. The surroundings change only after the active plan is calculated.':`Your plan and budget are saved. ${LIMITS[item.id]}`};
}
export function reflection(state:AppState) {
 const touched=new Set(state.plan.flatMap(d=>INDICATOR_IDS.filter(k=>INITIATIVES[d.initiativeId].effects[k]!==undefined).flatMap(k=>(d.scope==='citywide'?DISTRICTS.map(x=>x.id):[d.districtId]).map(id=>`${id}:${k}`))));
 const untouched=DISTRICTS.flatMap(d=>INDICATOR_IDS.filter(k=>!touched.has(`${d.id}:${k}`)).map(k=>({districtId:d.id,indicatorId:k,value:BASELINE[d.id][k]}))).sort((a,b)=>a.value-b.value);
 return {touched:touched.size,untouched,summary:`The plan affects ${touched.size} of 50 district indicators. ${untouched[0]?`${districtName(untouched[0].districtId)}: ${indicatorNames[untouched[0].indicatorId]} (${untouched[0].value}) remains outside the direct effects of the selected projects.`:'Every indicator is affected by at least one direct effect.'}`};
}
export function returnGuidance(state:AppState,resident:Resident):Guidance|null {
 if(!hasCurrentResult(state))return null;const futureState={...state,comparisonPosition:1};const o=observe(resident,futureState);
 const touched=o.evidence.indicators.filter(i=>i.delta!==0);
 const text=o.treatment?'We returned to a familiar place. The related project is included in the calculation; new scene details illustrate its effects.':touched.length?'We started here. The related project was not completed here, but other decisions affected this district’s indicators.':'We started here. Your plan changed nothing for this need. Let’s see where changes occurred.';
 return {key:`return:${state.revision}:${resident.id}`,title:`Back here · ${resident.name}`,pose:'compare',text,facts:o.evidence.indicators.map(i=>`${indicatorNames[i.id]}: ${format(i.before)} → ${format(i.after)}${i.critical?' · below 40':''}`),limitation:o.evidence.limitation};
}
export function conclusion(state:AppState):string {
 if(!hasCurrentResult(state))return 'The previous result is no longer valid after the plan changed. A new calculation is needed.';
 const r=state.result!.value;const critical=r.criticalPairs[0];
 if(critical)return `Open question: ${districtName(critical.districtId)} — ${indicatorNames[critical.indicatorId]}: ${format(critical.value)}, below 40. What would change if one of your five decisions were directed here?`;
 const untouched=reflection(state).untouched[0];return untouched?`Open question: ${districtName(untouched.districtId)} — ${indicatorNames[untouched.indicatorId]} received no direct effect. Would you like to try a different plan scope?`:'No indicators are below 40. How would the result change if you moved one district decision?';
}
