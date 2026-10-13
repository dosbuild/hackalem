import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {chooseProject,confirmProject,captureFrame,artifactContext} from '../integration/ui.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=path.resolve(root,process.env.RELEASE_OUTPUT||'artifacts/assistant');await mkdir(out,{recursive:true});
const origin=process.env.APP_URL||process.env.ALEM_URL||'http://127.0.0.1:4174';
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const report={environment:{browser:await browser.version(),origin,date:new Date().toISOString()},checks:[],errors:[]};
const check=(name,condition=true)=>{assert(condition,name);report.checks.push(name);console.log('PASS',name);};
const plan=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('akim:draft')||'{"plan":[]}').plan);
const waitCount=(page,count)=>page.waitForFunction(n=>JSON.parse(localStorage.getItem('akim:draft')||'{"plan":[]}').plan.length===n,count,{timeout:25000});
const open=async page=>{if(!(await page.locator('#aya-dialogue').count()))await page.getByRole('button',{name:'Открыть Аю — помощницу города'}).click();};
const close=async page=>{if(await page.locator('#aya-dialogue').count())await page.getByRole('button',{name:'Свернуть разговор с Аей'}).click();};
const send=async(page,text)=>{await open(page);await page.getByLabel('Сообщение Ае',{exact:true}).fill(text);await page.getByRole('button',{name:'Отправить сообщение Ае'}).click();};
const manualPark=async page=>{await close(page);await chooseProject(page,'M4');await page.locator('[data-testid=held-project] select').selectOption('saryarka');await confirmProject(page);};
const userContrast=page=>page.locator('.aya-message.from-user p').last().evaluate(el=>{
 const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const text=luminance(getComputedStyle(el).color),background=luminance(getComputedStyle(el.closest('.aya-message')).backgroundColor);
 return (Math.max(text,background)+.05)/(Math.min(text,background)+.05);
});
let page;
try{
 const montage=await browser.newPage({viewport:{width:1000,height:470},deviceScaleFactor:2});
 const expressions=['idle','attention','thought','explanation','success','error'];
 const positions={idle:'0% 0%',thought:'50% 0%',attention:'100% 0%',explanation:'0% 100%',success:'50% 100%',error:'100% 100%'};
 const atlas=await readFile(path.join(root,'public/aya/guide-atlas.png'));
 const pose=(expression,cls='')=>`<span class="pose ${cls}" style="background-image:url(data:image/png;base64,${atlas.toString('base64')});background-position:${positions[expression]}"></span>`;
 const names=['Спокойствие','Внимание','Размышление','Объяснение','Готово','Нужна помощь'];
 const pictures=expressions.map((expression,i)=>`<article>${pose(expression,'large')}<h2>${names[i]}</h2><div class="buttons"><button>${pose(expression)}<b>Ая</b></button><button class="dark">${pose(expression)}</button></div></article>`);
 await montage.setContent(`<style>body{background:#f5f6ed;color:#1e483a;margin:0;font:14px system-ui;padding:28px}h1{font-size:23px;margin:0 0 20px}main{display:flex;gap:16px}article{width:142px;text-align:center}.pose{display:block;background-size:300% 200%;background-repeat:no-repeat}.pose.large{width:140px;height:140px}h2{font-size:12px;margin:6px 0 18px}.buttons{display:flex;flex-direction:column;gap:15px;align-items:center}button{display:flex;align-items:center;border:1px solid white;border-radius:30px;background:#e3f7e7;box-shadow:0 6px 20px #1d473325;padding:2px 15px 2px 3px;gap:5px;font:14px system-ui}button .pose{width:56px;height:56px}button.dark{padding:4px;background:#14251f}</style><h1>Ая · шесть состояний · контрольный размер 56px</h1><main>${pictures.join('')}</main>`);
 await montage.screenshot({path:path.join(out,'mascot-states.png')});await montage.close();check('Six atlas expressions rendered at 56px button size');
 if(!process.argv.includes('--mascot-only')){
  const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out,size:{width:1440,height:1000}}});
  page=await context.newPage();page.on('pageerror',error=>report.errors.push(String(error)));
  const artRequests=[];page.on('request',r=>{if(/\/aya\/guide-/.test(r.url()))artRequests.push(r.url());});
  await page.goto(origin);await page.getByTestId('aya-assistant').waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-testid=city-map]')?.dataset.ready==='true',null,{timeout:60000});
  report.environment={...report.environment,...await artifactContext(page)};
  await page.locator('.aya-entry [data-art=idle]').waitFor();
  check('Idle loads its exact tile without the expression atlas',artRequests.some(r=>r.endsWith('guide-idle.webp'))&&!artRequests.some(r=>r.endsWith('guide-atlas.webp')));
  await captureFrame(page,path.join(out,'desktop-idle.png'),report);
  const skip=page.getByRole('button',{name:'Пропустить показ',exact:true});if(await skip.count())await skip.click();
  await open(page);await send(page,'Помоги с нехваткой школ в Нуре');
  await page.getByRole('button',{name:'Остановить',exact:true}).click();await page.waitForTimeout(1800);check('Stop before commit does not spend', (await plan(page)).length===0);
  await send(page,'Помоги с нехваткой школ в Нуре');await waitCount(page,1);await page.getByRole('button',{name:'Остановить',exact:true}).click();
  check('Supported free text commits exactly M7 in Nura',JSON.stringify(await plan(page))===JSON.stringify([{initiativeId:'M7',scope:'district',districtId:'nura'}])||((await plan(page))[0].initiativeId==='M7'&&(await plan(page))[0].districtId==='nura'));
  await page.waitForFunction(()=>!document.querySelector('.aya-control-row button:last-child').disabled);await page.locator('[data-art=atlas]').first().waitFor();check('Nonidle expressions load the original atlas',artRequests.some(r=>r.endsWith('guide-atlas.webp')));await captureFrame(page,path.join(out,'desktop-school-stopped.png'),report);
  await manualPark(page);await waitCount(page,2);await open(page);await page.getByRole('button',{name:'Отменить мой шаг',exact:true}).click();await waitCount(page,1);check('Aya undo preserves later manual park',(await plan(page))[0].initiativeId==='M4');
  await send(page,'Что даст школа?');await page.waitForFunction(()=>!document.querySelector('.aya-progress'),null,{timeout:21000});
  check('An explanatory question does not spend',(await plan(page)).length===1);
  const last=await page.locator('.aya-message.from-assistant').last().innerText();check('Dialogue mode is truthfully labeled',last.includes('без AI-связи')||last.includes('AI-диалог'));
  report.desktopUserContrast=await userContrast(page);check('Desktop user-message text has at least 4.5:1 rendered contrast',report.desktopUserContrast>=4.5);
  await captureFrame(page,path.join(out,'desktop-dialogue.png'),report);
  await close(page);await page.getByRole('navigation',{name:'Пространства Алем'}).getByRole('button',{name:'Жители',exact:false}).click();await open(page);check('Conversation survives space transition',await page.getByText('Что даст школа?',{exact:true}).count()>0);
  await close(page);await page.getByRole('navigation',{name:'Пространства Алем'}).getByRole('button',{name:'Итог',exact:false}).click();await open(page);await captureFrame(page,path.join(out,'dashboard-dialogue.png'),report);
  await page.reload();await open(page);check('Conversation and plan survive refresh',await page.getByText('Что даст школа?',{exact:true}).count()>0&&(await plan(page))[0].initiativeId==='M4');
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await captureFrame(page,path.join(out,'narrow-dialogue.png'),report);
  report.phoneUserContrast=await userContrast(page);check('Phone user-message text has at least 4.5:1 rendered contrast',report.phoneUserContrast>=4.5);
  const bounds=await page.locator('#aya-dialogue').boundingBox(),navigation=await page.locator('.primary-navigation').boundingBox();check('Narrow dialogue stays inside viewport above navigation',bounds&&navigation&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=391&&bounds.y+bounds.height<=navigation.y-6);
  await page.getByLabel('Сообщение Ае',{exact:true}).focus();await page.keyboard.press('Escape');check('Escape closes Aya and restores entry focus',await page.locator('#aya-dialogue').count()===0&&await page.locator('.aya-entry').evaluate(el=>el===document.activeElement));
  await context.close();check('No uncaught application errors',report.errors.length===0);
 }
}catch(error){report.failure=String(error);process.exitCode=1;console.error(error);await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
