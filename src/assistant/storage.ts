import type {AyaMessage} from './types';
const KEY='alem.aya.conversation.v1';
/** Saved dialogue is history, never a queue of executable commands. */
export function loadConversation(storage:Pick<Storage,'getItem'>|null):AyaMessage[] {
 try {
  const raw=storage?.getItem(KEY);if(!raw||raw.length>180000)return [];
  const value:unknown=JSON.parse(raw);if(!Array.isArray(value))return [];
  return value.slice(-60).flatMap((v:unknown)=>{
   if(!v||typeof v!=='object')return [];
   const m=v as Partial<AyaMessage>;
   if(typeof m.id!=='string'||!['user','assistant'].includes(m.role??'')||typeof m.text!=='string'||m.text.length>4000||typeof m.time!=='number')return [];
   return [{id:m.id,role:m.role!,text:m.text,time:m.time,...(['local','live','action'].includes(m.mode??'')?{mode:m.mode!}:{}),...(Array.isArray(m.facts)?{facts:m.facts.filter(f=>f&&typeof f.id==='string'&&typeof f.text==='string'&&f.text.length<2000).slice(0,8)}:{})}];
  });
 }catch{return [];}
}
export function saveConversation(messages:readonly AyaMessage[],storage:Pick<Storage,'setItem'>|null):boolean {
 try {if(!storage)return false;storage.setItem(KEY,JSON.stringify(messages.slice(-60)));return true;}catch{return false;}
}
export function browserStorage():Storage|null {try{return window.localStorage;}catch{return null;}}
