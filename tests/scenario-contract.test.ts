import { describe, expect, it } from 'vitest';
import { oracle } from './scenario-oracle';
import { BASELINE, CATALOGUE, DISTRICTS, WEIGHTS, RULES, SYNERGIES, INCOMPATIBILITIES, SCENARIO_VERSION } from '../src/domain/scenario';
import { validateScenario } from '../src/domain/scenario-validation';
import { applyContributions, assessIndicators, BASELINE_ASSESSMENT, evaluatePlan, indicatorLedger } from '../src/domain/evaluate';
import { compareScenarios, proposalEvidence, scenarioEvidence } from '../src/domain/evidence';
import { isCurrentResult, resultIdentity } from '../src/domain/identity';
import { appReducer, initialState } from '../src/app/state';
import { DISTRICT_IDS, INDICATOR_IDS } from '../src/domain/types';
import type { Contribution, IndicatorMatrix, Plan } from '../src/domain/types';
import { city, local } from './fixtures';
import { observe } from '../src/residents/engine';
import { RESIDENTS } from '../src/residents/population';

const data = {baseline:BASELINE,catalogue:CATALOGUE,districts:DISTRICTS,weights:WEIGHTS,rules:RULES,synergies:SYNERGIES,incompatibilities:INCOMPATIBILITIES};
function evaluate(plan:unknown) { const outcome = evaluatePlan(plan); if (!outcome.ok) throw new Error(JSON.stringify(outcome.issues)); return outcome.result; }

describe('preserved source checked by an independent rational oracle',() => {
  it('matches every raw datum, weight, population share and all fourteen catalogue entries',() => {
    expect(BASELINE).toEqual(oracle.baseline);
    expect(WEIGHTS).toEqual(oracle.weights);
    expect(Object.fromEntries(DISTRICTS.map(d => [d.id,d.populationShare]))).toEqual(oracle.population);
    expect(CATALOGUE.map(({name: _name,...rest}) => rest)).toEqual(oracle.catalogue);
    expect(SYNERGIES).toEqual([{ids:['M1','M2'],indicatorId:'T1',amount:2},{ids:['M10','M12'],indicatorId:'B1',amount:2},{ids:['M5','M6'],indicatorId:'E2',amount:2}]);
    expect(INCOMPATIBILITIES).toEqual([{ids:['M1','M3'],scope:'plan'},{ids:['M4','M7'],scope:'district'},{ids:['M5','M13'],scope:'district'}]);
    expect(validateScenario(data)).toEqual([]);
  });
  it.each(Object.entries(oracle.cases))('matches all fifty indicators and assessments: %s',(_name,expected) => {
    const r = evaluate(expected.plan);
    expect(r.summary.spent).toBe(expected.cost);
    expect(r.indicators).toEqual(expected.indicators);
    for (const d of DISTRICT_IDS) expect(r.districtScores[d]).toBeCloseTo(expected.districtScores[d],11);
    expect(r.cityAverage).toBeCloseTo(expected.cityAverage,11);
    expect(r.weakestValue).toBeCloseTo(expected.weakestValue,11);
    expect(r.weakestDistricts).toEqual(expected.weakestDistricts);
    expect(r.criticalPairs).toEqual(expected.criticalPairs);
    expect(r.finalScore).toBeCloseTo(expected.finalScore,11);
    expect(Object.values(r.changeComponents).reduce((a,b) => a+b,0)).toBeCloseTo(r.scoreChange,11);
  });
  it('validates malformed data at runtime instead of relying on TypeScript',() => {
    for (const bad of [null, {...data,weights:{...WEIGHTS,T1:NaN}}, {...data,baseline:{...BASELINE,nura:{...BASELINE.nura,S1:-1}}},
      {...data,districts:DISTRICTS.slice(1)}, {...data,catalogue:CATALOGUE.slice(1)}, {...data,rules:{...RULES,horizon:9}},
      {...data,catalogue:CATALOGUE.map(m => m.id==='M2'?{...m,scope:'district'}:m)},
      {...data,synergies:[...SYNERGIES.slice(1),{ids:['M2','M1'],indicatorId:'T1',amount:2}]}]) {
      expect(validateScenario(bad).length).toBeGreaterThan(0);
    }
  });
  it('checks every selection order, with immutable results and source data',() => {
    const plan = oracle.cases.sourceExample.plan, expected = evaluate(plan);
    const permutations = (p:Plan):Plan[] => p.length ? p.flatMap((d,i) => permutations(p.filter((_,j) => i!==j)).map(rest => [d,...rest])) : [[]];
    for (const p of permutations(plan)) expect(evaluate(p)).toEqual(expected);
    expect(Object.isFrozen(expected)).toBe(true);
    expect(Object.isFrozen(expected.indicatorEvidence[0]?.measureEffects)).toBe(true);
    expect(Object.isFrozen(expected.plan[0])).toBe(true);
    expect(BASELINE).toEqual(oracle.baseline);
  });
});

describe('one evidence identity for plans, explanations and authored residents',() => {
  it('provides all pairs and disjoint measure/synergy facts scoped to the exact plan',() => {
    const r = evaluate(oracle.cases.sourceExample.plan), facts = scenarioEvidence(r);
    expect(r.resultId).toBe(resultIdentity(r.plan));
    expect(r.indicatorEvidence).toHaveLength(50);
    expect(new Set(facts.map(e => e.ref)).size).toBe(facts.length);
    expect(r.indicatorEvidence.find(e => e.ref === 'indicator:nura:B1')).toMatchObject({baseline:55,updated:67.5,change:12.5,clipping:0});
    expect(r.baselineAssessment).toBe(BASELINE_ASSESSMENT);
    const state = appReducer(initialState(r.plan),{type:'evaluate'});
    for (const person of RESIDENTS) {
      const e = observe(person,state).evidence;
      expect(e.resultId).toBe(r.resultId);
      expect(e.districtId).toBe(person.location);
      expect(e.refs.every(ref => facts.some(f => f.ref === ref))).toBe(true);
    }
  });
  it('distinguishes citywide applicability, district proposals and actual result effects',() => {
    expect(proposalEvidence(city('M12'))).toMatchObject({kind:'catalogue',cost:14,districtIds:DISTRICT_IDS,effects:[{indicatorId:'C2',fullEffect:5,beforeClipping:4.375}]});
    expect(proposalEvidence(local('M5','saryarka'))).toMatchObject({districtIds:['saryarka']});
    expect(proposalEvidence({initiativeId:'M5',scope:'district',districtId:null}).districtIds).toEqual([]);
    const r = evaluate(oracle.cases.sourceExample.plan);
    expect(r.plan.filter(d => d.initiativeId==='M12')).toHaveLength(1);
    expect(r.measureContributions.filter(c => c.initiativeIds.includes('M12'))).toHaveLength(5);
  });
  it('reports clipping separately from contributed effects on an isolated primitive fixture',() => {
    const contributions:Contribution[] = [{districtId:'nura',indicatorId:'S1',amount:100,initiativeIds:['M7']},{districtId:'nura',indicatorId:'T1',amount:-100,initiativeIds:['M11']}];
    const values = applyContributions(BASELINE,contributions);
    const ledger = indicatorLedger(BASELINE,values,contributions,[]);
    expect(ledger.find(e => e.ref==='indicator:nura:S1')).toMatchObject({baseline:38,beforeClipping:138,updated:100,change:62,clipping:-38});
    expect(ledger.find(e => e.ref==='indicator:nura:T1')).toMatchObject({baseline:55,beforeClipping:-45,updated:0,change:-55,clipping:45});
  });
  it('does not hardcode the weakest district or clamp final scores; threshold uses raw values',() => {
    const uniform = (n:number) => Object.fromEntries(DISTRICT_IDS.map(d => [d,Object.fromEntries(INDICATOR_IDS.map(k => [k,n]))])) as IndicatorMatrix;
    const values = uniform(40);
    const r = assessIndicators({...values,saryarka:{...values.saryarka,T1:39.9999999}});
    expect(r.weakestDistricts).toEqual(['saryarka']);
    expect(r.criticalPairs).toHaveLength(1);
    expect(assessIndicators(uniform(0)).finalScore).toBe(-50);
  });
  it('compares only complete results sharing baseline/version and ignores supplied score fields',() => {
    const a = evaluate(oracle.cases.negative.plan), b = evaluate(oracle.cases.revision.plan);
    const c = compareScenarios({...a,finalScore:999},b);
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.scoreChange).toBeCloseTo(oracle.cases.revision.finalScore-oracle.cases.negative.finalScore,11);
    expect(compareScenarios({...a,plan:a.plan.slice(1)},b).ok).toBe(false);
    expect(compareScenarios({...a,scenarioVersion:'old'},b)).toEqual({ok:false,reason:'different_model'});
    expect(compareScenarios({...a,scenarioVersion:'old'},{...b,scenarioVersion:'old'})).toEqual({ok:false,reason:'different_model'});
    expect(compareScenarios({...a,baseline:{...BASELINE,nura:{...BASELINE.nura,S1:99}}},b).ok).toBe(false);
  });
  it('makes revision non-current immediately; rejects late results even after replay',() => {
    const first = appReducer(initialState(oracle.cases.sourceExample.plan),{type:'evaluate'});
    expect(appReducer(first,{type:'evaluate'})).toBe(first);
    const noOp = appReducer(appReducer(first,{type:'selectCommitment',initiativeId:'M7'}),{type:'confirm'});
    expect(noOp.result).toBe(first.result);
    const revised = appReducer(first,{type:'revise'});
    expect(revised.result).toBeNull();
    expect(revised.previousResult).toBe(first.result!.value);
    expect(isCurrentResult(revised.plan,revised.revision,first.result)).toBe(false);
    const replay = appReducer(revised,{type:'evaluate'});
    expect(replay.result!.value).toEqual(first.result!.value);
    const restarted = appReducer(replay,{type:'restart'});
    expect(restarted.previousResult).toBeNull();
    expect(isCurrentResult(first.plan,restarted.revision,first.result)).toBe(false);
    const corrupt = {...first,plan:[local('M4')]};
    expect(appReducer(corrupt,{type:'evaluate'}).result).toBeNull();
    expect(isCurrentResult(first.plan,first.revision,{revision:first.revision,value:{...first.result!.value,scenarioVersion:SCENARIO_VERSION+'old'}})).toBe(false);
  });
});
