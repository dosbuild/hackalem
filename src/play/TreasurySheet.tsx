import type {AppState} from '../app/state';
import type {InitiativeId} from '../domain/types';
import {budgetStatus} from '../app/budget';
import {summarizePlan} from '../domain/plan';
import {useContent} from '../modes/content';
import {ControlIcon} from '../ui/ControlIcon';
import {SheetHeader} from '../ui/SheetHeader';
import {ProjectGlyph} from '../features/Gameplay';

export function TreasurySheet({state,onClose,onProjects,onInspect,onRestart,onRestore}:{state:AppState;onClose:()=>void;onProjects:()=>void;onInspect:(id:InitiativeId)=>void;onRestart:()=>void;onRestore?:()=>void}){
 const {mode,INITIATIVES,PROJECT_NAMES,scopeName,terms,unitFor,areaNames}=useContent(),summary=summarizePlan(state.plan),budget=budgetStatus(state);
 return <aside className="treasury-sheet context-panel paper-sheet" data-occludes-city aria-labelledby="treasury-title" data-testid="treasury-sheet">
  <SheetHeader id="treasury-title" title={mode.id==='khanate'?'Treasury and decrees':'Budget and plan'} label="100 · FIVE DECISIONS" onClose={onClose}/>
  <div className="treasury-balance"><span>Available for projects</span><strong>{summary.remaining}<small> / 100 {terms.unit}</small></strong></div>
  <div className="treasury-ledger" aria-label="Budget balance"><div><span>Available</span><b>{budget.free}</b></div><div><span>Prepared for selection</span><b>{budget.fluid}</b></div><div><span>Already funded</span><b>{budget.locked}</b></div></div>
  <p className="treasury-note">Each project has a fixed price. Prepared funds stay in the budget until confirmation.</p>
  <div className="section-heading"><h3>{mode.id==='khanate'?'Accepted decrees':'Funded plan'}</h3><span>{summary.count} / 5</span></div>
  {state.plan.length?<ol className="treasury-plan">{state.plan.map(d=><li key={d.initiativeId}><button onClick={()=>onInspect(d.initiativeId)}><ProjectGlyph id={d.initiativeId}/><span><strong>{PROJECT_NAMES[d.initiativeId]}</strong><small>{scopeName(d)}</small></span><b>{INITIATIVES[d.initiativeId].cost}<small>{unitFor(INITIATIVES[d.initiativeId].cost)}</small></b><ControlIcon kind="arrow-right" size={18}/></button></li>)}</ol>:<p className="empty-plan">Your entire budget is available. Choose a first project and see how it changes the site.</p>}
  <details className="secondary-details"><summary>Plan rules<ControlIcon kind="chevron-down" size={18}/></summary><p>Five distinct projects, at most two from one policy area. Budget and conflicts are checked before confirmation.</p><div className="plan-area-counts">{Object.entries(summary.areaCounts).map(([area,count])=><span key={area}>{areaNames[area as keyof typeof areaNames]} · {count}/2</span>)}</div></details>
  <footer className="sheet-primary-action"><button className="primary paper-button" onClick={onProjects}><ControlIcon kind="build"/>{state.plan.length===5?'Open projects':'Choose a project'}</button></footer>
  <details className="secondary-details plan-tools"><summary>New attempt and recovery<ControlIcon kind="chevron-down" size={18}/></summary>{onRestore&&<button onClick={onRestore}>Restore previous plan</button>}{state.plan.length>0&&<button onClick={onRestart}>Start again</button>}</details>
 </aside>;
}
