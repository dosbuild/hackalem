import {Mesh} from './mesh-kit.js';

// Metre-scale parts. Placement and colour belong to the attributed source building.
export const ARCHITECTURE_PARTS=Object.freeze({
 'garden-home':{width:1.18,height:1.35,pitch:2.8,frame:.09,stone:'#d7cab2',glass:'#577d80'},
 'street-block':{width:1.35,height:1.6,pitch:3.15,frame:.1,stone:'#dccfb5',glass:'#51757b'},
 'residential-slab':{width:1.3,height:1.5,pitch:3.05,frame:.085,stone:'#d3d3c3',glass:'#647f81'},
 'modern-tower':{width:1.65,height:1.95,pitch:2.05,frame:.055,stone:'#a1b2aa',glass:'#68928f'},
 'civic-house':{width:1.5,height:1.85,pitch:3.6,frame:.12,stone:'#e0d6bd',glass:'#50767c'},
 'service-hall':{width:1.8,height:1.1,pitch:4.5,frame:.08,stone:'#c5d0c5',glass:'#658386'},
});

export function makeArchitecturePart(family,part='window',columns=1){
 const a=ARCHITECTURE_PARTS[family];if(!a)throw Error('Unknown architecture family '+family);
 if(!Number.isInteger(columns)||columns<1||columns>8||part==='door'&&columns!==1)throw Error('Invalid facade strip');
 const m=new Mesh(),w=part==='door'?(family==='service-hall'?2.6:1.3):a.width,h=part==='door'?(family==='garden-home'?2.1:2.25):a.height,t=a.frame;
 for(let column=0;column<columns;column++){
 m.at([column*a.pitch,0,0]);
 // The wall is y=0; the viewer-facing side is negative y. Sills project slightly,
 // while the glass sits behind the frame, with one coherent opening per bay.
 m.box(0,-.025,0,w+.16,.05,h+.12,'#69736f');
 m.box(0,-.052,.045,w,.028,h-.035,part==='door'?'#566462':a.glass);
 for(const x of [-1,1])m.box(x*(w/2+t/2),-.085,-.02,t,.13,h+.12,a.stone);
 m.box(0,-.085,h-.005,w+t*2,.13,t,a.stone);
 m.box(0,-.115,-.03,w+t*2+.09,.2,.11,a.stone);
 if(part==='window'){
  if(family!=='service-hall')m.box(0,-.071,.03,.055,.052,h-.07,a.stone);
  // A small upper pane has depth and a quiet light face, not a noisy shine grid.
  m.box(-w*.23,-.073,h*.72,w*.32,.018,.045,'#98a9ab');
 }else{
  m.box(0,-.076,.05,.055,.04,h-.1,a.stone);
  m.box(w*.32,-.12,.95,.04,.05,.19,'#b9b09b');
 }
 }
 return m.pack();
}
