import type { CandidateProposal, DistrictId, InitiativeId, Plan, ScenarioResult } from '../domain/types';
import type { Construction } from '../app/construction';
import type { ModeId } from '../modes/types';

export type ProgramSelection = Readonly<{initiativeId:InitiativeId;districtId:DistrictId;siteId:string}>;
export type ProgramLocation = ProgramSelection & Readonly<{label:string;anchorId:string}>;

export type ScreenRect = Readonly<{left:number;top:number;right:number;bottom:number}>;

/** Repeated renders with the same id MUST NOT repeat a camera flight. */
export type CameraRequest = Readonly<{ id: number } & (
  { kind: 'overview' } | { kind: 'district'; districtId: DistrictId }
  | { kind: 'location'; districtId: DistrictId; anchorId: string }
)>;

/** The sole application → world boundary. No geometry, camera frames, or business rules. */
export interface WorldProps {
  /** Omitted only by legacy callers, which retain Astana semantics. */
  mode?:ModeId;
  construction?: readonly Construction[];
  /** Only an isolated paused demonstration freezes the shared event clock. */
  constructionNow?: number;
  onManualControl?: () => void;
  onOverview?: () => void;
  scenarioRevision?: number;
  occlusions?: readonly ScreenRect[];
  budgetPreview?: Readonly<{progress:number;blocked:boolean;cost:number;allocated:number}> | null;
  /** Matched two-year futures: retain camera, light and the shared actor clock. */
  comparisonSessionId?: string | null;
  heldInitiative?: InitiativeId | null;
  encounterRelation?: Readonly<{ anchorId:string; initiativeId:InitiativeId; relevant:boolean }> | null;
  districts: readonly Readonly<{ id: DistrictId; name: string }>[];
  focusedDistrict: DistrictId | null;
  selectedCommitment: InitiativeId | null;
  candidate: CandidateProposal | null;
  commitments: Plan;
  result: Readonly<{ revision: number; value: ScenarioResult }> | null;
  /** 0 = present, 1 = evaluated future; reveal position, never a time forecast. */
  comparisonPosition: number;
  cameraRequest: CameraRequest;
  onDistrictSelect: (districtId: DistrictId) => void;
  /** A program pick opens read-only inspection; editing remains an explicit UI action. */
  onProgramInspect?: (selection:ProgramSelection) => void;
  /** Cached semantic references only: application panels never load world geometry. */
  onProgramLocations?: (locations:readonly ProgramLocation[]) => void;
  onCommitmentSelect: (initiativeId: InitiativeId) => void;
  onStatus: (status: { kind: 'ready' } | { kind: 'failed'; message: string }) => void;
}
