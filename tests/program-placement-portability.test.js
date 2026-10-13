import {describe,it,expect} from 'vitest';
import {assertProgramPlacements} from '../scripts/khanate/compare-programs.mjs';
describe('cross-platform program placement verification',()=>{
 it('accepts only negligible continuous arithmetic drift and omitted optional fields',()=>{
  expect(()=>assertProgramPlacements({origin:[.125,.25],id:'court:1',count:3},{origin:[.125+1e-14,.25-1e-14],id:'court:1',count:3,separation:undefined})).not.toThrow();
 });
 it('rejects meaningful movement, changed identities, membership and invalid numbers',()=>{
  const source={origin:[.125,.25],id:'court:1',count:3};
  expect(()=>assertProgramPlacements(source,{...source,origin:[.125+1e-8,.25]})).toThrow('programs.origin.0');
  for(const candidate of [{...source,id:'court:2'},{...source,count:4},{...source,count:3+1e-14},{...source,origin:[.25,.125]},{...source,origin:[.125]},{...source,extra:true},{...source,origin:[NaN,.25]}])expect(()=>assertProgramPlacements(source,candidate)).toThrow();
 });
});
