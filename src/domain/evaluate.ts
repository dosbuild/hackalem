import { BASELINE, DISTRICTS, INITIATIVES, RULES, SCENARIO_VERSION, SYNERGIES, WEIGHTS } from './scenario';
import { summarizePlan, validateCompletePlan } from './plan';
import { planFingerprint, resultIdentity } from './identity';
import { freeze } from './immutable';
import { DISTRICT_IDS, INDICATOR_IDS } from './types';
import type { Assessment, Contribution, DistrictId, IndicatorId, IndicatorMatrix, Plan, ScenarioResult, ValidationIssue, IndicatorEvidence } from './types';

/** Apply all contributions, then clip once. Baseline and contributions remain untouched. */
export function applyContributions(baseline: IndicatorMatrix, contributions: readonly Contribution[]): IndicatorMatrix {
  const next = Object.fromEntries(DISTRICT_IDS.map(d => [d,{ ...baseline[d] }])) as Record<DistrictId, Record<IndicatorId, number>>;
  for (const c of contributions) next[c.districtId][c.indicatorId] += c.amount;
  for (const d of DISTRICT_IDS) for (const k of INDICATOR_IDS) next[d][k] = Math.max(0, Math.min(100, next[d][k]));
  return next;
}

export function assessIndicators(indicators: IndicatorMatrix): Assessment {
  const districtScores = Object.fromEntries(DISTRICT_IDS.map(d => [d, INDICATOR_IDS.reduce((sum,k) => sum + WEIGHTS[k] * indicators[d][k],0)])) as Record<DistrictId, number>;
  const cityAverage = DISTRICTS.reduce((sum,d) => sum + d.populationShare * districtScores[d.id],0);
  const minimum = Math.min(...Object.values(districtScores));
  // Equal weighted sums can differ by a few floating-point ulps. Do not round scores.
  const tieTolerance = Number.EPSILON * 100 * INDICATOR_IDS.length;
  const weakestDistricts = DISTRICT_IDS.filter(d => Math.abs(districtScores[d] - minimum) <= tieTolerance);
  const criticalPairs = DISTRICT_IDS.flatMap(districtId => INDICATOR_IDS.filter(k => indicators[districtId][k] < 40).map(indicatorId => ({ districtId, indicatorId, value:indicators[districtId][indicatorId] })));
  const components = { city:.7 * cityAverage, weakest:.3 * minimum, critical:-criticalPairs.length };
  return { districtScores, cityAverage, weakestDistricts, weakestValue:minimum, criticalPairs, components, finalScore:components.city + components.weakest + components.critical };
}

export const BASELINE_ASSESSMENT = freeze(assessIndicators(BASELINE));
export type EvaluationOutcome = { ok:true; result:ScenarioResult } | { ok:false; issues:readonly ValidationIssue[] };

export const realizedEffect = (fullEffect:number, lag:number):number => fullEffect * (RULES.horizon - lag) / RULES.horizon;

export function indicatorLedger(baseline:IndicatorMatrix, indicators:IndicatorMatrix, measures:readonly Contribution[], bonuses:readonly Contribution[]):readonly IndicatorEvidence[] {
  return DISTRICT_IDS.flatMap(districtId => INDICATOR_IDS.map(indicatorId => {
    const measureEffects = measures.filter(c => c.districtId === districtId && c.indicatorId === indicatorId);
    const synergies = bonuses.filter(c => c.districtId === districtId && c.indicatorId === indicatorId);
    const beforeClipping = [...measureEffects,...synergies].reduce((n,c) => n + c.amount,baseline[districtId][indicatorId]);
    return { ref:`indicator:${districtId}:${indicatorId}`, districtId, indicatorId,
      baseline:baseline[districtId][indicatorId], beforeClipping, updated:indicators[districtId][indicatorId],
      change:indicators[districtId][indicatorId]-baseline[districtId][indicatorId], clipping:indicators[districtId][indicatorId]-beforeClipping, measureEffects, synergies };
  }));
}

export function evaluatePlan(input: unknown): EvaluationOutcome {
  const validation = validateCompletePlan(input);
  if (validation.status === 'invalid') return { ok:false, issues:validation.issues };
  if (validation.status === 'partial') return { ok:false, issues:[{ code:'incomplete', amount:RULES.decisionCount - validation.plan.length }] };
  // Canonical order makes floating-point accumulation deterministic too.
  const plan: Plan = [...validation.plan].sort((a,b) => Number(a.initiativeId.slice(1)) - Number(b.initiativeId.slice(1)));
  const measureContributions: Contribution[] = [];
  for (const d of plan) {
    const initiative = INITIATIVES[d.initiativeId];
    const districts = d.scope === 'district' ? [d.districtId] : DISTRICT_IDS;
    for (const districtId of districts) for (const indicatorId of INDICATOR_IDS) {
      const effect = initiative.effects[indicatorId];
      if (effect !== undefined) measureContributions.push({ districtId, indicatorId, amount:realizedEffect(effect,initiative.lag), initiativeIds:[d.initiativeId] });
    }
  }
  const synergyContributions: Contribution[] = [];
  for (const synergy of SYNERGIES) {
    const local = plan.find(d => d.initiativeId === synergy.ids[0]);
    if (local?.scope === 'district' && plan.some(d => d.initiativeId === synergy.ids[1])) {
      synergyContributions.push({ districtId:local.districtId, indicatorId:synergy.indicatorId, amount:synergy.amount, initiativeIds:[...synergy.ids] });
    }
  }
  const indicators = applyContributions(BASELINE,[...measureContributions,...synergyContributions]);
  const changes = Object.fromEntries(DISTRICT_IDS.map(d => [d,Object.fromEntries(INDICATOR_IDS.map(k => [k, indicators[d][k] - BASELINE[d][k]]))])) as IndicatorMatrix;
  const assessment = assessIndicators(indicators);
  const indicatorEvidence = indicatorLedger(BASELINE,indicators,measureContributions,synergyContributions);
  return { ok:true, result:freeze({ scenarioVersion:SCENARIO_VERSION, resultId:resultIdentity(plan), planFingerprint:planFingerprint(plan),
    plan, summary:summarizePlan(plan), baseline:BASELINE, baselineAssessment:BASELINE_ASSESSMENT,
    indicators, changes, measureContributions, synergyContributions, indicatorEvidence, ...assessment,
    scoreChange:assessment.finalScore-BASELINE_ASSESSMENT.finalScore,
    changeComponents:{ city:assessment.components.city-BASELINE_ASSESSMENT.components.city,
      weakest:assessment.components.weakest-BASELINE_ASSESSMENT.components.weakest, critical:assessment.components.critical-BASELINE_ASSESSMENT.components.critical } }) };
}
