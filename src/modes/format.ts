import type {ModeId} from './types';
export function russianCount(amount:number,forms:readonly [string,string,string]){return Math.abs(amount)===1?forms[0]:forms[2];}
export const currencyUnit=(mode:ModeId,amount:number)=>mode==='khanate'?russianCount(amount,['coin','coins','coins']):'units';
