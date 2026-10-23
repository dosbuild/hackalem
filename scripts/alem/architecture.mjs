import {createHash} from 'node:crypto';
import {ARCHITECTURE_PARTS,makeArchitecturePart} from '../../src/world/architecture-models.js';
import {hash,rgb,blend} from './city-style.mjs';

export const METRE=1/12000,GROUND=.00003,FACADE_CELL=.015;
export const FAMILY_NAMES=Object.freeze(Object.keys(ARCHITECTURE_PARTS));
export function sourceHeight(props){
 const height=Number(props.height_m),base=Number(props.base_m)||0;
 if(!Number.isFinite(height)||height<=0||base<0||base>=height)throw Error('Invalid source building height '+props.osm_id);
 return {height,base,top:GROUND+height*METRE,bottom:GROUND+base*METRE};
}
export function signedArea(ring){return ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;}
export function rectangleFrame(ring){
 if(ring.length!==4)return null;
 if(signedArea(ring)<0)ring=[ring[0],ring[3],ring[2],ring[1]];
 const edges=ring.map((p,i)=>{const q=ring[(i+1)%4],v=[q[0]-p[0],q[1]-p[1]],length=Math.hypot(...v);return {v,length};});
 if(edges.some(e=>e.length<2*METRE))return null;
 for(let i=0;i<4;i++){const a=edges[i],b=edges[(i+1)%4];if(Math.abs(a.v[0]*b.v[0]+a.v[1]*b.v[1])/(a.length*b.length)>.035)return null;}
 for(let i=0;i<2;i++)if(Math.abs(edges[i].length-edges[i+2].length)>Math.max(edges[i].length,edges[i+2].length)*.025)return null;
 return edges[0].length>=edges[1].length?ring:[ring[1],ring[2],ring[3],ring[0]];
}
export function classifyBuilding(props,polys){
 const t=props.tags||{},height=sourceHeight(props).height,ring=polys[0]?.[0]||[],area=polys.reduce((s,rings)=>s+rings.reduce((n,r,i)=>n+Math.abs(signedArea(r))*(i?-1:1),0),0)/(METRE*METRE),frame=rectangleFrame(ring);
 const edges=frame?.map((p,i)=>Math.hypot(p[0]-frame[(i+1)%4][0],p[1]-frame[(i+1)%4][1]))||[],aspect=edges.length?Math.max(...edges)/Math.min(...edges):1;
 if(['industrial','warehouse','garages','garage','hangar','shed','service','construction'].includes(t.building)||['industrial','warehouse'].includes(t['building:use']))return 'service-hall';
 if(['school','kindergarten','university','college','hospital','clinic','civic','public','religious','church','mosque','government','fire_station'].includes(t.building)||['school','kindergarten','university','college','hospital','clinic','townhall','place_of_worship'].includes(t.amenity))return 'civic-house';
 if(height>=40||height>=22&&['office','commercial','retail','hotel'].includes(t.building))return 'modern-tower';
 if(['apartments','dormitory','residential'].includes(t.building)&&height>8||height>8&&aspect>2.4)return 'residential-slab';
 if(['detached','house','bungalow','cabin','terrace'].includes(t.building)||height<=8&&area<450)return 'garden-home';
 if(height<=12&&area>1800)return 'service-hall';
 return 'street-block';
}
export function roofForm(props,rings,family,reserved=false){
 const t=props.tags||{},h=sourceHeight(props),frame=rings.length===1&&rectangleFrame(rings[0]),shape=t['roof:shape'];
 if(!frame||reserved||h.base>0||['modern-tower','service-hall','residential-slab'].includes(family)||shape==='flat'||h.height>22)return {shape:'flat',wallTop:h.top,frame:null,rise:0};
 if(shape&&!['gabled','hipped','half-hipped','pyramidal'].includes(shape))return {shape:'flat',wallTop:h.top,frame:null,rise:0};
 const short=Math.hypot(frame[0][0]-frame[3][0],frame[0][1]-frame[3][1]),rise=Math.min((h.height-h.base)*.22*METRE,short*.32,2.8*METRE);
 return {shape:shape==='gabled'||!shape&&hash(props.osm_id)%3===0?'gabled':'hipped',wallTop:h.top-rise,frame,rise};
}
export function sourceDigest(feature){return createHash('sha256').update(JSON.stringify({id:feature.id,geometry:feature.geometry,properties:feature.properties})).digest('hex');}

export function emitBuilding({rings,props,family,material:m,reserved,tri,quad,fill}){
 const h=sourceHeight(props),roof=roofForm(props,rings,family,reserved),top=roof.wallTop,cap=blend(m.wall,rgb('eee4ce'),.27),plinth=blend(m.wall,rgb('827d70'),.34),style=16+FAMILY_NAMES.indexOf(family);
 if(roof.shape==='flat')fill(rings,m.roof,h.top,2);
 else{
  const r=roof.frame,mid=(a,b,t=.5)=>[a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,h.top],u=mid(r[0],r[3]),v=mid(r[1],r[2]);
  if(roof.shape==='gabled'){
   quad([...r[0],top],[...r[1],top],v,u,m.roof,2);quad([...r[2],top],[...r[3],top],u,v,m.roof,2);
   tri([...r[0],top],u,[...r[3],top],m.wall,3,undefined,style);tri([...r[1],top],[...r[2],top],v,m.wall,3,undefined,style);
  }else{
   const ridgeA=mid(u,v,.22),ridgeB=mid(u,v,.78);
   quad([...r[0],top],[...r[1],top],ridgeB,ridgeA,m.roof,2);quad([...r[2],top],[...r[3],top],ridgeA,ridgeB,m.roof,2);
   tri([...r[3],top],[...r[0],top],ridgeA,m.roof,2);tri([...r[1],top],[...r[2],top],ridgeB,m.roof,2);
  }
 }
 for(let ri=0;ri<rings.length;ri++){
  const ring=rings[ri],inward=(signedArea(ring)>0?1:-1)*(ri?-1:1);
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!length)continue;
   const wallQuad=(a,b,c,d,col)=>inward>0?quad(a,b,c,d,col,3,style):quad(b,a,d,c,col,3,style);
   wallQuad([...a,h.bottom],[...b,h.bottom],[...b,top],[...a,top],m.wall);
   // Narrow material belts occupy the original facade plane. They cannot alter
   // a source contour, a raised part's base, or the measured top of its roof.
   const z=Math.min(top,h.bottom+.42*METRE),offset=.008*METRE,dx=-(b[1]-a[1])/length*inward,dy=(b[0]-a[0])/length*inward;
   const wallStrip=(lo,hi,col)=>wallQuad([a[0]-dx*offset,a[1]-dy*offset,lo],[b[0]-dx*offset,b[1]-dy*offset,lo],[b[0]-dx*offset,b[1]-dy*offset,hi],[a[0]-dx*offset,a[1]-dy*offset,hi],col);
   wallStrip(h.bottom,z,plinth);wallStrip(Math.max(h.bottom,top-.18*METRE),top,cap);
   if(roof.shape==='flat'&&length>2*METRE){const w=Math.min(.22*METRE,length*.025),p=[...a,h.top],q=[...b,h.top],r=[b[0]+dx*w,b[1]+dy*w,h.top],s=[a[0]+dx*w,a[1]+dy*w,h.top];if(inward>0)quad(p,q,r,s,cap,2);else quad(q,p,s,r,cap,2);}
   if(family==='street-block'||family==='civic-house'){const belt=h.bottom+Math.min(3.3*METRE,(top-h.bottom)*.5);if(belt+1*METRE<top)wallStrip(belt,Math.min(top,belt+.13*METRE),cap);}
  }
 }
 return roof;
}

/** One complete instance dataset; spatial groups only cull, never regenerate. */
export function createFacadeInstances(){
 const groups=new Map(),sources=[],families=Object.fromEntries(FAMILY_NAMES.map(f=>[f,0]));
 const add=(family,part,p,angle,id,columns=1,scale=METRE)=>{
  const key=`${family}/${part}/${columns}/${Math.floor(p[0]/FACADE_CELL)}/${Math.floor(p[1]/FACADE_CELL)}`;
  if(!groups.has(key))groups.set(key,{id:'architecture/'+key,family,part,columns,transforms:[],sources:[],bounds:[Infinity,Infinity,-Infinity,-Infinity,Infinity,-Infinity]});
  const group=groups.get(key),index=group.transforms.length/8;group.transforms.push(...p,scale,angle,1,1,1);group.sources.push(id);
  const a=ARCHITECTURE_PARTS[family],radius=(part==='door'?3:(columns-1)*a.pitch+a.width+1)*scale;
  for(const [i,v] of [[0,p[0]-radius],[1,p[1]-radius],[2,p[0]+radius],[3,p[1]+radius],[4,p[2]-.1*scale],[5,p[2]+(part==='door'?2.5:a.height+.2)*scale]])group.bounds[i]=[0,1,4].includes(i)?Math.min(group.bounds[i],v):Math.max(group.bounds[i],v);
  return {group:group.id,index};
 };
 return {
  building(f,m,reserved=false){
   const family=classifyBuilding(f.props,f.polys),h=sourceHeight(f.props),a=ARCHITECTURE_PARTS[family];let instanceCount=0,windowCount=0;families[family]++;
   const tags=f.props.tags||{},blank=['garage','garages','shed','hangar','construction'].includes(tags.building),levels=Number(tags['building:levels']),roofTops=f.polys.map(r=>roofForm(f.props,r,family,reserved).wallTop),height=Math.min(...roofTops)-h.bottom;
   const floors=Number.isFinite(levels)&&levels>0&&height/(levels*METRE)>=2.2?Math.round(levels):Math.max(1,Math.floor(height/(3*METRE))),floorHeight=height/floors;
   for(let pi=0;pi<f.polys.length;pi++)for(let ri=0;ri<f.polys[pi].length;ri++){
    const ring=f.polys[pi][ri],inward=(signedArea(ring)>0?1:-1)*(ri?-1:1),lengths=ring.map((p,i)=>Math.hypot(p[0]-ring[(i+1)%ring.length][0],p[1]-ring[(i+1)%ring.length][1])),entryEdge=lengths.indexOf(Math.max(...lengths));
    for(let ei=0;ei<ring.length;ei++){
     const p=ring[ei],q=ring[(ei+1)%ring.length],length=lengths[ei];if(length<.001*METRE)continue;
     const ux=(q[0]-p[0])/length,uy=(q[1]-p[1])/length,angle=Math.atan2(uy,ux)+(inward<0?Math.PI:0),n=Math.floor((length/METRE-.9)/a.pitch),spacing=length/(n+1),entry=ri===0&&ei===entryEdge&&h.base===0&&height>(family==='garden-home'?2.23:2.4)*METRE&&length>4*METRE;
     if(!blank&&n>0)for(let floor=0;floor<floors;floor++){
      const scale=spacing/a.pitch,bottom=h.bottom+floor*floorHeight+Math.max(.65*METRE,(floorHeight-a.height*scale)*.46);
      if(bottom+(a.height+.12)*scale>roofTops[pi]-.12*METRE)continue;
      const runs=[];let run=[];
      for(let bay=1;bay<=n;bay++){const at=spacing*bay;if(entry&&floor===0&&Math.abs(at-length*.5)<1.6*METRE){if(run.length)runs.push(run);run=[];}else run.push(bay);}if(run.length)runs.push(run);
      for(const sequence of runs)for(let at=0;at<sequence.length;at+=8){
       const columns=Math.min(8,sequence.length-at),start=spacing*sequence[at],last=spacing*sequence[at+columns-1];
       // Reverse-wound walls turn the strip so its outward face stays correct;
       // their anchor is the last bay, preserving the very same source positions.
       const position=inward>0?start:last;
       add(family,'window',[p[0]+ux*position,p[1]+uy*position,bottom],angle,f.id,columns,scale);instanceCount++;windowCount+=columns;
      }
     }
     if(entry){add(family,'door',[(p[0]+q[0])/2,(p[1]+q[1])/2,h.bottom+.04*METRE],angle,f.id);instanceCount++;}
    }
   }
   sources.push({id:f.id,family,instanceCount,windowCount});return family;
  },
  finish(){
   const chunks=[],descriptors=[],association=[];let offset=0;
   for(const group of groups.values()){
    const data=Buffer.from(new Float32Array(group.transforms).buffer);chunks.push(data);
    // One source ID per emitted part makes ownership independent of filenames.
    association.push({id:group.id,sources:group.sources});descriptors.push({id:group.id,family:group.family,part:group.part,columns:group.columns,offset,bytes:data.length,count:group.transforms.length/8,bounds:group.bounds,buildings:0,detailMetres:1});offset+=data.length;
   }
   return {buffer:Buffer.concat(chunks),groups:descriptors,association,sources,families,count:descriptors.reduce((s,g)=>s+g.count,0),windowCount:sources.reduce((n,b)=>n+b.windowCount,0),templateVertices:Object.fromEntries([...new Set(descriptors.map(g=>`${g.family}/${g.part}/${g.columns}`))].map(key=>{const [f,p,n]=key.split('/');return [key,makeArchitecturePart(f,p,Number(n)).byteLength/20];}))};
  },
 };
}
