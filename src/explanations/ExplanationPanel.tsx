import { useEffect, useState } from 'react';
import { httpExplanation } from './http';
import type { ScenarioResult } from '../domain/types';
import { localExplanation, requestExplanation, SECTIONS } from './explain';
import type { Explanation, ExplanationProvider } from './explain';
import { scenarioEvidence } from '../domain/evidence';
import { districtName, indicatorNames, format } from '../ui/copy';

const labels = { strengths:'Что улучшилось', risks:'Что остаётся проблемой', tradeoffs:'Компромиссы', calculation:'Почему получился этот результат' };
export function ExplanationPanel({result,provider=httpExplanation}:{result:ScenarioResult;provider?:ExplanationProvider}) {
  const [reply,setReply] = useState<Explanation|null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void requestExplanation(result,{provider,signal:controller.signal,timeoutMs:8500}).then(value => {
      if (current && !controller.signal.aborted && value.resultId === result.resultId) setReply(value);
    });
    return () => { current = false; controller.abort(); };
  },[result,provider]);
  const explanation = reply?.resultId === result.resultId ? reply : localExplanation(result);
  const pending = reply?.resultId !== result.resultId;
  const evidence = scenarioEvidence(result);
  const fields:Record<string,string> = {before:'Сейчас',after:'После реализации',change:'Изменение',beforeClipping:'До ограничения шкалы',clipping:'Поправка шкалы',city:'Городская средняя × 0,7',weakest:'Минимальный районный балл × 0,3',critical:'Изменение штрафа',budget:'Бюджет',spent:'Расход',remaining:'Остаток'};
  return <section aria-label="Объяснение расчёта" data-testid="scenario-explanation" data-result-id={result.resultId}>
    <p className="small" role="status">{pending
      ? 'Численный результат готов. Пока Ая уточняет акценты, показано локальное объяснение по формулам.'
      : explanation.mode === 'local'
      ? 'Локальное объяснение по формулам. Живое ИИ-объяснение недоступно; численный результат готов.'
      : 'ИИ выбрал акценты из проверенных фактов расчёта.'}</p>
    {SECTIONS.map(section => <div key={section}><h3>{labels[section]}</h3><ul>
      {explanation.statements.filter(s => s.section === section).map(s => <li key={s.id}>{s.text}
        <details><summary>Почему это показано?</summary>{s.refs.map(ref => {
          const fact=evidence.find(e => e.ref===ref)!;
          const label=fact.districtId ? `${districtName(fact.districtId)}${fact.indicatorId?` · ${indicatorNames[fact.indicatorId]}`:''}` : ref==='critical'?'Количество пар ниже 40':ref==='budget'?'Средства':ref==='score'?'Итоговый индекс':'Изменение слагаемых индекса';
          return <p className="small" key={ref} data-evidence-ref={ref}>{label}. {Object.entries(fact.values).map(([key,value]) => `${fields[key]??key}: ${format(value)}`).join('; ')}.</p>;
        })}<p className="small">Все значения относятся к текущему расчёту. Вклад меры указан до ограничения шкалы; изменение показателя — после него.</p></details>
      </li>)}
    </ul></div>)}
    <p className="small">Числа округлены для показа; расчёт использует полную точность. Синтетическая модель оценивает горизонт 8 кварталов. Свет и сцены жителей иллюстрируют результат; модель не предсказывает индивидуальное здоровье, время поездки или получение места в школе.</p>
  </section>;
}
