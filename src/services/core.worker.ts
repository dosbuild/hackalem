import {findBestCompletion,findPlanRepair} from '../domain/planning-search';
import {planFingerprint} from '../domain/identity';
import {validateDraft} from '../domain/plan';
import {reviewPlan} from '../core/review';
import {buildCouncil,checkPackage} from '../core/council';
import {localAnalysis} from '../core/analysis';
import type {ModeId} from '../modes/types';
import type {CouncilSession} from '../dashboard/types';
import {projects} from '../modes/khanate/projects';
import {districts,indicators,terms} from '../modes/khanate/terms';
const khanate={id:'khanate' as const,projects,districts,indicators,terms};
/** Terminating this worker cancels synchronous exhaustive work immediately. */
self.onmessage=(event:MessageEvent<{id:number;route:string;mode:ModeId;body:Record<string,unknown>}>)=>{
 const {id,route,mode,body}=event.data;
 try{
  let value:unknown;
  if(route==='package'){
   const session=body.session as CouncilSession;
   if(!session||!Array.isArray(body.ids)||body.ids.length>7||body.ids.some(id=>typeof id!=='string'))throw Error('invalid_package');
   value=checkPackage(session.plan,session.amendments,body.ids as string[]);
  }else{
   const checked=validateDraft(body.plan);if(checked.status==='invalid')throw Error('invalid_plan');const plan=checked.plan;
   const identity=mode==='khanate'?khanate:undefined;
   if(route==='complete'){const completion=findBestCompletion(plan);value={completion,repair:completion?null:findPlanRepair(plan),fingerprint:planFingerprint(plan),worldMode:mode};}
   else if(route==='repair')value={repair:findPlanRepair(plan),fingerprint:planFingerprint(plan),worldMode:mode};
   else if(route==='review')value=reviewPlan(plan);
   else if(route==='analysis')value=localAnalysis(reviewPlan(plan),'browser',identity);
   else if(route==='council')value=buildCouncil(plan,String(body.id),String(body.createdAt),identity);
   else throw Error('unknown_operation');
  }
  self.postMessage({id,value});
 }catch(error){self.postMessage({id,error:error instanceof Error?error.message:'failed'});}
};
