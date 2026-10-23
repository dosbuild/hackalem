// Keep authored identities exact while allowing sub-microscopic platform math
// differences in continuous geometry (one world unit is 12,000 metres).
export function assertProgramPlacements(stored, generated) {
 const normalize=value=>JSON.parse(JSON.stringify(value,(_key,item)=>{
  if(typeof item==='number'&&!Number.isFinite(item))throw Error('Non-finite program placement');
  return item;
 }));
 function compare(a,b,path) {
  if(a===b)return;
  if(typeof a==='number'&&typeof b==='number') {
   const delta=Math.abs(a-b);
   if(!Number.isInteger(a)&&!Number.isInteger(b)&&delta<=1e-12)return;
   throw Error(`Program placement differs at ${path}: ${a} versus ${b} (delta ${delta})`);
  }
  if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)) {
   const keys=Object.keys(a),other=Object.keys(b);
   if(keys.length===other.length&&keys.every(key=>Object.hasOwn(b,key))) {
    for(const key of keys)compare(a[key],b[key],`${path}.${key}`);
    return;
   }
  }
  throw Error(`Program placement structure or identity differs at ${path}`);
 }
 compare(normalize(stored),normalize(generated),'programs');
}
