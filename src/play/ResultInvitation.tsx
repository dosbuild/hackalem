import type {ScenarioResult} from '../domain/types';
import {ControlIcon} from '../ui/ControlIcon';
import {format} from '../ui/copy';

export function ResultInvitation({result,onOpen,onDismiss}:{result:ScenarioResult|null;onOpen:()=>void;onDismiss:()=>void}){
 return <aside className="result-invitation paper-sheet" data-occludes-city aria-label="Итог готов к просмотру"><button className="result-invitation-open" data-testid="result-invitation" onClick={onOpen}><ControlIcon kind="book"/><span><strong>{result?'Город через два года':'Пять решений приняты'}</strong><small>{result?`Индекс жизни ${format(result.finalScore)} · открыть итог`:'Считаем последствия…'}</small></span><ControlIcon kind="arrow-right"/></button><button className="icon-control" aria-label="Скрыть приглашение к итогу" onClick={onDismiss}><ControlIcon kind="close" size={18}/></button></aside>;
}
