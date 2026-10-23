/** Child places retain one funded initiative and its authoritative presentation. */
export function collectProgramSites(objects,childrenFor){
 const sites=[],keys=new Set();
 for(const parent of objects){
  for(const candidate of [parent,...(childrenFor?.(parent)??[])]){
   if(!candidate?.key||keys.has(candidate.key))continue;
   keys.add(candidate.key);
   const child=candidate.key!==parent.key;
   sites.push({...parent,...candidate,id:parent.id,district:parent.district,slot:parent.slot,proposal:parent.proposal,phase:parent.phase,state:parent.state,evidence:parent.evidence,resultId:parent.resultId,revision:parent.revision,citywide:parent.citywide,parentKey:child?parent.key:undefined,isChild:child,program:child?null:parent.program});
  }
 }
 return sites;
}

export function programLocations(sites,names){
 return sites.filter(site=>!site.proposal).map(site=>({initiativeId:site.id,districtId:site.district,siteId:site.key,label:site.label??names[site.id],anchorId:`${site.isChild?'program':'scenario'}:${site.key}`}));
}

export function resolveProgramAnchor(anchorId,sites,placements){
 if(anchorId.startsWith('program:'))return sites.find(site=>site.key===anchorId.slice(8))??null;
 if(anchorId.startsWith('scenario:'))return sites.find(site=>site.key===anchorId.slice(9))??placements[anchorId.slice(9)]??null;
 return null;
}

export function nearestProgramSite(sites,center,districtId=null){
 let nearest=null,distance=Infinity;
 for(const site of sites){
  if(site.proposal||districtId&&site.district!==districtId)continue;
  const d=Math.hypot(site.origin[0]-center[0],site.origin[1]-center[1]);
  if(d<distance){nearest=site;distance=d;}
 }
 return distance<.055?nearest:null;
}
