import {transferMapAsset} from './map-transfer.js';
const queue=[],slots=[];
let idleTimer;
const cancellation=()=>new DOMException('Map preparation cancelled','AbortError');
function pump(){
 clearTimeout(idleTimer);
 for(const slot of slots){
  if(slot.job||!queue.length)continue;
  const job=queue.shift();slot.job=job;job.slot=slot;
  try{
   slot.worker??=new Worker(new URL('./map-decoder.worker.js',import.meta.url),{type:'module',name:'alem-lossless-map'});
   const finish=(error,buffer)=>{slot.job=null;job.cleanup();if(error){slot.worker?.terminate();slot.worker=null;job.reject(error);}else job.resolve(buffer);pump();};
   slot.worker.onmessage=({data})=>{if(data.progress!==undefined)job.onProgress(data.progress);else finish(data.error?Error(data.error):null,data.buffer);};
   slot.worker.onerror=()=>finish(Error('Map decoder worker unavailable'));
   slot.worker.postMessage(job.request);
  }catch(error){slot.job=null;job.cleanup();job.reject(error);}
 }
 if(!queue.length&&slots.every(s=>!s.job))idleTimer=setTimeout(releaseMapWorkers,1000);
}
/** Download, decompress, verify and reconstruct on bounded workers; transfer ownership to WebGL. */
export function fetchMapAsset(asset,options={}) {
 const {signal,onProgress=()=>{},fetchImpl=fetch,stallMs=15000,attempts=3}=options;
 const compressed=import.meta.env?.VITE_ALEM_STATIC==='true'&&(!!asset.transport||asset.gzip===true);
 if(typeof Worker==='undefined'||typeof document==='undefined'||fetchImpl!==fetch)return transferMapAsset(asset,{...options,compressed});
 if(signal?.aborted)return Promise.reject(cancellation());
 if(!slots.length)for(let i=0;i<Math.min(4,Math.max(1,(navigator.hardwareConcurrency||4)-1));i++)slots.push({worker:null,job:null});
 return new Promise((resolve,reject)=>{
  const job={request:{asset:{...asset,url:new URL(asset.url,document.baseURI).href},stallMs,attempts,compressed},onProgress,resolve,reject,slot:null,cleanup:()=>signal?.removeEventListener('abort',cancel)};
  const cancel=()=>{job.cleanup();if(job.slot?.job===job){job.slot.worker?.terminate();job.slot.worker=null;job.slot.job=null;}else{const at=queue.indexOf(job);if(at>=0)queue.splice(at,1);}reject(cancellation());pump();};
  signal?.addEventListener('abort',cancel,{once:true});queue.push(job);pump();
 });
}
export function releaseMapWorkers(){clearTimeout(idleTimer);for(const slot of slots)if(!slot.job){slot.worker?.terminate();slot.worker=null;}}
