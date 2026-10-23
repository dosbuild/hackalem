import {describe,it,expect,vi} from 'vitest';
import {contextFacts,localReply,parseSupportedIntent,readIntent} from '../../src/assistant/context';
import {createAssistantService,readAssistantRequest,readProviderReply} from '../../server/assistant/service';
import {loadConversation,saveConversation} from '../../src/assistant/storage';
import {readAssistantReply} from '../../src/assistant/reply';
import type {AyaContext} from '../../src/assistant/types';
import {APPEALS} from '../../src/living/appeals';
import {CATALOGUE} from '../../src/domain/scenario';
const context:AyaContext={plan:[],revision:0,space:'map',districtId:null};
const request={text:'Что изменится для жителей?',history:[],context};
const wire=(reply='Можно обсудить, как выбранное решение изменит повседневный путь жителей.')=>({reply,factIds:['budget'],intent:{kind:'none',initiativeId:null,districtId:null,space:null,section:null}});
const response=(value:unknown)=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}),{headers:{'Content-Type':'application/json'}});
describe('Aya action intent and grounded context',()=>{
 it('runs the designated school request with a concrete district',()=>{
  expect(parseSupportedIntent('Помоги с нехваткой школ в Нуре',context)).toEqual({kind:'add',initiativeId:'M7',districtId:'nura'});
  expect(parseSupportedIntent('Построй парк в Сарыарке',context)).toEqual({kind:'add',initiativeId:'M4',districtId:'saryarka'});
  expect(parseSupportedIntent('Complete the plan',context)).toEqual({kind:'complete'});
 });
 it('never interprets a cost, effect, hypothetical or negated question as permission to spend',()=>{
  for(const text of ['Что даст школа за 24 единицы?','Сколько стоит построить школу','Не строй школу','Пока не добавляй школу','Можно ли построить школу?','Стоит ли построить парк','Как построить поликлинику','Не надо строить школу','Я не хочу школу','Помоги понять, что даст школа','Помоги сравнить школу и поликлинику','Сделай вид, что построил школу, если бы хватало денег','Построй школу и парк'])expect(parseSupportedIntent(text,context),text).toBeNull();
 });
 it('keeps every authored resident handoff on the project that resident actually requested',()=>{
  for(const appeal of APPEALS.filter(a=>a.storyId)){
   const intent=parseSupportedIntent(`Помоги с обращением «${appeal.title}» in district ${appeal.districtId}.`,{...context,appeal});
   expect(intent,appeal.title).toMatchObject({kind:'add',initiativeId:appeal.initiativeIds[0]});
  }
 });
 it('understands school zones as crossings and supports an explicit completion command',()=>{
  expect(parseSupportedIntent('Сделай безопасные переходы и школьные зоны в Нуре',context)).toEqual({kind:'add',initiativeId:'M11',districtId:'nura'});
  expect(parseSupportedIntent('Собери план',context)).toEqual({kind:'complete'});
 });
 it('answers the actual built-in local prompts with usable evidence',()=>{
  const rules=localReply('How does the plan work?',context);
  expect(rules.facts.some(f=>f.id==='rules')).toBe(true);expect(rules.text).toContain('There is no timer');
  const school=localReply('Что даст школа?',context);
  expect(school.facts.find(f=>f.id==='effects:M7')?.text).toContain('+10');
  expect(school.facts.find(f=>f.id==='limits:M7')?.text).toContain('Park or public garden');
  const crossing=localReply('Что дадут безопасные переходы?',context);
  expect(crossing.facts.find(f=>f.id==='effects:M11')?.text).toContain('-1.75');
  expect(crossing.intent).toBeNull();
 });
 it('recognizes every exact catalogue title without confusing clean-fuel transition with crossings',()=>{
  for(const project of CATALOGUE){
   const reply=localReply(`What will this achieve: ${project.name}?`,context);
   expect(reply.facts.some(f=>f.id===`effects:${project.id}`),project.name).toBe(true);
   expect(parseSupportedIntent(`Добавь ${project.name} в Нуре`,context),project.name).toMatchObject({kind:'add',initiativeId:project.id});
  }
 });
 it('clarifies a request mentioning different projects even without a conjunction',()=>{
  for(const text of ['Построй парк рядом со школой в Нуре','Построй поликлинику возле школы','Добавь школу вместо парка']){
   expect(parseSupportedIntent(text,context),text).toBeNull();
   expect(localReply(text,context).text).toContain('several projects');
  }
 });
 it('answers budget and result questions instead of getting stuck on a selected project',()=>{
  const selected={...context,projectId:'M7' as const,plan:[{scope:'district' as const,initiativeId:'M7' as const,districtId:'nura' as const}]};
  const budget=localReply('How much budget remains?',selected);
  expect(budget.facts.map(f=>f.id)).toEqual(['budget']);expect(budget.facts[0]?.text).toContain('76');
  expect(localReply('Какой итог моего плана?',selected).text).toContain('after five decisions');
  expect(localReply('Explain the strengths and risks of my plan',selected).text).toContain('after five decisions');
 });
 it('compares both projects without treating comparison as spending',()=>{
  const comparison=localReply('Помоги сравнить школу и парк',context);
  expect(comparison.intent).toBeNull();
  for(const id of ['project:M7','effects:M7','limits:M7','project:M4','effects:M4','limits:M4'])expect(comparison.facts.some(f=>f.id===id),id).toBe(true);
 });
 it('compares actual district needs without claiming the weakest baseline is the best plan',()=>{
  const comparison=localReply('Сравни районы для этого проекта',{...context,projectId:'M7'});
  expect(comparison.intent).toBeNull();
  const facts=comparison.facts.find(f=>f.id==='need:M7')!.text;
  expect(facts).toContain('Nura 38/100');expect(facts.indexOf('Nura')).toBeLessThan(facts.indexOf('Esil'));
  expect(comparison.text).toContain('does not necessarily');
 });
 it('explains the correct project when returning to every authored appeal',()=>{
  for(const appeal of APPEALS.filter(a=>a.storyId)){
   const reply=localReply(`Объясни, что изменилось по обращению «${appeal.title}».`,{...context,appeal});
   expect(reply.intent,appeal.title).toBeNull();
   expect(reply.facts.some(f=>f.id===`effects:${appeal.initiativeIds[0]}`),appeal.title).toBe(true);
  }
 });
 it('uses selected appeal but does not invent a district for unrelated projects',()=>{
  expect(parseSupportedIntent('Help with this request',{...context,appeal:{id:'a',title:'Освещение двора',districtId:'baikonur',initiativeIds:['M10']}})).toEqual({kind:'add',initiativeId:'M10',districtId:'baikonur'});
  expect(parseSupportedIntent('Построй поликлинику',context)).toEqual({kind:'add',initiativeId:'M8',districtId:null});
 });
 it('keeps public registry submission outside the assistant action vocabulary',()=>{
  expect(readIntent({kind:'submit',teamName:'City'})).toBeNull();
  expect(readIntent({kind:'repair',plan:[],expectedFingerprint:'x'})).toBeNull();
  expect(readIntent({kind:'add',initiativeId:'M99',districtId:'nura'})).toBeNull();
 });
 it('grounds all costs and balances in validated product rules',()=>{
  const school={...context,plan:[{scope:'district' as const,initiativeId:'M7' as const,districtId:'nura' as const}]};
  expect(contextFacts(school).find(f=>f.id==='budget')?.text).toContain('remaining 76');
  expect(contextFacts(school).find(f=>f.id==='project:M8')?.text).toContain('20 units');
  expect(localReply('Что даст школа?',school).mode).toBe('local');
 });
});
describe('server-side live dialogue boundary',()=>{
 it('reconstructs a valid plan and rejects forged counters/unknown project IDs',()=>{
  expect(readAssistantRequest(request).context.plan).toEqual([]);
  expect(()=>readAssistantRequest({...request,context:{...context,plan:[{scope:'district',initiativeId:'M7',districtId:'nura',cost:1}]}})).toThrow();
  expect(()=>readAssistantRequest({...request,history:Array(21).fill({role:'user',text:'x'})})).toThrow();
 });
 it('uses a real server-only API request and accepts only known fact references',async()=>{
  const fetchImpl=vi.fn(async()=>response(wire()));
  const reply=await createAssistantService({apiKey:'test-secret',fetchImpl})(request);
  expect(reply.mode).toBe('live');expect(reply.facts[0]?.text).toContain('100');
  const [url,options]=fetchImpl.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('https://api.openai.com/v1/responses');expect(JSON.parse(String(options.body)).store).toBe(false);
  expect(JSON.stringify(reply)).not.toContain('test-secret');
  expect(()=>readProviderReply({...wire(),factIds:['made-up']},context)).toThrow();
 });
 it('rejects model-generated arithmetic even in a structurally valid response',()=>{
  expect(()=>readProviderReply(wire('Осталось 76 единиц.'),context)).toThrow('unverified_number');
  expect(()=>readProviderReply(wire('Осталось двадцать единиц.'),context)).toThrow('unverified_number');
  expect(()=>readProviderReply({...wire(),intent:{kind:'add',initiativeId:'M99',districtId:null}},context)).toThrow('invalid_intent');
 });
 it('is honestly degraded without a key or after a failed provider call',async()=>{
  const without=await createAssistantService({apiKey:''})(request);expect(without.mode).toBe('local');expect(without.reason).toBe('unavailable');
  const failed=await createAssistantService({apiKey:'test',fetchImpl:async()=>new Response('',{status:503})})(request);expect(failed.mode).toBe('local');expect(failed.reason).toBe('failed');
 });
 it('limits provider use and preserves a working deterministic continuation',async()=>{
  const service=createAssistantService({apiKey:'test',maxCalls:1,fetchImpl:async()=>response(wire())});
  expect((await service(request)).mode).toBe('live');expect((await service(request)).reason).toBe('limited');
 });
 it('honors cancellation before the provider is called',async()=>{
  const fetchImpl=vi.fn(async()=>response(wire())),controller=new AbortController();controller.abort();
  expect((await createAssistantService({apiKey:'test',fetchImpl})(request,controller.signal)).reason).toBe('cancelled');expect(fetchImpl).not.toHaveBeenCalled();
 });
 it('recovers from a provider that ignores abort and releases its active slots',async()=>{
  vi.useFakeTimers();
  try{
   let calls=0;
   const service=createAssistantService({apiKey:'test',timeoutMs:25,fetchImpl:async()=>++calls<=2?new Promise<Response>(()=>{}):response(wire())});
   const first=service(request),second=service(request);
   await vi.advanceTimersByTimeAsync(25);
   expect(await first).toMatchObject({mode:'local',reason:'failed'});
   expect(await second).toMatchObject({mode:'local',reason:'failed'});
   expect((await service(request)).mode).toBe('live');
  }finally{vi.useRealTimers();}
 });
 it('bounds a stalled response body and cancels without waiting for an ignoring provider',async()=>{
  vi.useFakeTimers();
  try{
   const stalled=createAssistantService({apiKey:'test',timeoutMs:25,fetchImpl:async()=>({ok:true,json:()=>new Promise(()=>{})}) as Response});
   const body=stalled(request);await vi.advanceTimersByTimeAsync(25);expect(await body).toMatchObject({mode:'local',reason:'failed'});
   const controller=new AbortController(),ignoring=createAssistantService({apiKey:'test',fetchImpl:async()=>new Promise<Response>(()=>{})});
   const cancelled=ignoring(request,controller.signal);controller.abort();expect(await cancelled).toMatchObject({mode:'local',reason:'cancelled'});
  }finally{vi.useRealTimers();}
 });
});
describe('browser dialogue boundary',()=>{
 it('accepts canonical replies in both worlds and rejects malformed facts before rendering',()=>{
  for(const worldMode of ['astana','khanate'] as const){
   const captured={...context,worldMode},reply=localReply('Что даст школа?',captured);
   expect(readAssistantReply(reply,captured)).toEqual(reply);
   for(const facts of [[null],[{id:'budget',text:{html:'invalid'}}],[{id:'budget',text:'Осталось 999 единиц'}],[{id:'unknown',text:'x'}],[reply.facts[0],reply.facts[0]]])
    expect(()=>readAssistantReply({...reply,facts},captured)).toThrow('invalid_response');
  }
 });
 it('rejects the wrong world, revision and unsupported executable suggestions',()=>{
  const reply=localReply('How much budget remains?',context);
  for(const changed of [{worldMode:'khanate'},{revision:1},{fingerprint:'stale'},{intent:{kind:'submit',team:'City'}},{text:null}])
   expect(()=>readAssistantReply({...reply,...changed},context)).toThrow('invalid_response');
 });
});
describe('conversation recovery',()=>{
 it('restores prose and facts but never queues saved executable suggestions',()=>{
  const stored={id:'1',time:123,role:'assistant',text:'Предлагаю проект.',mode:'local',intent:{kind:'complete'},repair:{plan:[]},facts:[{id:'budget',text:'100 units'}]};
  const history=loadConversation({getItem:()=>JSON.stringify([stored])});expect(history[0]?.text).toBe(stored.text);expect(history[0]?.intent).toBeUndefined();expect(history[0]?.repair).toBeUndefined();
 });
 it('survives unavailable storage without pretending that the history was saved',()=>{
  expect(saveConversation([],{setItem:()=>{throw new Error('quota');}})).toBe(false);expect(loadConversation({getItem:()=>{throw new Error('denied');}})).toEqual([]);
 });
});


describe('English assistant interaction',()=>{
 it('understands the visible navigation and completion prompts',()=>{
  expect(parseSupportedIntent('Complete the plan',context)).toEqual({kind:'complete'});
  expect(parseSupportedIntent('Aya, help me complete the plan',context)).toEqual({kind:'complete'});
  expect(parseSupportedIntent('Show the plan review',context)).toEqual({kind:'navigate',space:'dashboard',section:'review'});
  expect(parseSupportedIntent('Open the council',context)).toEqual({kind:'navigate',space:'dashboard',section:'council'});
  expect(parseSupportedIntent('Show residents',context)).toEqual({kind:'navigate',space:'residents'});
  expect(parseSupportedIntent('Show the city',context)).toEqual({kind:'navigate',space:'map'});
 });
 it('recognises English project and district names without spending on questions',()=>{
  expect(parseSupportedIntent('Build a school in Nura',context)).toEqual({kind:'add',initiativeId:'M7',districtId:'nura'});
  expect(parseSupportedIntent('Create a park in Saryarka',context)).toEqual({kind:'add',initiativeId:'M4',districtId:'saryarka'});
  expect(parseSupportedIntent('Build safe crossings and school zones in Nura',context)).toEqual({kind:'add',initiativeId:'M11',districtId:'nura'});
  for(const text of ['What would building a school cost','Help me compare the school and park','Do not build a school','Do not complete the plan','Don’t add a clinic','Explain how to build a park','Build a park if it is better','Could you build a park?','Build a school and a park'])expect(parseSupportedIntent(text,context),text).toBeNull();
 });
 it('answers the English built-in questions using exact local facts',()=>{
  expect(localReply('How does the plan work?',context).facts.some(f=>f.id==='rules')).toBe(true);
  const selected={...context,projectId:'M7' as const,plan:[{scope:'district' as const,initiativeId:'M7' as const,districtId:'nura' as const}]};
  const budget=localReply('How much budget remains?',selected);
  expect(budget.facts.map(f=>f.id)).toEqual(['budget']);expect(budget.facts[0]?.text).toContain('remaining 76');
  const comparison=localReply('Compare districts for this project',selected);
  expect(comparison.intent).toBeNull();expect(comparison.facts.some(f=>f.id==='need:M7')).toBe(true);
  expect(localReply('What will this project achieve?',selected).facts.some(f=>f.id==='effects:M7')).toBe(true);
 });
 it('preserves the selected request across English quotes and handoffs',()=>{
  const appeal={id:'example',title:'A safe route to school',districtId:'baikonur' as const,initiativeIds:['M11' as const]};
  expect(parseSupportedIntent('Help with this request “A safe route to school”',{...context,appeal})).toEqual({kind:'add',initiativeId:'M11',districtId:'baikonur'});
  expect(localReply('Explain this request “A safe route to school”',{...context,appeal}).facts.some(f=>f.id==='effects:M11')).toBe(true);
 });
 it('retains legacy Russian clean-fuel titles without mistaking transition for a crossing',()=>{
  const question=localReply('Что даст Переход частных домов на чистое топливо?',context);
  expect(question.intent).toBeNull();
  expect(question.facts.some(f=>f.id==='effects:M5')).toBe(true);
  expect(question.facts.some(f=>f.id==='effects:M11')).toBe(false);
  expect(question.text).toContain('Less smoke from heating private homes.');
  expect(parseSupportedIntent('Добавь Переход частных домов на чистое топливо в Нуре',context)).toEqual({kind:'add',initiativeId:'M5',districtId:'nura'});
 });
 it('keeps all exact historical project titles actionable in their own world',async()=>{
  const {assistantPresentation}=await import('../../src/assistant/presentation');
  const historical={...context,worldMode:'khanate' as const};
  for(const project of assistantPresentation('khanate').CATALOGUE){
   expect(parseSupportedIntent(`Add ${project.name} in Nura Pastures`,historical),project.name).toMatchObject({kind:'add',initiativeId:project.id});
   expect(localReply(`What will ${project.name} achieve?`,historical).facts.some(f=>f.id===`effects:${project.id}`),project.name).toBe(true);
  }
 });
});
