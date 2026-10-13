import {describe,it,expect} from 'vitest';
import {collectProgramSites,programLocations,resolveProgramAnchor,nearestProgramSite} from '../src/world/program-runtime.js';

describe('one funded program, several navigable places',()=>{
 const parent={key:'M8:nura',id:'M8',district:'nura',origin:[0,0,0],slot:2,phase:'evaluated',state:'outcome',evidence:[{ref:'exact'}],resultId:'result',proposal:false};
 const child={key:'M8:nura:clinic-1',origin:[.08,.02,0],label:'Поликлиника у жилого квартала'};
 it('retains initiative, scope and evidence identity at satellite sites',()=>{
  const sites=collectProgramSites([parent],()=>[parent,child,child]);
  expect(sites).toHaveLength(2);expect(sites[1]).toMatchObject({id:'M8',district:'nura',slot:2,parentKey:parent.key,isChild:true});
  expect(sites[1].evidence).toBe(parent.evidence);
  expect(programLocations(sites,{M8:'Поликлиники'})).toEqual([
   {initiativeId:'M8',districtId:'nura',siteId:parent.key,label:'Поликлиники',anchorId:'scenario:M8:nura'},
   {initiativeId:'M8',districtId:'nura',siteId:child.key,label:child.label,anchorId:'program:'+child.key},
  ]);
 });
 it('resolves child-site cameras without replacing original encounter anchors',()=>{
  const sites=collectProgramSites([parent],()=>[child]);
  expect(resolveProgramAnchor('program:'+child.key,sites,{})).toBe(sites[1]);
  expect(resolveProgramAnchor('scenario:'+parent.key,sites,{})).toBe(sites[0]);
  expect(resolveProgramAnchor('scenario:M4:esil',sites,{'M4:esil':parent})).toBe(parent);
  expect(resolveProgramAnchor('program:missing',sites,{})).toBeNull();
 });
 it('populates a nearby child rather than pulling residents back to a distant hub',()=>{
  const sites=collectProgramSites([parent],()=>[child]);
  expect(nearestProgramSite(sites,[.081,.022])).toBe(sites[1]);
  expect(nearestProgramSite(sites,[1,1])).toBeNull();
  expect(nearestProgramSite(sites,[.081,.022],'esil')).toBeNull();
  expect(programLocations(collectProgramSites([{...parent,proposal:true}],()=>[child]),{M8:'Клиники'})).toEqual([]);
 });
});
