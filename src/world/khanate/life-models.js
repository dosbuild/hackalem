import {Mesh} from '../mesh-kit.js';

const coats=['#657b79','#ae8267','#787c61','#716e83','#967563'];
/** Small native silhouettes. The same feet, joints and beaks work at every zoom. */
export function creature(m,kind,phase,variant=0,grazing=0){
 const small=['sheep','lamb','dog'].includes(kind),camel=kind==='camel',lamb=kind==='lamb';
 const colors={horse:['#8d7360','#c9bba0','#6d6255'],foal:['#ab8970'],camel:['#b89973','#ae8b68'],sheep:['#ded4ba','#c4b99d','#e9dfc8'],lamb:['#eee1c8'],dog:['#554d42','#bb9f78']},body=colors[kind][variant%colors[kind].length],dark='#574f42';
 const hip=small?2.1:camel?4.7:3.8,length=small?1.8:camel?3.2:2.6,width=small?.92:1.12;
 m.ellipsoid(0,0,hip+.4,width,length,small?1:1.25,body,9,5);
 for(const x of [-.67,.67])for(const y of [-length*.65,length*.65]){
  const a=phase+(x*y>0?Math.PI:0),swing=grazing?0:Math.sin(a)*.65,knee=[x,y+swing*.55,hip*.49+(grazing?0:Math.max(0,Math.cos(a))*.15)],foot=[x,y+swing,grazing?.14:Math.max(.14,Math.cos(a)*.35)];
  m.beam([x,y,hip],knee,small?.17:.20,body,5);m.beam(knee,foot,small?.13:.16,dark,5);m.ellipsoid(foot[0],foot[1]-.10,foot[2],.22,.32,.17,dark,6,3);
 }
 const nibble=grazing?Math.sin(phase)*.10:0,headZ=(small?hip+.35:(camel?7.6:6.3)-grazing*4.7)+nibble,headY=-length-(small?.45:.55)-grazing*.65;
 m.beam([0,-length*.7,hip+.7],[0,headY+.3,headZ],small?.40:.52,body,7);
 m.ellipsoid(0,headY,headZ,small?.48:.60,small?.78:1.03,small?.52:.6,small&&kind!=='dog'?'#a19377':body,8,5);
 for(const x of [-.42,.42]){m.beam([x,headY+.18,headZ+.4],[x*1.35,headY+.3,headZ+(kind==='dog'?.7:1.05)],.11,dark,4);m.ellipsoid(x*.94,headY-.22,headZ+.14,.09,.12,.11,'#373b34',5,3);}
 if(kind==='horse'||kind==='foal')m.beam([0,-length*.72,hip+1.2],[0,headY+.45,headZ+.6],.13,dark,5);
 if(camel){for(const y of [-1.1,1.2])m.ellipsoid(0,y,hip+1.3,1,1.15,1.3,body,8,4);m.box(0,0,hip+1.65,2.45,2.3,.28,variant%2?'#697b80':'#986e5c');for(const x of [-1.45,1.45])m.ellipsoid(x,.2,hip+.45,.68,1.05,1.2,'#b6a281',7,4);}
 if(kind==='sheep'||lamb)for(const [x,y,z] of [[-.6,-.7,.8],[.5,.1,.9],[-.4,.9,.8]])m.ellipsoid(x,y,hip+z,.65,.85,.7,body,7,4);
 m.beam([0,length*.87,hip+.25],[(small?.6:.2)+Math.sin(phase+(variant%3))*(kind==='dog'?.45:.18),length+(small?.8:1.0),kind==='dog'?hip+1.2:hip-1.3],small?.13:.18,dark,5);
}
export function villager(m,phase,variant=0,activity='walk'){
 phase+=variant*.43;
 const coat=coats[variant%coats.length],skin=['#caa17f','#b88d68','#d6b18f'][variant%3],child=activity==='play',s=child?.72:1,walking=activity==='walk'||child,walk=walking?Math.sin(phase)*.7:0;
 // All dimensions are local; clothes and hats keep their shapes in overview.
 for(const side of [-1,1]){const lift=walking?Math.max(0,Math.cos(phase)*side)*.18:0;m.beam([side*.6,0,2.7*s],[side*.6,side*walk,.35+lift],.29,'#505a52',5);m.ellipsoid(side*.6,side*walk-.2,.27+lift,.35,.65,.26,'#49473d',6,3);}
 m.cylinder(0,0,1.7*s,1.06*s,2.9*s,coat,9,.75*s);m.cylinder(0,0,3*s,.98*s,.24*s,'#c0a070',9);
 m.ellipsoid(0,0,5.45*s,.91*s,.78*s,1.05*s,skin,9,5);m.ellipsoid(0,.08,6.10*s,.97*s,.82*s,.41*s,variant%3===1?'#d5c5a4':'#79694e',8,4);
 m.cylinder(0,0,5.98*s,.9*s,.20*s,coat,10);
 const gesture=activity==='work'?Math.sin(phase)*.45:activity==='talk'?Math.sin(phase)*.25:0;
 for(const side of [-1,1]){const hand=[side*1.15*s,-.15-side*walk*.45-(side===1?gesture:0),2.85*s+(side===1?gesture:0)];m.beam([side*.74*s,0,4.30*s],hand,.26*s,coat,5);m.ellipsoid(...hand,.27*s,.25*s,.30*s,skin,6,3);}
 if(variant%4===0){m.ellipsoid(1.42*s,-.1,2.4*s,.57*s,.51*s,.75*s,'#b28b63',8,4);m.cylinder(1.42*s,-.1,2.95*s,.24*s,.25*s,'#967553',7);}
 if(variant%4===1)m.box(1.2*s,-.1,2.4*s,.2*s,1.1*s,1.3*s,'#b69e76');
 if(variant%4===2)m.beam([1.3*s,0,.1],[1.3*s,0,4.1*s],.095*s,'#7c6c50',5);
 if(variant%4===3){m.ellipsoid(1.3*s,.2,2.5*s,.5*s,.65*s,.8*s,'#8c7961',7,4);m.beam([.6,0,4],[1.2,.1,3.1],.10,'#c9ae80',4);}
}
export function bird(m,phase,kind='gull',perched=false){
 const eagle=kind==='eagle',c=eagle?'#6b6252':'#e1dbc6',tip=eagle?'#554f45':'#7a8276',flap=Math.sin(phase)*(eagle?.15:.75),span=perched?.65:eagle?3.5:2.5;
 m.ellipsoid(0,0,0,.3,.95,.30,c,7,4);m.ellipsoid(0,-.7,.12,.26,.35,.27,c,6,4);m.beam([0,-.95,.1],[0,-1.27,.08],.085,'#b5a170',4);
 for(const side of [-1,1]){const elbow=[side*span*.5,.04,flap*.5],end=[side*span,.55,flap];m.tri([side*.13,-.5,0],elbow,[side*.12,.65,0],c);m.tri(elbow,end,[side*.12,.65,0],tip);}
 m.tri([-.3,.65,0],[.3,.65,0],[0,1.45,.07],tip);if(perched)for(const x of [-.15,.15])m.beam([x,0,0],[x,-.1,-.8],.05,'#aa9977',4);
}

// Cache bounded local poses; transform copies instead of rebuilding every animal.
const templates=new Map();
export function lifeTemplate(kind,phase=0,variant=0,activity='walk'){
 variant=((variant%6)+6)%6;
 const p=((Math.round(phase/(Math.PI*2)*16)%16)+16)%16,key=`${kind}/${p}/${variant%6}/${activity}`;
 if(templates.has(key))return templates.get(key);
 const m=new Mesh();m.kind=8;
 if(kind==='person')villager(m,p/16*Math.PI*2,variant,activity);
 else if(kind==='bird'||kind==='eagle')bird(m,p/16*Math.PI*2,kind,activity==='perch');
 else creature(m,kind,p/16*Math.PI*2,variant,activity==='graze'?.85:activity==='drink'?1:0);
 const data=m.pack();if(templates.size>=128)templates.delete(templates.keys().next().value);templates.set(key,data);return data;
}
export function appendPose(m,buffer,origin,angle,scale){
 const source=new DataView(buffer),c=Math.cos(angle),s=Math.sin(angle),start=m.bytes;
 if(start+buffer.byteLength>m.buffer.byteLength){let length=m.buffer.byteLength;while(length<start+buffer.byteLength)length*=2;const b=new ArrayBuffer(length);new Uint8Array(b).set(new Uint8Array(m.buffer));m.buffer=b;m.view=new DataView(b);}
 new Uint8Array(m.buffer,start,buffer.byteLength).set(new Uint8Array(buffer));
 for(let i=0;i<buffer.byteLength;i+=20){const x=source.getFloat32(i,true),y=source.getFloat32(i+4,true),z=source.getFloat32(i+8,true),nx=source.getInt8(i+12),ny=source.getInt8(i+13),o=start+i;m.view.setFloat32(o,origin[0]+(x*c-y*s)*scale,true);m.view.setFloat32(o+4,origin[1]+(x*s+y*c)*scale,true);m.view.setFloat32(o+8,origin[2]+z*scale,true);m.view.setInt8(o+12,Math.round(nx*c-ny*s));m.view.setInt8(o+13,Math.round(nx*s+ny*c));}
 m.bytes+=buffer.byteLength;
}
export const templateCacheBytes=()=>[...templates.values()].reduce((n,b)=>n+b.byteLength,0);
