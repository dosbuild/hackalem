import {describe,it,expect} from 'vitest';
import {initialPresentation,presentationReducer,readPresentation,readStoredContext,committedView} from '../src/app/presentation';
import {initialState,appReducer} from '../src/app/state';
import {STORIES} from '../src/living/appeals';
import {RESIDENT_BY_ID} from '../src/residents/population';
import {streetAnchor} from '../src/living/street-residents';
import {anchorFor} from '../src/residents/engine';
import khanate from '../src/modes/khanate';
import type {Plan} from '../src/domain/types';

describe('a place and person through the paper sheets',()=>{
 it('returns from the school person to the priced proposal with no plan or camera command',()=>{
  const story=STORIES.find(s=>s.id==='story-nura-M7')!,domain=appReducer(appReducer(initialState(),{type:'district',districtId:'nura'}),{type:'choose',initiativeId:'M7'});
  const before=initialPresentation({kind:'proposal'}),meeting=presentationReducer(before,{type:'open',view:{kind:'encounter',residentId:story.id,storyId:story.id,anchor:streetAnchor(story),talking:true},remember:true});
  const returned=presentationReducer(meeting,{type:'back',fallback:{kind:'choices'}});
  expect(returned.view).toEqual({kind:'proposal'});expect(meeting.view.kind==='encounter'&&meeting.view.anchor.id).toBe('scenario:M7:nura');
  expect(domain.candidate?.decision).toEqual({initiativeId:'M7',scope:'district',districtId:'nura'});expect(domain.plan).toEqual([]);expect(domain.cameraRequest.kind).toBe('district');
 });
 it('only leaves the proposal after the authoritative reducer accepts a confirmation',()=>{
  const park:Plan=[{initiativeId:'M4',scope:'district',districtId:'esil'}];
  const rejected=appReducer(appReducer(initialState(park),{type:'district',districtId:'esil'}),{type:'choose',initiativeId:'M7'});
  expect(committedView(rejected,appReducer(rejected,{type:'confirm'}))).toBeNull();
  const priced=appReducer(appReducer(initialState(),{type:'district',districtId:'nura'}),{type:'choose',initiativeId:'M7'});
  const accepted=appReducer(priced,{type:'confirm'});
  expect(committedView(priced,accepted)).toEqual({kind:'inspection',initiativeId:'M7'});expect(accepted.plan).toHaveLength(1);expect(accepted.construction[0]!.key).toBe('M7:nura');
 });
 it('leaves the fifth accepted decision in the city while keeping its receipt',()=>{
  const four:Plan=[{initiativeId:'M7',scope:'district',districtId:'nura'},{initiativeId:'M4',scope:'district',districtId:'saryarka'},{initiativeId:'M11',scope:'district',districtId:'nura'},{initiativeId:'M12',scope:'citywide'}];
  const priced=appReducer(initialState(four),{type:'choose',initiativeId:'M14'}),accepted=appReducer(priced,{type:'confirm'});
  expect(committedView(priced,accepted)).toEqual({kind:'city'});expect(accepted.construction.some(r=>r.key==='M14:city')).toBe(true);expect(accepted.plan).toHaveLength(5);
 });
 it('updating the book person does not reopen an appeal after its meeting action',()=>{
  const reader=initialPresentation({kind:'book',section:'residents',residentPage:{page:'appeal',returnTo:'archive'}});
  const conversation=presentationReducer(reader,{type:'open',view:{kind:'book',section:'residents',residentPage:{page:'conversation'}}});
  const visited=presentationReducer(conversation,{type:'bookPerson',storyId:'story-nura-M7'});
  expect(visited.view).toEqual({kind:'book',section:'residents',residentPage:{page:'conversation'},storyId:'story-nura-M7'});
 });
});

describe('validated, world-scoped presentation recovery',()=>{
 const modernStory=STORIES.find(s=>s.id==='story-nura-M8')!,modernResident=Object.values(RESIDENT_BY_ID).find(r=>r.location==='nura')!;
 const historicalStory=khanate.stories.find(s=>s.id==='khanate-story-esil-M8')!,historicalResidents=Object.fromEntries(khanate.residents.map(r=>[r.id,r])),historicalResident=historicalResidents[historicalStory.id]!;
 it.each([
  {world:'Astana',stories:STORIES,residents:RESIDENT_BY_ID,story:modernStory,resident:modernResident,id:'program:M8:nura:clinic-satellite-1',label:'Медпункт 1'},
  {world:'Khanate',stories:khanate.stories,residents:historicalResidents,story:historicalStory,resident:historicalResident,id:'program:M8:esil@1',label:'Лечебный двор соседей'},
 ])('restores funded $world child conversations for both an authored story and a native resident',({stories,residents,story,resident,id,label})=>{
  const plan:Plan=[{initiativeId:'M8',scope:'district',districtId:story.districtId}],anchor={id,districtId:story.districtId,label:`  ${label}\n\t `,kind:'forged',provisional:false,position:[999,999],camera:{zoom:0}};
  for(const storyId of [story.id,null]){
   const base=storyId?streetAnchor(story):anchorFor(resident),saved=readPresentation(JSON.stringify({view:{kind:'encounter',residentId:storyId??resident.id,storyId,anchor,talking:true},returnTo:{kind:'encounter',residentId:resident.id,storyId:null,anchor}}),plan,stories,residents)!;
   expect(saved.view).toEqual({kind:'encounter',residentId:storyId??resident.id,storyId,anchor:{...base,id,kind:'clinic',label},talking:true});
   expect(saved.returnTo?.kind==='encounter'&&saved.returnTo.anchor).toEqual({...anchorFor(resident),id,kind:'clinic',label});expect(plan).toEqual([{initiativeId:'M8',scope:'district',districtId:story.districtId}]);
  }
 });
 it('retains a native resident picked at a different funded program and validates citywide scope',()=>{
  const id='program:M2:nura:junction-1',anchor={id,districtId:'nura',label:'Перекрёсток 1'},view={kind:'encounter',residentId:modernResident.id,storyId:null,anchor},plan:Plan=[{initiativeId:'M2',scope:'citywide'}],saved=readPresentation(JSON.stringify({view}),plan,STORIES,RESIDENT_BY_ID)!;
  expect(saved.view.kind==='encounter'&&saved.view.anchor).toEqual({...anchorFor(modernResident),id,kind:'crossing',label:'Перекрёсток 1'});
  const story=STORIES.find(s=>s.id==='story-nura-M2')!;
  expect(readPresentation(JSON.stringify({view:{...view,residentId:story.id,storyId:story.id}}),plan,STORIES,RESIDENT_BY_ID)?.view.kind).toBe('encounter');
 });
 it.each([
  ['program:M8:nura:clinic-satellite-1','nura',[]],
  ['program:M8:nura:clinic-satellite-1','nura',[{initiativeId:'M8',scope:'district',districtId:'esil'}]],
  ['program:M8:esil:clinic-satellite-1','esil',[{initiativeId:'M8',scope:'district',districtId:'esil'}]],
  ['program:M8:nura@1','nura',[{initiativeId:'M8',scope:'district',districtId:'nura'}]],
  ['program:M8:nura:clinic-satellite-1','esil',[{initiativeId:'M8',scope:'district',districtId:'nura'}]],
  ['program:M99:nura:clinic-satellite-1','nura',[{initiativeId:'M8',scope:'district',districtId:'nura'}]],
  ['program:M8:unknown:clinic-satellite-1','unknown',[{initiativeId:'M8',scope:'district',districtId:'nura'}]],
  ['program:M8:nura:../clinic','nura',[{initiativeId:'M8',scope:'district',districtId:'nura'}]],
  ['program:M2:nura:junction-1','nura',[{initiativeId:'M2',scope:'citywide'}]],
  ['scenario:M8:nura','nura',[{initiativeId:'M8',scope:'district',districtId:'nura'}]],
 ])('uses the canonical story place for removed, mismatched or invalid child reference %s in %s', (id,districtId,plan)=>{
  const raw=JSON.stringify({view:{kind:'encounter',residentId:modernStory.id,storyId:modernStory.id,anchor:{id,districtId,label:'Stored place',kind:'service',position:[0,0]}}});
  const saved=readPresentation(raw,plan as Plan,STORIES,RESIDENT_BY_ID)!;expect(saved.view.kind==='encounter'&&saved.view.anchor).toEqual(streetAnchor(modernStory));
 });
 it('falls back for invalid or removed native and Khanate child references, including legacy saves',()=>{
  for(const {stories,residents,resident,id} of [{stories:STORIES,residents:RESIDENT_BY_ID,resident:modernResident,id:'program:M8:nura:clinic-satellite-1'},{stories:khanate.stories,residents:historicalResidents,resident:historicalResident,id:'program:M8:esil@1'}]){
   for(const anchor of [undefined,{id,districtId:resident.location},{id:'program:M8:esil:clinic-satellite-1',districtId:'esil'},{id:'program:M8:esil@0',districtId:'esil'}]){
    const saved=readPresentation(JSON.stringify({view:{kind:'encounter',residentId:resident.id,storyId:null,anchor}}),[],stories,residents)!;
    expect(saved.view.kind==='encounter'&&saved.view.anchor).toEqual(anchorFor(resident));
   }
  }
  const plan:Plan=[{initiativeId:'M8',scope:'district',districtId:'esil'}];
  for(const id of ['program:M8:esil:clinic-satellite-1','program:M8:esil@0','program:M8:esil@-1','program:M8:esil@1:forged']){
   const view=readPresentation(JSON.stringify({view:{kind:'encounter',residentId:historicalStory.id,storyId:historicalStory.id,anchor:{id,districtId:'esil',label:'Forged child'}}}),plan,khanate.stories,historicalResidents)!.view;
   expect(view.kind==='encounter'&&view.anchor).toEqual(streetAnchor(historicalStory));
  }
 });
 it('bounds plain child labels and uses canonical copy for absent or empty labels',()=>{
  const plan:Plan=[{initiativeId:'M8',scope:'district',districtId:'nura'}],id='program:M8:nura:clinic-satellite-1',read=(label:unknown)=>readPresentation(JSON.stringify({view:{kind:'encounter',residentId:modernStory.id,storyId:modernStory.id,anchor:{id,districtId:'nura',label}}}),plan,STORIES,RESIDENT_BY_ID)!.view;
  for(const label of [undefined,{},' \u0000\u202e\n ']){const view=read(label);expect(view.kind==='encounter'&&view.anchor).toEqual({...streetAnchor(modernStory),id});}
  const long=read('М'.repeat(300));expect(long.kind==='encounter'&&long.anchor.label.length).toBe(160);
  const text=read('Медпункт\u202e\u00001');expect(text.kind==='encounter'&&text.anchor.label).toBe('Медпункт 1');
 });
 it('reconstructs the authored person anchor and rejects stored coordinates or another district',()=>{
  const raw=JSON.stringify({view:{kind:'encounter',residentId:'forged',storyId:'story-nura-M7',anchor:{id:'forged',districtId:'esil',position:[0,0]},talking:true},returnTo:{kind:'proposal'}});
  const saved=readPresentation(raw,[],STORIES,RESIDENT_BY_ID)!;
  expect(saved.view.kind==='encounter'&&saved.view.anchor).toEqual(streetAnchor(STORIES.find(s=>s.id==='story-nura-M7')!));expect(saved.returnTo).toEqual({kind:'catalogue'});
 });
 it('preserves the riverside teacher with Khanate content and never admits an Astana story',()=>{
  const residents=Object.fromEntries(khanate.residents.map(r=>[r.id,r])),raw=JSON.stringify({view:{kind:'encounter',residentId:'khanate-story-esil-M7',storyId:'khanate-story-esil-M7'}});
  const saved=readPresentation(raw,[],khanate.stories,residents)!;
  expect(saved.view.kind==='encounter'&&saved.view.anchor.id).toBe('scenario:M7:esil');
  expect(readPresentation(JSON.stringify({view:{kind:'encounter',storyId:'story-nura-M7'}}),[],khanate.stories,residents)).toBeNull();
 });
 it('retains valid legacy navigation but cannot restore a removed commitment or stale comparison',()=>{
  expect(readStoredContext('{')).toEqual({});expect(readStoredContext(JSON.stringify({space:'dashboard',district:'nura',appeal:'ALEM-NURA-007'}))).toEqual({space:'dashboard',district:'nura',appeal:'ALEM-NURA-007'});
  expect(readPresentation(JSON.stringify({view:{kind:'inspection',initiativeId:'M7'}}),[],STORIES,RESIDENT_BY_ID)).toBeNull();
  expect(readPresentation(JSON.stringify({view:{kind:'comparison'}}),[],STORIES,RESIDENT_BY_ID)?.view).toEqual({kind:'choices'});
 });
 it('recovers stored choice contexts to the finished city, including a later return',()=>{
  const complete:Plan=[{initiativeId:'M7',scope:'district',districtId:'nura'},{initiativeId:'M4',scope:'district',districtId:'saryarka'},{initiativeId:'M11',scope:'district',districtId:'nura'},{initiativeId:'M12',scope:'citywide'},{initiativeId:'M14',scope:'citywide'}];
  const stale=readPresentation(JSON.stringify({view:{kind:'choices'},returnTo:{kind:'choices'}}),complete,STORIES,RESIDENT_BY_ID)!;
  expect(stale).toEqual({view:{kind:'city'},returnTo:{kind:'city'}});
  const catalogue=readPresentation(JSON.stringify({view:{kind:'catalogue'},returnTo:{kind:'choices'}}),complete,STORIES,RESIDENT_BY_ID)!;
  const returned=presentationReducer({...initialPresentation(catalogue.view),returnTo:catalogue.returnTo},{type:'back',fallback:{kind:'choices'}});
  expect(returned.view).toEqual({kind:'city'});expect(returned.returnTo).toBeNull();expect(complete).toHaveLength(5);
  for(const plan of [complete.slice(0,4),[]])expect(readPresentation(JSON.stringify({view:{kind:'choices'},returnTo:{kind:'choices'}}),plan,STORIES,RESIDENT_BY_ID)).toEqual({view:{kind:'choices'},returnTo:{kind:'choices'}});
 });
 it('recovers a priced proposal by stable references while discarding a removed replacement target',()=>{
  const stored=readPresentation(JSON.stringify({view:{kind:'proposal',initiativeId:'M7',districtId:'nura',replaces:'M4',cost:0,plan:[{initiativeId:'M7'}]}}),[],STORIES,RESIDENT_BY_ID)!;
  expect(stored.view).toEqual({kind:'proposal',initiativeId:'M7',districtId:'nura',replaces:null});
 });
});

describe('domain-only plan changes settle visible and remembered sheets',()=>{
 const complete:Plan=[{initiativeId:'M7',scope:'district',districtId:'nura'},{initiativeId:'M4',scope:'district',districtId:'saryarka'},{initiativeId:'M11',scope:'district',districtId:'nura'},{initiativeId:'M12',scope:'citywide'},{initiativeId:'M14',scope:'citywide'}];
 const completed=()=>appReducer(appReducer(initialState(),{type:'applyPlan',plan:complete,expectedRevision:0,now:0}),{type:'evaluate'});
 it('Aya completion leaves the city behind her controls without taking focus',()=>{
  const before=presentationReducer(initialPresentation(),{type:'overlay',overlay:'aya'}),domain=completed();
  const after=presentationReducer(before,{type:'reconcile',domain});
  expect(after.view).toEqual({kind:'city'});expect(after.overlay).toBe('aya');expect(after.focusRequest).toBe(before.focusRequest);
 });
 it('completion clears an obsolete priced proposal rather than leaving an empty drawer',()=>{
  const before=appReducer(initialState(),{type:'choose',initiativeId:'M7'}),applied=appReducer(before,{type:'applyPlan',plan:complete,expectedRevision:before.revision,now:0});
  expect(applied.candidate).toBeNull();
  expect(presentationReducer(initialPresentation({kind:'proposal'}),{type:'reconcile',domain:applied}).view).toEqual({kind:'city'});
 });
 it('undo from a result returns to valid choices instead of waiting for five-decision calculation',()=>{
  const full=completed(),undone=appReducer(full,{type:'applyPlan',plan:complete.slice(0,1),expectedRevision:full.revision,now:0});
  expect(undone.result).toBeNull();
  const after=presentationReducer({...initialPresentation({kind:'result'}),overlay:'aya'},{type:'reconcile',domain:undone});
  expect(after.view).toEqual({kind:'choices'});expect(after.overlay).toBe('aya');
 });
 it('a council/book application repairs Back while keeping the book open',()=>{
  const before=presentationReducer(initialPresentation({kind:'proposal'}),{type:'open',view:{kind:'book',section:'council'},remember:true});
  const after=presentationReducer(before,{type:'reconcile',domain:completed()});
  expect(after.view).toEqual(before.view);expect(after.returnTo).toEqual({kind:'city'});
  expect(presentationReducer(after,{type:'back',fallback:{kind:'choices'}}).view).toEqual({kind:'city'});
 });
 it('keeps an intentional resident conversation and replaces a removed inspection return',()=>{
  const story=STORIES.find(s=>s.id==='story-nura-M7')!;
  const before=presentationReducer(initialPresentation({kind:'inspection',initiativeId:'M7'}),{type:'open',view:{kind:'encounter',residentId:story.id,storyId:story.id,anchor:streetAnchor(story),talking:true},remember:true});
  const after=presentationReducer(before,{type:'reconcile',domain:initialState()});
  expect(after.view).toBe(before.view);expect(after.returnTo).toEqual({kind:'choices'});
 });
 it('preserves a live proposal and an already valid result while calculation settles',()=>{
  const domain=appReducer(initialState(),{type:'choose',initiativeId:'M7'}),proposal=initialPresentation({kind:'proposal'});
  expect(presentationReducer(proposal,{type:'reconcile',domain})).toBe(proposal);
  const pending=appReducer(initialState(),{type:'applyPlan',plan:complete,expectedRevision:0,now:0}),result=initialPresentation({kind:'result'});
  expect(presentationReducer(result,{type:'reconcile',domain:pending})).toBe(result);
  expect(presentationReducer(initialPresentation(),{type:'reconcile',domain:pending}).view).toEqual({kind:'city'});
 });
});


describe('explicit city and read-only program references',()=>{
 it('opens the unobstructed city and treasury without changing the authoritative camera or plan',()=>{
  const domain=appReducer(initialState([{initiativeId:'M7',scope:'district',districtId:'nura'}]),{type:'focusLocation',districtId:'nura',anchorId:'scenario:M7:nura'});
  const initial=initialPresentation({kind:'inspection',initiativeId:'M7',districtId:'nura',siteId:'school-north'});
  const city=presentationReducer(initial,{type:'open',view:{kind:'city'},resetReturn:true});
  const treasury=presentationReducer(city,{type:'open',view:{kind:'treasury'},remember:true});
  const cancelled=appReducer(domain,{type:'cancel'});
  expect(city.view).toEqual({kind:'city'});expect(treasury.returnTo).toEqual({kind:'city'});expect(cancelled.cameraRequest).toBe(domain.cameraRequest);expect(cancelled.plan).toBe(domain.plan);
  expect(appReducer(cancelled,{type:'overview'}).cameraRequest).toEqual({id:domain.cameraRequest.id+1,kind:'overview'});
 });
 it('retains old inspections and validates optional district and child references',()=>{
  const plan:Plan=[{initiativeId:'M7',scope:'district',districtId:'nura'}];
  const read=(view:unknown)=>readPresentation(JSON.stringify({view}),plan,STORIES,RESIDENT_BY_ID)?.view;
  expect(read({kind:'inspection',initiativeId:'M7'})).toEqual({kind:'inspection',initiativeId:'M7'});
  expect(read({kind:'inspection',initiativeId:'M7',districtId:'nura',siteId:'school-north'})).toEqual({kind:'inspection',initiativeId:'M7',districtId:'nura',siteId:'school-north'});
  expect(read({kind:'inspection',initiativeId:'M7',districtId:'forged',siteId:{position:[0,0]}})).toEqual({kind:'inspection',initiativeId:'M7'});
  expect(read({kind:'city'})).toEqual({kind:'city'});expect(read({kind:'treasury'})).toEqual({kind:'treasury'});
 });
 it('keeps an explicitly expanded result through reload while automatic completion remains in the city',()=>{
  const plan:Plan=[{initiativeId:'M7',scope:'district',districtId:'nura'},{initiativeId:'M4',scope:'district',districtId:'saryarka'},{initiativeId:'M11',scope:'district',districtId:'nura'},{initiativeId:'M12',scope:'citywide'},{initiativeId:'M14',scope:'citywide'}];
  expect(readPresentation(JSON.stringify({view:{kind:'result'}}),plan,STORIES,RESIDENT_BY_ID)?.view).toEqual({kind:'result'});
  expect(presentationReducer(initialPresentation({kind:'city'}),{type:'reconcile',domain:initialState(plan)}).view).toEqual({kind:'city'});
 });
});
