import { evaluatePlan } from '../src/domain/evaluate';
import { SCENARIO_VERSION } from '../src/domain/scenario';
import { scenarioEvidence } from '../src/domain/evidence';
import { explanationStatements, requestExplanation } from '../src/explanations/explain';
import type { ExplanationRequest } from '../src/explanations/explain';

export function calculateRequest(input:unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_request');
  const value = input as Record<string,unknown>;
  if (Object.keys(value).some(k=> !['plan','modelVersion'].includes(k)) || value.modelVersion !== SCENARIO_VERSION)
    throw new Error('invalid_version');
  const outcome = evaluatePlan(value.plan);
  if (!outcome.ok) throw new Error('invalid_plan');
  return outcome.result;
}

function wireReply(request:ExplanationRequest, ids:unknown) {
  if (!Array.isArray(ids)) throw new Error('invalid_response');
  const refs = [...new Set(ids.flatMap(id=>request.statements.find(s=>s.id===id)?.refs??[]))];
  return {resultId:request.resultId,statementIds:ids,evidence:refs.map(ref=>{
    const fact=request.evidence.find(e=>e.ref===ref)!;
    return {ref,values:fact.values};
  })};
}

/** Process-wide usage ceiling; no client endpoint/model/instructions or scores are trusted. */
export function createExplanationService({apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL||'gpt-4.1-mini',fetchImpl=fetch,timeoutMs=6500,maxCalls=200,now=Date.now}:{apiKey?:string|undefined;model?:string;fetchImpl?:typeof fetch;timeoutMs?:number;maxCalls?:number;now?:()=>number}={}) {
  const cache = new Map<string,unknown>(), starts:number[]=[];
  let active=0, calls=0;
  return async (input:unknown, signal?:AbortSignal) => {
    const result=calculateRequest(input);
    if (cache.has(result.resultId)) return cache.get(result.resultId);
    const fallback=(reason:string)=>({resultId:result.resultId,mode:'local',reason});
    if (!apiKey) return fallback('unavailable');
    while(starts.length && starts[0]! <= now()-60000) starts.shift();
    if(active>=2 || starts.length>=20 || calls>=maxCalls) return fallback('limited');
    if(signal?.aborted) return fallback('cancelled');
    active++;calls++;starts.push(now());
    try {
      const reply=await requestExplanation(result,{...(signal?{signal}:{}),timeoutMs,provider:async(request,providerSignal)=>{
        const response=await fetchImpl('https://api.openai.com/v1/responses',{
          method:'POST',signal:providerSignal,headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
          body:JSON.stringify({model,store:false,max_output_tokens:1200,
            instructions:'You are the editorial assistant for a synthetic Astana planning model. Select and order the supplied statement IDs for a concise English explanation. Include each of the four sections and ALL critical and negative statements. Do not calculate, add claims, choose policies or write prose. Return only statementIds. Numbers and evidence are supplied by the deterministic application.',
            input:JSON.stringify({statements:request.statements}),
            text:{format:{type:'json_schema',name:'alem_explanation',strict:true,schema:{type:'object',properties:{statementIds:{type:'array',items:{type:'string',enum:request.statements.map(s=>s.id)}}},required:['statementIds'],additionalProperties:false}}}})
        });
        if(!response.ok) throw new Error('provider_failure');
        const data=await response.json();
        if(data.status!=='completed') throw new Error('incomplete');
        const text=data.output?.flatMap((item:{type:string;content?:{type:string;text?:string}[]})=>item.type==='message'?item.content??[]:[]).filter((item:{type:string})=>item.type==='output_text').map((item:{text:string})=>item.text).join('');
        if(typeof text!=='string'||text.length>12000) throw new Error('invalid_response');
        const parsed=JSON.parse(text);
        if(!parsed||Object.keys(parsed).some(k=>k!=='statementIds')) throw new Error('invalid_response');
        return wireReply(request,parsed.statementIds);
      }});
      if(reply.mode!=='ai-selected') return fallback(reply.reason||'failed');
      const response={resultId:result.resultId,statementIds:reply.statements.map(s=>s.id),evidence:scenarioEvidence(result).filter(e=>reply.statements.some(s=>s.refs.includes(e.ref))).map(e=>({ref:e.ref,values:e.values}))};
      cache.set(result.resultId,response);
      if(cache.size>100) cache.delete(cache.keys().next().value!);
      return response;
    } finally {active--;}
  };
}

export {explanationStatements};
