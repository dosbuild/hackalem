import {createHash} from 'node:crypto';
import {writeFile,readdir,unlink} from 'node:fs/promises';
import {encodeMapWire} from '../../src/world/map-wire.js';

/** Lossless indexed batches. Partitioning bounds preparation work, never residency. */
export async function writeResidentCity({out,packed,metadata}) {
  for(const name of await readdir(out))if(/^map-[a-f0-9]{20}\.bin$/.test(name))await unlink(new URL(name,out));
  const publish=async data=>{
    const sha256=createHash('sha256').update(data).digest('hex'),url=`alem/map-${sha256.slice(0,20)}.bin`;
    await writeFile(new URL(url.slice(5),out),data);
    return {url,bytes:data.length,sha256};
  };
  const publishTransport=async(data,vertexBytes=data.length)=>{
    const wire=await publish(Buffer.from(encodeMapWire(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),vertexBytes)));
    return {file:wire.url.slice(5),bytes:wire.bytes,sha256:wire.sha256,vertexBytes};
  };
  const groups=new Map();
  for(const range of metadata.drawRanges){
    const b=range.bounds,key=`${Math.floor((b[0]+b[2])/.48)}/${Math.floor((b[1]+b[3])/.48)}`;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(range);
  }
  const tiles=[],sources=[];
  for(const ranges of groups.values()){
    const pieces=ranges.map(r=>packed.subarray(r.start*20,(r.start+r.count)*20)),data=Buffer.concat(pieces);
    const unique=new Map(),vertices=[],indices=Buffer.allocUnsafe(data.length/20*4),batches=[];
    for(let at=0;at<data.length;at+=20){
      const v=data.subarray(at,at+20),key=v.toString('base64');let index=unique.get(key);
      if(index===undefined){index=vertices.length;unique.set(key,index);vertices.push(v);}
      indices.writeUInt32LE(index,at/20*4);
    }
    let start=0;
    const bounds=[Infinity,Infinity,-Infinity,-Infinity,Infinity,-Infinity];
    for(const r of ranges){
      // Source height is already physical: camera and light share these exact bounds.
      const b=[Infinity,Infinity,-Infinity,-Infinity,Infinity,-Infinity];
      for(let i=r.start*20;i<(r.start+r.count)*20;i+=20){
        const x=packed.readFloatLE(i),y=packed.readFloatLE(i+4),z=packed.readFloatLE(i+8);
        b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);b[4]=Math.min(b[4],z);b[5]=Math.max(b[5],z);
      }
      for(let i=0;i<6;i++)bounds[i]=[0,1,4].includes(i)?Math.min(bounds[i],b[i]):Math.max(bounds[i],b[i]);
      batches.push({start,count:r.count,bounds:b,buildings:r.buildings||0});start+=r.count;
    }
    const vertexBytes=vertices.length*20,raw=Buffer.concat([...vertices,indices]),asset=await publish(raw),transport=await publishTransport(raw,vertexBytes);
    tiles.push({...asset,transport,vertexBytes,vertices:start,bounds,batches,buildings:batches.reduce((n,r)=>n+r.buildings,0)});
    sources.push({url:asset.url,ranges});
  }
  const terrain=packed.subarray(0,metadata.terrainCount*20),asset=await publish(terrain),transport=await publishTransport(terrain);
  await writeFile(new URL('stream-source.json',out),JSON.stringify({sources}));
  return {...metadata,...asset,transport,low:false,resident:true,drawRanges:undefined,tiles,
    residentBytes:asset.bytes+tiles.reduce((n,t)=>n+t.bytes,0),
    representation:'Complete resident city: identical indexed geometry at every camera scale'};
}
