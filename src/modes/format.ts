import type {ModeId} from './types';
export function russianCount(amount:number,forms:readonly [string,string,string]){const n=Math.abs(amount),end=n%100;if(!Number.isInteger(n))return forms[1];return end>=11&&end<=14?forms[2]:n%10===1?forms[0]:n%10>=2&&n%10<=4?forms[1]:forms[2];}
export const currencyUnit=(mode:ModeId,amount:number)=>mode==='khanate'?russianCount(amount,['монета','монеты','монет']):'ед.';
