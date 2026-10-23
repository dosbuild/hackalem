import type {IndicatorEvidence,InitiativeId,ScenarioResult} from '../domain/types';
import {PROJECT_STORIES} from '../features/project-insight';

/** A positive outcome belongs to an actual funded contributor, not a similar need. */
export function leadingProject(entry:IndicatorEvidence):InitiativeId|null {
 return entry.measureEffects.filter(effect=>effect.amount>0).slice().sort((a,b)=>b.amount-a.amount)[0]?.initiativeIds[0]??null;
}

/** Select a few existing ledger entries to explain a result; never recalculate it. */
export function resultImpact(result:ScenarioResult) {
 const ledger=result.indicatorEvidence;
 const recovered=ledger.filter(e=>e.baseline<40&&e.updated>=40);
 const improved=ledger.filter(e=>e.change>0).sort((a,b)=>b.change-a.change);
 const decreased=ledger.filter(e=>e.change<0).sort((a,b)=>a.change-b.change);
 const remaining=ledger.slice().sort((a,b)=>a.updated-b.updated||a.change-b.change)[0]!;
 // A short human headline should explain the project's own concern. Cross-effects
 // remain in the complete ledger rather than implying, for example, a new school
 // was built by a sports project.
 const primary=(entry:IndicatorEvidence)=>{const id=leadingProject(entry);return !!id&&PROJECT_STORIES[id].indicator===entry.indicatorId;};
 return {recovered,improved,decreased,remaining,highlight:recovered.find(primary)??improved.find(primary)??recovered[0]??improved[0]??null};
}

/** Compare existing model outputs so an aggregate gain cannot hide a local loss. */
export function comparisonImpact(before:ScenarioResult,after:ScenarioResult) {
 const changes=after.indicatorEvidence.map(e=>({districtId:e.districtId,indicatorId:e.indicatorId,before:before.indicators[e.districtId][e.indicatorId],after:e.updated,change:e.updated-before.indicators[e.districtId][e.indicatorId]}));
 return {
  losses:changes.filter(e=>e.change<0).sort((a,b)=>a.change-b.change),
  newlyCritical:changes.filter(e=>e.before>=40&&e.after<40),
  recovered:changes.filter(e=>e.before<40&&e.after>=40),
 };
}
