import {smoothPath} from './settlement.js';
import {CENTER} from '../city-math.js';
import views from './site-views.json' with {type:'json'};
import {localPoint} from './scale.js';
import {routeAt} from '../placement-geometry.js';

export const toGeo=([x,y])=>[CENTER[0]+x/5.8,CENTER[1]+y/9.25];
export const quarters=[
 {id:'esil',name:'Riverbank',center:[-.015,-.086],polygon:[[-.08,-.16],[.09,-.16],[.09,-.01],[.025,.02],[-.08,-.025]]},
 {id:'almaty',name:'Artisans Quarter',center:[.145,.012],polygon:[[.09,-.16],[.23,-.11],[.23,.072],[.10,.075],[.025,.02],[.09,-.01]]},
 {id:'saryarka',name:'Saryarka',center:[-.106,.104],polygon:[[-.225,-.002],[-.08,-.025],[.025,.02],[.015,.195],[-.15,.20],[-.23,.115]]},
 {id:'baikonur',name:'Caravan Gates',center:[.125,.131],polygon:[[.025,.02],[.10,.075],[.23,.072],[.22,.178],[.115,.215],[.015,.195]]},
 {id:'nura',name:'Nura Pastures',center:[-.154,-.078],polygon:[[-.235,-.10],[-.225,-.002],[-.08,-.025],[-.08,-.16],[-.18,-.175]]},
];
export const districts={type:'FeatureCollection',features:quarters.map(q=>({id:q.id,type:'Feature',properties:{name:q.name,center:toGeo(q.center),view_center:toGeo(q.center)},geometry:{type:'Polygon',coordinates:[[...q.polygon,q.polygon[0]].map(toGeo)]}}))};
export const river=smoothPath([[-.326,-.019],[-.28,-.013],[-.235,.001],[-.204,-.020],[-.166,-.033],[-.132,-.036],[-.097,-.026],[-.06,-.008],[-.022,.007],[.014,.010],[.049,.019],[.082,.036],[.107,.062],[.132,.081],[.17,.093],[.211,.096],[.241,.109],[.285,.105],[.35,.119]],2);
export const apron=[[-.294,-.13],[-.26,-.21],[-.16,-.25],[-.025,-.253],[.10,-.227],[.21,-.18],[.29,-.09],[.319,.04],[.35,.18],[.318,.281],[.21,.316],[.097,.366],[-.061,.381],[-.20,.363],[-.294,.275],[-.321,.13],[-.322,.004]];

const offsets={M1:[-.041,-.017],M2:[.027,.016],M3:[-.040,-.017],M4:[-.005,.012],M5:[.037,-.026],M6:[-.042,.036],M7:[-.005,.012],M8:[.037,.029],M9:[.007,-.027],M10:[-.035,-.001],M11:[-.011,-.006],M12:[.022,-.002],M13:[.037,-.026],M14:[-.033,-.033]};
export const placements=Object.fromEntries(quarters.flatMap(q=>Object.entries(offsets).map(([id,offset])=>{
 const origin=[q.center[0]+offset[0],q.center[1]+offset[1],.00006],route=['M1','M3'].includes(id)?[[-.055,-.017],[-.02,-.011],[.020,-.004],[.048,.014]].map(p=>[q.center[0]+p[0],q.center[1]+p[1]]):undefined;
 const orientation=-.12;
 const localSpots={M2:[[-5,-9],[5,-9],[-12,-4],[12,-4],[-4,4],[4,4]],M4:[[-7,-7],[8,-7],[-18,-14],[18,-14],[-19,8],[19,8]],M5:[[-8,-20],[8,-20],[-21,-5],[21,-5],[-5,10],[5,10]],M6:[[-13,-10],[0,-10],[13,-10],[-25,4],[25,4],[0,20]],M7:[[5,-6],[-13,-24],[0,-25],[13,-23],[-31,-17],[31,-15]],M8:[[-17,-4],[17,-4],[-7,-19],[7,-19],[-15,24],[15,24]],M9:[[-12,-9],[12,-9],[-10,10],[10,10],[-24,0],[24,0]],M10:[[-16,-6],[0,-5],[16,-6],[-7,13],[7,13],[0,23]],M12:[[0,-14],[-7,-18],[7,-18],[-6,-25],[6,-25],[12,2]],M13:[[0,-7],[-23,-3],[23,-3],[-23,25],[23,25],[0,18]],M14:[[0,-13],[-8,-16],[8,-16],[13,5],[22,5],[0,-24]]};
 const peopleSpots=route?[.16,.16,.52,.52,.84,.84].map((t,i)=>{const stop=routeAt(route,t);return {position:localPoint([...stop.point,origin[2]],stop.angle,(i%2?4:-4),id==='M3'?-18:-5),angle:stop.angle};}):id==='M11'?Array.from({length:6},(_,i)=>({position:[origin[0]+(i<3?-.0068:.0068),origin[1]+(i%3-1)*.0002,origin[2]],angle:0})):localSpots[id].map(([x,y])=>({position:localPoint(origin,orientation,x,y),angle:orientation}));
 return [`${id}:${q.id}`,{key:`${id}:${q.id}`,id,district:q.id,origin,position:toGeo(origin),orientation,size:['M4','M7'].includes(id)?[.024,.024]:[.019,.018],source:'authored-khanate-parcel',...(route?{route}:{}),peopleSpots,...(views[`${id}:${q.id}`]?{view:views[`${id}:${q.id}`]}:{})}];
})));
const kindProjects={entrance:'M5',school:'M7',clinic:'M8',stop:'M1',crossing:'M11',garden:'M4',service:'M12'};
export const anchors=Object.fromEntries(quarters.flatMap(q=>Object.entries(kindProjects).map(([kind,id])=>[`${q.id}:${kind}`,{position:placements[`${id}:${q.id}`].position,source:'authored-khanate-anchor',label:q.name}])));

export const landmarks=[
 ['baiterek','Meeting Tree','Meeting Tree',[-.108,.036],28,92,'Paths and conversations meet beneath the broad canopy. A space is always left for whoever arrives next.'],
 ['khan','Grand Caravanserai','Caravanserai',[.090,.142],18,76,'Awnings surround a spacious trading yard. A guide unties the luggage while the hosts make room for the next caravan.'],
 ['akorda','Khan’s Court','Khan’s Court',[-.003,.041],28,95,'A white ceremonial yurt stands beside a working courtyard. Leadership begins with an open door and a book of unanswered requests.'],
 ['palace','Council Hill','Council Hill',[-.063,.140],24,88,'Quarter representatives gather on low terraces. From the summit they see the city for which they share responsibility.'],
 ['expo','Crafts Circle','Crafts Circle',[.178,-.020],22,86,'Felt, wood and clay meet beneath a great canvas. Finished work sits beside its tools: both the object and the craftsperson matter.'],
 ['hazret','Earthen Mosque','Quiet Courtyard',[.078,.071],15,110,'Warm earthen walls surround a small prayer courtyard. Travellers brush off the road dust at the entrance; voices grow quieter inside.'],
 ['opera','Storytellers House','Storytellers House',[-.145,.149],15,102,'A low canopy and a semicircle of mats bring listeners close to the storyteller. An evening story has no back row.'],
 ['arch','Caravan Gates','Caravan Gates',[.204,.117],22,90,'Wooden gates open onto the steppe road. The gatekeeper helps arrivals find water, lodging and the right courtyard.'],
 ['concert','Dombra Square','Dombra Square',[-.017,-.126],17,95,'A cloth canopy leaves the square open to the wind. A musician tunes a dombra while children take the nearest seats.'],
 ['atyrau','Woven Bridge','Woven Bridge',[-.102,-.025],10,100,'Timber decking and woven rails connect the banks. Halfway across, passers-by make room for someone carrying full buckets.'],
 ['abudhabi','Watchtower and Granaries','Tower and Granaries',[.179,.166],31,80,'The lookout offers a view of the distant road. Below, people count sacks, repair ties and keep supplies for long spells of bad weather.'],
 ['grand-mosque','Main Mosque and Learning Courtyard','Mosque and Learning Courtyard',[.032,.177],25,78,'The prayer space stands beside learning yurts. Beyond the wall, students can be heard reciting their lesson.'],
 ['esil-bridges','Great Crossing','Great Crossing',[.054,.021],12,76,'A rope holds the ferry as carts wait on the broad slope. A short passage over the water connects the business of the whole city.'],
 ['lrt','Postal Road','Postal Road',[-.187,-.123],13,100,'At a low post, a courier changes horses and adjusts a satchel. From here, an answer travels back to the person waiting for it.'],
].map(([id,name,shortName,point,heightM,zoom,description])=>({id,name,shortName,point,position:toGeo(point),heightM,focusHeight:heightM*.4,zoom,yaw:-.3,description}));
