import {describe,expect,it} from 'vitest';
import {appReducer,initialState} from '../src/app/state';
import {loadCheckpoint,saveCheckpoint,CHECKPOINT_KEY,STORAGE_KEY} from '../src/app/storage';
import {summarizePlan} from '../src/domain/plan';
import type {Plan} from '../src/domain/types';

const school:Plan=[{initiativeId:'M7',scope:'district',districtId:'nura'}];
const construction=[{key:'M7:nura',startedAt:1000,durationMs:10000}];
const memory=()=>{const data=new Map<string,string>();return {data,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};};
describe('recoverable plan attempts',()=>{
 it('keeps one validated checkpoint without replacing the active browser draft',()=>{
  const storage=memory();storage.setItem(STORAGE_KEY,'original draft');
  expect(saveCheckpoint(()=>storage,{plan:school,welcomeDismissed:true,construction})).toBe(true);
  expect(storage.getItem(STORAGE_KEY)).toBe('original draft');
  expect(loadCheckpoint(()=>storage)).toMatchObject({plan:school,construction});
 });
 it('rejects corrupted, outdated or forged checkpoint plans',()=>{
  const storage=memory();storage.setItem(CHECKPOINT_KEY,'{');expect(loadCheckpoint(()=>storage)).toBeNull();
  storage.setItem(CHECKPOINT_KEY,JSON.stringify({schemaVersion:1,scenarioVersion:'old',plan:school}));expect(loadCheckpoint(()=>storage)).toBeNull();
  expect(saveCheckpoint(()=>storage,{plan:[...school,...school],welcomeDismissed:true})).toBe(false);
 });
 it('restores exact decisions and their construction clock, with a new revision',()=>{
  const prior=initialState(school,true,construction);
  const fresh=appReducer(prior,{type:'restart'});
  const restored=appReducer(fresh,{type:'restoreDraft',plan:school,construction});
  expect(restored.plan).toEqual(school);expect(restored.construction).toEqual(construction);
  expect(restored.revision).toBeGreaterThan(fresh.revision);expect(restored.welcomeDismissed).toBe(true);
  expect(summarizePlan(restored.plan).remaining).toBe(76);expect(restored.result).toBeNull();
  expect(appReducer(restored,{type:'applyPlan',plan:[],expectedRevision:fresh.revision,now:20000}).plan).toEqual(school);
 });
 it('reports storage failure without throwing or damaging the active draft',()=>{
  const storage=memory();storage.setItem(STORAGE_KEY,'draft');
  expect(saveCheckpoint(()=>({...storage,setItem:()=>{throw new Error('quota');}}),{plan:school,welcomeDismissed:true})).toBe(false);
  expect(storage.getItem(STORAGE_KEY)).toBe('draft');
 });
});
