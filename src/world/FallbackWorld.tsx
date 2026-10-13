import {ControlIcon} from '../ui/ControlIcon';
import {useContent} from '../modes/content';
import type { WorldProps } from './contract';
import MapPreview from './MapPreview';

export default function FallbackWorld(props:WorldProps) {
  const {INITIATIVES,districtName,scopeName,text}=useContent();
  // This sheet keeps planning available; native readiness comes from CityWorld.
  // Reporting ready here started the isolated demo before its city existed.
  return <section className="world-harness" aria-label={text.worldTitle}>
    <MapPreview {...props}/>
    <div className="world-heading"><div><p className="eyebrow">{text.harness}</p><h2>{text.worldTitle}</h2></div></div>
    <p className="world-help">{text.worldHelp}</p>
    <div className="district-list">
      {props.districts.map(d => {
        const commitments = props.commitments.filter(c => c.scope === 'district' && c.districtId === d.id);
        const proposed = props.candidate?.decision.scope === 'district' && props.candidate.decision.districtId === d.id;
        return <div key={d.id} className={`district-row ${props.focusedDistrict === d.id ? 'focused' : ''}`}>
          <button className="district-button" aria-pressed={props.focusedDistrict === d.id} onClick={() => props.onDistrictSelect(d.id)}><span>{d.name}</span><ControlIcon kind="arrow-right" size={18}/></button>
          <div className="district-state">{commitments.length ? commitments.map(c => <button className="commitment-chip" key={c.initiativeId} aria-pressed={props.selectedCommitment === c.initiativeId} onClick={() => props.onCommitmentSelect(c.initiativeId)}>{c.initiativeId} · {INITIATIVES[c.initiativeId].name}</button>) : <span>{text.noCommitments}</span>}
            {proposed && <span className="proposal-chip">{text.proposed}: {props.candidate?.decision.initiativeId}</span>}
          </div>
        </div>;
      })}
    </div>
    <div className="city-projects"><h3>{text.cityProjects}</h3>
      {props.commitments.filter(c => c.scope === 'citywide').map(c => <button key={c.initiativeId} className="commitment-chip" onClick={() => props.onCommitmentSelect(c.initiativeId)}>{INITIATIVES[c.initiativeId].name}</button>)}
      {!props.commitments.some(c => c.scope === 'citywide') && <span className="muted">{text.noCommitments}</span>}
      {props.candidate?.decision.scope === 'citywide' && <p className="proposal-chip">{text.proposed}: {INITIATIVES[props.candidate.decision.initiativeId].name}</p>}
    </div>
    {props.candidate && <p className="world-proposal">{text.proposal}: {INITIATIVES[props.candidate.decision.initiativeId].name} · {scopeName(props.candidate.decision)}</p>}
    <p className="world-caption">{text.camera}: {props.cameraRequest.kind === 'overview' ? text.overview : districtName(props.cameraRequest.districtId)}
      {props.result && <> · {text.futureAvailable} · {text.divider(props.comparisonPosition * 100)}</>}
    </p>
  </section>;
}
