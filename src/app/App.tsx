import {useContent} from '../modes/content';
import {ModeControl} from '../modes/ModeControl';
import {useEffect,useMemo,useState,useReducer,useCallback,useLayoutEffect,useRef,lazy,Suspense} from 'react';
import type {Dispatch} from 'react';
import {useApplication} from './useApplication';
import {displayedState,appReducer} from './state';
import type {Action} from './state';
import {initialPresentation,presentationReducer,readStoredContext,readPresentation,spaceFor,committedView} from './presentation';
import type {ContextView} from './presentation';
import {isCurrentResult,planFingerprint} from '../domain/identity';
import {summarizePlan} from '../domain/plan';
import {allSwaps} from '../core/review';
import type {DistrictId,IndicatorId,InitiativeId} from '../domain/types';
import {Candidate} from '../features/Planning';
import {GameGuide} from '../features/GameGuide';
import {Modal} from '../ui/Modal';
import {SectionBoundary} from '../ui/SectionBoundary';
import {saveDraft} from './storage';
import {budgetStatus} from './budget';
import {Assistant} from '../assistant/Assistant';
import type {AyaSpace,AyaSection} from '../assistant/types';
const ResidentsSpace=lazy(()=>import('../living/ResidentsSpace'));
import {projectAvailability} from '../features/project-insight';
import {DecisionDeck} from '../play/DecisionDeck';
import {OutcomeSheet} from '../play/OutcomeSheet';
import type {Choice} from '../play/choices';
import type {LivingStory} from '../living/appeals';
import {streetResident,streetAnchor} from '../living/street-residents';
import {Brand} from '../ui/Brand';
import {ControlIcon} from '../ui/ControlIcon';
import {AyaMascot} from '../assistant/AyaMascot';
const Dashboard=lazy(()=>import('../dashboard/Dashboard').then(m=>({default:m.Dashboard})));
import {ProjectCatalogue} from '../features/ProjectCatalogue';
import {useDemonstration} from './useDemonstration';
import {useAutomation} from './useAutomation';
import {useJourney,emptyJourney} from '../aya/journey';
import {createWorldBridge} from '../world/bridge';
import {WorldHost} from '../world/WorldHost';
import {ResidentLayer} from '../residents/ResidentLayer';
import {anchorFor} from '../residents/engine';
import type {Anchor} from '../residents/types';
import type {ScreenRect,ProgramLocation,ProgramSelection} from '../world/contract';
import {TreasurySheet} from '../play/TreasurySheet';
import {ProgramInspection} from '../play/ProgramInspection';
import {ResultInvitation} from '../play/ResultInvitation';
import {AlternativeInvitation,AlternativeWorkbench,FutureComparison} from '../features/Gameplay';
import '../play/context-flow.css';

export default function App(){
 const {mode,storage,INITIATIVES,DISTRICTS,APPEALS,STORIES,RESIDENT_BY_ID,PROJECT_NAMES,PROJECT_STORIES,scopeName,issueMessage,text,terms}=useContent();
 const [context]=useState(()=>{try{return readStoredContext(storage.getItem('alem:context'));}catch{return {};}});
 const {state,dispatch:domainDispatch,checkpoint,rememberPlan,restorePlan,storageNotice,dismissStorageNotice}=useApplication(DISTRICTS.some(d=>d.id===context.district)?context.district:undefined);
 const {journey,setJourney}=useJourney();
 const [presentation,present]=useReducer(presentationReducer,undefined,()=>{
  const receipt=state.construction.filter(r=>r.startedAt+r.durationMs>Date.now()).at(-1),decision=receipt?state.plan.find(d=>receipt.key===`${d.initiativeId}:${d.scope==='citywide'?'city':d.districtId}`):null;
  let stored=null;try{stored=readPresentation(storage.getItem('alem:presentation:v1'),state.plan,STORIES,RESIDENT_BY_ID);}catch{}
  if(stored)return {...initialPresentation(stored.view),returnTo:stored.returnTo};
  return initialPresentation(context.space==='residents'?{kind:'book',section:'residents'}:context.space==='dashboard'?{kind:'book',section:'overview'}:decision?{kind:'inspection',initiativeId:decision.initiativeId}:{kind:'city'});
 });
 const primary=presentation.view,space=spaceFor(primary),planning=primary.kind==='proposal'||primary.kind==='catalogue',help=presentation.overlay==='guide',assistantOpen=presentation.overlay==='aya',contextVisible=!assistantOpen;
 const previousDomain=useRef({plan:state.plan,candidate:state.candidate,alternative:state.alternative,result:state.result});
 useEffect(()=>{
  const previous=previousDomain.current;
  previousDomain.current={plan:state.plan,candidate:state.candidate,alternative:state.alternative,result:state.result};
  // Initial stored proposals restore their candidate first. Later domain-only
  // automation, council changes and undo must also settle current/back sheets.
  if(previous.plan!==state.plan||previous.candidate!==state.candidate||previous.alternative!==state.alternative||previous.result!==state.result)present({type:'reconcile',domain:state});
 },[state.plan,state.candidate,state.alternative,state.result]);
 const overlayRef=useRef(presentation.overlay);overlayRef.current=presentation.overlay;
 const inspection=primary.kind==='inspection'?primary.initiativeId:null;
 const [selectedAppealId,setSelectedAppealId]=useState<string|null>(context.appeal??null);
 const [bookVisit,setBookVisit]=useState<{id:number;storyId:string}|null>(null);
 const [councilContext,setCouncilContext]=useState('');
 const [externalPrompt,setExternalPrompt]=useState<{id:number;text:string}|null>(null);
 const [alternativeNotice,setAlternativeNotice]=useState(false);
 const [dismissedResultRevision,setDismissedResultRevision]=useState<number|null>(null);
 const [sceneComparison,setSceneComparison]=useState(false);
 useEffect(()=>setSceneComparison(false),[state.result?.revision]);
 const [mapReady,setMapReady]=useState(false),[now,setNow]=useState(Date.now);
 const sourceFocus=useRef<HTMLElement|null>(null),sourceSelector=useRef<string|null>(null),root=useRef<HTMLDivElement>(null);
 const [programLocations,setProgramLocations]=useState<readonly ProgramLocation[]>([]);
 const receiveProgramLocations=useCallback((next:readonly ProgramLocation[])=>setProgramLocations(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next),[]);
 useEffect(()=>{
  if(primary.kind!=='encounter'||!primary.anchor.id.startsWith('program:')||!programLocations.length)return;
  const location=programLocations.find(l=>l.anchorId===primary.anchor.id);
  if(location){if(primary.anchor.label!==location.label)present({type:'open',view:{...primary,anchor:{...primary.anchor,label:location.label}}});return;}
  const story=STORIES.find(s=>s.id===primary.storyId),resident=RESIDENT_BY_ID[primary.residentId];
  const anchor=story?{...streetAnchor(story),label:PROJECT_NAMES[story.initiativeId]}:resident?anchorFor(resident):null;
  if(anchor){present({type:'open',view:{...primary,anchor}});domainDispatch({type:'focusLocation',districtId:anchor.districtId,anchorId:anchor.id});}
 },[primary,programLocations,STORIES,RESIDENT_BY_ID,PROJECT_NAMES,domainDispatch]);
 const [layoutRevision,setLayoutRevision]=useState(0),[occlusions,setOcclusions]=useState<ScreenRect[]>([]);
 const refreshLayout=useCallback(()=>setLayoutRevision(n=>n+1),[]);
 const bridge=useMemo(createWorldBridge,[]);
 const demo=useDemonstration(state,mapReady,()=>{domainDispatch({type:'dismissWelcome'});setJourney(j=>({...j,introduced:true}));});
 const normalView=useMemo(()=>displayedState(state),[state]),view=demo.active?demo.worldState:normalView,summary=summarizePlan(view.plan),budget=budgetStatus(state);
 const onWorldStatus=useCallback((status:{kind:'ready'}|{kind:'failed';message:string})=>setMapReady(status.kind==='ready'),[]);
 const selectedAnchor=primary.kind==='encounter'?primary.anchor:null;
 const encounterSelection=useMemo(()=>{
  if(primary.kind!=='encounter')return null;
  const story=primary.storyId?STORIES.find(s=>s.id===primary.storyId):null;
  const resident=story?(mode.id==='khanate'?RESIDENT_BY_ID[story.id]:streetResident(story)):RESIDENT_BY_ID[primary.residentId];
  const anchor=story&&!primary.anchor.id.startsWith('program:')?{...primary.anchor,label:PROJECT_NAMES[story.initiativeId]}:primary.anchor;
  return resident?{resident,anchor,talking:primary.talking,...(story?{story}:{})}:null;
 },[primary,mode.id,STORIES,RESIDENT_BY_ID,PROJECT_NAMES]);
 const defaultView=():ContextView=>state.candidate?{kind:'proposal'}:{kind:'city'};
 const captureFocus=()=>{
  const active=document.activeElement instanceof HTMLElement?document.activeElement:null;sourceFocus.current=active;sourceSelector.current=null;
  if(active?.dataset.choice)sourceSelector.current=`[data-choice="${CSS.escape(active.dataset.choice)}"]`;
  else if(active?.dataset.project)sourceSelector.current=`[data-project="${CSS.escape(active.dataset.project)}"]`;
  else if(active?.dataset.contextAction){const story=active.closest<HTMLElement>('[data-story-id]')?.dataset.storyId;sourceSelector.current=`${story?`[data-story-id="${CSS.escape(story)}"] `:''}[data-context-action="${CSS.escape(active.dataset.contextAction)}"]`;}
 };
 const restoreFocus=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(overlayRef.current)return;const node=sourceFocus.current?.isConnected?sourceFocus.current:sourceSelector.current?document.querySelector<HTMLElement>(sourceSelector.current):null;(node??document.querySelector<HTMLElement>('#candidate-title,#conversation-name,#decision-question,#outcome-title,#inspection-title,[data-toggle=planning]'))?.focus({preventScroll:true});}));
 const openView=(next:ContextView,remember=false)=>{
  if(remember)captureFocus();
  present({type:'open',view:next,remember});
 };
 const returnContext=()=>{
  present({type:'back',fallback:defaultView()});
  restoreFocus();
 };
 const navigate=(next:AyaSpace,section?:string)=>{
  if(demo.active)demo.end();
  if(next==='map'){bridge.preserveCamera();domainDispatch({type:'cancel'});present({type:'open',view:{kind:'city'},resetReturn:true});}
  else openView({kind:'book',section:next==='residents'?'residents':section&&['overview','review','council','registry'].includes(section)?section as AyaSection:'overview'},primary.kind!=='book');
 };

 const automation=useAutomation(state,domainDispatch,(next,section)=>{
  navigate(next,section);
  // Aya's own place transition must keep her stop control in reach.
  // Manual navigation still closes the overlay through switchSpace below.
  if(overlayRef.current==='aya')present({type:'overlay',overlay:'aya'});
 });
 const manual=()=>{automation.interrupt();if(demo.active)demo.end();if(storageNotice==='restored')dismissStorageNotice();};
 const switchSpace=(next:AyaSpace)=>{manual();navigate(next);};
 const dismissArrival=()=>{setJourney(j=>({...j,introduced:true}));domainDispatch({type:'dismissWelcome'});};
 const openPlanning=()=>{manual();dismissArrival();openView(state.candidate?{kind:'proposal'}:{kind:'catalogue'},!planning);};
 const openCatalogue=()=>{manual();dismissArrival();openView({kind:'catalogue'},primary.kind!=='catalogue');};
 const closePlanning=()=>{domainDispatch({type:'cancel'});present({type:'open',view:{kind:'city'},resetReturn:true});restoreFocus();};
 const showCity=()=>{manual();dismissArrival();bridge.preserveCamera();domainDispatch({type:'cancel'});present({type:'open',view:{kind:'city'},resetReturn:true});requestAnimationFrame(()=>root.current?.querySelector<HTMLElement>('.primary-navigation button')?.focus({preventScroll:true}));};
 const showOverview=()=>{showCity();domainDispatch({type:'overview'});};
 const openTreasury=()=>{manual();dismissArrival();domainDispatch({type:'cancel'});openView({kind:'treasury'},true);};
 const visitStory=(story:LivingStory,remember=true)=>{
  manual();dismissArrival();setSelectedAppealId(story.appealId);
  const anchor={...streetAnchor(story),label:PROJECT_NAMES[story.initiativeId]};
  openView({kind:'encounter',residentId:story.id,storyId:story.id,anchor,talking:true},remember&&primary.kind!=='encounter');
  // A sheet change at the same project retains the useful pose; other places get one request.
  const c=state.candidate?.decision,sameProposal=primary.kind==='proposal'&&c?.initiativeId===story.initiativeId&&(c.scope==='citywide'||c.districtId===story.districtId);
  const sameInspection=primary.kind==='inspection'&&inspection===story.initiativeId;
  if(!sameProposal&&!sameInspection)domainDispatch({type:'focusLocation',districtId:story.districtId,anchorId:anchor.id});
 };
 const encounter=useCallback((id:string|null,anchor?:Anchor,talking=true)=>{
  if(!id){present({type:'back',fallback:state.result?{kind:'result'}:state.candidate?{kind:'proposal'}:{kind:'choices'}});return;}
  const story=STORIES.find(s=>s.id===id),resident=RESIDENT_BY_ID[id];if(!story&&!resident)return;
  const place=anchor??(story?{...streetAnchor(story),label:PROJECT_NAMES[story.initiativeId]}:anchorFor(resident!));
  if(story)setSelectedAppealId(story.appealId);
  if(primary.kind!=='encounter'){sourceFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;sourceSelector.current=null;}
  present({type:'open',view:{kind:'encounter',residentId:id,storyId:story?.id??null,anchor:place,talking},remember:primary.kind!=='encounter'});
  setJourney(j=>({...j,introduced:true,returnId:j.returnId??id,encountered:[...new Set([...j.encountered,id])]}));
 },[primary.kind,state.result,state.candidate,STORIES,RESIDENT_BY_ID,PROJECT_NAMES,setJourney]);
 const meetNeed=(districtId:DistrictId,indicatorId:IndicatorId,initiativeId?:InitiativeId)=>{
  const story=STORIES.find(s=>s.districtId===districtId&&(initiativeId?s.initiativeId===initiativeId:PROJECT_STORIES[s.initiativeId].indicator===indicatorId));
  if(story)visitStory(story);else switchSpace('residents');
 };
 const askAya=(message:string,appealId?:string)=>{if(appealId)setSelectedAppealId(appealId);if(demo.active)demo.end();present({type:'overlay',overlay:'aya'});setExternalPrompt({id:Date.now(),text:message});};
 const dispatch:Dispatch<Action>=action=>{
  manual();
  if(action.type==='adoptAlternative'&&state.alternative?.result)rememberPlan();
  if(['choose','selectCommitment','beginAlternative','editAlternative','revise'].includes(action.type)){dismissArrival();openView({kind:'proposal'},!planning);}
  if(action.type==='confirm'){
   const destination=committedView(state,appReducer(state,action));if(destination&&!budget.blocked)openView(destination);
  }
  if(action.type==='cancel')openView({kind:'city'});
  if(action.type==='remove')openView({kind:'choices'});
  if(action.type==='discardAlternative'||action.type==='adoptAlternative')openView({kind:'result'});
  if(action.type==='evaluate')openView({kind:'city'});
  if(action.type==='district')dismissArrival();
  domainDispatch(action);
  if(action.type==='choose'){
   domainDispatch({type:'allocate',area:INITIATIVES[action.initiativeId].area,value:INITIATIVES[action.initiativeId].cost,initiativeId:action.initiativeId});
   if(INITIATIVES[action.initiativeId].scope==='district'){
    const available=projectAvailability(state.alternative?.plan??state.plan,action.initiativeId,state.focusedDistrict,state.candidate?.replaces??null),place=available.selected?.available?available.selected:available.choices.find(c=>c.available);
    if(place?.districtId)domainDispatch({type:'district',districtId:place.districtId});
   }
  }
 };
 const chooseNeed=(choice:Choice)=>{setSelectedAppealId(choice.story.appealId);dispatch({type:'choose',initiativeId:choice.initiativeId});domainDispatch({type:'district',districtId:choice.districtId});};
 const nextChoice=()=>{manual();domainDispatch({type:'cancel'});present({type:'open',view:state.result?{kind:'result'}:{kind:'choices'},resetReturn:true});};
 const visitProject=(id:InitiativeId)=>{
  const decision=state.plan.find(d=>d.initiativeId===id);if(!decision)return;
  const districtId=decision.scope==='district'?decision.districtId:state.focusedDistrict??'esil';
  manual();domainDispatch({type:'cancel'});openView({kind:'inspection',initiativeId:id,districtId,siteId:`${id}:${districtId}`},primary.kind!=='inspection');
  domainDispatch({type:'focusLocation',districtId,anchorId:`scenario:${id}:${districtId}`});
 };
 const inspectProgram=(selection:ProgramSelection)=>{
  if(!state.plan.some(d=>d.initiativeId===selection.initiativeId))return;
  manual();domainDispatch({type:'cancel'});openView({kind:'inspection',...selection},primary.kind!=='inspection');
 };
 const inspectLocation=(location:ProgramLocation)=>{manual();openView({kind:'inspection',initiativeId:location.initiativeId,districtId:location.districtId,siteId:location.siteId});domainDispatch({type:'focusLocation',districtId:location.districtId,anchorId:location.anchorId});};
 const inspectedDecision=state.plan.find(d=>d.initiativeId===inspection);
 const meetInspectedProject=()=>{const district=primary.kind==='inspection'&&primary.districtId?primary.districtId:inspectedDecision?.scope==='district'?inspectedDecision.districtId:state.focusedDistrict??'nura',story=STORIES.find(s=>s.districtId===district&&s.initiativeId===inspection);if(!story)return;const location=primary.kind==='inspection'?programLocations.find(l=>l.siteId===primary.siteId):null;if(location?.anchorId.startsWith('program:')){manual();dismissArrival();encounter(story.id,{...streetAnchor(story),id:location.anchorId,label:location.label});domainDispatch({type:'focusLocation',districtId:district,anchorId:location.anchorId});}else visitStory(story);};
 const showRelation=()=>{const c=state.candidate?.decision;if(!c)return;const district=c.scope==='district'?c.districtId:state.focusedDistrict??'esil',story=STORIES.find(s=>s.initiativeId===c.initiativeId&&s.districtId===district);if(story)visitStory(story);};
 const showCandidatePlace=()=>{const c=state.candidate?.decision;if(!c)return;if(c.scope==='district'&&c.districtId)domainDispatch({type:'focusLocation',districtId:c.districtId,anchorId:`scenario:${c.initiativeId}:${c.districtId}`});else domainDispatch({type:'overview'});};
 const resultPlace=(story:LivingStory)=>{manual();domainDispatch({type:'focusLocation',districtId:story.districtId,anchorId:`scenario:${story.initiativeId}:${story.districtId}`});};
 const beginResultAlternative=()=>{
  if(state.alternative||!isCurrentResult(state.plan,state.revision,state.result))return;
  manual();
  const swap=allSwaps(state.plan)[0];
  if(!swap){
   setAlternativeNotice(true);
   const target=state.plan[0]?.initiativeId;
   if(target)domainDispatch({type:'beginAlternative',initiativeId:target});
   openView({kind:'catalogue'},true);return;
  }
  setAlternativeNotice(false);
  domainDispatch({type:'beginAlternative',initiativeId:swap.replace.initiativeId,decision:swap.with,expectedRevision:state.revision});
  if(swap.with.scope==='district')domainDispatch({type:'focusLocation',districtId:swap.with.districtId,anchorId:`scenario:${swap.with.initiativeId}:${swap.with.districtId}`});
  openView({kind:'comparison'},true);
 };
 const affected=(district:DistrictId,id?:InitiativeId)=>{const story=STORIES.find(s=>s.districtId===district&&s.initiativeId===(id??state.alternative?.plan[state.alternative.slot]?.initiativeId));if(story)visitStory(story);};
 const changePlan=()=>{
  manual();setJourney(emptyJourney());dismissStorageNotice();setSelectedAppealId(null);setBookVisit(null);
  const next:ContextView=presentation.overlay==='restore'&&checkpoint?.plan.length===5?{kind:'result'}:{kind:'choices'};
  if(presentation.overlay==='restore')restorePlan();else{rememberPlan();domainDispatch({type:'restart'});domainDispatch({type:'dismissWelcome'});}
  present({type:'open',view:next,resetReturn:true});
 };
 const candidatePlace=state.candidate?.decision.scope==='district'?state.candidate.decision.districtId:null,candidateId=state.candidate?.decision.initiativeId;
 const proposalRestored=useRef(false);
 useEffect(()=>{
  if(proposalRestored.current)return;proposalRestored.current=true;
  const saved=primary.kind==='proposal'?primary:presentation.returnTo?.kind==='proposal'?presentation.returnTo:null;
  if(!saved?.initiativeId)return;
  if(saved.replaces)domainDispatch({type:'selectCommitment',initiativeId:saved.replaces});
  domainDispatch({type:'choose',initiativeId:saved.initiativeId});
  if(saved.districtId)domainDispatch({type:'district',districtId:saved.districtId});
  domainDispatch({type:'allocate',initiativeId:saved.initiativeId,area:INITIATIVES[saved.initiativeId].area,value:INITIATIVES[saved.initiativeId].cost});
 },[]);
 useEffect(()=>{if(candidateId&&candidatePlace)domainDispatch({type:'focusLocation',districtId:candidatePlace,anchorId:`scenario:${candidateId}:${candidatePlace}`});},[candidateId,candidatePlace]);
 useEffect(()=>bridge.setState(view),[bridge,view]);
 useEffect(()=>bridge.onEncounter(p=>{
  if(primary.kind==='book'&&primary.section==='residents'){
   const resident=RESIDENT_BY_ID[p.residentId],story=STORIES.find(s=>s.id===p.residentId)??STORIES.find(s=>s.districtId===p.anchor.districtId&&s.initiativeId===resident?.primary);
   if(story)setBookVisit({id:Date.now(),storyId:story.id});
  }else encounter(p.residentId,p.anchor);
 }),[bridge,encounter,primary,RESIDENT_BY_ID,STORIES]);
 useEffect(()=>{
  const endAt=Math.max(0,...state.construction.map(r=>r.startedAt+r.durationMs));setNow(Date.now());if(endAt<=Date.now())return;
  const id=setInterval(()=>{const time=Date.now();setNow(time);if(time>=endAt)clearInterval(id);},250);return()=>clearInterval(id);
 },[state.construction]);
 useEffect(()=>{if(storageNotice!=='restored')return;const id=setTimeout(dismissStorageNotice,7000);return()=>clearTimeout(id);},[storageNotice]);
 useEffect(()=>{try{
  const proposal=(target:ContextView|null)=>target?.kind==='proposal'&&state.candidate?{...target,initiativeId:state.candidate.decision.initiativeId,...(state.candidate.decision.scope==='district'&&state.candidate.decision.districtId?{districtId:state.candidate.decision.districtId}:{}),replaces:state.candidate.replaces}:target;
  storage.setItem('alem:context',JSON.stringify({space,appeal:selectedAppealId,district:state.focusedDistrict}));storage.setItem('alem:presentation:v1',JSON.stringify({view:proposal(primary),returnTo:proposal(presentation.returnTo)}));
 }catch{}},[primary,presentation.returnTo,space,selectedAppealId,state.focusedDistrict,state.candidate,storage]);
 useEffect(()=>{const receive=(event:Event)=>{const detail=(event as CustomEvent).detail;if((detail?.worldMode??'astana')===mode.id&&detail?.fingerprint===planFingerprint(state.plan))setCouncilContext(String(detail.summary??''));};window.addEventListener('alem:council-context',receive);setCouncilContext('');return()=>window.removeEventListener('alem:council-context',receive);},[state.plan,mode.id]);
 useEffect(()=>{
  const escape=(e:KeyboardEvent)=>{if(e.key!=='Escape'||e.defaultPrevented||(e.target instanceof Element&&e.target.closest('dialog,#aya-dialogue')))return;
   if(presentation.overlay)present({type:'overlay',overlay:null});else if(primary.kind==='encounter')returnContext();else if(planning)closePlanning();else if(primary.kind==='book')showCity();else if(primary.kind!=='city')showCity();else if(state.alternative?.showing==='alternative')domainDispatch({type:'showAlternative',show:false});
  };window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
 },[presentation,planning,state.alternative,state.candidate,state.result]);
 useEffect(()=>{if(presentation.overlay)return;if(planning&&primary.kind==='catalogue')document.querySelector<HTMLElement>('#planning')?.focus({preventScroll:true});else if(primary.kind==='choices'||primary.kind==='inspection'||primary.kind==='treasury')document.querySelector<HTMLElement>(primary.kind==='choices'?'#decision-question':primary.kind==='treasury'?'#treasury-title':'#inspection-title')?.focus({preventScroll:true});},[primary.kind,presentation.focusRequest]);
 useEffect(()=>{if(presentation.overlay)return;if(primary.kind==='book')root.current?.querySelector<HTMLElement>('.product-space')?.focus({preventScroll:true});},[space]);
 useLayoutEffect(()=>{
  const node=root.current;if(!node)return;const measure=()=>{const next=[...node.querySelectorAll<HTMLElement>('[data-occludes-city]')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};});
   const sheets=[...node.querySelectorAll<HTMLElement>('.planning-drawer,.context-encounter,.decision-deck,.consequence-card,.alternative-overlay,.treasury-sheet,.aya-dialogue')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0);
   if(sheets.length)node.style.setProperty('--context-sheet-top',`${Math.min(...sheets.map(el=>el.getBoundingClientRect().top))}px`);else node.style.removeProperty('--context-sheet-top');
   setOcclusions(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);};
  const observer=new ResizeObserver(measure);node.querySelectorAll<HTMLElement>('[data-occludes-city]').forEach(el=>observer.observe(el));measure();window.addEventListener('resize',measure);return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
 },[presentation,state.candidate,state.result,journey.introduced,demo.active,mapReady,layoutRevision,storageNotice]);
 const appeal=APPEALS.find(a=>a.id===selectedAppealId);
 const bookSection=primary.kind==='book'&&primary.section!=='residents'?primary.section:undefined;
 return <div ref={root} data-space={space} data-context={assistantOpen?'aya':primary.kind} data-demo={demo.active?demo.phase:'off'} className={`city-application connected-application budget-game play-application ${planning?'planning-open':''} ${primary.kind==='catalogue'?'catalogue-open':''}`}>
  <a className="skip-link" href="#planning" onClick={e=>{e.preventDefault();openPlanning();}}>Go to planning</a>
  <main className="city-stage" hidden={space==='dashboard'&&!assistantOpen} aria-label="The city and your plan">
   <WorldHost mode={mode.id} bridge={bridge} districts={DISTRICTS} focusedDistrict={view.focusedDistrict} selectedCommitment={inspection??view.selectedCommitment} budgetPreview={state.candidate?{progress:budget.progress,blocked:budget.blocked,cost:budget.cost,allocated:budget.covered}:null}
    candidate={view.candidate} commitments={view.plan} result={view.result} comparisonPosition={view.comparisonPosition} cameraRequest={view.cameraRequest} construction={view.construction} {...(demo.active?{constructionNow:demo.clock}:{})} onManualControl={manual} onWorldStatus={onWorldStatus}
    onOverview={showOverview} scenarioRevision={view.revision} occlusions={occlusions} comparisonSessionId={state.alternative?.sessionId??(sceneComparison&&state.result?`scene:${state.result.value.resultId}`:null)} heldInitiative={state.candidate?.decision.initiativeId??null}
    onProgramInspect={inspectProgram} onProgramLocations={receiveProgramLocations} onDistrictSelect={districtId=>dispatch({type:'district',districtId})} onCommitmentSelect={visitProject}/>
  </main>
  <header className="city-hud" data-occludes-city>
   <Brand/><ModeControl/>
   <div className="hud-plan"><span>{demo.active?'Aya’s demonstration':terms.decisions}</span><b data-testid="decision-count">{summary.count} of 5</b></div>
   <button className="drawer-toggle treasury-toggle" data-toggle="treasury" aria-expanded={primary.kind==='treasury'&&contextVisible} aria-controls="treasury-title" onClick={()=>primary.kind==='treasury'?showCity():openTreasury()}><ControlIcon kind="wallet"/><span>{mode.id==='khanate'?'Treasury':'Budget'}<span className="hud-budget-amount"><b data-testid="remaining-budget">{summary.remaining}</b><small> / 100</small></span></span></button>
   <button className="project-action primary paper-button" data-toggle="planning" aria-controls="planning" aria-expanded={planning&&contextVisible} onClick={openCatalogue}><ControlIcon kind="build"/><span>{mode.id==='khanate'?'City projects':'Projects'}</span></button>
   <button className="hud-guide icon-control" aria-label="How to play" aria-expanded={help} onClick={()=>present({type:'overlay',overlay:'guide'})}><ControlIcon kind="help"/></button>
  </header>
  {space==='map'&&primary.kind==='city'&&contextVisible&&state.result&&!demo.active&&!state.alternative&&<div className="map-time-switch paper-tabs" role="group" aria-label="Compare the city before and after" data-occludes-city><button aria-pressed={state.comparisonPosition<.5} onClick={()=>{setSceneComparison(true);dispatch({type:'compare',position:0});}}>Before your decisions</button><button aria-pressed={state.comparisonPosition>=.5} onClick={()=>{setSceneComparison(true);dispatch({type:'compare',position:1});}}>Two years later</button>{sceneComparison&&<button className="comparison-resume" aria-label="Resume city life" title="Resume city life" onClick={()=>setSceneComparison(false)}><ControlIcon kind="play"/></button>}</div>}
  {primary.kind==='treasury'&&contextVisible&&<TreasurySheet state={state} onClose={showCity} onProjects={openCatalogue} onInspect={visitProject} onRestart={()=>present({type:'overlay',overlay:'restart'})} {...(checkpoint?{onRestore:()=>present({type:'overlay',overlay:'restore'})}:{})}/>}
  {planning&&contextVisible&&<aside id="planning" className={`city-drawer planning-drawer context-sheet paper-sheet ${presentation.expanded?'sheet-expanded':''} ${primary.kind==='catalogue'?'catalogue-sheet':''}`} data-occludes-city tabIndex={-1} aria-label={primary.kind==='catalogue'?'Project catalogue':'Proposal for this site'}>
   <div className="drawer-heading"><div><span className="eyebrow">{primary.kind==='proposal'?'LET’S VISIT THE SITE':state.alternative?'ANOTHER OPTION':'YOUR CHOICE'}</span><h2 className="paper-title">{primary.kind==='proposal'?'What shall we change here?':mode.id==='khanate'?'Projects for the city':'Projects for the city'}</h2></div><button aria-label="Close planning" onClick={closePlanning}><ControlIcon kind="close"/></button></div>
   {primary.kind==='proposal'&&state.candidate&&<><button className="sheet-toggle" aria-expanded={presentation.expanded} onClick={()=>present({type:'expand',expanded:!presentation.expanded})}>{presentation.expanded?'Show the city':'About this decision'}</button><div className="project-dock"><Candidate state={state} dispatch={dispatch} onRelation={showRelation} onPlace={showCandidatePlace} onCatalogue={openCatalogue} onBack={closePlanning} focusRequest={presentation.overlay?0:presentation.focusRequest}/></div></>}
   {primary.kind==='catalogue'&&<>{alternativeNotice&&<p className="small" role="status">No valid option with a single replacement was found. Choose a decision manually or start a new attempt.</p>}{state.alternative&&<AlternativeWorkbench state={state} dispatch={dispatch}/>}<ProjectCatalogue state={state} dispatch={dispatch}/>{state.candidate&&<button className="text-button" onClick={()=>openView({kind:'proposal'})}>Back to the proposal <ControlIcon kind="arrow-right" size={18}/></button>}</>}
   {state.issues.length>0&&<p className="drawer-error" role="alert">{state.issues.map(issueMessage).join(' ')}</p>}
   {primary.kind==='catalogue'&&!state.candidate&&state.plan.length<5&&<button className="complete-plan-button" onClick={()=>askAya('Complete the plan')}>Aya, help me complete the plan</button>}
   {primary.kind==='catalogue'&&state.result&&!state.alternative&&<AlternativeInvitation state={state} dispatch={dispatch}/>}
   {primary.kind==='catalogue'&&<details className="plan-tools"><summary>New attempt and tutorial</summary><button className="quiet-link" onClick={()=>{manual();openView({kind:'choices'});demo.replay();}}>{mode.demonstration.link}</button>{checkpoint&&<button className="restore-plan-link" onClick={()=>{manual();present({type:'overlay',overlay:'restore'});}}>Restore the previous plan · {checkpoint.plan.length}/5</button>}{state.plan.length>0&&<button className="drawer-restart" onClick={()=>{manual();present({type:'overlay',overlay:'restart'});}}>Start again</button>}</details>}
  </aside>}
  {space==='map'&&!demo.active&&contextVisible&&<ResidentLayer selection={encounterSelection} sheet overlayOpen={!!presentation.overlay} onEncounter={encounter} onClose={returnContext} state={view} dispatch={dispatch} adapter={bridge.adapter} onPlan={openPlanning}/>}
  {space==='residents'&&contextVisible&&<div className="product-space residents-space" role="region" aria-label="Stories and requests" tabIndex={-1}><SectionBoundary title="Resident stories are currently unavailable" onBack={showCity} canReload={storageNotice!=='unavailable'} saveBeforeReload={()=>saveDraft(()=>storage,{plan:state.plan,welcomeDismissed:state.welcomeDismissed,construction:state.construction})}><Suspense fallback={<p className="notice">Opening the storybook…</p>}><ResidentsSpace overlayOpen={!!presentation.overlay} worldReady={mapReady} onLayout={refreshLayout} adapter={bridge.adapter} onVisit={story=>{domainDispatch({type:'focusLocation',districtId:story.districtId,anchorId:`scenario:${story.initiativeId}:${story.districtId}`});present({type:'bookPerson',storyId:story.id});}} {...(primary.kind==='book'&&primary.storyId?{initialStoryId:primary.storyId}:{})} bookPage={primary.kind==='book'?primary.residentPage??{page:'conversation'}:{page:'conversation'}} onBookPage={residentPage=>openView({kind:'book',section:'residents',residentPage,...(primary.kind==='book'&&primary.storyId?{storyId:primary.storyId}:{})})} state={state} selectedAppealId={selectedAppealId} visit={bookVisit} onSelectAppeal={id=>{setSelectedAppealId(id);setBookVisit(null);}} onChooseProject={(initiativeId,districtId)=>{dispatch(state.plan.some(d=>d.initiativeId===initiativeId)?{type:'selectCommitment',initiativeId}:{type:'choose',initiativeId});domainDispatch({type:'district',districtId});}} onAskAya={askAya} onDistrict={districtId=>dispatch({type:'district',districtId})}/></Suspense></SectionBoundary></div>}
  {space==='dashboard'&&contextVisible&&<div className="product-space dashboard-space" role="region" aria-label="City results book" tabIndex={-1}><SectionBoundary title="Detailed results are currently unavailable" onBack={showCity} canReload={storageNotice!=='unavailable'} saveBeforeReload={()=>saveDraft(()=>storage,{plan:state.plan,welcomeDismissed:state.welcomeDismissed,construction:state.construction})}><Suspense fallback={<p className="notice">Opening city results…</p>}><Dashboard state={state} onVisitProject={visitProject} onMeetNeed={meetNeed} onDistrict={districtId=>dispatch({type:'district',districtId})} onSectionChange={section=>openView({kind:'book',section})} {...(bookSection?{initialSection:bookSection}:{})} onApplyPlan={(plan,expectedRevision)=>{manual();if(expectedRevision===state.revision&&planFingerprint(plan)!==planFingerprint(state.plan))rememberPlan();domainDispatch({type:'applyPlan',plan,expectedRevision,now:Date.now()});}} onNavigate={(next,district)=>{switchSpace(next);if(district)domainDispatch({type:'district',districtId:district});}} onAskAya={askAya}/></Suspense></SectionBoundary></div>}
  <nav className="primary-navigation paper-tabs" aria-label="Alem spaces" data-occludes-city><button aria-current={primary.kind==='city'?'page':undefined} onClick={showCity}><ControlIcon kind="overview"/>City</button><button aria-current={space==='residents'?'page':undefined} onClick={()=>switchSpace('residents')}><ControlIcon kind="residents"/>{terms.residents}</button><button aria-current={space==='dashboard'?'page':undefined} onClick={()=>{if(state.result){manual();domainDispatch({type:'cancel'});openView({kind:'result'});}else switchSpace('dashboard');}}><ControlIcon kind="book"/>{terms.result}</button></nav>
  <Assistant state={state} space={space} open={assistantOpen} council={councilContext} appeal={appeal?{id:appeal.id,title:appeal.title,districtId:appeal.districtId,initiativeIds:appeal.initiativeIds,applicant:appeal.applicant}:null} {...automation} externalPrompt={externalPrompt} onOpenChanged={open=>present({type:'overlay',overlay:open?'aya':null})} onClearAppeal={()=>setSelectedAppealId(null)}/>
  {demo.active&&space==='map'&&<section className="demonstration-card paper-sheet" data-occludes-city aria-label="Meet Aya" data-testid="school-demonstration"><AyaMascot/><div><span className="eyebrow">AYA DEMONSTRATES · A SEPARATE EXAMPLE</span><h2>{demo.phase==='preparing'?'Let me show you how it works':demo.phase==='complete'?'The children are here':mode.demonstration.title}</h2><p>{demo.phase==='preparing'?mode.demonstration.preparing:demo.phase==='complete'?mode.demonstration.complete:mode.demonstration.building}</p>{demo.phase==='building'&&<div className="demo-progress"><progress max={1} value={demo.progress}/><strong>{demo.remaining} s</strong></div>}<p className="demo-promise">{state.plan.length>0?'Your saved plan will return after the demonstration.':mode.demonstration.promise}</p><div className="button-row"><button onClick={demo.togglePause}>{demo.paused?'Resume demonstration':'Pause'}</button><button onClick={demo.end}>{demo.phase==='complete'?'Now my city':'Skip demonstration'}</button></div></div></section>}
  {!demo.active&&space==='map'&&!state.alternative&&contextVisible&&<>
   {primary.kind==='inspection'&&<ProgramInspection state={state} view={primary} locations={programLocations} now={now} onClose={showCity} onNext={nextChoice} onMeet={meetInspectedProject} onEdit={initiativeId=>dispatch({type:'selectCommitment',initiativeId})} onLocation={inspectLocation} onAll={showOverview}/>}
   {primary.kind==='city'&&state.plan.length===5&&dismissedResultRevision!==state.revision&&<ResultInvitation result={state.result?.value??null} onOpen={()=>openView({kind:'result'},true)} onDismiss={()=>setDismissedResultRevision(state.revision)}/>}
   {primary.kind==='result'&&(state.result?<OutcomeSheet onClose={showCity} focusHeading={!presentation.overlay} result={state.result.value} onMeet={visitStory} onPlace={resultPlace} onAlternative={beginResultAlternative} onBook={()=>openView({kind:'book',section:'overview'},true)}/>:<section className="consequence-card paper-sheet" data-occludes-city role="status">Calculating the consequences of five decisions…</section>)}
   {primary.kind==='choices'&&<DecisionDeck onClose={showCity} state={state} onChoose={chooseNeed} onCatalogue={openCatalogue}/>}
  </>}
  {space==='map'&&state.alternative?.result&&primary.kind==='comparison'&&contextVisible&&<div className="alternative-overlay" data-occludes-city><FutureComparison state={state} dispatch={dispatch} district={selectedAnchor?.districtId??state.focusedDistrict??'esil'} onAffected={affected}/></div>}
  {storageNotice&&<div className="city-notice paper-notice" role="status" aria-label={text.storage[storageNotice]} data-occludes-city><span className="notice-full">{text.storage[storageNotice]}</span><span className="notice-compact" title={text.storage[storageNotice]}>{storageNotice==='unavailable'?(mode.id==='khanate'?'Decrees will not be saved after closing.':'Your plan will not be saved after closing.'):storageNotice==='restored'?(mode.id==='khanate'?'Decree book restored.':'Saved plan restored.'):storageNotice==='corrupt'?(mode.id==='khanate'?'Book damaged. Starting a new plan.':'Save damaged. Starting a new plan.'):'Older save version. Starting a new plan.'}</span><button aria-label="Dismiss notification" onClick={dismissStorageNotice}><ControlIcon kind="close" size={18}/></button></div>}
  {help&&<GameGuide onClose={()=>present({type:'overlay',overlay:null})} onContinue={()=>{present({type:'overlay',overlay:null});present({type:'focus'});}}/>}
  {(presentation.overlay==='restart'||presentation.overlay==='restore')&&<Modal title={presentation.overlay==='restart'?'Try another plan?':'Restore the previous plan?'} onClose={()=>present({type:'overlay',overlay:null})}><p>{presentation.overlay==='restart'?'Start with 100 units and five empty decision slots. Your current plan will be kept as your previous attempt, ready to restore.':'Saved decisions and their budget will return to the city. This attempt will replace the previous one if it already contains decisions.'}</p>{presentation.overlay==='restore'&&checkpoint&&<ul className="recovery-plan-list">{checkpoint.plan.map(d=><li key={d.initiativeId}><strong>{INITIATIVES[d.initiativeId].name}</strong><span>{scopeName(d)} · {INITIATIVES[d.initiativeId].cost} {terms.unit}</span></li>)}</ul>}<p className="game-guide-note">The previous attempt is stored only in this browser. Shared registry entries and council minutes are saved separately.</p><footer><button onClick={()=>present({type:'overlay',overlay:null})}>Keep the current plan</button><button className="primary" onClick={changePlan}>{presentation.overlay==='restart'?'Start a new plan':'Restore this plan'}</button></footer></Modal>}
  <div className="sr-only" role="status">{state.announcement?text.announcements[state.announcement]:''}</div>
 </div>;
}
