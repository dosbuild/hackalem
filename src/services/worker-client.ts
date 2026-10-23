import type {ModeId} from '../modes/types';
type Job={id:number;route:string;mode:ModeId;body:Record<string,unknown>;signal?:AbortSignal;resolve:(value:unknown)=>void;reject:(error:Error)=>void;cleanup:()=>void};
let worker:Worker|null=null,active:Job|null=null,serial=0;
let idleTimer:ReturnType<typeof setTimeout>|undefined;
const queue:Job[]=[];
function next(){
 clearTimeout(idleTimer);
 if(active)return;
 if(!queue.length){idleTimer=setTimeout(releaseCalculationWorker,15000);return;}
 const job=queue.shift()!;active=job;
 try{
  worker??=new Worker(new URL('./core.worker.ts',import.meta.url),{type:'module',name:'alem-exact-calculation'});
  worker.onmessage=(event:MessageEvent<{id:number;value?:unknown;error?:string}>)=>{if(active?.id!==event.data.id)return;const current=active;active=null;current.cleanup();if(event.data.error)current.reject(Error(event.data.error));else current.resolve(event.data.value);next();};
  worker.onerror=()=>{const current=active;active=null;worker?.terminate();worker=null;current?.cleanup();current?.reject(Error('calculation_unavailable'));next();};
  worker.postMessage({id:job.id,route:job.route,mode:job.mode,body:job.body});
 }catch(error){active=null;worker?.terminate();worker=null;job.cleanup();job.reject(error instanceof Error?error:Error('calculation_unavailable'));next();}
}
export function calculate<T>(route:string,mode:ModeId,body:Record<string,unknown>,signal?:AbortSignal):Promise<T>{
 return new Promise<T>((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Cancelled','AbortError'));return;}
  const job:Job={id:++serial,route,mode,body,...(signal?{signal}:{}),resolve:value=>resolve(value as T),reject,cleanup:()=>signal?.removeEventListener('abort',cancel)};
  const cancel=()=>{job.cleanup();if(active===job){worker?.terminate();worker=null;active=null;}else{const at=queue.indexOf(job);if(at>=0)queue.splice(at,1);}reject(new DOMException('Cancelled','AbortError'));next();};
  signal?.addEventListener('abort',cancel,{once:true});queue.push(job);next();
 });
}
export function releaseCalculationWorker(){clearTimeout(idleTimer);if(!active&&!queue.length){worker?.terminate();worker=null;}}
