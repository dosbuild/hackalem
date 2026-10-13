import {ControlIcon} from '../ui/ControlIcon';
import {useContent} from '../modes/content';
import {KhanateGlyph} from '../modes/Artifacts';
import { useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import type { Action, AppState } from '../app/state';
import { INDICATOR_IDS } from '../domain/types';
import type { DistrictId, InitiativeId } from '../domain/types';
import type { Anchor } from '../residents/types';
import { momentFor, momentKey } from '../residents/moments';
import type { RememberedMoment } from '../residents/moments';
import { format, signed } from '../ui/copy';
import './gameplay.css';

/** Editable, code-native paper glyphs. Networks and services never masquerade as buildings. */
export function ProjectGlyph({id}:{id:InitiativeId}) {
  const {mode}=useContent();
  const shapes:Record<InitiativeId,string>={
    M1:'M5 30h30M5 18h30M14 9v29m12-29v29',M2:'M18 6h12v25H18zM24 31v10M22 12h4m-4 6h4m-4 6h4',
    M3:'M8 34h32M11 10h25v20H11zM16 15h15M15 34v6m16-6v6',M4:'M10 28V17h5V9h10v8h5v11H10M20 28v12M29 34h14m-12 0v7m10-7v7',
    M5:'M10 34c-7-9 6-12 7-22 9 8 13 10 11 20M34 12h9m-9 8h9m-9 8h9',M6:'M6 29h10V14h8v15h9V9h8v27M6 40h35',
    M7:'M7 22l17-14 17 14M11 20v21h26V20M21 41V29h7v12M16 25h3m11 0h3',M8:'M8 15h32v26H8zM20 8h8M24 22v12m-6-6h12',
    M9:'M10 25a14 14 0 1 0 28 0a14 14 0 1 0-28 0M11 19l26 12M19 12l12 26',M10:'M16 42V9h18v7M28 16h12M29 22l-4 8m12-8 4 8',
    M11:'M7 10v30m34-30v30M13 17h23m-23 7h23m-23 7h23',M12:'M12 7h25v35H12zM17 16h15m-15 7h15m-15 7h7m4 1 3 3 7-8',
    M13:'M6 13h23v15h13M6 22h14v15h22M11 8v19m24-3v19',M14:'M11 14h9l4-7 4 7h9l-6 6 2 10-9-4-9 4 2-10zM9 39h30',
  };
  if(mode.id==='khanate')return <KhanateGlyph id={id}/>;
  return <svg className="project-glyph" viewBox="0 0 48 48" aria-hidden="true"><path d={shapes[id]} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="miter"/></svg>;
}

export function MomentNotebook({moments,visit,remove}:{moments:readonly RememberedMoment[];visit:(id:string,anchor?:Anchor)=>void;remove:(moment:RememberedMoment)=>void}) {
  const {RESIDENT_BY_ID}=useContent();
  if (!moments.length) return null;
  return <nav className="moment-notebook" aria-label="Места в блокноте Аи"><span className="notebook-label">АЯ · МЕСТА, КУДА ВЕРНЁМСЯ</span>
    <div>{moments.map(m=>{const resident=RESIDENT_BY_ID[m.residentId]!;return <div className="notebook-tab" key={momentKey(m)}>
      <button onClick={()=>visit(m.residentId,m.anchor)}><strong>{resident.name}</strong><small>{momentFor(resident).title}</small></button>
      <button className="forget-moment icon-control" aria-label={`Снять отметку: ${resident.name}`} onClick={()=>remove(m)}><ControlIcon kind="close" size={18}/></button>
    </div>;})}</div>
  </nav>;
}

export function ProjectShelf({state,dispatch}:{state:AppState;dispatch:Dispatch<Action>}) {
  const {INITIATIVES,districtName}=useContent();
  if (!state.plan.length || state.alternative) return null;
  return <div className="project-shelf" aria-label="Решения в городе">{state.plan.map(d=><button key={d.initiativeId}
    className={state.candidate?.replaces===d.initiativeId?'is-lifted':''} aria-label={`Поднять: ${INITIATIVES[d.initiativeId].name}`}
    onClick={()=>dispatch({type:'selectCommitment',initiativeId:d.initiativeId})}><ProjectGlyph id={d.initiativeId}/><span>{d.initiativeId}</span><small>{d.scope==='citywide'?'Пять районов':districtName(d.districtId)}</small></button>)}</div>;
}

export function AlternativeInvitation({state,dispatch}:{state:AppState;dispatch:Dispatch<Action>}) {
  const {INITIATIVES,districtName}=useContent();
  if (!state.result || state.alternative) return null;
  return <details className="alternative-invitation"><summary>А если изменить одно решение?</summary>
    <p>Ваш план уже состоялся. Можно примерить другую возможность и вернуться к нему одним движением.</p>
    <div>{state.plan.map(d=><button key={d.initiativeId} onClick={()=>dispatch({type:'beginAlternative',initiativeId:d.initiativeId})}>
      <ProjectGlyph id={d.initiativeId}/><span>{INITIATIVES[d.initiativeId].name}<small>{d.scope==='citywide'?'Весь город':districtName(d.districtId)} · Примерить другой вариант</small></span>
    </button>)}</div>
  </details>;
}

export function AlternativeWorkbench({state,dispatch}:{state:AppState;dispatch:Dispatch<Action>}) {
  const {INITIATIVES,districtName,terms}=useContent();
  const a=state.alternative;if(!a)return null;
  const original=state.plan[a.slot]!;
  return <section className="alternative-workbench paper-card" aria-label="Работа над вариантом">
    <p className="eyebrow">ОДНО РЕШЕНИЕ · ДВЕ ВОЗМОЖНОСТИ</p><h2>Мой план сохранён</h2>
    <div className="saved-choice"><ProjectGlyph id={original.initiativeId}/><div><strong>{INITIATIVES[original.initiativeId].name}</strong><small>{original.scope==='citywide'?'Весь город':districtName(original.districtId)} · {INITIATIVES[original.initiativeId].cost} {terms.unit}</small></div></div>
    <p>Меняем только это решение. Выберите другой проект или район. Остальные четыре остаются на месте.</p>
    <details><summary>Четыре сохранённых решения</summary><ul>{state.plan.filter((_,i)=>i!==a.slot).map(d=><li key={d.initiativeId}>{INITIATIVES[d.initiativeId].name} · {d.scope==='citywide'?'Весь город':districtName(d.districtId)}</li>)}</ul></details>
    <button onClick={()=>dispatch({type:'discardAlternative'})}>Оставить мой план</button>
  </section>;
}

export function FutureSwitch({state,dispatch}:{state:AppState;dispatch:Dispatch<Action>}) {
  const {terms}=useContent();
  const a=state.alternative, held=useRef(false);
  const release=()=>{if(held.current){held.current=false;dispatch({type:'showAlternative',show:false});}};
  useEffect(()=>{
    const lose=()=>{held.current=false;dispatch({type:'showAlternative',show:false});};
    window.addEventListener('blur',lose);
    const hidden=()=>{if(document.hidden)lose();};document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('blur',lose);document.removeEventListener('visibilitychange',hidden);};
  },[dispatch]);
  if(!a?.result||!state.result)return null;
  const active=a.showing==='alternative'?a.result:state.result.value;
  return <div className="future-switcher paper-card" data-testid="future-switcher" onPointerDown={e=>e.stopPropagation()}>
    <div className="switcher-caption"><strong>{a.showing==='alternative'?'Вариант':'Мой план'}</strong><span>{format(active.finalScore)} · {active.summary.spent} {terms.unit}</span></div>
    <button className="hold-future" aria-pressed={a.showing==='alternative'}
      onPointerDown={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);held.current=true;dispatch({type:'showAlternative',show:true});}}
      onPointerUp={e=>{e.stopPropagation();release();}} onPointerCancel={release} onLostPointerCapture={release} onBlur={release}
      onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();held.current=true;dispatch({type:'showAlternative',show:true});}if(e.key==='Escape'&&held.current){e.preventDefault();e.stopPropagation();release();}}}
      onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();release();}}}>
      <span aria-hidden="true">◒</span> Удерживайте, чтобы увидеть вариант
    </button>
    <div className="future-toggle" role="group" aria-label="Выбрать будущее">
      <button aria-pressed={a.showing==='mine'} onClick={()=>dispatch({type:'showAlternative',show:false})}>Мой план</button>
      <button aria-pressed={a.showing==='alternative'} onClick={()=>dispatch({type:'showAlternative',show:true})}>Вариант</button>
    </div>
  </div>;
}

export function FutureComparison({state,dispatch,district,onAffected}:{state:AppState;dispatch:Dispatch<Action>;district:DistrictId;onAffected:(district:DistrictId,initiative:InitiativeId)=>void}) {
  const {districtName,indicatorNames,terms,PROJECT_NAMES,scopeName}=useContent();
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>heading.current?.focus({preventScroll:true}),[]);
  const a=state.alternative;
  if(!a?.result||!state.result)return null;
  const original=state.result.value, alternative=a.result, before=state.plan[a.slot]!, other=a.plan[a.slot]!, active=a.showing==='alternative'?alternative:original;
  const differences=INDICATOR_IDS.filter(k=>original.indicators[district][k]!==alternative.indicators[district][k]);
  const affected=other.scope==='district'?other.districtId:district;
  return <section className={`future-comparison paper-sheet ${a.showing==='alternative'?'showing-alternative':''}`} aria-label="Два будущих одного места" data-testid="future-comparison" data-result-id={active.resultId}>
    <div className="future-heading"><div><p className="eyebrow">ТО ЖЕ МЕСТО · ЧЕРЕЗ ДВА ГОДА</p><h2 ref={heading} tabIndex={-1}>{a.showing==='alternative'?'Вариант':'Мой план'}</h2></div><div className="future-score"><strong data-testid="displayed-future-score">{format(active.finalScore)}</strong><small>{active.summary.spent} из 100 {terms.unit}</small></div></div>
    <p className="small" data-testid="future-change">Одна замена: <strong>{PROJECT_NAMES[before.initiativeId]}</strong> · {scopeName(before)} → <strong>{PROJECT_NAMES[other.initiativeId]}</strong> · {scopeName(other)}.</p>
    <FutureSwitch state={state} dispatch={dispatch}/>
    <div className="local-future-difference"><strong>{districtName(district)} · что различается</strong>
      {differences.length?<ul>{differences.map(k=><li key={k}><span>{indicatorNames[k]}</span><b>{format(original.indicators[district][k])} <span aria-hidden="true">↔</span> {format(alternative.indicators[district][k])}</b></li>)}</ul>
        :<p>В этом месте районные показатели совпадают. Привычная жизнь продолжается в обоих вариантах.</p>}
      {(!differences.length||affected!==district)&&<button onClick={()=>onAffected(affected,other.initiativeId)}>Посмотреть затронутое место · {districtName(affected)}</button>}
    </div>
    <p className="small">Расход {original.summary.spent} → {alternative.summary.spent} ({signed(alternative.summary.spent-original.summary.spent)}). Свет, место и люди те же. Пока вы только примеряете.</p>
    <div className="future-decisions"><button onClick={()=>dispatch({type:'discardAlternative'})}>Оставить мой план</button><button className="primary" onClick={()=>dispatch({type:'adoptAlternative'})}>Принять вариант</button><button className="text-button" onClick={()=>dispatch({type:'editAlternative'})}>Изменить вариант</button></div>
  </section>;
}
