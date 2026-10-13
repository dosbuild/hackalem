import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

/** Façade placements are raw 32-byte Float32 transforms, never map-wire vertices. */
export function facadeAsset(city){
 const asset=city.architecture?.asset;
 assert(asset&&/^alem\/facades-[a-f0-9]{20}\.bin$/.test(asset.url),'Required content-addressed façade asset');
 assert(/^[a-f0-9]{64}$/.test(asset.sha256)&&asset.url===`alem/facades-${asset.sha256.slice(0,20)}.bin`,'Façade filename and checksum agree');
 assert(Number.isSafeInteger(asset.bytes)&&asset.bytes>0&&asset.bytes%32===0,'Façade raw transform byte length');
 assert(!asset.transport,'Raw façade placements cannot use map-wire transport');
 assert.equal(asset.gzip,true,'Façade static gzip availability');
 return asset;
}

export function checkFacadeBytes(asset,bytes){
 assert.equal(bytes.length,asset.bytes,'Façade asset byte length');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,'Façade raw transform checksum');
}
