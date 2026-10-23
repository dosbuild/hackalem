import type {ScenarioResult} from '../domain/types';
import {ControlIcon} from '../ui/ControlIcon';
import {format} from '../ui/copy';

export function ResultInvitation({result,onOpen,onDismiss}:{result:ScenarioResult|null;onOpen:()=>void;onDismiss:()=>void}){
 return <aside className="result-invitation paper-sheet" data-occludes-city aria-label="Your result is ready"><button className="result-invitation-open" data-testid="result-invitation" onClick={onOpen}><ControlIcon kind="book"/><span><strong>{result?'The city in two years':'Five decisions accepted'}</strong><small>{result?`Quality-of-life index ${format(result.finalScore)} · open result`:'Calculating consequences…'}</small></span><ControlIcon kind="arrow-right"/></button><button className="icon-control" aria-label="Dismiss result invitation" onClick={onDismiss}><ControlIcon kind="close" size={18}/></button></aside>;
}
