import {useCallback,useEffect,useRef} from 'react';
import {useMode} from '../modes/context';
import type {ModeId} from '../modes/types';
import {STATIC_BUILD} from '../services/environment';
import {localService} from '../services/local';
export async function dashboardApi<T>(route:string,body?:unknown,signal?:AbortSignal,mode:ModeId='astana'):Promise<T> {
 if(STATIC_BUILD)return localService<T>(route,mode,body,signal);
 const timeout=AbortSignal.timeout(30000),url=new URL(`${import.meta.env.BASE_URL}api/dashboard/${route}`,location.href);url.searchParams.set('mode',mode);
 const response=await fetch(url,{method:body===undefined?'GET':'POST',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({...body as object,worldMode:mode})}),signal:signal?AbortSignal.any([signal,timeout]):timeout});
 if(!response.ok){const data=await response.json().catch(()=>({error:'failed'}));throw Error(data.error==='invalid_team'?'Enter a name between 2 and 60 characters.':data.error==='storage_or_service_unavailable'?'Saving is currently unavailable. Your plan remains in the application. Try again later.':data.error==='invalid_plan'?'This requires five valid decisions.':'No response received. Check your connection and retry.');}
 return response.json() as Promise<T>;
}
/** A mode switch or screen exit aborts every request, including button-triggered work. */
export function useDashboardApi(){
 const {mode}=useMode(),lifetime=useRef(new AbortController());
 useEffect(()=>{if(lifetime.current.signal.aborted)lifetime.current=new AbortController();const current=lifetime.current;return()=>current.abort();},[]);
 return useCallback(<T,>(route:string,body?:unknown,signal?:AbortSignal)=>dashboardApi<T>(route,body,signal?AbortSignal.any([signal,lifetime.current.signal]):lifetime.current.signal,mode.id),[mode.id]);
}
export const errorText=(error:unknown)=>error instanceof Error?error.message:'No response received. Please retry.';
