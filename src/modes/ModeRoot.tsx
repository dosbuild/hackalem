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
 useEffect(()=>{let alive=true;setError(false);void loaders[id]().then(module=>{if(alive){setMode(module.default);document.documentElement.dataset.mode=id;try{localStorage.setItem(LAST_MODE_KEY,id);}catch{}document.title=id==='khanate'?'Khanate — City on the Esil':'Alem — Astana';}},()=>{if(alive)setError(true);});return()=>{alive=false;};},[id,revision]);
 useEffect(()=>{if(!mode||!arriving)return;const timer=setTimeout(()=>setArriving(false),1100);return()=>clearTimeout(timer);},[mode,arriving]);
 const switchMode=useCallback((next:ModeId)=>{if(next===id)return;setMode(null);setArriving(true);setId(next);history.replaceState(null,'',modeUrl(new URL(location.href),next));try{localStorage.setItem(LAST_MODE_KEY,next);}catch{}},[id]);
 useEffect(()=>{const pop=()=>{const next=initialMode(location.search,()=>localStorage.getItem(LAST_MODE_KEY));if(next!==id){setMode(null);setArriving(true);setId(next);}};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[id]);
 return <>{mode?<ModeProvider mode={mode} switchMode={switchMode}><App key={mode.id}/></ModeProvider>:<main className="world-entrance" aria-live="polite"><span className="entrance-ring" aria-hidden="true">✧</span><span className="eyebrow">{id==='khanate'?'ACROSS THE RIVER, ANOTHER ERA':'RETURNING TO THE PRESENT'}</span><h1>{id==='khanate'?'Khanate':'Astana'}</h1><p>{error?'Could not open this world. Your saved decisions are safe.':id==='khanate'?'City on the Esil · one hundred coins, five decrees':'The river, the streets and your next story'}</p>{error&&<button onClick={()=>setRevision(n=>n+1)}>Try again</button>}<button className="text-button" onClick={()=>switchMode(id==='khanate'?'astana':'khanate')}>{id==='khanate'?'Return to Astana':'Open Khanate'}</button></main>}{arriving&&mode&&<div className="river-passage" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M-10-20C110 10-10 40 70 65S30 110 80 125"/></svg><span>{mode.subtitle}</span></div>}</>;
}
