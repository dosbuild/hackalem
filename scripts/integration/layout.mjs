/** Visible primary actions and hit targets on wide, laptop, touch and short screens. */
import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {chromium} from 'playwright';import {executablePath,browserArgs} from '../release/browser-options.mjs';import {skipDemonstration,openCatalogue,chooseProject,navigate,captureFrame} from './ui.mjs';
const out=process.env.RELEASE_OUTPUT||'artifacts/integration/layout';await mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath,headless:true,args:browserArgs}),report={checks:[],errors:[],views:[]};const check=(name,ok)=>{assert(ok,name);report.checks.push(name);console.log('PASS',name);};
const exposed=(p,selector)=>p.locator(selector).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:e.textContent?.trim(),inside:r.y>=0&&r.bottom<=innerHeight&&r.x>=0&&r.right<=innerWidth,hit:hit===e||e.contains(hit)};}));
const cardExposure=card=>card.evaluate(button=>{
 const r=button.getBoundingClientRect(),clip={left:0,top:0,right:innerWidth,bottom:innerHeight};
 for(let parent=button.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent),b=parent.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(style.overflowX)){clip.left=Math.max(clip.left,b.left);clip.right=Math.min(clip.right,b.right);}if(/auto|scroll|hidden|clip/.test(style.overflowY)){clip.top=Math.max(clip.top,b.top);clip.bottom=Math.min(clip.bottom,b.bottom);}}
 // Probe the actual rounded hit shape, not transparent rectangular corners.
 // Full rectangle containment still rejects clipped controls; four edge
 // midpoints plus four inner arcs and the center all require native hits.
 const style=getComputedStyle(button),corner=value=>{const [x,y=x]=value.split(/\s+/),radius=(n,span)=>Math.min(span/2,parseFloat(n)*(n.endsWith('%')?span/100:1)||0);return [Math.max(2,radius(x,r.width)*(1-Math.SQRT1_2)+2),Math.max(2,radius(y,r.height)*(1-Math.SQRT1_2)+2)];};
 const tl=corner(style.borderTopLeftRadius),tr=corner(style.borderTopRightRadius),bl=corner(style.borderBottomLeftRadius),br=corner(style.borderBottomRightRadius),cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2;
 const points=[[r.left+tl[0],r.top+tl[1]],[r.right-tr[0],r.top+tr[1]],[r.left+bl[0],r.bottom-bl[1]],[r.right-br[0],r.bottom-br[1]],[cx,r.top+2],[cx,r.bottom-2],[r.left+2,cy],[r.right-2,cy],[cx,cy]],hits=points.map(([x,y])=>{const hit=document.elementFromPoint(x,y);return {x,y,hit:!!hit&&button.contains(hit),target:hit?`${hit.tagName.toLowerCase()}.${hit.className?.baseVal??hit.className}`:null};});
 // Fractional scroll borders get half a pixel of tolerance; native hits do not.
 const visible=r.left>=clip.left-.5&&r.right<=clip.right+.5&&r.top>=clip.top-.5&&r.bottom<=clip.bottom+.5&&hits.every(p=>p.hit);
 return {visible,choice:button.dataset.project??button.dataset.choice,clip,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},blocked:hits.filter(p=>!p.hit),wheel:{x:r.right>clip.right?Math.ceil(r.right-clip.right)+8:r.left<clip.left?Math.floor(r.left-clip.left)-8:0,y:r.bottom>clip.bottom?Math.ceil(r.bottom-clip.bottom)+8:r.top<clip.top?Math.floor(r.top-clip.top)-8:0}};
});
try{for(const [width,height]of [[1440,900],[1280,720],[775,803],[390,844],[360,640]]){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(process.env.APP_URL||'http://127.0.0.1:4174');await skipDemonstration(p);await p.locator('[data-toggle=planning]').waitFor();
 let controls=await exposed(p,'.primary-navigation button,.aya-entry,[data-toggle=treasury],[data-toggle=planning],.camera-main button:visible');report.views.push({width,height,space:'city',controls});check(`${width}×${height}: City controls and navigation are visible and uncovered`,controls.every(r=>r.inside&&r.hit));check(`${width}×${height}: City starts without a context sheet`,await p.locator('.city-application').getAttribute('data-context')==='city'&&await p.locator('.context-panel,.planning-drawer').count()===0);await captureFrame(p,`${out}/city-${width}x${height}.png`,report);
 await openCatalogue(p);await p.locator('.project-choice').first().waitFor();
 const initialHeader=await exposed(p,'.catalogue-heading select,.drawer-heading>button');report.views.push({width,height,space:'catalogue-header',controls:initialHeader});check(`${width}×${height}: project filter and close are exposed`,initialHeader.length===2&&initialHeader.every(r=>r.inside&&r.hit));
 const projects=await p.locator('.project-choice').count();check(`${width}×${height}: catalogue exposes all14 distinct projects`,projects===14);
 for(let index=0;index<projects;index++){
  const card=p.locator('.project-choice').nth(index);let seen=await cardExposure(card);
  for(let attempt=0;!seen.visible&&attempt<12;attempt++){
   await p.mouse.move((seen.clip.left+seen.clip.right)/2,(seen.clip.top+seen.clip.bottom)/2);await p.mouse.wheel(seen.wheel.x,seen.wheel.y);await p.waitForTimeout(200);seen=await cardExposure(card);
  }
  report.views.push({width,height,space:'scrolled-project',...seen});check(`${width}×${height}: public scrolling fully exposes project${index+1} and its priced action`,seen.visible);
 }
 await p.locator('.plan-tools>summary').scrollIntoViewIfNeeded();controls=await exposed(p,'.plan-tools>summary');check(`${width}×${height}: secondary recovery tools remain reachable by public scrolling`,controls.length===1&&controls.every(r=>r.inside&&r.hit));await captureFrame(p,`${out}/catalogue-footer-${width}x${height}.png`,report);
 await chooseProject(p,'M7');controls=await exposed(p,'.candidate .button-row button,[data-toggle=treasury],[data-toggle=planning],.drawer-heading>button');check(`${width}×${height}: priced decision and cancellation stay in reach`,controls.every(r=>r.inside&&r.hit));await captureFrame(p,`${out}/proposal-${width}x${height}.png`,report);await p.getByRole('button',{name:'Close planning'}).click();
 await navigate(p,'residents');await p.getByTestId('resident-conversation').waitFor();controls=await exposed(p,'.street-primary,.primary-navigation button,.aya-entry');report.views.push({width,height,space:'residents',controls});check(`${width}×${height}: resident primary action and navigation stay exposed`,controls.every(r=>r.inside&&r.hit));
 for(const control of await p.locator('.street-tabs button,.street-roster button,.street-topline button').all()){
  await control.scrollIntoViewIfNeeded();let seen=await cardExposure(control);
  for(let attempt=0;!seen.visible&&(seen.wheel.x||seen.wheel.y)&&attempt<8;attempt++){await p.mouse.move((seen.clip.left+seen.clip.right)/2,(seen.clip.top+seen.clip.bottom)/2);await p.mouse.wheel(seen.wheel.x,seen.wheel.y);await p.waitForTimeout(200);seen=await cardExposure(control);}
  const label=await control.getAttribute('aria-label')||await control.innerText();report.views.push({width,height,space:'resident-control',label,...seen});check(`${width}×${height}: public scrolling exposes resident control ${label}`,seen.visible);
 }
 await captureFrame(p,`${out}/resident-${width}x${height}.png`,report);
 if(width===360&&height===640){
  await navigate(p,'map');
  const settings=p.getByRole('button',{name:'Adjust camera',exact:true});await settings.click();
  check('360×640: pointer opens the compact camera settings tray',await settings.getAttribute('aria-expanded')==='true');
  const tray=await exposed(p,'.camera-extras button:visible');check('360×640: every expanded camera setting is inside the viewport and uncovered',tray.length===6&&tray.every(r=>r.inside&&r.hit));
  await p.waitForFunction(()=>{const d=document.querySelector('[data-testid=city-map]')?.dataset;if(!d?.camera||!d.target||d.camera!==d.renderCamera)return false;const camera=JSON.parse(d.camera),target=JSON.parse(d.target);return ['x','y','yaw','pitch','zoom'].every(key=>Math.abs(camera[key]-target[key])<.000001);});
  const before=JSON.parse(await p.getByTestId('city-map').getAttribute('data-camera'));await p.locator('.camera-extras').getByRole('button',{name:'Zoom in on map',exact:true}).click();
  await p.waitForFunction(zoom=>JSON.parse(document.querySelector('[data-testid=city-map]').dataset.camera).zoom>zoom+.0001,before.zoom);
  check('360×640: expanded zoom changes the real camera without spending',await p.getByTestId('remaining-budget').innerText()==='100');await captureFrame(p,`${out}/camera-settings-360x640.png`,report);
  await settings.click();await p.keyboard.press('Shift+Tab');
  for(let turn=0;turn<60&&!await settings.evaluate(button=>button===document.activeElement);turn++)await p.keyboard.press('Tab');
  check('360×640: native keyboard navigation reaches camera settings',await settings.evaluate(button=>button===document.activeElement));await p.keyboard.press('Enter');
  check('360×640: Enter opens settings and keeps its keyboard focus',await settings.getAttribute('aria-expanded')==='true'&&await settings.evaluate(button=>button===document.activeElement));await p.keyboard.press('Enter');
 }
 await navigate(p,'dashboard');await p.locator('.dash-hero').waitFor();await captureFrame(p,`${out}/dashboard-${width}x${height}.png`,report);check(`${width}×${height}: dashboard fits width`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.getByRole('button',{name:'Open Aya, the city assistant'}).click();const r=await p.locator('#aya-dialogue').boundingBox();check(`${width}×${height}: Aya suspends the previous contextual surface`,await p.locator('.product-space,.planning-drawer,.context-encounter,.context-panel').count()===0);check(`${width}×${height}: Aya remains within screen`,r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<height-65);await captureFrame(p,`${out}/aya-${width}x${height}.png`,report);await context.close();
 }check('no browser exceptions',report.errors.length===0);report.completed=true;
}catch(error){report.completed=false;report.failure=String(error);console.error(error);process.exitCode=1;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
