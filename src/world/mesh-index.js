/** Exact native triangle vertices, including every packed attribute and bit. */
export function indexTriangleVertices(data){
 if(data.byteLength%60)throw Error('Invalid native triangle vertices');
 const words=new Uint32Array(data),indices=new Uint32Array(data.byteLength/20),unique=[],keys=new Map();
 for(let i=0;i<indices.length;i++){
  const at=i*5,key=words[at]+','+words[at+1]+','+words[at+2]+','+words[at+3]+','+words[at+4];
  let id=keys.get(key);
  if(id===undefined){id=unique.length/5;keys.set(key,id);for(let k=0;k<5;k++)unique.push(words[at+k]);}
  indices[i]=id;
 }
 const vertexBytes=unique.length*4;
 // A part with no useful reuse keeps the original allocation and draw path.
 if(vertexBytes+indices.byteLength>=data.byteLength)return null;
 const packed=new ArrayBuffer(vertexBytes+indices.byteLength);
 new Uint32Array(packed,0,unique.length).set(unique);
 new Uint32Array(packed,vertexBytes,indices.length).set(indices);
 return {data:packed,vertexBytes};
}
