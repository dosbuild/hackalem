import {describe,it,expect} from 'vitest';
// @ts-expect-error The release freshness checker is an executable native module.
import {previewSourceFingerprint,previewSourceHashes} from '../scripts/cityrt/check-previews.mjs';

const path='src/world/khanate/bootstrap.json';
const fixture={metadata:{url:'/mesh-a.bin',sha256:'a',transport:{file:'a.bin',bytes:40},landmarks:[{bounds:[0,1,2,3]}]},instances:[{transforms:[1,2,3]}],courtLife:[{route:[[0,0],[1,1]]}]};
const hash=(value:unknown)=>previewSourceFingerprint(path,Buffer.from(JSON.stringify(value)));
describe('portable native preview provenance',()=>{
 it('ignores only delivery metadata, retaining actual scene inputs',()=>{
  const wire=structuredClone(fixture);wire.metadata.url='/mesh-b.bin';wire.metadata.sha256='b';wire.metadata.transport={file:'b.bin',bytes:44};
  expect(hash(wire)).toBe(hash(fixture));
  const transform=structuredClone(fixture);transform.instances[0]!.transforms[0]=2;expect(hash(transform)).not.toBe(hash(fixture));
  const landmark=structuredClone(fixture);landmark.metadata.landmarks[0]!.bounds[0]=2;expect(hash(landmark)).not.toBe(hash(fixture));
  const court=structuredClone(fixture);court.courtLife[0]!.route[0]![0]=2;expect(hash(court)).not.toBe(hash(fixture));
 });
 it('tracks the historical generator and keeps other source bytes exact',async()=>{
  expect(Object.keys(await previewSourceHashes())).toContain('scripts/khanate/prepare.mjs');
  expect(previewSourceFingerprint('model.js',Buffer.from('first'))).not.toBe(previewSourceFingerprint('model.js',Buffer.from('second')));
 });
});
