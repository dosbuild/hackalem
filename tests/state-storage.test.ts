import { describe, expect, it } from 'vitest';
import { appReducer, initialState } from '../src/app/state';
import { decodeDraft, loadDraft, saveDraft, STORAGE_KEY } from '../src/app/storage';
import type { StoragePort } from '../src/app/storage';
import { SCENARIO_VERSION } from '../src/domain/scenario';
import { summarizePlan } from '../src/domain/plan';
import { city, exactBudget, fixture, local } from './fixtures';

describe('business state',() => {
  it('candidate selection and camera focus do not spend or invalidate an evaluated result',() => {
    const evaluated = appReducer(initialState(fixture),{ type:'evaluate' });
    const candidate = appReducer(evaluated,{ type:'choose', initiativeId:'M5' });
    const focused = appReducer(candidate,{ type:'district', districtId:'esil' });
    expect(focused.plan).toBe(evaluated.plan);
    expect(focused.result).toBe(evaluated.result);
    expect(focused.revision).toBe(0);
    expect(summarizePlan(focused.plan).remaining).toBe(14);
    expect(focused.candidate?.decision).toEqual(local('M5','esil'));
  });
  it('switching from district to citywide clears district from the candidate',() => {
    const selected = appReducer(initialState(),{ type:'district', districtId:'nura' });
    const localCandidate = appReducer(selected,{ type:'choose', initiativeId:'M4' });
    const cityCandidate = appReducer(localCandidate,{ type:'choose', initiativeId:'M2' });
    expect(cityCandidate.candidate?.decision).toEqual(city('M2'));
    expect('districtId' in cityCandidate.candidate!.decision).toBe(false);
  });
  it('accepted replacements invalidate results and reset comparison at a new revision',() => {
    const evaluated = appReducer(initialState(exactBudget),{ type:'evaluate' });
    const editing = appReducer(evaluated,{ type:'selectCommitment', initiativeId:'M14' });
    const proposed = appReducer(editing,{ type:'choose', initiativeId:'M10' });
    const scoped = appReducer(proposed,{ type:'district', districtId:'esil' });
    const saved = appReducer(scoped,{ type:'confirm' });
    expect(saved.plan).toHaveLength(5);
    expect(saved.result).toBeNull();
    expect(saved.candidate).toBeNull();
    expect(saved.comparisonPosition).toBe(0);
    expect(saved.revision).toBe(1);
    const recomputed = appReducer(saved,{ type:'evaluate' });
    expect(recomputed.result?.revision).toBe(1);
    expect(recomputed.result?.value.plan.some(d => d.initiativeId === 'M14')).toBe(false);
  });
  it('rejection and cancellation preserve a current result and the exact plan',() => {
    const evaluated = appReducer(initialState(exactBudget),{ type:'evaluate' });
    const selected = appReducer(evaluated,{ type:'selectCommitment', initiativeId:'M6' });
    const proposed = appReducer(appReducer(selected,{ type:'choose', initiativeId:'M5' }),{ type:'district', districtId:'esil' });
    const rejected = appReducer(proposed,{ type:'confirm' });
    expect(rejected.issues).toContainEqual({ code:'budget', amount:5 });
    expect(rejected.result).toBe(evaluated.result);
    expect(rejected.plan).toBe(evaluated.plan);
    expect(rejected.revision).toBe(evaluated.revision);
    const cancelled = appReducer(rejected,{ type:'cancel' });
    expect(cancelled.result).toBe(evaluated.result);
    expect(cancelled.plan).toBe(evaluated.plan);
    expect(cancelled.candidate).toBeNull();
  });
  it('removal, addition, and move through confirmation all invalidate evaluation',() => {
    const evaluated = appReducer(initialState(fixture),{ type:'evaluate' });
    const editing = appReducer(evaluated,{ type:'selectCommitment', initiativeId:'M8' });
    const moved = appReducer(appReducer(editing,{ type:'district', districtId:'esil' }),{ type:'confirm' });
    expect(moved.result).toBeNull();
    expect(moved.plan.find(d => d.initiativeId === 'M8')).toEqual(local('M8','esil'));
    const removed = appReducer(evaluated,{ type:'remove', initiativeId:'M1' });
    expect(removed.result).toBeNull();
    expect(removed.plan).toHaveLength(4);
    expect(appReducer(removed,{ type:'evaluate' }).result).toBeNull();
    const added = appReducer(appReducer(removed,{ type:'choose', initiativeId:'M6' }),{ type:'confirm' });
    expect(added.plan).toHaveLength(5);
    expect(added.result).toBeNull();
  });
  it('comparison is presentation only; camera requests have stable identities',() => {
    const evaluated = appReducer(initialState(fixture),{ type:'evaluate' });
    const compared = appReducer(evaluated,{ type:'compare', position:.37 });
    expect(compared.result).toBe(evaluated.result);
    expect(compared.plan).toBe(evaluated.plan);
    expect(compared.cameraRequest).toBe(evaluated.cameraRequest);
    expect(appReducer(compared,{ type:'overview' }).cameraRequest.id).toBe(compared.cameraRequest.id + 1);
    expect(appReducer(compared,{ type:'compare', position:NaN })).toBe(compared);
    expect(appReducer(initialState(),{ type:'compare', position:1 }).comparisonPosition).toBe(0);
  });
  it('resident location focus cannot retarget a candidate or edit a result',() => {
    const s = appReducer(appReducer(initialState(fixture),{ type:'evaluate' }),{ type:'choose', initiativeId:'M5' });
    const focused = appReducer(s,{ type:'focusLocation', districtId:'esil', anchorId:'school-west' });
    expect(focused.candidate).toBe(s.candidate);
    expect(focused.plan).toBe(s.plan);
    expect(focused.result).toBe(s.result);
    expect(focused.revision).toBe(s.revision);
    expect(focused.cameraRequest).toEqual({ id:1, kind:'location', districtId:'esil', anchorId:'school-west' });
  });
  it('restart clears all transient and committed state and restores budget',() => {
    const evaluated = appReducer(initialState(fixture,true),{ type:'evaluate' });
    const chosen = appReducer(evaluated,{ type:'selectCommitment', initiativeId:'M1' });
    const reset = appReducer(chosen,{ type:'restart' });
    expect(reset).toMatchObject({ plan:[], candidate:null, result:null, focusedDistrict:null, selectedCommitment:null, comparisonPosition:0, issues:[], welcomeDismissed:false });
    expect(summarizePlan(reset.plan).remaining).toBe(100);
    expect(reset.cameraRequest.kind).toBe('overview');
    expect(reset.cameraRequest.id).toBeGreaterThan(chosen.cameraRequest.id);
  });
});

function memoryStorage():StoragePort {
  const values = new Map<string,string>();
  return { getItem:key => values.get(key) ?? null, setItem:(key,value) => { values.set(key,value); }, removeItem:key => { values.delete(key); } };
}
const saved = (plan:unknown = fixture) => ({ schemaVersion:1, scenarioVersion:SCENARIO_VERSION, plan, preferences:{ welcomeDismissed:true } });

describe('small versioned local recovery',() => {
  it('restores only the validated plan and preference, recomputing derived state',() => {
    const restored = decodeDraft(JSON.stringify({ ...saved(), budget:999, score:999, result:{ finalScore:999 }, revision:100 }));
    expect(restored).toEqual({ plan:fixture, welcomeDismissed:true, notice:'restored' });
    const state = initialState(restored.plan,restored.welcomeDismissed);
    expect(state.result).toBeNull();
    expect(state.revision).toBe(0);
    expect(summarizePlan(state.plan).remaining).toBe(14);
  });
  it('saves only plan/version/preference, and restart removes the draft key',() => {
    const store = memoryStorage();
    expect(saveDraft(() => store,{ plan:fixture, welcomeDismissed:true })).toBe(true);
    expect(JSON.parse(store.getItem(STORAGE_KEY)!)).toEqual(saved());
    expect(loadDraft(() => store).plan).toEqual(fixture);
    expect(saveDraft(() => store,{ plan:[], welcomeDismissed:false })).toBe(true);
    expect(store.getItem(STORAGE_KEY)).toBeNull();
  });
  it.each(['{broken','null','[]',JSON.stringify(saved([local('M10'),local('M10')])),JSON.stringify(saved([{ ...city('M2'),districtId:'nura' }])),JSON.stringify(saved([local('M3'),local('M5'),local('M8'),local('M10'),city('M12')])),JSON.stringify({ ...saved(), preferences:{} })])('recovers malformed/illegal drafts safely %#',raw => {
    expect(decodeDraft(raw)).toEqual({ plan:[], welcomeDismissed:false, notice:'corrupt' });
  });
  it.each([{ ...saved(), schemaVersion:2 },{ ...saved(), scenarioVersion:'old-model' }])('rejects obsolete schema/scenario',value => {
    expect(decodeDraft(JSON.stringify(value)).notice).toBe('obsolete');
  });
  it('accepts partial and absent drafts without treating incompleteness as corruption',() => {
    expect(decodeDraft(null).notice).toBeNull();
    expect(decodeDraft(JSON.stringify(saved([local('M9')]))).plan).toEqual([local('M9')]);
  });
  it('handles blocked storage access, read failure, quota failure, and removal failure',() => {
    const fail = ():never => { throw new Error('Storage blocked'); };
    expect(loadDraft(fail).notice).toBe('unavailable');
    const broken:StoragePort = { getItem:fail, setItem:fail, removeItem:fail };
    expect(loadDraft(() => broken).notice).toBe('unavailable');
    expect(saveDraft(() => broken,{ plan:fixture, welcomeDismissed:false })).toBe(false);
    expect(saveDraft(() => broken,{ plan:[], welcomeDismissed:false })).toBe(false);
  });
});
