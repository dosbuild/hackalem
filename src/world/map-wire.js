/** Lossless wire layout: delta/zigzag float bits and indices, then byte planes.
 * GPU buffers are reconstructed bit-for-bit; no building, material or precision is removed.
 */
export function encodeMapWire(buffer,vertexBytes=buffer.byteLength) {
 const original=new Uint8Array(buffer),delta=new Uint8Array(original),words=new DataView(delta.buffer);
 if(vertexBytes%20||(buffer.byteLength-vertexBytes)%4)throw Error('Invalid wire geometry');
 for(let axis=0;axis<12;axis+=4){let previous=0;for(let at=axis;at<vertexBytes;at+=20){const value=words.getUint32(at,true),difference=(value-previous)|0;words.setUint32(at,((difference<<1)^(difference>>31))>>>0,true);previous=value;}}
 let previous=0;for(let at=vertexBytes;at<delta.length;at+=4){const value=words.getUint32(at,true),difference=(value-previous)|0;words.setUint32(at,((difference<<1)^(difference>>31))>>>0,true);previous=value;}
 const result=new Uint8Array(delta.length);let offset=0;
 for(let byte=0;byte<20;byte++)for(let at=byte;at<vertexBytes;at+=20)result[offset++]=delta[at];
 for(let byte=0;byte<4;byte++)for(let at=vertexBytes+byte;at<delta.length;at+=4)result[offset++]=delta[at];
 return result.buffer;
}
export function decodeMapWire(buffer,vertexBytes=buffer.byteLength) {
 if(vertexBytes%20||vertexBytes>buffer.byteLength||(buffer.byteLength-vertexBytes)%4)throw Error('Invalid wire geometry');
 const input=new Uint8Array(buffer),result=new Uint8Array(input.length);let offset=0;
 for(let byte=0;byte<20;byte++)for(let at=byte;at<vertexBytes;at+=20)result[at]=input[offset++];
 for(let byte=0;byte<4;byte++)for(let at=vertexBytes+byte;at<input.length;at+=4)result[at]=input[offset++];
 const words=new DataView(result.buffer);
 for(let axis=0;axis<12;axis+=4){let previous=0;for(let at=axis;at<vertexBytes;at+=20){const value=words.getUint32(at,true),difference=(value>>>1)^-(value&1);previous=(previous+difference)>>>0;words.setUint32(at,previous,true);}}
 let previous=0;for(let at=vertexBytes;at<result.length;at+=4){const value=words.getUint32(at,true),difference=(value>>>1)^-(value&1);previous=(previous+difference)>>>0;words.setUint32(at,previous,true);}
 return result.buffer;
}
