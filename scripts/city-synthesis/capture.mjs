/** Repeatable visual/continuity audit of the actual product through its public controls. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
const phase=process.argv[2]||'after',out=process.env.RELEASE_OUTPUT||`artifacts/city-synthesis/${phase}`;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}});
await context.addInitScript(()=>{window.__frames=[];let last=performance.now();function tick(t){const m=document.querySelector('[data-testid=city-map]');if(m?.dataset.camera&&m.dataset.frame!==window.__lastFrame){window.__lastFrame=m.dataset.frame;window.__frames.push({ms:t-last,zoom:+m.dataset.zoom,vertices:+m.dataset.vertices,camera:m.dataset.camera,renderCamera:m.dataset.renderCamera});last=t;}requestAnimationFrame(tick);}requestAnimationFrame(tick);});
const page=await context.newPage(),errors=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
const map=page.getByTestId('city-map');
const settle=async()=>{await page.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.camera||!d.target)return false;const a=JSON.parse(d.camera),b=JSON.parse(d.target);return ['x','y','zoom','yaw','pitch'].every(k=>Math.abs(a[k]-b[k])<.00001)&&d.qualityLoading!=='true';});await page.waitForTimeout(700);};
const shot=async name=>{const expected=name.startsWith('A-')||name.startsWith('D-')?1:name.startsWith('E-')?3.1*1.4**11:name.startsWith('C-')||name.startsWith('urban-')?3.1*1.4**7:3.1;await page.waitForFunction(z=>Math.abs(Number(document.querySelector('[data-testid=city-map]')?.dataset.zoom)-z)<.001,expected);await settle();const data=await map.evaluate(e=>({...e.dataset}));views.push({name,data});await page.screenshot({path:`${out}/${name}.png`});console.log(name,data.zoom,data.vertices);};
try{
 await page.goto(process.env.APP_URL||'http://127.0.0.1:4174');await page.locator('[data-ready=true]').waitFor();
 await page.getByRole('button',{name:'Выбрать первый район',exact:true}).click();
 await page.getByRole('button',{name:'Обзор города',exact:true}).click();await shot('A-full-city');if(process.argv.includes('--film'))await page.waitForTimeout(1200);
 await page.locator('.geographic-districts button').filter({hasText:'Есиль'}).click();await shot('B-esil-district');if(process.argv.includes('--film'))await page.waitForTimeout(1200);
 for(let i=0;i<7;i++)await page.getByRole('button',{name:'Приблизить карту',exact:true}).click();await shot('C-esil-urban');if(process.argv.includes('--film'))await page.waitForTimeout(700);
 if(process.argv.includes('--film')){for(let i=0;i<4;i++)await page.getByRole('button',{name:'Приблизить карту',exact:true}).click();await shot('E-courtyard-detail');await page.waitForTimeout(1600);}
 await page.getByRole('button',{name:'Обзор города',exact:true}).click();await shot('D-return');if(process.argv.includes('--film'))await page.waitForTimeout(1000);
 for(const [id,name] of (process.argv.includes('--hero')?[]:[['almaty','Алматы'],['saryarka','Сарыарка'],['baikonur','Байконур'],['nura','Нура']])){
  await page.locator('.geographic-districts button').filter({hasText:name}).click();await shot(`district-${id}`);
  for(let i=0;i<7;i++)await page.getByRole('button',{name:'Приблизить карту',exact:true}).click();await shot(`urban-${id}`);
 }
 await page.getByRole('button',{name:'Обзор города',exact:true}).click();await settle();
 const frames=await page.evaluate(()=>window.__frames);const moving=frames.filter((f,i)=>i&&f.camera!==frames[i-1].camera).map(f=>f.ms).sort((a,b)=>a-b);
 assert.equal(errors.length,0,'No browser exceptions');
 assert(views.every(v=>v.data.completeCity==='true'&&+v.data.buildingCount===60978),'Every view uses the complete city');
 assert(views.some(v=>+v.data.zoom>30&&+v.data.visibleCityVertices<+v.data.vertices),'Close views cull offscreen geometry');
 assert(frames.every(f=>f.camera===f.renderCamera),'Navigation and renderer use the same camera');
 const stats={samples:moving.length,median:moving[Math.floor(moving.length*.5)],p95:moving[Math.floor(moving.length*.95)],over50:moving.filter(v=>v>50).length};
 await writeFile(`${out}/report.json`,JSON.stringify({phase,views,errors,stats,frames},null,2));
 console.log(JSON.stringify({errors,stats}));
}finally{await page.close();await context.close();await rename(await page.video().path(),`${out}/navigation.webm`);await browser.close();}
