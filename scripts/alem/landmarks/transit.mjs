import {Mesh} from './kit.mjs';
import {lrtStation,lrtPier} from '../../../src/world/lrt-model.js';
import {LRT_LENGTH,LRT_STATIONS,lrtAt,LRT_SCALE} from '../../../src/world/lrt-route.js';
import {CENTER} from '../../../src/world/city-math.js';
const geo=p=>[CENTER[0]+p[0]/5.8,CENTER[1]+p[1]/9.25];

export function transitModels(){
 const result=[],step=480;
 for(let begin=0;begin<LRT_LENGTH;begin+=step){
  const end=Math.min(LRT_LENGTH,begin+step),origin=lrtAt((begin+end)/2).point,m=new Mesh();
  const local=(q,z)=>[(q[0]-origin[0])/LRT_SCALE,(q[1]-origin[1])/LRT_SCALE,z];
  const at=(d,offset,z)=>local(lrtAt(d,offset).point,z);
  // Continuous paired rail, capped concrete box girder, raised edge walkways.
  for(let d=begin;d<end;d+=5){const e=Math.min(end,d+5),a=lrtAt(d),b=lrtAt(e);
   m.quad(at(d,-4.4,10),at(e,-4.4,10),at(e,4.4,10),at(d,4.4,10),'#c7c8b5');
   for(const side of [-1,1]){m.quad(at(d,side*4.4,8.8),at(e,side*4.4,8.8),at(e,side*4.4,10),at(d,side*4.4,10),'#aaa999');m.quad(at(d,side*4.4,10),at(e,side*4.4,10),at(e,side*4.4,11.1),at(d,side*4.4,11.1),'#d5ddcd');m.beam(at(d,side*4.43,11.1),at(e,side*4.43,11.1),.075,'#e8e8d5',4);}
   for(const track of [-2.1,2.1])for(const side of [-1,1])m.beam(at(d,track+side*.7175,10.22),at(e,track+side*.7175,10.22),.075,'#6f8587',5);
   m.beam(at(d,0,10.18),at(e,0,10.18),.10,'#9aada8',4);
  }
  for(let d=Math.ceil(begin/2.8)*2.8;d<end;d+=2.8){const q=lrtAt(d);m.at(local(q.point,0),q.angle);for(const track of [-2.1,2.1])m.box(0,track,10.02,.26,2.05,.13,'#c2bca9');}
  for(let d=Math.ceil(begin/32)*32;d<end;d+=32){if(d>=14800&&d<=14955||LRT_STATIONS.some(s=>Math.abs(s.distance-d)<s.lengthM*.49))continue;const q=lrtAt(d);m.at(local(q.point,0),q.angle);lrtPier(m,8.8);}
  m.at([0,0,0]);result.push({id:'lrt-line-'+Math.floor(begin/step),name:'Tarlan Astana',position:geo(origin),angle:0,mesh:m,replaces:[],transit:true});
 }
 for(const station of LRT_STATIONS){const m=new Mesh(),center=lrtAt(station.distance).point,a=lrtAt(station.distance-station.lengthM/2).point,b=lrtAt(station.distance+station.lengthM/2).point,angle=Math.atan2(b[1]-a[1],b[0]-a[0]);lrtStation(m,{length:station.lengthM,width:station.widthM,platformHeight:10.1});result.push({id:station.id,name:'LRT · '+station.name,position:geo(center),surveyedPosition:station.position,angle,mesh:m,replaces:[station.source],transit:true,station:true,focusHeight:12,zoom:180,yaw:-angle-Math.PI+.35});}
 return result;
}
