import { applyEdit, validateDraft } from '../domain/plan';
import { hasCompletion } from '../domain/planning-search';
import { reconcileConstruction } from './construction';
import type { Construction } from './construction';
import type { PlanEdit } from '../domain/plan';
import { evaluatePlan } from '../domain/evaluate';
import { isCurrentResult, planFingerprint } from '../domain/identity';
import { INITIATIVES } from '../domain/scenario';
import { emptyBudget, moveMoney, notchAt, budgetStatus } from './budget';
import type { BudgetState } from './budget';
import type { PolicyArea } from '../domain/types';
import { DISTRICT_IDS } from '../domain/types';
import type { CandidateProposal, CitywideInitiativeId, Decision, DistrictId, DistrictInitiativeId, InitiativeId, Plan, ScenarioResult, ValidationIssue } from '../domain/types';
import type { CameraRequest } from '../world/contract';

export type AppState = Readonly<{
  budget: BudgetState;
  construction: readonly Construction[];
  plan: Plan; revision: number; candidate: CandidateProposal | null;
  focusedDistrict: DistrictId | null; selectedCommitment: InitiativeId | null;
  result: Readonly<{ revision:number; value:ScenarioResult }> | null;
  previousResult: ScenarioResult | null;
  alternative: Readonly<{ sessionId:string; slot:number; plan:Plan; result:ScenarioResult|null; showing:'mine'|'alternative' }> | null;
  comparisonSerial: number;
  comparisonPosition: number; cameraRequest: CameraRequest;
  issues: readonly ValidationIssue[]; welcomeDismissed: boolean;
  announcement: 'committed' | 'removed' | 'evaluated' | 'restarted' | 'restored' | 'adopted' | null;
}>;
export function initialState(plan: Plan = [], welcomeDismissed = false, construction:readonly Construction[]=[]): AppState {
  return { budget:emptyBudget(), construction:reconcileConstruction(plan,plan,construction,0), plan, revision:0, candidate:null, focusedDistrict:null, selectedCommitment:null,
    result:null, previousResult:null, alternative:null, comparisonSerial:0, comparisonPosition:0, cameraRequest:{ id:0, kind:'overview' }, issues:[], welcomeDismissed, announcement:null };
}
/** These are views of the single reducer state, never independent plan/result stores. */
export const editingPlan = (state:AppState):Plan => state.alternative?.plan ?? state.plan;
export function displayedState(state:AppState):AppState {
  const alternative = state.alternative;
  if (!alternative?.result || alternative.showing !== 'alternative'
    || !isCurrentResult(alternative.plan,state.revision,{revision:state.revision,value:alternative.result})) return state;
  return { ...state, plan:alternative.plan, result:{revision:state.revision,value:alternative.result}, comparisonPosition:1 };
}
export type Action =
  | { type:'restoreDraft'; plan:Plan; construction:readonly Construction[] }
  | { type:'applyPlan'; plan:Plan; expectedRevision:number; now:number }
  | { type:'allocate'; area:PolicyArea; value:number; initiativeId?:InitiativeId }
  | { type:'releaseAllocation' }
  | { type:'replaceConflict'; initiativeId:InitiativeId }
  | { type:'choose'; initiativeId:InitiativeId }
  | { type:'district'; districtId:DistrictId }
  | { type:'focusLocation'; districtId:DistrictId; anchorId:string }
  | { type:'selectCommitment'; initiativeId:InitiativeId }
  | { type:'beginAlternative'; initiativeId:InitiativeId; decision?:Decision; expectedRevision?:number }
  | { type:'showAlternative'; show:boolean }
  | { type:'editAlternative' } | { type:'discardAlternative' } | { type:'adoptAlternative' }
  | { type:'confirm' } | { type:'cancel' } | { type:'evaluate' } | { type:'overview' } | { type:'revise' }
  | { type:'remove'; initiativeId:InitiativeId }
  | { type:'compare'; position:number } | { type:'dismissWelcome' } | { type:'restart' };

function commitEdit(state: AppState, edit: PlanEdit): AppState {
  const outcome = applyEdit(state.plan,edit);
  if (!outcome.accepted) return { ...state, issues:outcome.issues, announcement:null };
  if (edit.kind!=='remove' && !hasCompletion(outcome.plan)) return { ...state, issues:[{code:'stranded'}], announcement:null };
  if (planFingerprint(outcome.plan) === planFingerprint(state.plan)) return { ...state, candidate:null, selectedCommitment:null, issues:[], announcement:null };
  return { ...state, plan:outcome.plan, revision:state.revision + 1, candidate:null,
    previousResult:state.result?.value ?? state.previousResult,
    selectedCommitment:null, result:null, comparisonPosition:0, issues:[],
    announcement:edit.kind === 'remove' ? 'removed' : 'committed' };
}

function evaluateAlternative(state:AppState):AppState {
  const alternative=state.alternative;
  if (!alternative || !isCurrentResult(state.plan,state.revision,state.result)) return state;
  const target=alternative.plan[alternative.slot];
  if (!target || !state.candidate) return state;
  // Only this slot can change. Four accepted decisions always remain untouched.
  const edit=applyEdit(alternative.plan,{kind:'replace',target:target.initiativeId,decision:state.candidate.decision});
  if (!edit.accepted) return {...state,issues:edit.issues,alternative:{...alternative,result:null,showing:'mine'}};
  const outcome=evaluatePlan(edit.plan);
  if (!outcome.ok) return {...state,issues:outcome.issues,alternative:{...alternative,result:null,showing:'mine'}};
  return {...state,candidate:null,selectedCommitment:null,issues:[],announcement:null,
    alternative:{...alternative,plan:edit.plan,result:outcome.result,showing:'mine'}};
}

function reducePlan(state: AppState, action: Exclude<Action,{type:'allocate'|'releaseAllocation'|'replaceConflict'}>): AppState {
  switch (action.type) {
    case 'restoreDraft': {
      const checked=validateDraft(action.plan);
      if(checked.status==='invalid')return {...state,issues:checked.issues};
      return {...initialState(checked.plan,true,action.construction),revision:state.revision+1,
        previousResult:state.result?.value??state.previousResult,comparisonSerial:state.comparisonSerial,
        cameraRequest:{id:state.cameraRequest.id+1,kind:'overview'},announcement:'restored'};
    }
    case 'applyPlan': {
      if (action.expectedRevision!==state.revision) return {...state,issues:[{code:'stale'}]};
      const checked=validateDraft(action.plan);
      if (checked.status==='invalid') return {...state,issues:checked.issues};
      if (!hasCompletion(checked.plan)) return {...state,issues:[{code:'stranded'}]};
      if (planFingerprint(checked.plan)===planFingerprint(state.plan)) return state;
      return {...state,plan:checked.plan,construction:reconcileConstruction(state.plan,checked.plan,state.construction,action.now),revision:state.revision+1,
        budget:emptyBudget(),candidate:null,alternative:null,result:null,previousResult:state.result?.value??state.previousResult,
        selectedCommitment:null,comparisonPosition:0,issues:[],welcomeDismissed:true,announcement:'committed'};
    }
    case 'choose': {
      const item = INITIATIVES[action.initiativeId];
      const held=state.candidate?.decision??state.alternative?.plan[state.alternative.slot];
      const districtId=state.alternative&&held?.scope==='district'?held.districtId:state.focusedDistrict;
      const decision = item.scope === 'citywide'
        ? { scope:'citywide' as const, initiativeId:action.initiativeId as CitywideInitiativeId }
        : { scope:'district' as const, initiativeId:action.initiativeId as DistrictInitiativeId, districtId };
      return { ...state, candidate:{ decision, replaces:state.alternative?.plan[state.alternative.slot]?.initiativeId ?? state.candidate?.replaces ?? null },
        alternative:state.alternative?{...state.alternative,result:null,showing:'mine'}:null,
        cameraRequest:item.scope==='citywide'&&!state.alternative?{id:state.cameraRequest.id+1,kind:'overview'}:state.cameraRequest, issues:[], announcement:null };
    }
    case 'district': {
      if (!DISTRICT_IDS.includes(action.districtId)) return state;
      const candidate = state.candidate?.decision.scope === 'district'
        ? { ...state.candidate, decision:{ ...state.candidate.decision, districtId:action.districtId } } : state.candidate;
      return { ...state, focusedDistrict:action.districtId, candidate, issues:[],
        cameraRequest:state.alternative&&candidate?state.cameraRequest:{ id:state.cameraRequest.id + 1, kind:'district', districtId:action.districtId } };
    }
    case 'focusLocation': return DISTRICT_IDS.includes(action.districtId) && action.anchorId.trim()
      ? { ...state, focusedDistrict:action.districtId, cameraRequest:{ id:state.cameraRequest.id + 1, kind:'location', districtId:action.districtId, anchorId:action.anchorId } }
      : state;
    case 'selectCommitment': {
      if (state.alternative) return state;
      const decision = state.plan.find(d => d.initiativeId === action.initiativeId);
      if (!decision) return state;
      return { ...state, selectedCommitment:decision.initiativeId, candidate:{ decision, replaces:decision.initiativeId },
        focusedDistrict:decision.scope === 'district' ? decision.districtId : state.focusedDistrict,
        cameraRequest:decision.scope === 'district' ? { id:state.cameraRequest.id + 1, kind:'district', districtId:decision.districtId } : { id:state.cameraRequest.id + 1, kind:'overview' }, issues:[], announcement:null };
    }
    case 'beginAlternative': {
      if (action.expectedRevision!==undefined && action.expectedRevision!==state.revision) return {...state,issues:[{code:'stale'}],announcement:null};
      if (state.alternative || !isCurrentResult(state.plan,state.revision,state.result)) return state;
      const slot=state.plan.findIndex(d=>d.initiativeId===action.initiativeId), decision=state.plan[slot];
      if (!decision) return state;
      const serial=state.comparisonSerial+1;
      const opened:AppState={...state,comparisonSerial:serial,comparisonPosition:1,issues:[],announcement:null,
        selectedCommitment:decision.initiativeId,candidate:{decision:action.decision===undefined?decision:action.decision,replaces:decision.initiativeId},
        alternative:{sessionId:`future:${state.revision}:${serial}`,slot,plan:state.plan,result:null,showing:'mine'}};
      if (action.decision===undefined) return opened;
      // A supplied replacement opens only a real, valid evaluated future. The
      // original four slots, receipts, focus and camera request remain in place.
      const evaluated=evaluateAlternative(opened);
      if (!evaluated.alternative?.result) return {...state,issues:evaluated.issues,announcement:null};
      return planFingerprint(evaluated.alternative.plan)===planFingerprint(state.plan)?state:evaluated;
    }
    case 'showAlternative': return state.alternative ? {...state,alternative:{...state.alternative,
      showing:action.show&&state.alternative.result?'alternative':'mine'}} : state;
    case 'editAlternative': {
      const a=state.alternative, decision=a?.plan[a.slot];
      return a&&decision?{...state,candidate:{decision,replaces:decision.initiativeId},alternative:{...a,result:null,showing:'mine'},issues:[]}:state;
    }
    case 'discardAlternative': return {...state,alternative:null,candidate:null,selectedCommitment:null,issues:[],announcement:null};
    case 'adoptAlternative': {
      const a=state.alternative;
      if (!a?.result || !isCurrentResult(a.plan,state.revision,{revision:state.revision,value:a.result})
        || state.plan.some((d,i)=>i!==a.slot&&planFingerprint([d])!==planFingerprint([a.plan[i]!]))) return state;
      return {...state,plan:a.plan,revision:state.revision+1,result:{revision:state.revision+1,value:a.result},
        previousResult:state.result?.value??null,alternative:null,candidate:null,selectedCommitment:null,comparisonPosition:1,issues:[],announcement:'adopted'};
    }
    case 'confirm': if (state.alternative) return evaluateAlternative(state); return state.candidate ? commitEdit(state,state.candidate.replaces
      ? { kind:'replace', target:state.candidate.replaces, decision:state.candidate.decision }
      : { kind:'add', decision:state.candidate.decision }) : state;
    case 'remove': return state.alternative?state:commitEdit(state,{ kind:'remove', target:action.initiativeId });
    case 'cancel': return { ...state, alternative:null, candidate:null, selectedCommitment:null, issues:[], announcement:null };
    case 'revise': if (state.alternative) return state; return { ...state, previousResult:state.result?.value ?? state.previousResult,
      result:null, revision:state.revision+1, comparisonPosition:0, candidate:null, selectedCommitment:null, issues:[], announcement:null };
    case 'evaluate': {
      if (state.alternative) return evaluateAlternative(state);
      if (isCurrentResult(state.plan,state.revision,state.result)) return state;
      const outcome = evaluatePlan(state.plan);
      return outcome.ok
        ? { ...state, result:{ revision:state.revision, value:outcome.result }, comparisonPosition:1, issues:[], announcement:'evaluated' }
        : { ...state, result:null, comparisonPosition:0, issues:outcome.issues, announcement:null };
    }
    case 'compare': return !state.alternative&&state.result && Number.isFinite(action.position) ? { ...state, comparisonPosition:Math.max(0,Math.min(1,action.position)) } : state;
    case 'overview': return { ...state, cameraRequest:{ id:state.cameraRequest.id + 1, kind:'overview' } };
    case 'dismissWelcome': return { ...state, welcomeDismissed:true };
    case 'restart': return { ...initialState(), comparisonSerial:state.comparisonSerial, revision:state.revision + 1, cameraRequest:{ id:state.cameraRequest.id + 1, kind:'overview' }, announcement:'restarted' };
  }
}


/** One store: allocation gestures can only edit fluid money and the current proposal. */
export function appReducer(state:AppState,action:Action):AppState {
  if(action.type==='allocate') {
    if(!Number.isFinite(action.value)||state.alternative?.result) return state;
    const id=action.initiativeId??notchAt(action.area,action.value);
    if(INITIATIVES[id].area!==action.area)return state;
    const changed=state.candidate?.decision.initiativeId!==id;
    let next=changed?reducePlan(state,{type:'choose',initiativeId:id}):state;
    if(changed&&INITIATIVES[id].scope==='district'&&state.candidate?.decision.scope==='citywide'&&state.focusedDistrict&&!state.alternative)
      next={...next,cameraRequest:{id:state.cameraRequest.id+1,kind:'district',districtId:state.focusedDistrict}};
    const status=budgetStatus(next);
    return {...next,budget:moveMoney(next.budget,action.area,Math.max(0,action.value-status.credit),status.remaining),issues:[],announcement:null};
  }
  if(action.type==='releaseAllocation')return {...state,budget:emptyBudget(),candidate:null,selectedCommitment:null,issues:[]};
  if(action.type==='replaceConflict') {
    if(!state.candidate||state.alternative||!state.plan.some(d=>d.initiativeId===action.initiativeId))return state;
    const area=INITIATIVES[state.candidate.decision.initiativeId].area,credit=INITIATIVES[action.initiativeId].cost;
    const status=budgetStatus(state),budget=moveMoney(state.budget,area,Math.max(0,status.covered-credit),status.remaining);
    return {...state,budget,candidate:{...state.candidate,replaces:action.initiativeId},selectedCommitment:action.initiativeId,issues:[]};
  }
  let next=reducePlan(state,action);
  if(next===state)return state;
  // Direct comparison is a preview, so it cannot spend or release held money.
  if(action.type==='beginAlternative'&&action.decision!==undefined)return next;
  if(next.plan!==state.plan && action.type!=='applyPlan' && action.type!=='restoreDraft') next={...next,construction:reconcileConstruction(state.plan,next.plan,state.construction,Date.now())};
  if(['cancel','revise','restart','selectCommitment','beginAlternative','editAlternative','discardAlternative','adoptAlternative'].includes(action.type)
    ||(action.type==='evaluate'&&next.result))
    next={...next,budget:{...emptyBudget(),active:next.candidate?INITIATIVES[next.candidate.decision.initiativeId].area:null}};
  if(action.type==='confirm'&&!next.candidate&&state.candidate){const allocations={...next.budget.allocations,[INITIATIVES[state.candidate.decision.initiativeId].area]:0};next={...next,budget:{allocations,active:null,movement:null}};}
  if(action.type==='choose')next={...next,budget:{...next.budget,active:INITIATIVES[action.initiativeId].area}};
  // Explicit plan edits may change the ceiling; never change a plan to fit an allocation.
  const status=budgetStatus(next);
  if(status.fluid>status.remaining) {
    let excess=status.fluid-status.remaining;const allocations={...next.budget.allocations};
    for(const area of Object.keys(allocations) as PolicyArea[]) {const amount=Math.min(excess,allocations[area]);allocations[area]-=amount;excess-=amount;}
    next={...next,budget:{...next.budget,allocations}};
  }
  return next;
}
