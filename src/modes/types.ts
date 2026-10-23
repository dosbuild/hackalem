import type { CandidateDecision, DistrictId, IndicatorId, InitiativeId, PolicyArea, ValidationIssue } from '../domain/types';
import type { Appeal, LivingStory } from '../living/appeals';
import type { Resident } from '../residents/types';
import type { text } from '../ui/copy';
import type {ResidentNarrative} from '../residents/narrative';

export type ModeId = 'astana' | 'khanate';
export type ProjectPresentation = Readonly<{
  name:string; shortName:string; action:string; shortNeed:string; shortLimit:string;
  benefit:string; limitation:string; indicator:IndicatorId; need:string;
}>;
/** Editorial identity. This type intentionally cannot override a price, effect, or model rule. */
export interface ModeDefinition {
  readonly id:ModeId;
  readonly title:string;
  readonly subtitle:string;
  readonly era:string;
  readonly districts:readonly Readonly<{id:DistrictId;name:string;character:string}>[];
  readonly projects:Readonly<Record<InitiativeId,ProjectPresentation>>;
  readonly areas:Readonly<Record<PolicyArea,string>>;
  readonly indicators:Readonly<Record<IndicatorId,string>>;
  readonly stories:readonly LivingStory[];
  readonly appeals:readonly Appeal[];
  readonly residents:readonly Resident[];
  readonly narrative?:ResidentNarrative;
  readonly demonstration:Readonly<{link:string;title:string;preparing:string;building:string;complete:string;promise:string}>;
  readonly copy:typeof text;
  readonly terms:Readonly<{unit:string;district:string;districts:string;season:string;seasons:string;decision:string;decisions:string;result:string;residents:string;citywide:string}>;
}
export interface ModePresentation {
  districtName:(id:DistrictId)=>string;
  scopeName:(decision:CandidateDecision)=>string;
  issueMessage:(issue:ValidationIssue)=>string;
}
export const isModeId=(value:unknown):value is ModeId=>value==='astana'||value==='khanate';
