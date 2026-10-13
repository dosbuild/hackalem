import { describe,it,expect,vi } from 'vitest';
import { evaluatePlan } from '../../src/domain/evaluate';
import { reviewPlan, shapleyContributions, getLandscape, rankOf } from '../../server/dashboard/review';
import { buildCouncil, checkPackage, MEMBERS } from '../../server/dashboard/council';
import {createAnalysisService} from '../../server/dashboard/analysis';
import { fixture } from '../fixtures';

describe('exact dashboard review',()=>{
 it('attributes the complete score change and compares exact rank and optimum',()=>{
  const review=reviewPlan(fixture);
  expect(review.total).toBe(694395);
  expect(review.histogram.reduce((n,b)=>n+b.count,0)).toBe(review.total);
  expect(shapleyContributions(fixture).reduce((n,v)=>n+v,0)).toBeCloseTo(review.result.scoreChange,11);
  const optimum=evaluatePlan(review.optimum.plan);expect(optimum.ok).toBe(true);if(optimum.ok)expect(review.optimum.score).toBe(optimum.result.finalScore);
  expect(rankOf(review.optimum.score)).toBe(1);
  expect(rankOf(getLandscape().scores[0]!)).toBeGreaterThan(690000);
  expect(review.percentile).toBeGreaterThanOrEqual(0);expect(review.percentile).toBeLessThanOrEqual(100);
  for(const swap of review.swaps){const evaluated=evaluatePlan(swap.plan);expect(evaluated.ok).toBe(true);if(evaluated.ok)expect(swap.score).toBeCloseTo(evaluated.result.finalScore,12);}
 },15000);
 it('runs eight distinct voices, objections, a valid majority package and a protocol',()=>{
  const council=buildCouncil(fixture,'test-session','2026-09-28T12:00:00Z');
  expect(MEMBERS).toHaveLength(8);
  expect(new Set(council.events.filter(e=>e.type==='speech').map(e=>e.member)).size).toBe(7);
  expect(council.events.filter(e=>e.type==='objection').length).toBeGreaterThan(0);
  expect(council.recommendation.valid).toBe(true);
  expect(council.recommendation.votes).toHaveLength(7);
  expect(council.recommendation.votes.filter(v=>v.vote==='for').length).toBeGreaterThanOrEqual(4);
  expect(council.events.at(-1)?.type).toBe('closed');
  expect(council.plan).toEqual(reviewPlan(fixture).result.plan);
  expect(council.recommendation.score).toBeGreaterThanOrEqual(council.score);
 });
 it('checks combined changes against the original plan and rejects unknown/duplicate replacements',()=>{
  const council=buildCouncil(fixture,'test-session','2026-09-28T12:00:00Z');
  expect(checkPackage(council.plan,council.amendments,['unknown']).valid).toBe(false);
  const amendment=council.amendments[0]!;
  expect(checkPackage(council.plan,council.amendments,[amendment.id,amendment.id]).valid).toBe(false);
  expect(checkPackage(council.plan,council.amendments,[]).score).toBe(council.score);
  const same=[...council.amendments,{...amendment,id:'different'}];
  expect(checkPackage(council.plan,same,[amendment.id,'different']).reason).toContain('одно решение');
 });
 it('still challenges the overall optimum through different priorities',()=>{
  const council=buildCouncil(getLandscape().optimum.plan,'optimal-session','2026-09-28T12:00:00Z');
  expect(council.amendments.length).toBeGreaterThan(0);
  expect(council.amendments.some(a=>a.gain<0)).toBe(true);
  for(const amendment of council.amendments)expect(amendment.impacts.find(i=>i.member===amendment.proposer)!.delta).toBeGreaterThan(0);
  expect(council.recommendation.score).toBeCloseTo(council.score,10);
 });
 it('recovers analysis after a provider ignores timeout without caching its late reply',async()=>{
  const review=reviewPlan(fixture);
  const response=(strength:string)=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({strengths:[strength],risks:['Остаются неудовлетворённые потребности.'],recommendations:['Сравните распределение пользы по городу.']})}]}]});
  vi.useFakeTimers();
  try{
   let release:(value:Response)=>void=()=>{},calls=0;
   const service=createAnalysisService({apiKey:'test',timeoutMs:25,fetchImpl:async()=>++calls===1?new Promise<Response>(resolve=>{release=resolve;}):response('Свежий ответ учитывает текущий план.')});
   const waiting=service(review);await vi.advanceTimersByTimeAsync(25);
   expect(await waiting).toMatchObject({mode:'local',reason:'timeout'});
   release(response('Старый ответ больше не актуален.'));await vi.advanceTimersByTimeAsync(0);
   expect(await service(review)).toMatchObject({mode:'ai',strengths:['Свежий ответ учитывает текущий план.']});
   expect(calls).toBe(2);
  }finally{vi.useRealTimers();}
 });
});
