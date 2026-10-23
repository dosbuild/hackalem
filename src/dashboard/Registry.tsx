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
 return <><section className="dash-review-lead"><div><p className="dash-eyebrow">{STATIC_BUILD?'THIS BROWSER’S BOOK':'PUBLIC PLAN REGISTRY'}</p><h2>{mode.id==='khanate'?'Save a chapter in the city book':'The city your team proposed'}</h2><p>{STATIC_BUILD?'Name this attempt. Its five decisions and result will be saved in your browser.':'Save the result under your team name. Decisions and score will remain in this server’s registry after reloading.'}</p></div></section>
  <section className="dash-panel dash-submit paper-card"><div><h3>Submit the current plan</h3><p>{complete?(STATIC_BUILD?'A snapshot of five decisions is saved. New decrees or projects will not overwrite this page.':'A snapshot of these five decisions is published. Later changes to your plan will not overwrite the entry.'):'Complete five decisions first. You can already explore the registry.'}</p></div><form onSubmit={submit}><label htmlFor="dashboard-team">Team name</label><div><input id="dashboard-team" maxLength={60} minLength={2} required value={team} onChange={e=>setTeam(e.target.value)} placeholder="For example, Nura Neighbours" autoComplete="organization"/><button className="dash-primary" disabled={!complete||busy||team.trim().length<2}>{busy?'Saving…':STATIC_BUILD?'Save in the book':'Submit to registry'}{!busy&&<ControlIcon kind="arrow-right" size={18}/>}</button></div><small>{STATIC_BUILD?'This entry stays on this device only. The name and decisions are not sent to anyone.':'This button publishes your team name and decisions in the shared registry. No personal information is needed.'}</small></form></section>
  {submitted&&<div role="status" className="dash-notice">“{submitted.team}” {submitted.volatile?'available until this page closes':'saved'} · {number(submitted.score)} points. {submitted.volatile?'Your browser denied local storage. ':''}{submitted.fingerprint!==fingerprint?'You have already changed the plan; this entry preserves the earlier version.':'Your plan can now be compared with others.'}</div>}
  {error&&<div role="alert" className="dash-notice dash-error"><span>{error}</span><button onClick={()=>setSerial(s=>s+1)}>Refresh registry</button></div>}
  <section className="dash-panel paper-card"><div className="dash-section-heading"><h3>Team proposals</h3><button onClick={()=>setSerial(s=>s+1)}>Refresh <ControlIcon kind="replay" size={18}/></button></div>{loading?<p role="status">Loading saved plans…</p>:!entries.length?<div className="dash-empty"><strong>The first plan could be yours</strong><p>{STATIC_BUILD?'This book has no completed attempts yet.':'This server’s registry has no entries yet.'}</p></div>:<div className="dash-registry-list">{entries.map((entry,i)=><article key={entry.id}><span className="dash-registry-place">{i+1}</span><div><strong>{entry.team}</strong><p>{entry.plan.map(decisionLabel).join(' · ')}</p><small>{new Date(entry.createdAt).toLocaleString('en-US')} · {entry.spent} {unitFor(entry.spent)} · rank {number(entry.rank,0)} among {number(entry.total,0)} valid</small></div><b>{number(entry.score)}</b><button onClick={()=>onCompare(entry.plan,`Team plan “${entry.team}”`)}>Compare</button></article>)}</div>}</section>
 </>;
}
