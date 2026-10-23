import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {executablePath,browserArgs} from '../release/browser-options.mjs';

// An isolated mount of the actual component, served by Vite: exercise delayed
// image delivery and failures without coupling these cases to dialogue timing.
const origin=process.env.DEV_URL||'http://127.0.0.1:5174';
const out=path.resolve(process.env.RELEASE_OUTPUT||'artifacts/city-programs/aya-loading');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const report={origin,execution:'development-component-browser',date:new Date().toISOString(),checks:[]};
const check=(name,condition)=>{assert(condition,name);report.checks.push(name);console.log('PASS',name);};
const fixture=`<!doctype html><html><body style="background:#f5f6ed"><div id="root"></div><script>window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;</script><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import {AyaMascot} from '/src/assistant/AyaMascot.tsx';
const root=ReactDOM.createRoot(document.getElementById('root'));
window.pose=expression=>root.render(React.createElement(AyaMascot,{expression}));window.pose('idle');
</script><style>.aya-guide{display:block;width:56px;height:56px;background-repeat:no-repeat}</style></body></html>`;
const context=async failures=>{
 const c=await browser.newContext({viewport:{width:390,height:844}});
 await c.route('**/aya-asset-probe',route=>route.fulfill({contentType:'text/html',body:fixture}));
 if(failures)await c.route('**/aya/guide-*.webp',route=>failures==='both'||route.request().url().endsWith('guide-atlas.webp')?route.abort():route.continue());
 return c;
};
try{
 const c=await context(),page=await c.newPage(),requests=[];page.on('pageerror',error=>console.error('Fixture error:',error));page.on('request',r=>{if(r.url().includes('/aya/guide-'))requests.push(r.url());});
 let release;const blocked=new Promise(resolve=>release=resolve);
 await page.route('**/aya/guide-atlas.webp',async route=>{await blocked;await route.continue();});
 await page.goto(origin+'/aya-asset-probe');await page.locator('[data-art=idle]').waitFor();
 check('Idle loads only the exact single-pose tile',requests.length===1&&requests[0].endsWith('guide-idle.webp'));
 check('The idle tile fills the original 56px control',await page.locator('.aya-guide').evaluate(e=>getComputedStyle(e).backgroundSize==='100% 100%'&&e.getBoundingClientRect().width===56));
 await page.screenshot({path:out+'/idle.png'});
 await page.evaluate(()=>window.pose('thought'));await page.waitForFunction(()=>document.querySelector('.aya-guide'));
 await page.waitForTimeout(200);check('Idle remains visible while the expression atlas is delayed',await page.locator('[data-art=idle]').count()===1&&requests.some(r=>r.endsWith('guide-atlas.webp')));
 await page.evaluate(()=>window.pose('explanation'));release();await page.locator('[data-art=atlas]').waitFor();
 check('A late atlas uses the current expression',await page.locator('.aya-guide').evaluate(e=>getComputedStyle(e).backgroundPosition==='0% 100%'));
 const positions={thought:'50% 0%',attention:'100% 0%',explanation:'0% 100%',success:'50% 100%',error:'100% 100%'};
 for(const [pose,position] of Object.entries(positions)){
  await page.evaluate(p=>window.pose(p),pose);await page.waitForFunction(p=>getComputedStyle(document.querySelector('.aya-guide')).backgroundPosition===p,position);
  check('Original atlas expression '+pose,await page.locator('.aya-guide').evaluate(e=>getComputedStyle(e).backgroundSize==='300% 200%'));
  await page.locator('.aya-guide').screenshot({path:out+'/'+pose+'.png'});
 }
 await page.evaluate(()=>window.pose('idle'));await page.locator('[data-art=idle]').waitFor();check('Returning to idle restores its exact tile',true);await c.close();
 const failed=await context('atlas'),fp=await failed.newPage();await fp.goto(origin+'/aya-asset-probe');await fp.locator('[data-art=idle]').waitFor();await fp.evaluate(()=>window.pose('error'));await fp.waitForTimeout(300);
 check('Atlas failure preserves the already loaded idle portrait',await fp.locator('[data-art=idle]').count()===1);await failed.close();
 const missing=await context('both'),mp=await missing.newPage();await mp.goto(origin+'/aya-asset-probe');await mp.waitForFunction(()=>typeof window.pose==='function');await mp.evaluate(()=>window.pose('attention'));await mp.waitForTimeout(300);
 check('Complete art failure retains the Aya text fallback',await mp.locator('[data-art=fallback]').innerText()==='Aya');await missing.close();
 report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;console.error(error);}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
