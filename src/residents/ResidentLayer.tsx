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
 M1:'Если автобусу выделят полосу, ему не придётся стоять в общем потоке. Мне важнее добраться отсюда, чем увидеть новую разметку.',
 M2:'Согласованные сигналы могут сделать дорогу спокойнее. Но перед поворотом машины я всё равно остановлюсь и посмотрю.',
 M3:'Новый доступ к рельсовому транспорту дал бы ещё один способ уехать. Где будет вход и как до него дойти — отдельные вопросы.',
 M4:'Рядом с саженцем могло бы появиться место, где можно присесть с соседями. Молодым деревьям потом всё равно понадобится уход.',
 M5:'Другое топливо могло бы уменьшить дым возле домов. А тепло и надёжность сетей тоже нужно проверять отдельно.',
 M6:'Посадки нужны в разных дворах. Только маленькое дерево ещё не укрытие от ветра — его надо беречь.',
 M7:'Дополнительное место для учёбы помогло бы району. Но какая школа примет ребёнка, из этого плана ещё не ясно.',
 M8:'Ещё одна поликлиника дала бы району больше возможностей. Запись на конкретный приём — другой вопрос.',
 M9:'Было бы место, где поиграть с соседями. Для нас это полезно, хотя школу или врача площадка не заменит.',
 M10:'Со светом край дороги будет легче увидеть вечером. О камере я бы ещё спросил: кто и как её использует?',
 M11:'Обозначенный переход поможет водителям нас заметить. Им придётся замедлиться — здесь есть две стороны.',
 M12:'Я смог бы посмотреть, что происходит с обращением. Но увидеть ответ и дождаться ремонта — разные вещи.',
 M13:'Обновлённый участок сети помог бы службе. Это не значит, что все остальные трубы сразу станут новыми.',
 M14:'Общая координация помогла бы подготовиться к дежурству. Саму старую сеть всё равно надо обслуживать.',
};
const MEMORY_KEY='akim:synthetic-residents:v1';

export function Portrait({resident}:{resident:Resident}) {return <ResidentPortrait visual={resident.visual} name={`Портрет: ${resident.name}`} className="conversation-portrait"/>;}

function Speech({line}:{line:Line}) {return <><p className="resident-russian" lang="ru">{line.ru}</p>{line.kk!==line.ru&&<details className="original-language"><summary>На казахском</summary><p lang="kk">{line.kk}</p></details>}</>;}
export type EncounterSelection={resident:Resident;anchor:Anchor;talking:boolean;story?:LivingStory};
export interface ResidentLayerProps { state:AppState; dispatch:Dispatch<Action>; adapter?:ResidentWorldAdapter;
  selection?:EncounterSelection|null;sheet?:boolean;overlayOpen?:boolean;onClose?:()=>void;onEncounter?:(id:string|null,anchor?:Anchor,talking?:boolean)=>void;onPlan?:()=>void }
class ResidentBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<p className="notice" role="status">Встречи временно недоступны. Можно продолжать планирование.</p>:this.props.children;}
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
  return <>{!sheet&&<svg ref={tether} className="conversation-tether" aria-hidden="true"><line/><circle r="3"/></svg>}<section ref={surface} id="residents" data-occludes-city={sheet||undefined} className={`residents paper-sheet ${sheet?'context-encounter':''} ${selectedId?'conversation-open':'conversation-invitation'}`} aria-label={mode.id==='khanate'?'Жители города у Есиля':'Жители Астаны'} data-testid="resident-layer" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
    {!talking?<div className="resident-orientation"><Portrait resident={selected}/><div><strong>{selected.name}</strong><small>{districtName(anchor.districtId)} · {anchor.label}</small></div><button className="primary" onClick={()=>onEncounter?.(selected.id,anchor,true)}>Поговорить</button><button aria-label="Закрыть место встречи" onClick={close}><ControlIcon kind="close"/></button></div>:
    <div className="resident-encounter" role="region" aria-labelledby="conversation-name" data-resident-id={selected.id} data-observation={observation.phase}>
      <header className="conversation-heading"><Portrait resident={selected}/><div><h3 id="conversation-name" ref={heading} tabIndex={-1}>{selected.name}</h3><p>{selected.role}</p><span>{districtName(anchor.districtId)} · {anchor.label}</span></div><button className="conversation-x" onClick={close} aria-label="Вернуться из разговора"><ControlIcon kind="close"/></button></header>
      <p className="conversation-context">{future?'Через два года · результат вашего плана':proposed?'Обсуждаем предложение':included?'Решение принято · полный итог после пяти проектов':'Сейчас · жизнь района'}</p>
      <div className="resident-speech" aria-live="polite">
        {selection?.story&&question==='remaining'?<p className="resident-russian">{SHORT_LIMITS[selection.story.initiativeId]}</p>:selection?.story&&!future&&question===null?<p className="resident-russian">{shortOpening(selection.story)}</p>:question==='moment'?<p className="resident-russian">{moment.response}</p>:question==='project'&&!future?<><p className="resident-russian">{mode.narrative?mode.projects[selected.primary].benefit:projectPossibility[selected.primary]}</p><p className="conversation-model"><b>Ая · о модели.</b> {LIMITS[selected.primary]} {included?'Это решение уже в плане.':proposed?'Вы рассматриваете этот проект.':'Этого решения для места пока нет в плане.'}</p></>:<Speech line={line}/>}
      </div>
      <div className="resident-questions" aria-label="Ответить жителю">
        <button onClick={()=>setQuestion(question==='situation'?'project':'situation')}>{question==='situation'?'Что изменит этот проект?':future?'Что здесь изменилось?':'Что здесь происходит?'}</button>
        {question===null&&!future&&!selection?.story?<button onClick={()=>setQuestion('moment')}>{moment.invitation}</button>:<button onClick={()=>setQuestion('remaining')}>Что останется нерешённым?</button>}
      </div>
      <div className="conversation-place"><button onClick={showPlace}>Показать место на карте</button><button onClick={close}>Вернуться <ControlIcon kind="arrow-back" size={18}/></button></div>
      <details className="resident-evidence" data-result-id={observation.evidence.resultId??''}><summary>{future?'На чём основан ответ?':`${item.name} · ${item.cost} ${terms.unit}`}</summary>
        {selection?.story&&<p>{selection.story.opening}</p>}
        <p>{item.scope==='citywide'?'Весь город':districtName(anchor.districtId)} · задержка {item.lag} {terms.seasons}</p>
        {observation.evidence.calculated?<ul>{observation.evidence.indicators.map(i=><li key={i.id}>{indicatorNames[i.id]}: {format(i.before)} → {format(i.after)} ({signed(i.delta)}){i.critical?' · ниже 40':''}</li>)}</ul>:<p>Разговор и просмотр проекта не тратят бюджет. После принятия решение появляется на карте; полный эффект за восемь {terms.seasons} рассчитывается после пятого проекта.</p>}
        <p>{observation.evidence.limitation}</p><p className="small">Персонаж вымышленный. {mode.id==='astana'?'Казахский текст доступен с русским переводом.':'Обстоятельства придуманы для города у Есиля.'}</p>
      </details>
      <footer className="encounter-primary-action"><button className="primary paper-button" onClick={future?backToPlan:inspect}>{future?'Вернуться к плану':included?'Открыть решение':'Рассмотреть проект'}</button></footer>
    </div>}
  </section></>;
}
