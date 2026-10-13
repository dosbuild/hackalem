import {mkdir,writeFile} from 'node:fs/promises';
import {Mesh} from './kit.mjs';
import * as civic from './civic.mjs';
import * as signature from './signature.mjs';
import * as skyline from './skyline.mjs';
import {expoPavilions} from './expo-pavilions.mjs';
import {lrtStation,lrtTrain,lrtPier} from '../../../src/world/lrt-model.js';
const out=new URL('../../../artifacts/landmarks/models/',import.meta.url);await mkdir(out,{recursive:true});
const specs=[
 ['expo','Нур Әлем · EXPO',signature.expo,56,52],['baiterek','Бәйтерек',signature.baiterek,48,90],
 ['khan','Хан Шатыр',signature.khan,50,36],['atyrau','Атырау',signature.atyrau,8,30],
 ['palace','Дворец мира и согласия',civic.palace,27,80],['akorda','Ақорда',civic.akorda,28,65],
 ['hazret','Әзірет Сұлтан',civic.hazret,26,55],['opera','Астана Опера',civic.opera,22,45],
 ['arch','Мәңгілік Ел',civic.arch,9,170],['concert','Qazaqstan',civic.concert,15,55],
 ['abudhabi','Abu Dhabi Plaza',skyline.abudhabi,126,50],['grand-mosque','Большая мечеть Астаны',skyline.grandMosque,46,48],
 ['expo-pavilions','EXPO · павильоны',expoPavilions,12,35],
 ['lrt','Tarlan Astana · LRT',()=>{const m=new Mesh();lrtStation(m,{length:90,width:25});for(const x of [-75,75])m.component([x,0,0],0,()=>lrtPier(m));m.box(0,0,9.4,220,9,1.2,'#cfc7b1');for(const y of [-4.5,4.5])m.box(0,y,10.5,220,.18,.9,'#dce2ce');m.component([73,-2.15,10.6],0,()=>lrtTrain(m));return m;},11,60],
 ['train','Tarlan Astana · train',()=>{const m=new Mesh();lrtTrain(m);return m;},2,140],
];
const manifest=[];
for(const [id,name,make,focusHeight,zoom] of specs){if(typeof make!=='function')continue;const m=make(),buf=Buffer.from(m.pack());for(let at=0;at<buf.length;at+=20)for(let axis=0;axis<3;axis++)buf.writeFloatLE(buf.readFloatLE(at+axis*4)/12000,at+axis*4);await writeFile(new URL(id+'.bin',out),buf);manifest.push({id,name,focusHeight,zoom,yaw:id==='lrt'?.6:id==='train'?.6:-.3,triangles:buf.length/60});}
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2));console.log(manifest);
