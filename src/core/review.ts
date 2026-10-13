import { BASELINE_ASSESSMENT, evaluatePlan } from '../domain/evaluate';
import { planFingerprint } from '../domain/identity';
import { validateDraft } from '../domain/plan';
import { SEARCH_TOLERANCE } from '../domain/planning-search';
import { SEARCH_OPTIONS, scoreSearchPlan, visitCompletions } from '../domain/search-kernel';
import type { Plan } from '../domain/types';
import type { HistogramBin, MoveReview, PlanReview, Swap } from '../dashboard/types';

export type Landscape={scores:Float64Array;optimum:{plan:Plan;score:number};histogram:HistogramBin[]};
let landscape:Landscape|undefined;
/** One process-wide exact landscape. Only canonical data enters the scoring kernel. */
export function getLandscape():Landscape {
 if(landscape)return landscape;
 const scores:number[]=[];let optimum:Landscape['optimum']={plan:[],score:-Infinity};
 visitCompletions([], (plan,score)=>{const value=score();scores.push(value);if(value>optimum.score+SEARCH_TOLERANCE)optimum={plan:[...plan],score:value};});
 const sorted=new Float64Array(scores).sort(),step=.25,minimum=Math.floor(sorted[0]!/step)*step;
 const histogram=Array.from({length:Math.floor((sorted.at(-1)!-minimum)/step)+1},(_,i)=>({from:minimum+i*step,to:minimum+(i+1)*step,count:0}));
 for(const score of sorted)histogram[Math.floor((score-minimum)/step)]!.count++;
 const canonical=evaluatePlan(optimum.plan);if(!canonical.ok)throw new Error('Invalid optimum');
 landscape={scores:sorted,optimum:{plan:canonical.result.plan,score:canonical.result.finalScore},histogram};return landscape;
}
export function rankOf(score:number,data=getLandscape()):number {
 let low=0,high=data.scores.length;while(low<high){const middle=Math.floor((low+high)/2);if(data.scores[middle]!<=score+SEARCH_TOLERANCE)low=middle+1;else high=middle;}return data.scores.length-low+1;
}
export function allSwaps(plan:Plan):Swap[] {
 const current=scoreSearchPlan(plan),swaps:Swap[]=[];
 for(const [index,replace] of plan.entries())for(const option of SEARCH_OPTIONS.flat()) {
  const candidate=[...plan];candidate[index]=option;
  if(planFingerprint(candidate)===planFingerprint(plan)||validateDraft(candidate).status!=='complete')continue;
  const score=scoreSearchPlan(candidate);
  swaps.push({id:`${replace.initiativeId}@${replace.scope==='district'?replace.districtId:'city'}>${option.initiativeId}@${option.scope==='district'?option.districtId:'city'}`,replace,with:option,plan:candidate,score,gain:score-current,cost:candidate.reduce((n,d)=>n+costOf(d.initiativeId),0)});
 }
 return swaps.sort((a,b)=>b.gain-a.gain||a.id.localeCompare(b.id));
}
import {INITIATIVES} from '../domain/scenario';
const costOf=(id:keyof typeof INITIATIVES)=>INITIATIVES[id].cost;
/** Exact Shapley values over all 32 coalitions, including clipping, synergies and threshold penalties. */
export function shapleyContributions(plan:Plan):number[] {
 const n=plan.length,factorial=[1];for(let i=1;i<=n;i++)factorial[i]=factorial[i-1]!*i;
 const scores=Array.from({length:2**n},(_,mask)=>scoreSearchPlan(plan.filter((_,i)=>Boolean(mask&(1<<i)))));
 return plan.map((_,i)=>{let value=0;for(let mask=0;mask<2**n;mask++){if(mask&(1<<i))continue;const size=plan.filter((_,j)=>Boolean(mask&(1<<j))).length;value+=factorial[size]!*factorial[n-size-1]!/factorial[n]!*(scores[mask|(1<<i)]!-scores[mask]!);}return value;});
}
const cache=new Map<string,PlanReview>();
export function reviewPlan(input:unknown):PlanReview {
 const evaluated=evaluatePlan(input);if(!evaluated.ok)throw new Error('invalid_plan');
 const result=evaluated.result,key=result.planFingerprint;if(cache.has(key))return cache.get(key)!;
 const data=getLandscape(),rank=rankOf(result.finalScore,data),swaps=allSwaps(result.plan),values=shapleyContributions(result.plan);
 const moves:MoveReview[]=result.plan.map((decision,i)=>{const bestSwap=swaps.find(s=>s.replace.initiativeId===decision.initiativeId&&s.gain>SEARCH_TOLERANCE)??null;return{decision,contribution:values[i]!,grade:values[i]!<0?'careful':(bestSwap?.gain??0)>=.3?'improve':(bestSwap?.gain??0)>.05?'strong':'best',bestSwap};});
 const review:PlanReview={fingerprint:key,result,rank,total:data.scores.length,percentile:100*(data.scores.length-rank)/(data.scores.length-1),histogram:data.histogram,efficiency:10*(result.finalScore-BASELINE_ASSESSMENT.finalScore)/result.summary.spent,optimum:data.optimum,moves,swaps:swaps.filter(s=>s.gain>SEARCH_TOLERANCE).slice(0,12)};
 if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,review);return review;
}
