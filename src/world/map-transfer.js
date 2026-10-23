import {decodeMapWire} from './map-wire.js';
/** A stalled request may fail; a slow but progressing transfer must remain usable. */
export async function transferMapAsset(asset,{signal,onProgress=()=>{},fetchImpl=fetch,stallMs=15000,attempts=3,compressed=false}={}) {
  const transport=asset.transport;
  if(transport)asset={...transport,url:asset.url.replace(/[^/]+$/,transport.file)};
  for(let attempt=0;attempt<attempts;attempt++){
    signal?.throwIfAborted();
    const request=new AbortController(),cancel=()=>request.abort(signal.reason);
    signal?.addEventListener('abort',cancel,{once:true});
    let timer;
    const heartbeat=()=>{clearTimeout(timer);timer=setTimeout(()=>request.abort(new Error('Map transfer stalled')),stallMs);};
    try {
      heartbeat();
      const response=await fetchImpl(asset.url+(compressed?'.gz':''),{signal:request.signal,cache:attempt?'reload':'default'});
      if(!response.ok)throw Error(`Map asset HTTP ${response.status}`);
      const stream=compressed&&response.headers.get('content-encoding')!=='gzip'?response.body?.pipeThrough(new DecompressionStream('gzip')):response.body;
      const reader=stream?.getReader();
      if(!reader)throw Error('Map response has no body');
      // The decompressed size comes from the same build as this application, not Content-Length.
      const data=new Uint8Array(asset.bytes);let received=0;
      while(true){const {done,value}=await reader.read();if(done)break;
        if(received+value.length>data.length){await reader.cancel();throw Error('Map asset size mismatch');}
        data.set(value,received);received+=value.length;heartbeat();onProgress(received/asset.bytes);
      }
      if(received!==asset.bytes)throw Error('Map asset truncated');
      if(globalThis.crypto?.subtle){const digest=await crypto.subtle.digest('SHA-256',data),hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==asset.sha256)throw Error('Map asset checksum mismatch');}
      signal?.throwIfAborted();return transport?decodeMapWire(data.buffer,transport.vertexBytes):data.buffer;
    }catch(error){
      signal?.throwIfAborted();
      if(attempt===attempts-1)throw error;
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);request.abort();}
    await new Promise((resolve,reject)=>{
      const cancel=()=>{clearTimeout(timer);reject(signal.reason);},timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve();},400*2**attempt);
      signal?.addEventListener('abort',cancel,{once:true});
    });
  }
}
