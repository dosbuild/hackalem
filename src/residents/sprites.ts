import type { Activity, Resident, Visual } from './types';

/** Source art: small integer-pixel layered shapes, 32×40 logical pixels. */
export const SPRITE_WIDTH=32, SPRITE_HEIGHT=40;
export interface PixelPainter { fillStyle:string|CanvasGradient|CanvasPattern; fillRect:(x:number,y:number,w:number,h:number)=>void }
export function paintSprite(c:PixelPainter,v:Visual,activity:Activity='idle',frame=0) {
  const r=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const shadow='#273b3b', trousers='#35434c', shoe='#24353c';
  const headY=v.build==='tall'?3:v.build==='small'?8:5;
  const wide=v.build==='broad'?2:0;
  const step=activity==='walk'?(frame%2?2:-2):0;
  const wave=activity==='acknowledge'||activity==='respond';
  const hands=activity==='handle'||activity==='exchange'||activity==='signature';
  const handY=wave?headY+4+(frame%2):hands?20-(frame%2):activity==='wait'?23:25;
  r(7,37,20,2,'#30443c66');
  // Trouser shape, separate feet, stance preserved between scenarios.
  r(11-wide,27,5,9+step,trousers);r(18,27,5,9-step,trousers);
  r(9-wide,35+step,7,2,shoe);r(18,35-step,8,2,shoe);
  const hem=v.cut==='long'?30:v.cut==='vest'?25:27;
  r(9-wide,headY+11,16+wide,hem-headY-11,shadow);
  r(10-wide,headY+11,14+wide,hem-headY-12,v.coat);
  r(11-wide,headY+12,3,hem-headY-14,v.accent);
  r(22,headY+13,2,hem-headY-14,'#263a3b44');
  r(16,headY+12,1,hem-headY-12,'#263a3b88');
  if(v.cut==='vest'){r(7-wide,headY+13,4,10,v.accent);r(23,headY+13,4,10,v.accent);}
  else{r(7-wide,headY+13,4,9,v.coat);r(24,headY+12,3,Math.max(3,handY-headY-9),v.coat);}
  r(7-wide,headY+21,3,3,v.skin);r(24,handY,3,3,v.skin);
  r(15,headY+9,5,4,v.skin);
  r(12,headY,11,9,shadow);r(12,headY+2,11,7,v.skin);r(13,headY+7,9,3,v.skin);
  r(12,headY,11,3,v.hair);r(11,headY+2,2,5,v.hair);r(22,headY+2,2,4,v.hair);
  r(wave?18:20,headY+5,1,1,shadow);r(23,headY+6,1,2,v.skin);
  if(v.head==='bob'){r(10,headY+2,3,10,v.hair);r(22,headY+2,3,9,v.hair);}
  if(v.head==='bun'){r(8,headY+1,4,4,v.hair);}
  if(v.head==='cap'){r(11,headY-1,12,3,v.accent);r(20,headY+2,7,2,v.accent);}
  if(v.head==='hood'){r(9,headY-2,16,3,v.coat);r(9,headY+1,3,10,v.coat);r(24,headY+1,2,10,v.coat);}
  const py=hands?20-(frame%2):26;
  switch(v.prop){
    case 'watering-can':r(24,py,7,7,'#8eaa99');r(25,py+1,4,4,'#527b6f');r(29,py-3,2,5,'#bad1ad');r(20,py+1,6,2,'#bad1ad');r(20,py,2,3,'#8eaa99');break;
    case 'plant':r(23,py+3,7,6,'#b57350');r(25,py-4,2,8,'#587a50');r(22,py-3,4,3,'#72925d');r(26,py-6,4,3,'#84a66b');break;
    case 'gloves':r(23,py,7,3,v.accent);r(24,py+3,2,3,v.accent);r(27,py+3,2,3,v.accent);break;
    case 'book':case 'folder':r(23,py-3,7,10,v.prop==='book'?'#cf8852':'#bad2c9');r(24,py-1,5,2,'#f3e7c5');r(24,py+4,5,1,'#f3e7c5');break;
    case 'clipboard':r(22,py-3,8,10,'#ac8c5e');r(23,py-1,6,7,'#e9e0c4');r(25,py-4,3,2,'#607675');break;
    case 'thermos':r(24,py-4,4,11,'#9dacad');r(24,py-5,4,2,'#394d58');r(25,py,2,4,'#dbe4d0');break;
    case 'ball':r(22,py-2,8,8,'#d4a355');r(23,py-3,6,10,'#d4a355');r(25,py-2,2,8,'#795b3b');r(22,py+1,8,2,'#795b3b');break;
    case 'toolbox':r(21,py+1,11,7,'#637f85');r(24,py-1,5,2,'#233e44');r(21,py+3,11,1,'#b1bdb5');r(25,py+2,2,3,'#dfc574');break;
    case 'satchel':case 'tote':r(20,headY+11,2,13,v.accent);r(22,24,9,10,v.prop==='tote'?'#d0bc88':'#906640');r(24,22,5,3,v.accent);break;
    case 'umbrella':r(26,py,2,10,'#294852');r(24,py+7,5,7,v.accent);r(26,py+14,1,3,shoe);break;
    case 'racket':r(25,py,2,10,'#c0bba3');r(23,py-6,6,7,'#d4be8c');r(24,py-5,4,5,'#5b7976');break;
    case 'camera':r(23,py,8,5,'#32424c');r(25,py-1,3,2,'#32424c');r(26,py+1,3,3,'#acc5c4');break;
    case 'headphones':r(11,headY-2,13,2,shoe);r(10,headY+3,3,5,shoe);r(22,headY+3,3,4,shoe);break;
    case 'bread':r(23,py-1,7,10,'#d4b789');r(24,py-4,3,6,'#bd8949');r(27,py-3,3,5,'#cc9b56');break;
    case 'broom':r(27,13,2,24,'#a98458');r(24,34,8,4,'#bfa86b');break;
    case 'scarf':r(11,headY+10,12,3,v.accent);r(12,headY+13,3,9,v.accent);break;
    case 'cart':r(28,py-1,2,11,'#b6bbb0');r(26,py+4,6,8,'#a68b5e');r(25,35,3,3,shoe);r(30,35,2,3,shoe);break;
    case 'stroller':r(25,py-2,2,9,'#b8c5b6');r(23,py+3,9,8,'#7c8b7e');r(24,py+1,7,5,v.accent);r(24,35,3,3,shoe);r(30,35,2,3,shoe);break;
  }
  if(activity==='signature'||activity==='handle'){
    if(v.prop==='watering-can'){r(19,py+4+(frame%2)*2,1,2,'#8dbac0');r(21,py+7+(frame%2),1,2,'#8dbac0');}
    if(v.prop==='book'||v.prop==='folder'){r(23,py+1,frame%2?3:6,1,'#fcf0d4');}
    if(v.prop==='gloves'&&frame%2){r(23,py+2,7,2,v.accent);r(25,py+3,4,1,'#9f966f');}
    if(v.prop==='toolbox'&&frame%2){r(21,py,11,2,'#aac0b5');}
    if(v.prop==='plant'&&frame%2){r(25,py,4,1,'#ddd2a7');}
  }
  if(v.mobility==='cane'){r(5,25,2,12,'#c1b69c');r(5,24,5,2,'#c1b69c');r(4,37,3,1,shoe);}
  if(v.mobility==='wheelchair'){
    r(8,21,2,12,'#aebbb6');r(9,29,17,3,'#aebbb6');r(24,29,2,7,'#aebbb6');r(21,35,8,2,shoe);
    r(5,30,11,7,shoe);r(7,28,7,11,shoe);r(7,31,7,5,'#8caaa4');r(9,30,3,7,'#8caaa4');r(10,31,1,5,shoe);r(6,33,9,1,shoe);r(24,36,4,3,shoe);
  }
}

export function spriteCanvas(resident:Resident,activity:Activity='idle',frame=0):HTMLCanvasElement {
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=40;
  paintSprite(canvas.getContext('2d')!,resident.visual,activity,frame);return canvas;
}

/** All frames share the same shape source; renderer caches these, no per-frame asset generation. */
export function buildAtlas(residents:readonly Resident[]):Map<string,HTMLCanvasElement[]> {
  const atlas=new Map<string,HTMLCanvasElement[]>();
  const activities:Activity[]=['idle','walk','acknowledge','wait','handle','exchange','respond','signature'];
  for(const r of residents)atlas.set(r.id,activities.flatMap(a=>[spriteCanvas(r,a,0),spriteCanvas(r,a,1)]));
  return atlas;
}
export function frameIndex(activity:Activity,frame:number):number {
  return ['idle','walk','acknowledge','wait','handle','exchange','respond','signature'].indexOf(activity)*2+frame%2;
}
