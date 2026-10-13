export const DISTRICT_IDS = ['esil', 'almaty', 'saryarka', 'baikonur', 'nura'] as const;
export const AREA_IDS = ['transport', 'environment', 'social', 'safety', 'municipal'] as const;
export const INDICATOR_IDS = ['T1', 'T2', 'E1', 'E2', 'S1', 'S2', 'B1', 'B2', 'C1', 'C2'] as const;
export const INITIATIVE_IDS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12', 'M13', 'M14'] as const;
export type DistrictId = typeof DISTRICT_IDS[number];
export type PolicyArea = typeof AREA_IDS[number];
export type IndicatorId = typeof INDICATOR_IDS[number];
export type InitiativeId = typeof INITIATIVE_IDS[number];
export type CitywideInitiativeId = 'M2' | 'M6' | 'M12' | 'M14';
export type DistrictInitiativeId = Exclude<InitiativeId, CitywideInitiativeId>;
export type Indicators = Readonly<Record<IndicatorId, number>>;
export type IndicatorMatrix = Readonly<Record<DistrictId, Indicators>>;
export type Initiative = Readonly<{
  id: InitiativeId; name: string; area: PolicyArea; scope: 'district' | 'citywide';
  cost: number; lag: number; effects: Readonly<Partial<Record<IndicatorId, number>>>;
}>;
export type DistrictDecision = Readonly<{ scope: 'district'; initiativeId: DistrictInitiativeId; districtId: DistrictId }>;
export type CitywideDecision = Readonly<{ scope: 'citywide'; initiativeId: CitywideInitiativeId; districtId?: never }>;
export type Decision = DistrictDecision | CitywideDecision;
export type Plan = readonly Decision[];
export type CandidateDecision = CitywideDecision | Readonly<{ scope: 'district'; initiativeId: DistrictInitiativeId; districtId: DistrictId | null }>;
export type CandidateProposal = Readonly<{ decision: CandidateDecision; replaces: InitiativeId | null }>;
export type IssueCode = 'invalid_schema' | 'unknown_initiative' | 'invalid_scope' | 'invalid_district' |
  'duplicate' | 'too_many' | 'budget' | 'area_limit' | 'incompatible' | 'missing_target' | 'incomplete' | 'stranded' | 'stale';
export type ValidationIssue = Readonly<{
  code: IssueCode; initiativeId?: InitiativeId; relatedInitiativeId?: InitiativeId;
  districtId?: DistrictId; area?: PolicyArea; amount?: number;
}>;
export type PlanSummary = Readonly<{
  spent: number; remaining: number; count: number; areaCounts: Readonly<Record<PolicyArea, number>>;
  canEvaluate: boolean;
}>;
export type DraftValidation =
  | Readonly<{ status: 'partial' | 'complete'; plan: Plan; summary: PlanSummary; issues: readonly [] }>
  | Readonly<{ status: 'invalid'; issues: readonly ValidationIssue[] }>;
export type Contribution = Readonly<{
  districtId: DistrictId; indicatorId: IndicatorId; amount: number;
  initiativeIds: readonly InitiativeId[];
}>;
export type CriticalPair = Readonly<{ districtId: DistrictId; indicatorId: IndicatorId; value: number }>;
export type Assessment = Readonly<{
  districtScores: Readonly<Record<DistrictId, number>>; cityAverage: number;
  weakestDistricts: readonly DistrictId[]; criticalPairs: readonly CriticalPair[]; finalScore: number;
  weakestValue: number; components: ScoreComponents;
}>;
export type ScoreComponents = Readonly<{ city: number; weakest: number; critical: number }>;
export type IndicatorEvidence = Readonly<{
  ref: string; districtId: DistrictId; indicatorId: IndicatorId;
  baseline: number; beforeClipping: number; updated: number; change: number; clipping: number;
  measureEffects: readonly Contribution[]; synergies: readonly Contribution[];
}>;
export type ScenarioResult = Assessment & Readonly<{
  scenarioVersion: string; plan: Plan; indicators: IndicatorMatrix; changes: IndicatorMatrix;
  measureContributions: readonly Contribution[]; synergyContributions: readonly Contribution[];
  /** Exact canonical identity, not a lossy hash. References are scoped to this ID. */
  resultId: string; planFingerprint: string; summary: PlanSummary;
  baseline: IndicatorMatrix; baselineAssessment: Assessment;
  scoreChange: number; changeComponents: ScoreComponents;
  indicatorEvidence: readonly IndicatorEvidence[];
}>;
