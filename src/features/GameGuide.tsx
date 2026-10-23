import {useContent} from '../modes/content';
import {Modal} from '../ui/Modal';
import {RULES} from '../domain/scenario';
import {HistoricalInvitation} from '../modes/ModeControl';

export function GameGuide({onClose,onContinue}:{onClose:()=>void;onContinue:()=>void}) {
 const {mode,terms,text}=useContent();
 return <Modal title="Five decisions for your city" onClose={onClose}>
  <p className="game-guide-lead">Help the city through five decisions. Each starts with someone’s everyday concern.</p>
  <div className="game-guide-numbers"><div><strong>{RULES.budget}</strong><span>{mode.id==='khanate'?'coins in the treasury':'budget units'}</span></div><div><strong>{RULES.decisionCount}</strong><span>distinct projects</span></div><div><strong>{RULES.horizon}</strong><span>{terms.seasons} until the result</span></div></div>
  <ol className="game-guide-steps"><li><strong>Hear a need</strong><p>Choose a story. The camera shows the site; the card explains the project and its price.</p></li><li><strong>Build your plan</strong><p>Confirm a project. The budget remembers every funded project. Any decision can be changed.</p></li><li><strong>See the consequences</strong><p>After the fifth decision, the city stays in view and you can open the result. Revisit people, compare a replacement or convene the council.</p></li></ol>
  <details className="game-guide-formula"><summary>Rules and final score</summary><p>Five distinct projects, at most two from one policy area. Conflicts and the budget are checked automatically.</p><p>70% — the population-weighted city average. 30% is the lowest score among the five parts of the city. Every local indicator below 40 reduces the result by one point. Unused budget earns no bonus.</p></details>
  <p className="game-guide-note">There is no timer. {text.fictional}</p>
  <p className="game-guide-note">Alem was built for a hackathon assignment. We followed the supplied technical specification exactly for the scenario data, budget, selection rules and eight-quarter calculation. Both worlds use that same verified model.</p>
  <HistoricalInvitation/>
  <footer><button className="primary" onClick={onContinue}>Continue playing</button></footer>
 </Modal>;
}
