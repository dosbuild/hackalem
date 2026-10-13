import {useEffect,useRef,useState} from 'react';
import type {WorldProps} from './contract';
import type {WorldBridge} from './bridge';
import {useContent} from '../modes/content';
import type {CityRuntime} from './city-runtime';
import './city.css';
import {DISTRICT_COLORS} from './district-colors';
import type {CSSProperties} from 'react';
import MapPreview from './MapPreview';
import {ControlIcon} from '../ui/ControlIcon';
export default function CityWorld(props:WorldProps & {bridge:WorldBridge}) {
  const {mode,text,terms}=useContent();
  const container=useRef<HTMLDivElement>(null),runtime=useRef<CityRuntime|null>(null),latest=useRef(props);
  const [progress,setProgress]=useState(0),[controls,setControls]=useState(false);
  const [quiet,setQuiet]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setQuiet(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  const [ready,setReady]=useState(false),[weather,setWeather]=useState({light:'Утренний свет',moving:false,scale:'Весь город',orbit:false});latest.current=props;
  useEffect(()=>{const controller=new AbortController();let cancelled=false;const node=container.current!;
    const loading=()=>setProgress(Number(node.dataset.loadProgress||0));node.addEventListener('alem-progress',loading);
    const change=(event:Event)=>{setWeather((event as CustomEvent<typeof weather>).detail);};node.addEventListener('alem-state',change);
    (mode.id==='khanate'?import('./khanate/runtime'):import('./alem-runtime')).then(({createCity})=>{if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');return createCity(node,latest.current,props.bridge,status=>{if(cancelled)return;if(status.kind==='ready')setReady(true);latest.current.onStatus(status);},controller.signal);}).then(city=>{if(cancelled){city.destroy();return;}runtime.current=city;props.bridge.attach(city);city.update(latest.current);}).catch(e=>{if(!cancelled)latest.current.onStatus({kind:'failed',message:String(e)});});
    return()=>{cancelled=true;controller.abort();node.removeEventListener('alem-state',change);node.removeEventListener('alem-progress',loading);props.bridge.attach(null);runtime.current?.destroy();runtime.current=null;};
  },[props.bridge,mode.id]);
  useEffect(()=>runtime.current?.update(props),[props]);
  const future=!!props.result&&props.comparisonPosition>=.5;
  return <section className={`geographic-world alem-world ${future?'alem-future':''}`} aria-label={text.worldTitle}>
    <div className="city-canvas" ref={container} data-testid="city-map">{!ready&&<MapPreview {...props}/>}</div>
    {!ready&&<p className="map-loading" role="status">{mode.id==='khanate'?'Разворачиваем город у Есиля…':'Собираем улицы, реку и дома в один мир…'} {progress}%</p>}
    <div className="alem-time" aria-live="polite"><span className="alem-sun" aria-hidden="true">◌</span><div><strong>{weather.moving?'Время проходит через город':weather.light}</strong><small>{weather.moving?'Закат · огни · новый рассвет':future?'Через два года · тот же Алем':'Сейчас · город перед решением'}</small></div>{future&&!props.comparisonSessionId&&<button onClick={()=>runtime.current?.replay?.()} aria-label="Повторить переход времени"><ControlIcon kind="replay" size={20}/></button>}</div>
    <div className="city-navigation" data-occludes-city>
      <div className="camera-extras" hidden={!controls}><button className="camera-mobile-zoom" onClick={()=>runtime.current?.zoom(1)} aria-label="Приблизить карту"><ControlIcon kind="zoom-in"/></button><button className="camera-mobile-zoom" onClick={()=>runtime.current?.zoom(-1)} aria-label="Отдалить карту"><ControlIcon kind="zoom-out"/></button><button onClick={()=>runtime.current?.rotate?.(-.2,0)} aria-label="Повернуть карту влево"><ControlIcon kind="rotate-left"/></button><button onClick={()=>runtime.current?.rotate?.(.2,0)} aria-label="Повернуть карту вправо"><ControlIcon kind="rotate-right"/></button><button onClick={()=>runtime.current?.rotate?.(0,.12)} aria-label="Увеличить наклон"><ControlIcon kind="tilt-more"/></button><button onClick={()=>runtime.current?.rotate?.(0,-.12)} aria-label="Уменьшить наклон"><ControlIcon kind="tilt-less"/></button></div>
      <div className="camera-main"><button className="camera-home" onClick={props.onOverview} aria-label="Обзор города" title="Весь город"><ControlIcon kind="overview"/></button><button className="camera-orbit" onClick={()=>quiet?runtime.current?.rotate?.(.28,0):runtime.current?.orbit?.()} aria-label={quiet?'Посмотреть с другой стороны':weather.orbit?'Остановить осмотр':'Осмотреть место с разных сторон'} aria-pressed={quiet?undefined:weather.orbit}><ControlIcon kind={!quiet&&weather.orbit?'stop':'orbit'}/> <span>{quiet?'Поворот':weather.orbit?'Стоп':'Осмотр'}</span></button><button className="camera-primary-zoom" onClick={()=>runtime.current?.zoom(1)} aria-label="Приблизить карту"><ControlIcon kind="zoom-in"/></button><button className="camera-primary-zoom" onClick={()=>runtime.current?.zoom(-1)} aria-label="Отдалить карту"><ControlIcon kind="zoom-out"/></button><button onClick={()=>setControls(v=>!v)} aria-label="Настроить камеру" aria-expanded={controls}><ControlIcon kind="settings"/></button></div>
    </div>
    <nav hidden={!!props.candidate} className="geographic-districts" aria-label={`${terms.districts} на карте`}><span>{mode.id==='khanate'?'ПЯТЬ КВАРТАЛОВ':'ПЯТЬ РАЙОНОВ'}</span>{props.districts.map(d=><button key={d.id} style={{'--district-color':DISTRICT_COLORS[d.id]} as CSSProperties} aria-pressed={props.focusedDistrict===d.id} onClick={()=>props.onDistrictSelect(d.id)}><i aria-hidden="true"/>{d.name}<span><ControlIcon kind="place" size={14}/></span></button>)}</nav>
    <p className="geographic-caption">{mode.id==='khanate'?<span>Хандық · вымышленный город казахской степи</span>:<span>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Geofabrik · <a href={`${import.meta.env.BASE_URL}city/ATTRIBUTION.md`}>Источники</a></span>}</p>
  </section>;
}
