import {sourceHeight} from './architecture.mjs';

/** Preserve the vetted M5 cluster and all XY coordinates; migrate only its roof Z. */
export function rebaseRoofPlacements(catalog,features){
 const byId=new Map(features.map(f=>[f.id,f.props])),rows=[];let changed=0;
 for(const site of Object.values(catalog.records))if(site.roofs){
  for(const roof of site.roofs){
   const props=byId.get(roof.source);if(!props)throw Error('Missing M5 source roof '+roof.source);
   const z=sourceHeight(props).top+.00004,old=roof.position[2];
   if(old!==z){roof.position[2]=z;changed++;}
   rows.push({site:site.key,source:roof.source,xy:roof.position.slice(0,2),z});
  }
  const origin=site.roofs[0].position;if(site.origin[2]!==origin[2]){site.origin[2]=origin[2];changed++;}
 }
 return {changed,rows,method:'Same source IDs, plan coordinates, rings and cluster selection; only source-height roof elevation migrated.'};
}

export const SCENARIO_GROUND=Object.freeze({parcel:.000035,corridor:.000035,foot:.00004});
export function rebaseGroundPlacements(catalog){
 let changed=0;const setZ=(p,z)=>{if(p&&p.length>=3&&p[2]!==z){p[2]=z;changed++;}};
 for(const site of Object.values(catalog.records)){
  // The already reviewed hero school owns its direct site, delivery and cast paths.
  if(site.key!=='M7:nura'&&site.type!=='roofs')setZ(site.origin,SCENARIO_GROUND[site.type]||SCENARIO_GROUND.parcel);
  for(const spot of site.peopleSpots||[])setZ(spot.position,SCENARIO_GROUND.foot);
  for(const furniture of site.furniture||[])if(furniture.ground!==SCENARIO_GROUND.foot){furniture.ground=SCENARIO_GROUND.foot;changed++;}
 }
 return {changed,protocol:SCENARIO_GROUND,method:'Elevation-only migration; keys, XY, rings, routes, source IDs and selected clusters preserved.'};
}
