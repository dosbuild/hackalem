import { AREA_IDS, DISTRICT_IDS, INITIATIVE_IDS } from './types';
import type { Decision, DraftValidation, InitiativeId, Plan, PlanSummary, PolicyArea, ValidationIssue } from './types';
import { INCOMPATIBILITIES, INITIATIVES, RULES } from './scenario';
import { freeze } from './immutable';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Accepts untrusted storage/UI input. Partial plans are valid, not errors. */
export function validateDraft(input: unknown): DraftValidation {
  if (!Array.isArray(input)) return { status:'invalid', issues:[{ code:'invalid_schema' }] };
  const issues: ValidationIssue[] = [];
  const plan: Decision[] = [];
  for (const entry of input as unknown[]) {
    if (!isRecord(entry)) { issues.push({ code:'invalid_schema' }); continue; }
    if (!INITIATIVE_IDS.includes(entry.initiativeId as InitiativeId)) { issues.push({ code:'unknown_initiative' }); continue; }
    const initiativeId = entry.initiativeId as InitiativeId;
    const initiative = INITIATIVES[initiativeId];
    if (entry.scope !== initiative.scope || (initiative.scope === 'citywide' && 'districtId' in entry)) {
      issues.push({ code:'invalid_scope', initiativeId }); continue;
    }
    if (initiative.scope === 'district' && !DISTRICT_IDS.includes(entry.districtId as typeof DISTRICT_IDS[number])) {
      issues.push({ code:'invalid_district', initiativeId }); continue;
    }
    const allowed = initiative.scope === 'district' ? ['scope','initiativeId','districtId'] : ['scope','initiativeId'];
    if (Object.keys(entry).some(key => !allowed.includes(key))) { issues.push({ code:'invalid_schema', initiativeId }); continue; }
    // Reconstruct after validation so callers cannot smuggle counters, scores, or mutable aliases.
    plan.push((initiative.scope === 'district'
      ? { initiativeId, scope:'district', districtId:entry.districtId }
      : { initiativeId, scope:'citywide' }) as Decision);
  }
  if (issues.length) return { status:'invalid', issues };
  const seen = new Set<InitiativeId>();
  for (const decision of plan) {
    if (seen.has(decision.initiativeId)) issues.push({ code:'duplicate', initiativeId:decision.initiativeId });
    seen.add(decision.initiativeId);
  }
  const summary = summarizePlan(plan);
  if (plan.length > RULES.decisionCount) issues.push({ code:'too_many', amount:plan.length });
  if (summary.spent > RULES.budget) issues.push({ code:'budget', amount:summary.spent - RULES.budget });
  for (const area of AREA_IDS) if (summary.areaCounts[area] > RULES.maxPerArea) issues.push({ code:'area_limit', area });
  for (const rule of INCOMPATIBILITIES) {
    const a = plan.find(d => d.initiativeId === rule.ids[0]);
    const b = plan.find(d => d.initiativeId === rule.ids[1]);
    if (a && b && (rule.scope === 'plan' || (a.scope === 'district' && b.scope === 'district' && a.districtId === b.districtId))) {
      issues.push({ code:'incompatible', initiativeId:a.initiativeId, relatedInitiativeId:b.initiativeId,
        ...(rule.scope === 'district' && a.scope === 'district' ? { districtId:a.districtId } : {}) });
    }
  }
  return issues.length ? { status:'invalid', issues } : { status:summary.canEvaluate ? 'complete' : 'partial', issues:[], plan:freeze(plan), summary };
}

/** For trusted, already validated plans; never store these derived counters. */
export function summarizePlan(plan: Plan): PlanSummary {
  const areaCounts = Object.fromEntries(AREA_IDS.map(area => [area,0])) as Record<PolicyArea, number>;
  let spent = 0;
  for (const d of plan) { spent += INITIATIVES[d.initiativeId].cost; areaCounts[INITIATIVES[d.initiativeId].area]++; }
  return { spent, remaining:RULES.budget - spent, count:plan.length, areaCounts, canEvaluate:plan.length === RULES.decisionCount };
}

export function validateCompletePlan(input: unknown): DraftValidation {
  // Keeping 'partial' explicit prevents treating an incomplete draft as a domain error.
  return validateDraft(input);
}

export type PlanEdit =
  | { kind:'add'; decision:unknown }
  | { kind:'replace'; target:InitiativeId; decision:unknown }
  | { kind:'move'; target:InitiativeId; districtId:unknown }
  | { kind:'remove'; target:InitiativeId };
export type EditOutcome = { accepted:true; plan:Plan } | { accepted:false; plan:Plan; issues:readonly ValidationIssue[] };

export function applyEdit(plan: Plan, edit: PlanEdit): EditOutcome {
  let proposed: unknown[];
  if (edit.kind === 'add') proposed = [...plan, edit.decision];
  else {
    const index = plan.findIndex(d => d.initiativeId === edit.target);
    if (index < 0) return { accepted:false, plan, issues:[{ code:'missing_target', initiativeId:edit.target }] };
    proposed = [...plan];
    if (edit.kind === 'remove') proposed.splice(index,1);
    else if (edit.kind === 'replace') proposed[index] = edit.decision;
    else proposed[index] = { ...plan[index], districtId:edit.districtId };
  }
  const validation = validateDraft(proposed);
  return validation.status === 'invalid' ? { accepted:false, plan, issues:validation.issues } : { accepted:true, plan:validation.plan };
}
