import { SCENARIO_VERSION } from './scenario';
import { validateCompletePlan } from './plan';
import type { Plan, ScenarioResult } from './types';

export const planFingerprint = (plan:Plan):string => [...plan].map(d => `${d.initiativeId}@${d.scope === 'citywide' ? 'city' : d.districtId}`).sort().join('|');
export const resultIdentity = (plan:Plan, version = SCENARIO_VERSION):string => `${version}/${planFingerprint(plan)}`;

/** Shared freshness predicate for all consumers, including restored/async boundaries. */
export function isCurrentResult(plan:Plan, revision:number, result:Readonly<{revision:number;value:ScenarioResult}>|null):boolean {
  return !!result && result.revision === revision && result.value.scenarioVersion === SCENARIO_VERSION
    && result.value.resultId === resultIdentity(plan) && result.value.planFingerprint === planFingerprint(plan)
    && planFingerprint(result.value.plan) === planFingerprint(plan) && validateCompletePlan(plan).status === 'complete';
}
