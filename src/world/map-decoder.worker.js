import {transferMapAsset} from './map-transfer.js';
self.onmessage=async({data:{asset,stallMs,attempts,compressed}})=>{
 try{
  const buffer=await transferMapAsset(asset,{stallMs,attempts,compressed,onProgress:progress=>self.postMessage({progress})});
  self.postMessage({buffer},[buffer]);
 }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
