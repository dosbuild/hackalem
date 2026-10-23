import type { AppState } from '../app/state';
import type { Anchor, ResidentScene, ResidentWorldAdapter } from '../residents/types';
import type { CityRuntime } from './city-runtime';
import type {ProjectionNotice} from './projection';
export function createWorldBridge() {
  let runtime:CityRuntime|null=null,scene:ResidentScene|null=null,state:AppState|null=null;
  const projections=new Set<(frame:ProjectionNotice|null)=>void>();
  const selections=new Set<(id:string)=>void>();
  let physical=false;
  const physicalListeners=new Set<(value:boolean)=>void>();
  const helpListeners=new Set<()=>void>();
  const encounterListeners=new Set<(place:{residentId:string;anchor:Anchor})=>void>();
  const adapter:ResidentWorldAdapter={
    show(next){scene=next;if(state)runtime?.show(scene,state);},
    focus(){/* WorldProps.cameraRequest is the single camera authority. */},
    subscribeSelection(listener){selections.add(listener);return()=>{selections.delete(listener);};},
    subscribeProjection(listener){projections.add(listener);return()=>{projections.delete(listener);};},
    annotationSize(size){runtime?.annotationSize?.(size);},
    clear(){scene=null;if(state)runtime?.show(null,state);},
  };
  return {adapter,
    preserveCamera(){runtime?.preserveCamera?.();},
    project(frame:ProjectionNotice|null){projections.forEach(l=>l(frame));},
    attach(next:CityRuntime|null){runtime=next;if(state)runtime?.show(scene,state);},
    setState(next:AppState){state=next;if(scene)runtime?.show(scene,state);},
    select(id:string){selections.forEach(l=>l(id));},
    physical(value:boolean){if(value!==physical){physical=value;physicalListeners.forEach(l=>l(value));}},
    onPhysical(listener:(value:boolean)=>void){physicalListeners.add(listener);return()=>{physicalListeners.delete(listener);};},
    encounter(place:{residentId:string;anchor:Anchor}){encounterListeners.forEach(l=>l(place));},
    onEncounter(listener:(place:{residentId:string;anchor:Anchor})=>void){encounterListeners.add(listener);return()=>{encounterListeners.delete(listener);};},
    help(){helpListeners.forEach(l=>l());},
    onHelp(listener:()=>void){helpListeners.add(listener);return()=>{helpListeners.delete(listener);};},
    pose(value:string){runtime?.pose(value);},
  };
}
export type WorldBridge=ReturnType<typeof createWorldBridge>;
