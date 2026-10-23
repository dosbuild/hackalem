import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import type {ReactNode} from 'react';
import {ModeProvider} from '../src/modes/context';
import astana from '../src/modes/astana';
import khanate from '../src/modes/khanate';
import type {ModeDefinition} from '../src/modes/types';
import {initialState,appReducer} from '../src/app/state';
import {budgetStatus} from '../src/app/budget';
import {TreasurySheet} from '../src/play/TreasurySheet';
import {ProgramInspection} from '../src/play/ProgramInspection';
import {ResultInvitation} from '../src/play/ResultInvitation';
import {Candidate} from '../src/features/Planning';
import {evaluatePlan} from '../src/domain/evaluate';
import {local} from './fixtures';
import {oracle} from './scenario-oracle';
import {format} from '../src/ui/copy';

const noop=()=>{};
const render=(content:ReactNode,mode:ModeDefinition=astana)=>renderToStaticMarkup(createElement(ModeProvider,{mode,switchMode:noop,children:content}));

describe('one contextual paper surface',()=>{
 it.each([astana,khanate])('shows fixed costs, funded scope and conserved money in $id treasury',mode=>{
  const funded=initialState([local('M7','nura')]);
  const state=appReducer(funded,{type:'allocate',area:'environment',value:15,initiativeId:'M4'}),balance=budgetStatus(state);
  expect(balance.free+balance.fluid+balance.locked).toBe(100);
  const html=render(createElement(TreasurySheet,{state,onClose:noop,onProjects:noop,onInspect:noop,onRestart:noop}),mode);
  expect(html).toContain('Budget balance');expect(html).toContain('Already funded');expect(html).toContain('Prepared for selection');
  expect(html).toContain('<strong>76<small>');expect(html).toContain('<span>Available</span><b>61</b>');expect(html).toContain('<span>Prepared for selection</span><b>15</b>');expect(html).toContain('<span>Already funded</span><b>24</b>');
  expect(html).toContain(mode.id==='khanate'?'Treasury and decrees':'Budget and plan');expect(html).toContain(mode.id==='khanate'?'Accepted decrees':'Funded plan');
  expect(html).not.toContain('project-catalogue');expect(html).not.toContain('type="range"');expect(html).not.toContain('data-testid="held-project"');
 });
 it('lists real child locations in a local program without admitting sites in another funded district',()=>{
  const state=initialState([local('M8','nura')]);
  const html=render(createElement(ProgramInspection,{state,view:{kind:'inspection',initiativeId:'M8',districtId:'nura',siteId:'clinic-east'},now:0,onClose:noop,onNext:noop,onMeet:noop,onEdit:noop,onLocation:noop,onAll:noop,locations:[
   {initiativeId:'M8',districtId:'nura',siteId:'clinic-east',label:'East outpatient clinic',anchorId:'program:clinic-east'},
   {initiativeId:'M8',districtId:'nura',siteId:'clinic-hub',label:'Clinic',anchorId:'scenario:M8:nura'},
   {initiativeId:'M8',districtId:'esil',siteId:'unfunded',label:'Another district',anchorId:'program:unfunded'},
  ]}));
  expect(html).toContain('East outpatient clinic');expect(html).toContain('Programme sites · 2');expect(html).toContain('All sites on the map');expect(html).toContain('Edit decision');
  expect(html).not.toContain('Another district');expect(html).not.toContain('data-testid="held-project"');expect(html).not.toContain('select');
  expect(html).toContain('aria-pressed="true"');expect(html).toContain('<details class="program-locations secondary-details">');expect(html).not.toContain('<details class="program-locations secondary-details" open=');expect(state.candidate).toBeNull();expect(state.plan).toEqual([local('M8','nura')]);
 });
 it.each(['M8:nura','clinic-east'])('keeps the location disclosure collapsed when directly inspecting %s',siteId=>{
  const state=initialState([local('M8','nura')]);
  const html=render(createElement(ProgramInspection,{state,view:{kind:'inspection',initiativeId:'M8',districtId:'nura',siteId},locations:[{initiativeId:'M8',districtId:'nura',siteId,label:'Clinic',anchorId:`program:${siteId}`}],now:0,onClose:noop,onNext:noop,onMeet:noop,onEdit:noop,onLocation:noop,onAll:noop}));
  expect(html).toContain('<details class="program-locations secondary-details">');
  expect(html).not.toContain('<details class="program-locations secondary-details" open=');
  expect(html).toContain('Return to the city');expect(html).toContain('Next decision');expect(html).toContain('Edit decision');
 });
 it('renders the result invitation with evaluator evidence and an explicit dismissal action',()=>{
  const evaluated=evaluatePlan(oracle.cases.negative.plan);if(!evaluated.ok)throw new Error('Fixture must be complete');
  const result=evaluated.result,html=render(createElement(ResultInvitation,{result,onOpen:noop,onDismiss:noop}));
  expect(html).toContain(format(result.finalScore));expect(html).toContain('open result');expect(html).toContain('Dismiss result invitation');
  expect(html).not.toContain('outcome-sheet');expect(html).not.toContain('outcome-person');
  expect(render(createElement(ResultInvitation,{result:null,onOpen:noop,onDismiss:noop}))).toContain('Calculating consequences');
 });
 it('keeps a priced proposal, scope, remaining funds and confirmation while using the live map for its preview',()=>{
  const state=appReducer(appReducer(initialState(),{type:'district',districtId:'nura'}),{type:'choose',initiativeId:'M7'});
  const html=render(createElement(Candidate,{state,dispatch:noop,onBack:noop,onCatalogue:noop}));
  expect(html).toContain('held-project');expect(html).toContain('value="nura"');expect(html).toContain('Remaining: <b>76');expect(html).toContain('24 units');expect(html).toContain('Details and exact calculation');
  expect(html).not.toContain('proposal-preview');expect(html).not.toContain('preview-svg');expect(html).not.toContain('data-testid="project-preview"');
  expect(state.plan).toEqual([]);expect(state.candidate?.decision).toEqual(local('M7','nura'));
 });
});
