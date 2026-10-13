import {ControlIcon} from '../ui/ControlIcon';
import {STATIC_BUILD} from '../services/environment';
import {useContent} from '../modes/content';
import {useDecisionLabel} from './useFormat';
import {useEffect, useState} from 'react';
import type { Plan } from '../domain/types';
import {planFingerprint} from '../domain/identity';
import {useDashboardApi, errorText} from './api';
import {number} from './format';
import type { RegistryEntry } from './types';
export function Registry({plan,complete,onCompare}:{plan:Plan;complete:boolean;onCompare:(plan:Plan,title:string)=>void}) {
 const decisionLabel=useDecisionLabel();
 const {mode,unitFor}=useContent();
 const dashboardApi=useDashboardApi();
 const [entries,setEntries]=useState<RegistryEntry[]>([]),[team,setTeam]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[submitted,setSubmitted]=useState<RegistryEntry|null>(null),[serial,setSerial]=useState(0);
 useEffect(()=>{const abort=new AbortController();setLoading(true);setError('');dashboardApi<{entries:RegistryEntry[]}>('registry',undefined,abort.signal).then(data=>{setEntries(data.entries);setLoading(false);}).catch(reason=>{if(!abort.signal.aborted){setError(errorText(reason));setLoading(false);}});return()=>abort.abort();},[serial]);
 async function submit(event:React.FormEvent){event.preventDefault();if(busy||!complete)return;setBusy(true);setError('');try{const entry=await dashboardApi<RegistryEntry>('registry',{plan,team,confirmed:true});setSubmitted(entry);setSerial(s=>s+1);}catch(reason){setError(errorText(reason));}finally{setBusy(false);}}
 const fingerprint=planFingerprint(plan);
 return <><section className="dash-review-lead"><div><p className="dash-eyebrow">{STATIC_BUILD?'КНИГА ЭТОГО БРАУЗЕРА':'ОТКРЫТЫЙ РЕЕСТР ПЛАНОВ'}</p><h2>{mode.id==='khanate'?'Сохранить главу в книге города':'Город, который предложила ваша команда'}</h2><p>{STATIC_BUILD?'Дайте название этой попытке. Пять решений и их результат сохранятся в вашем браузере.':'Сохраните результат под названием команды. Решения и балл останутся в реестре этого сервера после обновления страницы.'}</p></div></section>
  <section className="dash-panel dash-submit paper-card"><div><h3>Отправить текущий план</h3><p>{complete?(STATIC_BUILD?'Сохраняется снимок пяти решений. Новые указы или проекты не перепишут эту страницу.':'Публикуется снимок этих пяти решений. Дальнейшие изменения вашего плана не перепишут запись.'):'Сначала завершите пять решений. Реестр уже можно изучить.'}</p></div><form onSubmit={submit}><label htmlFor="dashboard-team">Название команды</label><div><input id="dashboard-team" maxLength={60} minLength={2} required value={team} onChange={e=>setTeam(e.target.value)} placeholder="Например, Соседи Нуры" autoComplete="organization"/><button className="dash-primary" disabled={!complete||busy||team.trim().length<2}>{busy?'Сохраняем…':STATIC_BUILD?'Сохранить в книге':'Отправить в реестр'}{!busy&&<ControlIcon kind="arrow-right" size={18}/>}</button></div><small>{STATIC_BUILD?'Запись останется только на этом устройстве. Название и решения никому не отправляются.':'Кнопка публикует название команды и решения в общем реестре. Личные данные не нужны.'}</small></form></section>
  {submitted&&<div role="status" className="dash-notice">«{submitted.team}» {submitted.volatile?'доступна до закрытия этой страницы':'сохранена'} · {number(submitted.score)} балла. {submitted.volatile?'Браузер не разрешил запись на устройство. ':''}{submitted.fingerprint!==fingerprint?'Вы уже изменили план; запись хранит прежний вариант.':'Ваш план теперь можно сравнить с другими.'}</div>}
  {error&&<div role="alert" className="dash-notice dash-error"><span>{error}</span><button onClick={()=>setSerial(s=>s+1)}>Обновить реестр</button></div>}
  <section className="dash-panel paper-card"><div className="dash-section-heading"><h3>Предложения команд</h3><button onClick={()=>setSerial(s=>s+1)}>Обновить <ControlIcon kind="replay" size={18}/></button></div>{loading?<p role="status">Загружаем сохранённые планы…</p>:!entries.length?<div className="dash-empty"><strong>Первый план может быть вашим</strong><p>{STATIC_BUILD?'В этой книге пока нет завершённых попыток.':'Пока в реестре этого сервера нет записей.'}</p></div>:<div className="dash-registry-list">{entries.map((entry,i)=><article key={entry.id}><span className="dash-registry-place">{i+1}</span><div><strong>{entry.team}</strong><p>{entry.plan.map(decisionLabel).join(' · ')}</p><small>{new Date(entry.createdAt).toLocaleString('ru-RU')} · {entry.spent} {unitFor(entry.spent)} · место {number(entry.rank,0)} среди {number(entry.total,0)} допустимых</small></div><b>{number(entry.score)}</b><button onClick={()=>onCompare(entry.plan,`План команды «${entry.team}»`)}>Сравнить</button></article>)}</div>}</section>
 </>;
}
