import {occluded} from './projection.js';
import './landmark-explorer.css';

const compass='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.4"/><path d="m16.5 7.5-3 6-6 3 3-6 6-3Z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>';
const ink=(path,size=22)=>`<svg class="control-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="${path}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// Authored silhouettes follow the place in each world, rather than a system-font symbol.
const cityMarks={
 expo:'M20 10.5a8 8 0 1 1-16 0 8 8 0 0 1 16 0M4.5 8h15M4.5 13h15M12 2.5c-4.5 3.5-4.5 12.5 0 16m0-16c4.5 3.5 4.5 12.5 0 16M3 21h18',
 baiterek:'M16.5 6.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0M9 10l2 10m4-10-2 10m-1-9v9M7 22h10',
 khan:'M2.5 20.5 15 3l6.5 17.5h-19M15 3l-4 17.5m4-17.5 2 17.5M15 1.5V3',
 palace:'M3 20.5 12 3l9 17.5H3M12 3v17.5M9 9h6m-3 11.5L7 16m5 4.5 5-4.5',
 akorda:'M3 21h18M4.5 12h15v9M7 12V9h10v3M8 9a4 4 0 0 1 8 0M12 3V1.5M8 15v4m4-4v4m4-4v4',
 hazret:'M6.5 20V12h11v8M8 12a4 4 0 0 1 8 0M12 6V4M3 20V6l1-2 1 2v14m14 0V6l1-2 1 2v14M1.5 21.5h21M11 20v-5h2v5',
 opera:'M3 9l9-6 9 6H3M5 9v11m4-11v11m6-11v11m4-11v11M2 22h20M3 20h18',
 arch:'M4 21V4h16v17M8 21V12a4 4 0 0 1 8 0v9M3 4h18M3 7h18M2.5 21h6m7 0h6',
 concert:'M3 19c-1-5 1-8 4-12 1 4 2 8 5 12M7 7l6-4c-.7 6 0 10 3 16m-4 0 8-12c2 4 2 8 1 12M3 21h18',
 atyrau:'M2 18h20M3 17c4-12 14-12 18 0M6 12v5m4-8v8m4-8v8m4-5v5M4 21c3-2 5 2 8 0s5 2 8 0',
 abudhabi:'M3 21h18M4 21V13h5v8m0-21V8h5v13m0 0V2h5v19M6.5 16v2m5-7v2m0 3v2m5-13v2m0 3v2m0 3v2',
 'grand-mosque':'M6 20V12h12v8M7 12a5 5 0 0 1 10 0M12 5V2M2.5 20V6h2v14m15 0V6h2v14M2 6l1.5-3L5 6m14 0 1.5-3L22 6M1 22h22M10 20v-5h4v5',
 lrt:'M6 3h12l2 3v11H4V6l2-3M5 10h14M8 4v5m8-5v5M7 14h1m8 0h1M7 17l-3 5m13-5 3 5M6 20h12',
 'esil-bridges':'M2 16h20M3 15V7m18 8V7M3 7h18M4 15c2-9 5-9 8 0 3-9 6-9 8 0M3 20c3-2 5 2 8 0s5 2 10 0',
};
const steppeMarks={
 expo:'M3 20V10l5-4 5 4v10M4 10h8M6.5 20v-6h3v6M15 20V10h6v10M14 10l4-4 4 4M16 14h4',
 baiterek:'M3 10c0-4 4-5 6-5 1-5 7-4 8 0 5 1 5 7 1 9M5 14c-3 0-3-3-2-4M12 8v13m0-9-5-3m5 5 5-5M5 22h14',
 khan:'M2 21V11h20v10M4 11V8l4-3 4 3v3m2 0V8l4-3 4 3M3 8h10m0 0h10M10 21v-5h4v5',
 palace:'M3 20h18M5 20v-3h14v3M7 17v-3h10v3M9 14v-3h6v3M5 9h2m4-2h2m4 2h2',
 akorda:'M4 20V12c0-5 16-5 16 0v8H4M4 12h16M9 20v-6h6v6M10 7V5h4v2M2 20V3m0 0h5l-1 2 1 2H2',
 hazret:'M5 21V13h12v8M7 13a4 4 0 0 1 8 0M11 7V5M19 21V6h2v15m-2-15 1-3 1 3M9 21v-5h4v5M3 22h19',
 opera:'M3 11l9-6 9 6H3M4 11v7m16-7v7M7 18h10M2 21c5-3 15-3 20 0M6 22c3-2 9-2 12 0',
 arch:'M4 21V4h3v17M17 21V4h3v17M3 4h5m8 0h5M7 6h10v3H7M8 21V10m8 11V10M9 13h6',
 concert:'M3 11l9-6 9 6H3M4 11v7m16-7v7M6 18h12M2 21c4-2 7 0 10 0s6-2 10 0',
 atyrau:'M2 16h20M3 9v10m6-10v10m6-10v10m6-10v10M3 10h18M3 10l6 6 6-6 6 6M3 22c3-2 5 2 9 0s5 2 9 0',
 abudhabi:'M7 21l1-13h8l1 13M5 8l7-5 7 5H5M9 10h6m-6 0 6 7m-6 0 6-7M6 18h12M5 21h14',
 'grand-mosque':'M6 21V13h12v8M7 13a5 5 0 0 1 10 0M12 7V4M2 21V7h2v14m16 0V7h2v14M1 7l2-3 2 3m14 0 2-3 2 3M10 21v-5h4v5',
 lrt:'M3 20V12c0-5 12-5 12 0v8H3M3 12h12M7 20v-6h4v6M19 21V3m0 2h4v5h-4M17 21h5',
 'esil-bridges':'M2 18h20M3 10v9m18-9v9M3 11h4m10 0h4M8 8h8v7H8M6 15h12M11 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0m6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0M3 22h18',
};
const natureMarks={
 'steppe-herd':'M4 14V9l4-1 5 1 2-5 3 2 1 4-3 1v5M5 14h10M5 14l-1 7m4-7 1 7m5-7-1 7m3-5 2 5M4 9l-2 5M16 5V2',
 'steppe-flock':'M5 16c-4-1-4-6 0-7-1-4 5-5 7-3 4-2 7 1 6 4l3 1v4l-3 1H5M6 16v5m3-5v5m6-5v5m3-6v6M20 11l1-3',
 'steppe-caravan':'M3 15V9c0-5 5-5 6 0 2-5 6-5 7 0l2 2V5l3-1v5l-2 3v4M3 15h13M4 15l-1 6m4-6 1 6m5-6-1 6m4-5 2 5M3 10l-2 4',
 'steppe-spring':'M3 15c0-5 18-5 18 0s-18 5-18 0M3 15c1 7 17 7 18 0M8 14c2 1 6 1 8 0M4 8l2-4 3 1m8 2 2-3 3 3M11 8l1-4',
 'steppe-ridge':'M2 17l6-9 4 4 4-8 6 13M5 20l1-3m2 3 1-2m5 3 1-4m4 4 1-3M6 11l2 2 2-1m4-4 2 2 2-1',
 'steppe-willow':'M12 4c-7 0-9 4-9 9m9-9c7 0 9 4 9 9M12 4C7 7 7 11 7 16m5-12c5 3 5 7 5 12M12 7v13m0-1-5 3m5-3 5 3M4 20l6-1',
};
const placeMark='M18.5 9c0 4.5-6.5 11.5-6.5 11.5S5.5 13.5 5.5 9a6.5 6.5 0 1 1 13 0M14.5 9a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0';
const mark=(id,past)=>ink(natureMarks[id]||(past?steppeMarks:cityMarks)[id]||placeMark);
const previousMark=ink('M20 12H4m6-6-6 6 6 6',20),nextMark=ink('M4 12h16m-6-6 6 6-6 6',20),visitMark=ink(placeMark,16);

/** View-only city exploration. It never touches budgets, commitments or effects. */
export function createLandmarkExplorer({element,labels,landmarks,observations=[],visit,leave,mode='astana'}){
 const places=[...observations,...landmarks];
 const past=mode==='khanate',placeTitle=past?'Places in the Khanate':'Places in Astana';
 let selected=null,closed=false;const initialId=new URLSearchParams(location.search).get('landmark');
 const panel=document.createElement('details');panel.className='landmark-atlas paper-sheet';panel.dataset.occludesCity='';
 const summary=document.createElement('summary');summary.innerHTML=compass+'<span>'+placeTitle+'</span><small>'+places.length+'</small>';summary.setAttribute('aria-label',past?'Explore places in the Khanate':'Explore Astana landmarks');panel.append(summary);
 const list=document.createElement('div');list.className='landmark-atlas-list';list.setAttribute('aria-label',placeTitle);panel.append(list);
 const card=document.createElement('section');card.className='landmark-caption paper-sheet';card.hidden=true;card.dataset.occludesCity='';card.setAttribute('aria-label',past?'A place in the city by the Esil':'A place in Astana');
 const eyebrow=document.createElement('span');eyebrow.className='landmark-eyebrow';eyebrow.textContent=past?'STORIES OF THE CITY BY THE ESIL':'ASTANA IN DETAIL';
 const title=document.createElement('h2');title.tabIndex=-1;const description=document.createElement('p'),actions=document.createElement('div');actions.className='landmark-actions';
 const previous=document.createElement('button'),next=document.createElement('button'),back=document.createElement('button');previous.innerHTML=previousMark;previous.setAttribute('aria-label','Previous place');next.innerHTML=nextMark;next.setAttribute('aria-label','Next place');back.textContent='Back to decisions';back.className='landmark-back';
 actions.append(previous,next,back);card.append(eyebrow,title,description,actions);element.append(panel,card);
 const buttons=[];
 function select(item,{navigate=true,focus=false}={}){if(closed||!item)return;selected=item;element.dataset.landmarkActive='true';element.dataset.landmark=item.id;eyebrow.textContent=item.nature?'STEPPE LIFE · TAKE A MOMENT TO WATCH':past?'STORIES OF THE CITY BY THE ESIL':'ASTANA IN DETAIL';title.textContent=item.name;description.textContent=item.description;card.hidden=false;panel.open=false;for(const {model,button}of buttons)button.setAttribute('aria-current',String(model.id===item.id));const url=new URL(location.href);url.searchParams.set('landmark',item.id);if(past)url.searchParams.set('mode',mode);history.replaceState(history.state,'',url);if(navigate)visit(item);if(focus)title.focus({preventScroll:true});}
 function clear({focus=false,updateUrl=true}={}){if(selected&&updateUrl){const url=new URL(location.href);url.searchParams.delete('landmark');history.replaceState(history.state,'',url);}selected=null;delete element.dataset.landmarkActive;delete element.dataset.landmark;card.hidden=true;for(const {button}of buttons)button.removeAttribute('aria-current');if(focus)summary.focus({preventScroll:true});}
 for(const [index,model] of places.entries()){
  if(observations.length&&(index===0||index===observations.length)){const heading=document.createElement('h3');heading.className='landmark-atlas-heading';heading.textContent=index===0?'Steppe life':'City places';list.append(heading);}
  const button=document.createElement('button');button.type='button';button.dataset.landmarkId=model.id;button.innerHTML='<i aria-hidden="true">'+mark(model.id,past)+'</i><span></span><b aria-hidden="true">'+visitMark+'</b>';button.querySelector('span').textContent=model.name;button.onclick=()=>select(model,{focus:true});list.append(button);buttons.push({model,button});
 }
 const pins=landmarks.map(model=>{const button=document.createElement('button');button.className='map-landmark';button.dataset.landmarkId=model.id;button.textContent=model.shortName||model.name;button.setAttribute('aria-label','Explore: '+model.name);button.onclick=()=>select(model,{focus:true});labels.append(button);return {model,button};});
 const returnToDecisions=()=>{clear({focus:true});leave();};
 const step=delta=>{const index=places.findIndex(m=>m.id===selected?.id);select(places[(index+delta+places.length)%places.length]);};previous.onclick=()=>step(-1);next.onclick=()=>step(1);back.onclick=returnToDecisions;
 const overlayOpen=()=>!!document.querySelector('dialog[open],#aya-dialogue');
 const escape=e=>{if(e.key!=='Escape'||e.defaultPrevented||!panel.open||overlayOpen())return;panel.open=false;summary.focus({preventScroll:true});e.preventDefault();e.stopPropagation();};panel.addEventListener('keydown',escape);
 card.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||!selected||overlayOpen())return;e.preventDefault();e.stopPropagation();returnToDecisions();});
 return {
  select,clear,get selected(){return selected;},
  draw(frame,rects,occupied=[]){
   const z=frame.pose.zoom;for(const {model,button}of pins){const p=frame.project(model.position,(model.heightM+4)/12000),box={left:p.x-48,right:p.x+48,top:p.y-14,bottom:p.y+14};button.hidden=!!selected||z<(past?16:3)||z>45||!p.visible||p.x<60||p.x>frame.width-60||p.y<210||p.y>frame.height-130||occluded(p,[...rects,...occupied],20);if(!button.hidden){button.style.left=p.x+'px';button.style.top=p.y+'px';occupied.push(box);}}
  },
  initial(){if(initialId)select(places.find(m=>m.id===initialId));},
  destroy(){closed=true;clear({updateUrl:false});panel.remove();card.remove();for(const {button}of pins)button.remove();},
 };
}
