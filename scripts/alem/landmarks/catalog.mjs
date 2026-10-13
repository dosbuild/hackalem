import {readFile} from 'node:fs/promises';
import * as signature from './signature.mjs';
import * as civic from './civic.mjs';
import * as skyline from './skyline.mjs';
import {transitModels} from './transit.mjs';
import {esilBridgeModels} from './lrt-bridge.mjs';
import {expoPavilions,expoPavilionSources,expoPavilionOrigin} from './expo-pavilions.mjs';
import {grandMosqueGrounds,GRAND_MOSQUE_GROUNDS_ORIGIN,GRAND_MOSQUE_GROUNDS_REPLACES} from './grand-mosque-grounds.mjs';
import {hazretAnnex,hazretAnnexOrigin,hazretAnnexSources} from './hazret-annex.mjs';
import {mapXY} from '../../../src/world/city-math.js';
const geography=JSON.parse(await readFile(new URL('./geography.json',import.meta.url),'utf8'));
const degree=Math.PI/180;
const specs=[
 {id:'expo',name:'Нур Әлем · EXPO',shortName:'EXPO',source:'way/454857501',position:[71.41615425,51.08931345],make:signature.expo,angle:0,heightM:100,focusHeight:44,zoom:160,yaw:-.3,description:'Голубая сфера, стеклянная сетка и лепестки павильонов.'},
 {id:'baiterek',name:'Бәйтерек',shortName:'Бәйтерек',source:'way/230401645',make:signature.baiterek,angle:0,heightM:105,focusHeight:55,zoom:188,yaw:-.3,description:'Золотой шар в белых ветвях над городом.'},
 {id:'khan',name:'Хан Шатыр',shortName:'Хан Шатыр',source:'way/460703779',make:signature.khan,angle:0,heightM:150,focusHeight:49,zoom:100,yaw:-.5,description:'Наклонная мачта, прозрачный шатёр и широкое основание.'},
 {id:'palace',name:'Дворец мира и согласия',shortName:'Пирамида',source:'way/166197368',make:civic.palace,angle:-14.6*degree,heightM:63,focusHeight:28,zoom:185,yaw:-.3,description:'Каменная пирамида со светлой стеклянной вершиной.'},
 {id:'akorda',name:'Ақорда',shortName:'Ақорда',source:'way/166198046',make:civic.akorda,angle:-103.9*degree,heightM:86,focusHeight:35,zoom:134,yaw:1.15,description:'Белые колоннады, голубой купол и золотой шпиль.'},
 {id:'hazret',name:'Мечеть Әзірет Сұлтан',shortName:'Әзірет Сұлтан',source:'way/240860325',make:civic.hazret,angle:-141.3*degree,heightM:77,focusHeight:29,zoom:110,yaw:-.92,description:'Светлые купола, аркады и четыре тонких минарета.'},
 {id:'opera',name:'Астана Опера',shortName:'Опера',source:'way/917478479',make:civic.opera,angle:-14.1*degree,heightM:55,focusHeight:24,zoom:110,yaw:.12,description:'Большой портик, колонны и квадрига над фронтоном.'},
 {id:'arch',name:'Мәңгілік Ел',shortName:'Мәңгілік Ел',source:'way/549307755',make:civic.arch,angle:-10*degree,heightM:20,focusHeight:10,zoom:288,yaw:-.8,landscapeClearanceM:35,description:'Проходная арка с нишами, рельефами и карнизами.'},
 {id:'concert',name:'Концертный зал Qazaqstan',shortName:'Qazaqstan',source:'way/1460537088',make:civic.concert,angle:18.05*degree,heightM:40.1,focusHeight:20,zoom:112,yaw:-.3,description:'Синие изогнутые стены складываются в цветок.'},
 {id:'atyrau',name:'Мост Атырау',shortName:'Атырау',position:[71.4250862,51.156424],make:signature.atyrau,angle:0,heightM:22,focusHeight:7,zoom:95,yaw:-.5,description:'Ажурная чешуя над прогулочным мостом через Есиль.'},
 {id:'abudhabi',name:'Abu Dhabi Plaza',shortName:'Abu Dhabi Plaza',source:'way/762780007',make:skyline.abudhabi,angle:0,heightM:311,focusHeight:126,zoom:68,yaw:-.3,description:'Стеклянные башни ступенями поднимаются над городом.'},
 {id:'grand-mosque',name:'Большая мечеть Астаны',shortName:'Большая мечеть',source:'relation/18901938',make:skyline.grandMosque,angle:129.3*degree,heightM:130,focusHeight:46,zoom:76,yaw:-2.05,description:'Голубой купол, четыре минарета и открытый двор с аркадами.'},
];

export function encodeModel(mesh,position,angle=0,ground=.00006){
 const buffer=Buffer.from(mesh.pack()),origin=mapXY(position),c=Math.cos(angle),s=Math.sin(angle);
 for(let i=0;i<buffer.length;i+=20){const x=buffer.readFloatLE(i),y=buffer.readFloatLE(i+4),z=buffer.readFloatLE(i+8),nx=buffer.readInt8(i+12)/127,ny=buffer.readInt8(i+13)/127;
  buffer.writeFloatLE(origin[0]+(x*c-y*s)/12000,i);buffer.writeFloatLE(origin[1]+(x*s+y*c)/12000,i+4);buffer.writeFloatLE(ground+z/12000,i+8);
  buffer.writeInt8(Math.max(-127,Math.min(127,Math.round((nx*c-ny*s)*127))),i+12);buffer.writeInt8(Math.max(-127,Math.min(127,Math.round((nx*s+ny*c)*127))),i+13);
 }return buffer;
}
export function modelBounds(buffer){const b=[Infinity,Infinity,-Infinity,-Infinity,Infinity,-Infinity];for(let i=0;i<buffer.length;i+=20){const x=buffer.readFloatLE(i),y=buffer.readFloatLE(i+4),z=buffer.readFloatLE(i+8);b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);b[4]=Math.min(b[4],z);b[5]=Math.max(b[5],z);}return b;}
export function prepareLandmarks(){
 const models=specs.map(spec=>{const source=geography[spec.source],position=spec.position||source.position;return {...spec,position,replaces:source?[spec.source,...source.parts]:[],mesh:spec.make()};});
 models.push({id:'expo-pavilions',name:'EXPO · павильоны',position:expoPavilionOrigin,angle:0,atlas:false,replaces:[...expoPavilionSources],mesh:expoPavilions()});
 models.push({id:'grand-mosque-grounds',name:'Большая мечеть · цветочные навесы',position:GRAND_MOSQUE_GROUNDS_ORIGIN,angle:0,atlas:false,replaces:[...GRAND_MOSQUE_GROUNDS_REPLACES],mesh:grandMosqueGrounds()});
 models.push({id:'hazret-annex',name:'Әзірет Сұлтан · боковой корпус',position:hazretAnnexOrigin,angle:0,atlas:false,replaces:[...hazretAnnexSources],mesh:hazretAnnex()});
 models.push(...esilBridgeModels().map(m=>({...m,atlas:true,hidden:false,name:'Мосты через Есиль',shortName:'Мосты Есиля',description:'Две разные арочные конструкции — для поездов и городского проспекта.',heightM:49,focusHeight:20,zoom:130,yaw:-2.38})));
 models.push(...transitModels());
 return models.map(model=>{const {mesh,make,...record}=model,buffer=encodeModel(mesh,model.position,model.angle);return {...record,buffer,bounds:modelBounds(buffer),vertices:buffer.length/20};});
}
export function publicLandmarks(models){
 return models.filter(m=>m.atlas===true||m.atlas!==false&&(!m.transit||m.station&&m.name.includes('Байтерек'))).map(({id,name,shortName,description,position,heightM,focusHeight,zoom,yaw,bounds,station})=>({id:station?'lrt':id,modelId:id,name:station?'Tarlan Astana · LRT':name,shortName:station?'LRT':shortName,description:station?'Серебристые станции и бирюзовые поезда на настоящей трассе.':description,position,heightM:heightM||28,focusHeight,zoom,yaw,bounds}));
}
