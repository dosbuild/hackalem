import {ControlIcon} from '../ui/ControlIcon';
import {useState} from 'react';
import {useMode} from './context';
export function ModeControl(){const {mode,switchMode}=useMode();return <div className="mode-control" role="group" aria-label="Эпоха города"><button aria-pressed={mode.id==='astana'} onClick={()=>switchMode('astana')}><ControlIcon kind="overview" size={18}/>Астана</button><button aria-pressed={mode.id==='khanate'} onClick={()=>switchMode('khanate')}><svg aria-hidden="true" className="control-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6"/><path d="M4 12h16M12 4v16M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" strokeWidth="1.6"/></svg>Хандық</button></div>;}
export function HistoricalInvitation(){
 const {mode,storage,switchMode}=useMode();const [dismissed,setDismissed]=useState(()=>{try{return storage.getItem('alem:khanate-invitation:v1')==='seen';}catch{return false;}});
 const dismiss=()=>{setDismissed(true);try{storage.setItem('alem:khanate-invitation:v1','seen');}catch{}};
 if(mode.id!=='astana'||dismissed)return null;
 return <aside className="historical-invitation" data-occludes-city aria-label="Новая эпоха"><button className="invitation-dismiss" aria-label="Скрыть приглашение" onClick={dismiss}><ControlIcon kind="close" size={18}/></button><div className="invitation-art" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}khanate/invitation.png`} alt=""/></div><div><span className="eyebrow">НОВАЯ ЭПОХА · ХАНДЫҚ</span><h2>За рекой — другая эпоха.</h2><p>Станьте ханом города: сто монет, пять указов, два года перемен.</p><button className="invitation-enter" onClick={()=>{dismiss();switchMode('khanate');}}>Войти в Хандық <ControlIcon kind="arrow-right" size={18}/></button></div></aside>;
}
