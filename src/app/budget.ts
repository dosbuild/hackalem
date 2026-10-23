import { applyEdit, summarizePlan } from '../domain/plan';
import { CATALOGUE, INITIATIVES } from '../domain/scenario';
import { AREA_IDS } from '../domain/types';
import type { InitiativeId, PolicyArea } from '../domain/types';
import type { AppState } from './state';

export type Allocations = Record<PolicyArea, number>;
export const emptyAllocations = (): Allocations => ({ transport:0, environment:0, social:0, safety:0, municipal:0 });
export type BudgetState = Readonly<{
  allocations: Allocations;
  active: PolicyArea | null;
  movement: { serial:number; area:PolicyArea; requested:number; received:number; returned:number; fromFree:number; taken:Allocations; resisted:boolean } | null;
}>;
export const emptyBudget = ():BudgetState => ({ allocations:emptyAllocations(), active:null, movement:null });
export const projectsIn = (area:PolicyArea) => CATALOGUE.filter(i=>i.area===area).sort((a,b)=>a.cost-b.cost);
export const channelMax = (area:PolicyArea) => Math.max(...projectsIn(area).map(i=>i.cost))+10;

/** Fluid money is only a presentation of the remaining budget. It is never a decision. */
export function moveMoney(budget:BudgetState, area:PolicyArea, requested:number, remaining:number):BudgetState {
  if (!Number.isFinite(requested)) return budget;
  const allocations={...budget.allocations},taken=emptyAllocations();
  const wanted=Math.max(0,Math.round(requested)), received=Math.min(wanted,remaining);
  const free=remaining-Object.values(allocations).reduce((a,b)=>a+b,0);
  let deficit=Math.max(0,received-allocations[area]-free);
  // Drain the fullest unlocked channel first. Deterministic ties follow the visible order.
  for (const other of AREA_IDS.filter(a=>a!==area).sort((a,b)=>allocations[b]-allocations[a])) {
    taken[other]=Math.min(allocations[other],deficit);
    allocations[other]-=taken[other];deficit-=taken[other];
  }
  const fromFree=Math.min(free,Math.max(0,received-allocations[area]));
  const returned=Math.max(0,allocations[area]-received);
  allocations[area]=received;
  return {allocations,active:area,movement:{serial:(budget.movement?.serial??0)+1,area,requested:wanted,received,returned,fromFree,taken,resisted:wanted>remaining}};
}

/** Derived semantics shared by the controls, the city and Aya. Costs live in scenario.ts. */
export function budgetStatus(state:AppState) {
  const plan=state.alternative?.plan??state.plan, summary=summarizePlan(plan);
  const fluid=Object.values(state.budget.allocations).reduce((a,b)=>a+b,0);
  const c=state.candidate, item=c?INITIATIVES[c.decision.initiativeId]:null;
  const original=c?.replaces?plan.find(d=>d.initiativeId===c.replaces):null;
  const credit=original?INITIATIVES[original.initiativeId].cost:0;
  const allocated=item?state.budget.allocations[item.area]:0;
  const edit=c?applyEdit(plan,c.replaces?{kind:'replace',target:c.replaces,decision:c.decision}:{kind:'add',decision:c.decision}):null;
  const issues=edit&&!edit.accepted?edit.issues:[];
  return {locked:summary.spent,fluid,free:summary.remaining-fluid,remaining:summary.remaining,
    credit,allocated,covered:allocated+credit,cost:item?.cost??0,
    progress:item?Math.min(1,(allocated+credit)/item.cost):0,
    funded:!!item&&allocated+credit>=item.cost,issues,
    blocked:issues.length>0,ready:!!item&&allocated+credit>=item.cost&&!issues.length,
    movement:state.budget.movement};
}

export function notchAt(area:PolicyArea,value:number):InitiativeId {
  const items=projectsIn(area);
  return items.find(i=>value<=i.cost)?.id??items[items.length-1]!.id;
}
