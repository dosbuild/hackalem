import {useEffect,useRef,useState} from 'react';
import type {AppState} from './state';
import {initialState} from './state';
import {constructionDuration} from './construction';
import type {Decision} from '../domain/types';

const school:Decision={initiativeId:'M7',scope:'district',districtId:'nura'};
const buildMs=constructionDuration(school);
const introductionMs=600, handoffMs=1400;
/** The demo never dispatches a plan mutation or writes its school into the saved draft. */
export function useDemonstration(_state:AppState, ready:boolean, finish:()=>void) {
  const [active,setActive]=useState(false);
  const [readyAt,setReadyAt]=useState<number|null>(null),[paused,setPaused]=useState(false),[clock,setClock]=useState(Date.now);
  const offset=useRef(0),pausedAt=useRef(0),finishRef=useRef(finish);finishRef.current=finish;
  useEffect(()=>{if(active&&ready&&!paused&&readyAt===null)setReadyAt(Date.now()-offset.current);},[active,ready,paused,readyAt]);
  useEffect(()=>{
    if(!active||paused)return;
    const tick=()=>setClock(Date.now()-offset.current);tick();const id=setInterval(tick,80);return()=>clearInterval(id);
  },[active,paused]);
  const elapsed=readyAt===null?0:Math.max(0,clock-readyAt),phase=readyAt===null?'preparing':elapsed<introductionMs?'intro':elapsed<introductionMs+buildMs?'building':'complete';
  const end=()=>{setActive(false);setPaused(false);finishRef.current();};
  useEffect(()=>{if(active&&!paused&&elapsed>buildMs+introductionMs+handoffMs)end();},[active,paused,elapsed]);
  const togglePause=()=>{if(paused){offset.current+=Date.now()-pausedAt.current;setPaused(false);}else{pausedAt.current=Date.now();setPaused(true);}};
  const replay=()=>{offset.current=0;setReadyAt(null);setClock(Date.now());setPaused(false);setActive(true);};
  const display=initialState(phase==='building'||phase==='complete'?[school]:[],true);
  const worldState:AppState={...display,focusedDistrict:readyAt===null?null:'nura',construction:readyAt===null?[]:[{key:'M7:nura',startedAt:readyAt+introductionMs,durationMs:buildMs}],
    cameraRequest:{id:100000+(readyAt??0),kind:readyAt===null?'overview':'district',...(readyAt===null?{}:{districtId:'nura' as const})} as AppState['cameraRequest']};
  return {active,paused,phase,elapsed,progress:Math.max(0,Math.min(1,(elapsed-introductionMs)/buildMs)),remaining:Math.max(0,Math.ceil((buildMs+introductionMs-elapsed)/1000)),worldState,clock,end,togglePause,replay};
}
