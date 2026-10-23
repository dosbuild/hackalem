import {createChoreography,OVERVIEW} from './choreography.js';
import {sampleConstructionActivities as sample} from './construction-sampler.js';
export function sampleConstructionActivities(objects,receipts,now,options={}){return sample(objects,receipts,now,{createChoreography,overview:OVERVIEW,...options});}
