import {corePresentation} from './presentation';
import type {CorePresentation} from './presentation';
import {members as historicalMembers,openings as historicalOpenings} from '../modes/khanate/council';
import { BASELINE_ASSESSMENT, evaluatePlan } from '../domain/evaluate';
import { planFingerprint } from '../domain/identity';
import { DISTRICTS, WEIGHTS } from '../domain/scenario';
import { INDICATOR_IDS } from '../domain/types';
import type { Plan, ScenarioResult } from '../domain/types';
import type { Amendment, CouncilEvent, CouncilSession, Member, MemberId, MetricImpact, PackageCheck, Vote } from '../dashboard/types';
import { number, signed } from '../dashboard/format';
import { allSwaps } from './review';

export const COUNCIL_RULES_VERSION='priorities-2';
export const MEMBERS:Member[]=[
 {id:'transport',name:'Daniyar',title:'Transport',initials:'D',focus:'Journeys to school and work'},
 {id:'environment',name:'Amina',title:'Environment',initials:'A',focus:'Clean air and green streets'},
 {id:'social',name:'Madina',title:'Social services',initials:'M',focus:'School places and access to healthcare'},
 {id:'safety',name:'Timur',title:'Safety',initials:'T',focus:'Safe neighbourhoods and crossings'},
 {id:'municipal',name:'Yerlan',title:'City services',initials:'Y',focus:'Reliable utilities and public feedback'},
 {id:'ombudsman',name:'Saule',title:'District ombudsman',initials:'S',focus:'Districts being left behind'},
 {id:'finance',name:'Ruslan',title:'Finance',initials:'R',focus:'Value from every budget unit'},
 {id:'chair',name:'Aliya',title:'Chair',initials:'A',focus:'Overall results and open disagreements'},
];
const roleIndicators:Record<string,string[]>= {transport:['T1','T2'],environment:['E1','E2'],social:['S1','S2'],safety:['B1','B2'],municipal:['C1','C2']};
export function councilMetrics(result:ScenarioResult):Record<MemberId,number> {
 const value={} as Record<MemberId,number>;
 for(const [role,keys] of Object.entries(roleIndicators))value[role as MemberId]=DISTRICTS.reduce((n,d)=>n+d.populationShare*INDICATOR_IDS.filter(k=>keys.includes(k)).reduce((v,k)=>v+WEIGHTS[k]*result.indicators[d.id][k],0),0);
 value.ombudsman=result.weakestValue-result.criticalPairs.length;
 value.finance=10*result.scoreChange/result.summary.spent;
 return value;
}
export function impacts(before:ScenarioResult,after:ScenarioResult):MetricImpact[] {
 const original=councilMetrics(before),next=councilMetrics(after);
 return (MEMBERS.filter(m=>m.id!=='chair') as (Member&{id:MemberId})[]).map(m=>({member:m.id,before:original[m.id],after:next[m.id],delta:next[m.id]-original[m.id]}));
}
export function votes(before:ScenarioResult,after:ScenarioResult):Vote[] {
 return impacts(before,after).map(impact=>{
  const newCritical=impact.member!=='finance'&&after.criticalPairs.some(pair=>(impact.member==='ombudsman'||roleIndicators[impact.member]?.includes(pair.indicatorId))&&before.indicators[pair.districtId][pair.indicatorId]>=40);
  const vote=newCritical||impact.delta<=-.1+1e-10?'against':impact.delta<-1e-10?'abstain':'for';
  return {...impact,vote,reason:newCritical?'A new indicator falls below 40.':vote==='against'?`The policy-area result falls by ${number(-impact.delta)}.`:vote==='abstain'?'A small decline; monitoring is needed.':impact.delta>1e-9?`The policy-area result rises by ${number(impact.delta)}.`:'The policy-area result is maintained.'};
 });
}
export function checkPackage(plan:Plan,amendments:Amendment[],ids:string[]):PackageCheck {
 const invalid=(reason:string):PackageCheck=>({valid:false,ids,reason,plan:null,score:null,cost:null,impacts:[],votes:[]});
 if(new Set(ids).size!==ids.length)return invalid('An amendment was selected more than once.');
 const changes=ids.map(id=>amendments.find(a=>a.id===id));if(changes.some(a=>!a))return invalid('Unknown amendment.');
 const selected=changes as Amendment[];
 if(new Set(selected.map(a=>a.replace.initiativeId)).size!==selected.length)return invalid('Two amendments replace the same decision. Choose one.');
 const candidate=plan.map(d=>selected.find(a=>a.replace.initiativeId===d.initiativeId)?.with??d);
 const before=evaluatePlan(plan),after=evaluatePlan(candidate);
 if(!before.ok||!after.ok)return invalid('Together, these amendments violate the budget, unique-decision rule, policy-area limit or site conflict rules. Choose another package.');
 return {valid:true,ids,reason:null,plan:after.result.plan,score:after.result.finalScore,cost:after.result.summary.spent,impacts:impacts(before.result,after.result),votes:votes(before.result,after.result)};
}
const openings:Record<MemberId,string>={
 transport:'Roads connect people to opportunities. I check whether getting to school and work becomes easier.',
 environment:'Green streets and clean air matter every day. A higher overall score must not hide environmental losses.',
 social:'Behind the indicators are families who need school places and medical appointments. These needs are not interchangeable.',
 safety:'I care about safe journeys, not just the number of facilities. I also consider negative effects on transport.',
 municipal:'The city must work on ordinary days and during emergencies. I check utilities and whether people can make themselves heard.',
 ombudsman:'The city average can rise while a district falls behind. My priorities are the weakest district and critical indicators.',
 finance:'There is no need to spend everything. I compare gains per budget unit, but saving money alone earns no points.',
};
/** Adapted hackathon council: distinct metric briefs, objections, revalidated packages and deterministic votes. */
export function buildCouncil(plan:Plan,id:string,createdAt:string,mode?:CorePresentation):CouncilSession {
 const {decisionLabel,unit,seasons}=corePresentation(mode);
 const members=mode?.id==='khanate'?historicalMembers:MEMBERS,voices=mode?.id==='khanate'?historicalOpenings:openings;
 const outcome=evaluatePlan(plan);if(!outcome.ok)throw new Error('invalid_plan');const original=outcome.result;
 const available=allSwaps(original.plan).map(s=>{const r=evaluatePlan(s.plan);if(!r.ok)throw new Error('invalid_swap');return{...s,impacts:impacts(original,r.result)};});
 const amendments:Amendment[]=[],events:CouncilEvent[]=[];
 const emit=(event:Omit<CouncilEvent,'seq'|'source'>)=>events.push({...event,seq:events.length+1,source:'local'});
 emit({type:'opening',member:'chair',text:`We will discuss five decisions costing ${original.summary.spent} ${unit}. The result after eight ${seasons} — ${number(original.finalScore)}. First we hear each position, then amendments and a vote. All participants are fictional roles in an educational council.`});
 for(const member of members.filter(m=>m.id!=='chair')) {
  const role=member.id as MemberId;
  // A council represents conflicting priorities, including alternatives to the
  // score optimum. Never suppress a district/sector gain merely for losing score.
  const candidate=available.filter(a=>a.impacts.find(i=>i.member===role)!.delta>1e-9).sort((a,b)=>b.impacts.find(i=>i.member===role)!.delta-a.impacts.find(i=>i.member===role)!.delta||b.gain-a.gain)[0];
  if(candidate&&!amendments.some(a=>a.id===candidate.id))amendments.push({...candidate,proposer:role});
  emit({type:'speech',member:role,text:`${voices[role]} ${candidate?`I propose: ${decisionLabel(candidate.replace)} → ${decisionLabel(candidate.with)}. Overall score ${signed(candidate.gain)}, plan cost ${candidate.cost} ${unit}${candidate.gain<0?' I propose giving up some overall score to improve my policy area. This loss must remain visible.':''}`:'No single-decision replacement improves my indicator. Let us preserve the gains.'}`,...(candidate?{amendmentId:candidate.id}:{})});
 }
 for(const a of amendments)emit({type:'amendment',member:a.proposer,text:`Amendment validated: ${decisionLabel(a.with)}. Score change ${signed(a.gain)}.`,amendmentId:a.id});
 const leader=[...amendments].sort((a,b)=>b.gain-a.gain)[0];
 if(leader){
  const opponents=leader.impacts.filter(i=>i.delta< -1e-9).sort((a,b)=>a.delta-b.delta);
  for(const opponent of opponents)emit({type:'objection',member:opponent.member,text:`I object to replacing “${decisionLabel(leader.replace)}”: my indicator changes from ${number(opponent.before)} to ${number(opponent.after)} (${signed(opponent.delta)}). The overall gain does not erase this loss.`,amendmentId:leader.id});
  if(opponents.length)emit({type:'response',member:leader.proposer,text:`The loss remains in the record. I propose this replacement for an overall gain of ${signed(leader.gain)}, but the plan author makes the final decision. Another package can be assembled.`,amendmentId:leader.id});
 }
 const packages:PackageCheck[]=[];
 // At most seven proposals: test every package, not merely each amendment in isolation.
 for(let mask=0;mask<2**amendments.length;mask++){const check=checkPackage(original.plan,amendments,amendments.filter((_,i)=>mask&(1<<i)).map(a=>a.id));if(check.valid)packages.push(check);}
 const majority=packages.filter(p=>p.votes.filter(v=>v.vote==='for').length>=4);
 const recommendation=[...majority].sort((a,b)=>b.score!-a.score!||a.ids.length-b.ids.length)[0]??checkPackage(original.plan,amendments,[]);
 emit({type:'package',member:'chair',text:`Valid packages checked: ${packages.length}. Recommended: ${recommendation.ids.length?`a package of ${recommendation.ids.length} amendments`:'the original plan'}: score ${number(recommendation.score!)}, cost ${recommendation.cost} ${unit}. A majority of at least four votes is required.`});
 for(const vote of recommendation.votes)emit({type:'vote',member:vote.member,text:`${vote.vote==='for'?'For':vote.vote==='against'?'Against':'Abstain'}. ${vote.reason}`});
 const against=recommendation.votes.filter(v=>v.vote==='against');
 const summary=`${recommendation.ids.length?'The council recommends the validated amendment package.':'The council recommends retaining the original plan.'} Score ${number(original.finalScore)} → ${number(recommendation.score!)}. In favour: ${recommendation.votes.filter(v=>v.vote==='for').length} of 7.${against.length?` Dissenting view: ${against.map(v=>members.find(m=>m.id===v.member)!.title).join(', ')}.`:''} Applying the changes is your decision.`;
 emit({type:'protocol',member:'chair',text:summary});emit({type:'closed',member:'chair',text:'Record saved. Revisit the discussion, compare the package or return to residents.'});
 return {...(mode?{worldMode:mode.id}:{}),rulesVersion:COUNCIL_RULES_VERSION,id,fingerprint:planFingerprint(original.plan),plan:original.plan,score:original.finalScore,createdAt,status:'complete',members,events,amendments,recommendation,summary,mode:'local',originalAssessment:original};
}
export const BASE_SCORE=BASELINE_ASSESSMENT.finalScore;
