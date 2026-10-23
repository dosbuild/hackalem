import {describe,it,expect} from 'vitest';
import bootstrap from '../src/world/bootstrap.json';
// @ts-expect-error Native packed geometry is exercised without a renderer.
import {placements,projectObjects,projectMesh,projectPreviewFrame,projectFocusBounds} from '../src/world/project-objects';

type Site={key:string;id:string;district:string;origin:number[];peopleSpots:{position:number[];angle:number}[];roofs?:{source:string;position:number[];rings:number[][][]}[]};
const sites=Object.values(placements) as Site[];
function equalShape(a:ArrayBuffer,b:ArrayBuffer){
 if(a.byteLength!==b.byteLength)return false;
 const A=new DataView(a),B=new DataView(b);
 for(let i=0;i<a.byteLength;i+=20)for(let axis=0;axis<3;axis++)if(A.getFloat32(i+axis*4,true)!==B.getFloat32(i+axis*4,true))return false;
 return true;
}
describe('modern project presentation geometry',()=>{
 it('shows the complete planned silhouette at every offered budget, without changing source records',()=>{
  const before=JSON.stringify(placements),options={zoom:180,seconds:4,preview:true,activities:{}};
  for(const site of sites.filter(s=>s.key!=='M7:nura')){
   const completed=projectMesh([{...site,proposal:false,state:'planned',progress:1}],false,options);
   expect(completed.byteLength,site.key).toBeGreaterThan(0);
   for(const progress of [0,.35,1]){
    const proposed=projectMesh([{...site,proposal:true,state:'preview',progress}],false,options);
    expect(equalShape(proposed,completed),`${site.key} / budget ${progress}`).toBe(true);
   }
  }
  expect(JSON.stringify(placements)).toBe(before);
 });
 it('retains all five places for distributed and district service interpretations',()=>{
  for(const initiativeId of ['M12','M13','M14']){
   const decisions=initiativeId==='M13'?bootstrap.districts.features.map(d=>({initiativeId,scope:'district',districtId:d.id})):[{initiativeId,scope:'citywide'}];
   const objects=decisions.flatMap(decision=>projectObjects({commitments:[decision],candidate:null,scenarioRevision:1,result:null,comparisonPosition:0},bootstrap.districts.features));
   expect(objects).toHaveLength(5);expect(new Set(objects.map((o:Site)=>o.district)).size).toBe(5);
   for(const o of objects){expect(o.key).toBe(`${initiativeId}:${o.district}`);expect(placements[o.key].origin).toEqual(o.origin);}
  }
 });
 it('frames corridor previews at an actual stop and heating at its vetted resident point, retaining native roof context',()=>{
  const corridor=placements['M1:esil'],frame=projectPreviewFrame(corridor);
  expect(corridor.furniture.some((q:{point:number[]})=>q.point[0]===frame.center[0]&&q.point[1]===frame.center[1])).toBe(true);
  expect(Math.max(...frame.span)).toBeLessThan(.005);
  for(const site of sites){const points=projectFocusBounds(site);expect(points,site.key).toHaveLength(8);expect(points.every((point:number[])=>point.length===3&&point.every(Number.isFinite)),site.key).toBe(true);}
  const roofSite=placements['M5:esil'],roofFrame=projectPreviewFrame(roofSite);
  expect(roofFrame.contextSources).toEqual([roofSite.roofs[0].source]);
  expect(roofFrame.center.slice(0,2)).toEqual(roofSite.peopleSpots[0].position.slice(0,2));
  expect(roofFrame.span).toEqual([.0004,.0004]);expect(roofFrame.center[2]).toBeCloseTo(roofSite.peopleSpots[0].position[2]+.00015,10);
 });
});
