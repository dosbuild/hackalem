import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import astana from '../src/world/astana-definition.js';
import khanate from '../src/world/khanate/definition.js';
import {collectProgramSites,resolveProgramAnchor,nearestProgramSite} from '../src/world/program-runtime.js';

// Execute the native actor closure with real world data and fixed animation
// time. Browser acceptance separately exercises the actual pointer gestures.
const source=readFileSync(new URL('../src/world/runtime-core.js',import.meta.url),'utf8');
const start=source.indexOf('\n function scenarioActors('),end=source.indexOf('\n function ',start+1);
if(start<0||end<0)throw Error('Missing native actor function');
const actors=new Function('world','sites','focusedSite','center','selectedCommitment','candidate','resolveProgramAnchor','nearestProgramSite',`
 const current={x:center[0],y:center[1],zoom:90},props={selectedCommitment,candidate},scene=null;
 const placements=world.projects.placements,RESIDENTS=world.residents,isHeroSchool=world.isHeroSchool;
 const footprintKinds=world.projects.footprintKinds,projectNames=world.projectNames;
 const activities={},born=0,reduced=()=>false,motionNow=now=>now;
 ${source.slice(start,end)}
 return scenarioActors(4000);
`);
const fixture=(world,id)=>{
 const decision={initiativeId:id,scope:'district',districtId:'esil'},objects=world.projects.projectObjects({commitments:[decision],candidate:null,result:null,comparisonPosition:0},world.bootstrap.districts.features);
 return collectProgramSites(objects,world.projects.programSites);
};
const positions=rows=>rows.map(r=>({id:r.resident.id,position:r.position,anchor:r.anchor.id}));

it('keeps the inspected Astana park cast and child anchors stable across the real parent-distance boundary',()=>{
 const sites=fixture(astana,'M4'),child=sites.find(s=>s.key==='M4:esil:area-1196402246'),parent=sites.find(s=>s.key==='M4:esil');
 const centre=child.origin,person=child.peopleSpots[0].position;
 expect(nearestProgramSite(sites,centre).key).toBe(child.key);
 expect(nearestProgramSite(sites,person).key).toBe(parent.key);
 const before=actors(astana,sites,child,centre,'M4',null,resolveProgramAnchor,nearestProgramSite),panned=actors(astana,sites,child,person,'M4',null,resolveProgramAnchor,nearestProgramSite);
 expect(before.length).toBeGreaterThan(0);expect(positions(panned)).toEqual(positions(before));
 expect(panned.every(r=>r.anchor.id==='program:'+child.key)).toBe(true);
 const city=actors(astana,sites,child,person,null,null,resolveProgramAnchor,nearestProgramSite);
 expect(city.every(r=>r.anchor.id==='scenario:'+parent.key)).toBe(true);
});

it('retains an inspected Khanate treatment court during panning and releases it for City or a proposal',()=>{
 const sites=fixture(khanate,'M8'),child=sites.find(s=>s.isChild),parent=sites.find(s=>!s.isChild);
 const before=actors(khanate,sites,child,child.origin,'M8',null,resolveProgramAnchor,nearestProgramSite),panned=actors(khanate,sites,child,parent.origin,'M8',null,resolveProgramAnchor,nearestProgramSite);
 expect(before.length).toBeGreaterThan(0);expect(positions(panned)).toEqual(positions(before));
 for(const [selected,candidate] of [[null,null],['M8',{decision:{initiativeId:'M8'}}]]){
  const free=actors(khanate,sites,child,parent.origin,selected,candidate,resolveProgramAnchor,nearestProgramSite);
  expect(free.every(r=>r.anchor.id==='scenario:'+parent.key)).toBe(true);
 }
});

it('keeps parent transport programs populated at their representative working stops',()=>{
 let childStops=0;
 for(const world of [astana,khanate])for(const id of ['M1','M3']){
  const sites=fixture(world,id),parent=sites.find(s=>!s.isChild),pose=world.choreography.closePose(parent),center=[pose.x,pose.y],nearest=nearestProgramSite(sites,center);
  if(!nearest?.isChild)continue;
  childStops++;
  const rows=actors(world,sites,parent,center,id,null,resolveProgramAnchor,nearestProgramSite);
  expect(rows.length).toBeGreaterThan(0);expect(rows.every(r=>r.anchor.id==='program:'+nearest.key)).toBe(true);
 }
 expect(childStops).toBeGreaterThan(0);
});
