import {placements} from './geography.js';
import {programSites,programSource,auditKhanatePrograms} from './programs.js';
import {programSiteArchitecture,programConnectorArchitecture} from './program-models.js';
import {pointSegment,inRing} from '../placement-geometry.js';

// Full packed triangles are checked in addition to the planning envelopes.
// This catches oversized furniture, tree canopies and ribbon mitres after
// material/model edits, even when a site's centre has not moved.
export function auditKhanateProgramMeshes(){
 const report=auditKhanatePrograms(),issues=[...report.issues],checked={...report.checked,vertices:0,triangles:0,attachedHouseholds:0};
 for(const parent of Object.values(placements))for(const site of programSites(parent)){
  if(site.legacy&&site.id!=='M4')continue;
  const architecture=programSiteArchitecture(site,parent),data=new DataView(architecture);
  for(let at=0;at<data.byteLength;at+=20){checked.vertices++;const p=[0,4,8].map(offset=>data.getFloat32(at+offset,true));if(!p.every(Number.isFinite)){issues.push(`${site.key}: nonfinite packed vertex`);break;}
   if(!site.hostHomeId&&Math.hypot(p[0]-site.origin[0],p[1]-site.origin[1])>site.radius+.000002){issues.push(`${site.key}: rendered solid exceeds audited envelope`);break;}
  }
  if(site.hostHomeId){checked.attachedHouseholds++;const host=programSource.homes.find(h=>h.id===site.hostHomeId);if(!host)issues.push(`${site.key}: missing attachment host`);continue;}
  const meshes=[architecture,...(site.approach?[programConnectorArchitecture(site,parent)]:[])];
  for(const mesh of meshes){const view=new DataView(mesh);for(let at=0;at<view.byteLength;at+=60){checked.triangles++;
   const ring=[0,20,40].map(offset=>[view.getFloat32(at+offset,true),view.getFloat32(at+offset+4,true)]);
   const min=[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1]))],max=[Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
   for(const home of programSource.homes){if(home.origin[0]+home.radius<min[0]||home.origin[0]-home.radius>max[0]||home.origin[1]+home.radius<min[1]||home.origin[1]-home.radius>max[1])continue;
    if(inRing(home.origin,ring)||ring.some((p,i)=>pointSegment(home.origin,p,ring[(i+1)%3])<home.radius-.000002)){issues.push(`${site.key}: rendered triangle intersects ${home.id}`);break;}
   }
  }}
 }
 return {...report,ok:issues.length===0,issues:[...new Set(issues)],checked};
}
