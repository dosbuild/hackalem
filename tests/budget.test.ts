import { describe, it, expect } from 'vitest';
import { appReducer, initialState } from '../src/app/state';
import type { AppState, Action } from '../src/app/state';
import { budgetStatus, channelMax, projectsIn } from '../src/app/budget';
import { AREA_IDS } from '../src/domain/types';
import type { InitiativeId, DistrictId } from '../src/domain/types';
import { CATALOGUE, INITIATIVES } from '../src/domain/scenario';
import { evaluatePlan } from '../src/domain/evaluate';
import { planFingerprint } from '../src/domain/identity';

function step(state:AppState,action:Action) {
 const next=appReducer(state,action),money=budgetStatus(next);
 expect(money.locked+money.fluid+money.free).toBe(100);
 expect(money.free).toBeGreaterThanOrEqual(0);
 for(const amount of Object.values(next.budget.allocations)){expect(amount).toBeGreaterThanOrEqual(0);expect(Number.isInteger(amount)).toBe(true);}
 return next;
}
function fund(state:AppState,id:InitiativeId,district:DistrictId='esil'){
 state=step(state,{type:'district',districtId:district});
 return step(state,{type:'allocate',area:INITIATIVES[id].area,value:INITIATIVES[id].cost,initiativeId:id});
}
function commit(state:AppState,id:InitiativeId,district:DistrictId='esil'){return step(fund(state,id,district),{type:'confirm'});}

describe('One finite treasury, existing decisions',()=>{
 it.each(CATALOGUE)('$id reaches its authoritative notch and commits its exact cost',item=>{
   let state=fund(initialState(),item.id);
   expect(budgetStatus(state)).toMatchObject({locked:0,fluid:item.cost,free:100-item.cost,ready:true,progress:1});
   expect(state.candidate!.decision.scope).toBe(item.scope);
   if(item.scope==='citywide')expect(state.candidate!.decision).not.toHaveProperty('districtId');
   state=step(state,{type:'confirm'});
   expect(state.plan.map(d=>d.initiativeId)).toEqual([item.id]);
   expect(budgetStatus(state)).toMatchObject({locked:item.cost,fluid:0,free:100-item.cost});
   state=step(state,{type:'remove',initiativeId:item.id});
   expect(budgetStatus(state)).toMatchObject({locked:0,fluid:0,free:100});
 });
 it('only reallocates fluid money and explains its source',()=>{
   let s=initialState();
   s=step(s,{type:'allocate',area:'transport',value:40});
   s=step(s,{type:'allocate',area:'environment',value:35});
   s=step(s,{type:'allocate',area:'social',value:34});
   expect(s.budget.allocations).toMatchObject({transport:31,environment:35,social:34});
   expect(budgetStatus(s)).toMatchObject({free:0,fluid:100,locked:0});
   expect(s.budget.movement?.taken.transport).toBe(9);
   expect(s.plan).toEqual([]);
 });
 it('a thousand gestures preserve the locked plan and exact accounting',()=>{
   let s=commit(commit(initialState(),'M4'),'M7','nura');const original=planFingerprint(s.plan);
   let seed=412;
   for(let i=0;i<1000;i++){seed=(seed*1664525+1013904223)>>>0;const area=AREA_IDS[i%5]!;s=step(s,{type:'allocate',area,value:seed%(channelMax(area)+1)});expect(planFingerprint(s.plan)).toBe(original);expect(budgetStatus(s).locked).toBe(39);}
 });
 it('stops at the unlocked ceiling and never removes a commitment',()=>{
   let s=commit(commit(commit(initialState(),'M3'),'M5','nura'),'M7','almaty');
   s=step(s,{type:'allocate',area:'municipal',value:38});
   expect(budgetStatus(s)).toMatchObject({locked:79,fluid:21,free:0});
   expect(s.budget.movement).toMatchObject({resisted:true,received:21,requested:38});
   expect(s.plan.map(d=>d.initiativeId)).toEqual(['M3','M5','M7']);
 });
 it('keeps partial previews provisional, cancel returns only fluid funds',()=>{
   let s=commit(initialState(),'M4');s=step(s,{type:'allocate',area:'social',value:5});
   expect(budgetStatus(s).progress).toBe(.5);expect(s.result).toBeNull();
   s=step(s,{type:'cancel'});expect(budgetStatus(s)).toMatchObject({locked:15,free:85,fluid:0});
 });
 it('rejects same-district conflict; another district recovers without changing the park',()=>{
   let s=fund(commit(initialState(),'M4'),'M7');const plan=s.plan;
   expect(budgetStatus(s).issues[0]?.code).toBe('incompatible');s=step(s,{type:'confirm'});expect(s.plan).toBe(plan);
   s=step(s,{type:'district',districtId:'nura'});expect(budgetStatus(s).ready).toBe(true);s=step(s,{type:'confirm'});expect(s.plan).toHaveLength(2);
 });
 it('replacement credit remains locked and refunds exact differences only on confirmation',()=>{
   let s=fund(commit(initialState(),'M4'),'M7');s=step(s,{type:'replaceConflict',initiativeId:'M4'});
   expect(budgetStatus(s)).toMatchObject({locked:15,fluid:9,free:76,credit:15,covered:24});
   expect(s.plan[0]?.initiativeId).toBe('M4');s=step(s,{type:'confirm'});expect(budgetStatus(s)).toMatchObject({locked:24,free:76,fluid:0});
   s=step(s,{type:'selectCommitment',initiativeId:'M7'});s=fund(s,'M9');expect(s.plan[0]?.initiativeId).toBe('M7');s=step(s,{type:'confirm'});
   expect(budgetStatus(s)).toMatchObject({locked:10,free:90,fluid:0});
 });
 it('switching a replacement target preserves intended funding, while both old decisions stay locked',()=>{
   let s=fund(commit(commit(initialState(),'M1'),'M2'),'M3');
   s=step(s,{type:'replaceConflict',initiativeId:'M2'});expect(budgetStatus(s)).toMatchObject({locked:40,fluid:8,credit:22,covered:30});
   s=step(s,{type:'replaceConflict',initiativeId:'M1'});expect(budgetStatus(s)).toMatchObject({locked:40,fluid:12,free:48,credit:18,covered:30,ready:true});
   expect(s.plan.map(d=>d.initiativeId)).toEqual(['M1','M2']);s=step(s,{type:'confirm'});expect(budgetStatus(s)).toMatchObject({locked:52,free:48});
 });
 it('committing consumes only its channel; unrelated exploration survives',()=>{
   let s=step(initialState(),{type:'allocate',area:'transport',value:18});s=fund(s,'M4');s=step(s,{type:'confirm'});
   expect(budgetStatus(s)).toMatchObject({locked:15,fluid:18,free:67});
 });
 it('all notches come from scenario data, and gestures handle invalid input',()=>{
   expect(AREA_IDS.flatMap(a=>projectsIn(a).map(i=>i.id)).sort()).toEqual(CATALOGUE.map(i=>i.id).sort());
   const s=initialState();expect(appReducer(s,{type:'allocate',area:'social',value:NaN})).toBe(s);
 });
 it('five exact decisions and the same evaluator regardless of exploratory allocations',()=>{
   let s=initialState();for(const id of ['M4','M8','M11','M12','M14'] as const)s=commit(s,id,id==='M8'?'nura':id==='M11'?'almaty':'esil');
   expect(s.plan).toHaveLength(5);const expected=evaluatePlan(s.plan);expect(expected.ok).toBe(true);
   s=step(s,{type:'allocate',area:'transport',value:40});expect(budgetStatus(s).issues.some(i=>i.code==='too_many')).toBe(true);
   const plan=s.plan;s=step(s,{type:'confirm'});expect(s.plan).toBe(plan);s=step(s,{type:'cancel'});s=step(s,{type:'evaluate'});
   if(expected.ok)expect(s.result?.value).toEqual(expected.result);
   expect(budgetStatus(s)).toMatchObject({free:25,locked:75,fluid:0});
 });
 it('districts remain required, duplicates and the area cap remain authoritative',()=>{
   let s=step(initialState(),{type:'allocate',area:'environment',value:15});s=step(s,{type:'confirm'});expect(s.plan).toHaveLength(0);
   s=commit(s,'M1');s=fund(s,'M1');expect(budgetStatus(s).issues.some(i=>i.code==='duplicate')).toBe(true);s=step(s,{type:'cancel'});
   s=commit(s,'M2');s=fund(s,'M3');expect(budgetStatus(s).issues.map(i=>i.code)).toEqual(expect.arrayContaining(['area_limit','incompatible']));
 });
 it('alternative gestures preserve all accepted decisions and discard returns their treasury',()=>{
   let s=initialState();for(const id of ['M4','M8','M11','M12','M14'] as const)s=commit(s,id,id==='M8'?'nura':'esil');
   s=step(s,{type:'evaluate'});const original=s.plan;s=step(s,{type:'beginAlternative',initiativeId:'M4'});s=fund(s,'M5');
   expect(budgetStatus(s)).toMatchObject({locked:75,fluid:10,free:15,credit:15});expect(s.plan).toBe(original);
   s=step(s,{type:'confirm'});expect(s.alternative?.result).toBeTruthy();expect(s.plan).toBe(original);
   s=step(s,{type:'discardAlternative'});expect(s.plan).toBe(original);expect(budgetStatus(s)).toMatchObject({locked:75,free:25,fluid:0});
 });
});
