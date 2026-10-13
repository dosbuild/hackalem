import type {InitiativeId} from '../domain/types';
import type {Line} from './types';
export interface ResidentNarrative {
 id:string;
 rules:Readonly<Record<InitiativeId,{baseline:Line;changed:Line;unchanged:Line;scene:string;limitation:string}>>;
 unresolved:Readonly<Record<InitiativeId,Line>>;
 proposal:Line;committed:Line;otherAddressed:Line;negative:Line;partial:Line;
}
