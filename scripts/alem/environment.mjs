/** Street-led gardens and courtyard rooms. No resident logic or gameplay state. */
import {bounds,overlaps,inPolygon,polygonTouches,rectangle,corridor,spatialIndex} from '../../src/world/placement-geometry.js';
import {mapXY} from '../../src/world/city-math.js';
import {families,rgb,blend,hash} from './city-style.mjs';
import {METRE} from './architecture.mjs';
export function buildEnvironment({features,placements,anchors,landmarkReservations=[],districtAt,tri,quad,fill,ribbon,total,ranges}){
 const buildings=[],water=[],greens=[],streets=[],reserved=[];
 for(const f of features){for(const rings of f.polys){const item={rings,bounds:bounds(rings[0]),f};if(f.layer==='buildings')buildings.push(item);if(f.layer==='water')water.push(item);if(f.layer==='green')greens.push(item);}
  if(f.layer==='streets'&&f.props.tags?.tunnel!=='yes')for(const line of f.lines)for(let i=1;i<line.length;i++){const t=f.props.tags||{},walking=['path','footway','cycleway','steps','track','pedestrian'].includes(t.highway),major=['motorway','trunk','primary','secondary'].includes(t.highway),width=major?.00053:walking?.00015:.00033,rings=[corridor(line[i-1],line[i],width)];streets.push({rings,bounds:bounds(rings[0]),a:line[i-1],b:line[i],f,major,walking,width});}
 }
 for(const site of Object.values(placements)){
  if(site.footprint)reserved.push({rings:[site.footprint],bounds:bounds(site.footprint)});
  if(site.route)for(let i=1;i<site.route.length;i++){const rings=[corridor(site.route[i-1],site.route[i],.00175)];reserved.push({rings,bounds:bounds(rings[0])});}
  for(const spot of [...(site.peopleSpots||[]),...(site.furniture||[])]){const rings=[rectangle(spot.position||spot.point,.0018,.0018)];reserved.push({rings,bounds:bounds(rings[0])});}
 }
 for(const anchor of Object.values(anchors)){const rings=[rectangle(mapXY(anchor.position),.004,.004)];reserved.push({rings,bounds:bounds(rings[0])});}
 for(const b of landmarkReservations){const rings=[rectangle([(b[0]+b[2])/2,(b[1]+b[3])/2],b[2]-b[0]+.0002,b[3]-b[1]+.0002)];reserved.push({rings,bounds:bounds(rings[0])});}
 const bIndex=spatialIndex(buildings),wIndex=spatialIndex(water),rIndex=spatialIndex(streets),pIndex=spatialIndex(reserved),gIndex=spatialIndex(greens);
 const extent=(p,r)=>[p[0]-r,p[1]-r,p[0]+r,p[1]+r];
 const safe=(p,r)=>{const box=extent(p,r),ring=rectangle(p,r*2,r*2);return !!districtAt(p)&&![...bIndex(box),...wIndex(box),...rIndex(box),...pIndex(box)].some(o=>polygonTouches([ring],o.rings,.00008));};
 const objects=[],occupied=new Map(),counts={trees:0,courtyards:0,benches:0,lamps:0,planters:0,districts:{},sources:{},reservedSites:Object.keys(placements).length,residentAnchors:Object.keys(anchors).length};
 const nearby=p=>{const x=Math.floor(p[0]/.0016),y=Math.floor(p[1]/.0016);return [-2,-1,0,1,2].flatMap(dx=>[-2,-1,0,1,2].flatMap(dy=>occupied.get((x+dx)+'/'+(y+dy))||[]));};
 function addTree(p,seed,source){if(counts.trees>=42000||nearby(p).some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<(q[2]||.00145))||!safe(p,.0007))return false;const district=districtAt(p),key=Math.floor(p[0]/.0016)+'/'+Math.floor(p[1]/.0016);if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push(p);objects.push({type:'tree',p,seed,district,source});counts.trees++;counts.sources[source]=(counts.sources[source]||0)+1;counts.districts[district]=(counts.districts[district]||0)+1;return true;}
 // Allees read as connected avenues, with deliberate breaks at intersections and parcels.
 for(const s of streets){const seed=hash(s.f.id),urban=s.major||s.walking&&seed%5===0;if(!urban||seed%3===0)continue;const [a,b]=[s.a,s.b],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.002)continue;const dx=(b[0]-a[0])/length,dy=(b[1]-a[1])/length,spacing=s.major?.0055:.0065;
  for(let t=spacing*.5;t<length;t+=spacing)for(const side of [-1,1]){const offset=s.width+.00105,p=[a[0]+dx*t-dy*offset*side,a[1]+dy*t+dx*offset*side];if(!bIndex(extent(p,.025)).length)continue;addTree(p,seed+Math.floor(t*1e6)+side,'avenue');}
 }
 // Mapped parks produce groves and meadow openings, not a carpet of random dots.
 for(const g of greens){const seed=hash(g.f.id),tag=g.f.props.tags||{},forest=['forest','wood'].includes(tag.landuse||tag.natural),step=forest?.0065:.0042,b=g.bounds;let accepted=0,attempts=0;
  const area=(b[2]-b[0])*(b[3]-b[1]),samples=Math.min(1000,Math.max(8,Math.ceil(area/(step*step)*1.6)));
  for(let i=0;i<samples;i++){const n=hash(seed+'/'+i),ny=hash('y/'+n),p=[b[0]+(n/4294967296)*(b[2]-b[0]),b[1]+(ny/4294967296)*(b[3]-b[1])];
   if(accepted>(forest?150:100)||!inPolygon(p,g.rings))continue;const wave=Math.sin(p[0]*510)+Math.sin(p[1]*370)+Math.sin((p[0]+p[1])*260);if(wave<-.45||!bIndex(extent(p,forest?.05:.035)).length&&n%4!==0)continue;
   if(addTree(p,n,'grove'))accepted++;
  }
 }
 for(const lake of water){const ring=lake.rings[0],seed=hash(lake.f.id);for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.002)continue;for(let at=.002;at<l;at+=.0048){for(const sign of [-1,1]){const p=[a[0]+(b[0]-a[0])*at/l-(b[1]-a[1])/l*.0017*sign,a[1]+(b[1]-a[1])*at/l+(b[0]-a[0])/l*.0017*sign];if(bIndex(extent(p,.045)).length)addTree(p,seed+i+Math.floor(at*100000),'shore');}}}}
 // Ordinary buildings gain small shared courts. The mapped footprint is never replaced.
 for(const b of buildings){const seed=hash(b.f.id),box=b.bounds,w=box[2]-box[0],d=box[3]-box[1];if(seed%2!==0)continue;
  const angle=w>d?0:Math.PI/2,c=[(box[0]+box[2])/2,(box[1]+box[3])/2],side=seed%2?1:-1;
  const outside=w>d?[c[0],box[1]-.0022]:[box[2]+.0022,c[1]],candidates=[...b.rings.slice(1).map(r=>{const a=bounds(r);return [(a[0]+a[2])/2,(a[1]+a[3])/2];}),c,...[-.2,.2].flatMap(dx=>[-.2,.2].map(dy=>[c[0]+w*dx,c[1]+d*dy])),outside],p=candidates.find(q=>safe(q,.0015)&&nearby(q).every(t=>Math.hypot(t[0]-q[0],t[1]-q[1])>.0023))||outside;
  if(seed%4===0&&w+d>.008&&w+d<.06&&safe(p,.0015)&&nearby(p).every(q=>Math.hypot(q[0]-p[0],q[1]-p[1])>.002)){
   const district=districtAt(p);objects.push({type:'court',p,seed,angle,district});const k=Math.floor(p[0]/.0016)+'/'+Math.floor(p[1]/.0016);if(!occupied.has(k))occupied.set(k,[]);occupied.get(k).push([...p,.0023]);counts.courtyards++;counts.benches+=2;counts.lamps++;counts.planters+=2;
  }
  for(const sign of [-1,1]){const q=w>d?[c[0]+sign*w*.34,box[1]-.0011]:[box[2]+.0011,c[1]+sign*d*.34];addTree(q,seed+sign,'yard');addTree([c[0]+sign*(w/2+.0011),c[1]+sign*d*.25],seed+sign+9,'yard');addTree([c[0]+sign*w*.3,box[3]+.0011],seed+sign+13,'yard');}
 }
 for(const s of streets){const seed=hash(s.f.id);if(!s.major||seed%7!==0)continue;const a=s.a,b=s.b,l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.008)continue;const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);for(const sign of [-1,1]){const p=[(a[0]+b[0])/2-Math.sin(angle)*.0024*sign,(a[1]+b[1])/2+Math.cos(angle)*.0024*sign];if(!bIndex(extent(p,.016)).length||!safe(p,.0015)||nearby(p).some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.002))continue;objects.push({type:'court',p,seed,angle,district:districtAt(p)});const k=Math.floor(p[0]/.0016)+'/'+Math.floor(p[1]/.0016);if(!occupied.has(k))occupied.set(k,[]);occupied.get(k).push([...p,.0023]);counts.courtyards++;counts.benches+=2;counts.lamps++;counts.planters+=2;}}
 for(const s of streets){const seed=hash(s.f.id);if(seed%11!==0||s.walking)continue;const a=s.a,b=s.b,l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.003)continue;const angle=Math.atan2(b[1]-a[1],b[0]-a[0]),sign=seed%2?1:-1,p=[(a[0]+b[0])/2-Math.sin(angle)*(s.width+.00075)*sign,(a[1]+b[1])/2+Math.cos(angle)*(s.width+.00075)*sign];if(bIndex(extent(p,.009)).length&&safe(p,.00045)&&nearby(p).every(q=>Math.hypot(q[0]-p[0],q[1]-p[1])>.001)){objects.push({type:'seat',p,seed,angle,district:districtAt(p)});counts.benches++;counts.lamps++;}}
 function box(p,w,d,h,color,z=0,angle=0,kind=17){const r=rectangle(p,w,d,angle),lo=r.map(q=>[...q,z]),hi=r.map(q=>[...q,z+h]);quad(...hi,color,kind);for(let i=0;i<4;i++)quad(lo[i],lo[(i+1)%4],hi[(i+1)%4],hi[i],color,kind);}
 function tree(o){const {p,seed,district}=o,f=families[district],tall=f.habit==='windbreak'||o.source==='avenue'&&seed%3===0,r=(2.3+(seed%9)*.095)*METRE*(f.habit==='windbreak'?.84:1),h=(tall?10.5:f.habit==='orchard'?5.8:f.habit==='grove'?8:7)*METRE,z=.00003,col=rgb(f.leaves[seed%3]);
  // Rounded crowns share a small topology budget; smooth normals carry the
  // soft canopy rather than multiplying geometry across thirty thousand trees.
  const bark=rgb('8b7059'),s=.15*METRE;quad([p[0]-s,p[1],z],[p[0]+s,p[1],z],[p[0]+s,p[1],z+h*.7],[p[0]-s,p[1],z+h*.7],bark,17);quad([p[0],p[1]-s,z],[p[0],p[1]+s,z],[p[0],p[1]+s,z+h*.7],[p[0],p[1]-s,z+h*.7],bark,17);
  const sides=8,rx=r,ry=r*(tall?.76:.9+(seed%3)*.045),center=[p[0],p[1],z+h*.72],rz=h*.38;
  const ring=(rad,at)=>Array.from({length:sides},(_,i)=>{const a=i/sides*Math.PI*2+(seed%8)*.19;return [p[0]+Math.cos(a)*rx*rad,p[1]+Math.sin(a)*ry*rad,z+at];}),a=ring(.88,h*.5),b=ring(.79,h*.92),bottom=[...p,z+h*.34],tip=[...p,z+h*1.1];
  const normal=q=>{const v=[(q[0]-center[0])/(rx*rx),(q[1]-center[1])/(ry*ry),(q[2]-center[2])/(rz*rz)],l=Math.hypot(...v);return v.map(n=>n/l);};
  const leaf=(A,B,C,color)=>tri(A,B,C,color,16,[normal(A),normal(B),normal(C)]);
  for(let i=0;i<sides;i++){const j=(i+1)%sides;leaf(bottom,a[j],a[i],blend(col,rgb('4f7465'),.08));leaf(a[i],a[j],b[j],col);leaf(a[i],b[j],b[i],col);leaf(b[i],b[j],tip,blend(col,rgb('d1ceb0'),.05));}
 }
 function bench(p,angle,ground){
  box(p,2.4*METRE,.58*METRE,.12*METRE,rgb('bca077'),ground+.5*METRE,angle,19);
  const c=Math.cos(angle),s=Math.sin(angle),at=(x,y)=>[p[0]+x*c-y*s,p[1]+x*s+y*c];
  box(at(0,.23*METRE),2.4*METRE,.1*METRE,.48*METRE,rgb('b39a75'),ground+.6*METRE,angle,19);
  for(const side of [-1,1])box(at(side*.87*METRE,0),.12*METRE,.5*METRE,.5*METRE,rgb('677b74'),ground,angle,19);
 }
 function lamp(p,angle,ground){box(p,.12*METRE,.12*METRE,5*METRE,rgb('718078'),ground,0,19);box(p,.48*METRE,.34*METRE,.22*METRE,rgb('decc9f'),ground+5*METRE,angle,19);}
 function court(o){const {p,angle,seed,district}=o,ground=.000006,r=rectangle(p,.0028,.0025,angle),col=blend(rgb('cbc4a7'),rgb(families[district].roofs[seed%4]),.1);fill([r],col,ground+.000012,18);
  const at=(x,y)=>[p[0]+x*Math.cos(angle)-y*Math.sin(angle),p[1]+x*Math.sin(angle)+y*Math.cos(angle)];
  // Clear central promenade, opposing benches, planted edges and a modest lamp.
  for(const side of [-1,1]){const q=at(side*.00105,0);box(q,.00018,.0017,.55*METRE,rgb(families[district].leaves[seed%3]),.00003,angle,19);bench(at(side*.00055,-.00045),angle,.00003);}
  lamp(at(.0009,.0008),angle,.00003);
 }
 function seat(o){const {p,angle,district,seed}=o;fill([rectangle(p,.00085,.0007,angle)],blend(rgb('c3c1a1'),rgb(families[district].roofs[seed%4]),.16),.000018,18);bench(p,angle,.00003);const q=[p[0]+Math.cos(angle)*.00036,p[1]+Math.sin(angle)*.00036];lamp(q,angle,.00003);}
 const groups=new Map();for(const o of objects){const key=Math.floor(o.p[0]/.08)+'/'+Math.floor(o.p[1]/.08);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}
 for(const group of groups.values()){const start=total(),points=[];for(const o of group){points.push(o.p);if(o.type==='tree')tree(o);else if(o.type==='seat')seat(o);else court(o);}const b=bounds(points);ranges.push({start,count:total()-start,bounds:[b[0]-.003,b[1]-.003,b[2]+.003,b[3]+.003],environment:true});}
 return {...counts,physicalScale:{metre:METRE,benchSeatM:.62,lampTopM:5.22,treeHeightM:[6.38,11.55],planterHeightM:.55},objects:objects.map(o=>({type:o.type,point:o.p,radius:o.type==='tree'?.0007:o.type==='court'?.0015:.00045})),vertices:objects.length?total()-ranges.find(r=>r.environment).start:0,rules:'Mapped groves, street allees, clearance-tested shared courts; all scenario parcels/routes and people spots reserved.'};
}
