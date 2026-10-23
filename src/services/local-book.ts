import type {CouncilSession,RegistryEntry} from '../dashboard/types';
import type {ModeId} from '../modes/types';
import {validateDraft} from '../domain/plan';
import {planFingerprint} from '../domain/identity';

export type LocalBook={sessions:CouncilSession[];entries:RegistryEntry[]};
type RecordValue=Record<string,unknown>;
const record=(value:unknown):value is RecordValue=>!!value&&typeof value==='object'&&!Array.isArray(value);
const texts=(value:RecordValue,keys:string[])=>keys.every(key=>typeof value[key]==='string');
const numbers=(value:RecordValue,keys:string[])=>keys.every(key=>typeof value[key]==='number'&&Number.isFinite(value[key]));
const array=(value:unknown,test:(item:unknown)=>boolean)=>Array.isArray(value)&&value.every(test);
const metric=(value:unknown)=>record(value)&&texts(value,['member'])&&numbers(value,['before','after','delta']);
const vote=(value:unknown)=>record(value)&&texts(value,['member','vote','reason'])&&numbers(value,['delta']);
function base(value:unknown,mode:ModeId):value is RecordValue {
 if(!record(value)||(value.worldMode??'astana')!==mode||!texts(value,['id','fingerprint','createdAt'])||!numbers(value,['score']))return false;
 const checked=validateDraft(value.plan);
 return checked.status==='complete'&&planFingerprint(checked.plan)===value.fingerprint;
}
function session(value:unknown,mode:ModeId):value is CouncilSession {
 if(!base(value,mode)||!texts(value,['summary','mode'])||value.status!=='complete')return false;
 const recommendation=value.recommendation;
 return array(value.members,m=>record(m)&&texts(m,['id','name','title','initials','focus']))&&(value.members as unknown[]).length===8
  &&array(value.events,e=>record(e)&&texts(e,['type','member','text','source'])&&numbers(e,['seq']))
  &&array(value.amendments,a=>record(a)&&texts(a,['id','proposer'])&&numbers(a,['score','gain','cost'])&&validateDraft(a.plan).status==='complete'&&validateDraft([a.replace]).status!=='invalid'&&validateDraft([a.with]).status!=='invalid'&&array(a.impacts,metric))
  &&record(recommendation)&&recommendation.valid===true&&array(recommendation.ids,id=>typeof id==='string')&&array(recommendation.votes,vote)&&array(recommendation.impacts,metric)&&numbers(recommendation,['score','cost'])&&validateDraft(recommendation.plan).status==='complete';
}
function entry(value:unknown,mode:ModeId):value is RegistryEntry {
 return base(value,mode)&&texts(value,['team'])&&numbers(value,['spent','rank','total']);
}
/** A damaged optional record must never prevent opening the saved game. */
export function parseLocalBook(raw:string|null,mode:ModeId):LocalBook {
 try{
  if(!raw||raw.length>2_000_000)return {sessions:[],entries:[]};
  const book:unknown=JSON.parse(raw);if(!record(book))return {sessions:[],entries:[]};
  return {sessions:Array.isArray(book.sessions)?book.sessions.filter((s):s is CouncilSession=>session(s,mode)).slice(-20):[],entries:Array.isArray(book.entries)?book.entries.filter((e):e is RegistryEntry=>entry(e,mode)).slice(-60):[]};
 }catch{return {sessions:[],entries:[]};}
}
