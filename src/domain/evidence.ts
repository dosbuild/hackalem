import { INITIATIVES, RULES, SCENARIO_VERSION } from './scenario';
import { DISTRICT_IDS, INDICATOR_IDS } from './types';
import type { CandidateDecision, DistrictId, IndicatorId, InitiativeId, ScenarioResult } from './types';
import { realizedEffect, evaluatePlan } from './evaluate';
import { freeze } from './immutable';

export type EvidenceFact = Readonly<{
  ref:string; kind:'catalogue'|'calculated'; values:Readonly<Record<string,number>>;
  districtId?:DistrictId; indicatorId?:IndicatorId; initiativeIds?:readonly InitiativeId[];
}>;
/** Stable local refs are always paired with resultId, never valid across scenarios. */
export function scenarioEvidence(result:ScenarioResult):readonly EvidenceFact[] {
  return freeze([
    { ref:'score', kind:'calculated', values:{ before:result.baselineAssessment.finalScore, after:result.finalScore, change:result.scoreChange } },
    { ref:'score:components', kind:'calculated', values:{ ...result.changeComponents } },
    { ref:'critical', kind:'calculated', values:{ before:result.baselineAssessment.criticalPairs.length, after:result.criticalPairs.length } },
    { ref:'budget', kind:'calculated', values:{ budget:RULES.budget, spent:result.summary.spent, remaining:result.summary.remaining } },
    ...DISTRICT_IDS.map(districtId => ({ ref:`district:${districtId}`, kind:'calculated' as const, districtId,
      values:{ before:result.baselineAssessment.districtScores[districtId], after:result.districtScores[districtId] } })),
    ...result.indicatorEvidence.map(e => ({ ref:e.ref, kind:'calculated' as const, districtId:e.districtId, indicatorId:e.indicatorId,
      values:{ before:e.baseline, after:e.updated, change:e.change, beforeClipping:e.beforeClipping, clipping:e.clipping } })),
    ...result.measureContributions.map(c => ({ ref:`measure:${c.initiativeIds[0]}:${c.districtId}:${c.indicatorId}`, kind:'calculated' as const,
      districtId:c.districtId, indicatorId:c.indicatorId, initiativeIds:c.initiativeIds, values:{ beforeClipping:c.amount } })),
    ...result.synergyContributions.map(c => ({ ref:`synergy:${c.initiativeIds.join('+')}:${c.districtId}:${c.indicatorId}`, kind:'calculated' as const,
      districtId:c.districtId, indicatorId:c.indicatorId, initiativeIds:c.initiativeIds, values:{ beforeClipping:c.amount } })),
  ]);
}

/** Proposal effects are catalogue facts before synergies/clipping, not an evaluated forecast. */
export function proposalEvidence(candidate:CandidateDecision) {
  const item = INITIATIVES[candidate.initiativeId];
  return freeze({ kind:'catalogue' as const, initiativeId:item.id, cost:item.cost, lag:item.lag, horizon:RULES.horizon,
    districtIds:candidate.scope === 'citywide' ? DISTRICT_IDS : candidate.districtId ? [candidate.districtId] : [],
    effects:INDICATOR_IDS.filter(k => item.effects[k] !== undefined).map(indicatorId => ({ indicatorId,
      fullEffect:item.effects[indicatorId]!, beforeClipping:realizedEffect(item.effects[indicatorId]!,item.lag) })) });
}

/** External comparisons re-evaluate both plans: no four-decision counterfactuals or supplied scores. */
export function compareScenarios(left:ScenarioResult, right:ScenarioResult) {
  if (left.scenarioVersion !== right.scenarioVersion || left.scenarioVersion !== SCENARIO_VERSION) return { ok:false as const, reason:'different_model' as const };
  const a = evaluatePlan(left.plan), b = evaluatePlan(right.plan);
  if (!a.ok || !b.ok || a.result.resultId !== left.resultId || b.result.resultId !== right.resultId
    || JSON.stringify(left.baseline) !== JSON.stringify(right.baseline)
    || JSON.stringify(left.baseline) !== JSON.stringify(a.result.baseline)) return { ok:false as const, reason:'invalid_scenario' as const };
  return { ok:true as const, from:a.result, to:b.result, scoreChange:b.result.finalScore-a.result.finalScore,
    spentChange:b.result.summary.spent-a.result.summary.spent,
    components:{ city:b.result.components.city-a.result.components.city, weakest:b.result.components.weakest-a.result.components.weakest,
      critical:b.result.components.critical-a.result.components.critical } };
}
