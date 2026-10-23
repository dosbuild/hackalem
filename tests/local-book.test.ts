import {describe,it,expect} from 'vitest';
import {parseLocalBook} from '../src/services/local-book';
import {buildCouncil} from '../src/core/council';
import type {Plan} from '../src/domain/types';
const plan:Plan=[{initiativeId:'M4',scope:'district',districtId:'esil'},{initiativeId:'M8',scope:'district',districtId:'nura'},{initiativeId:'M11',scope:'district',districtId:'almaty'},{initiativeId:'M12',scope:'citywide'},{initiativeId:'M14',scope:'citywide'}];
describe('local chronicle recovery',()=>{
 it('retains a complete council while dropping damaged adjacent records',()=>{
  const council=buildCouncil(plan,'fixture','2026-10-04T00:00:00Z');
  const book=parseLocalBook(JSON.stringify({sessions:[null,council,{...council,members:null},{...council,recommendation:{}}],entries:[]}), 'astana');
  expect(book.sessions).toEqual([council]);
 });
 it('keeps historical and legacy modern records separate',()=>{
  const council=buildCouncil(plan,'fixture','2026-10-04T00:00:00Z');
  expect(parseLocalBook(JSON.stringify({sessions:[council]}),'khanate').sessions).toEqual([]);
  expect(parseLocalBook(JSON.stringify({sessions:[{...council,worldMode:'khanate'}]}),'khanate').sessions).toHaveLength(1);
 });
 it('recovers from malformed and obsolete content without throwing',()=>{
  for(const raw of ['{bad','null','[]','{"entries":[{"plan":[]}]}'])expect(parseLocalBook(raw,'astana')).toEqual({sessions:[],entries:[]});
 });
});
