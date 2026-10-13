import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {executablePath,browserArgs} from '../release/browser-options.mjs';
import {chooseProject,confirmProject} from '../integration/ui.mjs';
const origin=process.env.APP_URL||'http://127.0.0.1:4198',out=process.env.CAPTURE_DIR||'artifacts/khanate/resilience';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),report={checks:[],errors:[],api:[],date:new Date().toISOString()};
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS',name);};
const contexts=[];
const create=async(width=1440,height=900,extra={})=>{const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',...extra});contexts.push(context);await context.route('**/api/**',route=>{report.api.push(route.request().url());return route.abort();});const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.message));return {page,context};};
const ready=page=>page.locator('[data-ready=true]').waitFor();
const nav=(page,name)=>page.getByRole('navigation',{name:'Пространства Алем'}).getByRole('button',{name,exact:true}).click();
try{
 for(const width of [390,820]){
  const {page}=await create(width,844,{hasTouch:true,isMobile:width===390});await page.goto(`${origin}/?mode=khanate`);await ready(page);
  const bounds=await page.locator('.city-hud button,.hud-brand').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none').map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON()})));
  check(`${width}: every visible treasury and mode control stays on screen`,bounds.every(b=>b.rect.left>=0&&b.rect.right<=width+1));
  await page.getByRole('button',{name:'Как играть',exact:true}).click();await page.getByRole('dialog').waitFor();check(`${width}: guidance is available`,(await page.getByRole('dialog').innerText()).includes('Таймера нет'));await page.getByRole('button',{name:'Продолжить игру',exact:true}).click();
  await page.screenshot({path:`${out}/arrival-${width}.png`});
  await page.locator('.need-card[data-choice=M7]').click();await page.getByTestId('held-project').waitFor();await page.waitForTimeout(1600);
  const sheet=await page.locator('.planning-drawer').boundingBox(),confirm=await page.locator('.proposal-confirmation .primary').boundingBox();
  if(width===390){check('Phone proposal has a 40–45% compact sheet',sheet.height/844>=.40&&sheet.height/844<=.45);check('Phone confirmation is visible without expanding',confirm.y>=sheet.y&&confirm.y+confirm.height<=sheet.y+sheet.height+1);await page.screenshot({path:`${out}/phone-proposal.png`});await page.getByRole('button',{name:'Подробнее о решении'}).click();check('Phone details expand without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`${out}/phone-details.png`});}
  await confirmProject(page);check(`${width}: normal confirmation commits once`,await page.getByTestId('remaining-budget').innerText()==='76');
 }
 const denied=await create(1366,768,{reducedMotion:'reduce'});await denied.context.addInitScript(()=>{for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{get(){throw new DOMException('Disabled','SecurityError');}});});
 await denied.page.goto(`${origin}/?mode=khanate`);await ready(denied.page);await denied.page.locator('.need-card[data-choice=M7]').click();await confirmProject(denied.page);
 await denied.page.getByRole('button',{name:'Астана',exact:true}).click();await denied.page.getByTestId('remaining-budget').waitFor();check('Denied storage still isolates the modern plan',await denied.page.getByTestId('remaining-budget').innerText()==='100');
 await denied.page.getByRole('button',{name:'Хандық',exact:true}).click();await ready(denied.page);check('Denied storage preserves committed history across worlds',await denied.page.getByTestId('remaining-budget').innerText()==='76');
 const quietBefore=await denied.page.getByTestId('city-map').getAttribute('data-draw-count');await denied.page.waitForTimeout(700);check('Reduced motion stops idle rendering',await denied.page.getByTestId('city-map').getAttribute('data-draw-count')===quietBefore);
 const {page,context}=await create(1440,900,{reducedMotion:'reduce'});await page.goto(`${origin}/?mode=khanate`);await ready(page);
 const ids=['baiterek','khan','akorda','palace','expo','hazret','opera','arch','concert','atyrau','abudhabi','grand-mosque','esil-bridges','lrt'];
 for(const id of ids){await page.locator('.landmark-atlas summary').click();await page.locator(`.landmark-atlas-list [data-landmark-id="${id}"]`).click();await page.waitForFunction(id=>document.querySelector('[data-testid=city-map]')?.dataset.landmark===id,id);check(`Historical landmark ${id} has a grounded native view`,await page.locator('.alem-city').evaluate(c=>c.getContext('webgl2').getError())===0);await page.screenshot({path:`${out}/landmark-${id}.png`});}
 await page.getByRole('button',{name:'К решениям',exact:true}).click();await page.locator('.need-card[data-choice=M7]').click();await page.getByTestId('held-project').waitFor();await page.getByRole('button',{name:'Астана',exact:true}).click();await page.getByTestId('remaining-budget').waitFor();check('Switching discards an unconfirmed proposal',await page.getByTestId('remaining-budget').innerText()==='100');await page.getByRole('button',{name:'Хандық',exact:true}).click();await ready(page);check('Returning does not resurrect an unconfirmed preview',await page.getByTestId('held-project').count()===0&&await page.getByTestId('remaining-budget').innerText()==='100');
 await chooseProject(page,'M7');await confirmProject(page);await page.getByRole('button',{name:'Открыть Аю — помощницу города'}).click();await page.getByLabel('Сообщение Ае',{exact:true}).fill('Доведи план');await page.getByRole('button',{name:'Отправить сообщение Ае'}).click();await page.locator('.aya-progress').waitFor();await page.getByRole('button',{name:'Астана',exact:true}).click();await page.getByTestId('remaining-budget').waitFor();await page.waitForTimeout(2000);check('Late historical assistant work cannot spend in Astana',await page.getByTestId('remaining-budget').innerText()==='100');
 await page.getByRole('button',{name:'Хандық',exact:true}).click();await ready(page);const balance=await page.getByTestId('remaining-budget').innerText();
 await page.locator('.alem-city').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await page.getByRole('button',{name:'Повторить загрузку карты'}).waitFor();check('Context loss preserves the treasury and historical fallback',await page.getByTestId('remaining-budget').innerText()===balance&&await page.locator('.district-button').count()===5);await page.screenshot({path:`${out}/fallback.png`});await ready(page);check('Native recovery keeps the committed plan',await page.getByTestId('remaining-budget').innerText()===balance);
 await nav(page,'Прошения');await page.getByTestId('resident-conversation').waitFor();check('The petition book remains accessible after recovery',!(await page.getByTestId('resident-conversation').innerText()).match(/автобус|поликлиник|модульн/i));
 check('Resilience tests made zero API requests',report.api.length===0);check('No unhandled exceptions',report.errors.length===0);report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;console.error(error);for(const [i,c]of contexts.entries()){const p=c.pages()[0];if(p)await p.screenshot({path:`${out}/failure-${i}.png`}).catch(()=>{});}}
finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
