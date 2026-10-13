import {ControlIcon} from '../ui/ControlIcon';
import {useMode} from '../modes/context';
import { useEffect, useMemo, useState } from 'react';
import type { AppState } from '../app/state';
import { evaluatePlan } from '../domain/evaluate';
import { planFingerprint } from '../domain/identity';
import type { DistrictId, IndicatorId, InitiativeId, Plan } from '../domain/types';
import { useDashboardApi, errorText } from './api';
import { Comparison } from './Comparison';
import type { ComparisonValue } from './Comparison';
import { Council } from './Council';
import { Overview } from './Overview';
import { Registry } from './Registry';
import { Review } from './Review';
import type { PlanReview } from './types';
import './dashboard.css';
export type DashboardProps={state:AppState;onApplyPlan:(plan:Plan,expectedRevision:number)=>void;onNavigate:(space:'map'|'residents'|'dashboard',district?:DistrictId)=>void;onAskAya:(text:string)=>void;onDistrict:(district:DistrictId)=>void;onMeetNeed:(district:DistrictId,indicator:IndicatorId,initiative?:InitiativeId)=>void;onVisitProject:(id:InitiativeId)=>void;initialSection?:'overview'|'review'|'council'|'registry';onSectionChange?:(section:Tab)=>void};
type Tab='overview'|'review'|'council'|'registry';
const tabs:readonly [Tab,string,string][]=[['overview','Обзор','01'],['review','Разбор плана','02'],['council','Совет','03'],['registry','Реестр','04']];
function storedTab(storage:Pick<Storage,'getItem'>):Tab {try{const value=storage.getItem('alem.dashboard.tab');return tabs.some(([id])=>id===value)?value as Tab:'overview';}catch{return'overview';}}
export function Dashboard({state,onApplyPlan,onNavigate,onAskAya,onDistrict,onMeetNeed,onVisitProject,initialSection,onSectionChange}:DashboardProps) {
 const dashboardApi=useDashboardApi();
 const {mode,session}=useMode();
 const [tab,setTab]=useState<Tab>(()=>initialSection??storedTab(session)),[review,setReview]=useState<PlanReview|null>(null),[error,setError]=useState(''),[serial,setSerial]=useState(0),[comparison,setComparison]=useState<ComparisonValue|null>(null);
 const selectTab=(value:Tab)=>{setTab(value);onSectionChange?.(value);};
 const fingerprint=planFingerprint(state.plan),outcome=useMemo(()=>evaluatePlan(state.plan),[fingerprint]);
 const result=outcome.ok?outcome.result:null,currentReview=review?.fingerprint===fingerprint?review:null;
 useEffect(()=>{if(initialSection)setTab(initialSection);},[initialSection]);
 useEffect(()=>{const navigate=(event:Event)=>{const value=(event as CustomEvent).detail;if(tabs.some(([id])=>id===value))selectTab(value);};window.addEventListener('alem-dashboard-section',navigate);return()=>window.removeEventListener('alem-dashboard-section',navigate);},[]);
 useEffect(()=>{try{session.setItem('alem.dashboard.tab',tab);}catch{/* Navigation remains available without browser storage. */}},[tab]);
 useEffect(()=>{
  setError('');setReview(null);if(!result)return;
  const controller=new AbortController();dashboardApi<PlanReview>('review',{plan:result.plan},controller.signal).then(value=>{if(value.fingerprint===fingerprint)setReview(value);}).catch(reason=>{if(!controller.signal.aborted)setError(errorText(reason));});
  return()=>controller.abort();
 },[fingerprint,serial]);
 function compare(plan:Plan,title:string){setComparison({plan,original:state.plan,title,revision:state.revision});}
 return <main className="alem-dashboard paper-sheet" aria-label="Дашборд города"><div className="dash-shell"><header className="dash-topline"><div><span className="dash-brand">ВАШ ГОРОД ЧЕРЕЗ ДВА ГОДА</span></div><button onClick={()=>onNavigate('map')}>Вернуться в город<ControlIcon kind="arrow-back" size={18}/></button></header><nav className="dash-tabs" aria-label="Разделы дашборда">{tabs.map(([id,label,index])=><button key={id} aria-current={tab===id?'page':undefined} className={tab===id?'selected':''} onClick={()=>selectTab(id)}><span>{index}</span>{id==='registry'&&mode.id==='khanate'?'Книга города':label}{id==='council'&&result&&<i/>}</button>)}</nav>
 {error&&tab==='review'&&<div className="dash-notice dash-error" role="alert"><span>{error} Основные результаты ниже рассчитаны в приложении.</span><button onClick={()=>setSerial(s=>s+1)}>Повторить загрузку</button></div>}
 {result&&!currentReview&&!error&&tab==='review'&&<p className="dash-loading" role="status">Сопоставляем ваш план со всеми допустимыми вариантами…</p>}
 {tab==='overview'&&<Overview district={state.focusedDistrict??'nura'} onDistrict={onDistrict} plan={state.plan} result={result} review={currentReview} onNavigate={onNavigate} onAskAya={onAskAya} onReview={()=>selectTab('review')} onMeetNeed={onMeetNeed} onVisitProject={onVisitProject}/>}
 {tab==='review'&&(currentReview?<Review review={currentReview} onCompare={compare} onCouncil={()=>selectTab('council')} onAskAya={onAskAya}/>:<section className="dash-panel dash-empty"><h2>{result?'Готовим точное сравнение':'Разбор начинается с пяти решений'}</h2><p>{result?'Результат уже посчитан. Точный рейтинг и альтернативы появятся после точного расчёта.':'Ваши текущие решения сохранены. Ая подберёт самое сильное допустимое продолжение с учётом уже выбранного.'}</p><button className="dash-primary" onClick={()=>result?setSerial(s=>s+1):onAskAya('Доведи план')}>{result?'Повторить расчёт':'Ая, доведи план'}</button></section>)}
 {tab==='council'&&<Council plan={state.plan} complete={!!result} onCompare={compare} onAskAya={onAskAya}/>}
 {tab==='registry'&&<Registry plan={state.plan} complete={!!result} onCompare={compare}/>}
 <footer className="dash-footer"><span>{mode.id==='khanate'?'Летопись города у Есиля · 8 сезонов · 100 монет · 5 указов':'Учебная модель Астаны · 8 кварталов · 100 единиц · 5 решений'}</span><button onClick={()=>onAskAya('Помоги понять, что делать дальше с моим планом')}>Ая, что дальше?<ControlIcon kind="arrow-right" size={18}/></button></footer></div>{comparison&&<Comparison value={comparison} currentRevision={state.revision} onClose={()=>setComparison(null)} onApply={onApplyPlan}/>}</main>;
}
