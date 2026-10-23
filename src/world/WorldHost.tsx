import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { WorldProps } from './contract';
import type { WorldBridge } from './bridge';
import FallbackWorld from './FallbackWorld';
import {useContent} from '../modes/content';

// Real city owns geometry and camera; the functional fallback preserves planning after failure.
const CityRenderer = lazy(()=>import('./CityWorld'));

class WorldBoundary extends Component<{ children:ReactNode; fallback:ReactNode; onFailure:()=>void },{ failed:boolean }> {
  state = { failed:false };
  static getDerivedStateFromError() { return { failed:true }; }
  componentDidCatch(){this.props.onFailure();}
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function WorldHost(props:Omit<WorldProps,'onStatus'> & {bridge:WorldBridge;onWorldStatus?:WorldProps['onStatus']}) {
  const {text}=useContent();
  const [failed,setFailed] = useState(false);
  const [generation,setGeneration]=useState(0),attempts=useRef(0);
  const retry=useCallback(()=>{setFailed(false);setGeneration(n=>n+1);},[]);
  const manualRetry=()=>{attempts.current=0;retry();};
  const failure=useCallback(()=>setFailed(true),[]);
  const onStatus = useCallback((status:Parameters<WorldProps['onStatus']>[0]) => {
    props.onWorldStatus?.(status);
    if (status.kind === 'failed') {if(status.message.includes('WebGL 2 is unavailable'))attempts.current=4;setFailed(true);}
  },[props.onWorldStatus]);
  useEffect(()=>{
    if(!failed)return;
    const delays=[1000,3000,10000,30000],delay=delays[attempts.current++];
    const online=()=>{attempts.current=0;retry();};window.addEventListener('online',online);
    const timer=delay!==undefined&&navigator.onLine?setTimeout(retry,delay):undefined;
    return()=>{clearTimeout(timer);window.removeEventListener('online',online);};
  },[failed,retry]);
  const fallback = <div className="world-failure"><p className="notice" role="status">{text.worldFailure}</p><FallbackWorld {...props} onStatus={onStatus} /></div>;
  if (failed) return <><button className="retry-world" onClick={manualRetry}>Retry loading the map</button>{fallback}</>;
  return <WorldBoundary key={generation} fallback={fallback} onFailure={failure}>
    <Suspense fallback={<><p role="status">{text.worldLoading}</p><FallbackWorld {...props} onStatus={onStatus} /></>}>
      <CityRenderer {...props} onStatus={onStatus} />
    </Suspense>
  </WorldBoundary>;
}
