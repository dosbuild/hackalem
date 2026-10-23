import {useEffect,useState} from 'react';
import type {AyaExpression} from './types';
const positions={idle:'0% 0%',thought:'50% 0%',attention:'100% 0%',explanation:'0% 100%',success:'50% 100%',error:'100% 100%'};
/** The entry needs one pose; other expressions share the original full atlas. */
export function AyaMascot({expression='idle',className=''}:{expression?:AyaExpression;className?:string}) {
 const [idleReady,setIdleReady]=useState(false),[atlasReady,setAtlasReady]=useState(false);
 const idle=`${import.meta.env.BASE_URL}aya/guide-idle.webp`,atlas=`${import.meta.env.BASE_URL}aya/guide-atlas.webp`;
 useEffect(()=>{const picture=new Image();picture.onload=()=>setIdleReady(true);picture.onerror=()=>setIdleReady(false);picture.src=idle;return()=>{picture.onload=null;picture.onerror=null;};},[idle]);
 useEffect(()=>{if(expression==='idle'||atlasReady)return;const picture=new Image();picture.onload=()=>setAtlasReady(true);picture.onerror=()=>setAtlasReady(false);picture.src=atlas;return()=>{picture.onload=null;picture.onerror=null;};},[atlas,atlasReady,expression]);
 const full=atlasReady&&(!idleReady||expression!=='idle'),loaded=idleReady||atlasReady,source=full?atlas:idle;
 return <span className={`aya-cloud aya-guide ${loaded?'':'is-loading'} ${className}`} data-art={loaded?(full?'atlas':'idle'):'fallback'} style={{backgroundImage:loaded?`url(${source})`:undefined,backgroundSize:full?'300% 200%':'100% 100%',backgroundPosition:full?positions[expression]:'0% 0%'}} aria-hidden="true">{!loaded&&'Aya'}</span>;
}
