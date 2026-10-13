import {useContent} from '../modes/content';
import {useMemo,useState} from 'react';
import type {Dispatch} from 'react';
import type {Action,AppState} from '../app/state';
import {editingPlan} from '../app/state';
import type {PolicyArea} from '../domain/types';
import {ProjectGlyph} from './Gameplay';
import {projectAvailability} from './project-insight';
import {ProjectPreview} from '../world/ProjectPreview';

export const projectActions:Record<string,string>={M1:'Выделить автобусные полосы',M2:'Настроить светофоры',M3:'Построить LRT',M4:'Создать парк',M5:'Перейти на чистое топливо',M6:'Высадить деревья',M7:'Построить школу',M8:'Открыть поликлинику',M9:'Оборудовать спортплощадки',M10:'Осветить улицы',M11:'Сделать переходы безопаснее',M12:'Запустить платформу обращений',M13:'Обновить сети',M14:'Усилить аварийные бригады'};
export function ProjectCatalogue({state,dispatch}:{state:AppState;dispatch:Dispatch<Action>}) {
  const {mode,CATALOGUE,INITIATIVES,PROJECT_STORIES,areaNames,scopeName,terms}=useContent();
  const [area,setArea]=useState<PolicyArea|'all'>('all');
  const plan=editingPlan(state),replaces=state.candidate?.replaces??null;
  const availability=useMemo(()=>Object.fromEntries(CATALOGUE.map(item=>[item.id,projectAvailability(plan,item.id,state.focusedDistrict,replaces)])),[plan,state.focusedDistrict,replaces]);
  const reason=(id:typeof CATALOGUE[number]['id'])=>{
    const a=availability[id]!;
    if(a.elsewhere)return mode.id==='khanate'?'Доступен в другом квартале':'Доступен в другом районе';
    if(a.available)return null;
    const issue=a.selected?.issues[0]??a.choices[0]?.issues[0];
    if(issue?.code==='budget')return `Не хватает ${issue.amount} ${terms.unit}`;
    if(issue?.code==='area_limit')return 'В этой сфере уже 2 решения';
    if(issue?.code==='too_many')return 'Сначала выберите, что заменить';
    if(issue?.code==='incompatible'){
      const partner=issue.relatedInitiativeId===id?issue.initiativeId:issue.relatedInitiativeId;
      return partner?`Несовместим с «${INITIATIVES[partner].name}»`:'Нужно заменить несовместимый проект';
    }
    if(issue?.code==='stranded')return 'Не хватит на пять решений';
    return 'Нужна замена в плане';
  };
  return <section className="project-catalogue" aria-label="Каталог проектов">
    <div className="catalogue-heading"><p>14 проектов · цена и место до подтверждения</p><label className="sr-only" htmlFor="catalogue-area">Сфера проекта</label><select id="catalogue-area" value={area} onChange={e=>setArea(e.target.value as PolicyArea|'all')}><option value="all">Все сферы</option>{Object.entries(areaNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div>
    <div className="project-list">{CATALOGUE.filter(item=>area==='all'||area===item.area).map(item=>{
      const chosen=state.plan.find(d=>d.initiativeId===item.id),held=state.candidate?.decision.initiativeId===item.id;
      const constraint=chosen?null:reason(item.id);
      const district=chosen?.scope==='district'?chosen.districtId:availability[item.id]?.selected?.districtId??availability[item.id]?.choices.find(c=>c.available)?.districtId??'esil';
      return <button className={`project-choice paper-card ${held?'selected':''}`} key={item.id} data-project={item.id} aria-pressed={held} onClick={()=>dispatch(chosen&&!state.alternative?{type:'selectCommitment',initiativeId:item.id}:{type:'choose',initiativeId:item.id})}>
        <ProjectPreview initiativeId={item.id} mode={mode.id} districtId={district} width={208} height={126} className="catalogue-preview paper-preview"/>
        <span className="catalogue-project-name"><ProjectGlyph id={item.id}/><strong>{item.name}</strong><b className="paper-price">{item.cost}<small>{terms.unit}</small></b></span>
        <span className="project-choice-benefit">{PROJECT_STORIES[item.id].benefit}</span><small className="catalogue-status">{chosen?`✓ В плане · ${scopeName(chosen)}`:item.scope==='citywide'?(mode.id==='khanate'?'Все пять кварталов':'Все пять районов'):areaNames[INITIATIVES[item.id].area]}{constraint&&<span className="project-choice-constraint">{constraint}</span>}</small>
      </button>;
    })}</div>
  </section>;
}
