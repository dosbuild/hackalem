import {transferMapAsset} from './map-transfer.js';
import {decodeMapResponse} from './map-response.js';
self.onmessage=async({data:{asset,stallMs,attempts,compressed,format}})=>{
 try{
  const buffer=await transferMapAsset(asset,{stallMs,attempts,compressed,onProgress:progress=>self.postMessage({progress})});
  const value=decodeMapResponse(buffer,format);
  self.postMessage({value},format==='arrayBuffer'?[buffer]:[]);
 }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
