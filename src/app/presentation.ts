import type {DistrictId,InitiativeId} from '../domain/types';
import type {AyaSpace,AyaSection} from '../assistant/types';
import type {Anchor,Resident} from '../residents/types';
import type {LivingStory} from '../living/appeals';
import type {Plan} from '../domain/types';
import {INITIATIVE_IDS,DISTRICT_IDS} from '../domain/types';
import {anchorFor} from '../residents/engine';
import {streetAnchor} from '../living/street-residents';
import type {AppState} from './state';

export type ResidentBookPage={page:'conversation'}|{page:'archive'}|{page:'appeal';returnTo:'conversation'|'archive'};

/** Stable references to the visible place. The plan, results and camera stay in their existing owners. */
export type ContextView =
 | {kind:'city'}
 | {kind:'treasury'}
 | {kind:'choices'}
 | {kind:'catalogue'}
 | {kind:'proposal';initiativeId?:InitiativeId;districtId?:DistrictId;replaces?:InitiativeId|null}
 | {kind:'inspection';initiativeId:InitiativeId;districtId?:DistrictId;siteId?:string}
 | {kind:'encounter';residentId:string;storyId:string|null;anchor:Anchor;talking:boolean}
 | {kind:'result'}
 | {kind:'comparison'}
 | {kind:'book';section:AyaSection|'residents';residentPage?:ResidentBookPage;storyId?:string};
export type ContextOverlay = 'guide'|'aya'|'restart'|'restore'|null;
export type PresentationState = Readonly<{view:ContextView;returnTo:ContextView|null;overlay:ContextOverlay;expanded:boolean;focusRequest:number}>;
export type PresentationAction =
 | {type:'open';view:ContextView;remember?:boolean;resetReturn?:boolean}
 | {type:'reconcile';domain:Pick<AppState,'plan'|'candidate'|'alternative'|'result'>}
 | {type:'bookPerson';storyId:string}
 | {type:'back';fallback:ContextView}
 | {type:'overlay';overlay:ContextOverlay}
 | {type:'expand';expanded:boolean}
 | {type:'focus'};

export const spaceFor = (view:ContextView):AyaSpace => view.kind==='book' ? view.section==='residents'?'residents':'dashboard' : 'map';
/** A rejected confirmation keeps the proposal and its errors visible. */
export function committedView(before:AppState,after:AppState):ContextView|null {
 if(!before.candidate||after.candidate)return null;
 return after.alternative?.result?{kind:'comparison'}:after.plan.length===5?{kind:'city'}:{kind:'inspection',initiativeId:before.candidate.decision.initiativeId};
}
export function initialPresentation(view:ContextView={kind:'city'}):PresentationState {
 return {view,returnTo:null,overlay:null,expanded:false,focusRequest:0};
}
export function presentationReducer(state:PresentationState,action:PresentationAction):PresentationState {
 switch(action.type){
  case 'reconcile': {
   const {plan,candidate,alternative,result}=action.domain;
   const fallback:ContextView=plan.length===5?{kind:'city'}:{kind:'choices'};
   const resolve=(view:ContextView):ContextView=>{
    if(view.kind==='proposal'&&!candidate||view.kind==='comparison'&&!alternative||view.kind==='inspection'&&!plan.some(d=>d.initiativeId===view.initiativeId)||view.kind==='result'&&plan.length!==5)return fallback;
    if(view.kind==='choices'&&(result||plan.length===5))return {kind:'city'};
    return view;
   };
   const view=resolve(state.view),returnTo=state.returnTo?resolve(state.returnTo):null;
   if(view===state.view&&returnTo===state.returnTo)return state;
   // Aya keeps her stop/undo controls and focus while the city underneath
   // follows the authoritative plan. Books and conversations keep their place.
   return {...state,view,returnTo,expanded:view===state.view?state.expanded:false,focusRequest:state.focusRequest+Number(view!==state.view&&!state.overlay)};
  }
  case 'open': return {...state,view:action.view,returnTo:action.resetReturn?null:action.remember?state.view:state.returnTo,overlay:null,expanded:false,focusRequest:state.focusRequest+1};
  case 'bookPerson': return state.view.kind==='book'&&state.view.section==='residents'?{...state,view:{...state.view,storyId:action.storyId}}:state;
  case 'back': return {...state,view:state.returnTo??action.fallback,returnTo:null,expanded:false,focusRequest:state.focusRequest+1};
  case 'overlay': return {...state,overlay:action.overlay};
  case 'expand': return {...state,expanded:action.expanded};
  case 'focus': return {...state,focusRequest:state.focusRequest+1};
 }
}
export type StoredContext={space?:AyaSpace;appeal?:string;district?:DistrictId};
export function readStoredContext(raw:string|null):StoredContext {
 try {const value:unknown=JSON.parse(raw??'{}');if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const v=value as Record<string,unknown>,context:StoredContext={};
  if(v.space==='map'||v.space==='residents'||v.space==='dashboard')context.space=v.space;
  if(typeof v.appeal==='string')context.appeal=v.appeal;
  if(['esil','almaty','saryarka','baikonur','nura'].includes(String(v.district)))context.district=v.district as DistrictId;
  return context;
 }catch{return {};}
}

/** Storage supplies references, never coordinates, camera frames or business state. */
export function readPresentation(raw:string|null,plan:Plan,stories:readonly LivingStory[],residents:Readonly<Record<string,Resident>>):Pick<PresentationState,'view'|'returnTo'>|null {
 const readEncounterAnchor=(value:unknown,base:Anchor,historical:boolean,storyInitiative?:InitiativeId):Anchor=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return base;
  const anchor=value as Record<string,unknown>;
  if(typeof anchor.id!=='string'||anchor.id.length>200)return base;
  // Persist only a world-scoped reference. The runtime resolves the authored
  // child; storage never supplies its geometry or a replacement person scope.
  const parts=/^program:(M(?:[1-9]|1[0-4])):(esil|almaty|saryarka|baikonur|nura)(?::([a-z][a-z0-9-]{0,95})|@([1-9][0-9]{0,2}))$/.exec(anchor.id);
  if(!parts||historical!==!!parts[4])return base;
  const initiativeId=parts[1] as InitiativeId,districtId=parts[2] as DistrictId;
  if(districtId!==base.districtId||anchor.districtId!==districtId||storyInitiative&&initiativeId!==storyInitiative)return base;
  if(!plan.some(d=>d.initiativeId===initiativeId&&(d.scope==='citywide'||d.districtId===districtId)))return base;
  const programStory=stories.find(s=>s.initiativeId===initiativeId&&s.districtId===districtId),kind=programStory?streetAnchor(programStory).kind:base.kind;
  const label=typeof anchor.label==='string'?anchor.label.replace(/[\p{Cc}\p{Cf}]/gu,' ').replace(/\s+/g,' ').trim().slice(0,160):'';
  return {...base,id:anchor.id,kind,label:label||base.label};
 };
 const readView=(value:unknown):ContextView|null=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  if(v.kind==='city'||v.kind==='treasury')return {kind:v.kind};
  if(v.kind==='choices')return plan.length===5?{kind:'city'}:{kind:'choices'};
  if(v.kind==='catalogue')return {kind:'catalogue'};
  if(v.kind==='proposal'){
   if(!INITIATIVE_IDS.includes(v.initiativeId as InitiativeId))return {kind:'catalogue'};
   return {kind:'proposal',initiativeId:v.initiativeId as InitiativeId,...(DISTRICT_IDS.includes(v.districtId as DistrictId)?{districtId:v.districtId as DistrictId}:{}),replaces:plan.some(d=>d.initiativeId===v.replaces)?v.replaces as InitiativeId:null};
  }
  if(v.kind==='result'||v.kind==='comparison')return plan.length===5?{kind:'result'}:{kind:'choices'};
  if(v.kind==='inspection'&&plan.some(d=>d.initiativeId===v.initiativeId))return {kind:'inspection',initiativeId:v.initiativeId as InitiativeId,...(DISTRICT_IDS.includes(v.districtId as DistrictId)?{districtId:v.districtId as DistrictId}:{}),...(typeof v.siteId==='string'&&v.siteId.length<=200?{siteId:v.siteId}:{})};
  if(v.kind==='book'&&['overview','review','council','registry','residents'].includes(String(v.section))){
   const page=v.residentPage as Record<string,unknown>|undefined,story=typeof v.storyId==='string'?stories.find(s=>s.id===v.storyId):null;
   const residentPage:ResidentBookPage=page?.page==='archive'?{page:'archive'}:page?.page==='appeal'?{page:'appeal',returnTo:page.returnTo==='archive'?'archive':'conversation'}:{page:'conversation'};
   return {kind:'book',section:v.section as AyaSection|'residents',residentPage,...(story?{storyId:story.id}:{})};
  }
  if(v.kind==='encounter'){
   const story=stories.find(s=>s.id===v.storyId),resident=typeof v.residentId==='string'?residents[v.residentId]:null;
   if(story)return {kind:'encounter',residentId:story.id,storyId:story.id,anchor:readEncounterAnchor(v.anchor,streetAnchor(story),story.visual.era==='khanate',story.initiativeId),talking:true};
   if(resident)return {kind:'encounter',residentId:resident.id,storyId:null,anchor:readEncounterAnchor(v.anchor,anchorFor(resident),resident.visual.era==='khanate'),talking:true};
  }
  return null;
 };
 try{const value:unknown=JSON.parse(raw??'null');if(!value||typeof value!=='object')return null;const v=value as Record<string,unknown>,view=readView(v.view);return view?{view,returnTo:readView(v.returnTo)}:null;}catch{return null;}
}
