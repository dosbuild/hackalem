/** Original paper construction grammar. Progress is funding, never simulated benefit. */
export function drawBudgetProposal(ctx,{x,y,id,progress,blocked=false,committed=false,citywide=false,now=0}) {
 const p=Math.max(0,Math.min(blocked?.82:1,progress)),scale=citywide?.72:1;
 if(p<=0)return;
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 const paper=blocked?'#ecc28c':'#f5e5b9',edge=blocked?'#b97a43':'#c7a66c',ink='#48645a';
 ctx.globalAlpha=committed?1:.55+p*.4;
 // The dashed paper site remains visible under each provisional structure.
 ctx.fillStyle='#203e3c50';ctx.beginPath();ctx.ellipse(4,9,51,18,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=committed?'#e5d7ad':paper;ctx.strokeStyle=edge;ctx.lineWidth=1.5;ctx.setLineDash(committed?[]:[4,3]);
 ctx.beginPath();ctx.moveTo(-48,0);ctx.lineTo(-9,-24);ctx.lineTo(48,0);ctx.lineTo(9,23);ctx.closePath();ctx.fill();ctx.stroke();ctx.setLineDash([]);
 const block=(bx,by,w,h)=>{ctx.fillStyle=paper;ctx.fillRect(bx,by-h,w,h);ctx.fillStyle=edge;ctx.fillRect(bx+w,by-h+4,5,h-4);ctx.fillStyle='#fff4d1';ctx.beginPath();ctx.moveTo(bx,by-h);ctx.lineTo(bx+5,by-h-5);ctx.lineTo(bx+w+5,by-h-5);ctx.lineTo(bx+w,by-h);ctx.closePath();ctx.fill();ctx.strokeStyle=edge;ctx.strokeRect(bx,by-h,w,h);};
 const seed=(tx,ty,k)=>{const growth=Math.max(0,Math.min(1,(p-k*.1)*2));if(!growth)return;ctx.fillStyle=ink;ctx.fillRect(tx-1,ty-15*growth,2,15*growth);ctx.fillStyle=paper;ctx.strokeStyle=edge;const h=18*growth;ctx.beginPath();ctx.moveTo(tx-4,ty-13-h);ctx.lineTo(tx+5,ty-13-h);ctx.lineTo(tx+5,ty-9-h);ctx.lineTo(tx+10,ty-9-h);ctx.lineTo(tx+10,ty-9);ctx.lineTo(tx-9,ty-9);ctx.lineTo(tx-9,ty-9-h);ctx.lineTo(tx-4,ty-9-h);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#fff3cf';ctx.fillRect(tx-5,ty-11-h,8,4);};
 if(id==='M4'||id==='M6'){
  for(let i=0;i<6;i++)seed(-28+(i%3)*23,-2+Math.floor(i/3)*13,i);
  if(p>.7){ctx.fillStyle=ink;ctx.fillRect(13,8,20,4);ctx.fillRect(15,12,2,5);ctx.fillRect(28,12,2,5);}
 } else if(id==='M7'||id==='M8'){
  for(let i=0;i<3;i++){const growth=Math.max(0,Math.min(1,(p-i*.18)*1.7));if(!growth)continue;block(-31+i*21,5+i*2,18,9+growth*34);ctx.fillStyle=ink;for(let j=0;j<Math.floor(growth*3);j++)ctx.fillRect(-26+i*21,1+i*2-j*10,8,5);}
  if(p>.85){ctx.fillStyle=ink;ctx.fillRect(-7,-36,3,12);ctx.fillStyle=paper;if(id==='M7'){ctx.fillRect(-4,-39,14,8);ctx.strokeStyle=edge;ctx.strokeRect(-4,-39,14,8);}else{ctx.fillRect(1,-39,14,5);ctx.fillRect(6,-44,4,15);}}
 } else if(id==='M1'||id==='M3'){
  ctx.strokeStyle=ink;ctx.lineWidth=id==='M3'?3:8;ctx.beginPath();ctx.moveTo(-36,8);ctx.lineTo(-10,-5);ctx.lineTo(36,-5);ctx.stroke();
  ctx.strokeStyle=paper;ctx.lineWidth=id==='M3'?2:3;ctx.setLineDash([7,4]);ctx.beginPath();ctx.moveTo(-36,8);ctx.lineTo(-10,-5);ctx.lineTo(-10+46*p,-5);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<Math.ceil(p*4);i++){block(-27+i*17,-5,10,id==='M3'?20:9);ctx.fillStyle=ink;ctx.fillRect(-25+i*17,-11,5,3);}
 } else if(id==='M10'||id==='M2'){
  for(let i=0;i<Math.ceil(p*4);i++){const bx=-31+i*21,by=4+Math.sin(i)*5,h=(18+12*p);ctx.fillStyle=ink;ctx.fillRect(bx,by-h,3,h);block(bx-4,by-h+9,9,id==='M2'?19:6);ctx.fillStyle=paper;ctx.fillRect(bx-1,by-h-6,3,3);if(p>.7){ctx.strokeStyle=edge;ctx.beginPath();ctx.ellipse(bx+2,by+2,10,4,0,0,Math.PI*2);ctx.stroke();}}
 } else if(id==='M11'){
  ctx.fillStyle=ink;ctx.fillRect(-34,-10,69,22);ctx.fillStyle=paper;for(let i=0;i<Math.ceil(p*6);i++)ctx.fillRect(-28+i*10,-8,5,18);
  if(p>.7){block(-32,-13,9,21);ctx.fillStyle=ink;ctx.fillRect(-30,-30,5,8);}
 } else if(id==='M13'||id==='M12'){
  const nodes=[[-32,3],[-14,-13],[8,12],[30,-4],[4,-30]];ctx.strokeStyle=ink;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(...nodes[0]);for(let i=1;i<Math.ceil(p*5);i++)ctx.lineTo(...nodes[i]);ctx.stroke();ctx.strokeStyle=paper;ctx.lineWidth=2;ctx.stroke();
  for(let i=0;i<Math.ceil(p*5);i++){const [bx,by]=nodes[i];block(bx-4,by+1,8,id==='M12'?12:5);}
 } else if(id==='M5'){
  // Residential area treatment: a group of homes, each marked as a proposal.
  for(let i=0;i<Math.ceil(p*7);i++){const bx=-32+(i%4)*19,by=-5+Math.floor(i/4)*16;block(bx,by,12,12+p*5);ctx.fillStyle=edge;ctx.beginPath();ctx.moveTo(bx-2,by-17);ctx.lineTo(bx+6,by-25);ctx.lineTo(bx+14,by-17);ctx.fill();ctx.strokeStyle=ink;ctx.beginPath();ctx.moveTo(bx+16,by-20);ctx.lineTo(bx+19,by-26);ctx.stroke();}
 } else if(id==='M9'){
  ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.strokeRect(-31,-9,62,26);ctx.beginPath();ctx.ellipse(0,4,10*p,7*p,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(0,17);ctx.stroke();if(p>.5){block(-32,-3,6,19);block(26,13,6,19);}
 } else if(id==='M14'){
  block(-20,9,29,15*p);block(9,9,13,11*p);ctx.fillStyle=ink;ctx.fillRect(-16,9,6,6);ctx.fillRect(14,9,6,6);ctx.strokeStyle=edge;ctx.lineWidth=2;for(let i=1;i<Math.ceil(p*4);i++){ctx.beginPath();ctx.arc(0,-15,7*i,Math.PI*1.08,Math.PI*1.92);ctx.stroke();}
 } else {
  for(let i=0;i<Math.ceil(p*6);i++)block(-28+(i%3)*23,Math.floor(i/3)*14,13,8+12*p);
 }
 if(!committed){ctx.strokeStyle=edge;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(-45,-4);ctx.lineTo(-45,-53);ctx.lineTo(40,-53);ctx.lineTo(40,-4);ctx.stroke();ctx.setLineDash([]);}
 ctx.font='bold 10px Arial';ctx.textAlign='center';const label=blocked?'! КОНФЛИКТ':committed?'▣ В ПЛАНЕ':p>=1?'ПРОЕКТ ГОТОВ':id==='M13'?'ЭСКИЗ СЕТИ':'ЭСКИЗ';const w=ctx.measureText(label).width+14;
 ctx.fillStyle=blocked?'#c38a4d':committed?'#4c6b57':'#f6e6bb';ctx.fillRect(-w/2,28,w,18);ctx.fillStyle=blocked||committed?'#fff6df':ink;ctx.fillText(label,0,40);
 // A short drafting signal, never a benefit animation. Reduced motion is supplied as now=0.
 if(!committed&&p<1&&now){ctx.fillStyle='#fff5d380';ctx.fillRect(-43+(now/20%85),-54,3,5);}
 ctx.restore();
}
