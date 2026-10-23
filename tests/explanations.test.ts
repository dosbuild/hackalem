import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluatePlan } from '../src/domain/evaluate';
import { explanationStatements, requestExplanation } from '../src/explanations/explain';
import type { ExplanationRequest } from '../src/explanations/explain';
import { oracle } from './scenario-oracle';

const outcome = evaluatePlan(oracle.cases.negative.plan);
if (!outcome.ok) throw new Error('Invalid test fixture');
const result = outcome.result;
function response(request:ExplanationRequest) {
  const refs = new Set(request.statements.flatMap(s => s.refs));
  return { resultId:request.resultId,statementIds:request.statements.map(s => s.id),evidence:request.evidence.filter(e => refs.has(e.ref)).map(({ref,values}) => ({ref,values})) };
}
afterEach(() => vi.useRealTimers());
describe('bounded evidence-only explanation adapter',() => {
  it('publishes a truthful local explanation without a service',async () => {
    expect(await requestExplanation(result)).toMatchObject({mode:'local',reason:'unavailable',resultId:result.resultId});
    const facts = explanationStatements(result);
    expect(facts.some(s => s.id==='negative:almaty:T1' && s.text.includes('−')) || facts.some(s => s.id==='negative:almaty:T1' && s.text.includes('-1'))).toBe(true);
    expect(facts.filter(s => s.id.startsWith('critical:'))).toHaveLength(result.criticalPairs.length);
    expect(facts.find(s => s.id==='arithmetic')?.refs).toContain('score:components');
  });
  it('accepts a valid provider selection but renders only authoritative statements',async () => {
    const reply = await requestExplanation(result,{provider:async request => response(request)});
    expect(reply.mode).toBe('ai-selected');
    expect(reply.statements).toEqual(explanationStatements(result));
  });
  it.each(['identity','unknown','value','prose','omit-risk','duplicate'])('rejects unsupported provider output: %s',async fault => {
    const reply = await requestExplanation(result,{provider:async request => {
      const valid = response(request);
      if (fault==='identity') return {...valid,resultId:'old-result'};
      if (fault==='unknown') return {...valid,statementIds:['invented']};
      if (fault==='value') return {...valid,evidence:valid.evidence.map((e,i) => i ? e : {...e,values:{invented:999}})};
      if (fault==='prose') return {...valid,text:'Every child is guaranteed school admission.'};
      if (fault==='omit-risk') return {...valid,statementIds:valid.statementIds.filter(id => !id.startsWith('negative:'))};
      return {...valid,statementIds:[...valid.statementIds,valid.statementIds[0]]};
    }});
    expect(reply).toMatchObject({mode:'local',reason:'invalid_response'});
  });
  it('bounds a stalled provider even when it ignores cancellation',async () => {
    vi.useFakeTimers();
    let signal:AbortSignal|undefined;
    const pending = requestExplanation(result,{timeoutMs:40,provider:async (_,s) => { signal=s; return new Promise(() => {}); }});
    await vi.advanceTimersByTimeAsync(41);
    expect(await pending).toMatchObject({mode:'local',reason:'timeout'});
    expect(signal?.aborted).toBe(true);
  });
  it('cancels on revision/restart and cannot replace the resolved fallback with a late reply',async () => {
    const controller = new AbortController();
    let late:(value:unknown)=>void = () => {};
    const pending = requestExplanation(result,{signal:controller.signal,provider:async request => new Promise(resolve => {late=() => resolve(response(request));})});
    await Promise.resolve();
    controller.abort();
    const cancelled = await pending;
    expect(cancelled.reason).toBe('cancelled');
    late(null);
    expect(await pending).toBe(cancelled);
  });
  it('recovers synchronous provider failure and already-cancelled calls',async () => {
    expect((await requestExplanation(result,{provider:() => {throw new Error('offline');}})).reason).toBe('failed');
    const controller=new AbortController();controller.abort();
    const provider=vi.fn();
    expect((await requestExplanation(result,{signal:controller.signal,provider})).reason).toBe('cancelled');
    expect(provider).not.toHaveBeenCalled();
  });
});
