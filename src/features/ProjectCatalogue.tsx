import {useContent} from '../modes/content';
import {useMemo,useState} from 'react';
import type {Dispatch} from 'react';
import type {Action,AppState} from '../app/state';
import {editingPlan} from '../app/state';
import type {PolicyArea} from '../domain/types';
import {ProjectGlyph} from './Gameplay';
import {projectAvailability} from './project-insight';
import {ProjectPreview} from '../world/ProjectPreview';

export const projectActions:Record<string,string>={M1:'Create bus lanes',M2:'Adjust traffic signals',M3:'Build LRT',M4:'Create a park',M5:'Switch to clean fuel',M6:'Plant trees',M7:'Build a school',M8:'Open a clinic',M9:'Build sports areas',M10:'Light the streets',M11:'Make crossings safer',M12:'Launch a resident request platform',M13:'Upgrade utilities',M14:'Strengthen emergency crews'};
export function ProjectCatalogue({state,dispatch}:{state:AppState;dispatch:Dispatch<Action>}) {
  const {mode,CATALOGUE,INITIATIVES,PROJECT_STORIES,areaNames,scopeName,terms}=useContent();
  const [area,setArea]=useState<PolicyArea|'all'>('all');
  const plan=editingPlan(state),replaces=state.candidate?.replaces??null;
  const availability=useMemo(()=>Object.fromEntries(CATALOGUE.map(item=>[item.id,projectAvailability(plan,item.id,state.focusedDistrict,replaces)])),[plan,state.focusedDistrict,replaces]);
  const reason=(id:typeof CATALOGUE[number]['id'])=>{
    const a=availability[id]!;
    if(a.elsewhere)return mode.id==='khanate'?'Available in another quarter':'Available in another district';
    if(a.available)return null;
    const issue=a.selected?.issues[0]??a.choices[0]?.issues[0];
    if(issue?.code==='budget')return `Short by ${issue.amount} ${terms.unit}`;
    if(issue?.code==='area_limit')return 'This policy area already has 2 decisions';
    if(issue?.code==='too_many')return 'First choose what to replace';
    if(issue?.code==='incompatible'){
      const partner=issue.relatedInitiativeId===id?issue.initiativeId:issue.relatedInitiativeId;
      return partner?`Conflicts with “${INITIATIVES[partner].name}”`:'Replace the conflicting project first';
    }
    if(issue?.code==='stranded')return 'Not enough for five decisions';
    return 'A plan replacement is needed';
  };
  return <section className="project-catalogue" aria-label="Project catalogue">
    <div className="catalogue-heading"><p>14 projects · price and location before confirmation</p><label className="sr-only" htmlFor="catalogue-area">Policy area</label><select id="catalogue-area" value={area} onChange={e=>setArea(e.target.value as PolicyArea|'all')}><option value="all">All areas</option>{Object.entries(areaNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div>
    <div className="project-list">{CATALOGUE.filter(item=>area==='all'||area===item.area).map(item=>{
      const chosen=state.plan.find(d=>d.initiativeId===item.id),held=state.candidate?.decision.initiativeId===item.id;
      const constraint=chosen?null:reason(item.id);
      const district=chosen?.scope==='district'?chosen.districtId:availability[item.id]?.selected?.districtId??availability[item.id]?.choices.find(c=>c.available)?.districtId??'esil';
      return <button className={`project-choice paper-card ${held?'selected':''}`} key={item.id} data-project={item.id} aria-pressed={held} onClick={()=>dispatch(chosen&&!state.alternative?{type:'selectCommitment',initiativeId:item.id}:{type:'choose',initiativeId:item.id})}>
        <ProjectPreview initiativeId={item.id} mode={mode.id} districtId={district} width={208} height={126} className="catalogue-preview paper-preview"/>
        <span className="catalogue-project-name"><ProjectGlyph id={item.id}/><strong>{item.name}</strong><b className="paper-price">{item.cost}<small>{terms.unit}</small></b></span>
        <span className="project-choice-benefit">{PROJECT_STORIES[item.id].benefit}</span><small className="catalogue-status">{chosen?`✓ In the plan · ${scopeName(chosen)}`:item.scope==='citywide'?(mode.id==='khanate'?'All five quarters':'All five districts'):areaNames[INITIATIVES[item.id].area]}{constraint&&<span className="project-choice-constraint">{constraint}</span>}</small>
      </button>;
    })}</div>
  </section>;
}
