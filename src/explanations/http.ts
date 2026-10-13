import {STATIC_BUILD} from '../services/environment';
import type { ExplanationProvider } from './explain';
import { SCENARIO_VERSION } from '../domain/scenario';

/** Only a scoped plan crosses the same-origin boundary; the server recomputes it. */
export const httpExplanation:ExplanationProvider = async (request,signal) => {
  if(STATIC_BUILD)throw Error('local_explanation');
  const response=await fetch(`${import.meta.env.BASE_URL}api/explanation`,{
    method:'POST',headers:{'Content-Type':'application/json'},signal,
    body:JSON.stringify({modelVersion:SCENARIO_VERSION,plan:request.scenario.plan}),
  });
  if(!response.ok) throw new Error('explanation_unavailable');
  return response.json();
};
