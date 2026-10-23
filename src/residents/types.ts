import type { DistrictId, IndicatorId, InitiativeId, Contribution } from '../domain/types';

export type AnchorKind = 'entrance' | 'school' | 'clinic' | 'stop' | 'crossing' | 'garden' | 'service';
export type Activity = 'idle' | 'walk' | 'acknowledge' | 'wait' | 'handle' | 'exchange' | 'respond' | 'signature';
export type Prop = 'gloves' | 'watering-can' | 'satchel' | 'book' | 'thermos' | 'ball' | 'tote' | 'toolbox' | 'clipboard' | 'plant' | 'umbrella' | 'camera' | 'stroller' | 'cart' | 'headphones' | 'folder' | 'racket' | 'broom' | 'scarf' | 'bread';
export interface Visual {
  era?:'khanate';
  coat: string; accent: string; skin: string; hair: string;
  cut: 'long' | 'jacket' | 'vest' | 'wide'; head: 'short' | 'bob' | 'bun' | 'cap' | 'hood';
  build: 'small' | 'regular' | 'tall' | 'broad'; mobility: 'walk' | 'cane' | 'wheelchair'; prop: Prop;
}
export interface Line { kk: string; ru: string }
export interface Anchor { id: string; districtId: DistrictId; kind: AnchorKind; label: string; provisional: boolean }
export interface RoutineStep { activity: Activity; anchor: AnchorKind; seconds: number }
export interface Resident {
  id: string; name: string; age: 'teenager' | 'young adult' | 'adult' | 'older adult';
  synthetic: true; signature: boolean; home: DistrictId; location: DistrictId; role: string;
  visual: Visual; habit: string; action: Line; why: Line;
  primary: InitiativeId; secondary: InitiativeId; concerns: readonly IndicatorId[];
  relationships: readonly { residentId: string; kind: 'neighbours' | 'friends' | 'colleagues' | 'family' | 'meet here' }[];
  routine: readonly RoutineStep[];
}
export type ObservationPhase = 'baseline' | 'proposal' | 'committed' | 'changed' | 'unchanged' | 'mixed';
export interface Evidence {
  resultId: string | null; refs: readonly string[];
  scenarioVersion: string; revision: number; branch: string; districtId: DistrictId; anchorId: string;
  ruleId: string; initiativeIds: readonly InitiativeId[]; contributions: readonly Contribution[];
  indicators: readonly { id: IndicatorId; before: number; after: number; delta: number; critical: boolean }[];
  calculated: boolean; illustration: string; limitation: string;
}
export interface Observation {
  phase: ObservationPhase; opening: Line; answer: Line; unresolved: Line;
  treatment: InitiativeId | null; relatedTreatments: readonly InitiativeId[]; evidence: Evidence;
}
/** The map owns coordinates, camera and occlusion. No resident logic depends on geocodes. */
export interface ResidentWorldAdapter {
  focus: (anchor: Anchor, residentId: string, cameraRequestId:number) => void;
  show: (scene: ResidentScene) => void;
  subscribeSelection: (listener: (residentId: string) => void) => () => void;
  subscribeProjection?: (listener:(frame:import('../world/projection').ProjectionNotice|null)=>void)=>()=>void;
  annotationSize?: (size:{width:number;height:number}|null)=>void;
  clear: () => void;
}
export interface ResidentScene {
  moment?: Readonly<{ id:string; kind:'garden'|'drawing'|'dispatch'|'everyday'; interaction:number; treatments:readonly InitiativeId[] }>;
  selectedId: string | null; anchor: Anchor; residents: readonly Resident[];
  observation: Observation; phase: number; proposal: InitiativeId | null;
}
