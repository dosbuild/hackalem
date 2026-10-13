import {ControlIcon} from './ControlIcon';
import {useEffect,useRef} from 'react';
import type {ReactNode} from 'react';

export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  const previous=document.activeElement,dialog=ref.current;
  ref.current?.showModal();
  heading.current?.focus({preventScroll:true});
  return()=>{dialog?.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};
 },[]);
 return <dialog ref={ref} className="game-dialog paper-sheet" aria-labelledby="game-dialog-title" onKeyDown={event=>{
  if(event.key!=='Tab')return;
  const items=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]:not([tabindex="-1"])')].filter(node=>node.getClientRects().length>0);
  const first=items[0],last=items.at(-1);if(!first||!last)return;
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===ref.current)onClose();}}>
  <div className="game-dialog-content"><header><h2 id="game-dialog-title" ref={heading} tabIndex={-1}>{title}</h2><button type="button" onClick={onClose} aria-label="Закрыть окно"><ControlIcon kind="close"/></button></header>{children}</div>
 </dialog>;
}
