import type { Anchor, Resident } from './types';
import { RESIDENT_BY_ID } from './population';
import { anchorFor } from './engine';
import type { InitiativeId } from '../domain/types';

export type MomentDefinition = Readonly<{id:string;kind:'garden'|'drawing'|'dispatch'|'everyday';title:string;action:string;response:string;invitation:string;related?:InitiativeId}>;
const MOMENTS:Readonly<Record<string,MomentDefinition>> = {
  'esil-01':{id:'stool-and-planter',kind:'garden',title:'Лейка у шаткого табурета',
    action:'Айдана поворачивает табурет, проверяет ножку и ставит лейку рядом с горшком.',
    invitation:'Придержать табурет',response:'«Вот так. Теперь не качается». Она переставляет горшок и оставляет вам место рядом.',related:'M5'},
  'nura-01':{id:'drawing-in-the-wind',kind:'drawing',title:'Рисунок между страницами',
    action:'Мәдина придерживает рисунок тетрадью. Угол загибается; она снова разглаживает его ладонью.',
    invitation:'Посмотреть рисунок',response:'Она разворачивает лист: школьный двор, дерево, место для игры. «Тут ещё не всё поместилось».',related:'M4'},
  'baikonur-01':{id:'familiar-handwriting',kind:'dispatch',title:'Знакомый почерк на заявке',
    action:'Ерлан раскладывает листки, узнаёт почерк и подвигает один коллеге. Карандаш укатился к краю.',
    invitation:'Подать карандаш',response:'«Этот почерк узнаю и без подписи». Он делает короткую пометку, передаёт лист и возвращается к следующему.',related:'M12'},
};
export function momentFor(resident:Resident):MomentDefinition {
  return MOMENTS[resident.id] ?? {id:`everyday:${resident.id}`,kind:'everyday',title:resident.habit,action:resident.habit,invitation:'Поздороваться',response:'Замечает вас, кивает и возвращается к своему делу.'};
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
