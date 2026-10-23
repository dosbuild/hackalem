// Rendering consumes the authoritative result; it never calculates project effects.
const ledgers=new WeakMap();
const fingerprint=plan=>plan.map(d=>`${d.initiativeId}@${d.scope==='citywide'?'city':d.districtId}`).sort().join('|');

export function currentPresentationResult(props){
 const wrapped=props.result,value=wrapped?.value;
 if(!value?.resultId||!Array.isArray(value.plan)||!Array.isArray(value.indicatorEvidence))return null;
 const key=fingerprint(props.commitments??[]);
 if(wrapped.revision!==(props.scenarioRevision??wrapped.revision)||value.planFingerprint!==key||fingerprint(value.plan)!==key||value.resultId!==`${value.scenarioVersion}/${key}`)return null;
 return value;
}

export function projectPresentation(props,initiativeId,districtId,proposal=false){
 if(proposal)return {phase:'preview',evidence:[],resultId:null};
 const result=currentPresentationResult(props);
 if(!result)return {phase:'planned',evidence:[],resultId:null};
 let ledger=ledgers.get(result);
 if(!ledger){ledger=new Map();ledgers.set(result,ledger);}
 const key=`${initiativeId}:${districtId}`;
 if(!ledger.has(key))ledger.set(key,Object.freeze(result.indicatorEvidence.filter(row=>row.districtId===districtId&&[...row.measureEffects,...row.synergies].some(effect=>effect.initiativeIds.includes(initiativeId)))));
 return {phase:(props.comparisonPosition??1)<.5?'baseline':'evaluated',evidence:ledger.get(key),resultId:result.resultId};
}
