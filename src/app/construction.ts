import type { Decision, Plan } from '../domain/types';
import {SCHOOL_BUILD_MS,PROJECT_BUILD_MS} from '../world/construction-clock.js';

export type Construction = Readonly<{ key:string; startedAt:number; durationMs:number }>;
export const decisionKey = (decision:Decision) => `${decision.initiativeId}:${decision.scope === 'citywide' ? 'city' : decision.districtId}`;
export const constructionDuration = (decision:Decision) => decision.initiativeId === 'M7' && decision.scope === 'district' && decision.districtId === 'nura' ? SCHOOL_BUILD_MS : PROJECT_BUILD_MS;

/** Receipts belong to the plan. Restoring or looking at a project never starts it again. */
export function reconcileConstruction(before:Plan, after:Plan, receipts:readonly Construction[], now:number):readonly Construction[] {
  return after.map(decision => {
    const key=decisionKey(decision), existing=receipts.find(receipt=>receipt.key===key);
    if (existing) return existing;
    const restored=before.some(item=>decisionKey(item)===key);
    return {key,startedAt:restored?0:now,durationMs:constructionDuration(decision)};
  });
}

export function constructionProgress(receipt:Construction, now:number) {
  return Math.max(0,Math.min(1,(now-receipt.startedAt)/receipt.durationMs));
}

export function readConstruction(input:unknown, plan:Plan):readonly Construction[] {
  if (!Array.isArray(input)) return reconcileConstruction(plan,plan,[],0);
  const keys=new Set(plan.map(decisionKey));
  const valid=input.filter((item):item is Construction=>!!item && keys.has(item.key) && Number.isFinite(item.startedAt) && item.startedAt>=0 && item.startedAt<=Date.now()+2000 && Number.isFinite(item.durationMs) && item.durationMs>0 && item.durationMs<20000);
  return reconcileConstruction(plan,plan,valid,0);
}
