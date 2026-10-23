import { format } from '../ui/copy';
import type { ModeDefinition, ModePresentation } from './types';

/** Pure and request-scoped, including server use. Never a mutable current-language global. */
export function presentationFor(mode:ModeDefinition):ModePresentation {
  const districtName:ModePresentation['districtName']=id=>mode.districts.find(d=>d.id===id)!.name;
  const scopeName:ModePresentation['scopeName']=d=>d.scope==='citywide'?mode.copy.citywide:d.districtId?districtName(d.districtId):mode.copy.chooseDistrict;
  const issueMessage:ModePresentation['issueMessage']=issue=>{
    const name=issue.initiativeId?mode.projects[issue.initiativeId].name:'',related=issue.relatedInitiativeId?mode.projects[issue.relatedInitiativeId].name:'';
    const where=issue.districtId?` · ${districtName(issue.districtId)}`:'';
    switch(issue.code){
      case 'stranded':return 'This choice would leave too little money or too few valid projects to complete all five decisions. Aya can help find a replacement.';
      case 'stale':return 'The plan has changed. Your new decisions are saved; request a fresh alternative.';
      case 'invalid_schema':return 'Could not read this decision. Choose the project again.';
      case 'unknown_initiative':return 'Unknown project. Choose one from the catalogue.';
      case 'invalid_scope':return `${name}: check the scope. A citywide initiative needs no separate location.`;
      case 'invalid_district':return `${name}: choose one of the five locations.`;
      case 'duplicate':return `«${name}» is already in the plan. Change this decision or choose another.`;
      case 'too_many':return 'You can make only five decisions. Change or remove an existing one.';
      case 'budget':return `Short by ${format(issue.amount??0)} ${mode.terms.unit}. Choose a cheaper project or replace an existing one.`;
      case 'area_limit':return `The policy area «${issue.area?mode.areas[issue.area]:''}» already has two decisions. Choose another area or replace a decision.`;
      case 'incompatible':return `«${name}» and «${related}» need the same resources${where}. Change the location or project.`;
      case 'missing_target':return 'The decision to replace was not found. Open the existing decision again.';
      case 'incomplete':return `Evaluation requires exactly five decisions. Still to add: ${issue.amount??0}.`;
    }
  };
  return {districtName,scopeName,issueMessage};
}
