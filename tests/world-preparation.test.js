import {describe,it,expect,vi} from 'vitest';
import {completeWorldPreparation} from '../src/world/world-preparation.js';
import {prepareCity} from '../src/world/city-residency.js';

function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

describe('parallel complete-world startup',()=>{
 it('starts both preparations together and stays hidden until both finish',async()=>{
  const install=deferred(),city=deferred(),started=[],ready=vi.fn();
  const work=completeWorldPreparation(new AbortController(),[
   ()=>{started.push('install');return install.promise;},
   ()=>{started.push('city');return city.promise;}
  ]).then(ready);
  await tick();expect(started).toEqual(['install','city']);
  city.resolve();await tick();expect(ready).not.toHaveBeenCalled();
  install.resolve();await work;expect(ready).toHaveBeenCalledOnce();
 });

 it.each([0,1])('aborts siblings on branch %i failure and drains before renderer destruction',async(failed)=>{
  const controller=new AbortController(),parts=[deferred(),deferred()],destroy=vi.fn(),failure=Error('required asset unavailable');
  const work=completeWorldPreparation(controller,parts.map(part=>()=>part.promise)).finally(destroy);
  const rejected=expect(work).rejects.toBe(failure);
  await tick();parts[failed].reject(failure);await tick();
  expect(controller.signal.reason).toBe(failure);expect(destroy).not.toHaveBeenCalled();
  parts[1-failed].reject(Error('late abort'));await rejected;
  expect(destroy).toHaveBeenCalledOnce();
 });

 it('handles synchronous install errors and drains an already-started peer',async()=>{
  const controller=new AbortController(),peer=deferred(),started=vi.fn(),destroy=vi.fn(),failure=Error('GPU upload failed');
  const work=completeWorldPreparation(controller,[
   ()=>{throw failure;},()=>{started();return peer.promise;}
  ]).finally(destroy);
  const rejected=expect(work).rejects.toBe(failure);
  await tick();expect(started).toHaveBeenCalledOnce();
  expect(controller.signal.reason).toBe(failure);expect(destroy).not.toHaveBeenCalled();
  peer.resolve();await rejected;expect(destroy).toHaveBeenCalledOnce();
 });

 it('drains delayed branches on external cancellation and never reports ready',async()=>{
  const controller=new AbortController(),parts=[deferred(),deferred()],destroy=vi.fn(),ready=vi.fn(),reason=Error('world switched');
  const work=completeWorldPreparation(controller,parts.map(part=>()=>part.promise)).then(ready).finally(destroy);
  const rejected=expect(work).rejects.toBe(reason);
  await tick();controller.abort(reason);parts[0].resolve();await tick();
  expect(destroy).not.toHaveBeenCalled();expect(ready).not.toHaveBeenCalled();
  parts[1].resolve();await rejected;expect(destroy).toHaveBeenCalledOnce();
 });

 it('does not start GPU work when already cancelled',async()=>{
  const controller=new AbortController(),branch=vi.fn();controller.abort();
  await expect(completeWorldPreparation(controller,[branch,branch])).rejects.toThrow();
  expect(branch).not.toHaveBeenCalled();
 });

 it('drains the tile pool too, without a late upload or new tile request after failure',async()=>{
  const controller=new AbortController(),failure=Error('corrupt tile'),pending=[deferred(),deferred()],signals=[],addTile=vi.fn(),destroy=vi.fn();
  const tiles=Array.from({length:3},(_,i)=>({url:`/tile-${i}`,bytes:60}));
  const load=vi.fn((tile,{signal})=>{signals.push(signal);return pending[Number(tile.url.slice(-1))].promise;});
  const install=deferred();
  const work=completeWorldPreparation(controller,[()=>install.promise,()=>prepareCity({
   tiles,base:'',renderer:{addTile},signal:controller.signal,abort:controller,concurrency:2,load
  })]).finally(destroy);
  const rejected=expect(work).rejects.toBe(failure);
  await tick();expect(load).toHaveBeenCalledTimes(2);
  pending[0].reject(failure);await tick();
  expect(signals.every(signal=>signal.aborted)).toBe(true);expect(controller.signal.reason).toBe(failure);expect(destroy).not.toHaveBeenCalled();
  pending[1].resolve(new ArrayBuffer(60));install.resolve();await rejected;
  expect(load).toHaveBeenCalledTimes(2);expect(addTile).not.toHaveBeenCalled();expect(destroy).toHaveBeenCalledOnce();
 });
});
