import {corePresentation} from './presentation';
import type {CorePresentation} from './presentation';
import type {Analysis,PlanReview} from '../dashboard/types';
import {number,signed} from '../dashboard/format';
export function localAnalysis(review:PlanReview,reason='unavailable',mode?:CorePresentation):Analysis {
 const {decisionLabel,districtName,seasons}=corePresentation(mode);
 const r=review.result;
 const best=[...review.moves].sort((a,b)=>b.contribution-a.contribution)[0]!;
 return {fingerprint:review.fingerprint,mode:'local',reason,
  strengths:[`План ${r.scoreChange>=0?'повышает':'снижает'} итоговый балл на ${number(Math.abs(r.scoreChange))} за восемь ${seasons}.`,`Наибольший вклад с учётом взаимодействий: ${decisionLabel(best.decision)} — ${signed(best.contribution)} балла.`],
  risks:[`Самый низкий результат в городе: ${r.weakestDistricts.map(districtName).join(', ')} — ${number(r.weakestValue)}.`,r.criticalPairs.length?`Ниже порога 40 остаются ${r.criticalPairs.length} показателя. Строительство не означает, что все обращения решены.`:'Критических значений ниже 40 не осталось; различия между частями города сохраняются.'],
  recommendations:review.swaps[0]?[`Сравните замену: ${decisionLabel(review.swaps[0].replace)} → ${decisionLabel(review.swaps[0].with)}. Ожидаемый прирост ${signed(review.swaps[0].gain)}.`,`Совет покажет, какое направление теряет от более высокого общего балла.`]:['Среди замен одного решения нет улучшения общего балла. Сравните распределение пользы по городу.','Вернитесь к жителям: общий балл не описывает каждую отдельную потребность.']};
}
