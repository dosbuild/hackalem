import {describe,expect,it} from 'vitest';
import {projectAvailability,projectConnections,projectDecision} from '../src/features/project-insight';
import type {Plan} from '../src/domain/types';

describe('project availability before spending',()=>{
 it('keeps a project discoverable when only the selected district conflicts',()=>{
  const plan:Plan=[{initiativeId:'M7',scope:'district',districtId:'nura'}];
  const park=projectAvailability(plan,'M4','nura');
  expect(park.available).toBe(true);expect(park.elsewhere).toBe(true);
  expect(park.selected?.issues[0]?.code).toBe('incompatible');
  expect(park.choices.filter(d=>d.available).map(d=>d.districtId)).not.toContain('nura');
 });
 it('does not suggest moving districts to bypass a plan-wide conflict',()=>{
  const plan:Plan=[{initiativeId:'M1',scope:'district',districtId:'nura'}];
  const lrt=projectAvailability(plan,'M3','esil');
  expect(lrt.available).toBe(false);expect(lrt.elsewhere).toBe(false);
  expect(lrt.choices.every(d=>d.issues.some(i=>i.code==='incompatible'))).toBe(true);
 });
 it('credits the replaced decision and preserves the route to exactly five',()=>{
  const plan:Plan=[{initiativeId:'M7',scope:'district',districtId:'nura'},{initiativeId:'M8',scope:'district',districtId:'nura'},{initiativeId:'M10',scope:'district',districtId:'nura'},{initiativeId:'M12',scope:'citywide'},{initiativeId:'M5',scope:'district',districtId:'saryarka'}];
  expect(projectAvailability(plan,'M9','esil').available).toBe(false);
  expect(projectAvailability(plan,'M9','esil','M7').selected?.available).toBe(true);
  expect(plan).toHaveLength(5);
 });
 it('removes stale district context from a citywide choice',()=>{
  expect(projectDecision('M12','nura')).toEqual({initiativeId:'M12',scope:'citywide'});
 });
 it('does not advertise a synergy with the initiative about to be replaced',()=>{
  const plan:Plan=[{initiativeId:'M10',scope:'district',districtId:'nura'}];
  expect(projectConnections('M12',plan,null).synergies[0]).toMatchObject({active:true,districtId:'nura',amount:2});
  expect(projectConnections('M12',plan,null,'M10').synergies[0]).toMatchObject({active:false,districtId:null});
 });
});
