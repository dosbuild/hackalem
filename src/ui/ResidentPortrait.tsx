import {useId} from 'react';
import type {Visual} from '../residents/types';

/** The same clothes, hair and accessories as the person in the city, at reading size. */
export function ResidentPortrait({visual:v,name='',className='',mood='neutral'}:{visual:Visual;name?:string;className?:string;mood?:'neutral'|'happy'|'thoughtful'}) {
 const clip=useId();
 return <svg className={`resident-portrait ${className}`} viewBox="0 0 96 104" role={name?'img':undefined} aria-label={name||undefined} aria-hidden={!name}>
  <defs><clipPath id={clip}><rect x="3" y="3" width="90" height="98" rx="34"/></clipPath></defs>
  <rect x="3" y="3" width="90" height="98" rx="34" fill={v.accent} fillOpacity=".35"/>
  <g clipPath={`url(#${clip})`} stroke="#263f3d" strokeWidth="1.6" strokeLinejoin="round">
   <path d="M14 105V86Q16 70 37 69H59Q79 70 82 86V105" fill={v.coat}/>
   <path d="M39 65V77Q48 84 57 77V65" fill={v.skin}/>
   <path d="M35 74L47 84L37 90L30 76M61 74L49 84L60 90L66 76" fill={v.accent}/>
   {v.era==='khanate'&&<><path d="M31 76L50 96L56 104M62 75L52 86M25 96H67" fill="none" stroke={v.accent} strokeWidth="4"/><path d="M35 83l2 3 3-1m1 5 2 3 3-1m1 5 2 3 3-1" fill="none" stroke="#f2eadb" strokeWidth="1"/><path d="M44 93h8v6h-8Z" fill="#bea16a"/></>}
   {v.head==='bob'&&<path d="M20 60V36Q18 11 48 11Q78 11 76 40V73Q66 82 58 71H35Q21 80 20 60" fill={v.hair}/>}
   {v.head==='bun'&&<circle cx="69" cy="22" r="13" fill={v.hair}/>}
   <ellipse cx="24" cy="47" rx="5" ry="7" fill={v.skin}/><ellipse cx="72" cy="47" rx="5" ry="7" fill={v.skin}/>
   <path d="M24 36Q24 13 48 13Q72 13 72 36V51Q70 73 48 74Q26 73 24 51Z" fill={v.skin}/>
   <path d={v.head==='bob'?'M24 43Q17 20 36 14Q58 3 71 25L74 42L65 37L61 25Q48 39 28 33Z':'M23 40Q16 17 37 12Q62 4 73 27L74 41L65 34L62 23Q52 34 29 30Z'} fill={v.hair}/>
   {v.head==='cap'&&<><path d={v.era==='khanate'?'M23 29Q24 4 48 4Q71 4 73 29Z':'M22 29Q25 9 47 9Q69 9 73 29Z'} fill={v.accent}/><path d={v.era==='khanate'?'M23 23Q48 18 73 23V32Q48 27 23 32Z':'M20 29Q49 24 78 29L79 35Q50 30 21 34Z'} fill={v.coat}/>{v.era==='khanate'&&<path d="M29 28l4-4 4 3 5-4 6 3 6-3 5 4 4-3 4 4" fill="none" stroke={v.accent} strokeWidth="1.5"/>}</>}
   {v.head==='hood'&&<path d="M23 51Q8 22 29 11Q48 0 68 13Q85 28 74 52L68 47Q72 24 49 20Q25 20 29 47Z" fill={v.coat}/>}
   <path d="M34 42L41 41M55 41L62 42" fill="none" stroke={v.hair} strokeWidth="2.2" strokeLinecap="round"/>
   {mood==='happy'?<path d="M34 49Q38 44 42 49M54 49Q58 44 62 49" fill="none" strokeWidth="2.5" strokeLinecap="round"/>:<><ellipse cx="38" cy="49" rx="2.2" ry="3.2" fill="#263f3d" stroke="none"/><ellipse cx="58" cy="49" rx="2.2" ry="3.2" fill="#263f3d" stroke="none"/></>}
   <path d="M48 50L46 56H50" fill="none" stroke="#985f4e" strokeWidth="1.3" strokeLinecap="round"/>
   <ellipse cx="32" cy="56" rx="5" ry="2.6" fill="#d47865" fillOpacity=".35" stroke="none"/><ellipse cx="64" cy="56" rx="5" ry="2.6" fill="#d47865" fillOpacity=".35" stroke="none"/>
   <path d={mood==='thoughtful'?'M43 63Q48 61 53 63':'M41 61Q48 67 55 61'} fill="none" strokeWidth="1.8" strokeLinecap="round"/>
   {v.prop==='headphones'&&<path d="M20 46V33Q20 6 48 6Q76 6 76 33V46M19 39V52M77 39V52" fill="none" stroke={v.accent} strokeWidth="5" strokeLinecap="round"/>}
   {['book','folder','clipboard','satchel'].includes(v.prop)&&<path d="M59 83L78 80L82 102H61Z" fill={v.accent}/>}
   {['plant','watering-can'].includes(v.prop)&&<><path d="M69 103V86M69 92Q53 87 59 79Q70 79 69 92M69 92Q82 83 84 91Q80 99 69 97" fill="#83ac82" stroke="#3c6b51"/><path d="M60 98H80L77 108H63Z" fill="#cb9168"/></>}
   {v.prop==='gloves'&&<><path d="M64 104l-2-12q0-5 4-4l3 3v-7q5-3 7 2l3 15Z" fill={v.accent}/><path d="M68 103l3-10q1-4 5-2l2 4 2-7q5-1 6 4l-2 13Z" fill={v.coat}/></>}
   {['ball','racket'].includes(v.prop)&&<><circle cx="74" cy="96" r="13" fill={v.accent}/><path d="M63 89L83 104M65 105L81 86" fill="none" strokeWidth="1"/></>}
   {v.prop==='scarf'&&<path d="M28 76Q48 87 67 76L64 84L56 86L59 104H48L46 86L31 84Z" fill={v.accent}/>}
  </g>
 </svg>;
}
