import {describe,it,expect} from 'vitest';
import {evaluatePlan} from '../src/domain/evaluate';
import type {Plan} from '../src/domain/types';
import {currentPresentationResult,projectPresentation} from '../src/world/project-presentation';

const plan:Plan=[
 {initiativeId:'M4',scope:'district',districtId:'esil'},
 {initiativeId:'M8',scope:'district',districtId:'nura'},
 {initiativeId:'M11',scope:'district',districtId:'nura'},
 {initiativeId:'M12',scope:'citywide'},
 {initiativeId:'M10',scope:'district',districtId:'nura'},
];
function fixture(){const evaluated=evaluatePlan(plan);if(!evaluated.ok)throw Error('Presentation fixture must be a valid complete plan');return {commitments:plan,result:{revision:8,value:evaluated.result},scenarioRevision:8,comparisonPosition:1};}

describe('visible project consequences use the authoritative ledger',()=>{
 it('shows a physical baseline and evaluated future without changing any result',()=>{
  const props=fixture(),before=JSON.stringify(props.result.value);
  expect(projectPresentation({...props,comparisonPosition:0},'M4','esil').phase).toBe('baseline');
  expect(projectPresentation(props,'M4','esil').phase).toBe('evaluated');
  expect(projectPresentation(props,'M4','esil',true)).toEqual({phase:'preview',evidence:[],resultId:null});
  expect(JSON.stringify(props.result.value)).toBe(before);
 });
 it('retains signed tradeoffs and exact evidence references including synergies',()=>{
  const props=fixture(),crossing=projectPresentation(props,'M11','nura'),clinic=projectPresentation(props,'M8','nura');
  const traffic=crossing.evidence.find(row=>row.indicatorId==='T1')!;
  expect(traffic.measureEffects.find(e=>e.initiativeIds.includes('M11'))!.amount).toBeLessThan(0);
  for(const row of [...crossing.evidence,...clinic.evidence])expect(props.result.value.indicatorEvidence).toContain(row);
  const municipal=projectPresentation(props,'M12','nura');
  expect(municipal.evidence.some(row=>row.synergies.some(e=>e.initiativeIds.includes('M12')))).toBe(true);
  expect(projectPresentation(props,'M8','esil').evidence).toEqual([]);
 });
 it('rejects stale revisions, mismatched plans and forged result identities',()=>{
  const props=fixture();
  for(const invalid of [
   {...props,scenarioRevision:9},
   {...props,commitments:plan.slice(1)},
   {...props,result:{...props.result,value:{...props.result.value,resultId:'wrong'}}},
  ]){expect(currentPresentationResult(invalid)).toBeNull();expect(projectPresentation(invalid,'M8','nura').phase).toBe('planned');}
 });
 it('shares immutable evidence for repeated frames and treats an unfinished plan as delivered, unevaluated places',()=>{
  const props=fixture();expect(projectPresentation(props,'M4','esil').evidence).toBe(projectPresentation(props,'M4','esil').evidence);
  expect(Object.isFrozen(projectPresentation(props,'M4','esil').evidence)).toBe(true);
  expect(projectPresentation({...props,result:null},'M4','esil')).toEqual({phase:'planned',evidence:[],resultId:null});
 });
});
