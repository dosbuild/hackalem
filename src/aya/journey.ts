import type {Resident} from '../residents/types';
import {useContent} from '../modes/content';
import {useEffect,useState} from 'react';
import {RESIDENT_BY_ID} from '../residents/population';
import {readMoments} from '../residents/moments';
import type {RememberedMoment} from '../residents/moments';
export const JOURNEY_KEY='akim:first-walk:v1';
export interface Journey {introduced:boolean;guidance:'guided'|'quiet';encountered:string[];returnId:string|null;moments:readonly RememberedMoment[]}
export const emptyJourney=():Journey=>({introduced:false,guidance:'guided',encountered:[],returnId:null,moments:[]});
export function readJourney(raw:string|null,residents:Readonly<Record<string,Resident>>=RESIDENT_BY_ID):Journey {try{const v=JSON.parse(raw??'null');if(!v||typeof v.introduced!=='boolean'||!['guided','quiet'].includes(v.guidance))return emptyJourney();return {introduced:v.introduced,guidance:v.guidance,encountered:Array.isArray(v.encountered)?v.encountered.filter((id:unknown)=>typeof id==='string'&&Object.hasOwn(residents,id)).slice(-100):[],returnId:typeof v.returnId==='string'&&Object.hasOwn(residents,v.returnId)?v.returnId:null,moments:readMoments(v.moments,residents)};}catch{return emptyJourney();}}
export function useJourney(){const {storage,RESIDENT_BY_ID}=useContent();const [journey,setJourney]=useState<Journey>(()=>{try{return readJourney(storage.getItem(JOURNEY_KEY),RESIDENT_BY_ID);}catch{return emptyJourney();}});
 useEffect(()=>{try{storage.setItem(JOURNEY_KEY,JSON.stringify(journey));}catch{/* Optional continuity, never a progression requirement. */}},[journey]);return {journey,setJourney};}
