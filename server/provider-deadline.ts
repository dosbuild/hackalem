/** Bound the whole provider response, including its body, even if it ignores abort. */
export async function withProviderDeadline<T>(run:(signal:AbortSignal)=>Promise<T>,timeoutMs:number,signal?:AbortSignal):Promise<T> {
 signal?.throwIfAborted();
 const controller=new AbortController();
 let timer:ReturnType<typeof setTimeout>|undefined;
 let cancel=()=>{};
 const interrupted=new Promise<never>((_resolve,reject)=>{
  cancel=()=>{controller.abort();reject(new Error('provider_cancelled'));};
  signal?.addEventListener('abort',cancel,{once:true});
  timer=setTimeout(()=>{controller.abort();reject(new Error('provider_timeout'));},Number.isFinite(timeoutMs)?Math.max(1,timeoutMs):15000);
 });
 try{return await Promise.race([interrupted,Promise.resolve().then(()=>run(controller.signal))]);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
