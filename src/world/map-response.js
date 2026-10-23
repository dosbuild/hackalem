/** Requests state their representation explicitly; URLs never decide how to decode. */
export function decodeMapResponse(buffer,format){
 if(format==='arrayBuffer')return buffer;
 if(format==='json')return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));
 throw Error('Unknown map response format');
}
