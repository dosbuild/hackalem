import {corePresentation} from './presentation';
import type {CorePresentation} from './presentation';
import type {Analysis,PlanReview} from '../dashboard/types';
import {number,signed} from '../dashboard/format';
export function localAnalysis(review:PlanReview,reason='unavailable',mode?:CorePresentation):Analysis {
 const {decisionLabel,districtName,seasons}=corePresentation(mode);
 const r=review.result;
 const best=[...review.moves].sort((a,b)=>b.contribution-a.contribution)[0]!;
 return {fingerprint:review.fingerprint,mode:'local',reason,
  strengths:[`The plan ${r.scoreChange>=0?'raises':'lowers'} the final score by ${number(Math.abs(r.scoreChange))} over eight ${seasons}.`,`Largest contribution, including interactions: ${decisionLabel(best.decision)} — ${signed(best.contribution)} points.`],
  risks:[`Lowest result in the city: ${r.weakestDistricts.map(districtName).join(', ')} — ${number(r.weakestValue)}.`,r.criticalPairs.length?`Indicators remaining below 40: ${r.criticalPairs.length}. Building projects does not mean every request has been resolved.`:'No critical values remain below 40; differences between parts of the city remain.'],
  recommendations:review.swaps[0]?[`Compare this replacement: ${decisionLabel(review.swaps[0].replace)} → ${decisionLabel(review.swaps[0].with)}. Expected gain ${signed(review.swaps[0].gain)}.`,`The council shows which policy area loses out when the overall score rises.`]:['No single-decision replacement improves the overall score. Compare how benefits are distributed across the city.','Return to the residents: the overall score cannot describe every individual need.']};
}
