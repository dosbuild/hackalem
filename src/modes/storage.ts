import type { StoragePort } from '../app/storage';
import { isModeId } from './types';
import type { ModeId } from './types';

export const LAST_MODE_KEY='alem:last-world:v1';
export const modeKey=(mode:ModeId,key:string)=>mode==='astana'?key:`alem:khanate:${key}`;
const localMemory=new Map<string,string|null>();
const sessionMemory=new Map<string,string|null>();

/** Each port captures its world. A late write can never land in another world's save. */
export function createModeStorage(mode:ModeId,getStorage:()=>StoragePort,memory=new Map<string,string|null>()):StoragePort {
  return {
    getItem(key){
      const scoped=modeKey(mode,key);
      if(memory.has(scoped))return memory.get(scoped)??null;
      const value=getStorage().getItem(scoped);memory.set(scoped,value);return value;
    },
    setItem(key,value){const scoped=modeKey(mode,key);memory.set(scoped,value);getStorage().setItem(scoped,value);},
    removeItem(key){const scoped=modeKey(mode,key);memory.set(scoped,null);getStorage().removeItem(scoped);},
  };
}
const localPorts=new Map<ModeId,StoragePort>(),sessionPorts=new Map<ModeId,StoragePort>();
export function worldStorage(mode:ModeId,kind:'local'|'session'='local'):StoragePort {
  const ports=kind==='local'?localPorts:sessionPorts;
  let port=ports.get(mode);
  if(!port){port=createModeStorage(mode,()=>kind==='local'?window.localStorage:window.sessionStorage,kind==='local'?localMemory:sessionMemory);ports.set(mode,port);}
  return port;
}
/** Legacy unqualified landmark links always describe modern Astana. */
export function initialMode(search:string,read:()=>string|null):ModeId {
  const query=new URLSearchParams(search),explicit=query.get('mode');
  if(isModeId(explicit))return explicit;
  if(query.has('landmark'))return 'astana';
  try{const saved=read();return isModeId(saved)?saved:'astana';}catch{return 'astana';}
}
export function modeUrl(url:URL,mode:ModeId):URL {
  const next=new URL(url);next.searchParams.set('mode',mode);next.searchParams.delete('landmark');return next;
}
