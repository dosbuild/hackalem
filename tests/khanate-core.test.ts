import {describe,it,expect} from 'vitest';
import {buildCouncil,checkPackage} from '../src/core/council';
import {localReply,parseSupportedIntent,contextFacts} from '../src/assistant/context';
import {currencyUnit} from '../src/modes/format';
import khanate from '../src/modes/khanate';
import type {Plan} from '../src/domain/types';
import type {AyaContext} from '../src/assistant/types';
const plan:Plan=[{initiativeId:'M7',scope:'district',districtId:'esil'},{initiativeId:'M4',scope:'district',districtId:'saryarka'},{initiativeId:'M10',scope:'district',districtId:'saryarka'},{initiativeId:'M12',scope:'citywide'},{initiativeId:'M1',scope:'district',districtId:'saryarka'}];
const context={worldMode:'khanate',plan:[],revision:0,districtId:null,projectId:null,space:'map'} as AyaContext;
describe('one model, two authored worlds',()=>{
 it('keeps every council alternative, score, impact and vote identical',()=>{
  const modern=buildCouncil(plan,'modern','2026-10-04'),past=buildCouncil(plan,'past','2026-10-04',khanate);
  expect(past.fingerprint).toBe(modern.fingerprint);expect(past.score).toBe(modern.score);
  expect(past.amendments).toEqual(modern.amendments);
  expect(past.originalAssessment).toEqual(modern.originalAssessment);
  for(const a of modern.amendments.slice(0,7))expect(checkPackage(plan,past.amendments,[a.id])).toEqual(checkPackage(plan,modern.amendments,[a.id]));
  expect(past.members).toHaveLength(8);expect(past.members).not.toEqual(modern.members);
  expect(JSON.stringify(past.events)).not.toMatch(/автобус|светофор|поликлиник|школ|аким/i);
 });
 it('recognizes historical requests without treating a question as a command',()=>{
  expect(parseSupportedIntent('Построй учебные юрты у Речного берега',context)).toEqual({kind:'add',initiativeId:'M7',districtId:'esil'});
  expect(parseSupportedIntent('Открой дом прошений и гонцы',context)).toEqual({kind:'add',initiativeId:'M12',districtId:null});
  expect(parseSupportedIntent('Что дадут учебные юрты?',context)).toBeNull();
  expect(parseSupportedIntent('Не строй учебные юрты',context)).toBeNull();
  expect(parseSupportedIntent('Построй общий сад и учебные юрты',context)).toBeNull();
  expect(parseSupportedIntent('Покажи прошения',context)).toEqual({kind:'navigate',space:'residents'});
  const reply=localReply('Что дадут учебные юрты?',context);expect(reply.worldMode).toBe('khanate');expect(reply.intent).toBeNull();
  expect(JSON.stringify(contextFacts(context))).not.toMatch(/автобус|светофор|поликлиник|район|кварталов/i);
 });
 it('uses English singular and plural currency units',()=>{
  expect([1,2,4,5,11,14,21,22,24,100].map(n=>currencyUnit('khanate',n))).toEqual(['coin','coins','coins','coins','coins','coins','coins','coins','coins','coins']);
  expect(currencyUnit('astana',24)).toBe('units');
 });
});
