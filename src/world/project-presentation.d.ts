import type {DistrictId,InitiativeId,IndicatorEvidence,ScenarioResult} from '../domain/types';
import type {WorldProps} from './contract';
export type ProjectPresentation=Readonly<{phase:'preview'|'baseline'|'planned'|'evaluated';evidence:readonly IndicatorEvidence[];resultId:string|null}>;
export function currentPresentationResult(props:Pick<WorldProps,'commitments'|'result'> & Partial<Pick<WorldProps,'scenarioRevision'>>):ScenarioResult|null;
export function projectPresentation(props:Pick<WorldProps,'commitments'|'result'> & Partial<Pick<WorldProps,'scenarioRevision'|'comparisonPosition'>>,initiativeId:InitiativeId,districtId:DistrictId,proposal?:boolean):ProjectPresentation;
