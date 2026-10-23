import {ControlIcon} from '../ui/ControlIcon';
import {useContent} from '../modes/content';
import {STATIC_BUILD} from '../services/environment';
import {useEffect,useRef,useState} from 'react';
import {planFingerprint} from '../domain/identity';
import {summarizePlan} from '../domain/plan';
import {AyaMascot} from './AyaMascot';
import {intentLabel,localReply,parseSupportedIntent,readIntent} from './context';
import {loadConversation,saveConversation} from './storage';
import {readAssistantReply} from './reply';
import type {AssistantProps,AssistantReply,AyaContext,AyaExpression,AyaIntent,AyaMessage} from './types';
import './assistant.css';

const uid=()=>`${Date.now()}:${Math.random().toString(36).slice(2,9)}`;
const greeting:AyaMessage={id:'welcome',role:'assistant',time:0,text:'I am Aya. I can help compare projects, find a trade-off or complete your plan. Where shall we start?',mode:'action'};
export function Assistant(props:AssistantProps) {
 const {mode,storage,INITIATIVES,DISTRICTS,terms,unitFor}=useContent();
 const districtName=(id:import('../domain/types').DistrictId|null)=>mode.districts.find(d=>d.id===id)?.name??'citywide';
 const {state,space,command,interrupt,undo,canUndo,automation}=props;
 // A map proposal can remain open in state while the visitor meets someone else.
 // Only the visible space supplies project context to the conversation.
 const selected=space==='map'?state.candidate?.decision:null;
 const appeal=selected&&props.appeal&&(!props.appeal.initiativeIds.includes(selected.initiativeId)||(selected.scope==='district'&&selected.districtId!==props.appeal.districtId))?null:props.appeal;
 const [localOpen,setOpen]=useState(false),[draft,setDraft]=useState(''),[messages,setMessages]=useState<AyaMessage[]>(()=>loadConversation(storage)),[pending,setPending]=useState(false),[acting,setActing]=useState(false),[expression,setExpression]=useState<AyaExpression>('idle'),[storageFailed,setStorageFailed]=useState(false),[providerMode,setProviderMode]=useState<'unknown'|'live'|'local'>('unknown'),[retry,setRetry]=useState<string|null>(null);
 const open=props.open??localOpen;
 const [districtChoice,setDistrictChoice]=useState<AyaIntent|null>(null);
 const inputRef=useRef<HTMLTextAreaElement>(null),logRef=useRef<HTMLDivElement>(null),entryRef=useRef<HTMLButtonElement>(null),pendingRef=useRef<{controller:AbortController;stamp:string}|null>(null),busyRef=useRef(false),externalRef=useRef<number|null>(null),actionSerial=useRef(0);
 const followLog=useRef(true),lastRequest=useRef<string|null>(null),returnFocus=useRef(false);
 const context:AyaContext={worldMode:mode.id,plan:state.plan,revision:state.revision,space,districtId:state.focusedDistrict,projectId:selected?.initiativeId??(space==='map'?state.selectedCommitment:null),appeal:appeal??null,...(props.council?{council:props.council}:{})};
 const contextRef=useRef(context);contextRef.current=context;
 const fingerprint=planFingerprint(state.plan),summary=summarizePlan(state.plan),contextStamp=JSON.stringify([mode.id,fingerprint,state.revision,space,state.focusedDistrict,context.projectId,appeal?.id??'']);
 const stampRef=useRef(contextStamp);stampRef.current=contextStamp;
 const busy=pending||acting||automation.active;
 function append(value:Omit<AyaMessage,'id'|'time'>){setMessages(previous=>[...previous,{...value,id:uid(),time:Date.now()}].slice(-60));}
 function setOpened(value:boolean){if(!value)returnFocus.current=true;setOpen(value);props.onOpenChanged?.(value);}
 useEffect(()=>{setStorageFailed(!saveConversation(messages,storage));},[messages]);
 useEffect(()=>{if(open){inputRef.current?.focus();followLog.current=true;}else if(returnFocus.current){entryRef.current?.focus();returnFocus.current=false;}},[open]);
 useEffect(()=>{
  const log=logRef.current;if(!open||!log||!followLog.current)return;
  if(!messages.length){log.scrollTop=0;return;}
  const reply=log.querySelector<HTMLElement>('.aya-message:last-of-type');
  if(messages.at(-1)?.role==='assistant'&&reply&&reply.offsetHeight>log.clientHeight-16){
   // A complete, long answer should begin with its explanation, not its last fact.
   log.scrollTop+=reply.getBoundingClientRect().top-log.getBoundingClientRect().top-12;
   followLog.current=false;
  }else log.scrollTop=log.scrollHeight;
 },[open,messages,pending,automation.progress]);
 useEffect(()=>{setDistrictChoice(null);},[contextStamp]);
 useEffect(()=>{const request=pendingRef.current;if(request&&request.stamp!==contextStamp){request.controller.abort();pendingRef.current=null;busyRef.current=false;setPending(false);setExpression('attention');append({role:'assistant',text:'The context changed. I stopped the previous request to avoid acting on an outdated plan. We can continue from the current state.',mode:'action'});}},[contextStamp]);
 useEffect(()=>()=>{actionSerial.current++;pendingRef.current?.controller.abort();pendingRef.current=null;},[]);
 useEffect(()=>{if(expression!=='success')return;const timer=setTimeout(()=>setExpression('idle'),4500);return()=>clearTimeout(timer);},[expression]);
 async function execute(intent:AyaIntent){
  if(busyRef.current||automation.active)return;
  if(intent.kind==='add'&&INITIATIVES[intent.initiativeId].scope==='district'&&!intent.districtId){setDistrictChoice(intent);append({role:'assistant',text:`For project “${INITIATIVES[intent.initiativeId].name}” choose ${terms.district.toLowerCase()}.`,mode:'action'});return;}
  setDistrictChoice(null);busyRef.current=true;setActing(true);setExpression('thought');const serial=++actionSerial.current;
  try{const outcome=await command(intent);if(serial!==actionSerial.current)return;append({role:'assistant',text:outcome.message,mode:'action',...(outcome.repair?{repair:outcome.repair}:{}),fingerprint:planFingerprint(contextRef.current.plan)});setExpression(outcome.ok?'success':'attention');setRetry(outcome.ok?null:lastRequest.current);}
  catch{if(serial===actionSerial.current){append({role:'assistant',text:'Could not complete the action. Your current plan is saved in the city; retry the request.',mode:'action'});setExpression('error');setRetry(lastRequest.current);}}
  finally{if(serial===actionSerial.current){busyRef.current=false;setActing(false);}}
 }
 async function send(text:string){
  const clean=text.trim().slice(0,2000);if(!clean||busyRef.current||automation.active)return;
  setDraft('');setOpened(true);setRetry(null);lastRequest.current=clean;followLog.current=true;append({role:'user',text:clean});
  const captured=contextRef.current,known=parseSupportedIntent(clean,captured);
  if(known){await execute(known);return;}
  busyRef.current=true;setPending(true);setExpression('thought');const controller=new AbortController(),stamp=stampRef.current;pendingRef.current={controller,stamp};
  const timer=setTimeout(()=>controller.abort('timeout'),18000);
  try{
   let reply:AssistantReply;
   try{
    if(STATIC_BUILD){reply=localReply(clean,captured);}else{
    const response=await fetch(`${import.meta.env.BASE_URL}api/assistant`,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({text:clean,history:messages.slice(-10).map(m=>({role:m.role,text:m.text.slice(0,1200)})),context:captured})});
    if(!response.ok)throw new Error('unavailable');reply=readAssistantReply(await response.json(),captured);}
   }catch{
    if(pendingRef.current?.controller!==controller)return;
    reply=localReply(clean,captured,'failed');
   }
   if(stampRef.current!==stamp||pendingRef.current?.controller!==controller)return;
   setProviderMode(reply.mode);setExpression(reply.mode==='live'||reply.reason==='unavailable'?'explanation':'attention');
   if(reply.mode==='local'&&(reply.reason==='failed'||reply.reason==='limited'))setRetry(clean);
   append({role:'assistant',text:reply.text,mode:reply.mode,facts:reply.facts,intent:readIntent(reply.intent),fingerprint:reply.fingerprint});
  }finally{clearTimeout(timer);if(pendingRef.current?.controller===controller){pendingRef.current=null;busyRef.current=false;setPending(false);}}
 }
 useEffect(()=>{const prompt=props.externalPrompt;if(prompt&&prompt.id!==externalRef.current){externalRef.current=prompt.id;setOpened(true);if(busyRef.current||automation.active){setDraft(prompt.text);return;}void send(prompt.text);}},[props.externalPrompt?.id]);
 function stop(){actionSerial.current++;pendingRef.current?.controller.abort();pendingRef.current=null;busyRef.current=false;setPending(false);setActing(false);interrupt();setExpression('attention');append({role:'assistant',text:'Stopped. Accepted decisions remain in the plan. Continue yourself or undo my last step.',mode:'action'});}
 const activeExpression=busy?'thought':expression;
 const visibleMessages=messages.length?messages:[mode.id==='khanate'?{...greeting,text:'Khan, I am Aya, keeper of the chronicle. I can help hear a petition, compare decrees and understand what comes next. Whose story shall we begin with?'}:greeting];
 const project=selected?.initiativeId??appeal?.initiativeIds[0]??null;
 const selectedFunded=!!project&&state.plan.some(d=>d.initiativeId===project&&(d.scope==='citywide'||d.districtId===(appeal?.districtId??state.focusedDistrict)));
 const suggestions=selected?['What will this project achieve?',INITIATIVES[selected.initiativeId].scope==='district'?`Compare ${terms.districts.toLowerCase()} for this project`:'What should I consider?','How much budget remains?']:appeal?selectedFunded?['What will this project achieve?','What remains unresolved?',summary.count===5?'Show the plan review':'How much budget remains?']:['Help with this request','What will this project achieve?','Complete the plan']:summary.count===5?['Show the plan review','Open the council','Show residents']:summary.count===0?['Where should I start?','Show residents','How does the plan work?']:['Complete the plan','How much budget remains?','Show residents'];
 return <aside className={`aya-assistant ${open?'is-open':''} ${space==='dashboard'?'on-dark':''}`} data-testid="aya-assistant">
  {open&&<section id="aya-dialogue" className="aya-dialogue paper-sheet" aria-labelledby="aya-title" data-occludes-city onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpened(false);}}}>
   <header className="aya-dialogue-header"><AyaMascot expression={activeExpression}/><div><h2 id="aya-title">Aya <span>is here</span></h2><p>{busy?'Helping your city':`${summary.remaining} ${unitFor(summary.remaining)} · ${summary.count}/5 decisions`}</p></div><button className="aya-icon-button" type="button" aria-label="Minimise the conversation with Aya" onClick={()=>setOpened(false)}><ControlIcon kind="close"/></button></header>
   {(appeal||project)&&<div className="aya-context-card">{appeal&&props.onClearAppeal&&<button className="aya-clear-context" aria-label="Remove request from the conversation" onClick={props.onClearAppeal}><ControlIcon kind="close" size={18}/></button>}<span>{appeal?'REQUEST IN THIS CONVERSATION':'SELECTED PROJECT'}</span><strong>{appeal?.title??(project?INITIATIVES[project].name:'')}</strong><p>{appeal?districtName(appeal.districtId):districtName(state.focusedDistrict)}{project?` · ${INITIATIVES[project].cost} ${terms.unit}`:''}</p></div>}
   <div ref={logRef} className="aya-chat-log" role="log" aria-label="Conversation history with Aya" aria-live="polite" aria-relevant="additions" onScroll={event=>{const el=event.currentTarget;followLog.current=el.scrollHeight-el.scrollTop-el.clientHeight<40;}}>
    {visibleMessages.map(message=><article key={message.id} className={`aya-message paper-card from-${message.role}`}><span className="aya-message-author">{message.role==='user'?'You':message.mode==='live'?'Aya · AI conversation':message.mode==='local'?'Aya · no AI connection':'Aya'}</span><p>{message.text}</p>{message.facts?.length?<details className="aya-fact-details"><summary>Figures and evidence · {message.facts.length}</summary><ul className="aya-facts">{message.facts.map(fact=><li key={fact.id}>{fact.text}</li>)}</ul></details>:null}
     {message.repair&&<div className="aya-repair"><strong>{message.repair.title}</strong><p>{message.repair.detail}</p><button disabled={busy||message.repair.expectedFingerprint!==fingerprint} onClick={()=>void execute({kind:'repair',plan:message.repair!.plan,expectedFingerprint:message.repair!.expectedFingerprint})}>{message.repair.expectedFingerprint===fingerprint?'Apply this replacement':'The plan changed — request a new option'}</button></div>}
     {message.intent&&<button className="aya-message-action" disabled={busy||message.fingerprint!==fingerprint} onClick={()=>void execute(message.intent!)}>{message.fingerprint===fingerprint?intentLabel(message.intent,mode.id):'This proposal belongs to the previous plan'}</button>}
    </article>)}
    {busy&&<div className="aya-progress" role="status"><span className="aya-progress-orbit"/><p>{automation.active?automation.progress:acting?'Checking the decision and carrying out the steps…':'Thinking about your question…'}</p></div>}
   </div>
   {districtChoice?.kind==='add'&&<div className="aya-districts" aria-label="Choose a district for the project">{DISTRICTS.map(d=><button key={d.id} disabled={busy} onClick={()=>void execute({...districtChoice,districtId:d.id})}>{d.name}</button>)}</div>}
   {!busy&&<div className="aya-suggestions" aria-label="Possible next steps">{suggestions.map(suggestion=><button key={suggestion} type="button" onClick={()=>void send(suggestion==='What will this project achieve?'&&project?`What will this achieve: ${INITIATIVES[project].name}?`:suggestion)}>{suggestion}</button>)}</div>}
   <div className="aya-control-row">{busy?<button className="aya-stop" onClick={stop}><ControlIcon kind="stop" size={18}/>Stop</button>:retry?<button onClick={()=>void send(retry)}>Retry request</button>:<span>Ask a question or request an action.</span>}{canUndo&&<button disabled={busy} onClick={()=>{undo();inputRef.current?.focus();setExpression('attention');append({role:'assistant',text:'Requested undo of my latest actions. Your subsequent changes will stay in the plan.',mode:'action'});}}>Undo my step</button>}</div>
   <form className="aya-composer" onSubmit={event=>{event.preventDefault();void send(draft);}}><label className="aya-sr-only" htmlFor="aya-message">Message to Aya</label><textarea ref={inputRef} id="aya-message" rows={2} maxLength={2000} value={draft} onChange={event=>setDraft(event.target.value)} placeholder="What would you like to change in the city?" onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send(draft);}}}/><button type="submit" disabled={!draft.trim()||busy} aria-label="Send message to Aya"><ControlIcon kind="arrow-up"/></button></form>
   <p className="aya-chat-note">{storageFailed?'History is available in this tab. Your browser did not allow it to be saved.':providerMode==='local'?'Open-ended AI conversation is unavailable. Verified actions still work.':'Figures come from the city model. Decisions are validated before being applied.'}</p>
  </section>}
  <button ref={entryRef} data-occludes-city type="button" className={`aya-entry ${busy?'is-busy':''}`} aria-expanded={open} aria-controls="aya-dialogue" aria-label={open?'Minimise Aya':'Open Aya, the city assistant'} onClick={()=>setOpened(!open)}><span className="aya-entry-glow"/><AyaMascot expression={activeExpression}/><span className="aya-entry-label"><strong>Aya</strong><small>{busy?'Helping…':open?'Minimise':mode.id==='khanate'?'Keeper of the chronicle':'Help with the city'}</small></span>{!open&&busy&&<span className="aya-entry-dot"/>}</button>
 </aside>;
}
export {AyaMascot};
