import { useEffect, useRef } from 'react';
import type { AppState } from '../app/state';
import type { Resident } from './types';
import { illustratedBeat, anchorFor, observe } from './engine';
import { buildAtlas, frameIndex } from './sprites';

const positions = [[390,220],[510,226],[660,164],[250,156],[738,248],[165,246]] as const;
export interface FrameMetrics { frames:number; totalDrawMs:number; maxDrawMs:number; activeResidents:number }

export function EncounterCanvas({state,residents,selectedId,onSelect}:{state:AppState;residents:readonly Resident[];selectedId:string|null;onSelect:(id:string)=>void}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const values=useRef({state,residents,selectedId});
  values.current={state,residents,selectedId};
  const first=residents[0]!;
  useEffect(()=>{
    const element=canvas.current!;const c=element.getContext('2d')!;
    const targets=element.parentElement!.querySelectorAll<HTMLButtonElement>('.resident-hit');
    const atlas=buildAtlas(residents); const started=performance.now();
    const metrics:FrameMetrics={frames:0,totalDrawMs:0,maxDrawMs:0,activeResidents:residents.length};
    let raf=0,last=0,visible=true;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;});observer.observe(element);
    const r=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
    const text=(str:string,x:number,y:number,color='#29453f',size=13)=>{c.fillStyle=color;c.font=`${size}px system-ui`;c.fillText(str,x,y);};
    const tree=(x:number,y:number)=>{r(x+6,y,3,24,'#7d6851');r(x,y-9,16,13,'#7d9865');r(x+3,y-14,10,9,'#91a878');r(x-3,y+11,22,3,'#a4ac80');};
    const draw=(now:number)=>{
      raf=requestAnimationFrame(draw);
      if(!visible||document.hidden||now-last<80)return;last=now;
      const begin=performance.now(),v=values.current;
      const seconds=reduced?4:(now-started)/1000;
      const observation=observe(v.residents[0]!,v.state);
      const treatments=new Set(observation.relatedTreatments);
      const proposal=v.state.candidate?.decision;
      const paper=proposal&&(proposal.scope==='citywide'||proposal.districtId===v.residents[0]!.location)?proposal.initiativeId:null;
      c.imageSmoothingEnabled=false;
      r(0,0,900,360,'#b9c5a7');
      r(0,225,900,135,'#9eac9b');r(0,272,900,51,'#768d86');r(0,324,900,36,'#536e66');
      for(let x=0;x<900;x+=46)r(x,291,23,2,'#b8c5b0');
      // Architectural edge, never a miniature replacement city. Ground and actors share this plane.
      r(0,35,295,107,'#d7d8bd');r(0,35,295,9,'#a7b39d');r(295,42,22,106,'#a4b29b');
      r(0,142,317,8,'#7e927f');
      for(let x=30;x<280;x+=64){r(x,64,33,44,'#7b9690');r(x+4,68,25,36,'#9fb8ac');r(x+17,68,2,36,'#d5dac0');r(x+4,86,25,2,'#d5dac0');}
      r(220,97,41,49,'#6e8479');r(224,101,32,45,'#526f66');r(247,119,3,5,'#c7cead');
      r(565,61,335,96,'#c9ceb4');r(559,56,341,9,'#adb79e');r(560,151,340,7,'#879b84');
      r(626,101,33,53,'#698277');r(632,108,21,30,'#adc0ac');
      r(711,87,52,47,'#879b88');r(716,92,42,36,'#e3dec0');
      text(anchorFor(first).label,577,82,'#4c665b',12);
      // Familiar fixed pot, bag and notice establish continuity even with no improvement.
      r(421,230,14,14,'#b27b53');r(424,221,3,12,'#5a7853');r(416,216,12,9,'#78935e');r(425,213,13,8,'#8aa66d');
      r(562,200,15,10,'#b79760');r(566,197,7,3,'#706447');
      r(338,138,3,76,'#657f71');r(327,137,25,7,'#d4dac0');
      const kind=anchorFor(first).kind;
      if(kind==='stop'){r(310,178,4,64,'#688477');r(309,174,42,18,'#d8d7ba');text('Аялдама',315,187,'#36584f',9);r(565,224,62,5,'#7c6952');r(570,229,4,14,'#526958');r(617,229,4,14,'#526958');}
      if(kind==='school')text('МЕКТЕП',704,117,'#48685c',11);
      if(kind==='clinic'){r(714,105,18,5,'#729b88');r(720,99,5,18,'#729b88');}
      if(kind==='service'){r(478,248,45,9,'#687f75');r(482,250,36,2,'#a8b4a2');r(472,220,52,4,'#b99359');r(474,224,3,20,'#826d50');r(517,224,3,20,'#826d50');}
      if(treatments.has('M4')||treatments.has('M6')){tree(340,210);tree(474,164);tree(765,192);r(462,212,62,6,'#987953');r(466,218,4,14,'#536953');r(514,218,4,14,'#536953');}
      if(treatments.has('M1')){r(0,307,900,13,'#b3b589');text('BUS',310,318,'#405f54',11);}
      if(treatments.has('M3')){r(675,171,72,5,'#618277');r(680,176,5,49,'#7d9684');r(738,176,5,49,'#7d9684');text('LRT · эскиз',681,169,'#36584f',10);}
      if(treatments.has('M2')){for(const x of [353,551]){r(x,231,3,39,'#536f66');r(x-3,223,10,22,'#354e48');r(x,Math.floor(seconds/3)%2?239:226,4,4,Math.floor(seconds/3)%2?'#c9bd76':'#b48662');}}
      if(treatments.has('M5')){r(239,122,10,18,'#93a99c');r(241,125,6,7,'#d8dfc1');r(259,132,13,3,'#88a097');}
      if(treatments.has('M7')){r(562,117,60,38,'#abc1a3');r(572,122,17,30,'#527b6c');text('+ вход',567,115,'#48685c',10);}
      if(treatments.has('M8')){r(665,101,33,53,'#6c9584');r(676,108,12,3,'#dbe2c7');r(680,104,3,12,'#dbe2c7');}
      if(treatments.has('M9')){c.strokeStyle='#c5d3a9';c.lineWidth=2;c.strokeRect(290,198,255,57);c.beginPath();c.arc(410,226,17,0,Math.PI*2);c.stroke();}
      if(treatments.has('M10')){r(317,176,51,75,'#e7dfae44');r(336,138,9,5,'#f3e4ad');r(347,152,8,4,'#587566');}
      if(treatments.has('M11')){r(356,269,88,56,'#90a79a');for(let y=270;y<324;y+=10)r(360,y,81,5,'#dddcc0');r(400,293,15,6,'#c9ccb1');}
      if(treatments.has('M12')){r(714,97,42,31,'#d8e4cb');text('Өтініш',718,108,'#386454',8);text('✓',728,122,'#386454',12);}
      if(treatments.has('M13')){r(476,247,50,12,'#7c9d91');r(480,251,42,3,'#bed0b0');r(472,220,52,4,'#b9c5a7');r(474,224,3,20,'#b9c5a7');r(517,224,3,20,'#b9c5a7');}
      if(treatments.has('M14')){r(714,93,42,41,'#aac1ac');text('Кезек',718,105,'#385b4c',8);for(let y=110;y<129;y+=7)r(720,y,28,2,'#628c74');}
      if(paper){c.setLineDash([5,5]);c.lineWidth=2;c.strokeStyle='#eee1a9';c.strokeRect(310,173,245,80);c.setLineDash([]);r(320,166,145,19,'#f0e5c3');text(`${paper} · предложение`,327,180,'#596c56',11);}
      // A single batched draw, six active people maximum; no per-person React loop per frame.
      for(const [i,resident] of v.residents.entries()){
        const [baseX,baseY]=positions[i]!;
        const beat=illustratedBeat(resident,seconds,i===0&&!!v.selectedId,observe(resident,v.state));
        const sharedExchange=i===1&&(treatments.has('M4')||treatments.has('M9'))&&seconds%14>=7;
        const active=sharedExchange?'exchange':beat.activity;
        const walk=reduced?0:beat.dx;
        const exchange=sharedExchange&&!reduced?-32:0;
        const scale=i===0||i===1?1.8:1.3;
        const sprite=atlas.get(resident.id)![frameIndex(active,Math.floor(seconds*4))]!;
        const x=baseX+walk+exchange,y=baseY+(reduced?0:beat.dy);
        const target=targets[i];if(target){target.style.left=`${(x+28)/9}%`;target.style.top=`${(y-12)/3.6}%`;target.style.setProperty('--actor-offset-x',`${walk+exchange}px`);target.style.setProperty('--actor-offset-y',`${reduced?0:beat.dy}px`);}
        if(resident.id===v.selectedId){c.strokeStyle='#f3e7ab';c.lineWidth=2;c.beginPath();c.ellipse(x+29,y+15,28,7,0,0,Math.PI*2);c.stroke();}
        c.drawImage(sprite,x,y-40*scale+20,32*scale,40*scale);
        // Familiar prop moves between two neighbours only when the evaluated shared-space rule supports it.
        if(treatments.has('M4')&&i===1&&active==='exchange'){r(x-12,y-4,11,9,'#8eaa99');r(x-17,y-3,7,3,'#bad1ad');}
      }
      const spent=performance.now()-begin;metrics.frames++;metrics.totalDrawMs+=spent;metrics.maxDrawMs=Math.max(metrics.maxDrawMs,spent);
      if(metrics.frames%12===0)element.dataset.metrics=JSON.stringify({...metrics,meanDrawMs:metrics.totalDrawMs/metrics.frames});
    };
    raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();atlas.clear();};
  },[residents,first,state.cameraRequest.id]);

  return <div className="resident-stage" data-anchor={anchorFor(first).id} data-phase={observe(first,state).phase}>
    <canvas ref={canvas} width={900} height={360} aria-label={`Сцена: ${anchorFor(first).label}. ${first.habit}`} />
    {residents.map((r,i)=>{const p=positions[i]!;return <button key={r.id} className={`resident-hit ${r.id===selectedId?'is-selected':''}`} style={{left:`${(p[0]+28)/9}%`,top:`${(p[1]-12)/3.6}%`}} aria-label={`Поговорить: ${r.name}`} title={r.id===selectedId?r.name:undefined} onClick={()=>onSelect(r.id)}><span className="resident-sr">{r.name}</span>{r.id===selectedId&&<span className="resident-name-tag">{r.name}</span>}</button>;})}
    <span className="resident-stage-caption">Условное место встречи · привязка к карте ожидается</span>
  </div>;
}
