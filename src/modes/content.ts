import {INITIATIVES} from '../domain/scenario';
import {INITIATIVE_IDS} from '../domain/types';
import type {InitiativeId} from '../domain/types';
import type {ModeDefinition} from './types';
import {useMode} from './context';
import {currencyUnit} from './format';

/** A presentation view of canonical initiatives; arithmetic never reads this view. */
export function contentFor(mode:ModeDefinition){
 const field=(key:'shortName'|'shortNeed'|'shortLimit'|'action'|'limitation')=>Object.fromEntries(INITIATIVE_IDS.map(id=>[id,mode.projects[id][key]])) as Record<InitiativeId,string>;
 const initiatives=Object.fromEntries(INITIATIVE_IDS.map(id=>[id,{...INITIATIVES[id],name:mode.projects[id].name}])) as typeof INITIATIVES;
 const unitFor=(amount:number)=>currencyUnit(mode.id,amount);
 return {unitFor,INITIATIVES:initiatives,CATALOGUE:INITIATIVE_IDS.map(id=>initiatives[id]),DISTRICTS:mode.districts,STORIES:mode.stories,APPEALS:mode.appeals,RESIDENTS:mode.residents,RESIDENT_BY_ID:Object.fromEntries(mode.residents.map(r=>[r.id,r])),PROJECT_STORIES:mode.projects,PROJECT_NAMES:field('shortName'),SHORT_NEEDS:field('shortNeed'),SHORT_LIMITS:field('shortLimit'),projectActions:field('action'),LIMITS:field('limitation'),areaNames:mode.areas,indicatorNames:mode.indicators,text:mode.copy,terms:mode.terms};
}
export function useContent(){const value=useMode();return {...value,...value.content,...value.presentation};}
