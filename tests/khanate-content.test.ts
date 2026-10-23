import {describe,it,expect} from 'vitest';
import {DISTRICT_IDS,INITIATIVE_IDS} from '../src/domain/types';
import {stories,residents,storyAppeals} from '../src/modes/khanate/residents';
import {projects} from '../src/modes/khanate/projects';
import {appeals} from '../src/modes/khanate/archive';
describe('historical encounters',()=>{
 it('authors a distinct person and request for every initiative in every quarter',()=>{
  expect(stories).toHaveLength(70);expect(residents).toHaveLength(70);expect(storyAppeals).toHaveLength(70);
  expect(new Set(stories.map(s=>s.opening)).size).toBe(70);expect(new Set(storyAppeals.map(a=>a.request)).size).toBe(70);
  for(const district of DISTRICT_IDS)for(const initiative of INITIATIVE_IDS){const person=stories.filter(s=>s.districtId===district&&s.initiativeId===initiative);expect(person).toHaveLength(1);expect(residents.find(r=>r.id===person[0]!.id)?.visual).toEqual(person[0]!.visual);}
 });
 it('keeps historical descriptions free of modern infrastructure and numerical overrides',()=>{
  const content=JSON.stringify({projects,stories:stories.map(({name,role,opening})=>({name,role,opening})),storyAppeals});
  expect(content).not.toMatch(/\bbus(?:es)?\b|traffic lights?|\bLRT\b|clinic|eOtinish|gasification|cameras?|water mains|автобус|светофор|поликлиник|газификац|камер[аы]|водопровод/i);
  for(const id of INITIATIVE_IDS){expect(projects[id]).not.toHaveProperty('cost');expect(projects[id]).not.toHaveProperty('effects');expect(projects[id]).not.toHaveProperty('lag');}
  expect(projects.M11.shortLimit).toContain('movement decreases');
 });
 it('covers the complete petition book without repeating a story or losing a quarter',()=>{
  expect(appeals).toHaveLength(240);expect(new Set(appeals.map(a=>a.id)).size).toBe(240);
  expect(new Set(appeals.map(a=>a.circumstances)).size).toBe(240);
  for(const id of DISTRICT_IDS)expect(appeals.filter(a=>a.districtId===id)).toHaveLength(48);
  expect(JSON.stringify(appeals)).not.toMatch(/\bbus(?:es)?\b|traffic lights?|\bLRT\b|clinic|eOtinish|gasification|water mains|автобус|светофор|поликлиник|газификац|водопровод/i);
 });
});
