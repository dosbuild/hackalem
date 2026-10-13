import {ControlIcon} from '../ui/ControlIcon';
import type { AppState } from '../app/state';
import { DISTRICTS } from '../domain/scenario';
import { SIGNATURE_RESIDENTS } from './population';
import { anchorFor, observe } from './engine';
import { Portrait } from './ResidentLayer';
import type { Anchor } from './types';

/** A curated geographic entry to existing encounters, never another planning store. */
export function ResidentRequests({state,selectedId,onFocus}:{state:AppState;selectedId:string|null;onFocus:(id:string,anchor:Anchor)=>void}) {
 const districts=[...DISTRICTS].sort((a,b)=>Number(b.id===state.focusedDistrict)-Number(a.id===state.focusedDistrict));
 return <div className="resident-requests">{districts.map(d=>{
  const resident=SIGNATURE_RESIDENTS.find(r=>r.location===d.id)!;const anchor=anchorFor(resident),observation=observe(resident,state,anchor);
  return <button key={resident.id} className="resident-request" data-resident={resident.id} aria-pressed={selectedId===resident.id} onClick={()=>onFocus(resident.id,anchor)}><Portrait resident={resident}/><span><strong>{resident.name}</strong><small>{d.name} · {anchor.label}</small><span>{observation.opening.ru}</span><em>Найти на карте <ControlIcon kind="arrow-right" size={18}/></em></span></button>;
 })}</div>;
}
