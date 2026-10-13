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
  const interrupt=()=>{if(running.current){running.current.abort();running.current=null;if(current.current.candidate)dispatch({type:'cancel'});setAutomation({active:false,progress:'Вы управляете городом. Уже принятые решения сохранены.'});}};
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
    if(intent.kind==='navigate'){interrupt();navigate(intent.space,intent.section);return {ok:true,message:'Открываю нужное пространство. Ваш план остаётся с вами.'};}
    if(intent.kind==='explain')return {ok:true,message:`В плане ${state.plan.length} из 5 решений. Осталось ${summarizePlan(state.plan).remaining} ${terms.unit}. Эффекты рассчитываются на горизонте восьми ${terms.seasons}.`};
    if(running.current)return {ok:false,message:'Я уже выполняю ваш запрос. Можно остановить меня и выбрать другое действие.'};
    const controller=new AbortController(),signal=controller.signal;running.current=controller;
    const snapshot=current.current;sequenceBefore.current=snapshot.plan;sequenceApplied.current=false;
    setAutomation({active:true,progress:'Проверяю бюджет, совместимость и путь к пяти решениям…'});
    try {
      if(intent.kind==='add'){
        const item=INITIATIVES[intent.initiativeId],district=intent.districtId??snapshot.focusedDistrict??'nura';
        const decision=(item.scope==='citywide'?{scope:'citywide',initiativeId:item.id}:{scope:'district',initiativeId:item.id,districtId:district}) as Decision;
        const edited=applyEdit(snapshot.plan,{kind:'add',decision});
        if(!edited.accepted)return {ok:false,message:edited.issues.map(issueMessage).join(' ')};
        if(!hasCompletion(edited.plan))return {ok:false,message:'Этот проект оставит план без допустимого пятого решения. Нажмите «Доведи план»: я покажу выполнимый вариант с конкретной заменой.'};
        navigate('map');dispatch({type:'district',districtId:district});dispatch({type:'choose',initiativeId:item.id});
        setAutomation({active:true,progress:`Выбираю ${item.name.toLowerCase()} · ${scopeName(decision)} · ${item.cost} ${unitFor(item.cost)} Останется ${summarizePlan(edited.plan).remaining}.`});
        // Keep the named, priced step visible long enough to stop it deliberately.
        await wait(1600,signal);assertCurrent(snapshot.revision,signal);await apply(edited.plan,snapshot.revision,signal);
        setAutomation({active:true,progress:`${item.name} — решение принято. Город меняется; ${item.cost} ${unitFor(item.cost)} закреплено.`});
        await wait(constructionDuration(decision),signal);
        return {ok:true,message:`${item.name} — теперь в плане. ${item.cost} ${unitFor(item.cost)} закреплено, осталось ${summarizePlan(edited.plan).remaining}. Теперь можно встретить жителей или выбрать следующий вопрос. Эффект начинается с задержкой ${item.lag} ${terms.seasons}; итог считаем за восемь ${terms.seasons}.`};
      }
      let target:Plan;
      if(intent.kind==='repair'){
        if(intent.expectedFingerprint!==planFingerprint(snapshot.plan))throw new Error('stale');
        target=intent.plan;
      }else{
        const answer=await dashboardApi<{completion:ReturnType<typeof findBestCompletion>;repair:ReturnType<typeof findPlanRepair>}>('complete',{plan:snapshot.plan},signal);assertCurrent(snapshot.revision,signal);
        if(!answer.completion){
          const repair=answer.repair;if(!repair||validateDraft(repair.plan).status!=='complete')return {ok:false,message:'Не удалось подобрать допустимое продолжение. Откройте проекты и уберите самое дорогое решение; бюджет вернётся в план.'};
          const removed:Plan=repair.removed??[],added:Plan=repair.plan.filter((d:Decision)=>!snapshot.plan.some(p=>decisionKey(p)===decisionKey(d)));
          return {ok:false,message:'Сохранить все текущие решения и закончить план не получится. Вот конкретная замена для вашего решения.',repair:{plan:repair.plan,expectedFingerprint:planFingerprint(snapshot.plan),title:`Заменить: ${removed.map(d=>INITIATIVES[d.initiativeId].name).join(', ')}`,detail:`Вместо них: ${added.map(d=>`${INITIATIVES[d.initiativeId].name} (${scopeName(d)})`).join(', ')}. Изменение расходов ${repair.costDelta>0?'+':''}${repair.costDelta} ${terms.unit}. Итог модели ${format(repair.score)}. Сохранится ${repair.preserved} ваших решений.`}};
        }
        target=answer.completion.plan;
        if(!snapshot.plan.every(d=>target.some(p=>decisionKey(p)===decisionKey(d))))throw new Error('stale');
      }
      const checked=validateDraft(target);if(checked.status!=='complete')throw new Error('service');
      navigate('map');
      if(intent.kind==='repair'){
        await apply(checked.plan,snapshot.revision,signal);
        setAutomation({active:true,progress:'Принята согласованная замена. Пересчитываю тот же план для города и совета.'});
        await wait(13000,signal);
      }else{
        let expectedPlan=snapshot.plan;
        for(const decision of checked.plan.filter(d=>!snapshot.plan.some(p=>decisionKey(p)===decisionKey(d)))){
          const live=current.current;signal.throwIfAborted();
          const expected=expectedPlan;
          if(planFingerprint(live.plan)!==planFingerprint(expected))throw new Error('stale');
          dispatch({type:'district',districtId:decision.scope==='district'?decision.districtId:'nura'});dispatch({type:'choose',initiativeId:decision.initiativeId});
          const item=INITIATIVES[decision.initiativeId];setAutomation({active:true,progress:`Решение ${live.plan.length+1}/5 · ${item.name} · ${item.cost} ${unitFor(item.cost)}`});
          await wait(400,signal);await apply([...live.plan,decision],live.revision,signal);expectedPlan=[...live.plan,decision];await wait(constructionDuration(decision),signal);
        }
      }
      return {ok:true,message:`Пять решений готовы. Сохранила ${intent.kind==='complete'?'все ваши решения и выбрала лучшее допустимое продолжение по индексу':'согласованную замену'}. Осталось ${summarizePlan(checked.plan).remaining} ${terms.unit}. Откройте итог: высокий общий индекс не означает, что все вопросы города решены.`};
    }catch(error){return {ok:false,message:signal.aborted?'Остановилась. Принятые решения сохранены; вы можете продолжить сами или отменить мою последовательность.':error instanceof Error&&error.message==='stale'?'План изменился, поэтому я остановилась. Новые решения сохранены. Повторите запрос для актуального плана.':'Сервис подбора пока не ответил. Ваш план сохранён. Можно повторить запрос или выбрать проект вручную.'};}
    finally{if(running.current===controller){running.current=null;setAutomation(previous=>({...previous,active:false}));}}
  };
  const undo=()=>{
    interrupt();const live=current.current,record=transaction.current;if(!record)return;
    const plan=inverseTransaction(live.plan,record);
    if(!plan){setAutomation({active:false,progress:'После моего действия этот проект уже изменён вручную. Я сохраню ваши изменения; используйте редактор плана.'});return;}
    dispatch({type:'applyPlan',plan,expectedRevision:live.revision,now:Date.now()});transaction.current=null;setUndoVersion(undoVersion+1);setAutomation({active:false,progress:'Мои последние решения отменены. Последующие ручные изменения сохранены.'});
  };
  return {command,interrupt,undo,automation,canUndo:!!transaction.current&&!!inverseTransaction(state.plan,transaction.current)};
}
