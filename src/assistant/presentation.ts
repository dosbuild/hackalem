import {currencyUnit} from '../modes/format';
import {CATALOGUE,DISTRICTS,INITIATIVES} from '../domain/scenario';
import type {DistrictId,InitiativeId} from '../domain/types';
import type {ModeId} from '../modes/types';
import {indicatorNames} from '../ui/copy';
import {PROJECT_STORIES} from '../features/project-insight';
import {khanateIdentity} from '../modes/khanate/identity';
export function assistantPresentation(mode:ModeId='astana'){
 const identity=mode==='khanate'?khanateIdentity:null;
 const districts=identity?.districts??DISTRICTS;
 const catalogue=CATALOGUE.map(p=>({...p,name:identity?.projects[p.id].name??p.name}));
 return {unitFor:(n:number)=>currencyUnit(mode,n),quarter:mode==='khanate'?'квартал':'район',quarterGen:mode==='khanate'?'квартала':'района',quarterPrep:mode==='khanate'?'квартале':'районе',quartersPrep:mode==='khanate'?'кварталах':'районах',quarters:mode==='khanate'?'кварталы':'районы',CATALOGUE:catalogue,DISTRICTS:districts,PROJECT_STORIES:identity?.projects??PROJECT_STORIES,indicatorNames:identity?.indicators??indicatorNames,unit:identity?.terms.unit??'ед.',seasons:identity?.terms.seasons??'кварталов',season:mode==='khanate'?'сезона':'квартала',districtName:(id:DistrictId|null)=>districts.find(d=>d.id===id)?.name??'весь город',projectName:(id:InitiativeId)=>identity?.projects[id].name??INITIATIVES[id].name};
}
