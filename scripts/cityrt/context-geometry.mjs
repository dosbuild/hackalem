import {projectAnchor} from '../fullscreen/anchor-oracle.mjs';

const area=r=>Math.max(0,r.right-r.left)*Math.max(0,r.bottom-r.top);
const intersect=(a,b)=>({left:Math.max(a.left,b.left),top:Math.max(a.top,b.top),right:Math.min(a.right,b.right),bottom:Math.min(a.bottom,b.bottom)});
function subtract(a,b){
 const hit=intersect(a,b);if(!area(hit))return [a];
 return [{...a,bottom:hit.top},{...a,top:hit.bottom},{left:a.left,top:hit.top,right:hit.left,bottom:hit.bottom},{left:hit.right,top:hit.top,right:a.right,bottom:hit.bottom}].filter(r=>area(r)>0);
}

/** Project the actual useful model volume, independently of labels / renderer math.
 * A context must expose >=75% of its projected box and an uninterrupted 44px
 * square: most of the place and at least one standard control-sized detail view.
 * Phone exposure must be above the sheet; desktop sheets are excluded by bounds.
 */
export function projectContextVisibility({physicalBounds,camera,sheet,occlusions=[],mobile}){
 const points=physicalBounds.map(p=>projectAnchor(p,camera));
 const box={left:Math.min(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))};
 const band={left:8,top:130,right:camera.width-8,bottom:mobile?Math.min(camera.height-55,sheet.top-8):camera.height-55};
 let exposed=[intersect(box,band)].filter(r=>area(r)>0);
 for(const r of [...occlusions,sheet]){const padded={left:r.left-8,top:r.top-8,right:r.right+8,bottom:r.bottom+8};exposed=exposed.flatMap(piece=>subtract(piece,padded));}
 const fraction=area(box)>0?exposed.reduce((sum,r)=>sum+area(r),0)/area(box):0;
 return {box,band,points,exposed,fraction,visible:physicalBounds.length>=8&&points.every(p=>p.visible)&&fraction>=.75&&exposed.some(r=>r.right-r.left>=44&&r.bottom-r.top>=44)};
}
