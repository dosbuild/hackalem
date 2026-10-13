import type {CorePresentation} from '../../src/core/presentation';
import {hasUnverifiedNumber} from '../numeric-prose';
import {withProviderDeadline} from '../provider-deadline';
import type { Analysis, PlanReview } from '../../src/dashboard/types';

export {localAnalysis} from '../../src/core/analysis';
import {localAnalysis} from '../../src/core/analysis';
export function createAnalysisService({apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL||'gpt-4.1-mini',fetchImpl=fetch,timeoutMs=9000}:{apiKey?:string|undefined;model?:string;fetchImpl?:typeof fetch;timeoutMs?:number}={}) {
 const cache=new Map<string,Analysis>();let active=0,calls=0;
 return async(review:PlanReview,world?:CorePresentation):Promise<Analysis>=>{
  const key=`${world?.id??'astana'}:${review.fingerprint}`;
  if(cache.has(key))return cache.get(key)!;
  if(!apiKey)return localAnalysis(review,'unavailable',world);
  if(active>=2||calls>=200)return localAnalysis(review,'limited',world);
  active++;calls++;
  try {
   const facts={world,result:review.result,moves:review.moves,swaps:review.swaps.slice(0,3),rank:review.rank,total:review.total};
   const data=await withProviderDeadline(async providerSignal=>{
   const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',signal:providerSignal,headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,store:false,max_output_tokens:1500,instructions:(world?.id==='khanate'?'Ты хранитель летописи вымышленного казахского города конца XVIII века. Используй исторические имена проектов и кварталов из world; обращайся к игроку как к хану. ':'Ты аналитик учебной симуляции Астаны. ')+ ' На русском объясни сильные стороны, риски и рекомендации из переданных фактов. Не считай и не придумывай данные. Не используй никакие цифры или числовые утверждения: точные числа интерфейс показывает отдельно из движка. Не обещай реальных исходов, не утверждай закрытие обращений. Объясни конфликт целей и предложенные замены простыми словами. Верни только JSON со strengths, risks, recommendations: в каждом от одного до трёх коротких предложений. Никаких других ключей.',input:JSON.stringify(facts),text:{format:{type:'json_schema',name:'alem_analysis',strict:true,schema:{type:'object',properties:{strengths:{type:'array',items:{type:'string'}},risks:{type:'array',items:{type:'string'}},recommendations:{type:'array',items:{type:'string'}}},required:['strengths','risks','recommendations'],additionalProperties:false}}}})});
   if(!response.ok)throw new Error('provider_failure');
   return await response.json();
   },timeoutMs);
   if(data.status!=='completed')throw new Error('incomplete');
   const text=data.output?.flatMap((item:{type:string;content?:{type:string;text?:string}[]})=>item.type==='message'?item.content??[]:[]).filter((item:{type:string})=>item.type==='output_text').map((item:{text:string})=>item.text).join('');
   if(typeof text!=='string'||text.length>10000)throw new Error('invalid_response');
   const parsed=JSON.parse(text) as Record<string,unknown>;
   if(Object.keys(parsed).some(k=>!['strengths','risks','recommendations'].includes(k)))throw new Error('invalid_response');
   for(const key of ['strengths','risks','recommendations'])if(!Array.isArray(parsed[key])||parsed[key].length<1||parsed[key].length>3||parsed[key].some((s:unknown)=>typeof s!=='string'||s.length<5||s.length>650||hasUnverifiedNumber(s)))throw new Error('unverified_numbers');
   const result:Analysis={fingerprint:review.fingerprint,mode:'ai',reason:null,strengths:parsed.strengths as string[],risks:parsed.risks as string[],recommendations:parsed.recommendations as string[]};
   if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,result);return result;
  } catch(error) {return localAnalysis(review,error instanceof Error&&error.message==='provider_timeout'?'timeout':'failed',world);} finally {active--;}
 };
}
