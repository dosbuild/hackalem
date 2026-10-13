import type {Construction} from '../app/construction';
import type {ChoreographySite} from './choreography';
import {createChoreography} from './choreography';
type Sequence=ReturnType<typeof createChoreography>;
export type ConstructionActivity=ReturnType<Sequence['sample']>&{id:string;key:string;elapsed:number};
export function sampleConstructionActivities(objects:readonly (ChoreographySite&{district:string;proposal?:boolean})[],receipts:readonly Construction[],now:number,options?:{quiet?:boolean;quietKeys?:Set<string>;cache?:Map<string,Sequence>}):Record<string,ConstructionActivity>;
