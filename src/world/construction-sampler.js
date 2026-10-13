/** Camera ownership is singular; every newly committed project owns its own saved clock. */
export function sampleConstructionActivities(objects,receipts,now,{quiet=false,quietKeys=new Set(),cache=new Map(),createChoreography,overview}) {
 const activities={};
 for(const record of objects){
  if(record.proposal||activities[record.id])continue;
  const receipt=receipts.find(r=>r.key===`${record.id}:${record.citywide?'city':record.district}`);
  if(!receipt)continue;
  const key=`${receipt.key}:${receipt.startedAt}`;
  if(quiet){quietKeys.add(key);continue;}
  if(quietKeys.has(key)||now-receipt.startedAt>=receipt.durationMs)continue;
  let sequence=cache.get(key);if(!sequence){sequence=createChoreography(record,receipt.startedAt,overview);cache.set(key,sequence);}
  activities[record.id]={...sequence.sample(now),id:record.id,key:record.key,elapsed:Math.max(0,(now-receipt.startedAt)/1000)};
 }
 const currentKeys=new Set(receipts.map(r=>`${r.key}:${r.startedAt}`));for(const key of cache.keys())if(!currentKeys.has(key))cache.delete(key);for(const key of quietKeys)if(!currentKeys.has(key))quietKeys.delete(key);
 return activities;
}
