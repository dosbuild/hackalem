import {describe,it,expect} from 'vitest';
import {releaseVersion} from '../scripts/release/version-metadata.mjs';

describe('standalone release identity',()=>{
 it('builds connected and static metadata without Git or deployment variables',()=>{
  const connected=releaseVersion('1.2.3',false,{});
  expect(connected).toEqual({application:'alem',version:'1.2.3',model:'astana-education-1',delivery:'connected',worlds:['astana','khanate']});
  expect(releaseVersion('1.2.3',true,{})).toEqual({...connected,delivery:'static'});
 });
 it('uses only an explicitly provided deployment revision',()=>{
  const railway='a'.repeat(40),github='b'.repeat(40);
  expect(releaseVersion('1.0.0',false,{RAILWAY_GIT_COMMIT_SHA:railway,GITHUB_SHA:github}).commit).toBe(railway);
  expect(releaseVersion('1.0.0',false,{GITHUB_SHA:github}).commit).toBe(github);
 });
 it.each(['short','a'.repeat(39),'a'.repeat(41),'not-a-commit','A'.repeat(40)])('rejects invalid deployment identity: %s',commit=>{
  expect(()=>releaseVersion('1.0.0',false,{RAILWAY_GIT_COMMIT_SHA:commit})).toThrow('Deployment commit');
  expect(()=>releaseVersion('1.0.0',false,{GITHUB_SHA:commit})).toThrow('Deployment commit');
 });
});
