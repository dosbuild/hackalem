import {useContent} from '../modes/content';
import {Modal} from '../ui/Modal';
import {RULES} from '../domain/scenario';
import {HistoricalInvitation} from '../modes/ModeControl';

export function GameGuide({onClose,onContinue}:{onClose:()=>void;onContinue:()=>void}) {
 const {mode,terms,text}=useContent();
 return <Modal title="Пять решений для вашего города" onClose={onClose}>
  <p className="game-guide-lead">Помогите городу пятью решениями. Каждое начинается с чьей-то повседневной заботы.</p>
  <div className="game-guide-numbers"><div><strong>{RULES.budget}</strong><span>{mode.id==='khanate'?'монет в казне':'единиц бюджета'}</span></div><div><strong>{RULES.decisionCount}</strong><span>разных проектов</span></div><div><strong>{RULES.horizon}</strong><span>{terms.seasons} до итога</span></div></div>
  <ol className="game-guide-steps"><li><strong>Услышьте потребность</strong><p>Выберите историю. Камера покажет место, а карточка — проект и его цену.</p></li><li><strong>Соберите свой план</strong><p>Подтвердите проект. Бюджет хранит все профинансированные проекты. Любое решение можно изменить.</p></li><li><strong>Проверьте последствия</strong><p>После пятого решения город останется перед вами, а итог можно открыть. Вернитесь к людям, сравните замену или соберите совет.</p></li></ol>
  <details className="game-guide-formula"><summary>Правила и итоговый балл</summary><p>Пять разных проектов, не больше двух из одной сферы. Несовместимые решения и бюджет проверяются автоматически.</p><p>70% — среднее по городу с учётом населения. 30% — самый низкий балл среди пяти частей города. Каждый местный показатель ниже 40 уменьшает итог на один балл. Неиспользованный бюджет бонуса не даёт.</p></details>
  <p className="game-guide-note">Таймера нет. {text.fictional}</p>
  <HistoricalInvitation/>
  <footer><button className="primary" onClick={onContinue}>Продолжить игру</button></footer>
 </Modal>;
}
