import type { ScenarioResult } from '../domain/types';
import { scenarioEvidence } from '../domain/evidence';
import { freeze } from '../domain/immutable';
import { districtName, indicatorNames, signed, format } from '../ui/copy';

export const SECTIONS = ['strengths','risks','tradeoffs','calculation'] as const;
export type ExplanationSection = typeof SECTIONS[number];
export type Statement = Readonly<{ id:string; section:ExplanationSection; text:string; refs:readonly string[] }>;
export type Explanation = Readonly<{
  resultId:string; mode:'local'|'ai-selected'; reason:'unavailable'|'timeout'|'invalid_response'|'failed'|'cancelled'|null;
  statements:readonly Statement[];
}>;

/** Authored statements with calculated fields. Never presented as a live LLM response. */
export function explanationStatements(r:ScenarioResult):readonly Statement[] {
  const statements:Statement[] = [];
  const add = (id:string, section:ExplanationSection, text:string, refs:string[]) => statements.push({id,section,text,refs});
  const gains = [...r.indicatorEvidence].filter(e => e.change > 0).sort((a,b) => b.change-a.change);
  for (const e of gains.slice(0,3)) add(`gain:${e.districtId}:${e.indicatorId}`,'strengths',
    `${districtName(e.districtId)} · ${indicatorNames[e.indicatorId]}: ${format(e.baseline)} → ${format(e.updated)} (${signed(e.change)}).`,[e.ref]);
  for (const c of r.criticalPairs) add(`critical:${c.districtId}:${c.indicatorId}`,'risks',
    `${districtName(c.districtId)} · ${indicatorNames[c.indicatorId]}: ${format(c.value)}, строго ниже 40. Эта пара даёт штраф 1 балл.`,[`indicator:${c.districtId}:${c.indicatorId}`,'critical']);
  if (!r.criticalPairs.length) add('no-critical','risks','Показателей строго ниже 40 не осталось. Это не означает, что все потребности жителей удовлетворены.',['critical']);
  const unchanged = [...r.indicatorEvidence].filter(e => e.change === 0).sort((a,b) => a.updated-b.updated)[0];
  if (unchanged) add('unchanged','risks',`${districtName(unchanged.districtId)} · ${indicatorNames[unchanged.indicatorId]} остаётся ${format(unchanged.updated)}: выбранный план не меняет этот показатель.`,[unchanged.ref]);
  for (const c of r.measureContributions.filter(c => c.amount < 0)) {
    add(`negative:${c.districtId}:${c.indicatorId}`,'tradeoffs',
      `${c.initiativeIds.join(' + ')} · ${districtName(c.districtId)}: вклад в «${indicatorNames[c.indicatorId]}» до ограничения шкалы ${signed(c.amount)}. Итог с учётом всех мер: ${signed(r.changes[c.districtId][c.indicatorId])}. Все показатели устроены так: больше — лучше.`,
      [`measure:${c.initiativeIds[0]}:${c.districtId}:${c.indicatorId}`,`indicator:${c.districtId}:${c.indicatorId}`]);
  }
  add('budget','tradeoffs',`Потрачено ${r.summary.spent} из 100 единиц. Остаток ${r.summary.remaining} не даёт бонуса. Каждый проект занимает одно из пяти решений; перенос охвата может оставить другую задачу без изменения.`,['budget']);
  add('arithmetic','calculation',`Изменение индекса ${signed(r.scoreChange)} складывается из изменения городской средней (${signed(r.changeComponents.city)}), минимального районного балла (${signed(r.changeComponents.weakest)}) и штрафа за критические пары (${signed(r.changeComponents.critical)}).`,['score','score:components','critical']);
  add('weakest','calculation',`Минимальный районный балл: ${format(r.baselineAssessment.weakestValue)} (${r.baselineAssessment.weakestDistricts.map(districtName).join(', ')}) → ${format(r.weakestValue)} (${r.weakestDistricts.map(districtName).join(', ')}). Это минимум по всем районам, а не постоянный выбор одного района.`,[...new Set([...r.baselineAssessment.weakestDistricts,...r.weakestDistricts])].map(d => `district:${d}`));
  return freeze(statements);
}

export const localExplanation = (r:ScenarioResult, reason:Explanation['reason'] = 'unavailable'):Explanation =>
  freeze({ resultId:r.resultId, mode:'local', reason, statements:explanationStatements(r) });

export type ExplanationRequest = Readonly<{
  resultId:string; scenario:ScenarioResult; evidence:ReturnType<typeof scenarioEvidence>;
  statements:readonly Statement[]; instructions:string;
}>;
/** Inject only through an existing trusted service boundary. No provider key belongs in the browser. */
export type ExplanationProvider = (request:ExplanationRequest, signal:AbortSignal) => Promise<unknown>;

// Deliberately constrained output: the model selects/order facts, never supplies authoritative numbers
// or unchecked prose. This is an AI editorial adapter, not a claim of live free-form generation.
function validateResponse(raw:unknown, request:ExplanationRequest):readonly Statement[]|null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string,unknown>;
  if (Object.keys(value).some(k => !['resultId','statementIds','evidence'].includes(k)) || value.resultId !== request.resultId
    || !Array.isArray(value.statementIds) || !value.statementIds.length || value.statementIds.length > request.statements.length
    || new Set(value.statementIds).size !== value.statementIds.length || !Array.isArray(value.evidence)) return null;
  const selected:Statement[] = [];
  for (const id of value.statementIds) {
    const statement = request.statements.find(s => s.id === id);
    if (!statement) return null;
    selected.push(statement);
  }
  if (SECTIONS.some(section => !selected.some(s => s.section === section))) return null;
  // Always retain material critical conditions and negative project effects.
  if (request.statements.some(s => (s.id.startsWith('critical:') || s.id.startsWith('negative:')) && !selected.includes(s))) return null;
  const refs = [...new Set(selected.flatMap(s => s.refs))];
  if (value.evidence.length !== refs.length) return null;
  for (const ref of refs) {
    const matches = value.evidence.filter(e => !!e && typeof e === 'object' && (e as Record<string,unknown>).ref === ref);
    if (matches.length !== 1) return null;
    const claimed = matches[0] as Record<string,unknown>, fact = request.evidence.find(e => e.ref === ref)!;
    if (Object.keys(claimed).some(k => !['ref','values'].includes(k)) || !claimed.values || typeof claimed.values !== 'object') return null;
    const values = claimed.values as Record<string,unknown>;
    if (Object.keys(values).length !== Object.keys(fact.values).length || Object.entries(fact.values).some(([k,v]) => values[k] !== v)) return null;
  }
  return selected;
}

export async function requestExplanation(r:ScenarioResult, options:{ provider?:ExplanationProvider; signal?:AbortSignal; timeoutMs?:number } = {}):Promise<Explanation> {
  if (options.signal?.aborted) return localExplanation(r,'cancelled');
  if (!options.provider) return localExplanation(r);
  const request:ExplanationRequest = freeze({ resultId:r.resultId, scenario:r, evidence:scenarioEvidence(r), statements:explanationStatements(r),
    instructions:'Select and order statementIds to explain strengths, risks, tradeoffs and calculation. Include all critical and negative statements. Return only resultId, statementIds, and evidence: [{ref, values}] copying the exact referenced values. Do not calculate, invent numbers or write additional prose. The scenario is synthetic; visual scenes are authored illustrations, not individual predictions.' });
  const controller = new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  let cancel:()=>void = () => {};
  const reason = await Promise.race([
    new Promise<Explanation>(resolve => {
      cancel = () => { controller.abort(); resolve(localExplanation(r,'cancelled')); };
      options.signal?.addEventListener('abort',cancel,{once:true});
      const requested = options.timeoutMs ?? 5000;
      timer = setTimeout(() => { controller.abort(); resolve(localExplanation(r,'timeout')); },Number.isFinite(requested) ? Math.max(1,Math.min(requested,10000)) : 5000);
    }),
    Promise.resolve().then(() => options.provider!(request,controller.signal)).then(raw => {
      const selected = validateResponse(raw,request);
      return selected ? freeze({ resultId:r.resultId, mode:'ai-selected' as const, reason:null, statements:selected }) : localExplanation(r,'invalid_response');
    }).catch(() => localExplanation(r,'failed')),
  ]);
  clearTimeout(timer);
  options.signal?.removeEventListener('abort',cancel);
  return reason;
}
