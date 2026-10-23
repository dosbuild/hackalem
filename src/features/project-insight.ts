import {applyEdit} from '../domain/plan';
import {hasCompletion} from '../domain/planning-search';
import {DISTRICTS, INITIATIVES, SYNERGIES, INCOMPATIBILITIES} from '../domain/scenario';
import type {CandidateDecision, CitywideInitiativeId, DistrictId, DistrictInitiativeId, IndicatorId, InitiativeId, Plan, ValidationIssue} from '../domain/types';

/** Editorial context only. Prices, effects, compatibility and feasibility stay in the model. */
export const PROJECT_STORIES:Record<InitiativeId,{benefit:string;limitation:string;indicator:IndicatorId;need:string}>= {
  M1:{benefit:'Give buses their own route through traffic.',limitation:'Timetables and safe access to the stop need separate attention.',indicator:'T2',need:'Public transport'},
  M2:{benefit:'Coordinate traffic signals across the city.',limitation:'Traffic signals do not create new public transport routes.',indicator:'T1',need:'Traffic flow'},
  M3:{benefit:'Give the district a new rail connection.',limitation:'People still need to reach the station. This is one of the most expensive and slowest projects.',indicator:'T2',need:'Public transport'},
  M4:{benefit:'A place for walks and conversation near home.',limitation:'A park does not solve shortages of schools and healthcare.',indicator:'E1',need:'Green space provision'},
  M5:{benefit:'Less smoke from heating private homes.',limitation:'Other pollution sources remain. Families will need to prepare their homes.',indicator:'E2',need:'Air quality'},
  M6:{benefit:'More greenery and shelter from wind in every district.',limitation:'Plantings need time and care; they do not replace clean heating.',indicator:'E1',need:'Green space provision'},
  M7:{benefit:'More school places close to families.',limitation:'Getting to school safely remains a separate task.',indicator:'S1',need:'Schools and kindergartens'},
  M8:{benefit:'Primary healthcare closer to home.',limitation:'Staff and appointment systems are needed. The model does not predict waiting times.',indicator:'S2',need:'Primary healthcare'},
  M9:{benefit:'A courtyard for exercise and meeting people.',limitation:'A small boost to three indicators; it cannot replace a full school or clinic.',indicator:'S2',need:'Primary healthcare'},
  M10:{benefit:'Light for the evening walk and more visible streets.',limitation:'Lighting does not fix a poorly designed crossing.',indicator:'B1',need:'Street safety'},
  M11:{benefit:'Safer crossings and routes to school.',limitation:'Trade-off: cars move more slowly, reducing traffic flow.',indicator:'B2',need:'Road safety'},
  M12:{benefit:'A clearer route from a resident request to a response.',limitation:'A fast response alone does not repair a pipe or resolve a request.',indicator:'C2',need:'Request resolution speed'},
  M13:{benefit:'More reliable heat and water in the selected district.',limitation:'An expensive project with delayed effects. Problems inside buildings may remain.',indicator:'C1',need:'Utility reliability'},
  M14:{benefit:'City services are better prepared for failures.',limitation:'A fast response does not replace scheduled utility upgrades.',indicator:'C1',need:'Utility reliability'},
};

export function projectDecision(id:InitiativeId,district:DistrictId|null):CandidateDecision {
  return INITIATIVES[id].scope==='citywide'
    ? {initiativeId:id as CitywideInitiativeId,scope:'citywide'}
    : {initiativeId:id as DistrictInitiativeId,scope:'district',districtId:district};
}

/** Inspect all district choices so a local conflict never hides a project viable elsewhere. */
export function projectAvailability(plan:Plan,id:InitiativeId,district:DistrictId|null,replaces:InitiativeId|null=null) {
  const inspect=(place:DistrictId|null)=>{
    const decision=projectDecision(id,place);
    const edit=applyEdit(plan,replaces?{kind:'replace',target:replaces,decision}:{kind:'add',decision});
    const issues:readonly ValidationIssue[]=edit.accepted?(hasCompletion(edit.plan)?[]:[{code:'stranded'}]):edit.issues;
    return {districtId:place,available:issues.length===0,issues};
  };
  const choices=INITIATIVES[id].scope==='citywide'?[inspect(null)]:DISTRICTS.map(d=>inspect(d.id));
  const selected=choices.find(c=>c.districtId===district)??(INITIATIVES[id].scope==='citywide'?choices[0]:undefined);
  return {choices,selected,available:choices.some(c=>c.available),elsewhere:!!selected&&!selected.available&&choices.some(c=>c.available)};
}

export function projectConnections(id:InitiativeId,plan:Plan,district:DistrictId|null,replaces:InitiativeId|null=null) {
  const others=plan.filter(d=>d.initiativeId!==replaces&&d.initiativeId!==id);
  const synergies=SYNERGIES.filter(s=>s.ids.includes(id)).map(s=>{
    const partnerId=s.ids.find(other=>other!==id)!;
    const partner=others.find(d=>d.initiativeId===partnerId);
    return {...s,partnerId,active:!!partner,districtId:id===s.ids[0]?district:partner?.scope==='district'?partner.districtId:null};
  });
  const conflicts=INCOMPATIBILITIES.filter(c=>c.ids.includes(id)).map(c=>({
    ...c,partnerId:c.ids.find(other=>other!==id)!,
  }));
  return {synergies,conflicts};
}
