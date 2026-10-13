import {useMode} from '../modes/context';
import { useEffect, useReducer, useState } from 'react';
import { appReducer, initialState } from './state';
import { loadCheckpoint, loadDraft, saveCheckpoint, saveDraft } from './storage';
import type { SavedDraft, StorageNotice } from './storage';
import type { DistrictId } from '../domain/types';

export function useApplication(initialDistrict?:DistrictId) {
  const {storage}=useMode();
  const browserStorage=()=>storage;
  const [restored] = useState(() => loadDraft(browserStorage));
  const [storageNotice,setStorageNotice] = useState<StorageNotice>(restored.notice);
  const [checkpoint,setCheckpoint]=useState<SavedDraft|null>(()=>loadCheckpoint(browserStorage));
  // Restore the district before resident children choose their story and camera.
  const [state,dispatch] = useReducer(appReducer,restored, value => {
    const initial=initialState(value.plan,value.welcomeDismissed,value.construction);
    return initialDistrict?appReducer(initial,{type:'district',districtId:initialDistrict}):initial;
  });
  useEffect(() => {
    if (!saveDraft(browserStorage,{ plan:state.plan, welcomeDismissed:state.welcomeDismissed,construction:state.construction })) setStorageNotice('unavailable');
  },[state.plan,state.welcomeDismissed,state.construction]);
  useEffect(()=>{if(state.plan.length===5)dispatch({type:'evaluate'});},[state.plan]);
  const rememberPlan=()=>{
    if(!state.plan.length)return;
    const value={plan:state.plan,welcomeDismissed:true,construction:state.construction};
    setCheckpoint(value);
    if(!saveCheckpoint(browserStorage,value))setStorageNotice('unavailable');
  };
  const restorePlan=()=>{
    if(!checkpoint)return;
    const value=checkpoint;
    rememberPlan();
    dispatch({type:'restoreDraft',plan:value.plan,construction:value.construction??[]});
  };
  return { state, dispatch, checkpoint, rememberPlan, restorePlan, storageNotice, dismissStorageNotice:() => setStorageNotice(null) };
}
