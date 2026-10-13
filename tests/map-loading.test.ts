import {describe,it,expect,vi,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
import {fetchMapAsset} from '../src/world/map-assets';
import {prepareCity} from '../src/world/city-residency';
import {visibleBounds,shadowFrame} from '../src/world/render-policy';

const bytes=new Uint8Array(60).fill(7),asset={url:'/mesh.bin',bytes:60,sha256:createHash('sha256').update(bytes).digest('hex')};
afterEach(()=>vi.useRealTimers());
describe('map transport and complete city preparation',()=>{
  it('recovers from a transient server error and rejects corrupt or incomplete assets',async()=>{
    vi.useFakeTimers();
    const fetchImpl=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(new Response(bytes));
    const promise=fetchMapAsset(asset,{fetchImpl});await vi.runAllTimersAsync();expect(new Uint8Array(await promise)).toEqual(bytes);expect(fetchImpl).toHaveBeenCalledTimes(2);
    await expect(fetchMapAsset(asset,{attempts:1,fetchImpl:async()=>new Response(bytes.slice(1))})).rejects.toThrow('truncated');
    await expect(fetchMapAsset(asset,{attempts:1,fetchImpl:async()=>new Response(new Uint8Array(60))})).rejects.toThrow('checksum');
  });
  it('allows a progressing transfer to exceed the stall deadline',async()=>{
    vi.useFakeTimers();let part=0;
    const body=new ReadableStream({pull(controller){return new Promise<void>(resolve=>{setTimeout(()=>{controller.enqueue(bytes.slice(part*20,++part*20));if(part===3)controller.close();resolve();},80);});}});
    const promise=fetchMapAsset(asset,{stallMs:100,attempts:1,fetchImpl:async()=>new Response(body)});
    await vi.advanceTimersByTimeAsync(250);expect(new Uint8Array(await promise)).toEqual(bytes);
  });
  it('cancels a retry without another request when its world is removed',async()=>{
    vi.useFakeTimers();const controller=new AbortController(),fetchImpl=vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
    const promise=fetchMapAsset(asset,{signal:controller.signal,fetchImpl}),rejection=expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1);controller.abort();await rejection;await vi.runAllTimersAsync();expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('prepares every batch once with bounded concurrency before resolving',async()=>{
    const tiles=Array.from({length:5},(_,i)=>({...asset,url:`/${i}`}));
    const pending:{resolve:(value:ArrayBuffer)=>void;signal:AbortSignal}[]=[],addTile=vi.fn(),controller=new AbortController();
    let complete=false;
    const work=prepareCity({tiles,base:'',renderer:{addTile},signal:controller.signal,concurrency:2,load:(_asset,options)=>new Promise(resolve=>pending.push({resolve,signal:options!.signal!}))}).then(r=>{complete=true;return r;});
    expect(pending).toHaveLength(2);expect(complete).toBe(false);
    for(let i=0;i<5;i++){pending[i]!.resolve(bytes.buffer);await new Promise(resolve=>setTimeout(resolve,5));if(i<4)expect(complete).toBe(false);}
    expect(await work).toMatchObject({loaded:5,total:5,bytes:300,totalBytes:300});
    expect(addTile.mock.calls.map(c=>c[0])).toEqual(tiles.map(t=>t.url));
  });
  it('cancels all outstanding preparation and prevents late uploads after unmount',async()=>{
    const controller=new AbortController(),addTile=vi.fn(),pending:{resolve:(value:ArrayBuffer)=>void;signal:AbortSignal}[]=[];
    const work=prepareCity({tiles:[asset,{...asset,url:'/two'}],base:'',renderer:{addTile},signal:controller.signal,load:(_asset,options)=>new Promise(resolve=>pending.push({resolve,signal:options!.signal!}))});
    const rejection=expect(work).rejects.toThrow();controller.abort();
    expect(pending.every(p=>p.signal.aborted)).toBe(true);pending.forEach(p=>p.resolve(bytes.buffer));await rejection;expect(addTile).not.toHaveBeenCalled();
  });
  it('fails the complete world when a required batch fails, cancelling peers',async()=>{
    let peerSignal:AbortSignal|undefined;const addTile=vi.fn();
    const work=prepareCity({tiles:[asset,{...asset,url:'/two'}],base:'',renderer:{addTile},signal:new AbortController().signal,load:async(tile,options)=>{if(tile.url===asset.url)throw Error('missing batch');peerSignal=options!.signal;await new Promise(resolve=>setTimeout(resolve,10));return bytes.buffer;}});
    await expect(work).rejects.toThrow('missing batch');expect(peerSignal?.aborted).toBe(true);
    await new Promise(resolve=>setTimeout(resolve,15));expect(addTile).not.toHaveBeenCalled();
  });
  it('retains tall geometry intersecting the view even if its ground footprint is outside',()=>{
    const view={rotation:[1,0,0,0,0,1,0,1,0],zoom:100,center:[0,0,.1],aspect:1};
    expect(visibleBounds([-.001,0,.001,.001,0,.11],view)).toBe(true);
    expect(visibleBounds([-.001,0,.001,.001,0,0],view)).toBe(false);
    expect(visibleBounds([1,0,1.01,.001,0,.11],view)).toBe(false);
  });
});
describe('stable shadow sampling',()=>{
  it('keeps the same world-space shadows through the complete zoom range',()=>{
    const reference=shadowFrame(.16,1,[.123,.234,0]);
    for(let zoom=1;zoom<=288;zoom+=.125)expect(shadowFrame(.16,zoom,[.123,.234,0])).toEqual(reference);
  });
  it('uses identical matrices and origins whenever a cached shadow key matches',()=>{
    const frames=new Map<string,ReturnType<typeof shadowFrame>>();let reused=0;
    for(let i=0;i<100;i++){
      const frame=shadowFrame(.160001+i*.000001,40+i*.00001,[.123+i*.00000001,.234,0]);
      if(frames.has(frame.key)){expect(frame).toEqual(frames.get(frame.key));reused++;}else frames.set(frame.key,frame);
    }
    expect(reused).toBeGreaterThan(80);
  });
});
