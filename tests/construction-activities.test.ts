import {it,expect} from 'vitest';
import {sampleConstructionActivities} from '../src/world/construction-activities.js';
// @ts-expect-error Native JavaScript mesh builder, exercised as loaded by Vite
import {placements,projectMesh} from '../src/world/project-objects.js';
it('samples every project in a batch from its own persisted time, independent of the camera',()=>{
 const objects=['M4:esil','M8:nura','M10:saryarka'].map(key=>({...placements[key],slot:1})),receipts=objects.map((o:any,i:number)=>({key:o.key,startedAt:1000+i*1000,durationMs:12000}));
 const context={cache:new Map(),quietKeys:new Set<string>()};
 const active=sampleConstructionActivities(objects,receipts,6000,context);
 expect(Object.keys(active)).toHaveLength(3);expect(active.M4!.elapsed).toBe(5);expect(active.M8!.elapsed).toBe(4);expect(active.M10!.elapsed).toBe(3);
 expect(active.M4!.progress).toBeGreaterThan(active.M10!.progress);
 const partial=projectMesh(objects,false,{zoom:160,activities:active}),completed=projectMesh(objects,false,{zoom:160});
 expect(new Uint8Array(partial)).not.toEqual(new Uint8Array(completed));
 expect(sampleConstructionActivities(objects,receipts,16000,context)).toEqual({});
});
it('settles all reduced-motion projects without replay when the preference changes',()=>{
 const objects=['M4:esil','M8:nura'].map(key=>({...placements[key],slot:1})),receipts=objects.map((o:any)=>({key:o.key,startedAt:1000,durationMs:12000})),context={cache:new Map(),quietKeys:new Set<string>()};
 expect(sampleConstructionActivities(objects,receipts,2000,{...context,quiet:true})).toEqual({});
 expect(sampleConstructionActivities(objects,receipts,3000,context)).toEqual({});
 const later=[...receipts,{key:'M10:saryarka',startedAt:3000,durationMs:12000}];
 expect(Object.keys(sampleConstructionActivities([...objects,placements['M10:saryarka']],later,4500,context))).toEqual(['M10']);
});
