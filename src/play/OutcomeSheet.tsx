import type {ScenarioResult} from '../domain/types';
import type {LivingStory} from '../living/appeals';
import {useContent} from '../modes/content';
import {resultImpact,leadingProject} from '../dashboard/impact';
import {ResidentPortrait} from '../ui/ResidentPortrait';
import {format,signed} from '../ui/copy';
import {ControlIcon} from '../ui/ControlIcon';
import {useEffect,useRef} from 'react';

export function OutcomeSheet({result,onMeet,onPlace,onAlternative,onBook,onClose,focusHeading=true}:{onClose?:()=>void;result:ScenarioResult;onMeet:(story:LivingStory)=>void;onPlace:(story:LivingStory)=>void;onAlternative:()=>void;onBook:()=>void;focusHeading?:boolean}){
 const {mode,STORIES,PROJECT_STORIES,PROJECT_NAMES,districtName,indicatorNames}=useContent();
 const heading=useRef<HTMLHeadingElement>(null),focusOnMount=useRef(focusHeading);
 useEffect(()=>{if(focusOnMount.current)heading.current?.focus({preventScroll:true});},[]);
 const {highlight,remaining,decreased}=resultImpact(result),contributor=highlight?leadingProject(highlight):null;
 const helped=highlight&&contributor?STORIES.find(s=>s.districtId===highlight.districtId&&s.initiativeId===contributor):null;
 const waiting=STORIES.find(s=>s.districtId===remaining.districtId&&PROJECT_STORIES[s.initiativeId].indicator===remaining.indicatorId);
 return <section className="consequence-card result-summary-card outcome-sheet paper-sheet" data-occludes-city aria-labelledby="outcome-title" data-testid="outcome-sheet">
  <header className="outcome-heading">
   {onClose&&<button className="sheet-dismiss icon-control" aria-label="Вернуться в город" onClick={onClose}><ControlIcon kind="close"/></button>}
   <span className="eyebrow paper-label">ПЯТЬ {mode.id==='khanate'?'УКАЗОВ':'РЕШЕНИЙ'} · ДВА ГОДА СПУСТЯ</span>
   <h2 className="paper-title" id="outcome-title" ref={heading} tabIndex={-1}>{mode.id==='khanate'?'Летопись двух лет':'Ваш город изменился'}</h2>
  </header>
  <div className="outcome-body">
  <div className="result-score"><strong>{format(result.finalScore)}</strong><span>индекс жизни<br/><b>{signed(result.scoreChange)}</b> к началу</span></div>
  {highlight&&helped&&<article className="outcome-person paper-card" data-contributor={contributor} data-story-id={helped.id}>
   <span className="paper-label">СТАЛО ЛУЧШЕ</span><header><ResidentPortrait visual={helped.visual}/><div><h3>{helped.name}</h3><small>{districtName(helped.districtId)} · {PROJECT_NAMES[helped.initiativeId]}</small></div></header>
   <p>{indicatorNames[highlight.indicatorId]}: <strong>{format(highlight.baseline)} → {format(highlight.updated)}</strong></p>
   <div className="outcome-actions"><button className="paper-button" data-context-action="meet" onClick={()=>onMeet(helped)}>Встретиться <ControlIcon kind="arrow-right" size={18}/></button><button onClick={()=>onPlace(helped)}>Показать место <ControlIcon kind="place" size={18}/></button></div>
  </article>}
  {waiting&&<article className="outcome-person paper-card" data-story-id={waiting.id}>
   <span className="paper-label">ЕЩЁ НУЖНА ПОМОЩЬ</span><header><ResidentPortrait visual={waiting.visual}/><div><h3>{waiting.name}</h3><small>{districtName(waiting.districtId)}</small></div></header>
   <p>{indicatorNames[remaining.indicatorId]} — <strong>{format(remaining.updated)}/100</strong>. Это самая слабая точка города.</p>
   <div className="outcome-actions"><button data-context-action="meet" onClick={()=>onMeet(waiting)}>Выслушать <ControlIcon kind="arrow-right" size={18}/></button><button onClick={()=>onPlace(waiting)}>Показать место <ControlIcon kind="place" size={18}/></button></div>
  </article>}
  {decreased.length>0&&<p className="outcome-tradeoff">Есть компромисс: {districtName(decreased[0]!.districtId)} · {indicatorNames[decreased[0]!.indicatorId]} {format(decreased[0]!.baseline)} → {format(decreased[0]!.updated)}. Все последствия — в разборе.</p>}
  <button className="text-button" onClick={onBook}>Подробные итоги <ControlIcon kind="book" size={18}/></button>
  </div>
  <footer className="outcome-primary-action"><button className="primary paper-button" onClick={onAlternative}>Сравнить одну замену <ControlIcon kind="arrow-right" size={18}/></button></footer>
 </section>;
}
