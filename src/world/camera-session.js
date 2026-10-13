import {MAX_ZOOM} from './city-math.js';
const remembered=new Map();
const fields=['x','y','yaw','pitch','zoom'];
export function readCameraPose(value,maxZoom=MAX_ZOOM){
 if(!Number.isFinite(maxZoom)||maxZoom<1||!value||typeof value!=='object'||fields.some(k=>!Number.isFinite(value[k])))return null;
 const {x,y,yaw,pitch,zoom}=value;
 if(x<-1.13||x>1.30||y<-1.20||y>1.40||yaw<-Math.PI||yaw>Math.PI||pitch<.35||pitch>1||zoom<1||zoom>maxZoom)return null;
 return {x,y,yaw,pitch,zoom};
}
/** Camera persistence belongs to the native world, including when storage fails. */
export function cameraSession(mode,port,maxZoom=MAX_ZOOM){
 let storage=port;try{storage??=globalThis.localStorage;}catch{}
 const key=mode==='khanate'?'alem:khanate:camera':'alem:camera';
 let last='',zoomLimit=MAX_ZOOM;
 const record=(pose,limit)=>({version:1,pose,...(limit>MAX_ZOOM?{zoomLimit:limit}:{})});
 const recover=value=>{
  const limit=value&&Object.hasOwn(value,'zoomLimit')?value.zoomLimit:MAX_ZOOM;
  if(value?.version!==1||!Number.isFinite(limit)||limit<MAX_ZOOM||limit>maxZoom)return null;
  const pose=readCameraPose(value.pose,limit);if(pose)zoomLimit=limit;return pose;
 };
 return {
  get zoomLimit(){return zoomLimit;},
  read(){
   const cached=remembered.get(mode),cachedPose=recover(cached);
   if(cachedPose)return {...cachedPose};
   try{const value=JSON.parse(storage?.getItem(key)||'null'),pose=recover(value);if(pose){remembered.set(mode,record(pose,zoomLimit));last=JSON.stringify(record(pose,zoomLimit));return {...pose};}}catch{}
   return null;
  },
  save(value,limit=MAX_ZOOM){
   if(!Number.isFinite(limit)||limit<MAX_ZOOM||limit>maxZoom)return;
   const pose=readCameraPose(value,limit);if(!pose)return;
   zoomLimit=limit;const valueRecord=record(pose,limit),encoded=JSON.stringify(valueRecord);remembered.set(mode,valueRecord);if(encoded===last)return;last=encoded;
   try{storage?.setItem(key,encoded);}catch{}
  },
 };
}
