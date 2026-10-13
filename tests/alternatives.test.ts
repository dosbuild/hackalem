import { describe, expect, it } from 'vitest';
import { appReducer, displayedState, initialState } from '../src/app/state';
import { summarizePlan } from '../src/domain/plan';
import { isCurrentResult } from '../src/domain/identity';
import { acceptsReply, observe, responseTicket } from '../src/residents/engine';
import { FIRST_RESIDENT } from '../src/residents/population';
import { oracle } from './scenario-oracle';

const completed=()=>appReducer(initialState(oracle.cases.negative.plan),{type:'evaluate'});
function readyAlternative() {
  let s=appReducer(completed(),{type:'beginAlternative',initiativeId:'M4'});
  s=appReducer(s,{type:'choose',initiativeId:'M5'});
  s=appReducer(s,{type:'district',districtId:'esil'});
  return appReducer(s,{type:'confirm'});
}
describe('one reversible future in the authoritative reducer',()=>{
  it('only opens from a complete current evaluation and preserves its four other slots',()=>{
    const empty=initialState();expect(appReducer(empty,{type:'beginAlternative',initiativeId:'M4'})).toBe(empty);
    const original=completed(), alternative=readyAlternative();
    expect(alternative.plan).toEqual(original.plan);
    expect(alternative.result).toEqual(original.result);
    expect(alternative.alternative!.plan.slice(1)).toEqual(original.plan.slice(1));
    expect(alternative.alternative!.result!.plan).toHaveLength(5);
    expect(summarizePlan(alternative.plan).spent).toBe(75);
    expect(summarizePlan(alternative.alternative!.plan).spent).toBe(85);
    // Independent arithmetic: replacing M4 with M5 changes Esil D by +.02;
    // .7 * population .27 * .02 = .00378, with weakest/critical unchanged.
    expect(alternative.alternative!.result!.finalScore).toBeCloseTo(54.3627525,10);
    expect(alternative.alternative!.result!.indicators.esil).toMatchObject({E1:68,E2:80.75,C1:81.875});
  });
  it('rejects invalid alternatives with no future and no mutation to the original',()=>{
    const original=completed();let s=appReducer(original,{type:'beginAlternative',initiativeId:'M4'});
    s=appReducer(s,{type:'choose',initiativeId:'M8'});s=appReducer(s,{type:'confirm'});
    expect(s.issues.map(i=>i.code)).toContain('duplicate');expect(s.alternative!.result).toBeNull();
    expect(s.plan).toBe(original.plan);expect(s.result).toBe(original.result);
    expect(displayedState(appReducer(s,{type:'showAlternative',show:true})).result).toBe(original.result);
    expect(appReducer(s,{type:'remove',initiativeId:'M8'})).toBe(s);
    expect(appReducer(s,{type:'selectCommitment',initiativeId:'M8'})).toBe(s);
  });
  it('switches plan/result/resident evidence together without camera or clock commands',()=>{
    const s=readyAlternative(), ticket=responseTicket(displayedState(s),FIRST_RESIDENT.id);
    const other=appReducer(s,{type:'showAlternative',show:true}), view=displayedState(other);
    expect(view.plan).toBe(other.alternative!.plan);
    expect(isCurrentResult(view.plan,view.revision,view.result)).toBe(true);
    expect(observe(FIRST_RESIDENT,view).evidence.resultId).toBe(other.alternative!.result!.resultId);
    expect(observe(FIRST_RESIDENT,view).treatment).toBeNull();
    expect(observe(FIRST_RESIDENT,displayedState(s)).treatment).toBe('M4');
    expect(view.cameraRequest).toBe(s.cameraRequest);
    expect(other.alternative!.sessionId).toBe(s.alternative!.sessionId);
    expect(acceptsReply(ticket,view,FIRST_RESIDENT.id)).toBe(false);
    const released=appReducer(other,{type:'showAlternative',show:false});
    expect(displayedState(released).result).toBe(s.result);
    expect(released.plan).toBe(s.plan);
    expect(appReducer(other,{type:'compare',position:0})).toBe(other);
  });
  it('adopts atomically or discards losslessly, keeping the camera pose request stable',()=>{
    const s=readyAlternative();
    const adopted=appReducer(s,{type:'adoptAlternative'});
    expect(adopted.alternative).toBeNull();expect(adopted.plan).toBe(s.alternative!.plan);
    expect(adopted.result!.value).toBe(s.alternative!.result);expect(adopted.previousResult).toBe(s.result!.value);
    expect(isCurrentResult(adopted.plan,adopted.revision,adopted.result)).toBe(true);
    expect(adopted.cameraRequest).toBe(s.cameraRequest);
    const discarded=appReducer(s,{type:'discardAlternative'});
    expect(discarded.plan).toBe(s.plan);expect(discarded.result).toBe(s.result);
    expect(discarded.alternative).toBeNull();expect(discarded.cameraRequest).toBe(s.cameraRequest);
  });
  it('rechecking scope replaces only the chosen slot and invalidates alternative evidence',()=>{
    const s=readyAlternative();let edited=appReducer(s,{type:'editAlternative'});
    expect(edited.alternative!.result).toBeNull();
    edited=appReducer(edited,{type:'district',districtId:'saryarka'});edited=appReducer(edited,{type:'confirm'});
    expect(edited.alternative!.result!.resultId).not.toBe(s.alternative!.result!.resultId);
    expect(edited.alternative!.plan[0]).toMatchObject({initiativeId:'M5',districtId:'saryarka'});
    expect(edited.result).toBe(s.result);
    const reset=appReducer(edited,{type:'restart'});
    expect(reset.alternative).toBeNull();expect(reset.plan).toEqual([]);expect(reset.result).toBeNull();
  });
});
