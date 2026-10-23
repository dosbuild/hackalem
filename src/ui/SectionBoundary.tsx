import {Component} from 'react';
import type {ReactNode} from 'react';
import './section-recovery.css';

/** A failed optional book must not unmount the city or the in-memory plan. */
export class SectionBoundary extends Component<{
 children:ReactNode;
 title:string;
 onBack:()=>void;
 canReload:boolean;
 saveBeforeReload:()=>boolean;
},{failed:boolean;saveFailed:boolean}> {
 state={failed:false,saveFailed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){
  if(!this.state.failed)return this.props.children;
  return <section className="section-recovery paper-sheet" role="alert" aria-labelledby="section-recovery-title">
   <p className="eyebrow">SECTION DID NOT OPEN</p>
   <h2 id="section-recovery-title">{this.props.title}</h2>
   <p>This section could not load. Your current plan remains in the game; return to the city and continue.</p>
   {this.props.canReload&&!this.state.saveFailed?<p>Reload the page to load this section again. Saved decisions will be restored.</p>:<p>Your browser is not saving decisions. Keep using this tab to retain your current plan.</p>}
   <div className="button-row"><button className="primary" onClick={this.props.onBack}>Return to the city</button>{this.props.canReload&&!this.state.saveFailed&&<button onClick={()=>{if(this.props.saveBeforeReload())location.reload();else this.setState({saveFailed:true});}}>Reload page</button>}</div>
  </section>;
 }
}
