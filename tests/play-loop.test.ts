import {describe,it,expect} from 'vitest';
import {availableChoices,choicePage} from '../src/play/choices';
import {projectDecision} from '../src/features/project-insight';
import {applyEdit,validateDraft} from '../src/domain/plan';
import {hasCompletion} from '../src/domain/planning-search';
import {INITIATIVES} from '../src/domain/scenario';
import {DISTRICT_IDS} from '../src/domain/types';
import type {Plan} from '../src/domain/types';
import {inspectionPose} from '../src/world/inspection-motion';
import {cameraFrame} from '../src/world/projection';
import {STORIES} from '../src/living/appeals';
import {streetResident,streetAnchor,shortOpening} from '../src/living/street-residents';

describe('five-choice playable loop',()=>{
 it('offers varied explicit choices, and never spends or preselects a plan',()=>{
  const plan:Plan=[],pool=availableChoices(plan),page=choicePage(pool,0);
  expect(pool).toHaveLength(14);expect(page).toHaveLength(3);expect(new Set(page.map(c=>INITIATIVES[c.initiativeId].area)).size).toBe(3);expect(plan).toEqual([]);
  expect(page.map(c=>c.initiativeId)).toEqual(['M1','M4','M7']);
  for(let length=1;length<=pool.length;length++){const subset=pool.slice(0,length),reached=new Set(Array.from({length},(_,i)=>choicePage(subset,i)).flat().map(c=>c.initiativeId));expect(reached.size).toBe(length);}
 });
 it('keeps every offered branch finishable through varied complete games',()=>{
  for(let run=0;run<45;run++){
   let plan:Plan=[];
   for(let turn=0;turn<5;turn++){
    const district=DISTRICT_IDS[(run+turn)%5]!,pool=availableChoices(plan,district);
    expect(pool.length).toBeGreaterThan(0);
    for(const choice of pool){const edit=applyEdit(plan,{kind:'add',decision:projectDecision(choice.initiativeId,choice.districtId)});expect(edit.accepted).toBe(true);if(edit.accepted)expect(hasCompletion(edit.plan)).toBe(true);expect(choice.story.initiativeId).toBe(choice.initiativeId);expect(choice.story.districtId).toBe(choice.districtId);}
    const choice=pool[(run*7+turn*3)%pool.length]!,edit=applyEdit(plan,{kind:'add',decision:projectDecision(choice.initiativeId,choice.districtId)});if(edit.accepted)plan=edit.plan;
   }
   expect(validateDraft(plan).status).toBe('complete');expect(availableChoices(plan)).toEqual([]);
  }
 });
 it('follows a school with its still-unresolved route in the same district',()=>{
  const plan:Plan=[{initiativeId:'M7',scope:'district',districtId:'esil'}],first=choicePage(availableChoices(plan),0)[0]!;
  expect(first.initiativeId).toBe('M11');expect(first.districtId).toBe('esil');expect(plan).toHaveLength(1);
 });
 it('paginates safely when only one or two choices remain',()=>{
  const options=availableChoices([]).slice(0,2);expect(choicePage(options,99)).toHaveLength(2);expect(new Set(choicePage(options,99).map(c=>c.initiativeId)).size).toBe(2);expect(choicePage([],8)).toEqual([]);
 });
 it('keeps all authored residents and their own voices connected to the correct geographic site',()=>{
  for(const story of STORIES){const r=streetResident(story),anchor=streetAnchor(story);expect(r.id).toBe(story.id);expect(r.name).toBe(story.name);expect(r.visual).toEqual(story.visual);expect(r.primary).toBe(story.initiativeId);expect(r.location).toBe(story.districtId);expect(anchor.id).toBe(`scenario:${story.initiativeId}:${story.districtId}`);expect(story.opening.startsWith(shortOpening(story))).toBe(true);}
 });
});

describe('inspection camera',()=>{
 it('moves around the same visible world point without overlay interpolation',()=>{
  const base={x:.11,y:-.15,yaw:.2,pitch:.78,zoom:140},pivot=[.112,-.148,.001];
  for(const [width,height] of [[1280,720],[390,844]]){
   const before=cameraFrame(base,width!,height!).world(pivot);
   for(const t of [0,.5,3,8,16,24,30]){const pose=inspectionPose(base,pivot,t,{width:width!,height:height!}),after=cameraFrame(pose,width!,height!).world(pivot);expect(Object.values(pose).every(Number.isFinite)).toBe(true);expect(after.x).toBeCloseTo(before.x,2);expect(after.y).toBeCloseTo(before.y,2);}
  }
  expect(inspectionPose(base,pivot,12).yaw).not.toBe(base.yaw);expect(inspectionPose(base,pivot,24)).toEqual(inspectionPose(base,pivot,30));
 });
});
