import type {ModeDefinition} from '../modes/types';
import type {Decision} from '../domain/types';
import {districtName as modernDistrictName,decisionLabel as modernDecisionLabel} from '../dashboard/format';
export type CorePresentation=Pick<ModeDefinition,'id'|'projects'|'districts'|'indicators'|'terms'>;
export function corePresentation(mode?:CorePresentation){
 const districtName=(id:string)=>mode?.districts.find(d=>d.id===id)?.name??modernDistrictName(id);
 const decisionLabel=(decision:Decision)=>mode?`${mode.projects[decision.initiativeId].name} · ${decision.scope==='citywide'?mode.terms.citywide:districtName(decision.districtId)}`:modernDecisionLabel(decision);
 return {districtName,decisionLabel,unit:mode?.terms.unit??'units',seasons:mode?.terms.seasons??'quarters',districts:mode?.terms.districts??'districts'};
}
