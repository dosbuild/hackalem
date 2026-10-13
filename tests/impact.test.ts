import {describe,expect,it} from 'vitest';
import {comparisonImpact,leadingProject,resultImpact} from '../src/dashboard/impact';
import {evaluatePlan} from '../src/domain/evaluate';
import type {Plan} from '../src/domain/types';
import {local,city} from './fixtures';

const plan:Plan=[local('M7'),local('M4','saryarka'),local('M11'),city('M12'),city('M14')];
function result(value:Plan){const out=evaluatePlan(value);if(!out.ok)throw new Error('Invalid fixture');return out.result;}
describe('consequences behind the aggregate score',()=>{
 it('surfaces the actual crossing trade-off and recovered school need',()=>{
  const impact=resultImpact(result(plan));
  expect(impact.decreased).toEqual(expect.arrayContaining([expect.objectContaining({districtId:'nura',indicatorId:'T1',baseline:55,updated:53.25})]));
  expect(impact.recovered).toEqual(expect.arrayContaining([expect.objectContaining({districtId:'nura',indicatorId:'S1',baseline:38,updated:48})]));
 });
 it('connects the headline to a funded project and its matching human concern',()=>{
  const outcome=result([local('M3','almaty'),city('M2'),local('M4','esil'),local('M8'),local('M9')]);
  const highlighted=resultImpact(outcome).highlight!;
  expect(highlighted.indicatorId).toBe('S2');expect(leadingProject(highlighted)).toBe('M8');
  expect(outcome.plan.some(d=>d.initiativeId==='M7')).toBe(false);
 });
 it('retains the sports project’s secondary education contribution in the ledger',()=>{
  const outcome=result([local('M3','almaty'),city('M2'),local('M4','esil'),local('M8'),local('M9')]);
  const secondary=outcome.indicatorEvidence.find(e=>e.districtId==='nura'&&e.indicatorId==='S1')!;
  expect(leadingProject(secondary)).toBe('M9');expect(secondary.updated).toBeCloseTo(40.625);
 });
 it('warns that relocating a school reintroduces a critical need in the original district',()=>{
  const before=result(plan),after=result([local('M7','esil'),...plan.slice(1)]);
  const impact=comparisonImpact(before,after);
  expect(impact.losses).toEqual([{districtId:'nura',indicatorId:'S1',before:48,after:38,change:-10}]);
  expect(impact.newlyCritical).toEqual(impact.losses);
  expect(comparisonImpact(before,before).losses).toEqual([]);
 });
});
