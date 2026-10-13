/** Authored pixel props, never calculation. One actor clock from the city owner. */
const actions=new Map();
function interactionTime(scene,seconds){
 const key=scene.selectedId+'@'+scene.anchor.id,nonce=scene.moment?.interaction??0;
 let state=actions.get(key);
 if(!state||state.nonce!==nonce){state={nonce,at:seconds};actions.set(key,state);if(actions.size>24)actions.delete(actions.keys().next().value);}
 return nonce?Math.max(0,seconds-state.at):Infinity;
}
export function drawGameplayOverlay(ctx,{scene,x,y,scale=1,elapsedSeconds=0,night=0,heldInitiative=null,encounterRelation=null}){
 if(!scene?.moment||!scene.selectedId)return;
 const {kind,treatments=[]}=scene.moment, t=elapsedSeconds, action=interactionTime(scene,t), responding=action<2.2;
 const dark=night>.45, ink=dark?'#a9c7b0':'#426456',paper=dark?'#cbc6a1':'#f9edc7', wood=dark?'#695842':'#a58050';
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(Math.max(.65,scale),Math.max(.65,scale));ctx.imageSmoothingEnabled=false;
 const rect=(px,py,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(px),Math.round(py),w,h);};
 // Objects and phase stay in place on both futures. Only evidence-backed treatments vary.
 if(kind==='garden'){
   const wobble=responding?0:(Math.floor(t*.8)%4===0?1:0);
   rect(18,-12,21,4,wood);rect(20,-8,3,13,wood);rect(34,-8+wobble,3,13-wobble,wood);
   rect(24,-22,10,10,'#b97853');rect(23,-24,12,3,paper);rect(28,-33,2,10,ink);rect(23,-31,6,3,'#8caa61');rect(29,-35,6,4,'#6e9457');
   const can=responding?15:7;rect(can,-6,9,7,'#77988b');rect(can+7,-5,7,2,'#77988b');rect(can+1,-10,5,2,ink);
   if(treatments.includes('M4')){rect(-34,-12,18,4,wood);rect(-33,-8,3,8,wood);rect(-20,-8,3,8,wood);rect(-39,-23,2,21,ink);rect(-44,-28,12,7,'#76995f');}
   // Clean-fuel is an area/service treatment, not a new park or a prediction of health.
   if(treatments.includes('M5')){rect(-40,-18,18,15,paper);rect(-38,-16,2,11,ink);rect(-32,-14,7,2,'#779aa1');rect(-32,-9,7,2,'#779aa1');rect(-39,-1,22,2,'#83aaa7');}
 }else if(kind==='drawing'){
   rect(17,-14,27,3,wood);rect(20,-11,3,16,wood);rect(38,-11,3,16,wood);
   rect(21,-21,17,8,'#718f85');const unfolded=responding||scene.moment.interaction>0;
   rect(unfolded?13:23,-22,unfolded?29:17,8,paper);rect(25,-20,7,4,'#a08c65');rect(35,-20,3,4,'#789862');
   rect(unfolded?39:37,-23-(Math.floor(t*1.2)%3===0?1:0),3,4,'#d8c393');
   if(treatments.includes('M7')){rect(-28,-11,13,3,paper);rect(-26,-8,2,7,wood);rect(-19,-8,2,7,wood);}
   if(treatments.includes('M4')){rect(-30,-24,3,25,wood);rect(-34,-31,12,10,'#789962');}
 }else if(kind==='dispatch'){
   rect(15,-16,31,4,wood);rect(18,-12,3,18,wood);rect(40,-12,3,18,wood);
   rect(19,-23,12,7,paper);rect(24,-26,12,7,paper);rect(27,-24,6,1,ink);
   const pencil=responding?25:41;rect(pencil,-18,8,2,'#ce9f4b');rect(pencil+7,-18,2,2,ink);
   rect(38,-25,5,5,ink);rect(37,-20,8,2,ink);
   if(treatments.includes('M12')){rect(-25,-21,14,14,paper);rect(-22,-18,3,3,ink);rect(-18,-15,5,2,ink);rect(-22,-10,9,1,ink);}
   if(treatments.includes('M14'))rect(-27,-5,18,3,'#b89351');
 }
 if(heldInitiative&&scene.proposal===heldInitiative){
   const bob=2;rect(-8,-57-bob,20,25,paper);rect(10,-57-bob,3,5,'#d5c99f');rect(-4,-50-bob,12,2,ink);rect(-4,-43-bob,8,2,ink);
   ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(2,-29);ctx.lineTo(2,-9);ctx.stroke();ctx.setLineDash([]);
 }
 if(encounterRelation?.anchorId===scene.anchor.id){ctx.strokeStyle=encounterRelation.relevant?'#ba974c':'#a7aa96';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,-35);ctx.lineTo(-19,-22);ctx.lineTo(-14,-11);ctx.stroke();rect(-17,-12,5,5,paper);}
 ctx.restore();
}
