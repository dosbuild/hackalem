import type { Anchor, Resident } from './types';
import { RESIDENT_BY_ID } from './population';
import { anchorFor } from './engine';
import type { InitiativeId } from '../domain/types';

export type MomentDefinition = Readonly<{id:string;kind:'garden'|'drawing'|'dispatch'|'everyday';title:string;action:string;response:string;invitation:string;related?:InitiativeId}>;
const MOMENTS:Readonly<Record<string,MomentDefinition>> = {
  'esil-01':{id:'stool-and-planter',kind:'garden',title:'A watering can beside a wobbly stool',
    action:'Aidana turns the stool, checks a leg and sets the watering can beside the pot.',
    invitation:'Hold the stool steady',response:'“There. It no longer wobbles.” She moves the pot and leaves room for you beside her.',related:'M5'},
  'nura-01':{id:'drawing-in-the-wind',kind:'drawing',title:'A drawing between the pages',
    action:'Madina holds a drawing under her notebook. A corner curls; she smooths it again with her palm.',
    invitation:'Look at the drawing',response:'She unfolds the sheet: a school courtyard, a tree, a place to play. “I could not fit everything in yet.”',related:'M4'},
  'baikonur-01':{id:'familiar-handwriting',kind:'dispatch',title:'Familiar handwriting on a request',
    action:'Erlan sorts the sheets, recognises the handwriting and slides one towards a colleague. A pencil has rolled to the edge.',
    invitation:'Pass the pencil',response:'“I recognise that handwriting even without a signature.” He adds a short note, passes the sheet and returns to the next one.',related:'M12'},
};
export function momentFor(resident:Resident):MomentDefinition {
  return MOMENTS[resident.id] ?? {id:`everyday:${resident.id}`,kind:'everyday',title:resident.habit,action:resident.habit,invitation:'Say hello',response:'Notices you, nods and returns to the task.'};
}
export type RememberedMoment = Readonly<{residentId:string;momentId:string;anchor:Anchor}>;
export const momentKey = (moment:RememberedMoment) => `${moment.residentId}@${moment.anchor.id}`;
export function toggleMoment(moments:readonly RememberedMoment[], moment:RememberedMoment):readonly RememberedMoment[] {
  if (moments.some(m=>momentKey(m)===momentKey(moment))) return moments.filter(m=>momentKey(m)!==momentKey(moment));
  return moments.length<3?[...moments,moment]:moments;
}
/** Restore only known people and authored moments; coordinates never come from storage. */
export function readMoments(value:unknown,residents:Readonly<Record<string,Resident>>=RESIDENT_BY_ID):readonly RememberedMoment[] {
  if (!Array.isArray(value)) return [];
  const accepted:RememberedMoment[]=[];
  for (const entry of value) {
    if (!entry||typeof entry!=='object'||typeof entry.residentId!=='string'||!Object.hasOwn(residents,entry.residentId)) continue;
    const resident=residents[entry.residentId], a=entry.anchor;
    if (!resident||entry.momentId!==momentFor(resident).id||!a||typeof a!=='object') continue;
    // Storage cannot move a person to another district or invent a renderer anchor.
    const defaultAnchor=anchorFor(resident);
    // Older saved approaches now resolve to the resident's ordinary geographic place.
    const legacy = resident.id==='esil-01'?'landmark:expo:approach':resident.id==='saryarka-01'?'landmark:atyrau:approach':null;
    const anchor=(a.id===defaultAnchor.id||(legacy!==null&&a.id===legacy))&&a.districtId===defaultAnchor.districtId&&a.kind===defaultAnchor.kind?defaultAnchor:null;
    if(!anchor)continue;
    const moment:RememberedMoment={residentId:resident.id,momentId:entry.momentId,anchor};
    if (!accepted.some(m=>momentKey(m)===momentKey(moment))) accepted.push(moment);
    if (accepted.length===3) break;
  }
  return accepted;
}
