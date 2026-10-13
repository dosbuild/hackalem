import {contextFacts,readIntent} from './context';
import {planFingerprint} from '../domain/identity';
import type {AssistantReply,AyaContext,AyaFact} from './types';

const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** Malformed or stale network replies recover locally before they reach React. */
export function readAssistantReply(input:unknown,context:AyaContext):AssistantReply {
 if(!record(input)||!['local','live'].includes(String(input.mode))||typeof input.text!=='string'||!input.text.trim()||input.text.length>4000
  ||input.fingerprint!==planFingerprint(context.plan)||input.revision!==context.revision||(input.worldMode??'astana')!==(context.worldMode??'astana')
  ||!Array.isArray(input.facts))throw Error('invalid_response');
 const known=contextFacts(context),seen=new Set<string>(),facts:AyaFact[]=[];
 if(input.facts.length>known.length)throw Error('invalid_response');
 for(const value of input.facts){
  if(!record(value)||typeof value.id!=='string'||seen.has(value.id))throw Error('invalid_response');
  const fact=known.find(item=>item.id===value.id);
  if(!fact||value.text!==fact.text)throw Error('invalid_response');
  seen.add(fact.id);facts.push(fact);
 }
 const intent=readIntent(input.intent);
 if(input.intent!==null&&input.intent!==undefined&&!intent)throw Error('invalid_response');
 if(input.reason!==undefined&&!['unavailable','failed','limited','cancelled'].includes(String(input.reason)))throw Error('invalid_response');
 return {worldMode:context.worldMode??'astana',mode:input.mode as AssistantReply['mode'],text:input.text,facts,intent,
  fingerprint:planFingerprint(context.plan),revision:context.revision,...(input.reason===undefined?{}:{reason:input.reason as NonNullable<AssistantReply['reason']>})};
}
