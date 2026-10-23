import {describe,it,expect} from 'vitest';
import {APPEALS,STORIES,APPEAL_BY_ID,getAppealRelation,getStoryConversation,SOURCES} from '../src/living/appeals';
import {createWalkers,nextReplacement,arriveReplacement,POCKETS} from '../src/living/motion';
import {DISTRICT_IDS,INITIATIVE_IDS} from '../src/domain/types';
import {appReducer,initialState} from '../src/app/state';
import {fixture} from './fixtures';

describe('formal civic scenarios',()=>{
 it('contains 240 distinct complete appeals and every initiative/district encounter',()=>{
  expect(APPEALS).toHaveLength(240);expect(STORIES).toHaveLength(70);
  expect(new Set(APPEALS.map(a=>a.id)).size).toBe(240);
  expect(new Set(APPEALS.map(a=>a.circumstances)).size).toBe(240);
  for(const district of DISTRICT_IDS){expect(APPEALS.filter(a=>a.districtId===district)).toHaveLength(48);for(const id of INITIATIVE_IDS)expect(STORIES.filter(s=>s.districtId===district&&s.initiativeId===id)).toHaveLength(1);}
  for(const appeal of APPEALS){expect(appeal.circumstances.length,`${appeal.id}: ${appeal.circumstances}`).toBeGreaterThan(75);expect(appeal.request.length,`${appeal.id}: ${appeal.request}`).toBeGreaterThan(45);expect(appeal.addressee).toContain('Mayor (Akim)');expect(appeal.applicant.length).toBeGreaterThan(3);expect(appeal.initiativeIds.length).toBeGreaterThan(0);expect(appeal.sourceIds.every(id=>SOURCES[id].url.startsWith('https://'))).toBe(true);}
  expect(APPEALS.filter(a=>!a.storyId)).toHaveLength(170);
 });
 it('separates a chosen school, a commitment and model evidence from resolution of an appeal',()=>{
  const story=STORIES.find(s=>s.initiativeId==='M7'&&s.districtId==='nura')!,appeal=APPEAL_BY_ID[story.appealId]!;
  let state=initialState();expect(getAppealRelation(appeal,state).kind).toBe('draft');
  state=appReducer(state,{type:'district',districtId:'nura'});state=appReducer(state,{type:'choose',initiativeId:'M7'});expect(getAppealRelation(appeal,state).kind).toBe('considering');
  state=appReducer(state,{type:'confirm'});expect(getAppealRelation(appeal,state).kind).toBe('committed');expect(getStoryConversation(story,state,'remaining').text).toContain('does not mean');
  const complete=appReducer(initialState(fixture,true),{type:'evaluate'});expect(getAppealRelation(appeal,complete).resultId).toBe(complete.result!.value.resultId);expect(getAppealRelation(appeal,complete).description).not.toContain('Request resolved');
 });
 it('cycles visible people through entrances and protects an active interlocutor',()=>{
  let walkers=createWalkers('nura',true);expect(walkers).toHaveLength(5);const pinned=walkers[0]!.storyId,seen=new Set(walkers.map(w=>w.storyId));
  for(let i=0;i<8;i++){
   walkers=nextReplacement(walkers,pinned,i,'nura',true,8000+i*10000);const departed=walkers.find(w=>w.phase==='leaving')!;expect(departed.storyId).not.toBe(pinned);expect(departed.point).toEqual(POCKETS.nura.entrance);
   walkers=arriveReplacement(walkers,departed,i,'nura',true,12000+i*10000);const arrived=walkers.find(w=>w.phase==='arriving')!;expect(arrived.point).toEqual(POCKETS.nura.entrance);seen.add(arrived.storyId);walkers=walkers.map(w=>({...w,phase:'staying'}));
  }
  expect(seen.size).toBeGreaterThanOrEqual(10);expect(walkers.some(w=>w.storyId===pinned)).toBe(true);expect(createWalkers('nura',false)).toHaveLength(10);
 });
 it('lets an existing resident leave before an absent appeal author enters',()=>{
  const rows=createWalkers('nura',true),requested=STORIES.find(s=>s.districtId==='esil'&&s.initiativeId==='M7')!;
  const departing={...rows[4]!,phase:'leaving' as const,nextStoryId:requested.id};
  const pending=rows.map((w,i)=>i===4?departing:w);
  expect(pending.some(w=>w.storyId===requested.id)).toBe(false);
  const arrived=arriveReplacement(pending,departing,0,'nura',true,4000);
  expect(arrived).toHaveLength(5);expect(arrived[4]!.storyId).toBe(requested.id);
  expect(arrived[4]!.point).toEqual(POCKETS.esil.entrance);expect(arrived[4]!.phase).toBe('arriving');
 });

});
