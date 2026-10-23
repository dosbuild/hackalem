/** Native hit targets across the actual overview/atlas responsive breakpoints. */
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {skipDemonstration,artifactContext,captureFrame} from '../integration/ui.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.APP_URL||'http://127.0.0.1:5187',out=process.env.CAPTURE_DIR||'artifacts/cityrt-overview-layout';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const sizes=[[1440,900],[1920,1080],[1280,720],[820,1180],[390,667],[360,640],[1101,900],[1100,900],[801,900],[800,900],[1000,800]];
const report={method:'Public overview/atlas/district buttons, native clicks and keyboard Tab/Enter. Geometry assertions read actual DOM hit targets; no app state/camera writes.',profiles:[],checks:[],errors:[],completed:false};
let context,page;
const check=(name,ok)=>{assert(ok,name);report.checks.push(name);console.log('PASS',name);};
const home=async()=>{const zoom=await page.locator('html').getAttribute('data-mode')==='khanate'?7:1;await page.locator('.camera-home').click();await page.waitForFunction(zoom=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;return d?.camera===d?.renderCamera&&JSON.parse(d.camera).zoom===zoom;},zoom);};
const request=()=>page.getByTestId('city-map').getAttribute('data-camera-request');
async function visit(button){await button.scrollIntoViewIfNeeded();const before=await request();await button.click();await page.waitForFunction(before=>document.querySelector('[data-testid=city-map]').dataset.cameraRequest!==before,before);}
const exposed=locator=>locator.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},exposed:e===hit||e.contains(hit),fontSize:getComputedStyle(e).fontSize};});
try{
for(const world of process.env.WORLD_MODE?[process.env.WORLD_MODE]:['astana','khanate'])for(const [width,height]of sizes){
 context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(origin+'/?mode='+world);await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true');await skipDemonstration(page);await home();
 const nav=page.locator('.geographic-districts'),first=nav.locator('button').first(),last=nav.locator('button').last(),atlas=page.locator('.landmark-atlas > summary');
 const profile={world,width,height,...await artifactContext(page),buttons:[]};report.profiles.push(profile);
 for(const [name,button]of [['first',first],['last',last]]){await home();await button.scrollIntoViewIfNeeded();const hit=await exposed(button);profile.buttons.push({name,...hit});check(`${world} ${width}x${height}: ${name} district is visibly clickable`,hit.exposed&&parseFloat(hit.fontSize)>=12);await visit(button);}
 await home();profile.atlas=await exposed(atlas);check(`${world} ${width}x${height}: atlas opener is visibly clickable`,profile.atlas.exposed);await atlas.click();
 check(`${world} ${width}x${height}: atlas opens without covering district shortcuts`,await page.locator('.landmark-atlas').getAttribute('open')!==null);
 await first.scrollIntoViewIfNeeded();profile.openAtlasDistrict=await exposed(first);check(`${world} ${width}x${height}: first district remains exposed beside the open atlas`,profile.openAtlasDistrict.exposed);
 await atlas.click();await home();
 const canvasPoint=await page.locator('.alem-city').evaluate(e=>{for(let y=80;y<innerHeight-80;y+=20)for(let x=12;x<innerWidth-12;x+=20)if(document.elementFromPoint(x,y)===e)return {x,y};return null;});
 check(`${world} ${width}x${height}: an exposed native canvas starts keyboard navigation`,!!canvasPoint);await page.mouse.click(canvasPoint.x,canvasPoint.y);
 let found=false;profile.tabPath=[];
 for(let i=0;i<65;i++){await page.keyboard.press('Tab');const label=await page.evaluate(()=>({tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.trim(),first:document.activeElement===document.querySelector('.geographic-districts button')}));profile.tabPath.push(label);if(label.first){found=true;break;}}
 check(`${world} ${width}x${height}: keyboard reaches the first district`,found);const before=await request();await page.keyboard.press('Enter');await page.waitForFunction(before=>document.querySelector('[data-testid=city-map]').dataset.cameraRequest!==before,before);
 await home();await captureFrame(page,`${out}/${world}-${width}x${height}.png`,report);
 await context.close();context=null;
}
check('all overview profiles have no unhandled exceptions',report.errors.length===0);report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;if(page)await captureFrame(page,out+'/failure.png',report).catch(()=>{});console.error(String(error).split('\n')[0]);}
finally{await context?.close();await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
