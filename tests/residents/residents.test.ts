import { describe, expect, it } from 'vitest';
import { initialState, appReducer } from '../../src/app/state';
import type { AppState } from '../../src/app/state';
import { evaluatePlan } from '../../src/domain/evaluate';
import { DISTRICT_IDS, INITIATIVE_IDS } from '../../src/domain/types';
import type { Decision, DistrictId, InitiativeId, Plan } from '../../src/domain/types';
import { INITIATIVES } from '../../src/domain/scenario';
import { RESIDENTS, RESIDENT_BY_ID, SIGNATURE_RESIDENTS } from '../../src/residents/population';
import { acceptsReply, activityAt, anchorFor, branchKey, discover, emptyMemory, hasCurrentResult, illustratedBeat, nearby, observe, readMemory, remember, responseTicket, visitSequence } from '../../src/residents/engine';
import { RULES } from '../../src/residents/rules';

const decision=(id:InitiativeId,districtId:DistrictId='esil'):Decision=>(INITIATIVES[id].scope==='citywide'?{initiativeId:id,scope:'citywide'}:{initiativeId:id,scope:'district',districtId}) as Decision;
function evaluated(plan:Plan):AppState {const state=initialState(plan);return appReducer(state,{type:'evaluate'});}
const primary=RESIDENT_BY_ID['esil-01']!;
const parkPlan:Plan=['M4','M1','M10','M12','M14'].map(id=>decision(id as InitiativeId));
function validPlanWith(id:InitiativeId,district:DistrictId='esil'):Plan {
  const pool=INITIATIVE_IDS.filter(x=>x!==id);
  for(let a=0;a<pool.length;a++)for(let b=a+1;b<pool.length;b++)for(let c=b+1;c<pool.length;c++)for(let d=c+1;d<pool.length;d++){
    const plan=[decision(id,district),...([pool[a],pool[b],pool[c],pool[d]] as InitiativeId[]).map(x=>decision(x,district))];
    if(evaluatePlan(plan).ok)return plan;
  }
  throw Error(`no valid plan for ${id}`);
}

describe('authored cast',()=>{
  it('has the exact 100 stable synthetic identities and 4 signature residents per district',()=>{
    expect(RESIDENTS).toHaveLength(100);expect(new Set(RESIDENTS.map(r=>r.id)).size).toBe(100);expect(new Set(RESIDENTS.map(r=>r.name)).size).toBe(100);
    expect(DISTRICT_IDS.map(d=>RESIDENTS.filter(r=>r.home===d).length)).toEqual([27,24,20,13,16]);
    for(const d of DISTRICT_IDS)expect(SIGNATURE_RESIDENTS.filter(r=>r.home===d)).toHaveLength(4);
    for(const r of RESIDENTS){expect(r.synthetic).toBe(true);expect(r.concerns.length).toBeGreaterThanOrEqual(2);expect(r.action.kk).toEqual(r.action.ru);expect(r.action.ru.length).toBeGreaterThan(20);expect(r.routine.length).toBeGreaterThan(3);}
  });
  it('has reciprocal bounded relationships with no self or dangling references',()=>{
    for(const r of RESIDENTS){expect(r.relationships.length).toBeGreaterThan(0);expect(r.relationships.length).toBeLessThanOrEqual(2);
      expect(new Set(r.relationships.map(x=>x.residentId)).size).toBe(r.relationships.length);
      for(const x of r.relationships){expect(x.residentId).not.toBe(r.id);expect(RESIDENT_BY_ID[x.residentId]?.relationships).toContainEqual({residentId:r.id,kind:x.kind});}
    }
  });
  it('includes cross-district visits and natural mobility variation among signatures',()=>{
    expect(RESIDENTS.filter(r=>r.home!==r.location)).toHaveLength(10);
    expect(SIGNATURE_RESIDENTS.some(r=>r.visual.mobility==='wheelchair')).toBe(true);expect(SIGNATURE_RESIDENTS.some(r=>r.visual.mobility==='cane')).toBe(true);
    expect(new Set(RESIDENTS.map(r=>JSON.stringify(r.visual))).size).toBe(100);
  });
  it('offers all 100 through discovery without a directory',()=>{
    const seen:string[]=[];for(let i=0;i<100;i++){const r=discover(initialState(),seen.at(-1)??null,seen);expect(seen).not.toContain(r.id);seen.push(r.id);}expect(seen).toHaveLength(100);
  });
  it('renders English dialogue while preserving distinct authored actions',()=>{
    const dialogue=RESIDENTS.flatMap(r=>[r.action.kk,r.action.ru]).join(' ');expect(dialogue).not.toMatch(/[\u0400-\u04ff]/);expect(dialogue).toMatch(/[A-Za-z]/);
    expect(new Set(SIGNATURE_RESIDENTS.map(r=>r.action.kk)).size).toBe(20);
  });
});

describe('municipal authority and illustrations',()=>{
  it('does not change surroundings for proposals or unevaluated commitments',()=>{
    let state=initialState();state=appReducer(state,{type:'district',districtId:'esil'});state=appReducer(state,{type:'choose',initiativeId:'M4'});
    expect(observe(primary,state).phase).toBe('proposal');expect(observe(primary,state).treatment).toBeNull();expect(state.plan).toHaveLength(0);
    state=appReducer(state,{type:'confirm'});expect(observe(primary,state).phase).toBe('committed');expect(observe(primary,state).treatment).toBeNull();
    state=appReducer(state,{type:'evaluate'});expect(hasCurrentResult(state)).toBe(false);expect(observe(primary,state).evidence.calculated).toBe(false);
  });
  it('shows the same person in the same place with supported changes and a remaining concern',()=>{
    const state=evaluated(parkPlan);const before=observe(primary,{...state,comparisonPosition:0}),after=observe(primary,state);
    expect(before.treatment).toBeNull();expect(after.treatment).toBe('M4');expect(after.phase).toBe('mixed');expect(after.unresolved.ru).toContain('clinic');
    expect(before.evidence.anchorId).toBe(after.evidence.anchorId);expect(after.evidence.indicators.find(i=>i.id==='E1')?.delta).toBe(9);
    expect(activityAt(primary,1,true)).toBe(activityAt(primary,1,true));expect(nearby(primary).length).toBeLessThanOrEqual(6);
  });
  it('has a representation for every initiative, backed by a valid evaluated plan',()=>{
    expect(Object.keys(RULES)).toHaveLength(14);
    for(const id of INITIATIVE_IDS){const source=RESIDENTS.find(r=>r.primary===id);expect(source).toBeTruthy();const resident={...source!,location:'esil' as const};const state=evaluated(validPlanWith(id));const o=observe(resident,state);
      expect(o.treatment).toBe(id);expect(o.evidence.calculated).toBe(true);expect(o.evidence.initiativeIds).toContain(id);expect(o.evidence.ruleId).toContain(id);expect(o.evidence.limitation.length).toBeGreaterThan(40);
    }
  });
  it('scopes district effects to encounter location, never commuting home',()=>{
    const resident={...primary,home:'nura' as const,location:'esil' as const};const esil=evaluated(parkPlan),nura=evaluated(parkPlan.map(d=>d.scope==='district'?{...d,districtId:'nura'}:d));
    expect(observe(resident,esil).treatment).toBe('M4');expect(observe(resident,nura).treatment).toBeNull();expect(observe(resident,nura).opening.ru).toContain('shows no');
  });
  it('distributes one citywide decision across all five districts',()=>{
    const state=evaluated(validPlanWith('M6'));for(const location of DISTRICT_IDS){const r={...primary,id:`test-${location}`,primary:'M6' as const,location};expect(observe(r,state).treatment).toBe('M6');}
    expect(state.plan.filter(d=>d.initiativeId==='M6')).toHaveLength(1);
  });
  it('reflects the negative crossing contribution without inventing exact journey time',()=>{
    const state=evaluated(['M11','M4','M8','M12','M14'].map(id=>decision(id as InitiativeId)));const o=observe(RESIDENT_BY_ID['esil-04']!,state);
    expect(o.phase).toBe('mixed');expect(o.evidence.contributions.find(c=>c.indicatorId==='T1')?.amount).toBe(-1.75);expect(o.answer.ru).toContain('slows down');expect(o.answer.ru).not.toMatch(/minutes|seconds|минут|секунд/);
  });
  it.each([['M1','M2'],['M10','M12'],['M5','M6']] as const)('uses returned synergy for %s + %s only where it applies',(a,b)=>{
    const plans:Record<string,InitiativeId[]>={M1:['M1','M2','M4','M10','M12'],M10:['M10','M12','M1','M4','M8'],M5:['M5','M6','M1','M11','M12']};
    const state=evaluated(plans[a]!.map(id=>decision(id)));const template=RESIDENTS.find(r=>r.primary===a)!;
    const r={...template,id:'test-local',location:'esil' as const};expect(observe(r,state).evidence.contributions.some(c=>c.initiativeIds.includes(a)&&c.initiativeIds.includes(b))).toBe(true);
    const away={...r,id:'test-away',location:'nura' as const};expect(observe(away,state).evidence.contributions.some(c=>c.initiativeIds.includes(a)&&c.initiativeIds.includes(b))).toBe(false);
  });
  it('clears removed projects and rejects stale/wrong revision results',()=>{
    const state=evaluated(parkPlan),removed=appReducer(state,{type:'remove',initiativeId:'M4'});expect(observe(primary,removed).treatment).toBeNull();expect(removed.result).toBeNull();
    expect(observe(primary,{...removed,result:state.result,comparisonPosition:1}).treatment).toBeNull();
    expect(observe(primary,{...state,plan:state.plan.slice(1),result:state.result}).treatment).toBeNull();
  });
  it('rejecting a conflicting choice keeps the current evaluation intact',()=>{
    const state=evaluated(parkPlan);const draft=appReducer(appReducer(state,{type:'choose',initiativeId:'M3'}),{type:'confirm'});
    expect(draft.plan).toBe(state.plan);expect(draft.result).toBe(state.result);expect(observe(primary,draft).treatment).toBe('M4');
  });
  it('recognizes other initiatives already helping a concern',()=>{
    const state=evaluated(['M4','M8','M1','M10','M12'].map(id=>decision(id as InitiativeId)));expect(observe(primary,state).unresolved.ru).toContain('also addresses');
  });
  it('resident focus cannot retarget a proposal or alter a score',()=>{
    const state=appReducer(evaluated(parkPlan),{type:'choose',initiativeId:'M8'});const next=appReducer(state,{type:'focusLocation',districtId:'nura',anchorId:'nura:clinic'});
    expect(next.candidate).toBe(state.candidate);expect(next.plan).toBe(state.plan);expect(next.result).toBe(state.result);expect(next.revision).toBe(state.revision);
  });
});

describe('replay and bounded behaviour',()=>{
  it('changes the shared-space gesture only after valid evaluation, while preserving its initial beat',()=>{
    const state=evaluated(parkPlan),before=observe(primary,{...state,comparisonPosition:0}),after=observe(primary,state);
    expect(illustratedBeat(primary,1,true,before)).toEqual(illustratedBeat(primary,1,true,after));
    expect(illustratedBeat(primary,11,true,after)).toEqual({activity:'exchange',dx:32,dy:0});
    expect(illustratedBeat(primary,11,true,before)).not.toEqual(illustratedBeat(primary,11,true,after));
  });
  it('keeps branch memories separate and rejects stale optional asynchronous responses',()=>{
    const a=evaluated(parkPlan),b=appReducer(a,{type:'remove',initiativeId:'M4'});let memory=remember(emptyMemory(),branchKey(a),primary.id);memory=remember(memory,branchKey(b),'nura-01');
    expect(memory.branches[branchKey(a)]).toEqual([primary.id]);expect(memory.branches[branchKey(b)]).toEqual(['nura-01']);
    expect(acceptsReply(responseTicket(a,primary.id),a,primary.id)).toBe(true);expect(acceptsReply(responseTicket(a,primary.id),b,primary.id)).toBe(false);
    expect(acceptsReply(responseTicket(a,primary.id),{...a,comparisonPosition:0},primary.id)).toBe(false);
  });
  it('does not persist previews as commitments, and tolerates damaged storage',()=>{
    expect(readMemory('broken')).toEqual(emptyMemory());expect(readMemory(JSON.stringify({version:1,bookmarks:['missing',primary.id],branches:{old:['esil-02']}}))).toEqual({version:1,bookmarks:[primary.id],branches:{}});
  });
  it('chooses familiar improvement, different perspective and a critical need',()=>{
    const state=evaluated(parkPlan);const scenes=visitSequence(state,[primary.id]);expect(scenes[0]?.id).toBe(primary.id);expect(scenes).toHaveLength(3);expect(new Set(scenes.map(r=>r.id)).size).toBe(3);
    expect(scenes.some(r=>observe(r,state).evidence.indicators.some(i=>i.critical))).toBe(true);expect(visitSequence(initialState(),[])).toEqual([]);
  });
  it('keeps all spatial bindings semantic, marked provisional and without invented addresses',()=>{
    for(const r of RESIDENTS){expect(anchorFor(r).provisional).toBe(true);expect(anchorFor(r).id).toMatch(/^(esil|almaty|saryarka|baikonur|nura):/);}
  });
});
