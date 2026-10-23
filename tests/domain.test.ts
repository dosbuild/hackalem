import { describe, expect, it } from 'vitest';
import { applyEdit, summarizePlan, validateCompletePlan, validateDraft } from '../src/domain/plan';
import { applyContributions, assessIndicators, BASELINE_ASSESSMENT, evaluatePlan } from '../src/domain/evaluate';
import { BASELINE, CATALOGUE, DISTRICTS, WEIGHTS } from '../src/domain/scenario';
import { DISTRICT_IDS, INDICATOR_IDS } from '../src/domain/types';
import type { IndicatorMatrix, Plan } from '../src/domain/types';
import { city, exactBudget, fixture, local } from './fixtures';

const codes = (plan:unknown) => { const v = validateDraft(plan); return v.issues.map(i => i.code); };
function evaluate(plan:Plan) { const outcome = evaluatePlan(plan); if (!outcome.ok) throw new Error(JSON.stringify(outcome.issues)); return outcome.result; }

describe('scenario and validation',() => {
  it('has normalized population/weights and immutable authoritative data',() => {
    expect(DISTRICTS.reduce((n,d) => n + d.populationShare,0)).toBeCloseTo(1,12);
    expect(Object.values(WEIGHTS).reduce((a,b) => a + b,0)).toBeCloseTo(1,12);
    expect(CATALOGUE).toHaveLength(14);
    expect(Object.isFrozen(BASELINE.nura)).toBe(true);
    expect(Object.isFrozen(CATALOGUE[0]?.effects)).toBe(true);
  });
  it('distinguishes partial drafts and complete plans; incomplete drafts have no final result',() => {
    expect(validateDraft([]).status).toBe('partial');
    expect(validateDraft([local('M4')]).issues).toEqual([]);
    expect(validateCompletePlan(fixture).status).toBe('complete');
    expect(evaluatePlan([])).toEqual({ ok:false, issues:[{ code:'incomplete', amount:5 }] });
    expect(evaluatePlan([local('M4')]).ok).toBe(false);
  });
  it('does not require every policy area or full budget usage',() => {
    const v = validateDraft(fixture);
    expect(v.status).toBe('complete');
    expect(summarizePlan(fixture)).toMatchObject({ spent:86, remaining:14, count:5, areaCounts:{ environment:0 }, canEvaluate:true });
  });
  it('enforces exactly five distinct initiatives, globally',() => {
    expect(codes([local('M10'),local('M10','esil')])).toContain('duplicate');
    expect(codes([local('M1'),local('M4'),local('M9'),local('M10'),local('M11'),city('M12')])).toContain('too_many');
  });
  it('accepts exactly 100 and rejects 101',() => {
    expect(validateDraft(exactBudget).status).toBe('complete');
    expect(summarizePlan(exactBudget).remaining).toBe(0);
    const v = validateDraft([local('M3'),local('M5'),local('M8'),local('M10'),city('M12')]);
    expect(v.issues).toContainEqual({ code:'budget', amount:1 });
    expect(evaluatePlan([local('M3'),local('M5'),local('M8'),local('M10'),city('M12')]).ok).toBe(false);
  });
  it('enforces two per area',() => {
    expect(codes([local('M7'),local('M8')])).toEqual([]);
    expect(codes([local('M7'),local('M8'),local('M9')])).toContain('area_limit');
  });
  it.each([null,{},[null],[{ initiativeId:'M99', scope:'citywide' }],[{ initiativeId:'M1',scope:'district',districtId:'unknown' }],[{ initiativeId:'M1',scope:'district' }],[{ initiativeId:'M1',scope:'district',districtId:null }],[{ initiativeId:'M1',scope:'citywide' }],[{ initiativeId:'M2',scope:'citywide',districtId:'nura' }],[{ initiativeId:'M2',scope:'citywide',districtId:undefined }],[{ initiativeId:'M2',scope:'district',districtId:'nura' }],[{ ...city('M2'), cost:0 }]])('rejects malformed runtime input %#',input => {
    expect(validateDraft(input).status).toBe('invalid');
  });
  it('rejects M1 + M3 even in different districts',() => {
    expect(codes([local('M1','esil'),local('M3','nura')])).toContain('incompatible');
  });
  it.each([['M4','M7'],['M5','M13']] as const)('enforces local incompatibility %s + %s', (a,b) => {
    expect(codes([local(a,'esil'),local(b,'esil')])).toContain('incompatible');
    expect(codes([local(a,'esil'),local(b,'nura')])).toEqual([]);
  });
});

describe('edits are atomic and use the same rules',() => {
  it('replaces at five decisions without double charging or a sixth slot',() => {
    const outcome = applyEdit(exactBudget,{ kind:'replace', target:'M14', decision:local('M10') });
    expect(outcome.accepted).toBe(true);
    expect(outcome.plan).toHaveLength(5);
    expect(summarizePlan(outcome.plan).spent).toBe(96);
    expect(exactBudget[4]).toEqual(city('M14'));
  });
  it('preserves the original object and contents on a rejected replacement',() => {
    const before = JSON.stringify(exactBudget);
    const outcome = applyEdit(exactBudget,{ kind:'replace', target:'M6', decision:local('M5') });
    expect(outcome.accepted).toBe(false);
    expect(outcome.plan).toBe(exactBudget);
    expect(JSON.stringify(exactBudget)).toBe(before);
  });
  it('validates moves and removals; unknown targets cannot append',() => {
    const plan = [local('M4','esil'),local('M7','nura')];
    expect(applyEdit(plan,{ kind:'move', target:'M7', districtId:'esil' }).accepted).toBe(false);
    expect(applyEdit(plan,{ kind:'move', target:'M7', districtId:'almaty' }).accepted).toBe(true);
    expect(applyEdit([city('M2')],{ kind:'move', target:'M2', districtId:'esil' }).accepted).toBe(false);
    expect(applyEdit(plan,{ kind:'remove', target:'M4' }).plan).toEqual([local('M7','nura')]);
    expect(applyEdit(plan,{ kind:'replace', target:'M8', decision:city('M2') }).accepted).toBe(false);
    expect(applyEdit(plan,{ kind:'add', decision:local('M7','almaty') }).accepted).toBe(false);
    expect(plan).toEqual([local('M4','esil'),local('M7','nura')]);
  });
});

describe('independently checked assessment',() => {
  it('matches baseline arithmetic with two strict critical pairs',() => {
    const expected = { esil:62.99, almaty:57.06, saryarka:54.65, baikonur:56.63, nura:49.18 };
    for (const d of DISTRICT_IDS) expect(BASELINE_ASSESSMENT.districtScores[d]).toBeCloseTo(expected[d],10);
    expect(BASELINE_ASSESSMENT.cityAverage).toBeCloseTo(56.8624,10);
    expect(BASELINE_ASSESSMENT.criticalPairs).toHaveLength(2);
    expect(BASELINE_ASSESSMENT.weakestDistricts).toEqual(['nura']);
    expect(BASELINE_ASSESSMENT.finalScore).toBeCloseTo(52.55768,10);
  });
  it('matches a complete plan checked with rational arithmetic, without a spending bonus',() => {
    const r = evaluate(fixture);
    expect(r.indicators.nura).toEqual({ T1:64.5,T2:46.75,E1:45,E2:65,S1:38,S2:43.75,B1:55,B2:52.25,C1:60,C2:54.375 });
    expect(r.districtScores.nura).toBeCloseTo(52.4075,10);
    expect(r.districtScores.saryarka).toBeCloseTo(56.8725,10);
    expect(r.cityAverage).toBeCloseTo(58.4249,10);
    expect(r.finalScore).toBeCloseTo(55.61968,10);
    expect(r.criticalPairs).toEqual([{ districtId:'nura', indicatorId:'S1', value:38 }]);
    expect(r.changes.nura.T1).toBe(9.5);
    expect(r.synergyContributions).toEqual([
      { districtId:'nura', indicatorId:'T1', amount:2, initiativeIds:['M1','M2'] },
      { districtId:'saryarka', indicatorId:'B1', amount:2, initiativeIds:['M10','M12'] },
    ]);
  });
  it('scales lag and applies negative effects without reversing indicator orientation',() => {
    const r = evaluate([local('M11','almaty'),local('M4','esil'),local('M8'),city('M12'),city('M14')]);
    expect(r.indicators.almaty.T1).toBe(38.25);
    expect(r.changes.almaty.B2).toBe(10.5);
    expect(r.measureContributions).toContainEqual({ districtId:'almaty', indicatorId:'T1', amount:-1.75, initiativeIds:['M11'] });
    const lrt = evaluate([local('M3'),local('M4','esil'),local('M9','almaty'),local('M10','saryarka'),city('M12')]);
    expect(lrt.changes.nura.T1).toBe(8);
    expect(lrt.changes.nura.T2).toBe(10);
    expect(lrt.changes.nura.E2).toBe(2);
  });
  it('applies the environmental fixed synergy only in the local measure district',() => {
    const r = evaluate([local('M5'),city('M6'),local('M9','esil'),local('M10','almaty'),city('M12')]);
    expect(r.indicators.nura.E2).toBe(77.25);
    expect(r.changes.esil.E2).toBe(1.5);
    expect(r.synergyContributions).toContainEqual({ districtId:'nura', indicatorId:'E2', amount:2, initiativeIds:['M5','M6'] });
    expect(r.synergyContributions.filter(c => c.indicatorId === 'E2')).toHaveLength(1);
  });
  it('clips after summation at both bounds, without touching baseline',() => {
    const before = JSON.stringify(BASELINE);
    const next = applyContributions(BASELINE,[
      { districtId:'esil', indicatorId:'T1', amount:100, initiativeIds:['M1'] },
      { districtId:'esil', indicatorId:'T1', amount:-60, initiativeIds:['M11'] },
      { districtId:'nura', indicatorId:'S1', amount:100, initiativeIds:['M7'] },
      { districtId:'nura', indicatorId:'T1', amount:-100, initiativeIds:['M11'] },
    ]);
    expect(next.esil.T1).toBe(85);
    expect(next.nura.S1).toBe(100);
    expect(next.nura.T1).toBe(0);
    expect(JSON.stringify(BASELINE)).toBe(before);
  });
  it('uses population weights, reports ties, and counts strictly below 40',() => {
    const uniform = Object.fromEntries(DISTRICT_IDS.map(d => [d,Object.fromEntries(INDICATOR_IDS.map(k => [k,40]))])) as IndicatorMatrix;
    const tied = assessIndicators(uniform);
    expect(tied.weakestDistricts).toEqual([...DISTRICT_IDS]);
    expect(tied.criticalPairs).toHaveLength(0);
    expect(tied.finalScore).toBeCloseTo(40,12);
    // Equal weights, different values: the arithmetic tie survives binary float noise.
    expect(assessIndicators({ ...uniform, esil:{ ...uniform.esil, E2:45, S1:35 } }).weakestDistricts).toEqual([...DISTRICT_IDS]);
    const changed = { ...uniform, esil:{ ...uniform.esil, T1:50 }, nura:{ ...uniform.nura, S1:39.999 } };
    const assessment = assessIndicators(changed);
    expect(assessment.criticalPairs).toHaveLength(1);
    expect(assessment.cityAverage).toBeCloseTo(40 + .27 - .00011 * .16,12);
  });
  it('is order independent and does not mutate the plan or baseline',() => {
    const plan = Object.freeze(fixture.map(d => Object.freeze({ ...d })));
    const baseline = JSON.stringify(BASELINE);
    const before = JSON.stringify(plan);
    expect(evaluate([...plan].reverse())).toEqual(evaluate(plan));
    expect(evaluate([plan[2]!,plan[4]!,plan[0]!,plan[3]!,plan[1]!])).toEqual(evaluate(plan));
    expect(JSON.stringify(BASELINE)).toBe(baseline);
    expect(JSON.stringify(plan)).toBe(before);
  });
});
