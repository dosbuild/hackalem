import type {ModeId} from '../modes/types';
import type {CouncilSession,RegistryEntry,PlanReview} from '../dashboard/types';
import {worldStorage} from '../modes/storage';
import {calculate} from './worker-client';
import {planFingerprint} from '../domain/identity';
import {validateDraft} from '../domain/plan';
import type {Plan} from '../domain/types';
import {parseLocalBook} from './local-book';
import type {LocalBook as Book} from './local-book';
const KEY='alem:local-chronicle:v1';
function read(mode:ModeId):Book{try{return parseLocalBook(worldStorage(mode).getItem(KEY),mode);}catch{return {sessions:[],entries:[]};}}
function save(mode:ModeId,book:Book){try{worldStorage(mode).setItem(KEY,JSON.stringify(book));return true;}catch{return false;/* The mode port retains this book in memory. */}}
const validPlan=(input:unknown):Plan=>{const checked=validateDraft(input);if(checked.status==='invalid')throw Error('invalid_plan');return checked.plan;};
export async function localService<T>(route:string,mode:ModeId,body?:unknown,signal?:AbortSignal):Promise<T>{
 signal?.throwIfAborted();const url=new URL(route,'https://local.invalid/'),name=url.pathname.slice(1),book=read(mode);
 const data=body&&typeof body==='object'&&!Array.isArray(body)?body as Record<string,unknown>:{};
 let value:unknown;
 if(body===undefined){
  if(name==='registry')value={entries:book.entries.slice().reverse()};
  else if(name==='council')value={sessions:book.sessions.filter(s=>s.fingerprint===url.searchParams.get('fingerprint')).reverse()};
  else if(name.startsWith('council/')){value=book.sessions.find(s=>s.id===name.slice(8));if(!value)throw Error('not_found');}
  else throw Error('unknown_operation');
 }else if(name==='package'){
  const session=book.sessions.find(s=>s.id===data.sessionId);if(!session)throw Error('not_found');
  value=await calculate(name,mode,{session,ids:data.ids},signal);
 }else if(name==='registry'){
  const team=typeof data.team==='string'?data.team.trim().replace(/\s+/g,' '):'';
  if(team.length<2||team.length>60||/[\p{Cc}]/u.test(team))throw Error('invalid_team');if(data.confirmed!==true)throw Error('explicit_submission_required');
  const plan=validPlan(data.plan),review=await calculate<PlanReview>('review',mode,{plan},signal);signal?.throwIfAborted();
  const session=book.sessions.find(s=>s.id===data.sessionId);if(session&&session.fingerprint!==review.fingerprint)throw Error('council_plan_mismatch');
  const entry:RegistryEntry={id:crypto.randomUUID(),team,createdAt:new Date().toISOString(),worldMode:mode,local:true,fingerprint:review.fingerprint,plan:review.result.plan,score:review.result.finalScore,spent:review.result.summary.spent,rank:review.rank,total:review.total,sessionId:session?.id??null};
  const current=read(mode);current.entries=[...current.entries,entry].slice(-60);if(!save(mode,current))entry.volatile=true;value=entry;
 }else if(name==='council'){
  const plan=validPlan(data.plan),fingerprint=planFingerprint(plan);
  const session=await calculate<CouncilSession>('council',mode,{plan,id:crypto.randomUUID(),createdAt:new Date().toISOString()},signal);signal?.throwIfAborted();
  if(session.fingerprint!==fingerprint)throw Error('stale');session.worldMode=mode;
  const current=read(mode);current.sessions=[...current.sessions,session].slice(-20);save(mode,current);value=session;
 }else value=await calculate(name,mode,{plan:validPlan(data.plan)},signal);
 return value as T;
}
