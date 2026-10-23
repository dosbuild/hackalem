import {ControlIcon} from './ControlIcon';

export function SheetHeader({title,label,onClose,id}:{title:string;label?:string;onClose:()=>void;id?:string}){
 return <header className="context-heading"><div>{label&&<span className="eyebrow">{label}</span>}<h2 id={id} className="paper-title" tabIndex={-1}>{title}</h2></div><button className="icon-control" onClick={onClose} aria-label="Return to the city"><ControlIcon kind="close"/></button></header>;
}
