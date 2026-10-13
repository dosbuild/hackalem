import {describe,it,expect} from 'vitest';
import {momentFor,readMoments,toggleMoment} from '../src/residents/moments';
import {anchorFor,observe} from '../src/residents/engine';
import {RESIDENT_BY_ID} from '../src/residents/population';
import {readJourney} from '../src/aya/journey';
import {appReducer,initialState} from '../src/app/state';
import {oracle} from './scenario-oracle';
const moment=(id:string)=>{const r=RESIDENT_BY_ID[id]!;return {residentId:id,momentId:momentFor(r).id,anchor:anchorFor(r)};};
describe('player chosen moments',()=>{
 it('retains three places without silently evicting another and toggles explicitly',()=>{
  const three=['esil-01','nura-01','baikonur-01'].map(moment),fourth=moment('almaty-01');
  expect(toggleMoment(three,fourth)).toBe(three);
  const removed=toggleMoment(three,three[1]!);expect(removed.map(x=>x.residentId)).toEqual(['esil-01','baikonur-01']);
  expect(toggleMoment(removed,fourth)).toHaveLength(3);
 });
 it('restores known authored identities and exact anchors without trusting stored labels or locations',()=>{
  const m=moment('esil-01');
  expect(readMoments([{residentId:'toString',momentId:'everyday:undefined',anchor:{}}])).toEqual([]);
  expect(readMoments([m,m,{...m,residentId:'fake'},{...m,anchor:{...m.anchor,districtId:'nura'}},{...m,momentId:'invented'}])).toEqual([m]);
  expect(readMoments([{...m,anchor:{...m.anchor,label:'injected'}}])[0]!.anchor.label).toBe(m.anchor.label);
  const approach={...m,anchor:{...m.anchor,id:'landmark:expo:approach'}};
  expect(readMoments([approach])[0]!.anchor.id).toBe(m.anchor.id);
  expect(readMoments([{...approach,anchor:{...approach.anchor,id:'landmark:palace:approach'}}])).toEqual([]);
 });
 it('migrates both removed approaches and rejects a null anchor on other residents',()=>{
  for(const [id,legacy] of [['esil-01','landmark:expo:approach'],['saryarka-01','landmark:atyrau:approach']]){
   const m=moment(id!);
   expect(readMoments([{...m,anchor:{...m.anchor,id:legacy}}])).toEqual([m]);
  }
  const m=moment('nura-01');
  expect(readMoments([{...m,anchor:{...m.anchor,id:null}}])).toEqual([]);
 });
 it('preserves moments independently of evaluation, adoption and discard with no budget fields',()=>{
  const moments=['esil-01','nura-01','baikonur-01'].map(moment);
  const journey=readJourney(JSON.stringify({introduced:true,guidance:'quiet',moments,spent:0,score:100}));
  let s=appReducer(initialState(oracle.cases.negative.plan),{type:'evaluate'});const original=s.result;
  s=appReducer(s,{type:'beginAlternative',initiativeId:'M4'});s=appReducer(s,{type:'choose',initiativeId:'M5'});s=appReducer(s,{type:'confirm'});s=appReducer(s,{type:'discardAlternative'});
  expect(s.result).toBe(original);expect(journey.moments).toEqual(moments);expect(journey).not.toHaveProperty('score');
 });
 it('grounds an approach scene in its actual district while preserving the resident identity',()=>{
  const s=appReducer(initialState(oracle.cases.negative.plan),{type:'evaluate'}),r=RESIDENT_BY_ID['esil-01']!;
  const anchor={...anchorFor(r),id:'landmark:expo:approach'};
  const o=observe(r,s,anchor);
  expect(o.evidence.anchorId).toBe(anchor.id);expect(o.evidence.districtId).toBe('esil');expect(o.evidence.resultId).toBe(s.result!.value.resultId);expect(o.treatment).toBe('M4');
  expect(observe(r,s).evidence.anchorId).toBe('esil:garden');
 });
});
