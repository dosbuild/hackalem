import { DISTRICTS, INITIATIVES } from '../domain/scenario';
import type { Decision } from '../domain/types';
export const number=(value:number,digits=2)=>value.toLocaleString('ru-RU',{maximumFractionDigits:digits});
export const signed=(value:number)=>`${value>0?'+':''}${number(value)}`;
export const districtName=(id:string)=>DISTRICTS.find(d=>d.id===id)?.name??id;
export const decisionLabel=(decision:Decision)=>`${INITIATIVES[decision.initiativeId].name} · ${decision.scope==='citywide'?'Весь город':districtName(decision.districtId)}`;
export {indicatorNames,areaNames} from '../ui/copy';
