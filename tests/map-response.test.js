import {describe,it,expect,vi,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
import {decodeMapResponse} from '../src/world/map-response.js';

afterEach(()=>vi.unstubAllGlobals());
describe('explicit map worker response format',()=>{
 it('retains binary ownership, parses JSON and rejects unknown formats or invalid UTF-8',()=>{
  const buffer=new TextEncoder().encode('[1.234567890123456,"Әлем"]');
  expect(decodeMapResponse(buffer.buffer,'arrayBuffer')).toBe(buffer.buffer);
  expect(decodeMapResponse(buffer.buffer,'json')).toEqual([1.234567890123456,'Әлем']);
  expect(()=>decodeMapResponse(buffer.buffer,'guess')).toThrow('format');
  expect(()=>decodeMapResponse(new Uint8Array([0xff]).buffer,'json')).toThrow();
 });
 it('parses verified JSON inside the worker and transfers only binary responses',async()=>{
  const bytes=new TextEncoder().encode('[{"id":"one","offset":32}]'),asset={url:'/groups.json',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  const worker={postMessage:vi.fn()};vi.stubGlobal('self',worker);vi.stubGlobal('fetch',vi.fn(async()=>new Response(bytes)));
  await import('../src/world/map-decoder.worker.js');
  await worker.onmessage({data:{asset,format:'json',attempts:1}});
  expect(worker.postMessage).toHaveBeenLastCalledWith({value:[{id:'one',offset:32}]},[]);
  await worker.onmessage({data:{asset,format:'arrayBuffer',attempts:1}});
  const [message,transfers]=worker.postMessage.mock.calls.at(-1);
  expect(new Uint8Array(message.value)).toEqual(bytes);expect(transfers).toEqual([message.value]);
  await worker.onmessage({data:{asset,format:'guess',attempts:1}});
  expect(worker.postMessage).toHaveBeenLastCalledWith({error:'Unknown map response format'});
 });
});
