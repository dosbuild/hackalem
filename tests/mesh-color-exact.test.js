import {describe,expect,it} from 'vitest';
import {rgb,blend} from '../src/world/mesh-kit.js';

const originalRgb=hex=>typeof hex==='string'?hex.replace('#','').match(/../g).map(s=>parseInt(s,16)):hex;
const originalBlend=(a,b,t)=>originalRgb(a).map((v,i)=>v*(1-t)+originalRgb(b)[i]*t);

describe('exact colour reuse',()=>{
 it('preserves raw parser values and errors, including NaN and odd component counts',()=>{
  for(const value of ['#abcdef','abcd','abcdef0','#ggzzqq','abcdef'.repeat(20)])for(let i=0;i<3;i++)expect(rgb(value)).toEqual(originalRgb(value));
  for(const value of ['','#','a','#a'])for(let i=0;i<2;i++)expect(()=>rgb(value)).toThrow(TypeError);
 });
 it('returns fresh mutable string arrays and preserves non-string input identity',()=>{
  const first=rgb('#abcdef'),second=rgb('#abcdef');first[0]=17;first.push(33);expect(second).toEqual([171,205,239]);expect(rgb('#abcdef')).toEqual(second);expect(rgb('#abcdef')).not.toBe(second);
  for(const value of [[],[1,2,3],new Uint8Array([1,2,3]),null,undefined])expect(rgb(value)).toBe(value);
 });
 it('preserves arithmetic, missing components and exceptional numeric factors',()=>{
  for(const a of ['#abcdef','abcd','#ggzzqq'])for(const b of ['#123456','aabb','#zzxxww'])for(const t of [-2,-0,0,.2,.6,1,4,NaN,Infinity])expect(blend(a,b,t)).toEqual(originalBlend(a,b,t));
 });
 it('retains lazy array evaluation and custom map receiver behavior',()=>{
  expect(blend([],'',.2)).toEqual([]);expect(blend([],null,.2)).toEqual([]);
  const a=[1,2,3];a.map=function(fn){expect(this).toBe(a);return ['custom',fn(12,2)];};expect(blend(a,'#aabbcc',.2)).toEqual(['custom',12*.8+204*.2]);
 });
 it('keeps getter and factor coercion order in the public fallback',()=>{
  const getters=fn=>{const log=[],a=[0,0,0],b=[0,0,0];for(let i=0;i<3;i++){Object.defineProperty(a,i,{get(){log.push('a'+i);return i+1;}});Object.defineProperty(b,i,{get(){log.push('b'+i);return i+11;}});}return {value:fn(a,b,.2),log};};expect(getters(blend)).toEqual(getters(originalBlend));
  const coercion=fn=>{let calls=0;const t={valueOf(){return ++calls/20;}};return {value:fn('#abcdef','#123456',t),calls};};expect(coercion(blend)).toEqual(coercion(originalBlend));
 });
});
