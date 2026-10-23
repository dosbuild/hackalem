import {ControlIcon} from '../ui/ControlIcon';
import {useContent} from '../modes/content';
import type {DistrictId,IndicatorId,IndicatorEvidence,InitiativeId,ScenarioResult} from '../domain/types';
import {number, signed} from './format';
import {leadingProject, resultImpact} from './impact';

import {ResidentPortrait} from '../ui/ResidentPortrait';



export function ImpactSummary({result,onMeet}:{result:ScenarioResult;onMeet:(district:DistrictId,indicator:IndicatorId,initiative?:InitiativeId)=>void}) {
 const {mode,STORIES,PROJECT_STORIES,PROJECT_NAMES,districtName,indicatorNames}=useContent();
 const {highlight,remaining,decreased}=resultImpact(result);
 const contributor=highlight?leadingProject(highlight):null;
 const personFor=(entry:IndicatorEvidence)=>STORIES.find(s=>s.districtId===entry.districtId&&PROJECT_STORIES[s.initiativeId].indicator===entry.indicatorId)??STORIES.find(s=>s.districtId===entry.districtId)!;
 const helped=highlight?(contributor?STORIES.find(s=>s.districtId===highlight.districtId&&s.initiativeId===contributor):null)??personFor(highlight):null;
 const changed=contributor?mode.narrative?.rules[contributor].changed.ru:null;
 const waiting=personFor(remaining),funded=result.plan.some(d=>d.initiativeId===waiting.initiativeId&&(d.scope==='citywide'||d.districtId===waiting.districtId));
 const stillWaiting=!funded?mode.narrative?.unresolved[waiting.initiativeId].ru:null;
 return <section className="dash-impact-summary outcome-stories" aria-label="What changed for residents">
  {highlight&&helped&&<article><span className="dash-eyebrow">LIFE IMPROVED</span><header><ResidentPortrait visual={helped.visual} mood="happy"/><div><h3>{helped.name}</h3><small>{districtName(highlight.districtId)}{contributor&&<> · {PROJECT_NAMES[contributor]}</>}</small></div></header><p>{changed?`“${changed}”`:`Life improved: ${indicatorNames[highlight.indicatorId].toLocaleLowerCase('en-US')}.`}</p><div className="dash-impact-value"><span>{number(highlight.baseline)}</span><i>→</i><strong>{number(highlight.updated)}</strong><b>{signed(highlight.change)}</b></div><button onClick={()=>onMeet(highlight.districtId,highlight.indicatorId,contributor??undefined)}>Visit <ControlIcon kind="arrow-right" size={18}/></button></article>}
  <article><span className="dash-eyebrow">STILL NEEDS HELP</span><header><ResidentPortrait visual={waiting.visual} mood="thoughtful"/><div><h3>{waiting.name}</h3><small>{districtName(remaining.districtId)}</small></div></header>{stillWaiting&&<p>“{stillWaiting}”</p>}<p>{indicatorNames[remaining.indicatorId]} — the weakest point in the city.</p><div className="dash-impact-value"><strong>{number(remaining.updated)}</strong><span>/ 100</span>{remaining.change!==0&&<b>{signed(remaining.change)}</b>}</div><button onClick={()=>onMeet(remaining.districtId,remaining.indicatorId)}>Hear the story <ControlIcon kind="arrow-right" size={18}/></button></article>
  {decreased.length>0&&<p className="dash-impact-warning"><strong>Every trade-off has a cost.</strong> {decreased.map(e=>`${districtName(e.districtId)}: ${indicatorNames[e.indicatorId]} ${number(e.baseline)} → ${number(e.updated)}`).join('; ')}.</p>}
 </section>;
}
