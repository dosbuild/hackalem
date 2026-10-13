import {useLayoutEffect,useRef} from 'react';
import type {AppState} from '../app/state';
import type {ContextView} from '../app/presentation';
import type {ProgramLocation} from '../world/contract';
import type {DistrictId,InitiativeId} from '../domain/types';
import {useContent} from '../modes/content';
import {constructionProgress} from '../app/construction';
import {ControlIcon} from '../ui/ControlIcon';
import {SheetHeader} from '../ui/SheetHeader';

export function ProgramInspection({state,view,locations,now,onClose,onNext,onMeet,onEdit,onLocation,onAll}:{state:AppState;view:Extract<ContextView,{kind:'inspection'}>;locations:readonly ProgramLocation[];now:number;onClose:()=>void;onNext:()=>void;onMeet:()=>void;onEdit:(id:InitiativeId)=>void;onLocation:(location:ProgramLocation)=>void;onAll:()=>void}){
 const body=useRef<HTMLDivElement>(null),locationsDisclosure=useRef<HTMLDetailsElement>(null);
 // Site navigation opens a fresh reading position; clock ticks and disclosure
 // interaction keep the user's place in the inspection body.
 useLayoutEffect(()=>{
  const disclosure=locationsDisclosure.current;
  if(disclosure?.open){
   const moveFocus=disclosure.contains(document.activeElement);
   disclosure.open=false;
   if(moveFocus)disclosure.closest('.program-inspection')?.querySelector<HTMLElement>('#inspection-title')?.focus({preventScroll:true});
  }
  if(body.current)body.current.scrollTop=0;
 },[view.initiativeId,view.districtId,view.siteId]);
 const {INITIATIVES,PROJECT_NAMES,PROJECT_STORIES,scopeName,districtName,terms}=useContent(),decision=state.plan.find(d=>d.initiativeId===view.initiativeId);
 if(!decision)return null;
 const receipt=state.construction.find(r=>r.key===`${decision.initiativeId}:${decision.scope==='citywide'?'city':decision.districtId}`&&constructionProgress(r,now)<1);
 const sites=locations.filter(l=>l.initiativeId===view.initiativeId&&(decision.scope==='citywide'||l.districtId===decision.districtId));
 const fallback:readonly ProgramLocation[]=sites.length?sites:(decision.scope==='citywide'?['esil','almaty','saryarka','baikonur','nura'] as const:[decision.districtId]).map((districtId:DistrictId)=>({initiativeId:view.initiativeId,districtId,siteId:`${view.initiativeId}:${districtId}`,label:districtName(districtId),anchorId:`scenario:${view.initiativeId}:${districtId}`}));
 const selected=fallback.find(l=>l.siteId===view.siteId),story=PROJECT_STORIES[view.initiativeId];
 return <section className="consequence-card program-inspection context-panel paper-sheet" data-occludes-city aria-labelledby="inspection-title" data-testid="program-inspection">
  <SheetHeader id="inspection-title" title={PROJECT_NAMES[view.initiativeId]} label={receipt?'ГОРОД МЕНЯЕТСЯ':'ПРОФИНАНСИРОВАННЫЙ ПРОЕКТ'} onClose={onClose}/>
  <div className="inspection-body" ref={body}>
  <div className="inspection-meta"><span><ControlIcon kind="place" size={18}/>{selected?`${districtName(selected.districtId)} · ${selected.label}`:scopeName(decision)}</span><b>{INITIATIVES[view.initiativeId].cost} {terms.unit}</b></div>
  <details ref={locationsDisclosure} key={view.initiativeId} className="program-locations secondary-details"><summary>Места программы · {fallback.length}<ControlIcon kind="chevron-down" size={18}/></summary><button className="all-locations" onClick={onAll}><ControlIcon kind="overview"/>Все места на карте</button><ul>{fallback.map(l=><li key={l.siteId}><button aria-pressed={l.siteId===view.siteId} onClick={()=>onLocation(l)}><ControlIcon kind="place" size={18}/><span><strong>{l.label}</strong>{decision.scope==='citywide'&&<small>{districtName(l.districtId)}</small>}</span><ControlIcon kind="arrow-right" size={18}/></button></li>)}</ul></details>
  <p>{story.benefit}</p>{receipt&&<progress aria-label="Ход строительства" max={1} value={constructionProgress(receipt,now)}/>}
  <details className="secondary-details"><summary>Ограничение проекта<ControlIcon kind="chevron-down" size={18}/></summary><p>{story.limitation}</p></details>
  </div>
  <div className="consequence-actions"><button className="primary paper-button" onClick={onNext}>{state.result?'Посмотреть итог':'Следующее решение'}<ControlIcon kind="arrow-right" size={18}/></button><button data-context-action="meet" onClick={onMeet}><ControlIcon kind="residents" size={18}/>К жителям</button><button onClick={()=>onEdit(view.initiativeId)}>Изменить решение</button></div>
 </section>;
}
