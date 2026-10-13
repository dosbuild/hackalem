import {describe,it,expect} from 'vitest';
import {appReducer,initialState} from '../src/app/state';
import {constructionProgress,reconcileConstruction} from '../src/app/construction';
import {decodeDraft,saveDraft} from '../src/app/storage';
import {inverseTransaction} from '../src/app/useAutomation';
import type {Plan} from '../src/domain/types';

const school:Plan=[{initiativeId:'M7',scope:'district',districtId:'nura'}];
const park:Plan=[{initiativeId:'M4',scope:'district',districtId:'saryarka'}];
describe('shared product state and ownership',()=>{
 it('rejects a stranded third decision before spending and offers a recoverable partial plan',()=>{
  const plan:Plan=[{initiativeId:'M3',scope:'district',districtId:'nura'},{initiativeId:'M5',scope:'district',districtId:'almaty'}];
  let state=initialState(plan,true);state=appReducer(state,{type:'district',districtId:'esil'});state=appReducer(state,{type:'choose',initiativeId:'M13'});state=appReducer(state,{type:'confirm'});
  expect(state.plan).toEqual(plan);expect(state.revision).toBe(0);expect(state.issues).toEqual([{code:'stranded'}]);
 });
 it('ignores a duplicate apply and rejects asynchronous overwrite of newer decisions',()=>{
  const state=appReducer(initialState(),{type:'applyPlan',plan:school,expectedRevision:0,now:1000});
  const duplicate=appReducer(state,{type:'applyPlan',plan:school,expectedRevision:1,now:2000});
  expect(duplicate).toBe(state);expect(duplicate.construction[0]!.startedAt).toBe(1000);
  const stale=appReducer(state,{type:'applyPlan',plan:park,expectedRevision:0,now:3000});
  expect(stale.plan).toEqual(school);expect(stale.issues).toEqual([{code:'stale'}]);
 });
 it('undo preserves subsequent manual additions, and never overwrites a manually moved Aya project',()=>{
  expect(inverseTransaction([...school,...park],{before:[],after:school})).toEqual(park);
  const moved:Plan=[{initiativeId:'M7',scope:'district',districtId:'almaty'},...park];
  expect(inverseTransaction(moved,{before:[],after:school})).toBeNull();
 });
 it('keeps one construction clock across plan changes and saved draft restoration',()=>{
  const receipts=reconcileConstruction([],school,[],1000),added=reconcileConstruction(school,[...school,...park],receipts,6000);
  expect(added[0]).toBe(receipts[0]);expect(constructionProgress(added[0]!,6000)).toBeCloseTo(.5);
  let raw:string|null=null;const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;},removeItem:()=>{raw=null;}};
  expect(saveDraft(()=>storage,{plan:[...school,...park],welcomeDismissed:true,construction:added})).toBe(true);
  const restored=decodeDraft(raw);expect(restored.construction).toEqual(added);expect(constructionProgress(restored.construction![0]!,20000)).toBe(1);
 });
});
