import {useCallback,useEffect,useState} from 'react';
import App from '../app/App';
import {ModeProvider} from './context';
import {initialMode,LAST_MODE_KEY,modeUrl} from './storage';
import type {ModeId,ModeDefinition} from './types';
import './modes.css';

const loaders={astana:()=>import('./astana'),khanate:()=>import('./khanate')};
export default function ModeRoot(){
 const [id,setId]=useState(()=>initialMode(location.search,()=>localStorage.getItem(LAST_MODE_KEY)));
 const [mode,setMode]=useState<ModeDefinition|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 const [arriving,setArriving]=useState(false);
 useEffect(()=>{let alive=true;setError(false);void loaders[id]().then(module=>{if(alive){setMode(module.default);document.documentElement.dataset.mode=id;try{localStorage.setItem(LAST_MODE_KEY,id);}catch{}document.title=id==='khanate'?'Хандық — Город у Есиля':'Әлем — Астана';}},()=>{if(alive)setError(true);});return()=>{alive=false;};},[id,revision]);
 useEffect(()=>{if(!mode||!arriving)return;const timer=setTimeout(()=>setArriving(false),1100);return()=>clearTimeout(timer);},[mode,arriving]);
 const switchMode=useCallback((next:ModeId)=>{if(next===id)return;setMode(null);setArriving(true);setId(next);history.replaceState(null,'',modeUrl(new URL(location.href),next));try{localStorage.setItem(LAST_MODE_KEY,next);}catch{}},[id]);
 useEffect(()=>{const pop=()=>{const next=initialMode(location.search,()=>localStorage.getItem(LAST_MODE_KEY));if(next!==id){setMode(null);setArriving(true);setId(next);}};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[id]);
 return <>{mode?<ModeProvider mode={mode} switchMode={switchMode}><App key={mode.id}/></ModeProvider>:<main className="world-entrance" aria-live="polite"><span className="entrance-ring" aria-hidden="true">✧</span><span className="eyebrow">{id==='khanate'?'ЗА РЕКОЙ — ДРУГАЯ ЭПОХА':'ВОЗВРАЩАЕМСЯ В НАШЕ ВРЕМЯ'}</span><h1>{id==='khanate'?'Хандық':'Астана'}</h1><p>{error?'Не удалось открыть мир. Сохранённые решения остаются с вами.':id==='khanate'?'Город у Есиля · сто монет, пять указов':'Река, улицы и ваша следующая история'}</p>{error&&<button onClick={()=>setRevision(n=>n+1)}>Попробовать ещё раз</button>}<button className="text-button" onClick={()=>switchMode(id==='khanate'?'astana':'khanate')}>{id==='khanate'?'Вернуться в Астану':'Открыть Хандық'}</button></main>}{arriving&&mode&&<div className="river-passage" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M-10-20C110 10-10 40 70 65S30 110 80 125"/></svg><span>{mode.subtitle}</span></div>}</>;
}
