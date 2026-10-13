import { BASELINE, CATALOGUE, DISTRICTS, INCOMPATIBILITIES, RULES, SYNERGIES, WEIGHTS } from './scenario';
import { DISTRICT_IDS, INDICATOR_IDS } from './types';
import type { Decision, InitiativeId, Plan } from './types';

/** Compact representation for exhaustive search only. Public results use evaluatePlan. */
export const SEARCH_OPTIONS: readonly (readonly Decision[])[] = CATALOGUE.map(item => item.scope === 'citywide'
  ? [{ initiativeId:item.id, scope:'citywide' } as Decision]
  : DISTRICT_IDS.map(districtId => ({ initiativeId:item.id, scope:'district', districtId } as Decision)));
const baseline = new Float64Array(DISTRICT_IDS.flatMap(d=>INDICATOR_IDS.map(k=>BASELINE[d][k])));
const weights = INDICATOR_IDS.map(k=>WEIGHTS[k]);
const optionEffects = new Map<Decision, readonly [number,number][]>();
for(const [i,options] of SEARCH_OPTIONS.entries()) for(const option of options) {
  const item = CATALOGUE[i]!;
  optionEffects.set(option,DISTRICT_IDS.flatMap((d,di)=>option.scope==='citywide'||d===option.districtId
    ? INDICATOR_IDS.flatMap((k,ki)=>item.effects[k]===undefined?[]:[[di*10+ki,item.effects[k]!*(RULES.horizon-item.lag)/RULES.horizon] as [number,number]]) : []));
}
const optionFor=(d:Decision)=>SEARCH_OPTIONS[Number(d.initiativeId.slice(1))-1]!.find(o=>o.scope===d.scope&&(o.scope==='citywide'||(d.scope==='district'&&o.districtId===d.districtId)))!;
const synergySpecs=SYNERGIES.map(s=>({a:s.ids[0],b:s.ids[1],ki:INDICATOR_IDS.indexOf(s.indicatorId),amount:s.amount}));

/** Same eight-quarter contributions, clipping and score as canonical evaluate.ts, without evidence allocation. */
export function scoreSearchPlan(plan:Plan):number {
  const matrix = baseline.slice();
  const ordered = [...plan].sort((a,b)=>Number(a.initiativeId.slice(1))-Number(b.initiativeId.slice(1)));
  for(const decision of ordered) for(const [cell,amount] of optionEffects.get(optionFor(decision))!) matrix[cell]!+=amount;
  for(const s of synergySpecs) {
    const local=ordered.find(d=>d.initiativeId===s.a);
    if(local?.scope==='district'&&ordered.some(d=>d.initiativeId===s.b)) matrix[DISTRICT_IDS.indexOf(local.districtId)*10+s.ki]!+=s.amount;
  }
  let city=0,weakest=Infinity,critical=0;
  for(let d=0;d<5;d++) {
    let district=0;
    for(let k=0;k<10;k++) {const value=Math.max(0,Math.min(100,matrix[d*10+k]!));district+=weights[k]!*value;if(value<40)critical++;}
    city+=DISTRICTS[d]!.populationShare*district;weakest=Math.min(weakest,district);
  }
  return .7*city+.3*weakest-critical;
}

/** Measures are selected once in canonical order, then districts are assigned; no permutation duplicates. */
export function visitCompletions(held:Plan, visitor:(plan:Plan,score:()=>number)=>boolean|void):void {
  const fixed=new Map(held.map(d=>[d.initiativeId,d]));
  const chosen:number[]=[],counts=new Map<string,number>();
  const plan:Decision[]=[];
  let stopped=false;
  const conflicts=(id:InitiativeId)=>INCOMPATIBILITIES.some(c=>c.scope==='plan'&&c.ids.includes(id)&&chosen.some(i=>c.ids.includes(CATALOGUE[i]!.id)));
  function assign(depth:number) {
    if(stopped)return;
    if(depth===RULES.decisionCount){if(visitor(plan,()=>scoreSearchPlan(plan))===false)stopped=true;return;}
    const i=chosen[depth]!,item=CATALOGUE[i]!,heldItem=fixed.get(item.id);
    for(const option of heldItem?[optionFor(heldItem)]:SEARCH_OPTIONS[i]!) {
      if(INCOMPATIBILITIES.some(c=>c.scope==='district'&&c.ids.includes(option.initiativeId)&&plan.some(p=>c.ids.includes(p.initiativeId)&&p.scope==='district'&&option.scope==='district'&&p.districtId===option.districtId)))continue;
      plan.push(option);assign(depth+1);plan.pop();if(stopped)return;
    }
  }
  function choose(index:number,cost:number) {
    if(stopped)return;
    if(chosen.length===RULES.decisionCount){if([...fixed.keys()].every(id=>chosen.some(i=>CATALOGUE[i]!.id===id)))assign(0);return;}
    if(index>=CATALOGUE.length||CATALOGUE.length-index<RULES.decisionCount-chosen.length)return;
    const item=CATALOGUE[index]!;
    if(cost+item.cost<=RULES.budget&&(counts.get(item.area)??0)<RULES.maxPerArea&&!conflicts(item.id)) {
      chosen.push(index);counts.set(item.area,(counts.get(item.area)??0)+1);choose(index+1,cost+item.cost);chosen.pop();counts.set(item.area,counts.get(item.area)!-1);
    }
    if(!fixed.has(item.id))choose(index+1,cost);
  }
  choose(0,0);
}
