import type {ModeId} from '../modes/types';
import type {AppState} from '../app/state';
import type {DistrictId, InitiativeId, Plan} from '../domain/types';

export type AyaSpace = 'map'|'residents'|'dashboard';
export type AyaSection = 'overview'|'review'|'council'|'registry';
export type AyaIntent =
  | {kind:'add';initiativeId:InitiativeId;districtId:DistrictId|null}
  | {kind:'complete'}
  | {kind:'repair';plan:Plan;expectedFingerprint:string}
  | {kind:'navigate';space:AyaSpace;section?:AyaSection}
  | {kind:'explain';topic:string};
export interface AyaRepair {plan:Plan;expectedFingerprint:string;title:string;detail:string}
export interface ActionOutcome {ok:boolean;message:string;repair?:AyaRepair}
export interface AyaAppeal {id:string;title:string;districtId:DistrictId;initiativeIds:readonly InitiativeId[];applicant?:string}
export interface AssistantProps {
  /** The application owns which contextual overlay is visible. */
  open?:boolean;
  state:AppState;space:AyaSpace;appeal?:AyaAppeal|null;council?:string;
  command:(intent:AyaIntent)=>Promise<ActionOutcome>;
  interrupt:()=>void;undo:()=>void;canUndo:boolean;
  automation:{active:boolean;progress:string};
  externalPrompt?:{id:number;text:string}|null;
  onOpenChanged?:(open:boolean)=>void;
  onClearAppeal?:()=>void;
}
export interface AyaContext {worldMode?:ModeId;plan:Plan;revision:number;space:AyaSpace;districtId:DistrictId|null;projectId?:InitiativeId|null;appeal?:AyaAppeal|null;council?:string}
export interface AyaFact {id:string;text:string}
export interface AssistantRequest {text:string;history:readonly {role:'user'|'assistant';text:string}[];context:AyaContext}
export interface AssistantReply {
  worldMode?:ModeId;
  mode:'live'|'local';reason?:'unavailable'|'failed'|'limited'|'cancelled';
  text:string;facts:readonly AyaFact[];intent:AyaIntent|null;
  fingerprint:string;revision:number;
}
export interface AyaMessage {
  id:string;role:'user'|'assistant';text:string;time:number;
  mode?:'live'|'local'|'action';facts?:readonly AyaFact[];
  intent?:AyaIntent|null;repair?:AyaRepair;fingerprint?:string;
}
export type AyaExpression='idle'|'attention'|'thought'|'explanation'|'success'|'error';
