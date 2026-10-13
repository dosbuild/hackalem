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
  <SheetHeader id="treasury-title" title={mode.id==='khanate'?'Казна и указы':'Бюджет и план'} label="100 · ПЯТЬ РЕШЕНИЙ" onClose={onClose}/>
  <div className="treasury-balance"><span>Доступно для проектов</span><strong>{summary.remaining}<small> / 100 {terms.unit}</small></strong></div>
  <div className="treasury-ledger" aria-label="Баланс бюджета"><div><span>Свободно</span><b>{budget.free}</b></div><div><span>Подготовлено к выбору</span><b>{budget.fluid}</b></div><div><span>Уже профинансировано</span><b>{budget.locked}</b></div></div>
  <p className="treasury-note">Цена каждого проекта фиксирована. Подготовленные средства остаются в бюджете до подтверждения.</p>
  <div className="section-heading"><h3>{mode.id==='khanate'?'Принятые указы':'Финансируемый план'}</h3><span>{summary.count} / 5</span></div>
  {state.plan.length?<ol className="treasury-plan">{state.plan.map(d=><li key={d.initiativeId}><button onClick={()=>onInspect(d.initiativeId)}><ProjectGlyph id={d.initiativeId}/><span><strong>{PROJECT_NAMES[d.initiativeId]}</strong><small>{scopeName(d)}</small></span><b>{INITIATIVES[d.initiativeId].cost}<small>{unitFor(INITIATIVES[d.initiativeId].cost)}</small></b><ControlIcon kind="arrow-right" size={18}/></button></li>)}</ol>:<p className="empty-plan">Пока весь бюджет свободен. Выберите первый проект и посмотрите, как он изменит место.</p>}
  <details className="secondary-details"><summary>Правила плана<ControlIcon kind="chevron-down" size={18}/></summary><p>Пять разных проектов, максимум два из одной сферы. Бюджет и несовместимые решения проверяются перед подтверждением.</p><div className="plan-area-counts">{Object.entries(summary.areaCounts).map(([area,count])=><span key={area}>{areaNames[area as keyof typeof areaNames]} · {count}/2</span>)}</div></details>
  <footer className="sheet-primary-action"><button className="primary paper-button" onClick={onProjects}><ControlIcon kind="build"/>{state.plan.length===5?'Открыть проекты':'Выбрать проект'}</button></footer>
  <details className="secondary-details plan-tools"><summary>Новая попытка и восстановление<ControlIcon kind="chevron-down" size={18}/></summary>{onRestore&&<button onClick={onRestore}>Вернуть предыдущий план</button>}{state.plan.length>0&&<button onClick={onRestart}>Начать заново</button>}</details>
 </aside>;
}
