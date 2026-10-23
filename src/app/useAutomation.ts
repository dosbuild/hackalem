import {useEffect,useRef,useState} from 'react';
import type {Dispatch} from 'react';
import type {Action,AppState} from './state';
import type {ActionOutcome,AyaIntent,AyaSpace} from '../assistant/types';
import type {Decision,Plan} from '../domain/types';
import {useContent} from '../modes/content';
import {useDashboardApi} from '../dashboard/api';
import type {findBestCompletion,findPlanRepair} from '../domain/planning-search';
import {planFingerprint} from '../domain/identity';
import {applyEdit,summarizePlan,validateDraft} from '../domain/plan';
import {hasCompletion} from '../domain/planning-search';
import {constructionDuration,decisionKey} from './construction';
import {format} from '../ui/copy';

const wait=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
  signal.throwIfAborted();const abort=()=>{clearTimeout(timer);reject(new Error('interrupted'));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});
});
type Transaction={before:Plan;after:Plan};

/** Undo only touches Aya's unchanged decisions; subsequent manual choices retain ownership. */
export function inverseTransaction(current:Plan,transaction:Transaction):Plan|null {
  const ids=new Set([...transaction.before,...transaction.after].map(d=>d.initiativeId));
  let restored=[...current];
  for(const id of ids){
    const before=transaction.before.find(d=>d.initiativeId===id),after=transaction.after.find(d=>d.initiativeId===id);
    if(planFingerprint(before?[before]:[])===planFingerprint(after?[after]:[]))continue;
    const actual=current.find(d=>d.initiativeId===id);
    if(planFingerprint(actual?[actual]:[])!==planFingerprint(after?[after]:[]))return null;
    restored=restored.filter(d=>d.initiativeId!==id);if(before)restored.push(before);
  }
  return validateDraft(restored).status!=='invalid'&&hasCompletion(restored)?restored:null;
}

export function useAutomation(state:AppState, dispatch:Dispatch<Action>, navigate:(space:AyaSpace,section?:string)=>void) {
  const {INITIATIVES,issueMessage,scopeName,terms,unitFor}=useContent();
  const dashboardApi=useDashboardApi();
  const current=useRef(state);current.current=state;
  const running=useRef<AbortController|null>(null),transaction=useRef<Transaction|null>(null),sequenceBefore=useRef<Plan|null>(null),sequenceApplied=useRef(false);
  useEffect(()=>()=>{running.current?.abort();running.current=null;},[]);
  const [automation,setAutomation]=useState({active:false,progress:''}),[undoVersion,setUndoVersion]=useState(0);
  const interrupt=()=>{if(running.current){running.current.abort();running.current=null;if(current.current.candidate)dispatch({type:'cancel'});setAutomation({active:false,progress:'You are in charge of the city. Your existing decisions are saved.'});}};
  const assertCurrent=(revision:number,signal:AbortSignal)=>{signal.throwIfAborted();if(current.current.revision!==revision)throw new Error('stale');};
  const apply=async(plan:Plan,revision:number,signal:AbortSignal)=>{
    assertCurrent(revision,signal);
    transaction.current={before:sequenceApplied.current?transaction.current!.before:sequenceBefore.current??current.current.plan,after:plan};sequenceApplied.current=true;setUndoVersion(v=>v+1);
    dispatch({type:'applyPlan',plan,expectedRevision:revision,now:Date.now()});
    const until=Date.now()+2500;
    while(current.current.revision===revision&&Date.now()<until)await wait(20,signal);
    if(planFingerprint(current.current.plan)!==planFingerprint(plan))throw new Error('stale');

  };
  const command=async(intent:AyaIntent):Promise<ActionOutcome>=>{
    if(intent.kind==='navigate'){interrupt();navigate(intent.space,intent.section);return {ok:true,message:'Opening the requested space. Your plan stays with you.'};}
    if(intent.kind==='explain')return {ok:true,message:`Your plan has ${state.plan.length} of 5 decisions. Remaining: ${summarizePlan(state.plan).remaining} ${terms.unit}. Effects are calculated over eight ${terms.seasons}.`};
    if(running.current)return {ok:false,message:'I am already working on your request. You can stop me and choose another action.'};
    const controller=new AbortController(),signal=controller.signal;running.current=controller;
    const snapshot=current.current;sequenceBefore.current=snapshot.plan;sequenceApplied.current=false;
    setAutomation({active:true,progress:'Checking the budget, compatibility and path to five decisions…'});
    try {
      if(intent.kind==='add'){
        const item=INITIATIVES[intent.initiativeId],district=intent.districtId??snapshot.focusedDistrict??'nura';
        const decision=(item.scope==='citywide'?{scope:'citywide',initiativeId:item.id}:{scope:'district',initiativeId:item.id,districtId:district}) as Decision;
        const edited=applyEdit(snapshot.plan,{kind:'add',decision});
        if(!edited.accepted)return {ok:false,message:edited.issues.map(issueMessage).join(' ')};
        if(!hasCompletion(edited.plan))return {ok:false,message:'This project would leave no valid fifth decision. Select “Complete the plan” to see a feasible option with a specific replacement.'};
        navigate('map');dispatch({type:'district',districtId:district});dispatch({type:'choose',initiativeId:item.id});
        setAutomation({active:true,progress:`Choosing ${item.name.toLowerCase()} · ${scopeName(decision)} · ${item.cost} ${unitFor(item.cost)} Remaining: ${summarizePlan(edited.plan).remaining}.`});
        // Keep the named, priced step visible long enough to stop it deliberately.
        await wait(1600,signal);assertCurrent(snapshot.revision,signal);await apply(edited.plan,snapshot.revision,signal);
        setAutomation({active:true,progress:`${item.name} — decision accepted. The city is changing; ${item.cost} ${unitFor(item.cost)} committed.`});
        await wait(constructionDuration(decision),signal);
        return {ok:true,message:`${item.name} — is now in your plan. ${item.cost} ${unitFor(item.cost)} committed, remaining: ${summarizePlan(edited.plan).remaining}. You can now meet residents or choose the next issue. Effects begin after a delay of ${item.lag} ${terms.seasons}; results cover eight ${terms.seasons}.`};
      }
      let target:Plan;
      if(intent.kind==='repair'){
        if(intent.expectedFingerprint!==planFingerprint(snapshot.plan))throw new Error('stale');
        target=intent.plan;
      }else{
        const answer=await dashboardApi<{completion:ReturnType<typeof findBestCompletion>;repair:ReturnType<typeof findPlanRepair>}>('complete',{plan:snapshot.plan},signal);assertCurrent(snapshot.revision,signal);
        if(!answer.completion){
          const repair=answer.repair;if(!repair||validateDraft(repair.plan).status!=='complete')return {ok:false,message:'No valid continuation was found. Open Projects and remove the most expensive decision to recover its budget.'};
          const removed:Plan=repair.removed??[],added:Plan=repair.plan.filter((d:Decision)=>!snapshot.plan.some(p=>decisionKey(p)===decisionKey(d)));
          return {ok:false,message:'The plan cannot be completed while keeping every current decision. Here is a specific replacement.',repair:{plan:repair.plan,expectedFingerprint:planFingerprint(snapshot.plan),title:`Replace: ${removed.map(d=>INITIATIVES[d.initiativeId].name).join(', ')}`,detail:`With: ${added.map(d=>`${INITIATIVES[d.initiativeId].name} (${scopeName(d)})`).join(', ')}. Spending change ${repair.costDelta>0?'+':''}${repair.costDelta} ${terms.unit}. Model result ${format(repair.score)}. Keeping ${repair.preserved} of your decisions.`}};
        }
        target=answer.completion.plan;
        if(!snapshot.plan.every(d=>target.some(p=>decisionKey(p)===decisionKey(d))))throw new Error('stale');
      }
      const checked=validateDraft(target);if(checked.status!=='complete')throw new Error('service');
      navigate('map');
      if(intent.kind==='repair'){
        await apply(checked.plan,snapshot.revision,signal);
        setAutomation({active:true,progress:'Agreed replacement accepted. Recalculating the same plan for the city and council.'});
        await wait(13000,signal);
      }else{
        let expectedPlan=snapshot.plan;
        for(const decision of checked.plan.filter(d=>!snapshot.plan.some(p=>decisionKey(p)===decisionKey(d)))){
          const live=current.current;signal.throwIfAborted();
          const expected=expectedPlan;
          if(planFingerprint(live.plan)!==planFingerprint(expected))throw new Error('stale');
          dispatch({type:'district',districtId:decision.scope==='district'?decision.districtId:'nura'});dispatch({type:'choose',initiativeId:decision.initiativeId});
          const item=INITIATIVES[decision.initiativeId];setAutomation({active:true,progress:`Decision ${live.plan.length+1}/5 · ${item.name} · ${item.cost} ${unitFor(item.cost)}`});
          await wait(400,signal);await apply([...live.plan,decision],live.revision,signal);expectedPlan=[...live.plan,decision];await wait(constructionDuration(decision),signal);
        }
      }
      return {ok:true,message:`Five decisions are ready. I kept ${intent.kind==='complete'?'all your decisions and chose the highest-scoring valid continuation':'the agreed replacement'}. Remaining: ${summarizePlan(checked.plan).remaining} ${terms.unit}. Open the result: a high overall index does not mean every city issue is resolved.`};
    }catch(error){return {ok:false,message:signal.aborted?'Stopped. Accepted decisions are saved; continue yourself or undo my sequence.':error instanceof Error&&error.message==='stale'?'The plan changed, so I stopped. New decisions are saved. Repeat your request for the current plan.':'The planning service has not responded yet. Your plan is saved. Retry or choose a project manually.'};}
    finally{if(running.current===controller){running.current=null;setAutomation(previous=>({...previous,active:false}));}}
  };
  const undo=()=>{
    interrupt();const live=current.current,record=transaction.current;if(!record)return;
    const plan=inverseTransaction(live.plan,record);
    if(!plan){setAutomation({active:false,progress:'This project was edited manually after my action. I will preserve your changes; use the plan editor.'});return;}
    dispatch({type:'applyPlan',plan,expectedRevision:live.revision,now:Date.now()});transaction.current=null;setUndoVersion(undoVersion+1);setAutomation({active:false,progress:'My latest decisions were undone. Later manual changes are preserved.'});
  };
  return {command,interrupt,undo,automation,canUndo:!!transaction.current&&!!inverseTransaction(state.plan,transaction.current)};
}
