import { SCENARIO_VERSION } from '../domain/scenario';
import { validateDraft } from '../domain/plan';
import type { Plan } from '../domain/types';
import { readConstruction } from './construction';
import type { Construction } from './construction';

export const STORAGE_KEY = 'akim:draft';
export const CHECKPOINT_KEY = 'alem:previous-plan';
export type StorageNotice = 'restored' | 'corrupt' | 'obsolete' | 'unavailable' | null;
export type SavedDraft = { plan:Plan; welcomeDismissed:boolean; construction?:readonly Construction[] };
export type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const empty = (): SavedDraft => ({ plan:[], welcomeDismissed:false });
const isObject = (value:unknown): value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function decodeDraft(raw:string | null): SavedDraft & { notice:StorageNotice } {
  if (raw === null) return { ...empty(), notice:null };
  try {
    const value:unknown = JSON.parse(raw);
    if (!isObject(value)) return { ...empty(), notice:'corrupt' };
    if (value.schemaVersion !== 1 || value.scenarioVersion !== SCENARIO_VERSION) return { ...empty(), notice:'obsolete' };
    const validation = validateDraft(value.plan);
    if (validation.status === 'invalid' || !isObject(value.preferences) || typeof value.preferences.welcomeDismissed !== 'boolean') return { ...empty(), notice:'corrupt' };
    return { plan:validation.plan, welcomeDismissed:value.preferences.welcomeDismissed, ...(value.construction?{construction:readConstruction(value.construction,validation.plan)}:{}), notice:validation.plan.length ? 'restored' : null };
  } catch { return { ...empty(), notice:'corrupt' }; }
}

export function loadDraft(getStorage:() => StoragePort): SavedDraft & { notice:StorageNotice } {
  try { return decodeDraft(getStorage().getItem(STORAGE_KEY)); }
  catch { return { ...empty(), notice:'unavailable' }; }
}
export function saveDraft(getStorage:() => StoragePort, draft:SavedDraft): boolean {
  try {
    const storage = getStorage();
    if (!draft.plan.length && !draft.welcomeDismissed) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY,JSON.stringify({ schemaVersion:1, scenarioVersion:SCENARIO_VERSION,
      plan:draft.plan, ...(draft.construction?{construction:draft.construction}:{}), preferences:{ welcomeDismissed:draft.welcomeDismissed } }));
    return true;
  } catch { return false; }
}

/** One local recovery slot, using the same validator as the active draft. */
export function loadCheckpoint(getStorage:()=>StoragePort):SavedDraft|null {
 try{const draft=decodeDraft(getStorage().getItem(CHECKPOINT_KEY));return draft.plan.length?draft:null;}catch{return null;}
}
export function saveCheckpoint(getStorage:()=>StoragePort,draft:SavedDraft):boolean {
 if(validateDraft(draft.plan).status==='invalid'||!draft.plan.length)return false;
 return saveDraft(()=>{
  const storage=getStorage();
  return {getItem:()=>storage.getItem(CHECKPOINT_KEY),setItem:(_key,value)=>storage.setItem(CHECKPOINT_KEY,value),removeItem:()=>storage.removeItem(CHECKPOINT_KEY)};
 },draft);
}
