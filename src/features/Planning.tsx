import {KhanSeal} from '../modes/Artifacts';
import {useContent} from '../modes/content';
import {useEffect,useLayoutEffect, useRef} from 'react';
import type { Dispatch } from 'react';
import type { Action, AppState } from '../app/state';
import { budgetStatus } from '../app/budget';
import { editingPlan } from '../app/state';
import { ProjectGlyph } from './Gameplay';
import { applyEdit, summarizePlan } from '../domain/plan';
import { hasCompletion } from '../domain/planning-search';
import {projectConnections} from './project-insight';
import { realizedEffect } from '../domain/evaluate';
import { BASELINE, RULES } from '../domain/scenario';
import { INDICATOR_IDS } from '../domain/types';
import type { DistrictId } from '../domain/types';
import {ResidentPortrait} from '../ui/ResidentPortrait';
import { signed } from '../ui/copy';
import {ControlIcon} from '../ui/ControlIcon';


type Props = { state:AppState; dispatch:Dispatch<Action>; onRelation?:()=>void;onPlace?:()=>void;onCatalogue?:()=>void;onBack?:()=>void };

export function Candidate({ state,dispatch,onRelation,onPlace,onCatalogue,onBack,focusRequest=0 }:Props & {focusRequest?:number}) {
  const {mode,INITIATIVES,DISTRICTS,STORIES,PROJECT_NAMES,SHORT_NEEDS,SHORT_LIMITS,PROJECT_STORIES,projectActions,LIMITS,districtName,indicatorNames,issueMessage,text,terms,unitFor}=useContent();
  const candidate = state.candidate;
  const titleRef=useRef<HTMLHeadingElement>(null);
  useLayoutEffect(()=>{
    if(!candidate||focusRequest===0)return;
    const title=titleRef.current,drawer=title?.closest<HTMLElement>('.planning-drawer');
    // A catalogue choice may be far below its newly inserted proposal.
    // Move both sight and keyboard focus to the actual decision, once per choice.
    if(drawer)drawer.scrollTop=0;
  },[candidate?.decision.initiativeId,candidate?.replaces,focusRequest]);
  // Passive focus runs after closing a help dialog has restored its old opener.
  useEffect(()=>{if(candidate&&focusRequest>0)titleRef.current?.focus({preventScroll:true});},[candidate?.decision.initiativeId,candidate?.replaces,focusRequest]);
  if (!candidate) return null;
  const item = INITIATIVES[candidate.decision.initiativeId];
  const story=PROJECT_STORIES[item.id],district=candidate.decision.scope==='district'?candidate.decision.districtId:null;
  const connections=projectConnections(item.id,editingPlan(state),district,candidate.replaces);
  const funds=budgetStatus(state);
  const recovery=state.plan.filter(d=>funds.issues.some(issue=>issue.code==='incompatible'
    ? d.initiativeId!==item.id&&(d.initiativeId===issue.initiativeId||d.initiativeId===issue.relatedInitiativeId)
    : issue.code==='area_limit'?INITIATIVES[d.initiativeId].area===item.area:['budget','too_many','duplicate'].includes(issue.code)));

  const originalId=state.alternative?state.plan[state.alternative.slot]!.initiativeId:candidate.replaces;
  const preview = applyEdit(editingPlan(state),candidate.replaces
    ? { kind:'replace', target:candidate.replaces, decision:candidate.decision }
    : { kind:'add', decision:candidate.decision });
  const viable=preview.accepted&&hasCompletion(preview.plan);
  const after=preview.accepted?summarizePlan(preview.plan).remaining:funds.remaining-item.cost+funds.credit;
  const person=STORIES.find(s=>s.initiativeId===item.id&&s.districtId===(district??state.focusedDistrict??'esil'))!;
  return <section className="candidate compact-proposal" aria-labelledby="candidate-title" data-testid="held-project" data-story-id={person.id}>
    <div className="proposal-person"><ResidentPortrait visual={person.visual}/><div><strong>{person.name}</strong><span>{person.role} · {districtName(person.districtId)}</span></div></div>
    <div className="proposal-project-title"><ProjectGlyph id={item.id}/><div><span className="eyebrow">{candidate.replaces?'EDIT DECISION':'YOUR DECISION'}</span><h3 id="candidate-title" className="paper-title" ref={titleRef} tabIndex={-1}>{PROJECT_NAMES[item.id]}</h3></div><b className="proposal-fixed-price paper-price">{item.cost}<small>{unitFor(item.cost)}</small></b></div>
    <p className="project-benefit">{story.benefit}</p>
    <p className="compact-tradeoff"><ControlIcon kind="chevron-down" size={18}/>{SHORT_LIMITS[item.id]}</p>
    <div className="proposal-context-actions"><button data-context-action="meet" disabled={!onRelation||(candidate.decision.scope==='district'&&!district)} onClick={onRelation}>Meet a resident <ControlIcon kind="arrow-right" size={18}/></button><button onClick={onPlace}>Show the site <ControlIcon kind="place" size={18}/></button></div>
    {candidate.decision.scope === 'district' ? <label className="field">{text.district}<select value={candidate.decision.districtId ?? ''} onChange={e=>{if(e.target.value)dispatch({type:'district',districtId:e.target.value as DistrictId});}}><option value="" disabled>{text.chooseDistrict}</option>{DISTRICTS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>:<p className="proposal-citywide">{mode.id==='khanate'?'In all five quarters':'In all five districts'}</p>}
    {originalId&&<p className="replacement-summary">Instead of “{PROJECT_NAMES[originalId]}” · difference {signed(item.cost-INITIATIVES[originalId].cost)} {terms.unit}</p>}
    <details className="proposal-details secondary-details"><summary>Details and exact calculation<ControlIcon kind="chevron-down" size={18}/></summary>
    <p className="proposal-quote">“{SHORT_NEEDS[item.id]}”</p>
    <div className="impact-chips" aria-label="Project contribution over two years">{INDICATOR_IDS.filter(k=>item.effects[k]!==undefined).map(k=><span className={item.effects[k]!<0?'is-negative':''} key={k}><b>{signed(realizedEffect(item.effects[k]!,item.lag))}</b>{indicatorNames[k]}</span>)}</div>
    {connections.synergies.filter(s=>s.active).map(s=><p className="compact-synergy" key={s.partnerId}>Together with “{PROJECT_NAMES[s.partnerId]}”: an additional {signed(s.amount)} to “{indicatorNames[s.indicatorId]}”.</p>)}

      <p>{person.opening}</p>
      <p><strong>{item.name}</strong>. Effects begin in {mode.id==='khanate'?'season':'quarter'} {item.lag+1}; results after {RULES.horizon} {terms.seasons}.</p>
      {district&&<p>{story.need}: baseline {BASELINE[district][story.indicator]}/100.</p>}
      <p>{story.limitation}</p>
      {connections.conflicts.map(c=><p key={c.partnerId}>Conflicts with “{INITIATIVES[c.partnerId].name}” {c.scope==='plan'?'in one plan':mode.id==='khanate'?'in the same quarter':'in the same district'}.</p>)}
      {connections.synergies.filter(s=>!s.active).map(s=><p key={s.partnerId}>With “{INITIATIVES[s.partnerId].name}” an additional {signed(s.amount)} to “{indicatorNames[s.indicatorId]}” at the local project site.</p>)}
      <div className="table-scroll"><table className="effects-table"><thead><tr><th>{text.effect}</th><th>{text.fullEffect}</th><th>{text.realized}</th></tr></thead><tbody>{INDICATOR_IDS.filter(k=>item.effects[k]!==undefined).map(k=><tr key={k}><th scope="row">{indicatorNames[k]}</th><td>{signed(item.effects[k]!)}</td><td>{signed(realizedEffect(item.effects[k]!,item.lag))}</td></tr>)}</tbody></table></div>
      <p className="small">{text.effectNote} Synergies are added separately. The scene illustrates the decision, not actual construction time.</p><p>{LIMITS[item.id]}</p>
    </details>
    {preview.accepted&&!viable&&<p className="validation-preview" role="alert">Not enough for five decisions. Choose a more affordable project.</p>}
    {!preview.accepted&&<ul className="validation-preview">{preview.issues.map((issue,i)=><li key={i}>{issueMessage(issue)}</li>)}</ul>}
    {recovery.length>0&&!state.alternative&&<div className="collision-recovery"><span>Make room by replacing:</span>{recovery.map(d=><button key={d.initiativeId} onClick={()=>dispatch({type:'replaceConflict',initiativeId:d.initiativeId})}>Replace {PROJECT_NAMES[d.initiativeId]}</button>)}</div>}
    <div className="proposal-confirmation"><span>Remaining: <b>{after} {unitFor(after)}</b></span><div className="button-row"><button className="primary paper-button" disabled={!preview.accepted||!viable} onClick={()=>dispatch({type:'confirm'})}>{mode.id==='khanate'&&<KhanSeal/>}{state.alternative?'Calculate alternative':candidate.replaces?text.confirmReplacement:`${projectActions[item.id]} · ${item.cost} ${unitFor(item.cost)}`}</button><button className="proposal-back" onClick={onBack??(()=>dispatch({type:'cancel'}))}>{state.alternative?'Keep my plan':'Back'}</button></div></div>
    <button className="proposal-catalogue-link text-button" onClick={onCatalogue}>{candidate.replaces?'Replace with another project':'All projects'}<ControlIcon kind="arrow-right" size={18}/></button>
    {!state.alternative&&candidate.replaces&&<button className="remove-commitment" aria-label={`${text.remove}: ${INITIATIVES[candidate.replaces].name}`} onClick={()=>dispatch({type:'remove',initiativeId:candidate.replaces!})}>Remove · recover {INITIATIVES[candidate.replaces].cost} {unitFor(INITIATIVES[candidate.replaces].cost)}</button>}
    {!state.alternative&&state.result&&candidate.replaces&&<button className="try-future" onClick={()=>dispatch({type:'beginAlternative',initiativeId:candidate.replaces!})}>Try another option</button>}
  </section>;
}
