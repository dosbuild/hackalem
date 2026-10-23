import { evaluatePlan } from './evaluate';
import { planFingerprint } from './identity';
import { summarizePlan, validateDraft } from './plan';
import { scoreSearchPlan, visitCompletions } from './search-kernel';
import type { Plan } from './types';

export const SEARCH_TOLERANCE=1e-9;
export type Completion=Readonly<{plan:Plan;score:number;added:Plan}>;
const viability=new Map<string,boolean>(),completions=new Map<string,Completion|null>();
const boundedSet=<T>(cache:Map<string,T>,key:string,value:T)=>{if(cache.size>=256)cache.delete(cache.keys().next().value!);cache.set(key,value);};

/** Cheap early-exit feasibility guard. Rejects invalid input; never changes a visitor decision. */
export function hasCompletion(input:Plan):boolean {
  const validation=validateDraft(input);if(validation.status==='invalid')return false;
  const key=planFingerprint(validation.plan),cached=viability.get(key);if(cached!==undefined)return cached;
  let found=false;visitCompletions(validation.plan,()=>{found=true;return false;});boundedSet(viability,key,found);return found;
}

/** Exact best completion, preserving every existing initiative and district. Run empty-plan search in a worker/server. */
export function findBestCompletion(input:Plan):Completion|null {
  const validation=validateDraft(input);if(validation.status==='invalid')return null;
  const key=planFingerprint(validation.plan);if(completions.has(key))return completions.get(key)!;
  let best:Plan|null=null,score=-Infinity;
  visitCompletions(validation.plan,(candidate,getScore)=>{const next=getScore();if(next>score+SEARCH_TOLERANCE){score=next;best=[...candidate];}});
  if(!best){boundedSet(completions,key,null);return null;}
  const evaluated=evaluatePlan(best);if(!evaluated.ok)throw new Error('Search returned invalid plan');
  const result={plan:evaluated.result.plan,score:evaluated.result.finalScore,added:evaluated.result.plan.filter(d=>!validation.plan.some(p=>p.initiativeId===d.initiativeId))};
  boundedSet(completions,key,result);return result;
}

export type PlanRepair=Completion&Readonly<{removed:Plan;costDelta:number;preserved:number}>;
/** Minimal number of replacements first, maximum canonical score second. Caller must show removed decisions before applying. */
export function findPlanRepair(input:Plan):PlanRepair|null {
  const validation=validateDraft(input);if(validation.status==='invalid')return null;
  const original=validation.plan;
  for(let removeCount=0;removeCount<=original.length;removeCount++) {
    let best:PlanRepair|null=null;
    for(let mask=0;mask<2**original.length;mask++) {
      const held=original.filter((_,i)=>!(mask&(1<<i)));if(original.length-held.length!==removeCount)continue;
      const completion=findBestCompletion(held);if(!completion)continue;
      if(!best||completion.score>best.score+SEARCH_TOLERANCE)best={...completion,removed:original.filter(d=>!held.includes(d)),costDelta:summarizePlan(completion.plan).spent-summarizePlan(original).spent,preserved:held.length};
    }
    if(best)return best;
  }
  return null;
}
export { scoreSearchPlan };
