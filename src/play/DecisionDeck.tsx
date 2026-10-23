import {useContent} from '../modes/content';
import {useMemo,useState} from 'react';
import type {Dispatch} from 'react';
import type {Action,AppState} from '../app/state';
import {ResidentPortrait} from '../ui/ResidentPortrait';
import {ControlIcon} from '../ui/ControlIcon';
import {SheetHeader} from '../ui/SheetHeader';
import {ProjectGlyph} from '../features/Gameplay';
import {availableChoices,choicePage,projectCount} from './choices';
import type {Choice} from './choices';

export function DecisionDeck({state,onChoose,onCatalogue,onClose}:{onClose?:()=>void;state:AppState;onChoose:(choice:Choice)=>void;onCatalogue:()=>void}){
 const {mode,INITIATIVES,STORIES,PROJECT_NAMES,SHORT_NEEDS,districtName,unitFor}=useContent();
 const [page,setPage]=useState(0);
 const pool=useMemo(()=>availableChoices(state.plan,state.focusedDistrict,STORIES,mode.id==='khanate'?['M7','M1','M5']:[]),[state.plan,state.focusedDistrict]);
 const choices=choicePage(pool,page);
 return <section className="decision-deck paper-sheet" data-occludes-city aria-labelledby="decision-question" data-testid="decision-deck">
  {onClose?<SheetHeader id="decision-question" title={`Who shall we help${state.plan.length?' next':''}?`} label={state.plan.length===0?'YOUR CITY STARTS HERE':`CHOICE ${state.plan.length+1} OF 5`} onClose={onClose}/>:<header><h2 className="paper-title" id="decision-question" tabIndex={-1}>Who shall we help next?</h2></header>}
  {state.plan.length===0&&<p className="deck-intro">{mode.id==='khanate'?'100 coins · 5 decrees · 2 years':'100 units · 5 decisions · 2 years'}</p>}
  <div className="choice-cards">{choices.map(({story,initiativeId,districtId})=><button key={`${initiativeId}:${districtId}`} className="need-card paper-card" data-choice={initiativeId} onClick={()=>onChoose({story,initiativeId,districtId})}>
   <span className="need-person"><ResidentPortrait visual={story.visual}/><span><strong>{story.name}</strong><small>{districtName(districtId)}</small></span><span className="coin-price">{INITIATIVES[initiativeId].cost}<small>{unitFor(INITIATIVES[initiativeId].cost)}</small></span></span>
   <span className="need-quote">“{SHORT_NEEDS[initiativeId]}”</span>
   <span className="need-project"><ProjectGlyph id={initiativeId}/><span>{PROJECT_NAMES[initiativeId]}</span><ControlIcon kind="arrow-right" size={18}/></span>
  </button>)}</div>
  <footer><button className="text-button" onClick={onCatalogue}>All {projectCount} projects <ControlIcon kind="arrow-right" size={18}/></button>{pool.length>3&&<button className="text-button" onClick={()=>setPage(p=>p+1)}>Other stories <ControlIcon kind="replay" size={18}/></button>}{!pool.length&&<button onClick={onCatalogue}>Edit plan</button>}</footer>
 </section>;
}

export function PlanRibbon({state,dispatch,onNext}:{state:AppState;dispatch:Dispatch<Action>;onNext:()=>void}){
 const {INITIATIVES,PROJECT_NAMES,scopeName,terms}=useContent();
 return <ol className="plan-ribbon" aria-label="Five decisions" data-occludes-city>{Array.from({length:5},(_,i)=>{const d=state.plan[i];return <li key={i} className={d?'filled':i===state.plan.length?'next':'empty'}>{d?<button aria-label={`Edit: ${INITIATIVES[d.initiativeId].name}`} title={`${PROJECT_NAMES[d.initiativeId]} · ${scopeName(d)}`} onClick={()=>dispatch({type:'selectCommitment',initiativeId:d.initiativeId})}><ProjectGlyph id={d.initiativeId}/><span>{PROJECT_NAMES[d.initiativeId]}</span><small>{scopeName(d)}</small><b>{INITIATIVES[d.initiativeId].cost}</b></button>:<button aria-label={`Choose decision ${i+1}`} disabled={i!==state.plan.length} onClick={onNext}><span className="ribbon-number">{i+1}</span><span>{i===state.plan.length?'Your next step':terms.decision}</span></button>}</li>})}</ol>;
}
