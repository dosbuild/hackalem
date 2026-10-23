import {ControlIcon} from '../ui/ControlIcon';
import {useContent} from '../modes/content';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {AppState} from '../app/state';
import type {DistrictId,InitiativeId,PolicyArea} from '../domain/types';
import type {ResidentWorldAdapter} from '../residents/types';
import {observe} from '../residents/engine';
import {ResidentPortrait} from '../ui/ResidentPortrait';
import {format} from '../ui/copy';
import {DISTRICT_COLORS} from '../world/district-colors';
import {SOURCES,getAppealRelation} from './appeals';
import type {Appeal,LivingStory} from './appeals';
import {streetResident,streetAnchor,shortOpening} from './street-residents';
import './living.css';
import type {ResidentBookPage} from '../app/presentation';

export interface ResidentsSpaceProps {
 worldReady:boolean;onLayout:()=>void;state:AppState;selectedAppealId:string|null;onSelectAppeal:(id:string|null)=>void;
 onChooseProject:(initiativeId:InitiativeId,districtId:DistrictId)=>void;
 onAskAya:(message:string,appealId?:string)=>void;onDistrict:(districtId:DistrictId)=>void;
 onVisit:(story:LivingStory)=>void;adapter:ResidentWorldAdapter;
 visit?:{id:number;storyId:string}|null;
 bookPage?:ResidentBookPage;onBookPage?:(page:ResidentBookPage)=>void;
 initialStoryId?:string;overlayOpen?:boolean;
}
export function ResidentsSpace({worldReady,onLayout,state,selectedAppealId,onSelectAppeal,onChooseProject,onAskAya,onVisit,adapter,visit,bookPage,onBookPage,initialStoryId,overlayOpen=false}:ResidentsSpaceProps){
 const {mode,session,DISTRICTS,INITIATIVES,PROJECT_NAMES,SHORT_LIMITS,PROJECT_STORIES,RESIDENTS,STORIES,APPEALS,districtName,indicatorNames,areaNames:TOPICS,terms}=useContent();
 const names=Object.fromEntries(DISTRICTS.map(d=>[d.id,d.name]));
 const APPEAL_BY_ID=Object.fromEntries(APPEALS.map(a=>[a.id,a])),STORY_BY_ID=Object.fromEntries(STORIES.map(s=>[s.id,s]));
 const PROVENANCE=mode.appeals[0]!.provenance;
 const savedResidentContext=()=>{try{const v:unknown=JSON.parse(session.getItem('alem:resident-context')||'{}');return v&&typeof v==='object'?v as {story?:string;drawer?:boolean;reading?:boolean;query?:string}:{};}catch{return {};}};
 const district=state.focusedDistrict??'nura';
 const [remembered]=useState(savedResidentContext);
 const latest=state.plan.slice().reverse().find(d=>d.scope==='citywide'||d.districtId===district);
 const initial=STORIES.find(s=>s.districtId===district&&s.initiativeId===(latest?.initiativeId??'M7'))!;
 const [pinned,setPinned]=useState<string>(visit?.storyId??(initialStoryId&&STORY_BY_ID[initialStoryId]?.districtId===district?initialStoryId:remembered.story&&STORY_BY_ID[remembered.story]?.districtId===district?remembered.story:initial.id));
 const [answer,setAnswer]=useState<'opening'|'effect'|'remaining'>(latest?'effect':'opening');
 const rememberedHere=!!remembered.story&&STORY_BY_ID[remembered.story]?.districtId===district&&!visit;
 const [localBookPage,setLocalBookPage]=useState<ResidentBookPage>(rememberedHere&&remembered.reading===true&&!!selectedAppealId&&!!APPEAL_BY_ID[selectedAppealId]?{page:'appeal',returnTo:remembered.drawer?'archive':'conversation'}:rememberedHere&&remembered.drawer===true?{page:'archive'}:{page:'conversation'});
 const pageView=bookPage??localBookPage,drawer=pageView.page==='archive',reading=pageView.page==='appeal'&&!!selectedAppealId&&!!APPEAL_BY_ID[selectedAppealId];
 const setBookPage=(value:ResidentBookPage)=>{setLocalBookPage(value);onBookPage?.(value);};
 const readerOpener=useRef<HTMLElement|null>(null),readerAppeal=useRef<string|null>(null);
 const closeReading=()=>{setBookPage({page:pageView.page==='appeal'?pageView.returnTo:'conversation'});requestAnimationFrame(()=>requestAnimationFrame(()=>{const target=readerOpener.current?.isConnected?readerOpener.current:readerAppeal.current?document.querySelector<HTMLElement>(`[data-appeal-id="${CSS.escape(readerAppeal.current)}"]`):null;(target??dialogRef.current)?.focus({preventScroll:true});}));};
 const [query,setQuery]=useState(typeof remembered.query==='string'?remembered.query:'');
 const [districtFilter,setDistrictFilter]=useState<DistrictId|'all'>('all'),[topic,setTopic]=useState<PolicyArea|'all'>('all'),[kind,setKind]=useState<'all'|'stories'|'plan'>('all');
 const [page,setPage]=useState(0),[rosterPage,setRosterPage]=useState(0);
 const dialogRef=useRef<HTMLElement>(null),readingRef=useRef<HTMLElement>(null),entryRef=useRef<HTMLButtonElement>(null);
 const closeArchive=()=>{setBookPage({page:'conversation'});requestAnimationFrame(()=>entryRef.current?.focus({preventScroll:true}));};
 const person=STORY_BY_ID[pinned]??initial,selectedAppeal=selectedAppealId?APPEAL_BY_ID[selectedAppealId]??null:null;
 const personFunded=state.plan.some(d=>d.initiativeId===person.initiativeId&&(d.scope==='citywide'||d.districtId===person.districtId));
 const personElsewhere=!personFunded&&state.plan.some(d=>d.initiativeId===person.initiativeId);
 const relation=getAppealRelation(APPEAL_BY_ID[person.appealId]!,state,mode);
 const localStories=STORIES.filter(s=>s.districtId===district);
 const roster=Array.from({length:4},(_,i)=>localStories[(rosterPage*4+i)%localStories.length]!);
 const meet=(storyId:string)=>{const story=STORY_BY_ID[storyId];if(!story)return;setPinned(story.id);setAnswer(state.plan.some(d=>d.initiativeId===story.initiativeId&&(d.scope==='citywide'||d.districtId===story.districtId))?'effect':'opening');setBookPage({page:'conversation'});onSelectAppeal(story.appealId);onVisit(story);if(reading)requestAnimationFrame(()=>requestAnimationFrame(()=>dialogRef.current?.focus({preventScroll:true})));};
 useEffect(()=>{onVisit(person);if(!reading)onSelectAppeal(person.appealId);},[]);
 useEffect(()=>{if(visit&&STORY_BY_ID[visit.storyId])meet(visit.storyId);},[visit?.id]);
 useEffect(()=>{if(person.districtId!==district){const next=STORIES.find(s=>s.districtId===district&&s.initiativeId===person.initiativeId)!;setPinned(next.id);setAnswer('opening');setRosterPage(0);onSelectAppeal(next.appealId);onVisit(next);}},[district]);
 useEffect(()=>{const resident=mode.id==='khanate'?RESIDENTS.find(r=>r.id===person.id)!:streetResident(person),anchor={...streetAnchor(person),label:PROJECT_NAMES[person.initiativeId]};adapter.show({selectedId:resident.id,anchor,residents:[resident,...RESIDENTS.filter(r=>r.location===person.districtId&&r.name!==person.name).slice(0,3)],observation:observe(resident,state,anchor,mode.narrative),phase:state.result&&state.comparisonPosition>=.5?1:0,proposal:state.candidate?.decision.initiativeId??null});},[adapter,person,state]);
 useEffect(()=>()=>adapter.clear(),[adapter]);
 useEffect(()=>adapter.subscribeSelection(id=>{const story=STORY_BY_ID[id]??STORIES.find(s=>s.name===RESIDENTS.find(r=>r.id===id)?.name&&s.districtId===district);if(story)meet(story.id);}),[adapter,district]);
 useEffect(()=>{try{session.setItem('alem:resident-context',JSON.stringify({story:pinned,reading,drawer,query}));}catch{}},[pinned,reading,drawer,query]);
 useEffect(()=>{setPage(0);},[query,districtFilter,topic,kind]);
 useEffect(onLayout,[onLayout,pinned,drawer,reading]);
 useEffect(()=>{if(reading)readingRef.current?.focus();},[reading,selectedAppealId]);
 useEffect(()=>{if(overlayOpen)return;const close=(e:KeyboardEvent)=>{if(e.key!=='Escape'||e.defaultPrevented||(e.target instanceof Element&&e.target.closest('dialog,#aya-dialogue')))return;if(reading){e.preventDefault();closeReading();return;}if(drawer){e.preventDefault();closeArchive();}};window.addEventListener('keydown',close,true);return()=>window.removeEventListener('keydown',close,true);},[reading,drawer,overlayOpen]);
 const read=(appeal:Appeal)=>{readerOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;readerAppeal.current=appeal.id;onSelectAppeal(appeal.id);setBookPage({page:'appeal',returnTo:drawer?'archive':'conversation'});};
 const filtered=useMemo(()=>{const search=query.trim().toLocaleLowerCase('en-US');return APPEALS.filter(a=>(districtFilter==='all'||a.districtId===districtFilter)&&(topic==='all'||a.topic===topic)&&(kind!=='stories'||!!a.storyId)&&(kind!=='plan'||['committed','calculated','partial'].includes(getAppealRelation(a,state,mode).kind))&&(!search||[a.id,a.title,a.applicant,a.circumstances,a.request,names[a.districtId],...a.initiativeIds.map(id=>INITIATIVES[id].name)].join(' ').toLocaleLowerCase('en-US').includes(search)));},[query,districtFilter,topic,kind,state]);
 const pageSize=12,maxPage=Math.max(0,Math.ceil(filtered.length/pageSize)-1),safePage=Math.min(page,maxPage);
 const words=answer==='remaining'?SHORT_LIMITS[person.initiativeId]:answer==='effect'?PROJECT_STORIES[person.initiativeId].benefit:shortOpening(person);
 return <section className="street-residents" aria-label={`Residents · ${mode.title}`} data-testid="residents-space" data-scene-ready={worldReady}>
  {!drawer&&!reading&&<section ref={dialogRef} tabIndex={-1} className="street-conversation" role="region" aria-label={`Conversation: ${person.name}`} data-testid="resident-conversation" data-occludes-city>
   <div className="street-topline" data-occludes-city><span className="eyebrow">ON THE CITY STREETS</span><h2>{districtName(district)}</h2><button className="text-button" ref={entryRef} onClick={()=>setBookPage({page:'archive'})}>{mode.id==='khanate'?'Petition book':'Request archive'}<ControlIcon kind="book" size={18}/></button></div>
   <header><ResidentPortrait visual={person.visual} mood={personFunded?'happy':'neutral'}/><div><span>{person.role} · {names[person.districtId]}</span><h2>{person.name}</h2><small>{personFunded?'✓ Your project is here':personElsewhere?'This project is selected elsewhere in the city':'Waiting for your decision'}</small></div></header>
  {!drawer&&!reading&&<aside className="street-roster" data-occludes-city aria-label="People to meet"><header><span>Who shall we meet?</span><button aria-label="Other residents" onClick={()=>setRosterPage(p=>p+1)}><ControlIcon kind="replay"/></button></header><div>{roster.map(story=><button key={story.id} data-story-id={story.id} aria-label={`${story.name}, ${story.role}. ${PROJECT_NAMES[story.initiativeId]}`} aria-pressed={person.id===story.id} onClick={()=>meet(story.id)}><ResidentPortrait visual={story.visual}/><span><strong>{story.name}</strong><small>{PROJECT_NAMES[story.initiativeId]}</small></span></button>)}</div></aside>}
   <div className="street-tabs" role="group" aria-label="Questions to ask"><button aria-pressed={answer==='opening'} onClick={()=>setAnswer('opening')}>What happened?</button><button aria-pressed={answer==='effect'} onClick={()=>setAnswer('effect')}>What will change?</button><button aria-pressed={answer==='remaining'} onClick={()=>setAnswer('remaining')}>What else?</button></div>
   <p className="street-words" aria-label="The resident's words" aria-live="polite">«{words}»</p>
   {answer==='effect'&&relation.resultId&&<p className="street-effect"><strong>{relation.before!==null?format(relation.before):'—'} → {relation.after!==null?format(relation.after):'—'}</strong><span>{indicatorNames[relation.indicator]} · after two years</span></p>}
   <button className="street-primary" onClick={()=>onChooseProject(person.initiativeId,person.districtId)}>{personFunded?'Change decision':personElsewhere?'Consider moving it':PROJECT_NAMES[person.initiativeId]}<b>{INITIATIVES[person.initiativeId].cost} {terms.unit}</b><ControlIcon kind="arrow-right" size={18}/></button>
   <details className="street-details"><summary>Story and request</summary><p>{person.opening}</p><p>{relation.description}</p><button onClick={()=>read(APPEAL_BY_ID[person.appealId]!)}>Read the request</button><button onClick={()=>onAskAya(`Help with the request «${APPEAL_BY_ID[person.appealId]!.title}» for residents of ${names[person.districtId]}.`,person.appealId)}>Discuss with Aya</button><small>This character and story are an educational scenario.</small></details>
  </section>}
    {drawer&&!reading&&<section className="living-register" aria-label="Request catalogue"><header><div><span className="living-eyebrow">{mode.id==='khanate'?'PETITIONS OF FIVE QUARTERS':'VOICES OF FIVE DISTRICTS'}</span><h2>{mode.id==='khanate'?'Petition book':'Resident requests'}</h2><p>{APPEALS.length} records · {STORIES.length} encounters with authors</p></div><button type="button" className="living-close" onClick={closeArchive} aria-label="Close request catalogue"><ControlIcon kind="close"/></button></header><div className="living-filters"><label className="living-search">Find a request<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="School, water, name or number…" type="search"/></label><label>{terms.district}<select value={districtFilter} onChange={e=>setDistrictFilter(e.target.value as DistrictId|'all')}><option value="all">All places</option>{DISTRICTS.map(d=><option key={d.id} value={d.id}>{d.name} · {APPEALS.filter(appeal=>appeal.districtId===d.id).length}</option>)}</select></label><label>Topic<select value={topic} onChange={e=>setTopic(e.target.value as PolicyArea|'all')}><option value="all">All topics</option>{Object.entries(TOPICS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Show<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="all">All requests</option><option value="stories">Meet the author</option><option value="plan">Related to the plan</option></select></label></div><div className="living-search-count" aria-live="polite">Found: {filtered.length}{query&&<button type="button" onClick={()=>setQuery('')}>Clear search</button>}</div><div className="living-appeal-list">{filtered.slice(safePage*pageSize,(safePage+1)*pageSize).map(a=>{const relation=getAppealRelation(a,state,mode);return <button type="button" key={a.id} data-appeal-id={a.id} className="living-appeal-row" onClick={()=>read(a)}><span className="living-appeal-district"><i style={{background:DISTRICT_COLORS[a.districtId]}}/>{names[a.districtId]}<small>{TOPICS[a.topic]}</small></span><span><strong>{a.title}</strong><span>{a.circumstances}</span><small>{a.id} · {a.storyId?'Meet the author':'Request to read'} · {relation.label}</small></span><ControlIcon kind="arrow-right" size={18}/></button>;})}{!filtered.length&&<div className="living-empty"><h3>No matches yet</h3><p>Try another topic or remove a filter.</p><button type="button" onClick={()=>{setQuery('');setTopic('all');setDistrictFilter('all');setKind('all');}}>Show all requests</button></div>}</div><footer className="living-pagination"><button type="button" disabled={safePage===0} onClick={()=>setPage(safePage-1)}><ControlIcon kind="arrow-back" size={18}/>Back</button><span>{safePage+1} / {maxPage+1}</span><button type="button" disabled={safePage>=maxPage} onClick={()=>setPage(safePage+1)}>Next<ControlIcon kind="arrow-right" size={18}/></button></footer><p className="living-provenance">{PROVENANCE}. This is not a database of private submissions.</p></section>}
    {reading&&selectedAppeal&&<AppealReader appeal={selectedAppeal} state={state} refElement={readingRef} onClose={closeReading} onMeet={meet} onProject={onChooseProject} onAsk={onAskAya}/>}
 </section>;
}
function AppealReader({appeal,state,refElement,onClose,onMeet,onProject,onAsk}:{appeal:Appeal;state:AppState;refElement:React.RefObject<HTMLElement|null>;onClose:()=>void;onMeet:(id:string)=>void;onProject:ResidentsSpaceProps['onChooseProject'];onAsk:ResidentsSpaceProps['onAskAya']}) {
  const {mode,INITIATIVES,DISTRICTS,areaNames:TOPICS,terms}=useContent();
  const names=Object.fromEntries(DISTRICTS.map(d=>[d.id,d.name]));
  const PROVENANCE=appeal.provenance;
  const relation=getAppealRelation(appeal,state,mode);
  return <article className="living-reader" ref={refElement} tabIndex={-1} aria-label={`Request: ${appeal.title}`}><button type="button" className="living-close" onClick={onClose} aria-label="Close request text"><ControlIcon kind="close"/></button><div className="living-document-heading"><span>SCENARIO REQUEST</span><code>{appeal.id}</code></div><p className="living-addressee">{appeal.addressee}<br/>From: {appeal.applicant}</p><h2>{appeal.title}</h2><p className="living-appeal-topic">{names[appeal.districtId]} / {TOPICS[appeal.topic]}</p><p>{appeal.circumstances}</p><p>{appeal.request}</p><aside className={`living-plan-relation ${relation.kind}`}><strong>{relation.label}</strong><p>{relation.description}</p><small>Completing the construction scene does not resolve the request.</small></aside><h3>Related decisions</h3><div className="living-related">{appeal.initiativeIds.map(id=><button type="button" key={id} onClick={()=>onProject(id,appeal.districtId)}><span>{INITIATIVES[id].name}</span><strong>{INITIATIVES[id].cost} {terms.unit}</strong><ControlIcon kind="arrow-right" size={18}/></button>)}</div><div className="living-reader-actions"><button type="button" className="living-primary" onClick={()=>onAsk(`Help with the request «${appeal.title}» for residents of ${names[appeal.districtId]}. Explain what the plan can do and which questions need separate checks.`,appeal.id)}>Discuss with Aya<ControlIcon kind="arrow-right" size={18}/></button>{appeal.storyId&&<button type="button" onClick={()=>onMeet(appeal.storyId!)}>Meet the author<ControlIcon kind="arrow-right" size={18}/></button>}</div><details className="living-sources"><summary>Where this scenario comes from</summary><p>{PROVENANCE}. {appeal.limitation}</p>{mode.id==='astana'&&<p>Sources describe general topics and request procedures. Names and circumstances were written for Alem; the number above is not an eOtinish reference. Reviewed on 28 September 2026.</p>}<ul>{appeal.sourceIds.map(id=><li key={id}><a href={SOURCES[id].url} target="_blank" rel="noreferrer">{SOURCES[id].title}<ControlIcon kind="arrow-right" size={16}/></a><small>{SOURCES[id].note}</small></li>)}</ul></details></article>;
}
export default ResidentsSpace;
