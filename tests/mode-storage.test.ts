import {describe,expect,it} from 'vitest';
import {createModeStorage,initialMode,modeUrl} from '../src/modes/storage';
import {loadDraft,saveDraft,saveCheckpoint,loadCheckpoint} from '../src/app/storage';
import type {StoragePort} from '../src/app/storage';
import {fixture,local} from './fixtures';
const memoryPort=():StoragePort=>{const values=new Map<string,string>();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}};};
describe('separate world histories',()=>{
 it('preserves unqualified modern drafts and checkpoints, with independent historical writes',()=>{
  const disk=memoryPort();saveDraft(()=>disk,{plan:fixture,welcomeDismissed:true});
  const modern=createModeStorage('astana',()=>disk),past=createModeStorage('khanate',()=>disk);
  expect(loadDraft(()=>modern).plan).toEqual(fixture);expect(loadDraft(()=>past).plan).toEqual([]);
  const historical=[local('M7','esil')];saveDraft(()=>past,{plan:historical,welcomeDismissed:true});
  saveCheckpoint(()=>past,{plan:historical,welcomeDismissed:true});
  expect(loadDraft(()=>modern).plan).toEqual(fixture);expect(loadCheckpoint(()=>modern)).toBeNull();
  expect(loadDraft(()=>createModeStorage('khanate',()=>disk)).plan).toEqual(historical);
  expect(loadCheckpoint(()=>past)?.plan).toEqual(historical);
 });
 it('retains both histories in memory when browser storage rejects writes',()=>{
  const memory=new Map<string,string|null>(),denied=()=>{throw new Error('Denied storage');};
  const a=createModeStorage('astana',denied,memory),b=createModeStorage('khanate',denied,memory);
  expect(saveDraft(()=>a,{plan:fixture,welcomeDismissed:true})).toBe(false);
  expect(saveDraft(()=>b,{plan:[local('M7','nura')],welcomeDismissed:true})).toBe(false);
  expect(loadDraft(()=>createModeStorage('astana',denied,memory)).plan).toEqual(fixture);
  expect(loadDraft(()=>createModeStorage('khanate',denied,memory)).plan).toEqual([local('M7','nura')]);
 });
 it('uses explicit mode first, modern legacy links second, and remembered mode last',()=>{
  expect(initialMode('?mode=khanate&landmark=akorda',()=>null)).toBe('khanate');
  expect(initialMode('?landmark=akorda',()=> 'khanate')).toBe('astana');
  expect(initialMode('',()=> 'khanate')).toBe('khanate');
  expect(initialMode('',()=>{throw Error('denied');})).toBe('astana');
  expect(initialMode('?mode=unknown',()=>null)).toBe('astana');
  expect(modeUrl(new URL('https://example.com/game/?landmark=akorda&x=1'),'khanate').href).toBe('https://example.com/game/?x=1&mode=khanate');
 });
});
