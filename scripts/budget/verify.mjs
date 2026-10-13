/** Real priced choices, conflict recovery, replacement and refund. No seeded plan. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {skipDemonstration,confirmProject,chooseProject,openCatalogue,captureFrame,labelVideo} from '../integration/ui.mjs';
const origin=process.env.APP_URL||'http://127.0.0.1:4174',out=process.env.RELEASE_OUTPUT||'artifacts/budget';
await mkdir(out,{recursive:true});
const report={date:new Date().toISOString(),origin,checks:[],errors:[],limitations:['Automated pointer and touch-emulated journey, not a human usability study']};
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS',name);};
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',recordVideo:{dir:out,size:{width:1440,height:900}}}),page=await context.newPage();
page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.message));
const plan=(p=page)=>p.evaluate(()=>JSON.parse(localStorage.getItem('akim:draft')||'{"plan":[]}').plan);
const remaining=(p=page)=>p.getByTestId('remaining-budget').innerText();
const propose=async(id,district,p=page)=>{await chooseProject(p,id);if(district)await p.locator('.candidate select').selectOption(district);};
const shot=name=>captureFrame(page,`${out}/${name}.png`,report);
try{
 await page.goto(origin);await skipDemonstration(page);await page.locator('[data-testid=city-map][data-ready=true]').waitFor();
 check('Fresh city exposes the five-decision counter and untouched treasury',await remaining()==='100'&&await page.getByTestId('decision-count').innerText()==='0 из 5'&&await page.locator('.city-application').getAttribute('data-context')==='city'&&(await plan()).length===0);
 await page.locator('[data-toggle=treasury]').click();await page.getByTestId('treasury-sheet').waitFor();check('Budget opens the treasury and funded plan separately from projects',await page.locator('.treasury-ledger').isVisible()&&await page.locator('.project-catalogue').count()===0);await page.getByRole('button',{name:'Вернуться в город',exact:true}).click();
 await chooseProject(page,'M4');await page.locator('.candidate select').selectOption('esil');
 check('Preview never spends',await remaining()==='100'&&(await plan()).length===0);await shot('01-priced-proposal');
 await confirmProject(page);check('Explicit park decision spends exactly 15',await remaining()==='85'&&(await plan()).length===1);
 await propose('M7','esil');check('Same-district park/school conflict blocks confirmation',!await page.getByTestId('held-project').locator('.button-row .primary').isEnabled()&&await remaining()==='85');await shot('02-conflict');
 await page.locator('.candidate select').selectOption('nura');check('Changing district resolves the scoped conflict',await page.getByTestId('held-project').locator('.button-row .primary').isEnabled());
 await confirmProject(page);check('School spends its fixed 24',await remaining()==='61'&&(await plan()).length===2);
 await chooseProject(page,'M4');await propose('M8','esil');
 check('Replacement preview retains the original plan and budget',await remaining()==='61'&&(await plan()).some(d=>d.initiativeId==='M4'));
 await confirmProject(page);check('Replacement refunds 15 and charges 20 once',await remaining()==='56'&&(await plan()).length===2&&!(await plan()).some(d=>d.initiativeId==='M4'));await shot('03-replacement');
 await chooseProject(page,'M7');await page.getByRole('button',{name:'Убрать: Модульная школа и детский сад',exact:true}).click();
 check('Removal refunds exactly 24',await remaining()==='80'&&(await plan()).length===1);
 await chooseProject(page,'M8');
 await page.getByRole('button',{name:/^Убрать:/}).click();check('Removing the last decision restores all 100 units',await remaining()==='100'&&(await plan()).length===0);
 await chooseProject(page,'M1');await openCatalogue(page);const catalogue=await page.locator('.project-choice').evaluateAll(es=>es.map(e=>e.dataset.project));check('The complete catalogue still exposes all fourteen projects',new Set(catalogue).size===14);
 for(const id of catalogue){await chooseProject(page,id);check(`${id}: inspecting cost and scope spends nothing`,await remaining()==='100'&&(await plan()).length===0);}
 await openCatalogue(page);await shot('04-complete-catalogue');
 const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),p=await touch.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(origin);await skipDemonstration(p);
 await chooseProject(p,'M1');check('Touch preview leaves the treasury intact',await remaining(p)==='100');await p.getByTestId('held-project').locator('.button-row .primary').tap();check('Touch confirms only the displayed fixed price',await remaining(p)==='82'&&(await plan(p)).length===1);await captureFrame(p,`${out}/05-touch-decision.png`,report);
 check('Phone has no page-level overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await touch.close();
 check('No browser exceptions',report.errors.length===0);report.complete=true;
}catch(error){report.complete=false;report.failure=String(error);console.error(error);process.exitCode=1;await shot('failure').catch(()=>{});}
finally{await labelVideo(page,`${out}/budget-sequence.webm`,report);await page.close();await context.close();await rename(await page.video().path(),`${out}/budget-sequence.webm`);await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');}
