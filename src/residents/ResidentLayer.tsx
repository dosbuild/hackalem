import {ControlIcon} from '../ui/ControlIcon';
import {useContent} from '../modes/content';
import { Component, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { Action, AppState } from '../app/state';
import { format, signed } from '../ui/copy';
import { anchorFor, applies, branchKey, emptyMemory, hasCurrentResult, nearby, observe, readMemory, remember } from './engine';
import type { Anchor, Line, Resident, ResidentWorldAdapter } from './types';
import { momentFor } from './moments';
import {ResidentPortrait} from '../ui/ResidentPortrait';
import {annotationPosition} from '../world/projection';
import type {LivingStory} from '../living/appeals';
import {shortOpening} from '../living/street-residents';

import './residents.css';

const projectPossibility:Record<import('../domain/types').InitiativeId,string>={
 M1:'A dedicated lane would keep the bus out of general traffic. Getting away from here matters more to me than seeing new road markings.',
 M2:'Coordinated signals could make the road calmer. But I will still stop and look before a car turns.',
 M3:'New access to rail would give us another way to travel. Where the entrance goes and how to reach it are separate questions.',
 M4:'There could be somewhere beside the sapling to sit with neighbours. The young trees would still need care afterwards.',
 M5:'Different fuel could reduce smoke around the homes. Heating and network reliability still need separate checks.',
 M6:'Several courtyards need planting. But a small tree is not yet a windbreak: it needs care.',
 M7:'More learning places would help the district. This plan does not yet say which school will accept a child.',
 M8:'Another clinic would give the district more options. Booking a particular appointment is a separate question.',
 M9:'We would have somewhere to play with neighbours. That helps us, although a court cannot replace a school or doctor.',
 M10:'Lighting would make the roadside easier to see in the evening. I would still ask who uses the camera and how.',
 M11:'A marked crossing will help drivers see us. They will have to slow down: there are two sides to this.',
 M12:'I could see what was happening with the request. But getting an answer and getting a repair are different things.',
 M13:'An upgraded network section would help the service. That does not make every other pipe new at once.',
 M14:'Shared coordination would help prepare for duty. The old network itself still needs maintenance.',
};
const MEMORY_KEY='akim:synthetic-residents:v1';

export function Portrait({resident}:{resident:Resident}) {return <ResidentPortrait visual={resident.visual} name={`Portrait: ${resident.name}`} className="conversation-portrait"/>;}

function Speech({line}:{line:Line}) {return <p className="resident-russian" lang="en">{line.ru}</p>;}
export type EncounterSelection={resident:Resident;anchor:Anchor;talking:boolean;story?:LivingStory};
export interface ResidentLayerProps { state:AppState; dispatch:Dispatch<Action>; adapter?:ResidentWorldAdapter;
  selection?:EncounterSelection|null;sheet?:boolean;overlayOpen?:boolean;onClose?:()=>void;onEncounter?:(id:string|null,anchor?:Anchor,talking?:boolean)=>void;onPlan?:()=>void }
class ResidentBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<p className="notice" role="status">Encounters are temporarily unavailable. You can continue planning.</p>:this.props.children;}
}
export function ResidentLayer(props:ResidentLayerProps){return <ResidentBoundary><ResidentContent {...props}/></ResidentBoundary>;}
function ResidentContent({state,dispatch,adapter,selection,sheet=false,overlayOpen=false,onClose,onEncounter,onPlan}:ResidentLayerProps) {
  const {mode,storage,INITIATIVES,RESIDENTS,RESIDENT_BY_ID,districtName,indicatorNames,LIMITS,SHORT_LIMITS,terms}=useContent();
  const FIRST_RESIDENT=RESIDENTS[0]!;
  const initialMemory=()=>{try{return readMemory(storage.getItem(MEMORY_KEY),RESIDENT_BY_ID);}catch{return emptyMemory();}};
  const selectedId=selection?.resident.id??null,talking=selection?.talking??true;
  const [memory,setMemory]=useState(initialMemory);
  const [question,setQuestion]=useState<'situation'|'project'|'remaining'|'moment'|null>(null);
  const heading=useRef<HTMLHeadingElement>(null),trigger=useRef<HTMLElement|null>(null);
  const surface=useRef<HTMLElement>(null),tether=useRef<SVGSVGElement>(null);
  const selected=selection?.resident??FIRST_RESIDENT;
  const residents=useMemo(()=>nearby(selected,RESIDENTS),[selected]);
  const anchor=selection?.anchor??anchorFor(selected),observation=observe(selected,state,anchor,mode.narrative),moment=momentFor(selected);
  const branch=branchKey(state),future=hasCurrentResult(state)&&state.comparisonPosition>=.5;
  const item=INITIATIVES[selected.primary];
  const included=state.plan.some(d=>d.initiativeId===selected.primary&&applies(d,anchor.districtId));
  const proposed=state.candidate?.decision.initiativeId===selected.primary&&applies(state.candidate.decision,anchor.districtId);
  function focus(resident:Resident,context?:Anchor,talk=true) {
    trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const place=context??anchorFor(resident);setQuestion(null);
    onEncounter?.(resident.id,place,talk);setMemory(m=>remember(m,branch,resident.id,RESIDENT_BY_ID));
    // Opening a conversation is not a camera command or a change of proposal scope.
  }
  function dismiss(restoreFocus:boolean){setQuestion(null);if(onClose)onClose();else onEncounter?.(null);if(restoreFocus&&!onClose)requestAnimationFrame(()=>{const target=trigger.current?.isConnected?trigger.current:document.querySelector<HTMLElement>('.resident-toggle');target?.focus({preventScroll:true});});}
  const close=()=>dismiss(true);
  useEffect(()=>{if(selectedId){setQuestion(null);heading.current?.focus({preventScroll:true});setMemory(m=>remember(m,branch,selectedId,RESIDENT_BY_ID));}},[selectedId,talking]);
  useEffect(()=>setQuestion(null),[branch,future,state.candidate]);
  useEffect(()=>{if(state.announcement==='restarted'){setMemory(emptyMemory());if(selectedId)dismiss(false);}},[state.announcement,state.revision]);
  useEffect(()=>{if(selectedId&&state.cameraRequest.kind==='district'&&state.focusedDistrict!==anchor.districtId)dismiss(false);},[state.cameraRequest.id]);
  useEffect(()=>{try{storage.setItem(MEMORY_KEY,JSON.stringify(memory));}catch{/* optional */}},[memory]);
  useEffect(()=>adapter?.subscribeSelection(id=>{const r=RESIDENT_BY_ID[id];if(r)focus(r);}),[adapter,branch,onEncounter,RESIDENT_BY_ID]);
  useEffect(()=>{if(!selectedId||overlayOpen)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!(event.target instanceof Element&&event.target.closest('#aya-dialogue,dialog'))){event.stopImmediatePropagation();close();}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);},[selectedId,onClose,overlayOpen]);
  useEffect(()=>{
    if(!selectedId){adapter?.clear();return;}
    adapter?.show({selectedId,anchor,residents,observation,phase:future?1:0,
      moment:{id:moment.id,kind:moment.kind,interaction:question==='moment'?1:0,
        treatments:future?state.plan.filter(d=>applies(d,anchor.districtId)&&state.result!.value.measureContributions.some(c=>c.districtId===anchor.districtId&&c.initiativeIds.includes(d.initiativeId)&&c.amount>0)).map(d=>d.initiativeId):[]},
      proposal:state.candidate&&applies(state.candidate.decision,anchor.districtId)?state.candidate.decision.initiativeId:null});
  },[adapter,selectedId,anchor.id,residents,observation,future,question,state]);
  useEffect(()=>()=>adapter?.clear(),[adapter]);
  useEffect(()=>{
    const node=surface.current;if(!node||!selectedId||sheet)return;
    const size=()=>{adapter?.annotationSize?.({width:node.offsetWidth,height:node.offsetHeight});};
    const observer=new ResizeObserver(size);observer.observe(node);size();
    const stop=adapter?.subscribeProjection?.(frame=>{
      if(!frame){node.style.visibility='hidden';if(tether.current)tether.current.style.visibility='hidden';return;}
      const {anchor,width,height}=frame,visible=anchor.visible&&anchor.x>0&&anchor.x<width&&anchor.y>130&&anchor.y<height-25;
      const position=annotationPosition(anchor,{width:node.offsetWidth,height:node.offsetHeight},{width,height},frame.occlusions);
      node.style.transform=`translate(${position.x}px,${position.y}px)`;node.style.visibility=visible?'visible':'hidden';node.dataset.frame=String(frame.frame);node.dataset.anchorX=String(anchor.x);node.dataset.anchorY=String(anchor.y);
      const line=tether.current?.querySelector('line'),circle=tether.current?.querySelector('circle');
      if(tether.current)tether.current.style.visibility=visible?'visible':'hidden';
      const endX=Math.max(position.x,Math.min(position.x+node.offsetWidth,anchor.x)),endY=Math.max(position.y,Math.min(position.y+node.offsetHeight,anchor.y));
      line?.setAttribute('x1',String(anchor.x));line?.setAttribute('y1',String(anchor.y));line?.setAttribute('x2',String(endX));line?.setAttribute('y2',String(endY));circle?.setAttribute('cx',String(anchor.x));circle?.setAttribute('cy',String(anchor.y));
    });
    return()=>{observer.disconnect();stop?.();adapter?.annotationSize?.(null);};
  },[adapter,selectedId,talking,sheet]);

  function showPlace(){dispatch({type:'focusLocation',districtId:anchor.districtId,anchorId:anchor.id});}
  function inspect(){
    const existing=state.plan.find(d=>d.initiativeId===selected.primary);
    if(existing&&!state.alternative)dispatch({type:'selectCommitment',initiativeId:selected.primary});
    else {if(state.focusedDistrict!==anchor.districtId)dispatch({type:'district',districtId:anchor.districtId});dispatch({type:'choose',initiativeId:selected.primary});}
    setQuestion(null);
  }
  function backToPlan(){onPlan?.();}
  const line=question==='remaining'?observation.unresolved:question==='situation'||question==='project'&&future?observation.answer:observation.opening;
  if(!selectedId)return null;
  return <>{!sheet&&<svg ref={tether} className="conversation-tether" aria-hidden="true"><line/><circle r="3"/></svg>}<section ref={surface} id="residents" data-occludes-city={sheet||undefined} className={`residents paper-sheet ${sheet?'context-encounter':''} ${selectedId?'conversation-open':'conversation-invitation'}`} aria-label={mode.id==='khanate'?'Residents of the city on the Esil':'Residents of Astana'} data-testid="resident-layer" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
    {!talking?<div className="resident-orientation"><Portrait resident={selected}/><div><strong>{selected.name}</strong><small>{districtName(anchor.districtId)} · {anchor.label}</small></div><button className="primary" onClick={()=>onEncounter?.(selected.id,anchor,true)}>Talk</button><button aria-label="Close meeting place" onClick={close}><ControlIcon kind="close"/></button></div>:
    <div className="resident-encounter" role="region" aria-labelledby="conversation-name" data-resident-id={selected.id} data-observation={observation.phase}>
      <header className="conversation-heading"><Portrait resident={selected}/><div><h3 id="conversation-name" ref={heading} tabIndex={-1}>{selected.name}</h3><p>{selected.role}</p><span>{districtName(anchor.districtId)} · {anchor.label}</span></div><button className="conversation-x" onClick={close} aria-label="Return from conversation"><ControlIcon kind="close"/></button></header>
      <p className="conversation-context">{future?'After two years · your plan\'s outcome':proposed?'Discussing a proposal':included?'Decision made · full outcome after five projects':'Now · life in the district'}</p>
      <div className="resident-speech" aria-live="polite">
        {selection?.story&&question==='remaining'?<p className="resident-russian">{SHORT_LIMITS[selection.story.initiativeId]}</p>:selection?.story&&!future&&question===null?<p className="resident-russian">{shortOpening(selection.story)}</p>:question==='moment'?<p className="resident-russian">{moment.response}</p>:question==='project'&&!future?<><p className="resident-russian">{mode.narrative?mode.projects[selected.primary].benefit:projectPossibility[selected.primary]}</p><p className="conversation-model"><b>Aya · about the model.</b> {LIMITS[selected.primary]} {included?'This decision is already in the plan.':proposed?'You are considering this project.':'This decision for this location is not in the plan yet.'}</p></>:<Speech line={line}/>}
      </div>
      <div className="resident-questions" aria-label="Reply to the resident">
        <button onClick={()=>setQuestion(question==='situation'?'project':'situation')}>{question==='situation'?'What will this project change?':future?'What changed here?':'What is happening here?'}</button>
        {question===null&&!future&&!selection?.story?<button onClick={()=>setQuestion('moment')}>{moment.invitation}</button>:<button onClick={()=>setQuestion('remaining')}>What remains unresolved?</button>}
      </div>
      <div className="conversation-place"><button onClick={showPlace}>Show location on map</button><button onClick={close}>Return <ControlIcon kind="arrow-back" size={18}/></button></div>
      <details className="resident-evidence" data-result-id={observation.evidence.resultId??''}><summary>{future?'What is the answer based on?':`${item.name} · ${item.cost} ${terms.unit}`}</summary>
        {selection?.story&&<p>{selection.story.opening}</p>}
        <p>{item.scope==='citywide'?'Whole city':districtName(anchor.districtId)} · delay {item.lag} {item.lag===1?terms.season:terms.seasons}</p>
        {observation.evidence.calculated?<ul>{observation.evidence.indicators.map(i=><li key={i.id}>{indicatorNames[i.id]}: {format(i.before)} → {format(i.after)} ({signed(i.delta)}){i.critical?' · below 40':''}</li>)}</ul>:<p>Talking and viewing a project cost nothing. Once adopted, the decision appears on the map; the full effect over eight {terms.seasons} is calculated after the fifth project.</p>}
        <p>{observation.evidence.limitation}</p><p className="small">This character is fictional. {mode.id==='astana'?'Dialogue is presented in English.':'These circumstances were written for the fictional city on the Esil.'}</p>
      </details>
      <footer className="encounter-primary-action"><button className="primary paper-button" onClick={future?backToPlan:inspect}>{future?'Return to the plan':included?'Open decision':'Consider project'}</button></footer>
    </div>}
  </section></>;
}
