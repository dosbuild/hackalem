import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';
import {appReducer,displayedState,initialState} from '../src/app/state';
import type {AppState} from '../src/app/state';
import {loadCheckpoint,loadDraft,saveCheckpoint,saveDraft} from '../src/app/storage';
import type {StoragePort} from '../src/app/storage';
import {readPresentation} from '../src/app/presentation';
import {allSwaps} from '../src/core/review';
import {evaluatePlan} from '../src/domain/evaluate';
import {isCurrentResult,planFingerprint} from '../src/domain/identity';
import {validateDraft} from '../src/domain/plan';
import type {Decision,InitiativeId,Plan} from '../src/domain/types';
import {FutureComparison} from '../src/features/Gameplay';
import {ModeProvider} from '../src/modes/context';
import astana from '../src/modes/astana';
import khanate from '../src/modes/khanate';
import type {ModeDefinition} from '../src/modes/types';
import {createModeStorage} from '../src/modes/storage';
import {contentFor} from '../src/modes/content';
import {presentationFor} from '../src/modes/presentation';
import {oracle} from './scenario-oracle';
import {city,local} from './fixtures';

const completed=(plan:Plan=oracle.cases.negative.plan)=>appReducer(initialState(plan,true),{type:'evaluate'});
const direct=(state:AppState,initiativeId:InitiativeId,decision:Decision)=>
  appReducer(state,{type:'beginAlternative',initiativeId,decision,expectedRevision:state.revision});
const renderComparison=(mode:ModeDefinition,state:AppState)=>renderToStaticMarkup(createElement(ModeProvider,{mode,switchMode:()=>{},
  children:createElement(FutureComparison,{state,dispatch:()=>{},district:'esil',onAffected:()=>{}})}));

describe('direct result to a real single-replacement comparison',()=>{
  it('opens the exact existing search result in one action without accepted-state, camera, receipt or money changes',()=>{
    const focused=appReducer(completed(),{type:'focusLocation',districtId:'esil',anchorId:'scenario:M4:esil'});
    const original:AppState={...focused,budget:{...focused.budget,active:'environment'},previousResult:focused.result!.value};
    const swap=allSwaps(original.plan)[0]!;
    const clock=vi.spyOn(Date,'now').mockImplementation(()=>{throw new Error('Preview cannot start a construction clock');});
    let opened:AppState;
    try{opened=direct(original,swap.replace.initiativeId,swap.with);}finally{clock.mockRestore();}
    expect(opened.candidate).toBeNull();expect(opened.selectedCommitment).toBeNull();expect(opened.issues).toEqual([]);
    expect(opened.alternative!.result).not.toBeNull();expect(opened.alternative!.showing).toBe('mine');
    for(const key of ['plan','result','revision','previousResult','construction','budget','focusedDistrict','cameraRequest','welcomeDismissed'] as const)
      expect(opened[key]).toBe(original[key]);
    expect(opened.alternative!.plan).toEqual(swap.plan);
    expect(planFingerprint(opened.alternative!.plan)).not.toBe(planFingerprint(original.plan));
    expect(opened.alternative!.result!.finalScore).toBeCloseTo(swap.score,10);
    expect(validateDraft(opened.alternative!.plan).status).toBe('complete');
    expect(opened.alternative!.result!.summary).toMatchObject({count:5});
    expect(opened.alternative!.result!.summary.spent).toBeLessThanOrEqual(100);
    expect(Object.values(opened.alternative!.result!.summary.areaCounts).every(n=>n<=2)).toBe(true);
    expect(opened.plan.filter((_,i)=>i!==opened.alternative!.slot)).toEqual(opened.alternative!.plan.filter((_,i)=>i!==opened.alternative!.slot));
    const expected=evaluatePlan(swap.plan);expect(expected.ok&&opened.alternative!.result).toEqual(expected.ok&&expected.result);
  });

  it('keeps both displayed futures canonical and delays every saved decision and receipt change until explicit adoption',()=>{
    const original=completed(),opened=direct(original,'M4',local('M5','esil'));
    expect(opened.alternative!.result!.finalScore).toBeCloseTo(54.3627525,10);
    expect(opened.alternative!.result!.indicators.esil).toMatchObject({E1:68,E2:80.75,C1:81.875});
    for(const show of [true,false,true,false]){
      const switched=appReducer(opened,{type:'showAlternative',show}),view=displayedState(switched);
      expect(isCurrentResult(view.plan,view.revision,view.result)).toBe(true);
      expect(view.plan).toBe(show?opened.alternative!.plan:original.plan);
      expect(switched.plan).toBe(original.plan);expect(switched.result).toBe(original.result);
      expect(switched.construction).toBe(original.construction);expect(switched.budget).toBe(original.budget);
      expect(switched.cameraRequest).toBe(original.cameraRequest);expect(switched.alternative!.sessionId).toBe(opened.alternative!.sessionId);
    }
    const discarded=appReducer(opened,{type:'discardAlternative'});
    expect(discarded.alternative).toBeNull();expect(discarded.plan).toBe(original.plan);expect(discarded.result).toBe(original.result);
    expect(discarded.construction).toBe(original.construction);expect(discarded.revision).toBe(original.revision);expect(discarded.cameraRequest).toBe(original.cameraRequest);
    const clock=vi.spyOn(Date,'now').mockReturnValue(123456);
    let adopted:AppState;try{adopted=appReducer(opened,{type:'adoptAlternative'});}finally{clock.mockRestore();}
    expect(adopted.plan).toBe(opened.alternative!.plan);expect(adopted.alternative).toBeNull();
    expect(adopted.revision).toBe(original.revision+1);expect(isCurrentResult(adopted.plan,adopted.revision,adopted.result)).toBe(true);
    expect(adopted.construction.find(r=>r.key==='M5:esil')!.startedAt).toBe(123456);
    expect(adopted.construction).not.toContain(original.construction.find(r=>r.key==='M4:esil'));
    for(const receipt of original.construction.filter(r=>r.key!=='M4:esil'))expect(adopted.construction).toContain(receipt);
    expect(adopted.cameraRequest).toBe(original.cameraRequest);
  });

  it('rejects malformed, illegal, identical, stale and incomplete seeds without opening a blank future',()=>{
    const original=completed();
    const malformed:unknown[]=[null,{initiativeId:'M99',scope:'district',districtId:'esil'},
      {...local('M5','esil'),finalScore:100},local('M8','nura'),{initiativeId:'M5',scope:'citywide'},
      {...city('M6'),districtId:'esil'}];
    for(const decision of malformed){
      const rejected=direct(original,'M4',decision as Decision);
      expect(rejected.alternative).toBeNull();expect(rejected.candidate).toBe(original.candidate);
      expect(rejected.comparisonSerial).toBe(original.comparisonSerial);expect(rejected.issues.length).toBeGreaterThan(0);
      for(const key of ['plan','result','revision','construction','budget','focusedDistrict','cameraRequest'] as const)expect(rejected[key]).toBe(original[key]);
    }
    expect(direct(original,'M4',original.plan[0]!)).toBe(original);
    const changed=appReducer(appReducer(original,{type:'applyPlan',plan:allSwaps(original.plan)[0]!.plan,expectedRevision:original.revision,now:100}),{type:'evaluate'});
    const stale=appReducer(changed,{type:'beginAlternative',initiativeId:changed.plan[0]!.initiativeId,decision:local('M5','esil'),expectedRevision:original.revision});
    expect(stale.issues).toEqual([{code:'stale'}]);expect(stale.alternative).toBeNull();expect(stale.plan).toBe(changed.plan);expect(stale.result).toBe(changed.result);
    const partial=initialState([local('M4','esil')]);expect(direct(partial,'M4',local('M5','esil'))).toBe(partial);
    const obsolete={...original,revision:original.revision+1};expect(direct(obsolete,'M4',local('M5','esil'))).toBe(obsolete);
  });

  it('supports relocation, citywide changes and a lower-scoring real alternative without assuming improvement',()=>{
    const original=completed(),relocated=direct(original,'M4',local('M4','saryarka'));
    expect(relocated.alternative!.plan[0]).toEqual(local('M4','saryarka'));
    expect(relocated.alternative!.result!.summary.spent).toBe(original.result!.value.summary.spent);
    expect(relocated.focusedDistrict).toBe(original.focusedDistrict);expect(relocated.cameraRequest).toBe(original.cameraRequest);
    const citywide=direct(original,'M12',city('M6'));
    expect(citywide.alternative!.plan[3]).toEqual(city('M6'));expect(citywide.alternative!.result!.plan).toHaveLength(5);
    const lowest=allSwaps(original.plan).at(-1)!,lower=direct(original,lowest.replace.initiativeId,lowest.with);
    expect(lower.alternative!.result!.finalScore).toBeLessThan(original.result!.value.finalScore);
    expect(isCurrentResult(lower.alternative!.plan,lower.revision,{revision:lower.revision,value:lower.alternative!.result!})).toBe(true);
  });

  it('retains manual proposal editing and invalidates its evidence before reevaluating the chosen slot',()=>{
    const original=completed(),manual=appReducer(original,{type:'beginAlternative',initiativeId:'M4'});
    expect(manual.candidate).toEqual({decision:original.plan[0],replaces:'M4'});expect(manual.alternative!.result).toBeNull();
    expect(manual.budget.active).toBe('environment');
    const opened=direct(original,'M4',local('M5','esil')),edited=appReducer(opened,{type:'editAlternative'});
    expect(edited.candidate).toEqual({decision:local('M5','esil'),replaces:'M5'});expect(edited.alternative!.result).toBeNull();
    const confirmed=appReducer(appReducer(edited,{type:'district',districtId:'saryarka'}),{type:'confirm'});
    expect(confirmed.alternative!.plan[0]).toEqual(local('M5','saryarka'));expect(confirmed.plan).toBe(original.plan);
    expect(confirmed.alternative!.result!.resultId).not.toBe(opened.alternative!.result!.resultId);
  });

  it.each([astana,khanate])('names the old and new project and scope using the $id world content',mode=>{
    const state=direct(completed(),'M4',local('M5','esil')),html=renderComparison(mode,state),content=contentFor(mode),presentation=presentationFor(mode);
    expect(html).toContain('data-testid="future-change"');expect(html).toContain(content.PROJECT_NAMES.M4);expect(html).toContain(content.PROJECT_NAMES.M5);
    expect(html).toContain(presentation.scopeName(local('M4','esil')));
    expect(html).toContain('Оставить мой план');expect(html).toContain('Принять вариант');expect(html).toContain('Изменить вариант');
    const relocation=renderComparison(mode,direct(completed(),'M4',local('M4','saryarka')));
    expect(relocation).toContain(presentation.scopeName(local('M4','esil')));expect(relocation).toContain(presentation.scopeName(local('M4','saryarka')));
    const citywide=renderComparison(mode,direct(completed(),'M12',city('M6')));
    expect(citywide).toContain(content.PROJECT_NAMES.M12);expect(citywide).toContain(content.PROJECT_NAMES.M6);expect(citywide).toContain(mode.copy.citywide);
  });

  it('persists only accepted decisions and checkpoints in both isolated world histories, recovering a comparison as its result',()=>{
    const values=new Map<string,string>(),disk:StoragePort={getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}};
    const ports=[createModeStorage('astana',()=>disk),createModeStorage('khanate',()=>disk)];
    const states=[completed(),completed([local('M7','esil'),local('M4','saryarka'),local('M11','nura'),city('M12'),city('M14')])];
    states.forEach((state,i)=>{saveDraft(()=>ports[i]!,state);saveCheckpoint(()=>ports[i]!,state);});
    const before=new Map(values);
    states.forEach((state,i)=>{const swap=allSwaps(state.plan)[0]!,opened=direct(state,swap.replace.initiativeId,swap.with);saveDraft(()=>ports[i]!,opened);
      expect(loadDraft(()=>ports[i]!).plan).toEqual(state.plan);expect(loadCheckpoint(()=>ports[i]!)?.plan).toEqual(state.plan);
      const mode=[astana,khanate][i]!,residents=Object.fromEntries(mode.residents.map(r=>[r.id,r]));
      expect(readPresentation(JSON.stringify({view:{kind:'comparison'},returnTo:{kind:'result'}}),state.plan,mode.stories,residents)?.view).toEqual({kind:'result'});
    });
    expect(values).toEqual(before);
    const swap=allSwaps(states[1]!.plan)[0]!,adopted=appReducer(direct(states[1]!,swap.replace.initiativeId,swap.with),{type:'adoptAlternative'});
    saveDraft(()=>ports[1]!,adopted);
    expect(loadDraft(()=>ports[1]!).plan).toEqual(swap.plan);expect(loadCheckpoint(()=>ports[1]!)?.plan).toEqual(states[1]!.plan);
    expect(loadDraft(()=>ports[0]!).plan).toEqual(states[0]!.plan);expect(loadCheckpoint(()=>ports[0]!)?.plan).toEqual(states[0]!.plan);
  });
});
