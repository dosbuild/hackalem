import {fetchMapAsset} from './map-assets.js';

/** Complete the bounded world once. No camera input, eviction or retained CPU copies. */
export async function prepareCity({tiles,base,renderer,signal,onProgress=()=>{},load=fetchMapAsset,concurrency=8}) {
  const abort=new AbortController(),combined=AbortSignal.any([signal,abort.signal]);
  const progress=new Map();let next=0,loaded=0,bytes=0;
  const totalBytes=tiles.reduce((n,t)=>n+t.bytes,0);
  const report=()=>onProgress({loaded,total:tiles.length,bytes,totalBytes,progress:totalBytes?Array.from(progress.values()).reduce((n,b)=>n+b,0)/totalBytes:1});
  async function worker(){
    while(next<tiles.length){
      combined.throwIfAborted();const tile=tiles[next++];
      const data=await load({...tile,url:base+tile.url},{signal:combined,onProgress:value=>{progress.set(tile.url,value*tile.bytes);report();}});
      combined.throwIfAborted();renderer.addTile(tile.url,data,tile);loaded++;bytes+=data.byteLength;progress.set(tile.url,tile.bytes);report();
      // Uploads are bounded and yield to the shell; the city remains hidden until all succeed.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  try{await Promise.all(Array.from({length:Math.min(concurrency,tiles.length)},worker));combined.throwIfAborted();}
  catch(error){abort.abort();throw error;}
  return {loaded,total:tiles.length,bytes,totalBytes};
}
