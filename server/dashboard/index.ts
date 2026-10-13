import {isModeId} from '../../src/modes/types';
import {khanateIdentity} from '../../src/modes/khanate/identity';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { planFingerprint } from '../../src/domain/identity';
import { validateDraft } from '../../src/domain/plan';
import { findBestCompletion, findPlanRepair } from '../../src/domain/planning-search';
import type { Plan } from '../../src/domain/types';
import { createAnalysisService } from './analysis';
import { buildCouncil, checkPackage, COUNCIL_RULES_VERSION } from './council';
import { reviewPlan } from './review';
import { DashboardStore } from './store';

export type DashboardOptions={directory?:string;store?:DashboardStore;analysis?:ReturnType<typeof createAnalysisService>;now?:()=>Date};
async function readBody(req:IncomingMessage):Promise<Record<string,unknown>> {
 let size=0;const chunks:Buffer[]=[];
 for await(const chunk of req){const buffer=Buffer.from(chunk);size+=buffer.length;if(size>32768)throw new Error('body_too_large');chunks.push(buffer);}
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid_request');return value;
}
const validPlan=(input:unknown):Plan=>{const validation=validateDraft(input);if(validation.status==='invalid')throw new Error('invalid_plan');return validation.plan;};
/** Mount before the static handler. Returns false when pathname is outside this module. */
export function createDashboardHandler(options:DashboardOptions={}) {
 let store:DashboardStore|undefined=options.store;
 const getStore=()=>store??=new DashboardStore(options.directory);
 const analyze=options.analysis??createAnalysisService();
 const now=options.now??(()=>new Date());
 return async(req:IncomingMessage,res:ServerResponse):Promise<boolean>=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(!url.pathname.startsWith('/api/dashboard/'))return false;
  const json=(status:number,value:unknown)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try {
   const route=url.pathname.slice('/api/dashboard/'.length);
   const requested=url.searchParams.get('mode');if(requested!==null&&!isModeId(requested))throw Error('invalid_request');
   let worldMode=requested??'astana';
   if(req.method==='GET'&&route==='registry'){json(200,{entries:getStore().registry(worldMode)});return true;}
   if(req.method==='GET'&&route==='council'){const fingerprint=url.searchParams.get('fingerprint');json(200,{sessions:fingerprint?getStore().forPlan(fingerprint,worldMode):[]});return true;}
   if(req.method==='GET'&&route.startsWith('council/')){const stored=getStore().session(route.slice(8)),session=(stored?.worldMode??'astana')===worldMode?stored:null;json(session?200:404,session??{error:'not_found'});return true;}
   if(req.method!=='POST'){json(405,{error:'method'});return true;}
   if(req.headers['sec-fetch-site']==='cross-site'){json(403,{error:'origin'});return true;}
   const origin=req.headers.origin;
   if(origin){let same=false;try{same=new URL(origin).host===req.headers.host;}catch{/* Malformed origins are rejected. */}if(!same){json(403,{error:'origin'});return true;}}
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){json(415,{error:'json_required'});return true;}
   if(Number(req.headers['content-length'])>32768){json(413,{error:'body_too_large'});req.resume();return true;}
   const body=await readBody(req);
   if(body.worldMode!==undefined){if(!isModeId(body.worldMode)||(requested!==null&&body.worldMode!==requested))throw Error('invalid_request');worldMode=body.worldMode;}
   const identity=worldMode==='khanate'?khanateIdentity:undefined;
   if(route==='package') {
    const session=typeof body.sessionId==='string'?getStore().session(body.sessionId):null;if(!session||(session.worldMode??'astana')!==worldMode){json(404,{error:'not_found'});return true;}
    if(!Array.isArray(body.ids)||body.ids.length>7||body.ids.some(id=>typeof id!=='string'))throw new Error('invalid_package');
    json(200,checkPackage(session.plan,session.amendments,body.ids as string[]));return true;
   }
   const plan=validPlan(body.plan);
   if(route==='complete'){const completion=findBestCompletion(plan);json(200,{completion,repair:completion?null:findPlanRepair(plan),fingerprint:planFingerprint(plan)});return true;}
   if(route==='repair'){json(200,{repair:findPlanRepair(plan),fingerprint:planFingerprint(plan)});return true;}
   if(route==='review'){json(200,reviewPlan(plan));return true;}
   if(route==='analysis'){json(200,await analyze(reviewPlan(plan),identity));return true;}
   if(route==='council') {
    const fingerprint=planFingerprint(plan),existing=getStore().forPlan(fingerprint,worldMode).find(session=>session.rulesVersion===COUNCIL_RULES_VERSION);
    const session=existing??getStore().saveSession(buildCouncil(plan,randomUUID(),now().toISOString(),identity));json(200,session);return true;
   }
   if(route==='registry') {
    const team=typeof body.team==='string'?body.team.trim().replace(/\s+/g,' '):'';
    if(team.length<2||team.length>60||/[\p{Cc}]/u.test(team))throw new Error('invalid_team');
    if(body.confirmed!==true)throw new Error('explicit_submission_required');
    const review=reviewPlan(plan),session=typeof body.sessionId==='string'?getStore().session(body.sessionId):null;
    if(session&&(session.fingerprint!==review.fingerprint||(session.worldMode??'astana')!==worldMode))throw new Error('council_plan_mismatch');
    const entry=getStore().submit({worldMode,id:randomUUID(),team,createdAt:now().toISOString(),fingerprint:review.fingerprint,plan:review.result.plan,score:review.result.finalScore,spent:review.result.summary.spent,rank:review.rank,total:review.total,sessionId:session?.id??null});json(200,entry);return true;
   }
   json(404,{error:'not_found'});return true;
  } catch(error) {
   const code=error instanceof Error?error.message:'failed';const client=['invalid_plan','invalid_request','invalid_package','invalid_team','explicit_submission_required','council_plan_mismatch','body_too_large'].includes(code)||error instanceof SyntaxError;
   json(client?400:503,{error:client?code:'storage_or_service_unavailable'});return true;
  }
 };
}
const defaultHandler=createDashboardHandler();
export const handleDashboardRequest=defaultHandler;
