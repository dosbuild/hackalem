import type {ResidentNarrative} from './narrative';
import type { AppState } from '../app/state';
import { BASELINE, SCENARIO_VERSION } from '../domain/scenario';
import type { CandidateDecision, DistrictId } from '../domain/types';
import { isCurrentResult, planFingerprint } from '../domain/identity';
import { RULES, PROPOSAL, COMMITTED, UNRESOLVED } from './rules';
import { FIRST_RESIDENT, RESIDENTS, RESIDENT_BY_ID } from './population';
import type { Anchor, AnchorKind, Activity, Line, Observation, Resident } from './types';

const labels:Record<AnchorKind,string> = {entrance:'Residential entrance',school:'School entrance',clinic:'Clinic entrance',stop:'Bus stop',crossing:'Crossing',garden:'Public space',service:'Service point'};
export function anchorFor(resident:Resident):Anchor {
  const kind = RULES[resident.primary].anchor;
  return {id:`${resident.location}:${kind}`,districtId:resident.location,kind,label:resident.visual.era==='khanate'?({entrance:'Yurt entrance',school:'Teaching courtyard',clinic:'Healers\' courtyard',stop:'Wagon road',crossing:'Ferry crossing',garden:'Shared garden',service:'Petition house'})[kind]:labels[kind],provisional:true};
}
export const planKey = planFingerprint;
export function branchKey(state:AppState):string { return `${SCENARIO_VERSION}/${state.revision}/${planKey(state.plan)}`; }
export function applies(d:CandidateDecision,district:DistrictId):boolean {return d.scope==='citywide'||d.districtId===district;}
export function hasCurrentResult(state:AppState):boolean {
  return isCurrentResult(state.plan,state.revision,state.result);
}
const cache = new WeakMap<AppState,Map<string,Observation>>();
const line=(kk:string,ru:string):Line=>({kk,ru});
export function observe(resident:Resident,state:AppState,context?:Anchor,narrative?:ResidentNarrative):Observation {
  const cacheKey=`${narrative?.id??'astana'}/${resident.id}@${context?.id??'default'}`;
  const hit=cache.get(state)?.get(cacheKey); if(hit)return hit;
  const rule={...RULES[resident.primary],...narrative?.rules[resident.primary]}, district=context?.districtId??resident.location, anchor=context??anchorFor(resident);
  const future=hasCurrentResult(state)&&state.comparisonPosition>=.5;
  const result=future?state.result!.value:null;
  const relevant=state.plan.filter(d=>applies(d,district));
  const contributions=result?[...result.measureContributions,...result.synergyContributions].filter(c=>c.districtId===district&&resident.concerns.includes(c.indicatorId)):[];
  const implemented = relevant.some(d=>d.initiativeId===resident.primary)&&contributions.some(c=>c.initiativeIds.includes(resident.primary)&&c.amount>0);
  const proposed = state.candidate?.decision.initiativeId===resident.primary&&applies(state.candidate.decision,district);
  const committed = relevant.some(d=>d.initiativeId===resident.primary);
  const secondary=RULES[resident.secondary];
  const secondaryAddressed=!!result&&secondary.indicators.some(k=>result.changes[district][k]>0);
  const critical=!!result&&resident.concerns.some(k=>result.indicators[district][k]<40);
  const negative=contributions.some(c=>c.amount<0);
  const partial=!!result&&rule.indicators.some(k=>result.changes[district][k]>0);
  const phase = future ? (implemented ? (negative||critical||!secondaryAddressed?'mixed':'changed') : partial?'mixed':'unchanged') : proposed?'proposal':committed?'committed':'baseline';
  const opening = future?(implemented?rule.changed:rule.unchanged):resident.action;
  const unresolved = secondaryAddressed
    ? narrative?.otherAddressed??line('The plan also addresses another issue. This scene does not mean everything is resolved.','The plan also addresses another issue. This scene does not mean everything is resolved.')
    : narrative?.unresolved[resident.secondary]??UNRESOLVED[resident.secondary];
  const answer = future ? negative
    ? narrative?.negative??line('The crossing is shown as safer, but traffic slows down. I see both sides of the change.','The crossing is shown as safer, but traffic slows down. I see both sides of the change.')
    : implemented ? rule.changed : partial
    ? narrative?.partial??line('Other initiatives affect the district. But the project for this location is not shown as completed.','Other initiatives affect the district. But the project for this location is not shown as completed.')
    : rule.unchanged
    : phase==='proposal'?(narrative?.proposal??PROPOSAL):phase==='committed'?(narrative?.committed??COMMITTED):rule.baseline;
  const indicators=resident.concerns.map(id=>({id,before:BASELINE[district][id],after:result?.indicators[district][id]??BASELINE[district][id],delta:result?.changes[district][id]??0,critical:result?result.indicators[district][id]<40:BASELINE[district][id]<40}));
  const observation:Observation={phase,opening,answer,unresolved,treatment:future&&implemented?resident.primary:null,
    relatedTreatments:result?relevant.filter(d=>RULES[d.initiativeId].anchor===anchor.kind&&result.measureContributions.some(c=>c.districtId===district&&c.initiativeIds.includes(d.initiativeId)&&c.amount>0)).map(d=>d.initiativeId):[],
    evidence:{scenarioVersion:SCENARIO_VERSION,revision:state.revision,branch:branchKey(state),resultId:result?.resultId??null,
      refs:result?resident.concerns.map(k=>`indicator:${district}:${k}`):[],districtId:district,anchorId:anchor.id,ruleId:`resident-${resident.primary}-${phase}-v1`,
      initiativeIds:[...new Set(contributions.flatMap(c=>c.initiativeIds))],contributions,indicators,calculated:!!result,illustration:rule.scene,limitation:rule.limitation}};
  let bucket=cache.get(state);if(!bucket){bucket=new Map();cache.set(state,bucket);}bucket.set(cacheKey,observation);
  return observation;
}

/** Same authored beat on every return. Scenario changes only supported actions/props. */
export function activityAt(resident:Resident,seconds:number,selected:boolean):Activity {
  if(selected&&seconds>=2&&seconds<3)return 'acknowledge';
  if(selected&&seconds>=3&&seconds<7)return 'respond';
  const total=resident.routine.reduce((n,s)=>n+s.seconds,0);
  let t=Math.max(0,seconds)%total;
  for(const step of resident.routine){if(t<step.seconds)return step.activity;t-=step.seconds;}
  return 'idle';
}
/** Bounded local choreography, not a journey simulation or a personal outcome prediction. */
export function illustratedBeat(resident:Resident,seconds:number,selected:boolean,observation:Observation):{activity:Activity;dx:number;dy:number} {
  const activity=activityAt(resident,seconds,selected);
  const t=Math.max(0,seconds)%14;
  const base={activity,dx:activity==='walk'?Math.round(Math.sin(seconds*1.3)*7):0,dy:0};
  if(!observation.treatment||t<7)return base;
  const progress=Math.min(1,(t-7)/3);
  switch(observation.treatment){
    case 'M4':case 'M9':return {activity:t<10?'walk':'exchange',dx:Math.round(32*progress),dy:0};
    case 'M1':case 'M3':return {activity:t<10?'walk':'wait',dx:Math.round(18*progress),dy:0};
    case 'M2':case 'M11':return {activity:t<11?'walk':'acknowledge',dx:0,dy:Math.round(35*progress)};
    case 'M7':case 'M8':return {activity:t<10?'walk':'handle',dx:Math.round(21*progress),dy:-Math.round(12*progress)};
    case 'M6':return {activity:'signature',dx:0,dy:0};
    case 'M10':return {activity:'handle',dx:-8,dy:-4};
    case 'M12':return {activity:'respond',dx:0,dy:0};
    case 'M13':return {activity:t<9?'handle':'walk',dx:Math.round(18*progress),dy:0};
    case 'M14':return {activity:'exchange',dx:12,dy:0};
    case 'M5':return {activity:'signature',dx:0,dy:0};
  }
}
export function nearby(resident:Resident,population:readonly Resident[]=RESIDENTS):Resident[] {
  const byId=Object.fromEntries(population.map(r=>[r.id,r]));
  const friends=resident.relationships.map(r=>byId[r.residentId]!).filter(r=>r&&r.location===resident.location);
  const locals=population.filter(r=>r.location===resident.location&&r.id!==resident.id&&anchorFor(r).kind===anchorFor(resident).kind);
  return [resident,...friends,...locals].filter((r,i,a)=>a.findIndex(x=>x.id===r.id)===i).slice(0,6);
}
export function discover(state:AppState,currentId:string|null,visited:readonly string[]):Resident {
  const candidate=state.candidate?.decision;
  const pool=[...RESIDENTS].sort((a,b)=>{
    const rank=(r:Resident)=> (visited.includes(r.id)?100:0)+(r.signature?-2:0)+(candidate&&r.primary===candidate.initiativeId&&applies(candidate,r.location)?-5:0)+(r.location===state.focusedDistrict?-1:0);
    return rank(a)-rank(b);
  });
  return pool.find(r=>r.id!==currentId&&!visited.includes(r.id))??pool.find(r=>r.id!==currentId)??FIRST_RESIDENT;
}
/** Include the familiar person, a trade-off/other perspective, and a supported unresolved condition. */
export function visitSequence(state:AppState,familiar:readonly string[]):Resident[] {
  if(!hasCurrentResult(state))return [];
  const future={...state,comparisonPosition:1};
  const known=familiar.map(id=>RESIDENT_BY_ID[id]).filter((r):r is Resident=>!!r);
  const improved=known.find(r=>observe(r,future).treatment)??RESIDENTS.find(r=>r.signature&&observe(r,future).treatment)??known[0]??FIRST_RESIDENT;
  const tradeoff=RESIDENTS.find(r=>r.signature&&r.id!==improved.id&&observe(r,future).evidence.contributions.some(c=>c.amount<0&&c.initiativeIds.includes(r.primary)))
    ??RESIDENTS.find(r=>r.signature&&r.id!==improved.id&&observe(r,future).evidence.contributions.some(c=>c.amount<0));
  const unresolved=RESIDENTS.find(r=>r.signature&&r.id!==improved.id&&r.id!==tradeoff?.id&&observe(r,future).evidence.indicators.some(i=>i.critical))
    ??RESIDENTS.find(r=>r.signature&&r.id!==improved.id&&r.id!==tradeoff?.id&&observe(r,future).phase==='unchanged');
  const other=tradeoff??RESIDENTS.find(r=>r.signature&&r.id!==improved.id&&r.id!==unresolved?.id&&r.location!==improved.location);
  return [improved,other,unresolved].filter((r):r is Resident=>!!r);
}

export interface EncounterMemory { version:1; bookmarks:string[]; branches:Record<string,string[]> }
export const emptyMemory=():EncounterMemory=>({version:1,bookmarks:[],branches:{}});
export function remember(memory:EncounterMemory,branch:string,id:string,population:Readonly<Record<string,unknown>>=RESIDENT_BY_ID):EncounterMemory {
  if(!population[id])return memory;
  const branches={...memory.branches,[branch]:[...new Set([...(memory.branches[branch]??[]),id])].slice(-100)};
  const keys=Object.keys(branches); for(const key of keys.slice(0,-12))delete branches[key];
  return {...memory,branches};
}
export function readMemory(raw:string|null,population:Readonly<Record<string,unknown>>=RESIDENT_BY_ID):EncounterMemory {
  try {const v:unknown=JSON.parse(raw??'null');if(v&&typeof v==='object'&&'version'in v&&v.version===1&&'bookmarks'in v&&Array.isArray(v.bookmarks))return {version:1,bookmarks:v.bookmarks.filter((id):id is string=>typeof id==='string'&&!!population[id]).slice(0,8),branches:{}};}catch{/* storage is optional */}
  return emptyMemory();
}
/** Optional asynchronous adapters must capture this ticket, and check it before displaying a reply. */
export function responseTicket(state:AppState,residentId:string):string {return `${branchKey(state)}/${state.comparisonPosition>=.5?'future':'present'}/${state.candidate?JSON.stringify(state.candidate):'none'}/${residentId}`;}
export function acceptsReply(ticket:string,state:AppState,residentId:string):boolean{return ticket===responseTicket(state,residentId);}
