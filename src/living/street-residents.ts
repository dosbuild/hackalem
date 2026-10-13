import type {LivingStory} from './appeals';
import type {Anchor,Resident} from '../residents/types';
import {RESIDENTS} from '../residents/population';
import {RULES} from '../residents/rules';
import {PROJECT_NAMES} from '../play/choices';

/** Presentation adapter: the authored person now inhabits the same geographic city. */
export function streetResident(story:LivingStory):Resident {
 const base=RESIDENTS.find(r=>r.name===story.name&&r.location===story.districtId)??RESIDENTS.find(r=>r.location===story.districtId)!;
 return {...base,id:story.id,name:story.name,role:story.role,home:story.districtId,location:story.districtId,visual:story.visual,primary:story.initiativeId,
  concerns:RULES[story.initiativeId].indicators,action:{kk:base.action.kk,ru:story.opening},relationships:[]};
}
export function streetAnchor(story:LivingStory):Anchor {
 return {id:`scenario:${story.initiativeId}:${story.districtId}`,districtId:story.districtId,kind:RULES[story.initiativeId].anchor,label:PROJECT_NAMES[story.initiativeId],provisional:true};
}
export function shortOpening(story:LivingStory):string {
 const sentences=story.opening.match(/[^.!?]+[.!?]+|[^.!?]+$/g)??[story.opening];
 let text=sentences[0]!.trim();
 if(sentences[1]&&text.length+sentences[1].length<150)text+=sentences[1];
 return text;
}
