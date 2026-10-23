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

export function facadeGroupsAsset(city){
 const architecture=city.architecture,asset=architecture?.groupsAsset;
 assert(asset&&/^[a-f0-9]{64}$/.test(asset.sha256),'Required content-addressed façade group metadata');
 assert.equal(asset.url,`alem/facade-groups-${asset.sha256.slice(0,20)}.json`,'Façade group filename and checksum agree');
 assert(Number.isSafeInteger(asset.bytes)&&asset.bytes>0,'Façade group byte length');
 assert(!asset.transport,'Façade group metadata cannot use map-wire transport');
 assert.equal(asset.gzip,true,'Façade group static gzip availability');
 assert(Number.isSafeInteger(architecture.groupCount)&&architecture.groupCount>0,'Façade group count');
 return asset;
}

export function checkFacadeGroups(city,bytes){
 const asset=facadeGroupsAsset(city);
 checkFacadeBytes(asset,bytes);
 // Serialization preserves every record, number and ordering from the audit source.
 assert.equal(bytes.toString('utf8'),JSON.stringify(city.architecture.groups),'Façade group records match audit geometry exactly');
 assert.equal(city.architecture.groups.length,city.architecture.groupCount,'Façade group count matches audit geometry');
}
