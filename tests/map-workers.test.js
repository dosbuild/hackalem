import {describe,it,expect,vi,afterEach} from 'vitest';

let releaseMapWorkers;
afterEach(()=>{releaseMapWorkers?.();vi.unstubAllGlobals();vi.unstubAllEnvs();});
async function pool(cores=2){
 vi.resetModules();
 const workers=[];
 class Worker {
  constructor(){workers.push(this);this.terminate=vi.fn();}
  postMessage(request){this.request=request;}
  finish(value){this.onmessage({data:{value}});}
 }
 vi.stubGlobal('Worker',Worker);vi.stubGlobal('document',{baseURI:'https://alem.test/'});vi.stubGlobal('navigator',{hardwareConcurrency:cores});
 const assets=await import('../src/world/map-assets.js');releaseMapWorkers=assets.releaseMapWorkers;
 return {...assets,workers};
}
const asset={url:'alem/groups.json',bytes:4,sha256:'hash',gzip:true};
describe('bounded geometry and metadata worker requests',()=>{
 it('shares one bounded pool, preserves response types and cancels queued and active JSON requests',async()=>{
  const {workers,fetchMapAsset,fetchMapJsonAsset}=await pool();
  vi.stubEnv('VITE_ALEM_STATIC','true');
  const first=fetchMapJsonAsset(asset),binary=fetchMapAsset(asset),queuedController=new AbortController();
  const queued=fetchMapJsonAsset(asset,{signal:queuedController.signal});
  const rejected=expect(queued).rejects.toMatchObject({name:'AbortError'});
  expect(workers).toHaveLength(2);expect(workers[0].request).toMatchObject({format:'json',compressed:true,asset:{url:'https://alem.test/alem/groups.json'}});
  expect(workers[1].request.format).toBe('arrayBuffer');
  queuedController.abort();await rejected;
  workers[0].finish([{id:'kept'}]);expect(await first).toEqual([{id:'kept'}]);
  const buffer=new ArrayBuffer(4);workers[1].finish(buffer);expect(await binary).toBe(buffer);
  const activeController=new AbortController(),active=fetchMapJsonAsset(asset,{signal:activeController.signal});
  const activeRejected=expect(active).rejects.toMatchObject({name:'AbortError'});activeController.abort();await activeRejected;
  expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  const recovery=fetchMapJsonAsset(asset);expect(workers).toHaveLength(3);workers[2].finish([]);expect(await recovery).toEqual([]);
 });
 it.each([1,2])('loads city tiles while metadata is pending with %i reported CPU cores',async cores=>{
  const {workers,fetchMapAsset,fetchMapJsonAsset}=await pool(cores);
  const facade=fetchMapAsset({...asset,url:'alem/facade.bin'}),controller=new AbortController();
  const metadata=fetchMapJsonAsset(asset,{signal:controller.signal});
  const cancelled=expect(metadata).rejects.toMatchObject({name:'AbortError'});
  const tiles=Array.from({length:6},(_,i)=>fetchMapAsset({...asset,url:`alem/tile-${i}.bin`}));
  expect(workers).toHaveLength(2);
  workers[0].finish(new ArrayBuffer(4));await facade;
  for(let i=0;i<tiles.length;i++){
   expect(workers[0].request.asset.url).toBe(`https://alem.test/alem/tile-${i}.bin`);
   const buffer=new ArrayBuffer(4);workers[0].finish(buffer);expect(await tiles[i]).toBe(buffer);
   expect(workers[1].request.format).toBe('json');expect(workers[1].terminate).not.toHaveBeenCalled();
  }
  controller.abort();await cancelled;expect(workers[1].terminate).toHaveBeenCalledTimes(1);
  const recovery=fetchMapAsset(asset),buffer=new ArrayBuffer(4);workers[0].finish(buffer);expect(await recovery).toBe(buffer);
 });
});
